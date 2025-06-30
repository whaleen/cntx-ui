#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { startServer, startMCPServer, generateBundle, initConfig, getStatus, setupMCP } from '../server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

const args = process.argv.slice(2);
const command = args[0] || 'help';
const isVerbose = args.includes('--verbose');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down cntx-ui...');
  process.exit(0);
});

function showHelp() {
  console.log(`cntx-ui v${packageJson.version}

${packageJson.description}

Usage:
  cntx-ui <command> [options]

Commands:
  init                        Initialize configuration in current directory
  watch [port]                Start web server (default port: 3333)
  mcp                         Start MCP server (stdio transport)
  bundle [name]               Generate specific bundle (default: master)
  status                      Show current project status
  setup-mcp                   Add this project to Claude Desktop MCP config

Options:
  --verbose                   Enable detailed logging
  --with-mcp                  Start web server with MCP status tracking
  --version, -v               Show version number
  --help, -h                  Show this help message

Examples:
  cntx-ui init                Initialize a new project
  cntx-ui watch               Start web server on port 3333
  cntx-ui watch 8080          Start web server on port 8080
  cntx-ui watch --verbose     Start with detailed logs
  cntx-ui watch --with-mcp    Start with MCP integration
  cntx-ui bundle api          Generate 'api' bundle
  cntx-ui status              Show project status
  cntx-ui setup-mcp           Configure Claude Desktop integration

MCP Integration:
  The MCP server provides AI-accessible bundle management for Claude Desktop
  and other MCP-compatible clients. Use 'setup-mcp' to configure automatic
  integration with Claude Desktop.

Agent Collaboration:
  To get an external agent up to speed with your project, use this prompt:

  "I'm working in a project that uses cntx-ui for file organization and AI 
  collaboration. Please read these files to understand the project structure 
  and help me with activities:

  @.cntx/agent-instructions.md
  @.cntx/activities/README.md  
  @.cntx/activities/activities.json

  After reading those, please also examine:
  @.cntx/activities/lib/create-activity.mdc
  @.cntx/activities/lib/generate-tasks.mdc
  @.cntx/activities/lib/process-task-list.mdc

  These files contain the complete workflow for creating and managing 
  activities with agent assistance."

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

  // Handle default command (watch if no command provided and no flags)
  const actualCommand = command === 'help' ? 'watch' : command;

  try {
    switch (actualCommand) {
      case 'watch':
      case 'w':
        const port = parseInt(args[1]) || 3333;
        const withMcp = args.includes('--with-mcp');
        await startServer({ port, withMcp, verbose: isVerbose });
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
          console.log(`✅ Bundle '${bundleName}' generated successfully`);
        } catch (error) {
          console.error(`❌ Failed to generate bundle '${bundleName}': ${error.message}`);
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

      case 'setup-mcp':
        setupMCP();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "cntx-ui --help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (isVerbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
