import { readFileSync } from 'fs';
import { join, relative } from 'path';

export class MCPServer {
  constructor(cntxServer) {
    this.cntxServer = cntxServer;
    this.clientCapabilities = null;
    this.serverInfo = {
      name: 'cntx-ui',
      version: '2.0.4'
    };
  }

  // JSON-RPC 2.0 message handler
  async handleMessage(message) {
    try {
      const request = typeof message === 'string' ? JSON.parse(message) : message;
      
      // Handle JSON-RPC 2.0 format
      if (!request.jsonrpc || request.jsonrpc !== '2.0') {
        return this.createErrorResponse(null, -32600, 'Invalid Request');
      }

      const response = await this.routeRequest(request);
      return response;
    } catch (error) {
      return this.createErrorResponse(null, -32700, 'Parse error');
    }
  }

  async routeRequest(request) {
    const { method, params, id } = request;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(params, id);
        
        case 'initialized':
          return null; // No response needed for notification
        
        case 'resources/list':
          return this.handleListResources(id);
        
        case 'resources/read':
          return this.handleReadResource(params, id);
        
        case 'tools/list':
          return this.handleListTools(id);
        
        case 'tools/call':
          return this.handleCallTool(params, id);
        
        default:
          return this.createErrorResponse(id, -32601, 'Method not found');
      }
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Internal error', error.message);
    }
  }

  // Initialize MCP session
  handleInitialize(params, id) {
    this.clientCapabilities = params?.capabilities || {};
    
    return this.createSuccessResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: {
          subscribe: true,
          listChanged: true
        },
        tools: {}
      },
      serverInfo: this.serverInfo
    });
  }

  // List available resources (bundles)
  handleListResources(id) {
    const resources = [];
    
    this.cntxServer.bundles.forEach((bundle, name) => {
      resources.push({
        uri: `cntx://bundle/${name}`,
        name: `Bundle: ${name}`,
        description: `File bundle containing ${bundle.files.length} files`,
        mimeType: 'application/xml'
      });
    });

    // Add individual file resources
    const allFiles = this.cntxServer.getAllFiles();
    allFiles.slice(0, 100).forEach((filePath) => { // Limit to first 100 files
      resources.push({
        uri: `cntx://file/${filePath}`,
        name: `File: ${filePath}`,
        description: `Individual file: ${filePath}`,
        mimeType: this.getMimeType(filePath)
      });
    });

    return this.createSuccessResponse(id, {
      resources
    });
  }

  // Read a specific resource
  handleReadResource(params, id) {
    const { uri } = params;
    
    if (!uri || !uri.startsWith('cntx://')) {
      return this.createErrorResponse(id, -32602, 'Invalid URI');
    }

    try {
      if (uri.startsWith('cntx://bundle/')) {
        const bundleName = uri.replace('cntx://bundle/', '');
        const bundle = this.cntxServer.bundles.get(bundleName);
        
        if (!bundle) {
          return this.createErrorResponse(id, -32602, 'Bundle not found');
        }

        return this.createSuccessResponse(id, {
          contents: [{
            uri,
            mimeType: 'application/xml',
            text: bundle.content
          }]
        });
      } else if (uri.startsWith('cntx://file/')) {
        const filePath = uri.replace('cntx://file/', '');
        const fullPath = join(this.cntxServer.CWD, filePath);
        
        try {
          const content = readFileSync(fullPath, 'utf8');
          return this.createSuccessResponse(id, {
            contents: [{
              uri,
              mimeType: this.getMimeType(filePath),
              text: content
            }]
          });
        } catch (error) {
          return this.createErrorResponse(id, -32602, 'File not found');
        }
      }

      return this.createErrorResponse(id, -32602, 'Invalid resource URI');
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Internal error reading resource');
    }
  }

  // List available tools
  handleListTools(id) {
    const tools = [
      {
        name: 'list_bundles',
        description: 'List all available file bundles',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_bundle',
        description: 'Get the content of a specific bundle',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the bundle to retrieve'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'generate_bundle',
        description: 'Regenerate a specific bundle',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the bundle to regenerate'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'get_file_tree',
        description: 'Get the project file tree',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_project_status',
        description: 'Get current project status and bundle information',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];

    return this.createSuccessResponse(id, { tools });
  }

  // Handle tool execution
  async handleCallTool(params, id) {
    const { name, arguments: args = {} } = params;

    try {
      switch (name) {
        case 'list_bundles':
          return this.toolListBundles(id);
        
        case 'get_bundle':
          return this.toolGetBundle(args, id);
        
        case 'generate_bundle':
          return this.toolGenerateBundle(args, id);
        
        case 'get_file_tree':
          return this.toolGetFileTree(id);
        
        case 'get_project_status':
          return this.toolGetProjectStatus(id);
        
        default:
          return this.createErrorResponse(id, -32602, 'Unknown tool');
      }
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Tool execution failed', error.message);
    }
  }

  // Tool implementations
  toolListBundles(id) {
    const bundles = [];
    this.cntxServer.bundles.forEach((bundle, name) => {
      bundles.push({
        name,
        fileCount: bundle.files.length,
        size: bundle.size,
        lastGenerated: bundle.lastGenerated,
        changed: bundle.changed,
        patterns: bundle.patterns
      });
    });

    return this.createSuccessResponse(id, {
      content: [{
        type: 'text',
        text: `Available bundles:\n${bundles.map(b => 
          `• ${b.name}: ${b.fileCount} files (${(b.size / 1024).toFixed(1)}KB) ${b.changed ? '[CHANGED]' : '[SYNCED]'}`
        ).join('\n')}`
      }]
    });
  }

  toolGetBundle(args, id) {
    const { name } = args;
    const bundle = this.cntxServer.bundles.get(name);
    
    if (!bundle) {
      return this.createErrorResponse(id, -32602, `Bundle '${name}' not found`);
    }

    return this.createSuccessResponse(id, {
      content: [{
        type: 'text',
        text: bundle.content
      }]
    });
  }

  toolGenerateBundle(args, id) {
    const { name } = args;
    
    if (!this.cntxServer.bundles.has(name)) {
      return this.createErrorResponse(id, -32602, `Bundle '${name}' not found`);
    }

    this.cntxServer.generateBundle(name);
    this.cntxServer.saveBundleStates();
    
    const bundle = this.cntxServer.bundles.get(name);
    
    return this.createSuccessResponse(id, {
      content: [{
        type: 'text',
        text: `Bundle '${name}' regenerated successfully. Contains ${bundle.files.length} files (${(bundle.size / 1024).toFixed(1)}KB).`
      }]
    });
  }

  toolGetFileTree(id) {
    const fileTree = this.cntxServer.getFileTree();
    const treeText = fileTree.map(file => 
      `${file.path} (${(file.size / 1024).toFixed(1)}KB)`
    ).join('\n');

    return this.createSuccessResponse(id, {
      content: [{
        type: 'text',
        text: `Project file tree:\n${treeText}`
      }]
    });
  }

  toolGetProjectStatus(id) {
    const bundleCount = this.cntxServer.bundles.size;
    const changedBundles = Array.from(this.cntxServer.bundles.entries())
      .filter(([_, bundle]) => bundle.changed)
      .map(([name, _]) => name);

    const statusText = `Project Status:
Working Directory: ${relative(process.cwd(), this.cntxServer.CWD)}
Total Bundles: ${bundleCount}
Changed Bundles: ${changedBundles.length > 0 ? changedBundles.join(', ') : 'None'}

Bundle Details:
${Array.from(this.cntxServer.bundles.entries()).map(([name, bundle]) => 
  `• ${name}: ${bundle.files.length} files, ${(bundle.size / 1024).toFixed(1)}KB ${bundle.changed ? '[CHANGED]' : '[SYNCED]'}`
).join('\n')}`;

    return this.createSuccessResponse(id, {
      content: [{
        type: 'text',
        text: statusText
      }]
    });
  }

  // Helper methods
  getMimeType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      'js': 'application/javascript',
      'jsx': 'application/javascript',
      'ts': 'application/typescript',
      'tsx': 'application/typescript',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'py': 'text/x-python',
      'java': 'text/x-java',
      'c': 'text/x-c',
      'cpp': 'text/x-c++',
      'php': 'text/x-php'
    };
    return mimeTypes[ext] || 'text/plain';
  }

  createSuccessResponse(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  createErrorResponse(id, code, message, data = null) {
    const error = { code, message };
    if (data) error.data = data;
    
    return {
      jsonrpc: '2.0',
      id,
      error
    };
  }
}