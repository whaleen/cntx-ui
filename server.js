/**
 * Refactored cntx-ui Server
 * Lean orchestration layer using modular architecture
 */

import { createServer } from 'http';
import { join, dirname, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// Import our modular components
import ConfigurationManager from './lib/configuration-manager.js';
import DatabaseManager from './lib/database-manager.js';
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
    this.verbose = options.verbose || false;
    this.mcpServerStarted = false;
    this.mcpServer = null;

    // Ensure directory exists early
    if (!existsSync(this.CNTX_DIR)) mkdirSync(this.CNTX_DIR, { recursive: true });

    // Initialize modular components
    this.configManager = new ConfigurationManager(cwd, { verbose: this.verbose });
    this.databaseManager = new DatabaseManager(this.CNTX_DIR, { verbose: this.verbose });
    this.fileSystemManager = new FileSystemManager(cwd, { verbose: this.verbose });
    this.bundleManager = new BundleManager(this.configManager, this.fileSystemManager, this.verbose);
    this.webSocketManager = new WebSocketManager(this.bundleManager, this.configManager, { verbose: this.verbose });

    // Initialize semantic analysis components
    this.semanticSplitter = new SemanticSplitter({
      maxChunkSize: 2000,
      includeContext: true,
      minFunctionSize: 50
    });

    this.vectorStore = new SimpleVectorStore(this.databaseManager, {
      modelName: 'Xenova/all-MiniLM-L6-v2'
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

    // Initialize API router with all managers
    this.apiRouter = new APIRouter(
      this,
      this.configManager,
      this.bundleManager,
      this.fileSystemManager,
      this.semanticAnalysisManager,
      this.vectorStore
    );

    // Add references for cross-module communication
    this.bundleManager.fileSystemManager = this.fileSystemManager;
    this.bundleManager.webSocketManager = this.webSocketManager;
  }

  // === Proxy methods for MCP compatibility ===

  get bundles() {
    return this.configManager.getBundles();
  }

  getAllFiles() {
    return this.fileSystemManager.getAllFiles();
  }

  getFileTree() {
    return this.fileSystemManager.getFileTree();
  }

  generateBundle(name) {
    return this.bundleManager.regenerateBundle(name);
  }

  generateAllBundles() {
    return this.bundleManager.generateAllBundles();
  }

  saveBundleStates() {
    return this.configManager.saveBundleStates();
  }

  loadIgnorePatterns() {
    this.configManager.loadIgnorePatterns();
    this.fileSystemManager.setIgnorePatterns(this.configManager.getIgnorePatterns());
  }

  // === Initialization ===

  async init(options = {}) {
    if (!existsSync(this.CNTX_DIR)) mkdirSync(this.CNTX_DIR, { recursive: true });

    const { skipFileWatcher = false, skipBundleGeneration = false } = options;

    // Step 1: Load configuration
    this.configManager.loadConfig();
    this.configManager.loadHiddenFilesConfig();
    this.configManager.loadIgnorePatterns();
    this.configManager.loadBundleStates();
    console.log('  Configuration loaded');

    if (!skipFileWatcher) {
      // Step 2: Set up file watcher
      this.fileSystemManager.setIgnorePatterns(this.configManager.getIgnorePatterns());
      console.log('  File watcher configured');
    }

    // Step 3: Load semantic cache
    const cacheData = this.configManager.loadSemanticCache();
    if (cacheData) {
      this.semanticCache = cacheData.analysis;
      this.lastSemanticAnalysis = cacheData.timestamp;
      console.log(`  Semantic cache loaded (${this.semanticCache.chunks.length} chunks)`);
    } else {
      console.log('  No semantic cache found (will analyze on first request)');
    }

    if (!skipFileWatcher) {
      // Step 4: Start file watcher
      this.startWatching();
      console.log('  File watcher started');

      // Trigger initial semantic analysis in background if no cache
      if (!this.semanticCache) {
        this.getSemanticAnalysis().catch(err => console.error('Initial semantic analysis failed:', err.message));
      }

      // Step 5: Generate bundles (awaited to prevent race conditions)
      if (!skipBundleGeneration) {
        await this.bundleManager.generateAllBundles();
        console.log('  Bundles generated');
      }
    }
  }

  // Display initialization summary
  displayInitSummary() {
    const summary = [];

    // Add semantic cache info
    if (this.semanticCache) {
      summary.push(`Loaded semantic cache (${this.semanticCache.chunks.length} chunks with embeddings)`);
    }

    // Add ignore patterns info
    const ignorePatterns = this.configManager.getIgnorePatterns();
    if (ignorePatterns.length > 0) {
      summary.push(`Loaded ${ignorePatterns.length} ignore patterns`);
    }

    // Add bundle info
    const bundles = this.bundleManager.getAllBundleInfo();
    if (bundles.length > 0) {
      summary.push(`Generated ${bundles.length} bundles`);
    }

    // Add file watcher info
    summary.push('File watcher started');
    summary.push('WebSocket server initialized');

    // Display summary
    if (summary.length > 0) {
      console.log('Initialization complete:');
      summary.forEach(msg => console.log(`  - ${msg}`));
      console.log('');
    }
  }

  // === File Watching ===

  startWatching() {
    this.fileSystemManager.startWatching(async (eventType, filename) => {
      if (this.verbose) {
        console.log(`File ${eventType}: ${filename}`);
      }

      // Skip processing files in .cntx directory to prevent infinite loops
      if (filename.startsWith('.cntx/')) {
        if (this.verbose) {
          console.log(`Skipping .cntx file: ${filename}`);
        }
        return;
      }

      // Mark affected bundles as changed
      this.bundleManager.markBundlesChanged(filename);

      // Invalidate semantic cache if needed
      this.invalidateSemanticCache();

      // Notify WebSocket clients
      this.webSocketManager.onFileChanged(filename, eventType);

      // Automatically regenerate affected bundles after a short delay
      setTimeout(async () => {
        await this.regenerateChangedBundles(filename);
      }, 1000); // 1 second delay to batch multiple rapid changes
    });
  }

  async regenerateChangedBundles(filename) {
    try {
      const bundles = this.configManager.getBundles();
      const affectedBundles = [];

      // Find which bundles are affected by this file
      bundles.forEach((bundle, name) => {
        const matchesBundle = bundle.patterns.some(pattern =>
          this.fileSystemManager.matchesPattern(filename, pattern)
        );

        if (matchesBundle && bundle.changed) {
          affectedBundles.push(name);
        }
      });

      // Regenerate each affected bundle
      for (const bundleName of affectedBundles) {
        if (this.verbose) {
          console.log(`Auto-regenerating bundle: ${bundleName}`);
        }
        await this.bundleManager.regenerateBundle(bundleName);
      }

    } catch (error) {
      console.error('Failed to auto-regenerate bundles:', error.message);
    }
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
    // Return cached result if available
    if (this.semanticCache) {
      return this.semanticCache;
    }

    // 1. Try to load from SQLite first
    try {
      const dbChunks = this.databaseManager.db.prepare('SELECT * FROM semantic_chunks').all();
      if (dbChunks.length > 0) {
        this.semanticCache = {
          chunks: dbChunks.map(row => this.databaseManager.mapChunkRow(row)),
          summary: { totalChunks: dbChunks.length }
        };
        return this.semanticCache;
      }
    } catch (e) {
      console.warn('Failed to load chunks from SQLite, performing fresh analysis...');
    }

    // 2. Perform fresh analysis if DB is empty
    try {
      const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs'];
      const files = this.fileSystemManager.getAllFiles()
        .filter(f => supportedExtensions.includes(extname(f).toLowerCase()))
        .map(f => relative(this.CWD, f));

      let bundleConfig = null;
      if (existsSync(this.configManager.CONFIG_FILE)) {
        bundleConfig = JSON.parse(readFileSync(this.configManager.CONFIG_FILE, 'utf8'));
      }

      this.semanticCache = await this.semanticSplitter.extractSemanticChunks(this.CWD, files, bundleConfig);
      this.lastSemanticAnalysis = Date.now();

      // 3. Persist chunks to SQLite immediately
      if (this.semanticCache.chunks.length > 0) {
        this.databaseManager.saveChunks(this.semanticCache.chunks);
      }

      // 4. Trigger background embedding enhancement
      this.enhanceSemanticChunksIfNeeded(this.semanticCache).catch(err => {
        console.error('Background embedding enhancement failed:', err.message);
      });

      return this.semanticCache;
    } catch (error) {
      console.error('Semantic analysis failed:', error.message);
      throw new Error(`Semantic analysis failed: ${error.message}`);
    }
  }

  async refreshSemanticAnalysis() {
    console.log('Refreshing semantic analysis and database...');

    // Clear the database table but keep other data
    this.databaseManager.db.prepare('DELETE FROM semantic_chunks').run();
    this.databaseManager.db.prepare('DELETE FROM vector_embeddings').run();

    this.semanticCache = null;
    this.lastSemanticAnalysis = null;

    return this.getSemanticAnalysis();
  }

  async enhanceSemanticChunksIfNeeded(analysis) {
    if (!analysis || !analysis.chunks) return;

    // Check DB for existing embeddings to find only what's missing
    const chunksNeedingEmbeddings = [];
    for (const chunk of analysis.chunks) {
      if (!this.databaseManager.getEmbedding(chunk.id)) {
        chunksNeedingEmbeddings.push(chunk);
      }
    }

    if (chunksNeedingEmbeddings.length === 0) {
      console.log('All chunks already have persistent embeddings');
      return;
    }

    console.log(`Enhancing ${chunksNeedingEmbeddings.length} chunks with persistent embeddings...`);

    // Initialize vector store if needed
    if (!this.vectorStoreInitialized) {
      await this.vectorStore.init();
      this.vectorStoreInitialized = true;
    }

    // Add embeddings to chunks that need them and persist
    for (const chunk of chunksNeedingEmbeddings) {
      try {
        await this.vectorStore.upsertChunk(chunk);
      } catch (error) {
        console.error(`Failed to generate/persist embedding for chunk ${chunk.id}:`, error.message);
      }
    }
    console.log('Background embedding enhancement complete');
  }

  invalidateSemanticCache() {
    this.semanticCache = null;
    this.lastSemanticAnalysis = null;
  }

  async exportSemanticChunk(chunkName) {
    const analysis = await this.getSemanticAnalysis();
    const chunk = analysis.chunks.find(c => c.name === chunkName || c.id === chunkName);

    if (!chunk) {
      throw new Error(`Chunk "${chunkName}" not found`);
    }

    return this.bundleManager.generateFileXML(chunk.filePath);
  }

  // === MCP Server Integration ===

  startMCPServer() {
    if (!this.mcpServer) {
      this.mcpServer = new MCPServer(this);
      this.mcpServerStarted = true;

      if (this.verbose) {
        console.log('MCP server started');
      }
    }
  }

  // === Server Lifecycle ===

  async listen(port = 3333, host = 'localhost') {
    const server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Initialize WebSocket server
    this.webSocketManager.initialize(server);

    // Start server and show progress
    server.listen(port, host, () => {
      console.log('');
      console.log(`Server running at http://${host}:${port}`);
      console.log(`Serving ${this.bundleManager.getAllBundleInfo().length} bundles from your project`);
      console.log('');

      // Display initialization summary
      this.displayInitSummary();
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down server...');
      this.webSocketManager.close();
      this.fileSystemManager.destroy();
      server.close(() => {
        console.log('Server stopped');
        process.exit(0);
      });
    });

    return server;
  }
}

// Auto-init and start: checks for .cntx/, runs initConfig() if missing, then starts server
export async function autoInitAndStart(options = {}) {
  const cwd = options.cwd || process.cwd();
  const cntxDir = join(cwd, '.cntx');

  if (!existsSync(cntxDir)) {
    console.log('No .cntx directory found, initializing...');
    console.log('');
    await initConfig(cwd);
    console.log('');
  }

  return startServer(options);
}

// Export function for CLI compatibility
export async function startServer(options = {}) {
  const server = new CntxServer(options.cwd, { verbose: options.verbose });

  const asciiArt = `
 ██████ ███    ██ ████████ ██   ██       ██    ██ ██
██      ████   ██    ██     ██ ██        ██    ██ ██
██      ██ ██  ██    ██      ███   █████ ██    ██ ██
██      ██  ██ ██    ██     ██ ██        ██    ██ ██
 ██████ ██   ████    ██    ██   ██        ██████  ██
`;
  console.log(asciiArt);

  // Now start initialization
  await server.init();

  // Enable MCP status tracking by default
  const withMcp = options.withMcp !== false;
  if (withMcp) {
    server.startMCPServer();
  }

  return await server.listen(options.port, options.host);
}

// CLI Functions for backward compatibility
export async function startMCPServer(options = {}) {
  const server = new CntxServer(options.cwd, { verbose: true });
  await server.init();
  server.startMCPServer();

  // For MCP mode, we don't start the web server, just keep the process alive
  console.log('MCP server running on stdio...');
}

export async function generateBundle(bundleName = 'master') {
  const server = new CntxServer(process.cwd(), { verbose: true });
  await server.init({ skipFileWatcher: true });

  await server.bundleManager.regenerateBundle(bundleName);
  const bundleInfo = server.bundleManager.getBundleInfo(bundleName);

  if (!bundleInfo) {
    throw new Error(`Bundle '${bundleName}' not found`);
  }

  return bundleInfo;
}

// Initialize project configuration
export async function initConfig(cwd = process.cwd()) {
  const server = new CntxServer(cwd);

  // 1. Initialize directory structure
  if (!existsSync(server.CNTX_DIR)) {
    mkdirSync(server.CNTX_DIR, { recursive: true });
    console.log('Created .cntx directory');
  }

  // 2. Create .mcp.json for Claude Code discovery
  const mcpConfigPath = join(cwd, '.mcp.json');
  const mcpConfig = {
    mcpServers: {
      "cntx-ui": {
        command: "cntx-ui",
        args: ["mcp"],
        cwd: "."
      }
    }
  };
  writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
  console.log('Created .mcp.json for MCP auto-discovery');

  // 3. Initialize basic configuration with better defaults and auto-suggestions
  server.configManager.loadConfig();

  const suggestedBundles = {
    master: ['**/*']
  };

  // Directory-based auto-suggestions
  const commonDirs = [
    { dir: 'src/components', name: 'ui-components' },
    { dir: 'src/services', name: 'services' },
    { dir: 'src/lib', name: 'libraries' },
    { dir: 'src/hooks', name: 'react-hooks' },
    { dir: 'server', name: 'backend-api' },
    { dir: 'tests', name: 'test-suite' }
  ];

  commonDirs.forEach(d => {
    if (existsSync(join(cwd, d.dir))) {
      suggestedBundles[d.name] = [`${d.dir}/**`];
      console.log(`  Suggested bundle: ${d.name} (${d.dir}/**)`);
    }
  });

  server.configManager.saveConfig({
    bundles: suggestedBundles
  });

  // 4. Create robust default .cntxignore
  const ignorePath = join(cwd, '.cntxignore');
  if (!existsSync(ignorePath)) {
    const defaultIgnore = `# Binary files
*.db
*.db-journal
*.png
*.jpg
*.jpeg
*.ico
*.icns
*.gif
*.zip
*.tar.gz

# Generated files
**/gen/**
**/dist/**
**/build/**
**/node_modules/**
**/.next/**
**/.cache/**

# cntx-ui internals
.cntx/**
.mcp.json
`;
    writeFileSync(ignorePath, defaultIgnore, 'utf8');
    console.log('Created .cntxignore with smart defaults');
  }

  console.log('Configuration initialized');
}

export async function getStatus() {
  const server = new CntxServer(process.cwd(), { verbose: true });
  await server.init({ skipFileWatcher: true });

  const bundles = server.bundleManager.getAllBundleInfo();
  const totalFiles = server.fileSystemManager.getAllFiles().length;

  console.log('cntx-ui Status');
  console.log('================');
  console.log(`Total files: ${totalFiles}`);
  console.log(`Bundles: ${bundles.length}`);

  bundles.forEach(bundle => {
    console.log(`  - ${bundle.name}: ${bundle.fileCount} files (${Math.round(bundle.size / 1024)}KB)`);
  });

  return {
    totalFiles,
    bundles: bundles.length,
    bundleDetails: bundles
  };
}

// Auto-start server when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log('Starting cntx-ui server...');
  const server = new CntxServer();
  server.init();
  server.listen(3333, 'localhost');
}
