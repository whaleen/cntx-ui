/**
 * Agent Tools for Codebase Exploration
 * Built on top of existing cntx-ui infrastructure
 */
import { existsSync, statSync } from 'fs';
import { join, relative } from 'path';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export default class AgentTools {
    cntxServer;
    constructor(cntxServer) {
        this.cntxServer = cntxServer;
    }
    /**
     * Execute a shell command within the project context
     */
    async executeCommand(command) {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd: this.cntxServer.CWD });
            return { stdout, stderr };
        }
        catch (error) {
            return { error: error.message, stdout: error.stdout, stderr: error.stderr };
        }
    }
    /**
     * List files in a directory, respecting ignore patterns
     */
    async listFiles(dirPath = '.') {
        try {
            const absolutePath = join(this.cntxServer.CWD, dirPath);
            if (!existsSync(absolutePath)) {
                return { error: `Directory not found: ${dirPath}` };
            }
            const files = this.cntxServer.fileSystemManager.getAllFiles(absolutePath);
            return files.map(f => relative(this.cntxServer.CWD, f));
        }
        catch (error) {
            return { error: error.message };
        }
    }
    /**
     * Search for code chunks based on semantic similarity or text matching
     */
    async searchChunks(query, options = {}) {
        const { maxResults = 10 } = options;
        try {
            let chunks = [];
            // Try semantic search if vector store is initialized
            if (this.cntxServer.vectorStoreInitialized) {
                try {
                    const searchResults = await this.cntxServer.vectorStore.search(query, { limit: maxResults * 2 });
                    const chunkIds = searchResults.map(r => r.id || r.chunkId).filter(Boolean);
                    const allChunks = await this.cntxServer.getSemanticAnalysis();
                    chunks = allChunks.chunks.filter((c) => chunkIds.includes(c.id));
                }
                catch (error) {
                    console.warn('Semantic search failed, falling back to text search:', error);
                }
            }
            // Fallback or combine with text search if needed
            if (chunks.length < maxResults) {
                const allChunks = await this.cntxServer.getSemanticAnalysis();
                const textResults = allChunks.chunks.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) ||
                    c.purpose.toLowerCase().includes(query.toLowerCase()) ||
                    c.code.toLowerCase().includes(query.toLowerCase()));
                // Merge and deduplicate
                const seenIds = new Set(chunks.map(c => c.id));
                for (const chunk of textResults) {
                    if (!seenIds.has(chunk.id)) {
                        chunks.push(chunk);
                        if (chunks.length >= maxResults * 2)
                            break;
                    }
                }
            }
            return chunks.slice(0, maxResults);
        }
        catch (error) {
            return { error: error.message };
        }
    }
    /**
     * Get technical metadata for a file
     */
    async getFileMetadata(filePath) {
        try {
            const fullPath = join(this.cntxServer.CWD, filePath);
            if (!existsSync(fullPath)) {
                return { error: `File not found: ${filePath}` };
            }
            const stats = statSync(fullPath);
            const chunks = this.cntxServer.databaseManager.getChunksByFile(filePath);
            return {
                path: filePath,
                size: stats.size,
                modified: stats.mtime,
                type: this.getFileType(filePath),
                semanticChunks: chunks.length,
                complexity: chunks.reduce((sum, c) => sum + (c.complexity?.score || 0), 0)
            };
        }
        catch (error) {
            return { error: error.message };
        }
    }
    // --- Helper Methods ---
    getFileSize(filePath) {
        try {
            const fullPath = join(this.cntxServer.CWD, filePath);
            const stats = statSync(fullPath);
            return stats.size;
        }
        catch {
            return 0;
        }
    }
    getFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const typeMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.rs': 'rust',
            '.go': 'go',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.toml': 'toml'
        };
        return typeMap[ext] || 'text';
    }
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.js': 'application/javascript',
            '.jsx': 'application/javascript',
            '.ts': 'application/typescript',
            '.tsx': 'application/typescript',
            '.json': 'application/json',
            '.md': 'text/markdown',
            '.html': 'text/html',
            '.css': 'text/css',
            '.txt': 'text/plain',
            '.rs': 'text/x-rust'
        };
        return mimeTypes[ext] || 'text/plain';
    }
    truncateContent(content, maxLength = 1000) {
        if (!content || content.length <= maxLength)
            return content;
        return content.substring(0, maxLength) + '...';
    }
}
