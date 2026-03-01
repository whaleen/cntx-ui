/**
 * Database Manager for cntx-ui
 * Handles SQLite operations for bundle and file data
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { statSync } from 'fs';
export default class DatabaseManager {
    dbPath;
    db;
    verbose;
    constructor(dbDir, options = {}) {
        this.dbPath = join(dbDir, 'bundles.db');
        this.verbose = options.verbose || false;
        try {
            this.db = new Database(this.dbPath);
            if (this.verbose) {
                console.log(`📊 SQLite database initialized: ${this.dbPath}`);
            }
            this.initSchema();
        }
        catch (error) {
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
      
      -- UMAP Projection Cache
      CREATE TABLE IF NOT EXISTS umap_projections (
        chunk_id TEXT PRIMARY KEY,
        x REAL NOT NULL,
        y REAL NOT NULL,
        computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        embedding_count INTEGER NOT NULL,
        FOREIGN KEY(chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_bundles_changed ON bundles(changed);
      CREATE INDEX IF NOT EXISTS idx_chunks_file ON semantic_chunks(file_path);
      CREATE INDEX IF NOT EXISTS idx_chunks_purpose ON semantic_chunks(purpose);
      CREATE INDEX IF NOT EXISTS idx_memory_session ON agent_memory(session_id);
    `);
    }
    /**
     * Run a raw SELECT query against the database
     */
    query(sql) {
        try {
            if (!sql.trim().toUpperCase().startsWith('SELECT')) {
                throw new Error('Only SELECT queries are allowed');
            }
            const stmt = this.db.prepare(sql);
            return stmt.all();
        }
        catch (error) {
            console.error('Query failed:', error.message);
            throw error;
        }
    }
    // Get database info for debugging
    getInfo() {
        try {
            const bundleCountRow = this.db.prepare('SELECT COUNT(*) as count FROM bundles').get();
            const chunkCountRow = this.db.prepare('SELECT COUNT(*) as count FROM semantic_chunks').get();
            const embeddingCountRow = this.db.prepare('SELECT COUNT(*) as count FROM vector_embeddings').get();
            const sessionCountRow = this.db.prepare('SELECT COUNT(*) as count FROM agent_sessions').get();
            const dbSize = statSync(this.dbPath).size;
            return {
                path: this.dbPath,
                bundleCount: bundleCountRow.count,
                chunkCount: chunkCountRow.count,
                embeddingCount: embeddingCountRow.count,
                sessionCount: sessionCountRow.count,
                sizeBytes: dbSize,
                sizeFormatted: (dbSize / 1024).toFixed(1) + ' KB',
                tables: ['bundles', 'semantic_chunks', 'vector_embeddings', 'agent_sessions', 'agent_memory']
            };
        }
        catch (error) {
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
                stmt.run(id, chunk.name, chunk.filePath, chunk.type || 'unknown', chunk.subtype || 'unknown', chunk.code || chunk.content || '', chunk.startLine || 0, chunk.complexity?.score || 0, chunk.purpose || 'Utility function', JSON.stringify({
                    tags: chunk.tags || [],
                    businessDomain: chunk.businessDomain || [],
                    technicalPatterns: chunk.technicalPatterns || [],
                    imports: chunk.includes?.imports || [],
                    types: chunk.includes?.types || [],
                    bundles: chunk.bundles || []
                }));
            }
        });
        try {
            transaction();
            return true;
        }
        catch (error) {
            console.error('Failed to save chunks to SQLite:', error.message);
            return false;
        }
    }
    // Get chunks for a specific file
    getChunksByFile(filePath) {
        try {
            const rows = this.db.prepare('SELECT * FROM semantic_chunks WHERE file_path = ?').all(filePath);
            return rows.map(row => this.mapChunkRow(row));
        }
        catch (error) {
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
        }
        catch (error) {
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
            complexity: {
                score: row.complexity_score,
                level: row.complexity_score < 5 ? 'low' : row.complexity_score < 15 ? 'medium' : 'high'
            },
            purpose: row.purpose,
            tags: metadata.tags || [],
            businessDomain: metadata.businessDomain || [],
            technicalPatterns: metadata.technicalPatterns || [],
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
        }
        catch (error) {
            console.error(`Failed to save embedding for ${chunkId}:`, error.message);
            return false;
        }
    }
    getEmbedding(chunkId) {
        try {
            const row = this.db.prepare('SELECT embedding FROM vector_embeddings WHERE chunk_id = ?').get(chunkId);
            if (!row)
                return null;
            // Convert Buffer back to Float32Array
            return new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
        }
        catch (error) {
            return null;
        }
    }
    // Agent Memory Methods
    createSession(id, title) {
        try {
            const stmt = this.db.prepare('INSERT OR REPLACE INTO agent_sessions (id, title) VALUES (?, ?)');
            stmt.run(id, title);
            return true;
        }
        catch (error) {
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
        }
        catch (error) {
            return false;
        }
    }
    getSessionHistory(sessionId) {
        try {
            return this.db.prepare('SELECT * FROM agent_memory WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId);
        }
        catch (error) {
            return [];
        }
    }
    // UMAP Projection Cache
    saveProjections(projections, embeddingCount) {
        const transaction = this.db.transaction(() => {
            this.db.prepare('DELETE FROM umap_projections').run();
            const stmt = this.db.prepare('INSERT INTO umap_projections (chunk_id, x, y, embedding_count) VALUES (?, ?, ?, ?)');
            for (const p of projections) {
                stmt.run(p.chunkId, p.x, p.y, embeddingCount);
            }
        });
        try {
            transaction();
            return true;
        }
        catch (error) {
            console.error('Failed to save projections:', error.message);
            return false;
        }
    }
    getProjections() {
        try {
            const rows = this.db.prepare('SELECT chunk_id, x, y, embedding_count FROM umap_projections').all();
            if (rows.length === 0)
                return null;
            return rows.map(r => ({ chunkId: r.chunk_id, x: r.x, y: r.y, embeddingCount: r.embedding_count }));
        }
        catch (error) {
            return null;
        }
    }
    getProjectionEmbeddingCount() {
        try {
            const row = this.db.prepare('SELECT embedding_count FROM umap_projections LIMIT 1').get();
            return row?.embedding_count ?? 0;
        }
        catch (error) {
            return 0;
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
