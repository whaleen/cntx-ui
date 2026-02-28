/**
 * Bundle Manager for cntx-ui
 * Handles Smart Dynamic Bundles and traditional XML generation
 */

import { readFileSync, statSync } from 'fs';
import { relative, extname, basename, dirname } from 'path';

export default class BundleManager {
  constructor(configManager, fileSystemManager, verbose = false) {
    this.configManager = configManager;
    this.fileSystemManager = fileSystemManager;
    this.db = configManager.dbManager;
    this.verbose = verbose;
    this._isScanning = false;
  }

  /**
   * Get all bundle information, including Smart Dynamic Bundles
   */
  getAllBundleInfo() {
    if (this.verbose) console.log('📦 Getting all bundle info...');
    const manualBundles = Array.from(this.configManager.getBundles().entries()).map(([name, bundle]) => ({
      name,
      fileCount: bundle.files?.length || 0,
      size: bundle.size || 0,
      generated: bundle.generated,
      changed: bundle.changed,
      patterns: bundle.patterns,
      type: 'manual'
    }));

    if (this.verbose) console.log(`📦 Found ${manualBundles.length} manual bundles`);

    const smartBundles = this.generateSmartBundleDefinitions();
    if (this.verbose) console.log(`📦 Found ${smartBundles.length} smart bundle definitions`);

    // Filter out smart bundles that have no files
    const activeSmartBundles = smartBundles.map(b => {
      const files = this.resolveSmartBundle(b.name);
      return {
        ...b,
        fileCount: files.length,
        files
      };
    }).filter(b => b.fileCount > 0);

    if (this.verbose) console.log(`📦 Active smart bundles: ${activeSmartBundles.length}`);

    return [...manualBundles, ...activeSmartBundles];
  }

  /**
   * Generate Smart Bundle definitions from indexed semantic data.
   * Uses business domain, directory structure, and technical patterns
   * instead of raw AST node types.
   */
  generateSmartBundleDefinitions() {
    const smartBundles = [];
    const MIN_CHUNKS = 3; // Skip bundles with fewer than this many chunks

    try {
      // 1. Group by business domain (from metadata JSON)
      const allRows = this.db.db.prepare('SELECT metadata FROM semantic_chunks WHERE metadata IS NOT NULL').all();
      const domainCounts = new Map();
      for (const row of allRows) {
        try {
          const meta = JSON.parse(row.metadata);
          for (const domain of (meta.businessDomain || [])) {
            domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
          }
        } catch { /* skip malformed */ }
      }
      for (const [domain, count] of domainCounts) {
        if (count < MIN_CHUNKS) continue;
        smartBundles.push({
          name: `smart:${domain}`,
          purpose: domain,
          fileCount: count,
          type: 'smart',
          description: `${count} chunks in the ${domain} domain`
        });
      }

      // 2. Group by directory structure (components, hooks, pages, api, etc.)
      const dirRows = this.db.db.prepare(`
        SELECT
          CASE
            WHEN file_path LIKE '%/hooks/%' THEN 'hooks'
            WHEN file_path LIKE '%/components/%' THEN 'components'
            WHEN file_path LIKE '%/api/%' OR file_path LIKE '%/services/%' THEN 'api-services'
            WHEN file_path LIKE '%/pages/%' OR file_path LIKE '%/routes/%' THEN 'pages'
            WHEN file_path LIKE '%/stores/%' OR file_path LIKE '%/store/%' THEN 'state'
            WHEN file_path LIKE '%/lib/%' OR file_path LIKE '%/utils/%' THEN 'lib-utils'
            WHEN file_path LIKE '%/types/%' THEN 'types'
            ELSE NULL
          END as dir_group,
          COUNT(DISTINCT file_path) as file_cnt
        FROM semantic_chunks
        GROUP BY dir_group
        HAVING dir_group IS NOT NULL
      `).all();
      for (const row of dirRows) {
        if (row.file_cnt < 2) continue;
        smartBundles.push({
          name: `smart:dir-${row.dir_group}`,
          purpose: row.dir_group,
          fileCount: row.file_cnt,
          type: 'smart',
          description: `${row.file_cnt} files in ${row.dir_group} directories`
        });
      }

      // 3. Group by technical pattern (react-hooks, async-io, event-driven)
      const patternCounts = new Map();
      for (const row of allRows) {
        try {
          const meta = JSON.parse(row.metadata);
          for (const pattern of (meta.technicalPatterns || [])) {
            if (pattern === 'public-api') continue; // Too generic
            patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
          }
        } catch { /* skip */ }
      }
      for (const [pattern, count] of patternCounts) {
        if (count < MIN_CHUNKS) continue;
        smartBundles.push({
          name: `smart:pattern-${pattern}`,
          purpose: pattern,
          fileCount: count,
          type: 'smart',
          description: `${count} chunks using ${pattern} patterns`
        });
      }
    } catch (e) {
      if (this.verbose) console.warn('Smart bundle discovery failed:', e.message);
    }
    return smartBundles;
  }

  /**
   * Resolve files for a bundle (Manual or Smart)
   */
  async resolveBundleFiles(bundleName) {
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
  resolveSmartBundle(bundleName) {
    const query = bundleName.replace('smart:', '');
    let rows = [];

    if (query.startsWith('dir-')) {
      // Directory-based bundle
      const dirGroup = query.replace('dir-', '');
      const dirPatterns = {
        'hooks': '%/hooks/%',
        'components': '%/components/%',
        'api-services': null, // handled below
        'pages': null,
        'state': null,
        'lib-utils': null,
        'types': '%/types/%'
      };
      if (dirGroup === 'api-services') {
        rows = this.db.db.prepare("SELECT DISTINCT file_path FROM semantic_chunks WHERE file_path LIKE '%/api/%' OR file_path LIKE '%/services/%'").all();
      } else if (dirGroup === 'pages') {
        rows = this.db.db.prepare("SELECT DISTINCT file_path FROM semantic_chunks WHERE file_path LIKE '%/pages/%' OR file_path LIKE '%/routes/%'").all();
      } else if (dirGroup === 'state') {
        rows = this.db.db.prepare("SELECT DISTINCT file_path FROM semantic_chunks WHERE file_path LIKE '%/stores/%' OR file_path LIKE '%/store/%'").all();
      } else if (dirGroup === 'lib-utils') {
        rows = this.db.db.prepare("SELECT DISTINCT file_path FROM semantic_chunks WHERE file_path LIKE '%/lib/%' OR file_path LIKE '%/utils/%'").all();
      } else if (dirPatterns[dirGroup]) {
        rows = this.db.db.prepare('SELECT DISTINCT file_path FROM semantic_chunks WHERE file_path LIKE ?').all(dirPatterns[dirGroup]);
      }
    } else if (query.startsWith('pattern-')) {
      // Technical pattern bundle — search metadata JSON
      const pattern = query.replace('pattern-', '');
      const allRows = this.db.db.prepare('SELECT DISTINCT file_path, metadata FROM semantic_chunks WHERE metadata IS NOT NULL').all();
      const files = new Set();
      for (const row of allRows) {
        try {
          const meta = JSON.parse(row.metadata);
          if ((meta.technicalPatterns || []).includes(pattern)) {
            files.add(row.file_path);
          }
        } catch { /* skip */ }
      }
      return Array.from(files);
    } else {
      // Business domain bundle — search metadata JSON
      const allRows = this.db.db.prepare('SELECT DISTINCT file_path, metadata FROM semantic_chunks WHERE metadata IS NOT NULL').all();
      const files = new Set();
      for (const row of allRows) {
        try {
          const meta = JSON.parse(row.metadata);
          if ((meta.businessDomain || []).includes(query)) {
            files.add(row.file_path);
          }
        } catch { /* skip */ }
      }
      return Array.from(files);
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

  async regenerateBundle(bundleName) {
    if (this.verbose) console.log(`🔄 Regenerating bundle: ${bundleName}`);
    
    const files = await this.resolveBundleFiles(bundleName);
    const content = await this.generateBundleXML(bundleName, files);
    
    const bundleData = {
      files,
      content,
      size: Buffer.byteLength(content, 'utf8'),
      generated: new Date().toISOString(),
      changed: false
    };

    if (!bundleName.startsWith('smart:')) {
      const existing = this.configManager.getBundles().get(bundleName);
      this.configManager.getBundles().set(bundleName, { ...existing, ...bundleData });
      this.configManager.saveBundleStates();
    }

    return bundleData;
  }

  async generateBundleXML(bundleName, relativeFiles) {
    const projectInfo = this.getProjectInfo();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<codebase>\n`;
    xml += `  <project_info>\n    <name>${this.escapeXml(projectInfo.name)}</name>\n    <bundle>${this.escapeXml(bundleName)}</bundle>\n  </project_info>\n`;
    
    for (const relPath of relativeFiles) {
      xml += await this.generateFileXML(relPath);
    }
    
    xml += `</codebase>`;
    return xml;
  }

  async generateFileXML(relativePath) {
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
    } catch (e) {
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

  escapeXml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  getBundleContent(bundleName) {
    if (bundleName.startsWith('smart:')) {
      // For smart bundles, we generate on the fly if not cached
      return this.regenerateBundle(bundleName).then(data => data.content);
    }
    const bundle = this.configManager.getBundles().get(bundleName);
    return bundle ? bundle.content : null;
  }

  markBundlesChanged(filename) {
    this.configManager.getBundles().forEach((bundle, name) => {
      if (bundle.patterns?.some(p => this.fileSystemManager.matchesPattern(filename, p))) {
        bundle.changed = true;
      }
    });
  }

  getBundleInfo(bundleName) {
    if (bundleName.startsWith('smart:')) {
      return this.generateSmartBundleDefinitions().find(b => b.name === bundleName);
    }
    return this.configManager.getBundles().get(bundleName);
  }
}
