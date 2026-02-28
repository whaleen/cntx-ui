/**
 * Simple Vector Store with SQLite Persistence
 * Powered by Transformers.js for local embeddings
 * Persists vectors to SQLite for instant startup
 */
import { pipeline } from '@xenova/transformers';
export default class SimpleVectorStore {
    db;
    modelName;
    pipe;
    initialized;
    constructor(databaseManager, options = {}) {
        this.db = databaseManager;
        this.modelName = options.modelName || 'Xenova/all-MiniLM-L6-v2';
        this.pipe = null;
        this.initialized = false;
    }
    async init() {
        if (this.initialized)
            return;
        console.log(`🤖 Initializing local RAG engine (${this.modelName})...`);
        this.pipe = await pipeline('feature-extraction', this.modelName);
        this.initialized = true;
        console.log('✅ Local RAG engine ready');
    }
    async generateEmbedding(text) {
        await this.init();
        const output = await this.pipe(text, { pooling: 'mean', normalize: true });
        return new Float32Array(output.data);
    }
    /**
     * Upsert a chunk's embedding to persistence
     */
    async upsertChunk(chunk) {
        const chunkId = chunk.id;
        // Check if we already have it in DB
        const existing = this.db.getEmbedding(chunkId);
        if (existing)
            return existing;
        // Generate new embedding — truncate to 8KB to stay within model limits
        const rawText = `${chunk.name} ${chunk.purpose} ${chunk.code}`;
        const textToEmbed = rawText.length > 8192 ? rawText.slice(0, 8192) : rawText;
        const embedding = await this.generateEmbedding(textToEmbed);
        // Save to SQLite
        this.db.saveEmbedding(chunkId, embedding, this.modelName);
        return embedding;
    }
    /**
     * Semantic Search across persistent embeddings
     */
    async search(query, options = {}) {
        const { limit = 10, threshold = 0.5 } = options;
        const queryEmbedding = await this.generateEmbedding(query);
        // Load all embeddings from DB
        const rows = this.db.db.prepare('SELECT chunk_id, embedding FROM vector_embeddings WHERE model_name = ?').all(this.modelName);
        const results = [];
        const batchSize = 100;
        // Process in batches to prevent blocking the event loop
        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            for (const row of batch) {
                const embedding = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
                const similarity = this.cosineSimilarity(queryEmbedding, embedding);
                if (similarity >= threshold) {
                    results.push({
                        chunkId: row.chunk_id,
                        similarity
                    });
                }
            }
            // Give other tasks a chance to run
            if (i + batchSize < rows.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        // Sort by similarity and get chunk details
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(res => {
            const chunkRow = this.db.db.prepare('SELECT * FROM semantic_chunks WHERE id = ?').get(res.chunkId);
            return {
                ...this.db.mapChunkRow(chunkRow),
                similarity: res.similarity
            };
        });
    }
    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
