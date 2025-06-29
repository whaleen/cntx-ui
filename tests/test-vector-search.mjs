#!/usr/bin/env node

/**
 * Test script for vector search functionality
 * Demonstrates free local embeddings with Xenova + in-memory vector store
 */

import SimpleVectorStore from './lib/simple-vector-store.js'
import SemanticSplitter from './lib/semantic-splitter.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testVectorSearch() {
  console.log('🚀 Testing Vector Search with Xenova + In-Memory Store\n')

  try {
    // Initialize the same components as the server
    const semanticSplitter = new SemanticSplitter({
      maxChunkSize: 2000,
      includeContext: true,
      groupRelated: true,
      minFunctionSize: 50
    })

    const vectorStore = new SimpleVectorStore({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      collectionName: 'test-code-chunks'
    })

    // Use the same patterns as the server
    const patterns = ['**/*.{js,jsx,ts,tsx,mjs}']

    console.log('📁 Analyzing project with SemanticSplitter (like the server)...')
    const analysis = await semanticSplitter.extractSemanticChunks(__dirname, patterns)

    console.log(`✅ Analysis complete!`)
    console.log(`📊 Found ${analysis.chunks.length} semantic chunks`)
    console.log(`📄 Total files: ${analysis.summary.totalFiles}`)
    console.log(`⚡ Total functions: ${analysis.summary.totalFunctions}`)
    console.log(`📦 Average chunk size: ${analysis.summary.averageChunkSize.toFixed(0)} chars\n`)

    if (analysis.chunks.length > 0) {
      console.log('🔍 Adding vector search capabilities...')
      await vectorStore.storeChunks(analysis.chunks)

      console.log('🧪 Testing Vector Search Features:\n')

      // Test 1: Find similar code
      console.log('1️⃣ Finding code similar to "semantic analysis":')
      const similarChunks = await vectorStore.findSimilar('semantic analysis', { limit: 3 })
      similarChunks.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.id} (${(result.similarity * 100).toFixed(1)}% similar)`)
        console.log(`      Type: ${result.metadata.semanticType || 'unknown'}`)
        console.log(`      Domain: ${result.metadata.businessDomain?.join(', ') || 'none'}`)
      })
      console.log()

      // Test 2: Find by semantic type
      console.log('2️⃣ Finding utility functions:')
      const utilityFunctions = await vectorStore.findByType('utilityFunction', 3)
      utilityFunctions.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.id} (${(result.similarity * 100).toFixed(1)}% similar)`)
      })
      console.log()

      // Test 3: Find by domain
      console.log('3️⃣ Finding code analysis related code:')
      const analysisCode = await vectorStore.findByDomain('code-analysis', 3)
      analysisCode.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.id} (${(result.similarity * 100).toFixed(1)}% similar)`)
      })
      console.log()

      // Test 4: Find by pattern
      console.log('4️⃣ Finding React-related code:')
      const reactCode = await vectorStore.findByPattern('react', 3)
      reactCode.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.id} (${(result.similarity * 100).toFixed(1)}% similar)`)
      })
      console.log()

      // Test 5: Get vector database stats
      const stats = await vectorStore.getStats()
      console.log('📈 Vector Database Stats:')
      console.log(`   Total chunks: ${stats.totalChunks}`)
      console.log(`   Collection: ${stats.collectionName}`)
      console.log(`   Model: ${stats.modelName}`)

    } else {
      console.log('❌ No semantic chunks found - vector search not available')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

// Run the test
testVectorSearch() 
