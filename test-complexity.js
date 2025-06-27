import SemanticSplitter from './lib/semantic-splitter.js';

const splitter = new SemanticSplitter();
const result = await splitter.extractSemanticChunks('.', ['web/src/App.tsx']);

console.log('Sample complexity scores:');
result.chunks.slice(0, 5).forEach(chunk => {
  console.log(`- ${chunk.name}: ${chunk.complexity.score} (${chunk.complexity.level})`);
  console.log(`  Size: ${chunk.size} chars`);
  console.log(`  Code preview: ${chunk.code.substring(0, 100)}...`);
  console.log('');
});