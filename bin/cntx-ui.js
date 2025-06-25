#!/usr/bin/env node

import { startServer, startMCPServer, generateBundle, initConfig, getStatus, setupMCP } from '../server.js';

const args = process.argv.slice(2);
const command = args[0] || 'watch';

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down cntx-ui...');
  process.exit(0);
});

switch (command) {
  case 'watch':
    const port = parseInt(args[1]) || 3333;
    const withMcp = args.includes('--with-mcp');
    startServer({ port, withMcp });
    break;

  case 'mcp':
    // MCP server mode - runs on stdio
    startMCPServer({ cwd: process.cwd() });
    break;

  case 'bundle':
    const bundleName = args[1] || 'master';
    try {
      generateBundle(bundleName);
      console.log(`✅ Bundle '${bundleName}' generated`);
    } catch (e) {
      console.error(`❌ Bundle '${bundleName}' not found`);
    }
    break;

  case 'init':
    initConfig();
    break;

  case 'status':
    getStatus();
    break;

  case 'setup-mcp':
    setupMCP();
    break;

  default:
    console.log(`cntx-ui v2.0.8
        
Usage:
  cntx-ui init                Initialize configuration
  cntx-ui watch [port]        Start web server (default port: 3333)
  cntx-ui watch --with-mcp    Start web server with MCP status tracking
  cntx-ui mcp                 Start MCP server (stdio transport)
  cntx-ui setup-mcp           Add this project to Claude Desktop MCP config
  cntx-ui bundle [name]       Generate specific bundle (default: master)
  cntx-ui status              Show current status
  
Examples:
  cntx-ui init
  cntx-ui watch 8080
  cntx-ui watch --with-mcp
  cntx-ui setup-mcp
  cntx-ui mcp
  cntx-ui bundle api

MCP Usage:
  The MCP server provides AI-accessible bundle management:
  - Resources: Access bundles and files via cntx:// URIs
  - Tools: List bundles, generate bundles, get project status
  - Integration: Use with Claude Desktop, Cursor, or other MCP clients`);
}
