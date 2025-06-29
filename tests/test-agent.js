#!/usr/bin/env node

/**
 * Test Agent Functionality Locally
 * This script tests the agent tools without needing Claude Desktop
 */

import { CntxServer } from '../server.js';
import { MCPServer } from '../lib/mcp-server.js';

async function testAgent() {
  console.log('🤖 Testing Agent Functionality\n');

  // Initialize cntx server
  const cntxServer = new CntxServer(process.cwd(), { quiet: true });
  cntxServer.init();

  // Wait a moment for initialization
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Initialize MCP server with agent tools
  const mcpServer = new MCPServer(cntxServer);

  console.log('📋 Available Agent Tools:');
  console.log('- agent_discover: Get codebase overview');
  console.log('- agent_query: Answer specific questions');
  console.log('- agent_investigate: Investigate feature implementations');
  console.log('- agent_discuss: Engage in architectural discussion\n');

  // Test Discovery Mode
  console.log('🔍 Testing Discovery Mode...');
  try {
    const discoveryResult = await mcpServer.toolAgentDiscover({}, 'test-1');
    if (discoveryResult.result) {
      const discovery = JSON.parse(discoveryResult.result.content[0].text);
      console.log(`✅ Discovery: Found ${discovery.overview?.totalBundles || 0} bundles, ${discovery.overview?.totalFiles || 0} files`);

      if (discovery.bundles) {
        console.log('   Bundles:');
        discovery.bundles.slice(0, 3).forEach(bundle => {
          console.log(`   • ${bundle.name}: ${bundle.fileCount} files (${bundle.purpose || 'General'})`);
        });
      }
    }
  } catch (error) {
    console.log(`❌ Discovery failed: ${error.message}`);
  }

  console.log();

  // Test Query Mode
  console.log('❓ Testing Query Mode...');
  try {
    const queryResult = await mcpServer.toolAgentQuery({
      question: "How is the MCP server implemented?"
    }, 'test-2');

    if (queryResult.result) {
      const query = JSON.parse(queryResult.result.content[0].text);
      console.log(`✅ Query: Found ${query.totalMatches || 0} matches with ${(query.confidence * 100).toFixed(1)}% confidence`);
      if (query.relatedFiles?.length > 0) {
        console.log(`   Key files: ${query.relatedFiles.slice(0, 3).join(', ')}`);
      }
    }
  } catch (error) {
    console.log(`❌ Query failed: ${error.message}`);
  }

  console.log();

  // Test Investigation Mode  
  console.log('🔬 Testing Investigation Mode...');
  try {
    const investigateResult = await mcpServer.toolAgentInvestigate({
      featureDescription: "semantic analysis"
    }, 'test-3');

    if (investigateResult.result) {
      const investigation = JSON.parse(investigateResult.result.content[0].text);
      console.log(`✅ Investigation: Found ${investigation.existing?.implementations?.length || 0} existing implementations`);
      if (investigation.recommendations?.length > 0) {
        console.log(`   Recommendation: ${investigation.recommendations[0].message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Investigation failed: ${error.message}`);
  }

  console.log();

  // Test Discussion Mode
  console.log('💬 Testing Discussion Mode...');
  try {
    const discussResult = await mcpServer.toolAgentDiscuss({
      userInput: "Let's discuss the architecture of this codebase"
    }, 'test-4');

    if (discussResult.result) {
      const discussion = JSON.parse(discussResult.result.content[0].text);
      console.log(`✅ Discussion: Generated ${discussion.insights?.length || 0} insights and ${discussion.questions?.length || 0} clarifying questions`);
      if (discussion.insights?.length > 0) {
        console.log(`   Insight: ${discussion.insights[0]}`);
      }
    }
  } catch (error) {
    console.log(`❌ Discussion failed: ${error.message}`);
  }

  console.log('\n🎯 Test Summary:');
  console.log('Agent tools are integrated and ready for testing with Claude Desktop');
  console.log('\nNext steps:');
  console.log('1. Start MCP server: `cntx-ui mcp` in a test repository');
  console.log('2. Connect Claude Desktop to test agent interactions');
  console.log('3. Try the user story: "I want to understand how this app handles user sessions"');

  process.exit(0);
}

testAgent().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
