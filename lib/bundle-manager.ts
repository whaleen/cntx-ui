/**
 * Bundle Manager for cntx-ui
 * Handles Smart Dynamic Bundles and traditional XML generation
 */

import { readFileSync } from 'fs';
import { extname, basename, dirname } from 'path';
import ConfigurationManager, { BundleState } from './configuration-manager.js';
import FileSystemManager from './file-system-manager.js';
import DatabaseManager from './database-manager.js';
import WebSocketManager from './websocket-manager.js';

export interface BundleInfo {
  name: string;
  fileCount: number;
  size: number;
  generated?: string;
  changed: boolean;
  patterns?: string[];
  type: 'manual' | 'smart';
  purpose?: string;
  description?: string;
  files?: string[];
}

export default class BundleManager {
  configManager: ConfigurationManager;
  fileSystemManager: FileSystemManager;
  webSocketManager: WebSocketManager | null;
  db: DatabaseManager;
  verbose: boolean;
  _isScanning: boolean;

  constructor(configManager: ConfigurationManager, fileSystemManager: FileSystemManager, verbose = false) {
    this.configManager = configManager;
    this.fileSystemManager = fileSystemManager;
    this.webSocketManager = null;
    this.db = configManager.dbManager;
    this.verbose = verbose;
    this._isScanning = false;
  }

  /**
   * Get all bundle information, including Smart Dynamic Bundles
   */
  getAllBundleInfo(): BundleInfo[] {
    const manualBundles = Array.from(this.configManager.getBundles().entries()).map(([name, bundle]) => ({
      name,
      fileCount: bundle.files?.length || 0,
      size: bundle.size || 0,
      generated: bundle.generated,
      changed: !!bundle.changed,
      patterns: bundle.patterns,
      type: 'manual' as const
    }));

    const smartBundles = this.generateSmartBundleDefinitions();
    // Filter out smart bundles that have no files
    const activeSmartBundles = smartBundles.map(b => {
      const files = this.resolveSmartBundle(b.name);
      return {
        ...b,
        fileCount: files.length,
        files
      };
    }).filter(b => b.fileCount > 0);

    return [...manualBundles, ...activeSmartBundles];
  }

  /**
   * Generate Smart Bundle definitions from indexed semantic data
   */
  generateSmartBundleDefinitions(): BundleInfo[] {
    const smartBundles: BundleInfo[] = [];
    try {
      // 1. Group by Purpose (Heuristics)
      const purposeRows = this.db.db.prepare('SELECT DISTINCT purpose, COUNT(*) as count FROM semantic_chunks GROUP BY purpose').all() as { purpose: string, count: number }[];
      purposeRows.forEach(row => {
        if (!row.purpose) return;
        const name = `smart:${row.purpose.toLowerCase().replace(/\s+/g, '-')}`;
        smartBundles.push({
          name,
          purpose: row.purpose,
          fileCount: row.count,
          size: 0,
          changed: false,
          type: 'smart',
          description: `Automatically grouped by purpose: ${row.purpose}`
        });
      });

      // 2. Group by Component Types (Subtypes)
      const subtypeRows = this.db.db.prepare('SELECT DISTINCT subtype, COUNT(*) as count FROM semantic_chunks GROUP BY subtype').all() as { subtype: string, count: number }[];
      subtypeRows.forEach(row => {
        if (!row.subtype) return;
        const name = `smart:type-${row.subtype.toLowerCase().replace(/_/g, '-')}`;
        smartBundles.push({
          name,
          purpose: row.subtype,
          fileCount: row.count,
          size: 0,
          changed: false,
          type: 'smart',
          description: `All ${row.subtype} elements across the codebase`
        });
      });
    } catch (e: any) {
      if (this.verbose) console.warn('Smart bundle discovery failed:', e.message);
    }
    return smartBundles;
  }

  /**
   * Resolve files for a bundle (Manual or Smart)
   */
  async resolveBundleFiles(bundleName: string): Promise<string[]> {
    if (bundleName.startsWith('smart:')) {
      return this.resolveSmartBundle(bundleName);
    }

    const bundle = this.configManager.getBundles().get(bundleName);
    if (!bundle) return [];

    const allFiles = this.fileSystemManager.getAllFiles();
    return allFiles.filter(file =>
      bundle.patterns.some(pattern => this.fileSystemManager.matchesPattern(file, pattern))
    ).map(f => this.fileSystemManager.relativePath(f));
  }

  /**
   * Resolve a Smart Bundle query against SQLite
   */
  resolveSmartBundle(bundleName: string): string[] {
    const query = bundleName.replace('smart:', '');
    let rows: { file_path: string }[] = [];

    if (query.startsWith('type-')) {
      const type = query.replace('type-', '').replace(/-/g, '_');
      rows = this.db.db.prepare('SELECT DISTINCT file_path FROM semantic_chunks WHERE LOWER(subtype) = ?').all(type) as { file_path: string }[];
    } else {
      const purposeRows = this.db.db.prepare('SELECT DISTINCT purpose FROM semantic_chunks').all() as { purpose: string }[];
      const matched = purposeRows.find(r => r.purpose?.toLowerCase().replace(/\s+/g, '-') === query);
      if (matched) {
        rows = this.db.db.prepare('SELECT DISTINCT file_path FROM semantic_chunks WHERE purpose = ?').all(matched.purpose) as { file_path: string }[];
      }
    }
    return rows.map(r => r.file_path);
  }

  // === Bundle Generation ===

  async generateAllBundles() {
    this._isScanning = true;
    try {
      const bundles = this.configManager.getBundles();
      for (const [name] of bundles) {
        await this.regenerateBundle(name);
      }
    } finally {
      this._isScanning = false;
    }
  }

  async regenerateBundle(bundleName: string): Promise<BundleState> {
    if (this.verbose) console.log(`🔄 Regenerating bundle: ${bundleName}`);
    
    const files = await this.resolveBundleFiles(bundleName);
    const content = await this.generateBundleXML(bundleName, files);
    
    const bundleData: BundleState = {
      files,
      content,
      size: Buffer.byteLength(content, 'utf8'),
      generated: new Date().toISOString(),
      changed: false,
      patterns: [] // Default patterns
    };

    if (!bundleName.startsWith('smart:')) {
      const existing = this.configManager.getBundles().get(bundleName);
      if (existing) {
        bundleData.patterns = existing.patterns;
      }
      this.configManager.getBundles().set(bundleName, bundleData);
      this.configManager.saveBundleStates();
    }

    return bundleData;
  }

  async generateBundleXML(bundleName: string, relativeFiles: string[]): Promise<string> {
    const projectInfo = this.getProjectInfo();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<codebase>\n`;
    xml += `  <project_info>\n    <name>${this.escapeXml(projectInfo.name)}</name>\n    <bundle>${this.escapeXml(bundleName)}</bundle>\n  </project_info>\n`;
    
    for (const relPath of relativeFiles) {
      xml += await this.generateFileXML(relPath);
    }
    
    xml += `</codebase>`;
    return xml;
  }

  async generateFileXML(relativePath: string): Promise<string> {
    try {
      const fullPath = this.fileSystemManager.fullPath(relativePath);
      const content = readFileSync(fullPath, 'utf8');
      const chunks = this.db.getChunksByFile(relativePath);
      
      let xml = `  <file path="${this.escapeXml(relativePath)}">\n`;
      if (chunks.length > 0) {
        xml += `    <semantic_context>\n`;
        chunks.forEach(c => {
          xml += `      <chunk name="${this.escapeXml(c.name)}" purpose="${this.escapeXml(c.purpose)}" complexity="${c.complexity?.score || 0}" />\n`;
        });
        xml += `    </semantic_context>\n`;
      }
      xml += `    <content><![CDATA[${content}]]></content>\n  </file>\n`;
      return xml;
    } catch (e: any) {
      return `  <file path="${this.escapeXml(relativePath)}" error="${this.escapeXml(e.message)}" />\n`;
    }
  }

  getProjectInfo() {
    try {
      const pkg = JSON.parse(readFileSync(this.fileSystemManager.fullPath('package.json'), 'utf8'));
      return { name: pkg.name || 'Unknown', version: pkg.version || '1.0.0' };
    } catch {
      return { name: 'Unknown', version: '1.0.0' };
    }
  }

  escapeXml(text: string) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  getBundleContent(bundleName: string): string | Promise<string> | null {
    if (bundleName.startsWith('smart:')) {
      // For smart bundles, we generate on the fly if not cached
      return this.regenerateBundle(bundleName).then(data => data.content || '');
    }
    const bundle = this.configManager.getBundles().get(bundleName);
    return bundle ? bundle.content || null : null;
  }

  markBundlesChanged(filename: string) {
    this.configManager.getBundles().forEach((bundle, name) => {
      if (bundle.patterns?.some(p => this.fileSystemManager.matchesPattern(filename, p))) {
        bundle.changed = true;
      }
    });
  }

  getBundleInfo(bundleName: string): BundleInfo | undefined {
    if (bundleName.startsWith('smart:')) {
      return this.generateSmartBundleDefinitions().find(b => b.name === bundleName);
    }
    const bundle = this.configManager.getBundles().get(bundleName);
    if (!bundle) return undefined;
    
    return {
      name: bundleName,
      fileCount: bundle.files?.length || 0,
      size: bundle.size || 0,
      generated: bundle.generated,
      changed: !!bundle.changed,
      patterns: bundle.patterns,
      type: 'manual' as const
    };
  }

  get isScanning(): boolean {
    return this._isScanning;
  }
}
