#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { autoInitAndStart, startMCPServer, generateBundle, initConfig, getStatus } from '../server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

const args = process.argv.slice(2);
const command = args[0] || 'start';
const isVerbose = args.includes('--verbose');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Shutting down cntx-ui...');
  process.exit(0);
});

function showHelp() {
  console.log(`cntx-ui v${packageJson.version}

${packageJson.description}

Usage:
  cntx-ui [command] [options]

Commands:
  (default)                   Auto-init if needed, then start web server
  init                        Initialize configuration in current directory
  mcp                         Start MCP server (stdio transport)
  bundle [name]               Generate specific bundle (default: master)
  status                      Show current project status

Options:
  --verbose                   Enable detailed logging
  --version, -v               Show version number
  --help, -h                  Show this help message

Examples:
  cntx-ui                     Start server (auto-inits if needed)
  cntx-ui init                Initialize a new project
  cntx-ui mcp                 Start MCP server on stdio
  cntx-ui bundle api          Generate 'api' bundle
  cntx-ui status              Show project status

MCP Integration:
  Running 'cntx-ui init' creates a .mcp.json file so Claude Code
  can auto-discover the MCP server. Run 'cntx-ui mcp' for stdio mode.

Repository: ${packageJson.repository.url}
Author: ${packageJson.author}
License: ${packageJson.license}`);
}

function showVersion() {
  console.log(`cntx-ui v${packageJson.version}`);
}

async function main() {
  // Handle version flags
  if (args.includes('--version') || args.includes('-v')) {
    return showVersion();
  }

  // Handle help flags
  if (args.includes('--help') || args.includes('-h') || command === 'help') {
    return showHelp();
  }

  try {
    switch (command) {
      case 'start':
      case 'watch':
      case 'w':
        const port = parseInt(args[1]) || 3333;
        await autoInitAndStart({ port, verbose: isVerbose });
        break;

      case 'mcp':
        // MCP server mode - runs on stdio
        await startMCPServer({ cwd: process.cwd(), verbose: isVerbose });
        break;

      case 'bundle':
      case 'b':
        const bundleName = args[1] || 'master';
        try {
          await generateBundle(bundleName);
          console.log(`Bundle '${bundleName}' generated successfully`);
        } catch (error) {
          console.error(`Failed to generate bundle '${bundleName}': ${error.message}`);
          process.exit(1);
        }
        break;

      case 'init':
      case 'i':
        await initConfig();
        break;

      case 'status':
      case 's':
        await getStatus();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "cntx-ui --help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (isVerbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
