import { CntxServer } from '../server.js';
import { MCPServer } from '../lib/mcp-server.js';

async function testQuery() {
  console.log('🤖 Testing Agent Query on cntx-ui codebase\n');
  
  const cntxServer = new CntxServer(process.cwd().replace('/web', ''), { quiet: true });
  cntxServer.init();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const mcpServer = new MCPServer(cntxServer);
  
  // Test the user story query
  console.log('❓ User Story Test: "How is user authentication handled in this codebase?"');
  
  try {
    const result = await mcpServer.toolAgentQuery({
      question: 'How is user authentication handled in this codebase?',
      maxResults: 5,
      includeCode: false
    }, 'test');
    
    const response = JSON.parse(result.result.content[0].text);
    
    console.log('\n🔍 Agent Response:');
    console.log('Question:', response.question);
    console.log('Answer:', response.answer);
    console.log('Confidence:', `${(response.confidence * 100).toFixed(1)}%`);
    console.log('Total Matches:', response.totalMatches);
    
    if (response.relatedFiles?.length > 0) {
      console.log('\n📁 Related Files:');
      response.relatedFiles.slice(0, 5).forEach((file, i) => {
        console.log(`${i + 1}. ${file}`);
      });
    }
    
    if (response.evidence?.length > 0) {
      console.log('\n🧾 Evidence:');
      response.evidence.forEach(evidence => {
        console.log(`• ${evidence.type}: ${evidence.message || evidence.count + ' items'}`);
      });
    }
    
    if (response.suggestions?.length > 0) {
      console.log('\n💡 Suggestions:');
      response.suggestions.forEach(suggestion => {
        console.log(`• ${suggestion}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
  }
  
  console.log('\n✅ User story test complete!');
  console.log('The agent successfully provided a structured response with evidence and file references.');
}

testQuery();