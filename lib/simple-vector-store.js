/**
 * Simple In-Memory Vector Store for cntx-ui
 * Free, local embeddings without external dependencies
 */

import { pipeline } from '@xenova/transformers'

class SimpleVectorStore {
  constructor(options = {}) {
    this.modelName = options.modelName || 'Xenova/all-MiniLM-L6-v2'
    this.collectionName = options.collectionName || 'code-chunks'
    this.embedder = null
    this.vectors = new Map() // id -> { embedding, metadata }
  }

  /**
   * Initialize the embedding model
   */
  async initialize() {
    console.log('🔧 Initializing simple vector store...')

    // Load the embedding model (downloads on first run)
    this.embedder = await pipeline('feature-extraction', this.modelName)
    console.log('✅ Embedding model loaded')
  }

  /**
   * Alias for initialize() to match server expectations
   */
  async init() {
    return this.initialize()
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text) {
    if (!this.embedder) {
      await this.initialize()
    }

    try {
      const result = await this.embedder(text, {
        pooling: 'mean',
        normalize: true
      })
      
      return Array.from(result.data)
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error.message)
      throw error
    }
  }

  /**
   * Create embeddings for semantic chunks
   */
  async createEmbeddings(chunks) {
    if (!this.embedder) {
      await this.initialize()
    }

    console.log(`🔍 Creating embeddings for ${chunks.length} chunks...`)

    const embeddings = []
    const batchSize = 10 // Process in batches to avoid memory issues

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`)

      for (const chunk of batch) {
        try {
          // Create searchable text from chunk data
          const searchableText = this.createSearchableText(chunk)

          // Generate embedding
          const result = await this.embedder(searchableText, {
            pooling: 'mean',
            normalize: true
          })

          // Convert to array format
          const embedding = Array.from(result.data)

          embeddings.push({
            id: chunk.name && chunk.filePath
              ? `${chunk.name}:${chunk.filePath}:${chunk.startLine || ''}`
              : `chunk-${i}`,
            embedding: embedding,
            metadata: {
              content: chunk.code || '',
              semanticType: chunk.semanticType || '',
              businessDomain: chunk.businessDomain || [],
              technicalPatterns: chunk.technicalPatterns || [],
              purpose: chunk.purpose || '',
              files: chunk.files || [],
              size: chunk.size || 0,
              complexity: chunk.complexity || 0
            }
          })
        } catch (error) {
          console.warn(`⚠️ Failed to embed chunk ${chunk.name}:`, error.message)
        }
      }
    }

    console.log(`✅ Created ${embeddings.length} embeddings`)
    return embeddings
  }

  /**
   * Create searchable text from semantic chunk
   */
  createSearchableText(chunk) {
    const parts = []

    // Add code content if available
    if (chunk.code) {
      parts.push(chunk.code)
    }

    // Add semantic type
    if (chunk.semanticType) {
      parts.push(`Type: ${chunk.semanticType}`)
    }

    // Add business domains
    if (chunk.businessDomain && chunk.businessDomain.length > 0) {
      parts.push(`Domain: ${chunk.businessDomain.join(', ')}`)
    }

    // Add technical patterns
    if (chunk.technicalPatterns && chunk.technicalPatterns.length > 0) {
      parts.push(`Patterns: ${chunk.technicalPatterns.join(', ')}`)
    }

    // Add purpose
    if (chunk.purpose) {
      parts.push(`Purpose: ${chunk.purpose}`)
    }

    // Add file names for context
    if (chunk.files && chunk.files.length > 0) {
      const fileNames = chunk.files.map(f => f.split('/').pop()).join(', ')
      parts.push(`Files: ${fileNames}`)
    }

    return parts.join(' | ')
  }

  /**
   * Store chunks in vector database
   */
  async storeChunks(chunks) {
    const embeddings = await this.createEmbeddings(chunks)

    if (embeddings.length === 0) {
      console.warn('⚠️ No embeddings created, skipping storage')
      return
    }

    // Store in memory
    for (const embedding of embeddings) {
      this.vectors.set(embedding.id, {
        embedding: embedding.embedding,
        metadata: embedding.metadata
      })
    }

    console.log(`✅ Stored ${embeddings.length} chunks in memory vector store`)
  }

  /**
   * Store chunks that already have embeddings (e.g., from cache)
   */
  async storePrecomputedChunks(chunks) {
    if (!chunks || chunks.length === 0) {
      console.warn('⚠️ No chunks provided for storage')
      return
    }

    let storedCount = 0
    for (const chunk of chunks) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        this.vectors.set(chunk.id || chunk.name, {
          embedding: chunk.embedding,
          metadata: chunk.metadata || {
            content: chunk.code || chunk.content || '',
            semanticType: chunk.semanticType || 'unknown',
            businessDomain: chunk.businessDomain || [],
            technicalPatterns: chunk.technicalPatterns || [],
            purpose: chunk.purpose || '',
            files: chunk.files || [chunk.filePath].filter(Boolean),
            size: chunk.size || 0,
            complexity: chunk.complexity || 0
          }
        })
        storedCount++
      }
    }

    console.log(`✅ Stored ${storedCount} precomputed chunks in memory vector store`)
    return storedCount
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Find similar code chunks
   */
  async findSimilar(query, options = {}) {
    if (!this.embedder) {
      await this.initialize()
    }

    const {
      limit = 10,
      minSimilarity = 0.5
    } = options

    try {
      // Create embedding for the query
      const queryEmbedding = await this.embedder(query, {
        pooling: 'mean',
        normalize: true
      })

      const queryVector = Array.from(queryEmbedding.data)

      // Calculate similarities with all stored vectors
      const similarities = []
      for (const [id, vector] of this.vectors) {
        const similarity = this.cosineSimilarity(queryVector, vector.embedding)
        if (similarity >= minSimilarity) {
          similarities.push({
            id: id,
            similarity: similarity,
            metadata: vector.metadata
          })
        }
      }

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
    } catch (error) {
      console.error('❌ Search failed:', error)
      return []
    }
  }

  /**
   * Find chunks by semantic type
   */
  async findByType(semanticType, limit = 10) {
    return this.findSimilar(`Type: ${semanticType}`, {
      limit,
      minSimilarity: 0.7
    })
  }

  /**
   * Find chunks by business domain
   */
  async findByDomain(domain, limit = 10) {
    return this.findSimilar(`Domain: ${domain}`, {
      limit,
      minSimilarity: 0.6
    })
  }

  /**
   * Find chunks by technical pattern
   */
  async findByPattern(pattern, limit = 10) {
    return this.findSimilar(`Patterns: ${pattern}`, {
      limit,
      minSimilarity: 0.6
    })
  }

  /**
   * Get collection statistics
   */
  async getStats() {
    return {
      totalChunks: this.vectors.size,
      collectionName: this.collectionName,
      modelName: this.modelName
    }
  }

  /**
   * Clear all stored chunks
   */
  async clear() {
    this.vectors.clear()
    console.log('✅ Cleared in-memory vector store')
  }

  /**
   * Add/update a single chunk (legacy compatibility)
   */
  async upsert(id, embedding, metadata) {
    this.vectors.set(id, {
      embedding: embedding,
      metadata: metadata
    })
  }
}

export default SimpleVectorStore 
