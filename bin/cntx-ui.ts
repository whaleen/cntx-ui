#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { startServer, initConfig, getStatus, setupMCP, generateBundle } from '../server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let packagePath = join(__dirname, '..', 'package.json');
if (!existsSync(packagePath)) {
  packagePath = join(__dirname, '..', '..', 'package.json');
}
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

const args = process.argv.slice(2);
const command = args[0] || 'help';
const isVerbose = args.includes('--verbose');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down cntx-ui...');
  process.exit(0);
});

async function main() {
  try {
    const actualCommand = command === 'w' ? 'watch' : command;

    switch (actualCommand) {
      case 'watch':
        const port = parseInt(args[1]) || 3333;
        // Enable MCP status tracking by default for the web dashboard
        const withMcp = !args.includes('--no-mcp');
        await startServer({ port, withMcp, verbose: isVerbose });
        break;

      case 'init':
        console.log('🚀 Initializing cntx-ui...');
        await initConfig();
        break;

      case 'mcp':
        await startServer({ withMcp: true, skipFileWatcher: true, skipBundleGeneration: true });
        break;

      case 'bundle':
        const bundleName = args[1] || 'master';
        try {
          await generateBundle(bundleName);
          console.log(`✅ Bundle '${bundleName}' generated successfully`);
        } catch (error: any) {
          console.error(`❌ Failed to generate bundle '${bundleName}': ${error.message}`);
          process.exit(1);
        }
        break;

      case 'status':
        await getStatus();
        break;

      case 'setup-mcp':
        setupMCP();
        break;

      case 'version':
      case '-v':
      case '--version':
        console.log(`v${packageJson.version}`);
        break;

      case 'help':
      default:
        console.log(`
cntx-ui v${packageJson.version} - Repository Intelligence engine

Usage:
  cntx-ui watch [port]    Start the visual dashboard and intelligence engine (default: 3333)
  cntx-ui init            Initialize cntx-ui configuration in the current directory
  cntx-ui mcp             Start the Model Context Protocol (MCP) server on stdio
  cntx-ui bundle [name]   Generate specific bundle (default: master)
  cntx-ui status          Show current project status
  cntx-ui setup-mcp       Add this project to Claude Desktop MCP config
  cntx-ui version         Show current version
  cntx-ui help            Show this help information

Options:
  --verbose               Show detailed logging
  --no-mcp                Disable MCP server when running watch
        `);
        break;
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (isVerbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
