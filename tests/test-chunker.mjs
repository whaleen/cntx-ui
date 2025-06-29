import SemanticChunker from './lib/semantic-chunker.js';

const chunker = new SemanticChunker();

console.log('🔍 Analyzing web/src directory for semantic chunks...\n');

try {
  const result = await chunker.analyzeProject('.', ['web/src/**/*.{js,jsx,ts,tsx}']);
  
  console.log('=== PROJECT ANALYSIS RESULTS ===\n');
  
  // Show summary stats
  console.log(`📊 Analysis Summary:`);
  console.log(`- Total files analyzed: ${result.totalFiles}`);
  console.log(`- File types found: ${Object.keys(result.fileTypes).join(', ')}`);
  console.log(`- Semantic chunks identified: ${result.chunks.length}`);
  console.log(`- Total functions found: ${result.totalFunctions}`);
  console.log(`- Total exports found: ${result.totalExports}\n`);
  
  // Show chunks
  console.log('📦 Semantic Chunks:');
  result.chunks.forEach((chunk, i) => {
    console.log(`\n${i + 1}. ${chunk.name} (${chunk.files.length} files)`);
    console.log(`   Purpose: ${chunk.purpose}`);
    console.log(`   Files: ${chunk.files.slice(0, 3).join(', ')}${chunk.files.length > 3 ? '...' : ''}`);
  });
  
  // Show some interesting files
  console.log('\n🎯 Interesting Files:');
  result.files.slice(0, 5).forEach(file => {
    console.log(`\n📄 ${file.path}`);
    console.log(`   Type: ${file.fileType}`);
    console.log(`   Functions: ${file.functions.length}`);
    console.log(`   Exports: ${file.exports.length}`);
    console.log(`   Lines: ${file.complexity.lines}`);
    if (file.reactComponents.length > 0) {
      console.log(`   React Components: ${file.reactComponents.join(', ')}`);
    }
    if (file.hooks.length > 0) {
      console.log(`   Hooks: ${file.hooks.join(', ')}`);
    }
  });
  
} catch (error) {
  console.error('❌ Error analyzing project:', error.message);
}