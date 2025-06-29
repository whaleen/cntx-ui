import TreesitterSemanticChunker from './lib/treesitter-semantic-chunker.js';

const chunker = new TreesitterSemanticChunker();

console.log('🔍 Debugging treesitter chunker fields...');

try {
  const result = await chunker.analyzeProject('.', ['web/src/App.tsx']);
  
  console.log('\n📄 File Analysis Sample:');
  const firstFile = Object.values(result.files)[0];
  console.log('businessDomain:', firstFile.businessDomain);
  console.log('technicalPatterns:', firstFile.technicalPatterns);
  console.log('semanticType:', firstFile.semanticType);
  
  if (result.chunks.length > 0) {
    console.log('\n📦 First Chunk:');
    const chunk = result.chunks[0];
    console.log('name:', chunk.name);
    console.log('businessDomains:', chunk.businessDomains);
    console.log('technicalPatterns:', chunk.technicalPatterns);
    console.log('cohesion:', chunk.cohesion);
    console.log('All chunk keys:', Object.keys(chunk));
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}