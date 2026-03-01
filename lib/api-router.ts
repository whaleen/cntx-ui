/**
 * API Router for cntx-ui
 * Handles all HTTP API endpoints and request routing
 */

import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import fs, { readFileSync, writeFileSync, existsSync } from 'fs';
import path, { join, relative, extname, dirname } from 'path';
import ConfigurationManager from './configuration-manager.js';
import BundleManager from './bundle-manager.js';
import FileSystemManager from './file-system-manager.js';
import SimpleVectorStore from './simple-vector-store.js';

export default class APIRouter {
  cwd: string;
  configManager: ConfigurationManager;
  bundleManager: BundleManager;
  fileSystemManager: FileSystemManager;
  semanticAnalysisManager: any;
  vectorStore: SimpleVectorStore;
  activityManager: any;
  artifactManager: any;
  mcpEnabled: boolean = false;

  constructor(cwd: string, configManager: ConfigurationManager, bundleManager: BundleManager, fileSystemManager: FileSystemManager, semanticAnalysisManager: any, vectorStore: SimpleVectorStore, activityManager: any, artifactManager: any) {
    this.cwd = cwd;
    this.configManager = configManager;
    this.bundleManager = bundleManager;
    this.fileSystemManager = fileSystemManager;
    this.semanticAnalysisManager = semanticAnalysisManager;
    this.vectorStore = vectorStore;
    this.activityManager = activityManager;
    this.artifactManager = artifactManager;
  }

  setMcpEnabled(enabled: boolean) {
    this.mcpEnabled = enabled;
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, url: any) {
    const { pathname } = url;
    const method = req.method;

    try {
      // === Bundle Endpoints ===
      if (pathname === '/api/bundles' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
        return await this.handleGetBundles(req, res, url);
      }

      if (pathname === '/api/bundles' && method === 'POST') {
        return await this.handlePostBundles(req, res);
      }

      if (pathname.startsWith('/api/bundles/') && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
        const bundleName = pathname.split('/')[3];
        return await this.handleGetBundle(req, res, bundleName);
      }

      if (pathname.startsWith('/api/regenerate/') && (method === 'GET' || method === 'POST')) {
        const bundleName = pathname.split('/')[3];
        return await this.handleRegenerateBundle(req, res, bundleName);
      }

      // === File Endpoints ===
      if (pathname === '/api/files' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
        return await this.handleGetFiles(req, res);
      }

      if (pathname.startsWith('/api/files/') && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
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

      if (pathname === '/api/vector-db/projection' && method === 'GET') {
        return await this.handleGetVectorDbProjection(req, res);
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
      if (pathname === '/api/status' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
        return await this.handleGetStatus(req, res);
      }

      if (pathname === '/api/mcp-status' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
        return await this.handleGetMcpStatus(req, res);
      }

      // === Artifact Endpoints ===
      if (pathname === '/api/artifacts' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
        return await this.handleGetArtifacts(req, res);
      }

      if (pathname === '/api/artifacts/openapi' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
        return await this.handleGetArtifact(req, res, 'openapi');
      }

      if (pathname === '/api/artifacts/navigation' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
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
    } catch (error: any) {
      console.error(`API Error: ${error.message}`);
      this.sendError(res, 500, error.message);
    }
  }

  // === Helper Methods ===

  sendResponse(res: ServerResponse, status: number, data: any) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  sendError(res: ServerResponse, status: number, message: string) {
    this.sendResponse(res, status, { error: message });
  }

  async getRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => { resolve(body); });
      req.on('error', reject);
    });
  }

  // === Handlers ===

  async handleGetBundles(req: IncomingMessage, res: ServerResponse, url: any) {
    try {
      const bundleInfo = this.bundleManager.getAllBundleInfo();
      this.sendResponse(res, 200, bundleInfo);
    } catch (error: any) {
      this.sendError(res, 500, error.message);
    }
  }

  async handlePostBundles(req: IncomingMessage, res: ServerResponse) {
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
        if (!fileName) return this.sendError(res, 400, 'Missing fileName');
        const relAdd = fileName.startsWith('/') ? path.relative(this.configManager.CWD, fileName) : fileName;
        if (!bundle.files.includes(relAdd)) {
          bundle.files.push(relAdd);
          bundle.changed = true;
          this.configManager.saveBundleStates();
        }
        break;

      case 'remove-file':
        if (!fileName) return this.sendError(res, 400, 'Missing fileName');
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

  async handleGetBundle(req: IncomingMessage, res: ServerResponse, bundleName: string) {
    const content = await this.bundleManager.getBundleContent(bundleName);
    if (content === null) return this.sendError(res, 404, 'Bundle not found');
    
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(content);
  }

  async handleRegenerateBundle(req: IncomingMessage, res: ServerResponse, bundleName: string) {
    await this.bundleManager.regenerateBundle(bundleName);
    this.sendResponse(res, 200, { success: true });
  }

  async handleGetFiles(req: IncomingMessage, res: ServerResponse) {
    const files = this.fileSystemManager.getFileTree();
    this.sendResponse(res, 200, files);
  }

  async handleGetFile(req: IncomingMessage, res: ServerResponse, filePath: string) {
    const fullPath = this.fileSystemManager.fullPath(filePath);
    if (!existsSync(fullPath)) return this.sendError(res, 404, 'File not found');
    
    const content = readFileSync(fullPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(content);
  }

  async handlePostOpenFile(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    const { filePath, line } = JSON.parse(body);
    // Simple mock for opening in editor
    console.log(`Editor requested for ${filePath}:${line || 1}`);
    this.sendResponse(res, 200, { success: true });
  }

  async handleGetConfig(req: IncomingMessage, res: ServerResponse) {
    const config = this.configManager.loadConfig();
    this.sendResponse(res, 200, config);
  }

  async handlePostConfig(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    this.configManager.saveConfig(JSON.parse(body));
    this.sendResponse(res, 200, { success: true });
  }

  async handleGetCntxignore(req: IncomingMessage, res: ServerResponse) {
    if (existsSync(this.configManager.IGNORE_FILE)) {
      const content = readFileSync(this.configManager.IGNORE_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
    } else {
      res.end('');
    }
  }

  async handlePostCntxignore(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    const { content } = JSON.parse(body);
    const success = this.configManager.saveCntxignore(content);
    if (!success) return this.sendError(res, 500, 'Failed to save .cntxignore');
    this.fileSystemManager.setIgnorePatterns(this.configManager.ignorePatterns);
    this.sendResponse(res, 200, { success: true });
  }

  async handleGetSemanticChunks(req: IncomingMessage, res: ServerResponse, url: any) {
    const refresh = url.query?.refresh === 'true';
    let analysis;
    if (refresh) {
      analysis = await this.semanticAnalysisManager.refreshSemanticAnalysis();
    } else {
      analysis = await this.semanticAnalysisManager.getSemanticAnalysis();
    }

    const chunks = analysis.chunks.map((chunk: any) => ({
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

  async handlePostSemanticSearch(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    const { query, question, limit = 20 } = JSON.parse(body);
    const searchTerm = query || question;
    
    if (!searchTerm) {
      return this.sendError(res, 400, 'Missing search term (query or question)');
    }

    const results = await this.vectorStore.search(searchTerm, { limit });
    this.sendResponse(res, 200, { results });
  }

  async handleGetVectorDbStatus(req: IncomingMessage, res: ServerResponse) {
    const info = this.configManager.dbManager.getInfo() as any;
    this.sendResponse(res, 200, {
      stats: {
        totalChunks: info.chunkCount,
        embeddingCount: info.embeddingCount,
        modelName: this.vectorStore.modelName
      }
    });
  }

  async handlePostVectorDbRebuild(req: IncomingMessage, res: ServerResponse) {
    const analysis = await this.semanticAnalysisManager.getSemanticAnalysis();
    for (const chunk of analysis.chunks) {
      await this.vectorStore.upsertChunk(chunk);
    }
    const info = this.configManager.dbManager.getInfo() as any;
    this.sendResponse(res, 200, { success: true, embeddingCount: info.embeddingCount });
  }

  async handlePostVectorDbSearch(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    const { query, limit = 10 } = JSON.parse(body);
    const results = await this.vectorStore.search(query, { limit });
    this.sendResponse(res, 200, results);
  }

  async handleGetVectorDbProjection(req: IncomingMessage, res: ServerResponse) {
    const dbManager = this.configManager.dbManager;
    const embeddingCountRow = dbManager.db.prepare('SELECT COUNT(*) as count FROM vector_embeddings').get() as { count: number };
    const currentEmbeddingCount = embeddingCountRow.count;

    if (currentEmbeddingCount === 0) {
      return this.sendResponse(res, 200, {
        points: [],
        meta: { totalPoints: 0, embeddingCount: 0, computedAt: null, cached: false }
      });
    }

    // Check cache freshness
    const cachedCount = dbManager.getProjectionEmbeddingCount();
    if (cachedCount === currentEmbeddingCount) {
      const cached = dbManager.getProjections();
      if (cached) {
        // Join with chunk metadata
        const chunkMap = new Map<string, any>();
        const chunks = dbManager.db.prepare('SELECT * FROM semantic_chunks').all() as any[];
        for (const c of chunks) {
          const mapped = dbManager.mapChunkRow(c);
          chunkMap.set(mapped.id, mapped);
        }

        const points = cached.map(p => {
          const chunk = chunkMap.get(p.chunkId);
          return {
            id: p.chunkId,
            x: p.x,
            y: p.y,
            name: chunk?.name || 'unknown',
            filePath: chunk?.filePath || '',
            purpose: chunk?.purpose || 'unknown',
            semanticType: chunk?.subtype || chunk?.type || 'unknown',
            complexity: chunk?.complexity?.score || 0,
            directory: chunk?.filePath ? chunk.filePath.split('/').slice(0, -1).join('/') || '.' : '.'
          };
        });

        return this.sendResponse(res, 200, {
          points,
          meta: { totalPoints: points.length, embeddingCount: currentEmbeddingCount, computedAt: new Date().toISOString(), cached: true }
        });
      }
    }

    // Compute fresh UMAP projection
    const rows = dbManager.db.prepare(`
      SELECT ve.chunk_id, ve.embedding, sc.name, sc.file_path, sc.type, sc.subtype, sc.complexity_score, sc.purpose
      FROM vector_embeddings ve
      JOIN semantic_chunks sc ON ve.chunk_id = sc.id
    `).all() as any[];

    if (rows.length < 2) {
      return this.sendResponse(res, 200, {
        points: rows.map((r: any) => ({
          id: r.chunk_id, x: 0, y: 0,
          name: r.name, filePath: r.file_path, purpose: r.purpose || 'unknown',
          semanticType: r.subtype || r.type || 'unknown', complexity: r.complexity_score || 0,
          directory: r.file_path ? r.file_path.split('/').slice(0, -1).join('/') || '.' : '.'
        })),
        meta: { totalPoints: rows.length, embeddingCount: currentEmbeddingCount, computedAt: new Date().toISOString(), cached: false }
      });
    }

    // Extract embeddings as number[][]
    const embeddings: number[][] = rows.map((r: any) => {
      const buf = r.embedding as Buffer;
      const floats = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      return Array.from(floats);
    });

    // Run UMAP
    const { UMAP } = await import('umap-js');
    const umap = new UMAP({
      nNeighbors: Math.min(15, rows.length - 1),
      minDist: 0.1,
      nComponents: 2
    });
    const projected = umap.fit(embeddings);

    // Save to cache
    const projections = rows.map((r: any, i: number) => ({
      chunkId: r.chunk_id,
      x: projected[i][0],
      y: projected[i][1]
    }));
    dbManager.saveProjections(projections, currentEmbeddingCount);

    // Build response
    const points = rows.map((r: any, i: number) => ({
      id: r.chunk_id,
      x: projected[i][0],
      y: projected[i][1],
      name: r.name,
      filePath: r.file_path,
      purpose: r.purpose || 'unknown',
      semanticType: r.subtype || r.type || 'unknown',
      complexity: r.complexity_score || 0,
      directory: r.file_path ? r.file_path.split('/').slice(0, -1).join('/') || '.' : '.'
    }));

    this.sendResponse(res, 200, {
      points,
      meta: { totalPoints: points.length, embeddingCount: currentEmbeddingCount, computedAt: new Date().toISOString(), cached: false }
    });
  }

  async handleGetVectorDbNetwork(req: IncomingMessage, res: ServerResponse) {
    const chunks = this.configManager.dbManager.db.prepare('SELECT * FROM semantic_chunks').all() as any[];
    const embeddings = this.configManager.dbManager.db.prepare('SELECT * FROM vector_embeddings').all() as any[];
    
    const nodes = chunks.map(c => this.configManager.dbManager.mapChunkRow(c)).slice(0, 100);
    const edges: any[] = [];
    
    // Simple pairwise similarity
    this.sendResponse(res, 200, { nodes, edges });
  }

  async handleGetDatabaseInfo(req: IncomingMessage, res: ServerResponse) {
    const info = this.configManager.dbManager.getInfo();
    this.sendResponse(res, 200, info);
  }

  async handlePostDatabaseQuery(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    const { query } = JSON.parse(body);
    const results = this.configManager.dbManager.query(query);
    this.sendResponse(res, 200, { results });
  }

  async handleGetActivities(req: IncomingMessage, res: ServerResponse) {
    const activities = await this.activityManager.loadActivities();
    this.sendResponse(res, 200, activities);
  }

  async handleGetActivityReasoning(req: IncomingMessage, res: ServerResponse, activityId: string) {
    const history = this.configManager.dbManager.getSessionHistory(activityId);
    this.sendResponse(res, 200, { history });
  }

  async handleGetStatus(req: IncomingMessage, res: ServerResponse) {
    const bundles = this.bundleManager.getAllBundleInfo();
    this.sendResponse(res, 200, {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      projectPath: this.cwd,
      bundles,
      scanning: this.bundleManager.isScanning,
      totalFiles: this.fileSystemManager.getAllFiles().length,
      mcp: {
        enabled: this.mcpEnabled,
        available: true
      }
    });
  }

  async handleGetMcpStatus(req: IncomingMessage, res: ServerResponse) {
    const isRunning = this.mcpEnabled;
    this.sendResponse(res, 200, {
      enabled: isRunning,
      running: isRunning,
      available: true,
      message: isRunning ? 'MCP server is running' : 'MCP server integration available'
    });
  }

  async handleGetArtifacts(req: IncomingMessage, res: ServerResponse) {
    const artifacts = this.artifactManager.refresh();
    this.sendResponse(res, 200, { artifacts });
  }

  async handleGetArtifact(req: IncomingMessage, res: ServerResponse, type: 'openapi' | 'navigation') {
    this.artifactManager.refresh();
    const payload = this.artifactManager.getPayload(type);
    this.sendResponse(res, 200, payload);
  }

  async handleGetCursorRules(req: IncomingMessage, res: ServerResponse) {
    const filePath = join(this.configManager.CWD, '.cursorrules');
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
    } else {
      res.end('');
    }
  }

  async handlePostCursorRules(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    const { content } = JSON.parse(body);
    writeFileSync(join(this.configManager.CWD, '.cursorrules'), content, 'utf8');
    this.sendResponse(res, 200, { success: true });
  }

  async handleGetClaudeMd(req: IncomingMessage, res: ServerResponse) {
    const filePath = join(this.configManager.CWD, 'CLAUDE.md');
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
    } else {
      res.end('');
    }
  }

  async handlePostClaudeMd(req: IncomingMessage, res: ServerResponse) {
    const body = await this.getRequestBody(req);
    const { content } = JSON.parse(body);
    writeFileSync(join(this.configManager.CWD, 'CLAUDE.md'), content, 'utf8');
    this.sendResponse(res, 200, { success: true });
  }
}
