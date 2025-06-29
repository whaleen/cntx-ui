/**
 * Agent Tools for Codebase Exploration
 * Built on top of existing cntx-ui infrastructure
 */

import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AgentTools {
  constructor(cntxServer) {
    this.cntxServer = cntxServer;
  }

  /**
   * Read file contents with bundle context
   */
  async readFile(filePath, options = {}) {
    try {
      const fullPath = join(this.cntxServer.CWD, filePath);
      
      if (!existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = readFileSync(fullPath, 'utf8');
      const bundles = this.getFileBundles(filePath);
      
      return {
        path: filePath,
        content: options.truncate ? this.truncateContent(content, options.maxLength) : content,
        size: content.length,
        lines: content.split('\n').length,
        bundles,
        mimeType: this.getMimeType(filePath)
      };
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * List files with bundle awareness and filtering
   */
  async listFiles(options = {}) {
    const { bundle, pattern, type, limit = 100 } = options;
    
    try {
      let files = [];

      if (bundle) {
        const bundleObj = this.cntxServer.bundles.get(bundle);
        if (!bundleObj) {
          throw new Error(`Bundle '${bundle}' not found`);
        }
        files = bundleObj.files.map(f => ({
          path: f,
          bundle,
          size: this.getFileSize(f),
          type: this.getFileType(f)
        }));
      } else {
        // Get all files across bundles
        const allFiles = this.cntxServer.getAllFiles();
        files = allFiles.map(f => ({
          path: f,
          bundles: this.getFileBundles(f),
          size: this.getFileSize(f),
          type: this.getFileType(f)
        }));
      }

      // Apply filters
      if (pattern) {
        const regex = new RegExp(pattern, 'i');
        files = files.filter(f => regex.test(f.path));
      }

      if (type) {
        files = files.filter(f => f.type === type);
      }

      // Limit results
      return files.slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Search semantic chunks using existing vector search
   */
  async searchSemanticChunks(query, options = {}) {
    try {
      const analysis = await this.cntxServer.getSemanticAnalysis();
      if (!analysis || !analysis.chunks) {
        return { chunks: [], message: 'No semantic analysis available' };
      }

      let chunks = analysis.chunks;
      const { bundle, type, complexity, maxResults = 10 } = options;

      // Apply semantic search if vector store is available
      if (this.cntxServer.vectorStoreInitialized) {
        try {
          const searchResults = await this.cntxServer.vectorStore.search(query, maxResults * 2);
          const chunkIds = searchResults.map(r => r.metadata?.chunkId).filter(Boolean);
          chunks = chunks.filter(c => chunkIds.includes(c.id));
        } catch (error) {
          // Fall back to text-based search
          chunks = chunks.filter(c => 
            c.purpose?.toLowerCase().includes(query.toLowerCase()) ||
            c.name?.toLowerCase().includes(query.toLowerCase()) ||
            c.code?.toLowerCase().includes(query.toLowerCase())
          );
        }
      } else {
        // Text-based semantic search
        chunks = chunks.filter(c => 
          c.purpose?.toLowerCase().includes(query.toLowerCase()) ||
          c.name?.toLowerCase().includes(query.toLowerCase()) ||
          c.code?.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Apply filters
      if (bundle) {
        chunks = chunks.filter(c => c.bundles && c.bundles.includes(bundle));
      }

      if (type) {
        chunks = chunks.filter(c => c.subtype === type);
      }

      if (complexity) {
        chunks = chunks.filter(c => c.complexity?.level === complexity);
      }

      // Clean and limit results
      const cleanChunks = chunks.slice(0, maxResults).map(chunk => ({
        ...chunk,
        code: this.truncateContent(chunk.code, 500),
        bundles: chunk.bundles || [],
        relevanceScore: chunk.score || 0
      }));

      return {
        query,
        chunks: cleanChunks,
        totalResults: chunks.length,
        hasMore: chunks.length > maxResults
      };
    } catch (error) {
      throw new Error(`Semantic search failed: ${error.message}`);
    }
  }

  /**
   * Get bundle information
   */
  async getBundle(bundleName) {
    try {
      const bundle = this.cntxServer.bundles.get(bundleName);
      if (!bundle) {
        throw new Error(`Bundle '${bundleName}' not found`);
      }

      return {
        name: bundleName,
        patterns: bundle.patterns,
        files: bundle.files,
        fileCount: bundle.files.length,
        size: bundle.size,
        lastGenerated: bundle.lastGenerated,
        changed: bundle.changed,
        content: bundle.content ? this.truncateContent(bundle.content, 2000) : null
      };
    } catch (error) {
      throw new Error(`Failed to get bundle: ${error.message}`);
    }
  }

  /**
   * Parse AST using existing tree-sitter infrastructure
   */
  async parseAST(filePath, options = {}) {
    try {
      const fullPath = join(this.cntxServer.CWD, filePath);
      
      if (!existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Use existing semantic analysis if available
      const analysis = await this.cntxServer.getSemanticAnalysis();
      const fileChunks = analysis?.chunks?.filter(c => c.filePath === filePath) || [];

      if (fileChunks.length > 0) {
        return {
          file: filePath,
          chunks: fileChunks.map(chunk => ({
            name: chunk.name,
            type: chunk.subtype,
            purpose: chunk.purpose,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            complexity: chunk.complexity,
            isExported: chunk.isExported,
            isAsync: chunk.isAsync,
            imports: chunk.includes?.imports || [],
            dependencies: chunk.dependencies || []
          }))
        };
      }

      // Fallback: basic file info
      const content = readFileSync(fullPath, 'utf8');
      return {
        file: filePath,
        lines: content.split('\n').length,
        size: content.length,
        type: this.getFileType(filePath),
        message: 'AST parsing requires semantic analysis to be run first'
      };
    } catch (error) {
      throw new Error(`AST parsing failed: ${error.message}`);
    }
  }

  /**
   * Execute safe CLI commands (restricted set)
   */
  async runCommand(command, options = {}) {
    const { timeout = 10000, cwd } = options;
    
    // Whitelist of safe commands
    const safeCommands = [
      'ls', 'find', 'grep', 'wc', 'head', 'tail',
      'git status', 'git log', 'git diff', 'git branch',
      'npm list', 'npm outdated', 'npm audit',
      'node --version', 'npm --version'
    ];

    const isCommandSafe = safeCommands.some(safe => command.startsWith(safe));
    
    if (!isCommandSafe) {
      throw new Error(`Command not allowed: ${command}. Only safe read-only commands are permitted.`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || this.cntxServer.CWD,
        timeout,
        maxBuffer: 1024 * 1024 // 1MB limit
      });

      return {
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: true
      };
    } catch (error) {
      return {
        command,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get full semantic analysis
   */
  async getSemanticAnalysis(options = {}) {
    try {
      const analysis = await this.cntxServer.getSemanticAnalysis();
      
      if (!analysis) {
        return { message: 'No semantic analysis available. Run semantic analysis first.' };
      }

      const { includeCode = false, maxChunks = 50 } = options;

      return {
        timestamp: analysis.timestamp,
        summary: analysis.summary,
        chunks: analysis.chunks.slice(0, maxChunks).map(chunk => ({
          ...chunk,
          code: includeCode ? chunk.code : this.truncateContent(chunk.code, 200),
          bundles: chunk.bundles || []
        })),
        totalChunks: analysis.chunks?.length || 0,
        truncated: analysis.chunks?.length > maxChunks
      };
    } catch (error) {
      throw new Error(`Failed to get semantic analysis: ${error.message}`);
    }
  }

  // Helper methods
  
  getFileBundles(filePath) {
    const bundles = [];
    for (const [bundleName, bundle] of this.cntxServer.bundles) {
      if (bundle.files.includes(filePath)) {
        bundles.push(bundleName);
      }
    }
    return bundles;
  }

  getFileSize(filePath) {
    try {
      const fullPath = join(this.cntxServer.CWD, filePath);
      const stats = require('fs').statSync(fullPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  getFileType(filePath) {
    const ext = require('path').extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.json': 'json',
      '.md': 'markdown',
      '.css': 'css',
      '.html': 'html',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust'
    };
    return typeMap[ext] || 'text';
  }

  getMimeType(filePath) {
    const ext = require('path').extname(filePath).toLowerCase();
    const mimeTypes = {
      '.js': 'application/javascript',
      '.jsx': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.css': 'text/css',
      '.html': 'text/html'
    };
    return mimeTypes[ext] || 'text/plain';
  }

  truncateContent(content, maxLength = 1000) {
    if (!content || content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }
}

export default AgentTools;