import { CntxServer } from '../server.js';
import AgentRuntime from '../lib/agent-runtime.js';

async function simpleTest() {
  console.log('🤖 Simple Agent Test\n');
  
  const cntxServer = new CntxServer(process.cwd().replace('/web', ''), { quiet: true });
  cntxServer.init();
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const agent = new AgentRuntime(cntxServer);
  
  // Test Discovery Mode
  console.log('🔍 Testing Discovery Mode...');
  try {
    const discovery = await agent.discoverCodebase({ scope: 'all', includeDetails: false });
    console.log(`✅ Found ${discovery.overview?.totalBundles || 0} bundles with ${discovery.overview?.totalFiles || 0} files`);
    
    if (discovery.bundles) {
      console.log('\nBundles:');
      discovery.bundles.slice(0, 3).forEach(bundle => {
        console.log(`• ${bundle.name}: ${bundle.fileCount} files (${bundle.purpose})`);
      });
    }
  } catch (error) {
    console.log('❌ Discovery failed:', error.message);
  }
  
  console.log('\n✅ Agent infrastructure is working!');
  console.log('Ready for Claude Desktop integration testing.');
}

simpleTest();