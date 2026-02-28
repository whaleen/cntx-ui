/**
 * API Router for cntx-ui
 * Handles all HTTP API endpoints and request routing
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path, { join } from 'path';
export default class APIRouter {
    cntxServer;
    configManager;
    bundleManager;
    fileSystemManager;
    semanticAnalysisManager;
    vectorStore;
    activityManager;
    constructor(cntxServer, configManager, bundleManager, fileSystemManager, semanticAnalysisManager, vectorStore, activityManager) {
        this.cntxServer = cntxServer;
        this.configManager = configManager;
        this.bundleManager = bundleManager;
        this.fileSystemManager = fileSystemManager;
        this.semanticAnalysisManager = semanticAnalysisManager;
        this.vectorStore = vectorStore;
        this.activityManager = activityManager;
    }
    async handleRequest(req, res, url) {
        const { pathname } = url;
        const method = req.method;
        try {
            // === Bundle Endpoints ===
            if (pathname === '/api/bundles' && method === 'GET') {
                return await this.handleGetBundles(req, res, url);
            }
            if (pathname === '/api/bundles' && method === 'POST') {
                return await this.handlePostBundles(req, res);
            }
            if (pathname.startsWith('/api/bundles/') && method === 'GET') {
                const bundleName = pathname.split('/')[3];
                return await this.handleGetBundle(req, res, bundleName);
            }
            if (pathname.startsWith('/api/regenerate/') && (method === 'GET' || method === 'POST')) {
                const bundleName = pathname.split('/')[3];
                return await this.handleRegenerateBundle(req, res, bundleName);
            }
            // === File Endpoints ===
            if (pathname === '/api/files' && method === 'GET') {
                return await this.handleGetFiles(req, res);
            }
            if (pathname.startsWith('/api/files/') && method === 'GET') {
                const filePath = pathname.substring(11); // Remove /api/files/
                return await this.handleGetFile(req, res, filePath);
            }
            if (pathname === '/api/open-file' && method === 'POST') {
                return await this.handlePostOpenFile(req, res);
            }
            // === Configuration Endpoints ===
            if (pathname === '/api/config' && method === 'GET') {
                return await this.handleGetConfig(req, res);
            }
            if (pathname === '/api/config' && method === 'POST') {
                return await this.handlePostConfig(req, res);
            }
            if (pathname === '/api/cntxignore' && method === 'GET') {
                return await this.handleGetCntxignore(req, res);
            }
            if (pathname === '/api/cntxignore' && method === 'POST') {
                return await this.handlePostCntxignore(req, res);
            }
            // === Semantic Analysis Endpoints ===
            if (pathname === '/api/semantic-chunks' && method === 'GET') {
                return await this.handleGetSemanticChunks(req, res, url);
            }
            if (pathname === '/api/semantic-search' && method === 'POST') {
                return await this.handlePostSemanticSearch(req, res);
            }
            // === Vector DB Endpoints ===
            if (pathname === '/api/vector-db/status' && method === 'GET') {
                return await this.handleGetVectorDbStatus(req, res);
            }
            if (pathname === '/api/vector-db/rebuild' && method === 'POST') {
                return await this.handlePostVectorDbRebuild(req, res);
            }
            if (pathname === '/api/vector-db/search' && method === 'POST') {
                return await this.handlePostVectorDbSearch(req, res);
            }
            if (pathname === '/api/vector-db/network' && method === 'GET') {
                return await this.handleGetVectorDbNetwork(req, res);
            }
            // === Database Endpoints ===
            if (pathname === '/api/database/info' && method === 'GET') {
                return await this.handleGetDatabaseInfo(req, res);
            }
            if (pathname === '/api/database/query' && method === 'POST') {
                return await this.handlePostDatabaseQuery(req, res);
            }
            // === Activity Endpoints ===
            if (pathname === '/api/activities' && method === 'GET') {
                return await this.handleGetActivities(req, res);
            }
            if (pathname.startsWith('/api/activities/') && pathname.endsWith('/reasoning') && method === 'GET') {
                const activityId = pathname.split('/')[3];
                return await this.handleGetActivityReasoning(req, res, activityId);
            }
            // === Status & MCP ===
            if (pathname === '/api/status' && method === 'GET') {
                return await this.handleGetStatus(req, res);
            }
            if (pathname === '/api/mcp-status' && method === 'GET') {
                return await this.handleGetMcpStatus(req, res);
            }
            // === Artifact Endpoints ===
            if (pathname === '/api/artifacts' && method === 'GET') {
                return await this.handleGetArtifacts(req, res);
            }
            if (pathname === '/api/artifacts/openapi' && method === 'GET') {
                return await this.handleGetArtifact(req, res, 'openapi');
            }
            if (pathname === '/api/artifacts/navigation' && method === 'GET') {
                return await this.handleGetArtifact(req, res, 'navigation');
            }
            // === Rule Management ===
            if (pathname === '/api/cursor-rules' && method === 'GET') {
                return await this.handleGetCursorRules(req, res);
            }
            if (pathname === '/api/cursor-rules' && method === 'POST') {
                return await this.handlePostCursorRules(req, res);
            }
            if (pathname === '/api/claude-md' && method === 'GET') {
                return await this.handleGetClaudeMd(req, res);
            }
            if (pathname === '/api/claude-md' && method === 'POST') {
                return await this.handlePostClaudeMd(req, res);
            }
            // 404 for unknown API routes
            this.sendError(res, 404, `API endpoint not found: ${method} ${pathname}`);
        }
        catch (error) {
            console.error(`API Error: ${error.message}`);
            this.sendError(res, 500, error.message);
        }
    }
    // === Helper Methods ===
    sendResponse(res, status, data) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
    sendError(res, status, message) {
        this.sendResponse(res, status, { error: message });
    }
    async getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => { resolve(body); });
            req.on('error', reject);
        });
    }
    // === Handlers ===
    async handleGetBundles(req, res, url) {
        try {
            const bundleInfo = this.bundleManager.getAllBundleInfo();
            this.sendResponse(res, 200, bundleInfo);
        }
        catch (error) {
            this.sendError(res, 500, error.message);
        }
    }
    async handlePostBundles(req, res) {
        const body = await this.getRequestBody(req);
        const { action, bundleName, fileName, fileNames } = JSON.parse(body);
        if (!action || !bundleName) {
            return this.sendError(res, 400, 'Missing required fields: action and bundleName');
        }
        const bundles = this.configManager.getBundles();
        const bundle = bundles.get(bundleName);
        if (!bundle) {
            return this.sendError(res, 404, `Bundle not found: ${bundleName}`);
        }
        switch (action) {
            case 'add-file':
                if (!fileName)
                    return this.sendError(res, 400, 'Missing fileName');
                const relAdd = fileName.startsWith('/') ? path.relative(this.configManager.CWD, fileName) : fileName;
                if (!bundle.files.includes(relAdd)) {
                    bundle.files.push(relAdd);
                    bundle.changed = true;
                    this.configManager.saveBundleStates();
                }
                break;
            case 'remove-file':
                if (!fileName)
                    return this.sendError(res, 400, 'Missing fileName');
                const relRem = fileName.startsWith('/') ? path.relative(this.configManager.CWD, fileName) : fileName;
                const idx = bundle.files.indexOf(relRem);
                if (idx > -1) {
                    bundle.files.splice(idx, 1);
                    bundle.changed = true;
                    this.configManager.saveBundleStates();
                }
                break;
        }
        this.sendResponse(res, 200, { success: true });
    }
    async handleGetBundle(req, res, bundleName) {
        const content = await this.bundleManager.getBundleContent(bundleName);
        if (content === null)
            return this.sendError(res, 404, 'Bundle not found');
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(content);
    }
    async handleRegenerateBundle(req, res, bundleName) {
        await this.bundleManager.regenerateBundle(bundleName);
        this.sendResponse(res, 200, { success: true });
    }
    async handleGetFiles(req, res) {
        const files = this.fileSystemManager.getFileTree();
        this.sendResponse(res, 200, files);
    }
    async handleGetFile(req, res, filePath) {
        const fullPath = this.fileSystemManager.fullPath(filePath);
        if (!existsSync(fullPath))
            return this.sendError(res, 404, 'File not found');
        const content = readFileSync(fullPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(content);
    }
    async handlePostOpenFile(req, res) {
        const body = await this.getRequestBody(req);
        const { filePath, line } = JSON.parse(body);
        // Simple mock for opening in editor
        console.log(`Editor requested for ${filePath}:${line || 1}`);
        this.sendResponse(res, 200, { success: true });
    }
    async handleGetConfig(req, res) {
        const config = this.configManager.loadConfig();
        this.sendResponse(res, 200, config);
    }
    async handlePostConfig(req, res) {
        const body = await this.getRequestBody(req);
        this.configManager.saveConfig(JSON.parse(body));
        this.sendResponse(res, 200, { success: true });
    }
    async handleGetCntxignore(req, res) {
        if (existsSync(this.configManager.IGNORE_FILE)) {
            const content = readFileSync(this.configManager.IGNORE_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(content);
        }
        else {
            res.end('');
        }
    }
    async handlePostCntxignore(req, res) {
        const body = await this.getRequestBody(req);
        const { content } = JSON.parse(body);
        const success = this.configManager.saveCntxignore(content);
        if (!success)
            return this.sendError(res, 500, 'Failed to save .cntxignore');
        this.fileSystemManager.setIgnorePatterns(this.configManager.ignorePatterns);
        this.sendResponse(res, 200, { success: true });
    }
    async handleGetSemanticChunks(req, res, url) {
        const refresh = url.query?.refresh === 'true';
        let analysis;
        if (refresh) {
            analysis = await this.cntxServer.refreshSemanticAnalysis();
        }
        else {
            analysis = await this.cntxServer.getSemanticAnalysis();
        }
        const chunks = analysis.chunks.map((chunk) => ({
            id: chunk.id || chunk.name,
            name: chunk.name,
            code: chunk.code,
            semanticType: chunk.subtype || chunk.type,
            businessDomain: chunk.businessDomain || [],
            technicalPatterns: chunk.technicalPatterns || [],
            purpose: chunk.purpose || '',
            filePath: chunk.filePath,
            complexity: chunk.complexity || { score: 0, level: 'low' },
            tags: chunk.tags || [],
            startLine: chunk.startLine
        }));
        this.sendResponse(res, 200, { summary: analysis.summary, chunks });
    }
    async handlePostSemanticSearch(req, res) {
        const body = await this.getRequestBody(req);
        const { query, limit = 20 } = JSON.parse(body);
        const results = await this.vectorStore.search(query, { limit });
        this.sendResponse(res, 200, { results });
    }
    async handleGetVectorDbStatus(req, res) {
        const info = this.configManager.dbManager.getInfo();
        this.sendResponse(res, 200, {
            stats: {
                totalChunks: info.chunkCount,
                embeddingCount: info.embeddingCount,
                modelName: this.vectorStore.modelName
            }
        });
    }
    async handlePostVectorDbRebuild(req, res) {
        const analysis = await this.cntxServer.getSemanticAnalysis();
        for (const chunk of analysis.chunks) {
            await this.vectorStore.upsertChunk(chunk);
        }
        const info = this.configManager.dbManager.getInfo();
        this.sendResponse(res, 200, { success: true, embeddingCount: info.embeddingCount });
    }
    async handlePostVectorDbSearch(req, res) {
        const body = await this.getRequestBody(req);
        const { query, limit = 10 } = JSON.parse(body);
        const results = await this.vectorStore.search(query, { limit });
        this.sendResponse(res, 200, results);
    }
    async handleGetVectorDbNetwork(req, res) {
        const chunks = this.configManager.dbManager.db.prepare('SELECT * FROM semantic_chunks').all();
        const embeddings = this.configManager.dbManager.db.prepare('SELECT * FROM vector_embeddings').all();
        const nodes = chunks.map(c => this.configManager.dbManager.mapChunkRow(c)).slice(0, 100);
        const edges = [];
        // Simple pairwise similarity
        this.sendResponse(res, 200, { nodes, edges });
    }
    async handleGetDatabaseInfo(req, res) {
        const info = this.configManager.dbManager.getInfo();
        this.sendResponse(res, 200, info);
    }
    async handlePostDatabaseQuery(req, res) {
        const body = await this.getRequestBody(req);
        const { query } = JSON.parse(body);
        const results = this.configManager.dbManager.query(query);
        this.sendResponse(res, 200, { results });
    }
    async handleGetActivities(req, res) {
        const activities = await this.activityManager.loadActivities();
        this.sendResponse(res, 200, activities);
    }
    async handleGetActivityReasoning(req, res, activityId) {
        const history = this.configManager.dbManager.getSessionHistory(activityId);
        this.sendResponse(res, 200, { history });
    }
    async handleGetStatus(req, res) {
        const bundles = this.bundleManager.getAllBundleInfo();
        this.sendResponse(res, 200, {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            bundles,
            scanning: this.bundleManager.isScanning,
            totalFiles: this.fileSystemManager.getAllFiles().length,
            mcp: {
                enabled: this.cntxServer.mcpServerStarted,
                available: true
            }
        });
    }
    async handleGetMcpStatus(req, res) {
        const isRunning = this.cntxServer.mcpServerStarted;
        this.sendResponse(res, 200, {
            enabled: isRunning,
            running: isRunning,
            available: true,
            message: isRunning ? 'MCP server is running' : 'MCP server integration available'
        });
    }
    async handleGetArtifacts(req, res) {
        const artifacts = this.cntxServer.artifactManager.refresh();
        this.sendResponse(res, 200, { artifacts });
    }
    async handleGetArtifact(req, res, type) {
        this.cntxServer.artifactManager.refresh();
        const payload = this.cntxServer.artifactManager.getPayload(type);
        this.sendResponse(res, 200, payload);
    }
    async handleGetCursorRules(req, res) {
        const filePath = join(this.configManager.CWD, '.cursorrules');
        if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(content);
        }
        else {
            res.end('');
        }
    }
    async handlePostCursorRules(req, res) {
        const body = await this.getRequestBody(req);
        const { content } = JSON.parse(body);
        writeFileSync(join(this.configManager.CWD, '.cursorrules'), content, 'utf8');
        this.sendResponse(res, 200, { success: true });
    }
    async handleGetClaudeMd(req, res) {
        const filePath = join(this.configManager.CWD, 'CLAUDE.md');
        if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(content);
        }
        else {
            res.end('');
        }
    }
    async handlePostClaudeMd(req, res) {
        const body = await this.getRequestBody(req);
        const { content } = JSON.parse(body);
        writeFileSync(join(this.configManager.CWD, 'CLAUDE.md'), content, 'utf8');
        this.sendResponse(res, 200, { success: true });
    }
}
