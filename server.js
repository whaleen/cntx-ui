/**
 * Refactored cntx-ui Server
 * Lean orchestration layer using modular architecture
 */

import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as fs from 'fs';
import { homedir } from 'os';

// Import our modular components
import ConfigurationManager from './lib/configuration-manager.js';
import FileSystemManager from './lib/file-system-manager.js';
import BundleManager from './lib/bundle-manager.js';
import APIRouter from './lib/api-router.js';
import WebSocketManager from './lib/websocket-manager.js';

// Import existing lib modules
import { startMCPTransport } from './lib/mcp-transport.js';
import SemanticSplitter from './lib/semantic-splitter.js';
import SimpleVectorStore from './lib/simple-vector-store.js';
import { MCPServer } from './lib/mcp-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Utility function for content types
function getContentType(filePath) {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return contentTypes[ext] || 'text/plain';
}

export class CntxServer {
  constructor(cwd = process.cwd(), options = {}) {
    this.CWD = cwd;
    this.CNTX_DIR = join(cwd, '.cntx');
    this.isQuietMode = options.quiet || false;
    this.mcpServerStarted = false;
    this.mcpServer = null;

    // Initialize modular components
    this.configManager = new ConfigurationManager(cwd);
    this.fileSystemManager = new FileSystemManager(cwd);
    this.bundleManager = new BundleManager(this.configManager, this.fileSystemManager);
    this.webSocketManager = new WebSocketManager(this.bundleManager, this.configManager);

    // Initialize semantic analysis components
    this.semanticSplitter = new SemanticSplitter({
      maxChunkSize: 2000,
      includeContext: true,
      groupRelated: true,
      minFunctionSize: 50
    });

    this.vectorStore = new SimpleVectorStore({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      collectionName: 'code-chunks'
    });

    this.semanticCache = null;
    this.lastSemanticAnalysis = null;
    this.vectorStoreInitialized = false;

    // Create semantic analysis manager object for API router
    this.semanticAnalysisManager = {
      getSemanticAnalysis: () => this.getSemanticAnalysis(),
      refreshSemanticAnalysis: () => this.refreshSemanticAnalysis(),
      exportSemanticChunk: (chunkName) => this.exportSemanticChunk(chunkName),
      lastSemanticAnalysis: this.lastSemanticAnalysis
    };

    // Create activity manager placeholder
    this.activityManager = {
      loadActivities: () => this.loadActivities(),
      executeActivity: (id) => this.executeActivity(id),
      stopActivity: (id) => this.stopActivity(id)
    };

    // Initialize API router with all managers
    this.apiRouter = new APIRouter(
      this.configManager,
      this.bundleManager,
      this.fileSystemManager,
      this.semanticAnalysisManager,
      this.vectorStore,
      this.activityManager
    );

    // Add references for cross-module communication
    this.bundleManager.fileSystemManager = this.fileSystemManager;
    this.apiRouter.mcpServerStarted = this.mcpServerStarted;
  }

  // === Initialization ===

  init() {
    if (!existsSync(this.CNTX_DIR)) mkdirSync(this.CNTX_DIR, { recursive: true });
    
    // Initialize configuration
    this.configManager.loadConfig();
    this.configManager.loadHiddenFilesConfig();
    this.configManager.loadIgnorePatterns();
    this.configManager.loadBundleStates();
    
    // Set ignore patterns on file system manager
    this.fileSystemManager.setIgnorePatterns(this.configManager.getIgnorePatterns());
    
    // Load semantic cache
    const cacheData = this.configManager.loadSemanticCache();
    if (cacheData) {
      this.semanticCache = cacheData.analysis;
      this.lastSemanticAnalysis = cacheData.timestamp;
    }
    
    // Start file watching
    this.startWatching();
    
    // Generate bundles
    this.bundleManager.generateAllBundles();
  }

  // === File Watching ===

  startWatching() {
    this.fileSystemManager.startWatching((eventType, filename) => {
      if (!this.isQuietMode) {
        console.log(`📁 File ${eventType}: ${filename}`);
      }
      
      // Mark affected bundles as changed
      this.bundleManager.markBundlesChanged(filename);
      
      // Invalidate semantic cache if needed
      this.invalidateSemanticCache();
      
      // Notify WebSocket clients
      this.webSocketManager.onFileChanged(filename, eventType);
    });
  }

  // === HTTP Server ===

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Add CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Handle API routes
      if (url.pathname.startsWith('/api/')) {
        return await this.apiRouter.handleRequest(req, res, url);
      }

      // Handle static files
      return this.handleStaticFile(req, res, url);

    } catch (error) {
      console.error('Request handling error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  handleStaticFile(req, res, url) {
    const webDir = join(__dirname, 'web', 'dist');
    let filePath = join(webDir, url.pathname === '/' ? 'index.html' : url.pathname);

    // Security check - ensure path is within web directory
    if (!filePath.startsWith(webDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath)) {
      // For SPA routing, serve index.html for non-API routes
      if (!url.pathname.startsWith('/api/')) {
        filePath = join(webDir, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
    }

    try {
      const content = readFileSync(filePath);
      const contentType = getContentType(filePath);
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error reading file');
    }
  }

  // === Semantic Analysis (Legacy methods for compatibility) ===

  async getSemanticAnalysis() {
    // First, try to load from cache
    if (!this.semanticCache) {
      const cacheData = this.configManager.loadSemanticCache();
      if (cacheData) {
        this.semanticCache = cacheData.analysis;
        this.lastSemanticAnalysis = cacheData.timestamp;
        return cacheData.analysis;
      }
    }

    // Check if we need to refresh the semantic analysis
    const shouldRefresh = !this.semanticCache || !this.lastSemanticAnalysis;

    if (shouldRefresh) {
      try {
        // Auto-discover JavaScript/TypeScript files in the entire project
        const patterns = ['**/*.{js,jsx,ts,tsx,mjs}'];

        // Load bundle configuration for chunk grouping
        let bundleConfig = null;
        if (existsSync(this.configManager.CONFIG_FILE)) {
          bundleConfig = JSON.parse(readFileSync(this.configManager.CONFIG_FILE, 'utf8'));
        }

        this.semanticCache = await this.semanticSplitter.extractSemanticChunks(this.CWD, patterns, bundleConfig);
        this.lastSemanticAnalysis = Date.now();

        // Only enhance chunks with embeddings if they don't already have them
        await this.enhanceSemanticChunksIfNeeded(this.semanticCache);

        // Save to disk cache
        this.configManager.saveSemanticCache(this.semanticCache);

        console.log('🔍 Semantic analysis complete');
      } catch (error) {
        console.error('Semantic analysis failed:', error.message);
        throw new Error(`Semantic analysis failed: ${error.message}`);
      }
    }

    return this.semanticCache;
  }

  async refreshSemanticAnalysis() {
    console.log('🔄 Forcing semantic analysis refresh...');

    // Clear memory cache
    this.semanticCache = null;
    this.lastSemanticAnalysis = null;

    // Remove disk cache file
    this.configManager.invalidateSemanticCache();

    return this.getSemanticAnalysis();
  }

  async enhanceSemanticChunksIfNeeded(analysis) {
    if (!analysis || !analysis.chunks) return;

    const chunksNeedingEmbeddings = analysis.chunks.filter(chunk => !chunk.embedding);
    
    if (chunksNeedingEmbeddings.length === 0) {
      console.log('✅ All chunks already have embeddings');
      return;
    }

    console.log(`🔧 Enhancing ${chunksNeedingEmbeddings.length} chunks with embeddings...`);
    
    // Initialize vector store if needed
    if (!this.vectorStoreInitialized) {
      await this.vectorStore.init();
      this.vectorStoreInitialized = true;
    }

    // Add embeddings to chunks that need them
    for (const chunk of chunksNeedingEmbeddings) {
      try {
        const content = this.getChunkContentForEmbedding(chunk);
        chunk.embedding = await this.vectorStore.generateEmbedding(content);
      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error.message);
      }
    }
  }

  getChunkContentForEmbedding(chunk) {
    let content = chunk.content || '';
    
    if (chunk.businessDomains?.length > 0) {
      content += ' ' + chunk.businessDomains.join(' ');
    }
    
    if (chunk.technicalPatterns?.length > 0) {
      content += ' ' + chunk.technicalPatterns.join(' ');
    }
    
    return content.trim();
  }

  async exportSemanticChunk(chunkName) {
    const analysis = await this.getSemanticAnalysis();
    const chunk = analysis.chunks.find(c => c.name === chunkName || c.id === chunkName);
    
    if (!chunk) {
      throw new Error(`Chunk "${chunkName}" not found`);
    }

    return this.bundleManager.generateFileXML(chunk.filePath);
  }

  invalidateSemanticCache() {
    this.semanticCache = null;
    this.lastSemanticAnalysis = null;
  }

  // === Activity Management (Placeholder) ===

  async loadActivities() {
    try {
      const activitiesPath = join(this.CWD, '.cntx', 'activities');
      const activitiesJsonPath = join(activitiesPath, 'activities.json');
      
      console.log('DEBUG: Looking for activities at:', activitiesJsonPath);
      console.log('DEBUG: File exists:', fs.existsSync(activitiesJsonPath));
      console.log('DEBUG: CWD is:', this.CWD);
      
      if (!fs.existsSync(activitiesJsonPath)) {
        console.log('Activities file not found, returning empty array');
        return [];
      }
      
      const activitiesData = JSON.parse(fs.readFileSync(activitiesJsonPath, 'utf8'));
      
      return activitiesData.map((activity, index) => {
        // Extract the actual directory name from the references field
        let activityId = activity.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (activity.references && activity.references.length > 0) {
          // Extract directory name from path like ".cntx/activities/activities/refactor-js-to-ts/README.md"
          const refPath = activity.references[0];
          const pathParts = refPath.split('/');
          if (pathParts.length >= 4) {
            activityId = pathParts[3]; // activities/activities/{this-part}/README.md
          }
        }
        const activityDir = join(activitiesPath, 'activities', activityId);
        
        // Load markdown files
        const files = {
          readme: this.loadMarkdownFile(join(activityDir, 'README.md')),
          progress: this.loadMarkdownFile(join(activityDir, 'progress.md')),
          tasks: this.loadMarkdownFile(join(activityDir, 'tasks.md')),
          notes: this.loadMarkdownFile(join(activityDir, 'notes.md'))
        };
        
        // Calculate progress from progress.md file
        const progress = this.parseProgressFromMarkdown(files.progress);
        
        return {
          id: activityId,
          name: activity.title,
          description: activity.description,
          status: activity.status === 'todo' ? 'pending' : activity.status,
          priority: activity.tags?.includes('high') ? 'high' : activity.tags?.includes('low') ? 'low' : 'medium',
          progress,
          updatedAt: new Date().toISOString(),
          category: activity.tags?.[0] || 'general',
          files,
          tags: activity.tags
        };
      });
    } catch (error) {
      console.error('Failed to load activities:', error);
      return [];
    }
  }
  
  loadMarkdownFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
      return 'No content available';
    } catch (error) {
      return `Error loading file: ${error.message}`;
    }
  }

  parseProgressFromMarkdown(progressContent) {
    try {
      if (!progressContent || progressContent === 'No content available') {
        return 0;
      }

      // Look for "Overall Completion: XX%" pattern
      const overallMatch = progressContent.match(/(?:Overall Completion|Progress):\s*(\d+)%/i);
      if (overallMatch) {
        return parseInt(overallMatch[1], 10);
      }

      // Fallback: count completed tasks vs total tasks in checkbox format
      const taskMatches = progressContent.match(/- \[([x✓✅\s])\]/gi);
      if (taskMatches && taskMatches.length > 0) {
        const completedTasks = taskMatches.filter(match => 
          match.includes('[x]') || match.includes('[✓]') || match.includes('[✅]')
        ).length;
        return Math.round((completedTasks / taskMatches.length) * 100);
      }

      return 0;
    } catch (error) {
      console.error('Error parsing progress:', error);
      return 0;
    }
  }

  async executeActivity(activityId) {
    // Placeholder - would execute specific activity
    return { success: false, message: 'Activity execution not implemented' };
  }

  async stopActivity(activityId) {
    // Placeholder - would stop running activity
    return { success: false, message: 'Activity stopping not implemented' };
  }

  // === MCP Server Integration ===

  startMCPServer() {
    if (!this.mcpServer) {
      this.mcpServer = new MCPServer(this);
      this.mcpServerStarted = true;
      this.apiRouter.mcpServerStarted = true;
      
      if (!this.isQuietMode) {
        console.log('🔗 MCP server started');
      }
    }
  }

  // === Server Lifecycle ===

  listen(port = 3333, host = 'localhost') {
    const server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Initialize WebSocket server
    this.webSocketManager.initialize(server);

    server.listen(port, host, () => {
      if (!this.isQuietMode) {
        console.log(`🚀 cntx-ui server running at http://${host}:${port}`);
        console.log(`📊 Serving ${this.bundleManager.getAllBundleInfo().length} bundles`);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      this.webSocketManager.close();
      this.fileSystemManager.destroy();
      server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
      });
    });

    return server;
  }
}

// Export function for CLI compatibility
export function startServer(options = {}) {
  const server = new CntxServer(options.cwd, { quiet: options.quiet });
  server.init();

  if (options.withMcp) {
    server.startMCPServer();
  }

  return server.listen(options.port, options.host);
}

// CLI Functions for backward compatibility
export function startMCPServer(options = {}) {
  const server = new CntxServer(options.cwd, { quiet: true });
  server.init();
  server.startMCPServer();
  
  // For MCP mode, we don't start the web server, just keep the process alive
  console.log('🔗 MCP server running on stdio...');
}

export async function generateBundle(bundleName = 'master') {
  const server = new CntxServer(process.cwd(), { quiet: true });
  server.init();
  
  await server.bundleManager.regenerateBundle(bundleName);
  const bundleInfo = server.bundleManager.getBundleInfo(bundleName);
  
  if (!bundleInfo) {
    throw new Error(`Bundle '${bundleName}' not found`);
  }
  
  return bundleInfo;
}

export function initConfig() {
  const server = new CntxServer(process.cwd(), { quiet: false });
  
  // Initialize directory structure
  if (!existsSync(server.CNTX_DIR)) {
    mkdirSync(server.CNTX_DIR, { recursive: true });
    console.log('📁 Created .cntx directory');
  }
  
  // Initialize configuration
  server.configManager.loadConfig();
  server.configManager.saveConfig({
    bundles: {
      master: ['**/*']
    }
  });
  
  console.log('⚙️ Configuration initialized');
  console.log('💡 Run "cntx-ui watch" to start the server');
}

export async function getStatus() {
  const server = new CntxServer(process.cwd(), { quiet: true });
  server.init();
  
  const bundles = server.bundleManager.getAllBundleInfo();
  const totalFiles = server.fileSystemManager.getAllFiles().length;
  
  console.log('📊 cntx-ui Status');
  console.log('================');
  console.log(`Total files: ${totalFiles}`);
  console.log(`Bundles: ${bundles.length}`);
  
  bundles.forEach(bundle => {
    console.log(`  • ${bundle.name}: ${bundle.fileCount} files (${Math.round(bundle.size / 1024)}KB)`);
  });
  
  return {
    totalFiles,
    bundles: bundles.length,
    bundleDetails: bundles
  };
}

export function setupMCP() {
  const configPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  const projectPath = process.cwd();
  
  console.log('🔧 Setting up MCP integration...');
  console.log(`Project: ${projectPath}`);
  console.log(`Claude config: ${configPath}`);
  
  try {
    let config = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    }
    
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    config.mcpServers['cntx-ui'] = {
      command: 'node',
      args: [join(projectPath, 'bin', 'cntx-ui.js'), 'mcp'],
      env: {}
    };
    
    // Ensure directory exists
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ MCP integration configured');
    console.log('💡 Restart Claude Desktop to apply changes');
  } catch (error) {
    console.error('❌ Failed to setup MCP:', error.message);
    console.log('💡 You may need to manually add the configuration to Claude Desktop');
  }
}

// Auto-start server when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log('🚀 Starting cntx-ui server...');
  const server = new CntxServer();
  server.init();
  server.listen(3333, 'localhost');
}