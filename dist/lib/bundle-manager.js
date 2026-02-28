/**
 * Bundle Manager for cntx-ui
 * Handles Smart Dynamic Bundles and traditional XML generation
 */
import { readFileSync } from 'fs';
export default class BundleManager {
    configManager;
    fileSystemManager;
    webSocketManager;
    db;
    verbose;
    _isScanning;
    constructor(configManager, fileSystemManager, verbose = false) {
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
    getAllBundleInfo() {
        const manualBundles = Array.from(this.configManager.getBundles().entries()).map(([name, bundle]) => ({
            name,
            fileCount: bundle.files?.length || 0,
            size: bundle.size || 0,
            generated: bundle.generated,
            changed: !!bundle.changed,
            patterns: bundle.patterns,
            type: 'manual'
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
    generateSmartBundleDefinitions() {
        const smartBundles = [];
        try {
            // 1. Group by Purpose (Heuristics)
            const purposeRows = this.db.db.prepare('SELECT DISTINCT purpose, COUNT(*) as count FROM semantic_chunks GROUP BY purpose').all();
            purposeRows.forEach(row => {
                if (!row.purpose)
                    return;
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
            const subtypeRows = this.db.db.prepare('SELECT DISTINCT subtype, COUNT(*) as count FROM semantic_chunks GROUP BY subtype').all();
            subtypeRows.forEach(row => {
                if (!row.subtype)
                    return;
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
        }
        catch (e) {
            if (this.verbose)
                console.warn('Smart bundle discovery failed:', e.message);
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
        if (!bundle)
            return [];
        const allFiles = this.fileSystemManager.getAllFiles();
        return allFiles.filter(file => bundle.patterns.some(pattern => this.fileSystemManager.matchesPattern(file, pattern))).map(f => this.fileSystemManager.relativePath(f));
    }
    /**
     * Resolve a Smart Bundle query against SQLite
     */
    resolveSmartBundle(bundleName) {
        const query = bundleName.replace('smart:', '');
        let rows = [];
        if (query.startsWith('type-')) {
            const type = query.replace('type-', '').replace(/-/g, '_');
            rows = this.db.db.prepare('SELECT DISTINCT file_path FROM semantic_chunks WHERE LOWER(subtype) = ?').all(type);
        }
        else {
            const purposeRows = this.db.db.prepare('SELECT DISTINCT purpose FROM semantic_chunks').all();
            const matched = purposeRows.find(r => r.purpose?.toLowerCase().replace(/\s+/g, '-') === query);
            if (matched) {
                rows = this.db.db.prepare('SELECT DISTINCT file_path FROM semantic_chunks WHERE purpose = ?').all(matched.purpose);
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
        }
        finally {
            this._isScanning = false;
        }
    }
    async regenerateBundle(bundleName) {
        if (this.verbose)
            console.log(`🔄 Regenerating bundle: ${bundleName}`);
        const files = await this.resolveBundleFiles(bundleName);
        const content = await this.generateBundleXML(bundleName, files);
        const bundleData = {
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
        }
        catch (e) {
            return `  <file path="${this.escapeXml(relativePath)}" error="${this.escapeXml(e.message)}" />\n`;
        }
    }
    getProjectInfo() {
        try {
            const pkg = JSON.parse(readFileSync(this.fileSystemManager.fullPath('package.json'), 'utf8'));
            return { name: pkg.name || 'Unknown', version: pkg.version || '1.0.0' };
        }
        catch {
            return { name: 'Unknown', version: '1.0.0' };
        }
    }
    escapeXml(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    getBundleContent(bundleName) {
        if (bundleName.startsWith('smart:')) {
            // For smart bundles, we generate on the fly if not cached
            return this.regenerateBundle(bundleName).then(data => data.content || '');
        }
        const bundle = this.configManager.getBundles().get(bundleName);
        return bundle ? bundle.content || null : null;
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
        const bundle = this.configManager.getBundles().get(bundleName);
        if (!bundle)
            return undefined;
        return {
            name: bundleName,
            fileCount: bundle.files?.length || 0,
            size: bundle.size || 0,
            generated: bundle.generated,
            changed: !!bundle.changed,
            patterns: bundle.patterns,
            type: 'manual'
        };
    }
    get isScanning() {
        return this._isScanning;
    }
}
