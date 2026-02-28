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
      -- Existing bundles table
      CREATE TABLE IF NOT EXISTS bundles (
        name TEXT PRIMARY KEY,
        patterns TEXT NOT NULL,
        files TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        generated_at TEXT,
        changed BOOLEAN DEFAULT FALSE
      );

      -- Persistent Semantic Chunks
      CREATE TABLE IF NOT EXISTS semantic_chunks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        type TEXT,
        subtype TEXT,
        content TEXT NOT NULL,
        start_line INTEGER,
        complexity_score INTEGER,
        purpose TEXT,
        metadata TEXT, -- JSON string for tags, imports, types, etc.
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Vector Embeddings (Persistence for RAG)
      CREATE TABLE IF NOT EXISTS vector_embeddings (
        chunk_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL, -- Stored as Float32Array blob
        model_name TEXT NOT NULL,
        FOREIGN KEY(chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
      );

      -- Agent Working Memory & Sessions
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        context_summary TEXT -- High-level summary of what was being worked on
      );

      CREATE TABLE IF NOT EXISTS agent_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL, -- 'user' or 'agent'
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT, -- JSON for tools used, files referenced, etc.
        FOREIGN KEY(session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_bundles_changed ON bundles(changed);
      CREATE INDEX IF NOT EXISTS idx_chunks_file ON semantic_chunks(file_path);
      CREATE INDEX IF NOT EXISTS idx_chunks_purpose ON semantic_chunks(purpose);
      CREATE INDEX IF NOT EXISTS idx_memory_session ON agent_memory(session_id);
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
      const bundleCount = this.db.prepare('SELECT COUNT(*) as count FROM bundles').get().count;
      const chunkCount = this.db.prepare('SELECT COUNT(*) as count FROM semantic_chunks').get().count;
      const embeddingCount = this.db.prepare('SELECT COUNT(*) as count FROM vector_embeddings').get().count;
      const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM agent_sessions').get().count;
      const dbSize = statSync(this.dbPath).size;
      
      return {
        path: this.dbPath,
        bundleCount,
        chunkCount,
        embeddingCount,
        sessionCount,
        sizeBytes: dbSize,
        sizeFormatted: (dbSize / 1024).toFixed(1) + ' KB',
        tables: ['bundles', 'semantic_chunks', 'vector_embeddings', 'agent_sessions', 'agent_memory']
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Save semantic chunks
  saveChunks(chunks) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO semantic_chunks (id, name, file_path, type, subtype, content, start_line, complexity_score, purpose, metadata) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const chunk of chunks) {
        // Generate a stable ID if not provided (org/repo:path:name)
        const id = chunk.id || `${chunk.filePath}:${chunk.name}:${chunk.startLine}`;
        stmt.run(
          id,
          chunk.name,
          chunk.filePath,
          chunk.type || 'unknown',
          chunk.subtype || 'unknown',
          chunk.code || chunk.content || '',
          chunk.startLine || 0,
          chunk.complexity?.score || 0,
          chunk.purpose || 'Utility function',
          JSON.stringify({
            tags: chunk.tags || [],
            imports: chunk.includes?.imports || [],
            types: chunk.includes?.types || [],
            bundles: chunk.bundles || []
          })
        );
      }
    });

    try {
      transaction();
      return true;
    } catch (error) {
      console.error('Failed to save chunks to SQLite:', error.message);
      return false;
    }
  }

  // Get chunks for a specific file
  getChunksByFile(filePath) {
    try {
      const rows = this.db.prepare('SELECT * FROM semantic_chunks WHERE file_path = ?').all(filePath);
      return rows.map(row => this.mapChunkRow(row));
    } catch (error) {
      return [];
    }
  }

  // Search chunks by name or purpose
  searchChunks(query) {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM semantic_chunks 
        WHERE name LIKE ? OR purpose LIKE ? 
        LIMIT 50
      `).all(`%${query}%`, `%${query}%`);
      return rows.map(row => this.mapChunkRow(row));
    } catch (error) {
      return [];
    }
  }

  mapChunkRow(row) {
    const metadata = JSON.parse(row.metadata || '{}');
    return {
      id: row.id,
      name: row.name,
      filePath: row.file_path,
      type: row.type,
      subtype: row.subtype,
      code: row.content,
      startLine: row.start_line,
      complexity: { score: row.complexity_score },
      purpose: row.purpose,
      tags: metadata.tags || [],
      includes: {
        imports: metadata.imports || [],
        types: metadata.types || []
      },
      bundles: metadata.bundles || []
    };
  }

  // Vector Embedding Persistence
  saveEmbedding(chunkId, embedding, modelName) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO vector_embeddings (chunk_id, embedding, model_name) 
        VALUES (?, ?, ?)
      `);
      // Convert Float32Array to Buffer for SQLite BLOB
      const buffer = Buffer.from(embedding.buffer);
      stmt.run(chunkId, buffer, modelName);
      return true;
    } catch (error) {
      console.error(`Failed to save embedding for ${chunkId}:`, error.message);
      return false;
    }
  }

  getEmbedding(chunkId) {
    try {
      const row = this.db.prepare('SELECT embedding FROM vector_embeddings WHERE chunk_id = ?').get(chunkId);
      if (!row) return null;
      // Convert Buffer back to Float32Array
      return new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
    } catch (error) {
      return null;
    }
  }

  // Agent Memory Methods
  createSession(id, title) {
    try {
      const stmt = this.db.prepare('INSERT OR REPLACE INTO agent_sessions (id, title) VALUES (?, ?)');
      stmt.run(id, title);
      return true;
    } catch (error) {
      return false;
    }
  }

  addMessage(sessionId, role, content, metadata = {}) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO agent_memory (session_id, role, content, metadata) 
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(sessionId, role, content, JSON.stringify(metadata));
      
      // Update session last_active_at
      this.db.prepare('UPDATE agent_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);
      return true;
    } catch (error) {
      return false;
    }
  }

  getSessionHistory(sessionId) {
    try {
      return this.db.prepare('SELECT * FROM agent_memory WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId);
    } catch (error) {
      return [];
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