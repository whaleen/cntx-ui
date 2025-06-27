import TreesitterSemanticChunker from './lib/treesitter-semantic-chunker.js';

const chunker = new TreesitterSemanticChunker({
  namingStrategy: 'domain-based',
  includeImports: true,
  includeExports: true,
  detectComponentTypes: true,
  groupRelatedFiles: true
});

console.log('🔍 Debugging server-style call...');

try {
  // Use same patterns as server
  const patterns = ['web/src/**/*.{js,jsx,ts,tsx}', 'src/**/*.{js,jsx,ts,tsx}'];
  const result = await chunker.analyzeProject(process.cwd(), patterns);
  
  console.log('\n📦 Chunks from server-style call:');
  result.chunks.slice(0, 2).forEach((chunk, i) => {
    console.log(`${i + 1}. ${chunk.name}`);
    console.log('   businessDomains:', chunk.businessDomains);
    console.log('   technicalPatterns:', chunk.technicalPatterns);
    console.log('   cohesion:', chunk.cohesion);
    console.log('   keys:', Object.keys(chunk));
    console.log('');
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}