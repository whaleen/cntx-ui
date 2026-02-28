/**
 * Refactored cntx-ui Server
 * Lean orchestration layer using modular architecture
 */
import { createServer } from 'http';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath, parse } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync } from 'fs';
import { homedir } from 'os';
// Import our modular components
import ConfigurationManager from './lib/configuration-manager.js';
import FileSystemManager from './lib/file-system-manager.js';
import BundleManager from './lib/bundle-manager.js';
import APIRouter from './lib/api-router.js';
import WebSocketManager from './lib/websocket-manager.js';
// Import existing lib modules
import SemanticSplitter from './lib/semantic-splitter.js';
import SimpleVectorStore from './lib/simple-vector-store.js';
import { MCPServer } from './lib/mcp-server.js';
import AgentRuntime from './lib/agent-runtime.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
function getProjectName(cwd) {
    const packageJsonPath = join(cwd, 'package.json');
    if (existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
            if (typeof packageJson?.name === 'string' && packageJson.name.trim()) {
                return packageJson.name.trim();
            }
        }
        catch {
            // Fall through to directory name
        }
    }
    return basename(cwd);
}
export class CntxServer {
    CWD;
    CNTX_DIR;
    verbose;
    mcpServerStarted;
    mcpServer;
    initMessages;
    configManager;
    databaseManager;
    fileSystemManager;
    bundleManager;
    webSocketManager;
    apiRouter;
    semanticSplitter;
    vectorStore;
    agentRuntime;
    semanticCache;
    lastSemanticAnalysis;
    vectorStoreInitialized;
    semanticAnalysisManager;
    activityManager;
    constructor(cwd = process.cwd(), options = {}) {
        this.CWD = cwd;
        this.CNTX_DIR = join(cwd, '.cntx');
        this.verbose = options.verbose || false;
        this.mcpServerStarted = false;
        this.mcpServer = null;
        this.initMessages = [];
        // Ensure directory exists
        if (!existsSync(this.CNTX_DIR))
            mkdirSync(this.CNTX_DIR, { recursive: true });
        // Initialize modular components
        this.configManager = new ConfigurationManager(cwd, { verbose: this.verbose });
        this.databaseManager = this.configManager.dbManager;
        this.fileSystemManager = new FileSystemManager(cwd, { verbose: this.verbose });
        this.bundleManager = new BundleManager(this.configManager, this.fileSystemManager, this.verbose);
        this.webSocketManager = new WebSocketManager(this.bundleManager, this.configManager, { verbose: this.verbose });
        // AI Components
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
        // Initialize Agent Runtime
        this.agentRuntime = new AgentRuntime(this);
        this.semanticAnalysisManager = this; // Self as manager
        this.activityManager = this; // Simple mock for now
        // Initialize API router
        this.apiRouter = new APIRouter(this, this.configManager, this.bundleManager, this.fileSystemManager, this.semanticAnalysisManager, this.vectorStore, this.activityManager);
        // Cross-module linkage
        this.bundleManager.fileSystemManager = this.fileSystemManager;
        this.bundleManager.webSocketManager = this.webSocketManager;
    }
    async init(options = {}) {
        const { skipFileWatcher = false, skipBundleGeneration = false } = options;
        // Load configs
        this.configManager.loadConfig();
        this.configManager.loadHiddenFilesConfig();
        this.configManager.loadIgnorePatterns();
        this.configManager.loadBundleStates();
        if (!skipFileWatcher) {
            this.startWatching();
            // Trigger semantic analysis
            if (!this.semanticCache) {
                this.getSemanticAnalysis().catch(err => console.error('Initial semantic analysis failed:', err.message));
            }
            if (!skipBundleGeneration) {
                await this.bundleManager.generateAllBundles();
            }
        }
        // Load reasoning/manifest
        await this.agentRuntime.generateAgentManifest();
    }
    startWatching() {
        this.fileSystemManager.startWatching((eventType, filename) => {
            this.bundleManager.markBundlesChanged(filename);
            this.webSocketManager.onFileChanged(filename, eventType);
        });
    }
    async getSemanticAnalysis() {
        // Try SQLite first
        try {
            const dbChunks = this.databaseManager.db.prepare('SELECT * FROM semantic_chunks').all();
            if (dbChunks.length > 0) {
                if (!this.semanticCache) {
                    this.semanticCache = {
                        chunks: dbChunks.map(row => this.databaseManager.mapChunkRow(row)),
                        summary: { totalChunks: dbChunks.length }
                    };
                }
                return this.semanticCache;
            }
        }
        catch (e) { }
        // Fresh analysis
        const files = this.fileSystemManager.getAllFiles().map(f => this.fileSystemManager.relativePath(f))
            .filter(f => ['.js', '.jsx', '.ts', '.tsx', '.rs'].includes(extname(f).toLowerCase()));
        let bundleConfig = null;
        if (existsSync(this.configManager.CONFIG_FILE)) {
            bundleConfig = JSON.parse(readFileSync(this.configManager.CONFIG_FILE, 'utf8'));
        }
        this.semanticCache = await this.semanticSplitter.extractSemanticChunks(this.CWD, files, bundleConfig);
        this.lastSemanticAnalysis = Date.now();
        if (this.semanticCache.chunks.length > 0) {
            this.databaseManager.saveChunks(this.semanticCache.chunks);
        }
        this.enhanceSemanticChunksIfNeeded(this.semanticCache);
        return this.semanticCache;
    }
    async enhanceSemanticChunksIfNeeded(analysis) {
        if (!analysis || !analysis.chunks)
            return;
        if (!this.vectorStoreInitialized) {
            await this.vectorStore.init();
            this.vectorStoreInitialized = true;
        }
        for (const chunk of analysis.chunks) {
            if (!this.databaseManager.getEmbedding(chunk.id)) {
                await this.vectorStore.upsertChunk(chunk);
            }
        }
    }
    async refreshSemanticAnalysis() {
        this.databaseManager.db.prepare('DELETE FROM semantic_chunks').run();
        this.databaseManager.db.prepare('DELETE FROM vector_embeddings').run();
        this.semanticCache = null;
        return this.getSemanticAnalysis();
    }
    startMCPServer() {
        if (!this.mcpServer) {
            this.mcpServer = new MCPServer(this);
            this.mcpServerStarted = true;
        }
    }
    async listen(port = 3333, host = 'localhost') {
        const server = createServer((req, res) => {
            const url = parse(req.url || '/', true);
            // Serve static files from web/dist
            if (!url.pathname?.startsWith('/api/')) {
                return this.handleStaticFile(req, res, url);
            }
            // Route API requests
            this.apiRouter.handleRequest(req, res, url);
        });
        this.webSocketManager.initialize(server);
        return new Promise((resolve) => {
            server.listen(port, host, () => {
                console.log(`🚀 cntx-ui server running at http://${host}:${port}`);
                resolve(server);
            });
        });
    }
    handleStaticFile(req, res, url) {
        const webDir = join(__dirname, 'web/dist');
        let filePath = join(webDir, url.pathname === '/' ? 'index.html' : url.pathname);
        if (!existsSync(filePath)) {
            filePath = join(webDir, 'index.html');
        }
        try {
            const content = readFileSync(filePath);
            const ext = extname(filePath).toLowerCase();
            const contentType = this.getContentType(ext);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
        catch (e) {
            res.writeHead(404);
            res.end('Not Found');
        }
    }
    getContentType(ext) {
        const types = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };
        return types[ext] || 'text/plain';
    }
    // Activity Manager Mock
    async loadActivities() {
        return [];
    }
}
export async function startServer(options = {}) {
    const server = new CntxServer(options.cwd, options);
    await server.init(options);
    if (options.withMcp !== false)
        server.startMCPServer();
    return await server.listen(options.port, options.host);
}
// Initialize project configuration
export async function initConfig(cwd = process.cwd()) {
    const server = new CntxServer(cwd);
    // 1. Initialize directory structure
    if (!existsSync(server.CNTX_DIR)) {
        mkdirSync(server.CNTX_DIR, { recursive: true });
        console.log('📁 Created .cntx directory');
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
    console.log('📄 Created .mcp.json for agent auto-discovery');
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
            console.log(`💡 Suggested bundle: ${d.name} (${d.dir}/**)`);
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
        console.log('📄 Created .cntxignore with smart defaults');
    }
    console.log('⚙️ Basic configuration initialized');
    let templateDir = join(__dirname, 'templates');
    if (!existsSync(templateDir)) {
        // Fallback for dist/ context
        templateDir = join(__dirname, '..', 'templates');
    }
    const projectName = getProjectName(cwd);
    // Copy agent configuration files
    const agentFiles = [
        'agent-config.yaml',
        'agent-instructions.md'
    ];
    for (const file of agentFiles) {
        const sourcePath = join(templateDir, file);
        const destPath = join(server.CNTX_DIR, file);
        if (existsSync(sourcePath) && !existsSync(destPath)) {
            if (file === 'agent-config.yaml') {
                const template = readFileSync(sourcePath, 'utf8');
                const updated = template.replace(/^project:\s*["'].*?["']\s*$/m, `project: "${projectName}"`);
                writeFileSync(destPath, updated, 'utf8');
            }
            else {
                copyFileSync(sourcePath, destPath);
            }
            console.log(`📄 Created ${file}`);
        }
    }
    // Copy agent-rules directory structure
    const agentRulesSource = join(templateDir, 'agent-rules');
    const agentRulesDest = join(server.CNTX_DIR, 'agent-rules');
    if (existsSync(agentRulesSource) && !existsSync(agentRulesDest)) {
        cpSync(agentRulesSource, agentRulesDest, { recursive: true });
        console.log('📁 Created agent-rules directory with templates');
    }
    return server.initMessages;
}
export async function generateBundle(name) {
    const server = new CntxServer(process.cwd());
    await server.init({ skipFileWatcher: true });
    return await server.bundleManager.regenerateBundle(name);
}
export async function getStatus() {
    const server = new CntxServer(process.cwd());
    await server.init({ skipFileWatcher: true });
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
            command: 'npx',
            args: ['cntx-ui', 'mcp'],
            cwd: projectPath
        };
        // Ensure directory exists
        mkdirSync(dirname(configPath), { recursive: true });
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('✅ MCP integration configured');
        console.log('💡 Restart Claude Desktop to apply changes');
    }
    catch (error) {
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
