import SemanticChunker from './lib/semantic-chunker.js';

const chunker = new SemanticChunker();

console.log('🔍 Running full analysis...\n');

try {
  // Run the full analysis
  const result = await chunker.analyzeProject('.', ['web/src/**/*.{js,jsx,ts,tsx}']);
  
  console.log('✅ Full analysis completed!');
  console.log('Result keys:', Object.keys(result));
  
  if (result.summary) {
    console.log('\n📊 Summary:', {
      totalFiles: result.summary.totalFiles,
      totalChunks: result.summary.totalChunks,
      totalSize: result.summary.totalSize
    });
  }
  
  if (result.chunks && result.chunks.length > 0) {
    console.log('\n📦 First few chunks:');
    result.chunks.slice(0, 3).forEach((chunk, i) => {
      console.log(`${i + 1}. ${chunk.name} (${chunk.files?.length || 0} files)`);
    });
  }
  
  if (result.files) {
    const fileKeys = Object.keys(result.files);
    console.log(`\n📄 Analyzed ${fileKeys.length} files`);
    console.log('First few files:', fileKeys.slice(0, 3));
  }
  
} catch (error) {
  console.error('❌ Error during full analysis:', error.message);
  console.error(error.stack);
}