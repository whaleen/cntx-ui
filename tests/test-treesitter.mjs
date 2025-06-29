import TreesitterSemanticChunker from './lib/treesitter-semantic-chunker.js';

const chunker = new TreesitterSemanticChunker({
  namingStrategy: 'domain-based'
});

console.log('🚀 TREESITTER SEMANTIC CHUNKING TEST');
console.log('====================================\n');

console.log('🔍 Testing treesitter-based analysis...\n');

try {
  const result = await chunker.analyzeProject('.', ['web/src/**/*.{js,jsx,ts,tsx}']);
  
  // Project Overview
  console.log('📊 PROJECT OVERVIEW');
  console.log(`📁 Files analyzed: ${result.summary.totalFiles}`);
  console.log(`📦 Semantic chunks created: ${result.summary.totalChunks}`);
  console.log(`💾 Total code size: ${Math.round(result.summary.totalSize / 1024)}KB`);
  console.log(`📏 Total lines of code: ${result.summary.totalLines.toLocaleString()}`);
  
  // Semantic Types
  console.log('\n🎯 SEMANTIC TYPES');
  Object.entries(result.summary.semanticTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} files`);
  });
  
  // Business Domains  
  console.log('\n🏢 BUSINESS DOMAINS');
  Object.entries(result.summary.businessDomains).forEach(([domain, count]) => {
    console.log(`   ${domain}: ${count} occurrences`);
  });
  
  // Technical Patterns
  console.log('\n⚙️ TECHNICAL PATTERNS');
  Object.entries(result.summary.technicalPatterns).forEach(([pattern, count]) => {
    console.log(`   ${pattern}: ${count} files`);
  });
  
  // Smart Chunks
  console.log('\n🧩 SMART SEMANTIC CHUNKS');
  console.log('==========================');
  result.chunks.forEach((chunk, i) => {
    console.log(`\n${i + 1}. 📦 ${chunk.name.toUpperCase()}`);
    console.log(`   📊 ${chunk.files.length} files | ${Math.round(chunk.size / 1024)}KB | ${chunk.purpose}`);
    console.log(`   🎯 Cohesion: ${chunk.cohesion.toFixed(2)} | Complexity: ${chunk.complexity.level}`);
    console.log(`   🏢 Domains: ${chunk.businessDomains.join(', ') || 'none'}`);
    console.log(`   ⚙️ Patterns: ${chunk.technicalPatterns.join(', ') || 'none'}`);
    console.log(`   📁 Files: ${chunk.files.slice(0, 3).map(f => f.split('/').pop()).join(', ')}${chunk.files.length > 3 ? `... +${chunk.files.length - 3} more` : ''}`);
    
    if (chunk.recommendations.length > 0) {
      console.log(`   💡 ${chunk.recommendations[0].message}`);
    }
  });
  
  console.log('\n✨ TREESITTER ANALYSIS COMPLETE!');
  console.log('=================================');
  console.log('🚀 Treesitter provides deeper semantic understanding');
  console.log('🧠 Smart clustering based on AST analysis');
  console.log('🎯 Business domain extraction from code structure');
  console.log('📊 Technical pattern recognition');
  console.log('🔗 Dependency relationship mapping');
  
} catch (error) {
  console.error('❌ Treesitter analysis failed:', error.message);
  console.error(error.stack);
}