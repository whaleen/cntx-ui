/**
 * Configuration Manager for cntx-ui
 * Handles all configuration files, settings, and persistence
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import DatabaseManager from './database-manager.js';
export default class ConfigurationManager {
    CWD;
    CNTX_DIR;
    CONFIG_FILE;
    IGNORE_FILE;
    BUNDLE_STATES_FILE;
    HIDDEN_FILES_FILE;
    SEMANTIC_CACHE_FILE;
    bundleStates;
    ignorePatterns;
    hiddenFilesConfig;
    editor;
    verbose;
    dbManager;
    constructor(cwd, options = {}) {
        this.CWD = cwd;
        this.CNTX_DIR = join(cwd, '.cntx');
        this.CONFIG_FILE = join(this.CNTX_DIR, 'config.json');
        this.IGNORE_FILE = join(cwd, '.cntxignore');
        this.BUNDLE_STATES_FILE = join(this.CNTX_DIR, 'bundle-states.json');
        this.HIDDEN_FILES_FILE = join(this.CNTX_DIR, 'hidden-files.json');
        this.SEMANTIC_CACHE_FILE = join(this.CNTX_DIR, 'semantic-cache.json');
        this.bundleStates = new Map();
        this.ignorePatterns = [];
        this.hiddenFilesConfig = { hiddenFiles: [] };
        this.editor = process.env.EDITOR || 'code';
        this.verbose = options.verbose || false;
        this.dbManager = new DatabaseManager(this.CNTX_DIR, { verbose: this.verbose });
        // Load bundles (try SQLite first, fallback to JSON)
        this.loadBundleStates();
    }
    // === Bundle Configuration ===
    loadConfig() {
        if (existsSync(this.CONFIG_FILE)) {
            const config = JSON.parse(readFileSync(this.CONFIG_FILE, 'utf8'));
            // Update in-memory bundle states from config patterns
            if (config.bundles) {
                Object.entries(config.bundles).forEach(([name, patterns]) => {
                    const existing = this.bundleStates.get(name) || { files: [], patterns: [] };
                    this.bundleStates.set(name, {
                        ...existing,
                        patterns: patterns
                    });
                });
            }
            return config;
        }
        return { bundles: { master: ['**/*'] } };
    }
    saveConfig(config) {
        writeFileSync(this.CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    }
    // === Ignore File Management ===
    saveCntxignore(content) {
        try {
            writeFileSync(this.IGNORE_FILE, content, 'utf8');
            // Update ignore patterns in memory immediately
            this.ignorePatterns = content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            return true;
        }
        catch (error) {
            console.error('Failed to save .cntxignore:', error.message);
            return false;
        }
    }
    getBundles() {
        return this.bundleStates;
    }
    getIgnorePatterns() {
        return this.ignorePatterns;
    }
    getHiddenFilesConfig() {
        return this.hiddenFilesConfig;
    }
    getEditor() {
        return this.editor;
    }
    // === Persistence ===
    loadBundleStates() {
        // 1. Try to load from SQLite first
        try {
            const rows = this.dbManager.db.prepare('SELECT * FROM bundles').all();
            if (rows.length > 0) {
                rows.forEach(row => {
                    this.bundleStates.set(row.name, {
                        patterns: JSON.parse(row.patterns),
                        files: JSON.parse(row.files),
                        size: row.size,
                        fileCount: row.file_count,
                        generated: row.generated_at,
                        changed: row.changed === 1
                    });
                });
                if (this.verbose)
                    console.log('✅ Loaded bundles from SQLite database');
                return;
            }
        }
        catch (e) {
            // Fallback to JSON
        }
        // 2. Fallback to legacy JSON file
        if (existsSync(this.BUNDLE_STATES_FILE)) {
            try {
                const data = readFileSync(this.BUNDLE_STATES_FILE, 'utf8');
                const bundleStates = JSON.parse(data);
                bundleStates.forEach(state => {
                    this.bundleStates.set(state.name, {
                        patterns: state.patterns || [],
                        files: (state.files || []).map((file) => {
                            if (file.startsWith('/')) {
                                const relativePath = relative(this.CWD, file);
                                return relativePath;
                            }
                            else {
                                return file;
                            }
                        }),
                        size: state.size || 0,
                        fileCount: (state.files || []).length,
                        generated: state.generated,
                        changed: state.changed || false
                    });
                });
            }
            catch (error) {
                console.error('Error loading bundle states:', error);
            }
        }
    }
    saveBundleStates() {
        // 1. Save to SQLite
        const stmt = this.dbManager.db.prepare(`
      INSERT OR REPLACE INTO bundles (name, patterns, files, size, file_count, generated_at, changed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const transaction = this.dbManager.db.transaction(() => {
            for (const [name, bundle] of this.bundleStates.entries()) {
                stmt.run(name, JSON.stringify(bundle.patterns), JSON.stringify(bundle.files), bundle.size || 0, bundle.files.length, bundle.generated || '', bundle.changed ? 1 : 0);
            }
        });
        try {
            transaction();
            if (this.verbose)
                console.log('💾 Saved bundles to SQLite');
        }
        catch (e) {
            console.error('Failed to save bundles to SQLite:', e.message);
        }
        // 2. Also save to JSON for backup/legacy compatibility
        try {
            const data = Array.from(this.bundleStates.entries()).map(([name, bundle]) => ({
                name,
                ...bundle
            }));
            writeFileSync(this.BUNDLE_STATES_FILE, JSON.stringify(data, null, 2), 'utf8');
        }
        catch (error) {
            console.error('Error saving bundle states:', error);
        }
    }
    loadHiddenFilesConfig() {
        if (existsSync(this.HIDDEN_FILES_FILE)) {
            try {
                const data = readFileSync(this.HIDDEN_FILES_FILE, 'utf8');
                this.hiddenFilesConfig = JSON.parse(data);
            }
            catch (error) {
                console.error('Error loading hidden files config:', error);
            }
        }
    }
    isFileHidden(filePath, bundleName) {
        const bundleHidden = this.hiddenFilesConfig[bundleName] || [];
        return bundleHidden.includes(filePath);
    }
    loadIgnorePatterns() {
        const ignorePath = join(this.CWD, '.cntxignore');
        if (existsSync(ignorePath)) {
            try {
                const content = readFileSync(ignorePath, 'utf8');
                this.ignorePatterns = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
            }
            catch (error) {
                console.error('Error loading ignore patterns:', error);
            }
        }
    }
    // === Semantic Cache ===
    saveSemanticCache(analysis) {
        try {
            const data = {
                timestamp: Date.now(),
                analysis
            };
            writeFileSync(this.SEMANTIC_CACHE_FILE, JSON.stringify(data), 'utf8');
        }
        catch (error) {
            console.error('Error saving semantic cache:', error);
        }
    }
    loadSemanticCache() {
        if (existsSync(this.SEMANTIC_CACHE_FILE)) {
            try {
                const data = readFileSync(this.SEMANTIC_CACHE_FILE, 'utf8');
                return JSON.parse(data);
            }
            catch (error) {
                return null;
            }
        }
        return null;
    }
    invalidateSemanticCache() {
        if (existsSync(this.SEMANTIC_CACHE_FILE)) {
            unlinkSync(this.SEMANTIC_CACHE_FILE);
        }
    }
}
