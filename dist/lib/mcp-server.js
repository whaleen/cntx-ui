/**
 * Model Context Protocol (MCP) Server Implementation
 * Exposes repository intelligence tools to AI agents
 */
import { readFileSync } from 'fs';
import { join } from 'path';
export class MCPServer {
    cntxServer;
    constructor(cntxServer) {
        this.cntxServer = cntxServer;
        // Listen for MCP requests on stdin
        process.stdin.on('data', (data) => {
            this.handleInput(data.toString());
        });
    }
    handleInput(input) {
        try {
            const lines = input.split('\n').filter(l => l.trim());
            for (const line of lines) {
                const request = JSON.parse(line);
                this.routeRequest(request);
            }
        }
        catch (e) {
            // Ignore invalid JSON
        }
    }
    async routeRequest(request) {
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
    sendResponse(response) {
        process.stdout.write(JSON.stringify(response) + '\n');
    }
    createSuccessResponse(id, result) {
        return { jsonrpc: '2.0', id, result };
    }
    createErrorResponse(id, code, message, data = null) {
        const error = { code, message };
        if (data)
            error.data = data;
        return { jsonrpc: '2.0', id, error };
    }
    // --- Handlers ---
    handleListTools(id) {
        const tools = this.getToolDefinitions();
        return this.createSuccessResponse(id, { tools });
    }
    async handleCallTool(params, id) {
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
        }
        catch (e) {
            return this.createErrorResponse(id, -32603, e.message);
        }
    }
    async toolReadFile(args, id) {
        const { path: filePath } = args;
        try {
            const fullPath = join(this.cntxServer.CWD, filePath);
            const content = readFileSync(fullPath, 'utf8');
            return this.createSuccessResponse(id, {
                content: [{ type: 'text', text: content }]
            });
        }
        catch (e) {
            return this.createErrorResponse(id, -32603, e.message);
        }
    }
    handleListResources(id) {
        return this.createSuccessResponse(id, { resources: [] });
    }
    handleListPrompts(id) {
        return this.createSuccessResponse(id, { prompts: [] });
    }
    handleGetPrompt(params, id) {
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
