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
                case 'artifacts/list': {
                    const artifacts = this.cntxServer.artifactManager.refresh();
                    return this.createSuccessResponse(id, { content: [{ type: 'text', text: JSON.stringify({ artifacts }, null, 2) }] });
                }
                case 'artifacts/get_openapi': {
                    this.cntxServer.artifactManager.refresh();
                    const payload = this.cntxServer.artifactManager.getPayload('openapi');
                    return this.createSuccessResponse(id, { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
                }
                case 'artifacts/get_navigation': {
                    this.cntxServer.artifactManager.refresh();
                    const payload = this.cntxServer.artifactManager.getPayload('navigation');
                    return this.createSuccessResponse(id, { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
                }
                case 'artifacts/summarize': {
                    const artifacts = this.cntxServer.artifactManager.refresh();
                    const summary = {
                        openapi: artifacts.find((a) => a.type === 'openapi')?.summary ?? {},
                        navigation: artifacts.find((a) => a.type === 'navigation')?.summary ?? {}
                    };
                    return this.createSuccessResponse(id, { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] });
                }
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
                name: 'artifacts/list',
                description: 'List normalized project artifacts (OpenAPI and Navigation manifests).',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'artifacts/get_openapi',
                description: 'Get OpenAPI artifact payload (summary + parsed content when JSON).',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'artifacts/get_navigation',
                description: 'Get Navigation artifact payload (summary + parsed manifest).',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'artifacts/summarize',
                description: 'Get compact summaries for OpenAPI and Navigation artifacts.',
                inputSchema: { type: 'object', properties: {} }
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
