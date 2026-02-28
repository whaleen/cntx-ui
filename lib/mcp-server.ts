/**
 * Model Context Protocol (MCP) Server Implementation
 * Exposes repository intelligence tools to AI agents
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, copyFileSync } from 'fs';
import fs from 'fs';
import { join, relative, dirname } from 'path';
import AgentRuntime from './agent-runtime.js';
import { CntxServer } from '../server.js';

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export class MCPServer {
  cntxServer: CntxServer;

  constructor(cntxServer: CntxServer) {
    this.cntxServer = cntxServer;
    
    // Listen for MCP requests on stdin
    process.stdin.on('data', (data) => {
      this.handleInput(data.toString());
    });
  }

  handleInput(input: string) {
    try {
      const lines = input.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const request = JSON.parse(line) as McpRequest;
        this.routeRequest(request);
      }
    } catch (e) {
      // Ignore invalid JSON
    }
  }

  async routeRequest(request: McpRequest) {
    const { method, params, id } = request;

    switch (method) {
      case 'initialize':
        return this.sendResponse(this.createSuccessResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: { name: 'cntx-ui', version: '3.0.0' }
        }));

      case 'tools/list':
        return this.sendResponse(this.handleListTools(id));

      case 'tools/call':
        return this.sendResponse(await this.handleCallTool(params, id));

      case 'resources/list':
        return this.sendResponse(this.handleListResources(id));

      case 'prompts/list':
        return this.sendResponse(this.handleListPrompts(id));

      case 'prompts/get':
        return this.sendResponse(this.handleGetPrompt(params, id));

      default:
        return this.sendResponse(this.createErrorResponse(id, -32601, `Method not found: ${method}`));
    }
  }

  sendResponse(response: any) {
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  createSuccessResponse(id: string | number, result: any) {
    return { jsonrpc: '2.0', id, result };
  }

  createErrorResponse(id: string | number, code: number, message: string, data: any = null) {
    const error: any = { code, message };
    if (data) error.data = data;
    return { jsonrpc: '2.0', id, error };
  }

  // --- Handlers ---

  handleListTools(id: string | number) {
    const tools = this.getToolDefinitions();
    return this.createSuccessResponse(id, { tools });
  }

  async handleCallTool(params: any, id: string | number) {
    const { name, arguments: args } = params;

    try {
      if (name.startsWith('agent/')) {
        const mode = name.split('/')[1];
        let result;
        switch (mode) {
          case 'discover':
            result = await this.cntxServer.agentRuntime.discoverCodebase(args);
            break;
          case 'query':
            result = await this.cntxServer.agentRuntime.answerQuery(args.question, args);
            break;
          case 'investigate':
            result = await this.cntxServer.agentRuntime.investigateFeature(args.feature, args);
            break;
          default:
            return this.createErrorResponse(id, -32602, `Unknown agent tool: ${name}`);
        }
        return this.createSuccessResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      }

      // Legacy tools mapping
      switch (name) {
        case 'list_bundles':
          const bundles = this.cntxServer.bundleManager.getAllBundleInfo();
          return this.createSuccessResponse(id, { content: [{ type: 'text', text: JSON.stringify(bundles, null, 2) }] });
        case 'read_file':
          return await this.toolReadFile(args, id);
        default:
          return this.createErrorResponse(id, -32602, `Tool not found: ${name}`);
      }
    } catch (e: any) {
      return this.createErrorResponse(id, -32603, e.message);
    }
  }

  async toolReadFile(args: any, id: string | number) {
    const { path: filePath } = args;
    try {
      const fullPath = join(this.cntxServer.CWD, filePath);
      const content = readFileSync(fullPath, 'utf8');
      return this.createSuccessResponse(id, {
        content: [{ type: 'text', text: content }]
      });
    } catch (e: any) {
      return this.createErrorResponse(id, -32603, e.message);
    }
  }

  handleListResources(id: string | number) {
    return this.createSuccessResponse(id, { resources: [] });
  }

  handleListPrompts(id: string | number) {
    return this.createSuccessResponse(id, { prompts: [] });
  }

  handleGetPrompt(params: any, id: string | number) {
    return this.createErrorResponse(id, -32602, 'Prompt not found');
  }

  getToolDefinitions() {
    return [
      {
        name: 'agent/discover',
        description: 'Discovery Mode: Comprehensive architectural overview.',
        inputSchema: { type: 'object', properties: { scope: { type: 'string' } } }
      },
      {
        name: 'agent/query',
        description: 'Query Mode: Answer technical questions.',
        inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }
      },
      {
        name: 'agent/investigate',
        description: 'Investigation Mode: Suggest integration points.',
        inputSchema: { type: 'object', properties: { feature: { type: 'string' } }, required: ['feature'] }
      },
      {
        name: 'list_bundles',
        description: 'List all project bundles.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'read_file',
        description: 'Read a file.',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
      }
    ];
  }
}
