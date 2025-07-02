/**
 * Database Manager for cntx-ui
 * Handles SQLite operations for bundle and file data
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { statSync } from 'fs';

export default class DatabaseManager {
  constructor(cntxDir, options = {}) {
    this.cntxDir = cntxDir;
    this.verbose = options.verbose || false;
    this.dbPath = join(cntxDir, 'bundles.db');
    
    try {
      this.db = new Database(this.dbPath);
      this.initSchema();
      if (this.verbose) {
        console.log(`📊 SQLite database initialized: ${this.dbPath}`);
      }
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error.message);
      throw error;
    }
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bundles (
        name TEXT PRIMARY KEY,
        patterns TEXT NOT NULL,
        files TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        generated_at TEXT,
        changed BOOLEAN DEFAULT FALSE
      );
      
      CREATE INDEX IF NOT EXISTS idx_bundles_changed ON bundles(changed);
      CREATE INDEX IF NOT EXISTS idx_bundles_generated ON bundles(generated_at);
    `);
  }

  // Save all bundles from bundleStates Map
  saveBundles(bundleStates) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bundles (name, patterns, files, size, file_count, generated_at, changed) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const [name, bundle] of bundleStates) {
        stmt.run(
          name,
          JSON.stringify(bundle.patterns || []),
          JSON.stringify(bundle.files || []),
          bundle.size || 0,
          bundle.files ? bundle.files.length : 0,
          bundle.generated || null,
          bundle.changed ? 1 : 0
        );
      }
    });

    try {
      transaction();
      if (this.verbose) {
        console.log(`💾 Saved ${bundleStates.size} bundles to SQLite`);
      }
    } catch (error) {
      console.error('Failed to save bundles to SQLite:', error.message);
      throw error;
    }
  }

  // Load all bundles and return as Map
  loadBundles() {
    try {
      const rows = this.db.prepare('SELECT * FROM bundles').all();
      const bundleStates = new Map();

      rows.forEach(row => {
        bundleStates.set(row.name, {
          patterns: JSON.parse(row.patterns),
          files: JSON.parse(row.files),
          size: row.size,
          generated: row.generated_at,
          changed: Boolean(row.changed)
        });
      });

      if (this.verbose) {
        console.log(`📊 Loaded ${bundleStates.size} bundles from SQLite`);
      }

      return bundleStates;
    } catch (error) {
      console.error('Failed to load bundles from SQLite:', error.message);
      return new Map();
    }
  }

  // Get single bundle by name
  getBundle(name) {
    try {
      const row = this.db.prepare('SELECT * FROM bundles WHERE name = ?').get(name);
      if (!row) return null;

      return {
        patterns: JSON.parse(row.patterns),
        files: JSON.parse(row.files),
        size: row.size,
        generated: row.generated_at,
        changed: Boolean(row.changed)
      };
    } catch (error) {
      console.error(`Failed to get bundle ${name}:`, error.message);
      return null;
    }
  }

  // Delete bundle
  deleteBundle(name) {
    try {
      const stmt = this.db.prepare('DELETE FROM bundles WHERE name = ?');
      const result = stmt.run(name);
      
      if (this.verbose && result.changes > 0) {
        console.log(`🗑️ Deleted bundle: ${name}`);
      }
      
      return result.changes > 0;
    } catch (error) {
      console.error(`Failed to delete bundle ${name}:`, error.message);
      return false;
    }
  }

  // Get all bundle names
  getBundleNames() {
    try {
      const rows = this.db.prepare('SELECT name FROM bundles ORDER BY name').all();
      return rows.map(row => row.name);
    } catch (error) {
      console.error('Failed to get bundle names:', error.message);
      return [];
    }
  }

  // Query interface for database tab
  query(sql) {
    try {
      // Safety: only allow SELECT statements for now
      if (!sql.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed');
      }
      
      const stmt = this.db.prepare(sql);
      return stmt.all();
    } catch (error) {
      console.error('Query failed:', error.message);
      throw error;
    }
  }

  // Get database info for debugging
  getInfo() {
    try {
      const bundleCount = this.db.prepare('SELECT COUNT(*) as count FROM bundles').get();
      const dbSize = statSync(this.dbPath).size;
      
      return {
        path: this.dbPath,
        bundleCount: bundleCount.count,
        sizeBytes: dbSize,
        sizeFormatted: (dbSize / 1024).toFixed(1) + ' KB'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      if (this.verbose) {
        console.log('📊 SQLite database connection closed');
      }
    }
  }
}