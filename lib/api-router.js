/**
 * API Router for cntx-ui
 * Handles all HTTP API endpoints and request routing
 */

import { parse } from 'url';
import fs from 'fs';
import path from 'path';

export default class APIRouter {
  constructor(configManager, bundleManager, fileSystemManager, semanticAnalysisManager, vectorStore, activityManager) {
    this.configManager = configManager;
    this.bundleManager = bundleManager;
    this.fileSystemManager = fileSystemManager;
    this.semanticAnalysisManager = semanticAnalysisManager;
    this.vectorStore = vectorStore;
    this.activityManager = activityManager;
  }

  async handleRequest(req, res, url) {
    const method = req.method;
    const pathname = url.pathname;

    // DEBUG: Log all incoming API requests
    console.log('[API REQUEST]', method, pathname);
    if (pathname.includes('database')) {
      console.log('[DATABASE] Route requested:', pathname, method);
    }

    try {
      // Route to appropriate handler
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

      if (pathname === '/api/bundles-from-chunk' && method === 'POST') {
        return await this.handleCreateBundlesFromChunk(req, res);
      }

      if (pathname === '/api/bundle-visibility-stats' && method === 'GET') {
        return await this.handleBundleVisibilityStats(req, res);
      }

      if (pathname.startsWith('/api/bundle-categories/') && method === 'GET') {
        const bundleName = pathname.split('/')[3];
        return await this.handleBundleCategories(req, res, bundleName);
      }

      if (pathname === '/api/config' && method === 'GET') {
        return await this.handleGetConfig(req, res);
      }

      if (pathname === '/api/config' && method === 'POST') {
        return await this.handlePostConfig(req, res);
      }

      if (pathname === '/api/files' && method === 'GET') {
        return await this.handleGetFiles(req, res);
      }

      if (pathname === '/api/cursor-rules' && method === 'GET') {
        return await this.handleGetCursorRules(req, res);
      }

      if (pathname === '/api/cursor-rules' && method === 'POST') {
        return await this.handlePostCursorRules(req, res);
      }

      if (pathname === '/api/cursor-rules/templates' && method === 'GET') {
        return await this.handleGetCursorRulesTemplates(req, res);
      }

      if (pathname === '/api/claude-md' && method === 'GET') {
        return await this.handleGetClaudeMd(req, res);
      }

      if (pathname === '/api/claude-md' && method === 'POST') {
        return await this.handlePostClaudeMd(req, res);
      }

      if (pathname === '/api/heuristics/config' && method === 'GET') {
        return await this.handleGetHeuristicsConfig(req, res);
      }

      if (pathname === '/api/heuristics/config' && method === 'PUT') {
        return await this.handlePutHeuristicsConfig(req, res);
      }

      if (pathname === '/api/test-pattern' && method === 'POST') {
        return await this.handleTestPattern(req, res);
      }

      if (pathname === '/api/hidden-files' && method === 'GET') {
        return await this.handleGetHiddenFiles(req, res);
      }

      if (pathname === '/api/hidden-files' && method === 'POST') {
        return await this.handlePostHiddenFiles(req, res);
      }

      if (pathname === '/api/files-with-visibility' && method === 'GET') {
        return await this.handleGetFilesWithVisibility(req, res, url);
      }

      if (pathname === '/api/ignore-patterns' && method === 'GET') {
        return await this.handleGetIgnorePatterns(req, res);
      }

      if (pathname === '/api/ignore-patterns' && method === 'POST') {
        return await this.handlePostIgnorePatterns(req, res);
      }

      if (pathname === '/api/reset-hidden-files' && method === 'POST') {
        return await this.handleResetHiddenFiles(req, res);
      }

      if (pathname === '/api/semantic-chunks' && method === 'GET') {
        return await this.handleGetSemanticChunks(req, res, url);
      }

      if (pathname === '/api/semantic-chunks/export' && method === 'POST') {
        return await this.handleExportSemanticChunk(req, res);
      }

      if (pathname === '/api/mcp-status' && method === 'GET') {
        return await this.handleGetMcpStatus(req, res);
      }

      if (pathname === '/api/cntxignore' && method === 'GET') {
        return await this.handleGetCntxignore(req, res);
      }

      if (pathname === '/api/cntxignore' && method === 'POST') {
        return await this.handlePostCntxignore(req, res);
      }

      if (pathname === '/api/gitignore' && method === 'GET') {
        return await this.handleGetGitignore(req, res);
      }

      if (pathname === '/api/gitignore' && method === 'POST') {
        return await this.handlePostGitignore(req, res);
      }

      if (pathname === '/api/status' && method === 'GET') {
        return await this.handleGetStatus(req, res);
      }

      if (pathname === '/api/vector-db/status' && method === 'GET') {
        return await this.handleGetVectorDbStatus(req, res);
      }

      if (pathname === '/api/vector-db/rebuild' && method === 'POST') {
        return await this.handlePostVectorDbRebuild(req, res);
      }

      if (pathname === '/api/vector-db/search' && method === 'POST') {
        return await this.handlePostVectorDbSearch(req, res);
      }


      if (pathname === '/api/vector-db/search-by-type' && method === 'POST') {
        return await this.handlePostVectorDbSearchByType(req, res);
      }

      if (pathname === '/api/vector-db/search-by-domain' && method === 'POST') {
        return await this.handlePostVectorDbSearchByDomain(req, res);
      }

      if (pathname === '/api/activities' && method === 'GET') {
        return await this.handleGetActivities(req, res);
      }

      if (pathname.startsWith('/api/activities/') && pathname.endsWith('/execute') && method === 'POST') {
        const activityId = pathname.split('/')[3];
        return await this.handlePostActivityExecute(req, res, activityId);
      }

      if (pathname.startsWith('/api/activities/') && pathname.endsWith('/stop') && method === 'POST') {
        const activityId = pathname.split('/')[3];
        return await this.handlePostActivityStop(req, res, activityId);
      }

      if (pathname === '/api/open-file' && method === 'POST') {
        return await this.handleOpenFile(req, res);
      }

      if (pathname === '/api/bundle-sync-status' && method === 'GET') {
        return await this.handleGetBundleSyncStatus(req, res);
      }

      if (pathname === '/api/bundle-sync-status' && method === 'POST') {
        return await this.handlePostBundleSyncStatus(req, res);
      }

      if (pathname === '/api/database/info' && method === 'GET') {
        return await this.handleGetDatabaseInfo(req, res);
      }

      if (pathname === '/api/database/query' && method === 'POST') {
        return await this.handlePostDatabaseQuery(req, res);
      }

      // If no route matches, return 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API endpoint not found' }));

    } catch (error) {
      console.error('API Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  // === Bundle Operations ===

  async handleGetBundles(req, res, url) {
    const bundles = this.configManager.getBundles();
    const bundleData = Array.from(bundles.entries()).map(([name, bundle]) => ({
      name,
      changed: bundle.changed,
      fileCount: bundle.files.length,
      contentPreview: bundle.content.substring(0, 200) + (bundle.content.length > 200 ? '...' : ''),
      files: bundle.files,
      patterns: bundle.patterns,
      size: bundle.size,
      generated: bundle.generated
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(bundleData));
  }

  async handlePostBundles(req, res) {
    try {
      const body = JSON.parse(await this.getRequestBody(req));
      const { action, bundleName, fileName, fileNames } = body;

      if (!action || !bundleName) {
        return this.sendError(res, 400, 'Missing required fields: action and bundleName');
      }

      const bundles = this.configManager.getBundles();
      const bundle = bundles.get(bundleName);

      if (!bundle) {
        return this.sendError(res, 404, `Bundle "${bundleName}" not found`);
      }

      switch (action) {
        case 'add-file':
          if (!fileName) {
            return this.sendError(res, 400, 'Missing fileName for add-file action');
          }
          // Ensure we're working with relative paths
          const relativeAddFileName = fileName.startsWith('/') ?
            require('path').relative(this.configManager.CWD, fileName) : fileName;
          if (!bundle.files.includes(relativeAddFileName)) {
            bundle.files.push(relativeAddFileName);
            bundle.changed = true;
            this.configManager.saveBundleStates();
          }
          break;

        case 'remove-file':
          if (!fileName) {
            return this.sendError(res, 400, 'Missing fileName for remove-file action');
          }
          // Ensure we're working with relative paths for both search and removal
          const relativeRemoveFileName = fileName.startsWith('/') ?
            require('path').relative(this.configManager.CWD, fileName) : fileName;
          const removeIndex = bundle.files.indexOf(relativeRemoveFileName);
          if (removeIndex > -1) {
            bundle.files.splice(removeIndex, 1);
            bundle.changed = true;
            this.configManager.saveBundleStates();
          }
          break;

        case 'bulk-add-files':
          if (!fileNames || !Array.isArray(fileNames)) {
            return this.sendError(res, 400, 'Missing fileNames array for bulk-add-files action');
          }
          fileNames.forEach(file => {
            // Ensure we're working with relative paths
            const relativeFile = file.startsWith('/') ?
              require('path').relative(this.configManager.CWD, file) : file;
            if (!bundle.files.includes(relativeFile)) {
              bundle.files.push(relativeFile);
            }
          });
          bundle.changed = true;
          this.configManager.saveBundleStates();
          break;

        case 'bulk-remove-files':
          if (!fileNames || !Array.isArray(fileNames)) {
            return this.sendError(res, 400, 'Missing fileNames array for bulk-remove-files action');
          }
          fileNames.forEach(file => {
            // Ensure we're working with relative paths
            const relativeFile = file.startsWith('/') ?
              require('path').relative(this.configManager.CWD, file) : file;
            const index = bundle.files.indexOf(relativeFile);
            if (index > -1) {
              bundle.files.splice(index, 1);
            }
          });
          bundle.changed = true;
          this.configManager.saveBundleStates();
          break;

        default:
          return this.sendError(res, 400, `Unknown action: ${action}`);
      }

      this.sendResponse(res, 200, { success: true, message: `Action ${action} completed successfully` });
    } catch (error) {
      console.error('handlePostBundles error:', error);
      this.sendError(res, 500, error.message);
    }
  }

  async handleGetBundle(req, res, bundleName) {
    const content = this.bundleManager.getBundleContent(bundleName);
    if (!content) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bundle not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(content);
  }

  async handleRegenerateBundle(req, res, bundleName) {
    try {
      await this.bundleManager.regenerateBundle(bundleName);
      this.sendResponse(res, 200, { success: true, message: `Bundle ${bundleName} regenerated` });
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  async handleCreateBundlesFromChunk(req, res) {
    const body = await this.getRequestBody(req);
    const { chunkName, files } = JSON.parse(body);

    const bundleName = this.configManager.createBundleFromChunk(chunkName, files);
    await this.bundleManager.regenerateBundle(bundleName);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, bundleName }));
  }

  async handleBundleVisibilityStats(req, res) {
    const bundles = this.configManager.getBundles();
    const stats = {};

    for (const [bundleName] of bundles) {
      const files = this.bundleManager.getFileListWithVisibility(bundleName);
      stats[bundleName] = {
        total: files.length,
        included: files.filter(f => f.included).length,
        hidden: files.filter(f => f.hidden).length,
        matching: files.filter(f => f.matchesPattern).length
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }

  async handleBundleCategories(req, res, bundleName) {
    const files = this.bundleManager.getFileListWithVisibility(bundleName);
    const includedFiles = files.filter(f => f.included).map(f => f.fullPath);
    const categories = this.fileSystemManager.categorizeFiles(includedFiles);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(categories));
  }

  // === Configuration Endpoints ===

  async handleGetConfig(req, res) {
    const bundles = this.configManager.getBundles();
    const config = {
      bundles: {},
      editor: this.configManager.getEditor()
    };

    // Note: bundles are now managed separately in bundle-states.json
    // config.json only contains non-bundle settings

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
  }

  async handlePostConfig(req, res) {
    const body = await this.getRequestBody(req);
    const config = JSON.parse(body);

    this.configManager.saveConfig(config);
    this.configManager.loadConfig();
    await this.bundleManager.generateAllBundles();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleGetCursorRules(req, res) {
    const content = this.configManager.loadCursorRules();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(content);
  }

  async handlePostCursorRules(req, res) {
    const body = await this.getRequestBody(req);
    const { content } = JSON.parse(body);

    this.configManager.saveCursorRules(content);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleGetCursorRulesTemplates(req, res) {
    const templates = {
      react: this.configManager.generateCursorRulesTemplate({ projectType: 'react', name: 'React Project' }),
      vue: this.configManager.generateCursorRulesTemplate({ projectType: 'vue', name: 'Vue Project' }),
      angular: this.configManager.generateCursorRulesTemplate({ projectType: 'angular', name: 'Angular Project' }),
      'node-backend': this.configManager.generateCursorRulesTemplate({ projectType: 'node-backend', name: 'Node.js Backend' }),
      javascript: this.configManager.generateCursorRulesTemplate({ projectType: 'javascript', name: 'JavaScript Project' })
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(templates));
  }

  async handleGetClaudeMd(req, res) {
    const content = this.configManager.loadClaudeMd();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(content);
  }

  async handlePostClaudeMd(req, res) {
    const body = await this.getRequestBody(req);
    const { content } = JSON.parse(body);

    this.configManager.saveClaudeMd(content);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleGetHeuristicsConfig(req, res) {
    const config = this.configManager.loadHeuristicsConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
  }

  async handlePutHeuristicsConfig(req, res) {
    const body = await this.getRequestBody(req);
    const config = JSON.parse(body);

    this.configManager.saveHeuristicsConfig(config);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  // === File Operations ===

  async handleGetFiles(req, res) {
    const fileTree = this.fileSystemManager.getFileTree();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fileTree));
  }

  async handleGetFilesWithVisibility(req, res, url) {
    const bundleName = url.searchParams.get('bundle');
    const files = this.bundleManager.getFileListWithVisibility(bundleName);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
  }

  async handleGetHiddenFiles(req, res) {
    const hiddenConfig = this.configManager.getHiddenFilesConfig();
    const stats = {
      globalHidden: hiddenConfig.globalHidden.length,
      bundleSpecificTotal: Object.values(hiddenConfig.bundleSpecific).reduce((sum, arr) => sum + arr.length, 0),
      userIgnorePatterns: hiddenConfig.userIgnorePatterns.length,
      disabledSystemPatterns: hiddenConfig.disabledSystemPatterns.length,
      config: hiddenConfig
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }

  async handlePostHiddenFiles(req, res) {
    const body = await this.getRequestBody(req);
    const data = JSON.parse(body);

    if (data.action === 'toggle') {
      this.configManager.toggleFileVisibility(data.filePath, data.bundleName, data.forceHide);
    } else if (data.action === 'bulk-toggle') {
      this.configManager.bulkToggleFileVisibility(data.filePaths, data.bundleName, data.forceHide);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleGetIgnorePatterns(req, res) {
    const patterns = {
      system: this.fileSystemManager.ignorePatterns.filter(p => !this.configManager.getHiddenFilesConfig().userIgnorePatterns.some(up => up.pattern === p)),
      user: this.configManager.getHiddenFilesConfig().userIgnorePatterns,
      disabled: this.configManager.getHiddenFilesConfig().disabledSystemPatterns
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(patterns));
  }

  async handlePostIgnorePatterns(req, res) {
    const body = await this.getRequestBody(req);
    const data = JSON.parse(body);

    if (data.action === 'add') {
      this.configManager.addUserIgnorePattern(data.pattern);
    } else if (data.action === 'remove') {
      this.configManager.removeUserIgnorePattern(data.pattern);
    } else if (data.action === 'toggle-system') {
      this.configManager.toggleSystemIgnorePattern(data.pattern);
    }

    // Reload patterns and regenerate bundles
    this.configManager.loadIgnorePatterns();
    this.fileSystemManager.setIgnorePatterns(this.configManager.getIgnorePatterns());
    await this.bundleManager.generateAllBundles();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleResetHiddenFiles(req, res) {
    const body = await this.getRequestBody(req);
    const { scope, bundleName } = JSON.parse(body);

    const hiddenConfig = this.configManager.getHiddenFilesConfig();

    if (scope === 'global') {
      hiddenConfig.globalHidden = [];
    } else if (scope === 'bundle' && bundleName) {
      delete hiddenConfig.bundleSpecific[bundleName];
    } else if (scope === 'all') {
      hiddenConfig.globalHidden = [];
      hiddenConfig.bundleSpecific = {};
    }

    this.configManager.saveHiddenFilesConfig();
    await this.bundleManager.generateAllBundles();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleGetCntxignore(req, res) {
    try {
      const content = this.configManager.loadCntxignore();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('');
    }
  }

  async handlePostCntxignore(req, res) {
    const body = await this.getRequestBody(req);
    const { content } = JSON.parse(body);

    // Save content and reload patterns
    this.configManager.saveIgnoreFile ? this.configManager.saveIgnoreFile(content) : null;
    this.configManager.loadIgnorePatterns();
    this.fileSystemManager.setIgnorePatterns(this.configManager.getIgnorePatterns());

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleGetGitignore(req, res) {
    try {
      const content = this.configManager.loadGitignore();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('');
    }
  }

  async handlePostGitignore(req, res) {
    const body = await this.getRequestBody(req);
    const { content } = JSON.parse(body);

    this.configManager.saveGitignore(content);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  // === Semantic Analysis ===

  async handleGetSemanticChunks(req, res, url) {
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    try {
      const analysis = forceRefresh
        ? await this.semanticAnalysisManager.refreshSemanticAnalysis()
        : await this.semanticAnalysisManager.getSemanticAnalysis();

      const rawChunks = analysis?.chunks || [];
      // console.log('📊 Raw chunks sample:', rawChunks[0] ? {
      //   name: rawChunks[0].name,
      //   type: rawChunks[0].type,
      //   subtype: rawChunks[0].subtype,
      //   purpose: rawChunks[0].purpose,
      //   hasCode: !!rawChunks[0].code
      // } : 'No chunks');

      // Transform chunks to match VectorVisualization expectations
      const chunks = rawChunks.map(chunk => ({
        id: chunk.name || chunk.id || `chunk-${Math.random()}`,
        name: chunk.name,
        code: chunk.code,
        semanticType: chunk.subtype || chunk.type || 'unknown',
        businessDomain: chunk.tags || [],
        technicalPatterns: chunk.tags || [],
        purpose: chunk.purpose || '',
        filePath: chunk.filePath,
        files: chunk.filePath ? [chunk.filePath] : [],
        size: chunk.size || 0,
        complexity: chunk.complexity || 0,
        startLine: chunk.startLine,
        isExported: chunk.isExported,
        isAsync: chunk.isAsync,
        bundles: chunk.bundles || [],
        embedding: chunk.embedding,
        // Also include nested metadata format that VectorVisualization expects
        metadata: {
          content: chunk.code || '',
          semanticType: chunk.subtype || chunk.type || 'unknown',
          businessDomain: chunk.tags || [],
          technicalPatterns: chunk.tags || [],
          purpose: chunk.purpose || '',
          files: chunk.filePath ? [chunk.filePath] : [],
          size: chunk.size || 0,
          complexity: chunk.complexity || 0
        }
      }));

      // console.log('📊 Transformed chunks sample:', chunks[0] ? {
      //   id: chunks[0].id,
      //   semanticType: chunks[0].semanticType,
      //   hasMetadata: !!chunks[0].metadata
      // } : 'No chunks');

      this.sendResponse(res, 200, {
        summary: {
          totalFiles: analysis?.summary?.totalFiles || analysis?.fileCount || 0,
          totalFunctions: rawChunks.filter(c => c.type === 'function_chunk').length,
          totalChunks: rawChunks.length,
          averageChunkSize: rawChunks.length > 0 ? Math.round(rawChunks.reduce((sum, c) => sum + (c.size || 0), 0) / rawChunks.length) : 0
        },
        chunks: chunks,
        lastSemanticAnalysis: this.semanticAnalysisManager.lastSemanticAnalysis
      });
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  async handleExportSemanticChunk(req, res) {
    const body = await this.getRequestBody(req);
    const { chunkName } = JSON.parse(body);

    try {
      const content = await this.semanticAnalysisManager.exportSemanticChunk(chunkName);
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(content);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  // === Utilities ===

  async handleTestPattern(req, res) {
    const body = await this.getRequestBody(req);
    const { pattern } = JSON.parse(body);

    const allFiles = this.fileSystemManager.getAllFiles();
    const matchingFiles = allFiles.filter(file =>
      this.fileSystemManager.matchesPattern(file, pattern)
    ).map(file => this.fileSystemManager.relativePath(file));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pattern,
      matchCount: matchingFiles.length,
      matches: matchingFiles.slice(0, 100) // Limit to first 100 matches
    }));
  }

  async handleGetMcpStatus(req, res) {
    const status = {
      enabled: this.mcpServerStarted || false,
      available: true,
      message: 'MCP server integration available'
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  }

  async handleGetStatus(req, res) {
    const bundles = this.configManager.getBundles();
    const bundleStats = Array.from(bundles.entries()).map(([name, bundle]) => ({
      name,
      fileCount: bundle.files.length,
      size: bundle.size,
      changed: bundle.changed,
      generated: bundle.generated
    }));

    const status = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      bundles: bundleStats,
      scanning: this.bundleManager._isScanning || false,
      totalFiles: this.fileSystemManager.getAllFiles().length,
      mcp: {
        enabled: this.mcpServerStarted || false,
        available: true
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  }

  // === Vector Database Operations ===

  async handleGetVectorDbStatus(req, res) {
    try {
      // Initialize vector store if needed
      if (!this.vectorStore.embedder) {
        await this.vectorStore.init();
      }

      const stats = await this.vectorStore.getStats();
      this.sendResponse(res, 200, { stats });
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  async handlePostVectorDbRebuild(req, res) {
    try {
      await this.vectorStore.clear();
      const analysis = await this.semanticAnalysisManager.getSemanticAnalysis();

      if (analysis && analysis.chunks) {
        await this.vectorStore.storePrecomputedChunks(analysis.chunks);
      }

      const stats = await this.vectorStore.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async handlePostVectorDbSearch(req, res) {
    try {
      const body = await this.getRequestBody(req);
      const { query, limit = 10 } = JSON.parse(body);

      // Initialize vector store if needed
      if (!this.vectorStore.embedder) {
        await this.vectorStore.init();
      }

      const results = await this.vectorStore.findSimilar(query, { limit });
      this.sendResponse(res, 200, results);
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  async handlePostVectorDbSearchByType(req, res) {
    try {
      const body = await this.getRequestBody(req);
      const { type, limit = 10 } = JSON.parse(body);

      // Initialize vector store if needed
      if (!this.vectorStore.embedder) {
        await this.vectorStore.init();
      }

      const results = await this.vectorStore.findByType(type, limit);
      this.sendResponse(res, 200, results);
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  async handlePostVectorDbSearchByDomain(req, res) {
    try {
      const body = await this.getRequestBody(req);
      const { domain, limit = 10 } = JSON.parse(body);

      // Initialize vector store if needed
      if (!this.vectorStore.embedder) {
        await this.vectorStore.init();
      }

      const results = await this.vectorStore.findByDomain(domain, limit);
      this.sendResponse(res, 200, results);
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  // === Activities ===

  async handleGetActivities(req, res) {
    try {
      console.log('API: /api/activities called');
      const activities = await this.activityManager.loadActivities();
      console.log('API: Loaded activities:', activities.length);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(activities));
    } catch (error) {
      console.log('API: Error loading activities:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async handlePostActivityExecute(req, res, activityId) {
    try {
      const result = await this.activityManager.executeActivity(activityId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async handlePostActivityStop(req, res, activityId) {
    try {
      const result = await this.activityManager.stopActivity(activityId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async handleOpenFile(req, res) {
    try {
      const body = await this.getRequestBody(req);
      const { filePath, line, column } = JSON.parse(body);

      if (!filePath) {
        return this.sendError(res, 400, 'Missing filePath parameter');
      }

      const { spawn } = await import('child_process');
      const path = await import('path');
      const fs = await import('fs');

      const fullPath = path.resolve(this.configManager.CWD, filePath);

      if (!fs.existsSync(fullPath)) {
        return this.sendError(res, 404, 'File not found');
      }

      let editorCommand = this.configManager.getEditor();
      let command, args;

      // Helper to add line/column if supported
      const addLineColumn = (file, line, column) => {
        if (line && column) return `${file}:${line}:${column}`;
        if (line) return `${file}:${line}`;
        return file;
      };

      if (editorCommand === 'system') {
        switch (process.platform) {
          case 'darwin':
            command = 'open';
            args = [fullPath];
            break;
          case 'win32':
            command = 'start';
            args = [fullPath];
            break;
          default:
            command = 'xdg-open';
            args = [fullPath];
            break;
        }
      } else if (editorCommand.startsWith('code')) {
        // VS Code: try direct file:line format
        command = 'code';
        if (line) {
          args = [`${fullPath}:${line}`];
        } else {
          args = [fullPath];
        }
      } else if (editorCommand.startsWith('subl')) {
        // Sublime Text supports file:line[:column]
        command = 'subl';
        args = [addLineColumn(fullPath, line, column)];
      } else {
        // Custom editor: just append file path, ignore line/column
        command = editorCommand.split(' ')[0];
        args = [...editorCommand.split(' ').slice(1), fullPath];
      }

      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        shell: false
      });

      child.unref();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `File opened with ${command}` }));

    } catch (error) {
      console.error('Failed to open file:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to open file in editor. Please check your editor configuration.',
        details: error.message
      }));
    }
  }

  // === Utility Methods ===

  sendResponse(res, statusCode, data, contentType = 'application/json') {
    res.setHeader('Content-Type', contentType);
    res.statusCode = statusCode;

    if (typeof data === 'string') {
      res.end(data);
    } else {
      res.end(JSON.stringify(data));
    }
  }

  sendError(res, statusCode, message) {
    this.sendResponse(res, statusCode, { error: message });
  }

  async getRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  async handleGetBundleSyncStatus(req, res) {
    const bundleStatesPath = path.join(this.configManager.CNTX_DIR, 'bundle-states.json');

    // Since bundles are now only stored in bundle-states.json, we just check if the file exists and is valid
    let bundleStates = [];
    let bundleStatesExists = fs.existsSync(bundleStatesPath);
    
    if (bundleStatesExists) {
      try {
        bundleStates = JSON.parse(fs.readFileSync(bundleStatesPath, 'utf8'));
      } catch (error) {
        bundleStatesExists = false;
      }
    }

    const details = {
      inSync: bundleStatesExists && bundleStates.length > 0,
      bundleCount: bundleStates.length,
      bundleNames: bundleStates.map(b => b.name),
      hasValidBundleFile: bundleStatesExists,
      message: bundleStatesExists 
        ? `Found ${bundleStates.length} bundles in bundle-states.json`
        : 'bundle-states.json file not found or invalid'
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(details));
  }

  async handlePostBundleSyncStatus(req, res) {
    const bundleStatesPath = path.join(this.configManager.CNTX_DIR, 'bundle-states.json');

    if (!fs.existsSync(bundleStatesPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'bundle-states.json not found' }));
      return;
    }

    try {
      // Validate and reload bundle states to ensure they're in sync with the file
      const bundleStates = JSON.parse(fs.readFileSync(bundleStatesPath, 'utf8'));
      
      // Reload bundle states in configuration manager
      this.configManager.loadBundleStates();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: 'Bundle states reloaded successfully',
        bundleCount: bundleStates.length,
        bundles: bundleStates.map(b => b.name)
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: 'Failed to reload bundle states',
        error: error.message 
      }));
    }
  }

  // === Database API Handlers ===

  async handleGetDatabaseInfo(req, res) {
    try {
      const info = this.configManager.dbManager.getInfo();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async handlePostDatabaseQuery(req, res) {
    try {
      const body = await this.getRequestBody(req);
      const { query } = JSON.parse(body);
      
      if (!query || typeof query !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Query is required' }));
        return;
      }
      
      const results = this.configManager.dbManager.query(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
}
