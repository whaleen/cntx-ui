import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import AgentRuntime from './agent-runtime.js';

export class MCPServer {
  constructor(cntxServer) {
    this.cntxServer = cntxServer;
    this.clientCapabilities = null;
    this.serverInfo = {
      name: 'cntx-ui',
      version: '2.0.8'
    };
    this.agentRuntime = new AgentRuntime(cntxServer);
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
        case 'notifications/initialized':
          return null; // No response needed for notification
        
        case 'resources/list':
          return this.handleListResources(id);
        
        case 'resources/read':
          return this.handleReadResource(params, id);
        
        case 'tools/list':
          return this.handleListTools(id);
        
        case 'tools/call':
          return this.handleCallTool(params, id);
        
        case 'prompts/list':
          return this.createErrorResponse(id, -32601, 'Method not found');
        
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
      },
      {
        name: 'get_semantic_chunks',
        description: 'Get function-level semantic chunks from the codebase',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_semantic_chunks_filtered',
        description: 'Get semantic chunks filtered by purpose, type, complexity, or bundle',
        inputSchema: {
          type: 'object',
          properties: {
            purpose: {
              type: 'string',
              description: 'Filter by function purpose (e.g., "API handler", "React component", "Data retrieval")'
            },
            type: {
              type: 'string',
              description: 'Filter by function type (e.g., "arrow_function", "react_component", "method")'
            },
            complexity: {
              type: 'string',
              description: 'Filter by complexity level ("low", "medium", "high")'
            },
            bundle: {
              type: 'string',
              description: 'Filter by bundle membership'
            },
            exported: {
              type: 'boolean',
              description: 'Filter by export status'
            },
            async: {
              type: 'boolean',
              description: 'Filter by async functions'
            }
          },
          required: []
        }
      },
      {
        name: 'analyze_bundle_suggestions',
        description: 'Analyze codebase and suggest optimal bundle organization based on semantic chunks',
        inputSchema: {
          type: 'object',
          properties: {
            max_suggestions: {
              type: 'number',
              description: 'Maximum number of bundle suggestions to return (default: 5)'
            }
          },
          required: []
        }
      },
      {
        name: 'create_bundle',
        description: 'Create a new bundle with specified patterns',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the new bundle'
            },
            patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of glob patterns for the bundle (e.g., ["src/api/**", "src/services/**"])'
            },
            description: {
              type: 'string',
              description: 'Optional description of the bundle purpose'
            }
          },
          required: ['name', 'patterns']
        }
      },
      {
        name: 'update_bundle',
        description: 'Update an existing bundle\'s patterns',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the bundle to update'
            },
            patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'New array of glob patterns for the bundle'
            },
            description: {
              type: 'string',
              description: 'Optional updated description'
            }
          },
          required: ['name', 'patterns']
        }
      },
      {
        name: 'delete_bundle',
        description: 'Delete an existing bundle',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the bundle to delete'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'update_cntxignore',
        description: 'Update the .cntxignore file with new ignore patterns',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Full content for the .cntxignore file (newline-separated patterns)'
            }
          },
          required: ['content']
        }
      },
      {
        name: 'agent_discover',
        description: 'Agent Discovery Mode: Get comprehensive codebase overview including bundles, architecture, and patterns',
        inputSchema: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              description: 'Scope of discovery: "all" for full codebase or specific bundle name (default: "all")'
            },
            includeDetails: {
              type: 'boolean',
              description: 'Include detailed semantic analysis and complexity metrics (default: true)'
            }
          },
          required: []
        }
      },
      {
        name: 'agent_query',
        description: 'Agent Query Mode: Answer specific questions about the codebase using semantic search and analysis',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question to answer about the codebase (e.g., "Where is user authentication handled?")'
            },
            scope: {
              type: 'string',
              description: 'Optional bundle to limit search scope'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)'
            },
            includeCode: {
              type: 'boolean',
              description: 'Include code snippets in the response (default: false)'
            }
          },
          required: ['question']
        }
      },
      {
        name: 'agent_investigate',
        description: 'Agent Investigation Mode: Investigate existing implementations for a feature and find integration points',
        inputSchema: {
          type: 'object',
          properties: {
            featureDescription: {
              type: 'string',
              description: 'Description of the feature to investigate (e.g., "dark mode", "user authentication", "form validation")'
            },
            includeRecommendations: {
              type: 'boolean',
              description: 'Include implementation recommendations and approach suggestions (default: true)'
            }
          },
          required: ['featureDescription']
        }
      },
      {
        name: 'agent_discuss',
        description: 'Agent Passive Mode: Engage in discussion about codebase architecture, design decisions, and planning',
        inputSchema: {
          type: 'object',
          properties: {
            userInput: {
              type: 'string',
              description: 'The topic or question for discussion (e.g., "Let\'s discuss the architecture before I make changes")'
            },
            context: {
              type: 'object',
              description: 'Additional context for the discussion',
              properties: {
                scope: {
                  type: 'string',
                  description: 'Specific area of focus (e.g., "frontend", "api", "database")'
                }
              }
            }
          },
          required: ['userInput']
        }
      },
      {
        name: 'agent_organize',
        description: 'Agent Project Organizer Mode: Setup and maintenance of project organization - adapts to project maturity',
        inputSchema: {
          type: 'object',
          properties: {
            activity: {
              type: 'string',
              enum: ['detect', 'analyze', 'bundle', 'create', 'optimize', 'audit', 'cleanup', 'validate'],
              description: 'Activity to perform: detect project state, analyze semantics, suggest bundles, create bundles, optimize organization, audit health, cleanup issues, or validate structure'
            },
            autoDetect: {
              type: 'boolean',
              description: 'Automatically detect appropriate activity based on project state (default: true)',
              default: true
            },
            force: {
              type: 'boolean',
              description: 'Force execution even if preconditions are not met (default: false)',
              default: false
            }
          },
          required: []
        }
      },
      {
        name: 'read_file',
        description: 'Read contents of a specific file with bundle context and metadata',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to project root'
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include file metadata (size, bundles, etc.) - default: true'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file with validation and safety checks',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to project root'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            },
            backup: {
              type: 'boolean',
              description: 'Create backup before writing - default: true'
            },
            createDirs: {
              type: 'boolean',
              description: 'Create parent directories if they don\'t exist - default: true'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'manage_activities',
        description: 'CRUD operations for project activities',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['list', 'get', 'create', 'update', 'delete'],
              description: 'Action to perform on activities'
            },
            activityId: {
              type: 'string',
              description: 'Activity ID (required for get, update, delete)'
            },
            activity: {
              type: 'object',
              description: 'Activity data (required for create, update)',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'blocked'] },
                tags: { type: 'array', items: { type: 'string' } },
                tasks: { type: 'array', items: { type: 'object' } }
              }
            }
          },
          required: ['action']
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
        
        case 'get_semantic_chunks':
          return this.toolGetSemanticChunks(id);
        
        case 'get_semantic_chunks_filtered':
          return this.toolGetSemanticChunksFiltered(args, id);
        
        case 'analyze_bundle_suggestions':
          return this.toolAnalyzeBundleSuggestions(args, id);
        
        case 'create_bundle':
          return this.toolCreateBundle(args, id);
        
        case 'update_bundle':
          return this.toolUpdateBundle(args, id);
        
        case 'delete_bundle':
          return this.toolDeleteBundle(args, id);
        
        case 'update_cntxignore':
          return this.toolUpdateCntxignore(args, id);
        
        case 'agent_discover':
          return this.toolAgentDiscover(args, id);
        
        case 'agent_query':
          return this.toolAgentQuery(args, id);
        
        case 'agent_investigate':
          return this.toolAgentInvestigate(args, id);
        
        case 'agent_discuss':
          return this.toolAgentDiscuss(args, id);
        
        case 'agent_organize':
          return this.toolAgentOrganize(args, id);
        
        case 'read_file':
          return this.toolReadFile(args, id);
        
        case 'write_file':
          return this.toolWriteFile(args, id);
        
        case 'manage_activities':
          return this.toolManageActivities(args, id);
        
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

  // New semantic chunks tools
  async toolGetSemanticChunks(id) {
    try {
      const analysis = await this.cntxServer.getSemanticAnalysis();
      
      // Clean the analysis data to prevent JSON issues
      const cleanAnalysis = {
        ...analysis,
        chunks: analysis.chunks?.map(chunk => ({
          ...chunk,
          code: chunk.code ? chunk.code.substring(0, 500) + (chunk.code.length > 500 ? '...' : '') : '',
          bundles: chunk.bundles || [],
          includes: {
            imports: chunk.includes?.imports || [],
            types: chunk.includes?.types || []
          }
        })) || []
      };
      
      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(cleanAnalysis, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to get semantic chunks', error.message);
    }
  }

  async toolGetSemanticChunksFiltered(args, id) {
    try {
      const analysis = await this.cntxServer.getSemanticAnalysis();
      let chunks = analysis.chunks || [];

      // Apply filters
      if (args.purpose) {
        chunks = chunks.filter(chunk => 
          chunk.purpose && chunk.purpose.toLowerCase().includes(args.purpose.toLowerCase())
        );
      }
      
      if (args.type) {
        chunks = chunks.filter(chunk => chunk.subtype === args.type);
      }
      
      if (args.complexity) {
        chunks = chunks.filter(chunk => chunk.complexity?.level === args.complexity);
      }
      
      if (args.bundle) {
        chunks = chunks.filter(chunk => 
          chunk.bundles && chunk.bundles.includes(args.bundle)
        );
      }
      
      if (args.exported !== undefined) {
        chunks = chunks.filter(chunk => chunk.isExported === args.exported);
      }
      
      if (args.async !== undefined) {
        chunks = chunks.filter(chunk => chunk.isAsync === args.async);
      }

      // Clean chunks for JSON safety
      const cleanChunks = chunks.map(chunk => ({
        ...chunk,
        code: chunk.code ? chunk.code.substring(0, 300) + (chunk.code.length > 300 ? '...' : '') : '',
        bundles: chunk.bundles || [],
        includes: {
          imports: chunk.includes?.imports || [],
          types: chunk.includes?.types || []
        }
      }));

      const filteredAnalysis = {
        ...analysis,
        chunks: cleanChunks,
        summary: {
          ...analysis.summary,
          totalChunks: cleanChunks.length,
          filteredCount: cleanChunks.length,
          originalCount: analysis.chunks?.length || 0
        }
      };

      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(filteredAnalysis, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to filter semantic chunks', error.message);
    }
  }

  async toolAnalyzeBundleSuggestions(args, id) {
    try {
      const analysis = await this.cntxServer.getSemanticAnalysis();
      const chunks = analysis.chunks || [];
      const maxSuggestions = args.max_suggestions || 5;

      // Group chunks by purpose and file location
      const purposeGroups = {};
      const locationGroups = {};

      chunks.forEach(chunk => {
        // Group by purpose
        if (!purposeGroups[chunk.purpose]) {
          purposeGroups[chunk.purpose] = [];
        }
        purposeGroups[chunk.purpose].push(chunk);

        // Group by file location patterns
        const pathParts = chunk.filePath.split('/');
        if (pathParts.length > 1) {
          const dirPattern = pathParts.slice(0, -1).join('/') + '/**';
          if (!locationGroups[dirPattern]) {
            locationGroups[dirPattern] = [];
          }
          locationGroups[dirPattern].push(chunk);
        }
      });

      const suggestions = [];

      // Suggest bundles by purpose
      Object.entries(purposeGroups).forEach(([purpose, chunks]) => {
        if (chunks.length >= 3) { // Only suggest if enough functions
          const bundleName = purpose.toLowerCase().replace(/\s+/g, '-');
          const patterns = [...new Set(chunks.map(c => {
            const dir = c.filePath.split('/').slice(0, -1).join('/');
            return dir ? `${dir}/**` : c.filePath;
          }))];

          suggestions.push({
            name: bundleName,
            reason: `Groups ${chunks.length} functions with purpose: ${purpose}`,
            patterns,
            chunkCount: chunks.length,
            files: [...new Set(chunks.map(c => c.filePath))]
          });
        }
      });

      // Suggest bundles by common directory patterns
      Object.entries(locationGroups).forEach(([pattern, chunks]) => {
        if (chunks.length >= 5) { // Only suggest if enough functions in same location
          const dirName = pattern.split('/').pop().replace('/**', '');
          const bundleName = dirName === '*' ? 'utils' : dirName;
          
          suggestions.push({
            name: bundleName,
            reason: `Groups ${chunks.length} functions from ${pattern}`,
            patterns: [pattern],
            chunkCount: chunks.length,
            files: [...new Set(chunks.map(c => c.filePath))]
          });
        }
      });

      // Sort by chunk count and take top suggestions
      const topSuggestions = suggestions
        .sort((a, b) => b.chunkCount - a.chunkCount)
        .slice(0, maxSuggestions);

      const result = {
        totalSuggestions: suggestions.length,
        suggestions: topSuggestions,
        analysis: {
          totalChunks: chunks.length,
          purposeGroups: Object.keys(purposeGroups).length,
          locationGroups: Object.keys(locationGroups).length
        }
      };

      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to analyze bundle suggestions', error.message);
    }
  }

  // Bundle management tools
  async toolCreateBundle(args, id) {
    try {
      const { name, patterns, description } = args;

      if (!name || !patterns || !Array.isArray(patterns)) {
        return this.createErrorResponse(id, -32602, 'Invalid arguments: name and patterns array required');
      }

      // Prevent overwriting existing bundles
      if (this.cntxServer.bundles.has(name)) {
        return this.createErrorResponse(id, -32602, `Bundle '${name}' already exists`);
      }

      // Create bundle in bundle-states.json (single source of truth)
      this.cntxServer.configManager.bundleStates.set(name, {
        patterns: patterns,
        files: [],
        content: '',
        changed: false,
        size: 0,
        generated: null
      });

      // Save bundle states
      this.cntxServer.configManager.saveBundleStates();

      // Regenerate bundles
      this.cntxServer.generateAllBundles();

      const result = {
        success: true,
        bundle: {
          name,
          patterns,
          description,
          created: new Date().toISOString()
        }
      };

      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to create bundle', error.message);
    }
  }

  async toolUpdateBundle(args, id) {
    try {
      const { name, patterns, description } = args;

      if (!name || !patterns || !Array.isArray(patterns)) {
        return this.createErrorResponse(id, -32602, 'Invalid arguments: name and patterns array required');
      }

      // Check if bundle exists
      if (!this.cntxServer.bundles.has(name)) {
        return this.createErrorResponse(id, -32602, `Bundle '${name}' not found`);
      }

      // Prevent updating master bundle
      if (name === 'master') {
        return this.createErrorResponse(id, -32602, 'Cannot update master bundle');
      }

      // Update bundle in bundle-states.json (single source of truth)
      const bundle = this.cntxServer.configManager.bundleStates.get(name);
      bundle.patterns = patterns;
      bundle.changed = true;

      // Save bundle states
      this.cntxServer.configManager.saveBundleStates();

      // Regenerate bundles
      this.cntxServer.generateAllBundles();

      const result = {
        success: true,
        bundle: {
          name,
          patterns,
          description,
          updated: new Date().toISOString()
        }
      };

      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to update bundle', error.message);
    }
  }

  async toolDeleteBundle(args, id) {
    try {
      const { name } = args;

      if (!name) {
        return this.createErrorResponse(id, -32602, 'Bundle name required');
      }

      // Check if bundle exists
      if (!this.cntxServer.bundles.has(name)) {
        return this.createErrorResponse(id, -32602, `Bundle '${name}' not found`);
      }

      // Prevent deleting master bundle
      if (name === 'master') {
        return this.createErrorResponse(id, -32602, 'Cannot delete master bundle');
      }

      // Remove bundle from bundle-states.json (single source of truth)
      this.cntxServer.configManager.bundleStates.delete(name);

      // Save bundle states
      this.cntxServer.configManager.saveBundleStates();

      // Regenerate bundles
      this.cntxServer.generateAllBundles();

      const result = {
        success: true,
        deleted: name,
        timestamp: new Date().toISOString()
      };

      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to delete bundle', error.message);
    }
  }

  async toolUpdateCntxignore(args, id) {
    try {
      const { content } = args;

      if (content === undefined) {
        return this.createErrorResponse(id, -32602, 'Content required');
      }

      const ignorePath = join(this.cntxServer.CWD, '.cntxignore');
      
      // Write the .cntxignore file
      writeFileSync(ignorePath, content);

      // Reload ignore patterns
      this.cntxServer.loadIgnorePatterns();
      this.cntxServer.generateAllBundles();

      const result = {
        success: true,
        file: '.cntxignore',
        lines: content.split('\n').length,
        patterns: content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#')).length,
        updated: new Date().toISOString()
      };

      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to update .cntxignore', error.message);
    }
  }

  // Agent Tools Implementation
  async toolAgentDiscover(args, id) {
    try {
      const { scope = 'all', includeDetails = true } = args;
      const result = await this.agentRuntime.discoverCodebase({ scope, includeDetails });
      
      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Agent discovery failed', error.message);
    }
  }

  async toolAgentQuery(args, id) {
    try {
      const { question, scope, maxResults = 10, includeCode = false } = args;
      
      if (!question) {
        return this.createErrorResponse(id, -32602, 'Question is required');
      }
      
      const result = await this.agentRuntime.answerQuery(question, { scope, maxResults, includeCode });
      
      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Agent query failed', error.message);
    }
  }

  async toolAgentInvestigate(args, id) {
    try {
      const { featureDescription, includeRecommendations = true } = args;
      
      if (!featureDescription) {
        return this.createErrorResponse(id, -32602, 'Feature description is required');
      }
      
      const result = await this.agentRuntime.investigateFeature(featureDescription, { includeRecommendations });
      
      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Agent investigation failed', error.message);
    }
  }

  async toolAgentDiscuss(args, id) {
    try {
      const { userInput, context = {} } = args;
      
      if (!userInput) {
        return this.createErrorResponse(id, -32602, 'User input is required');
      }
      
      const result = await this.agentRuntime.discussAndPlan(userInput, context);
      
      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Agent discussion failed', error.message);
    }
  }

  async toolAgentOrganize(args, id) {
    try {
      const { activity = 'detect', autoDetect = true, force = false } = args;
      
      const result = await this.agentRuntime.organizeProject({ activity, autoDetect, force });
      
      return this.createSuccessResponse(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Agent organization failed', error.message);
    }
  }

  // New tool implementations
  async toolReadFile(args, id) {
    const { path, includeMetadata = true } = args;
    
    if (!path) {
      return this.createErrorResponse(id, -32602, 'Path is required');
    }

    try {
      const fullPath = join(this.cntxServer.CWD, path);
      
      if (!existsSync(fullPath)) {
        return this.createErrorResponse(id, -32602, `File not found: ${path}`);
      }

      const content = readFileSync(fullPath, 'utf8');
      const result = { path, content };

      if (includeMetadata) {
        const stats = require('fs').statSync(fullPath);
        const bundles = [];
        
        // Find which bundles include this file
        this.cntxServer.bundles.forEach((bundle, name) => {
          if (bundle.files && bundle.files.includes(fullPath)) {
            bundles.push(name);
          }
        });

        result.metadata = {
          size: stats.size,
          mimeType: this.getMimeType(path),
          modified: stats.mtime.toISOString(),
          lines: content.split('\n').length,
          bundles: bundles
        };
      }

      return this.createSuccessResponse(id, {
        contents: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to read file', error.message);
    }
  }

  async toolWriteFile(args, id) {
    const { path, content, backup = true, createDirs = true } = args;
    
    if (!path || content === undefined) {
      return this.createErrorResponse(id, -32602, 'Path and content are required');
    }

    try {
      const fullPath = join(this.cntxServer.CWD, path);
      const parentDir = require('path').dirname(fullPath);
      
      // Create parent directories if needed
      if (createDirs && !existsSync(parentDir)) {
        require('fs').mkdirSync(parentDir, { recursive: true });
      }

      // Create backup if file exists
      if (backup && existsSync(fullPath)) {
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        require('fs').copyFileSync(fullPath, backupPath);
      }

      // Write the file
      writeFileSync(fullPath, content, 'utf8');

      // Mark relevant bundles as changed
      this.cntxServer.bundles.forEach((bundle, name) => {
        if (bundle.patterns && bundle.patterns.some(pattern => 
          this.cntxServer.fileSystemManager.matchesPattern(fullPath, pattern)
        )) {
          bundle.changed = true;
        }
      });

      const stats = require('fs').statSync(fullPath);
      
      return this.createSuccessResponse(id, {
        contents: [{
          type: 'text',
          text: JSON.stringify({
            path,
            written: true,
            size: stats.size,
            modified: stats.mtime.toISOString()
          }, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to write file', error.message);
    }
  }

  async toolManageActivities(args, id) {
    const { action, activityId, activity } = args;
    
    if (!action) {
      return this.createErrorResponse(id, -32602, 'Action is required');
    }

    try {
      const activitiesPath = join(this.cntxServer.CWD, '.cntx', 'activities');
      const activitiesJsonPath = join(activitiesPath, 'activities.json');
      
      let activities = [];
      if (existsSync(activitiesJsonPath)) {
        activities = JSON.parse(readFileSync(activitiesJsonPath, 'utf8'));
      }

      let result;
      
      switch (action) {
        case 'list':
          result = { activities: activities.map(a => ({ 
            id: a.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            title: a.title, 
            description: a.description, 
            status: a.status, 
            tags: a.tags 
          })) };
          break;
          
        case 'get':
          if (!activityId) {
            return this.createErrorResponse(id, -32602, 'Activity ID is required for get action');
          }
          const found = activities.find(a => 
            a.title.toLowerCase().replace(/[^a-z0-9]/g, '-') === activityId
          );
          if (!found) {
            return this.createErrorResponse(id, -32602, `Activity not found: ${activityId}`);
          }
          
          // Load markdown files
          const activityDir = join(activitiesPath, 'activities', activityId);
          const files = {};
          ['README.md', 'progress.md', 'tasks.md', 'notes.md'].forEach(file => {
            const filePath = join(activityDir, file);
            files[file.replace('.md', '')] = existsSync(filePath) 
              ? readFileSync(filePath, 'utf8') 
              : 'No content available';
          });
          
          result = { ...found, files };
          break;
          
        case 'create':
          if (!activity || !activity.title) {
            return this.createErrorResponse(id, -32602, 'Activity with title is required for create action');
          }
          activities.push({
            title: activity.title,
            description: activity.description || '',
            status: activity.status || 'todo',
            tags: activity.tags || ['general'],
            tasks: activity.tasks || []
          });
          writeFileSync(activitiesJsonPath, JSON.stringify(activities, null, 2));
          result = { created: true, activityId: activity.title.toLowerCase().replace(/[^a-z0-9]/g, '-') };
          break;
          
        case 'update':
          if (!activityId || !activity) {
            return this.createErrorResponse(id, -32602, 'Activity ID and activity data are required for update action');
          }
          const updateIndex = activities.findIndex(a => 
            a.title.toLowerCase().replace(/[^a-z0-9]/g, '-') === activityId
          );
          if (updateIndex === -1) {
            return this.createErrorResponse(id, -32602, `Activity not found: ${activityId}`);
          }
          activities[updateIndex] = { ...activities[updateIndex], ...activity };
          writeFileSync(activitiesJsonPath, JSON.stringify(activities, null, 2));
          result = { updated: true };
          break;
          
        case 'delete':
          if (!activityId) {
            return this.createErrorResponse(id, -32602, 'Activity ID is required for delete action');
          }
          const deleteIndex = activities.findIndex(a => 
            a.title.toLowerCase().replace(/[^a-z0-9]/g, '-') === activityId
          );
          if (deleteIndex === -1) {
            return this.createErrorResponse(id, -32602, `Activity not found: ${activityId}`);
          }
          activities.splice(deleteIndex, 1);
          writeFileSync(activitiesJsonPath, JSON.stringify(activities, null, 2));
          result = { deleted: true };
          break;
          
        default:
          return this.createErrorResponse(id, -32602, `Unknown action: ${action}`);
      }

      return this.createSuccessResponse(id, {
        contents: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Failed to manage activities', error.message);
    }
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