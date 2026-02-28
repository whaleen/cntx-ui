/**
 * Function-Level Semantic Chunker
 * Extracts individual functions/methods/components as discrete chunks
 * with intelligent context inclusion
 */
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { glob } from 'glob';
export default class FunctionLevelChunker {
    options;
    constructor(options = {}) {
        this.options = {
            minChunkSize: 100,
            maxChunkSize: 10000,
            includeImports: true,
            includeTypes: true,
            ...options
        };
    }
    /**
     * Main entry point - extract function chunks from project
     */
    async extractFunctionChunks(projectPath, patterns = ['**/*.{js,jsx,ts,tsx,mjs}']) {
        console.log('🔍 Starting function-level semantic chunking...');
        const files = await this.findFiles(projectPath, patterns);
        console.log(`📁 Found ${files.length} files to scan for functions`);
        const allFunctions = [];
        for (const filePath of files) {
            try {
                const fileFunctions = this.extractFunctionsFromFile(filePath, projectPath);
                allFunctions.push(...fileFunctions);
            }
            catch (error) {
                console.warn(`Failed to extract from ${filePath}: ${error.message}`);
            }
        }
        console.log(`📦 Found ${allFunctions.length} functions across project`);
        const chunks = this.createFunctionChunks(allFunctions);
        console.log(`🧩 Created ${chunks.length} semantic function chunks`);
        return chunks;
    }
    /**
     * Find files matching patterns
     */
    async findFiles(projectPath, patterns) {
        const files = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern, {
                cwd: projectPath,
                ignore: ['node_modules/**', 'dist/**', '.git/**', '*.test.*', '*.spec.*']
            });
            files.push(...matches);
        }
        return [...new Set(files)];
    }
    /**
     * Extract functions from a single file
     */
    extractFunctionsFromFile(relativePath, projectPath) {
        const fullPath = join(projectPath, relativePath);
        if (!existsSync(fullPath))
            return [];
        const content = readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        const ext = extname(relativePath);
        // For now, use regex-based extraction as primary
        // In a full implementation, we'd use treesitter here
        return this.extractWithRegex(content, lines, relativePath);
    }
    /**
     * Simple regex-based extraction for functions and methods
     */
    extractWithRegex(content, lines, filePath) {
        const functions = [];
        // Patterns for common function declarations
        const patterns = [
            // function name() {
            /function\s+([a-zA-Z0-9_]+)\s*\(/g,
            // const name = () => {
            /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
            // name(params) { (inside class or object)
            /^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/gm
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const name = match[1];
                const startIndex = match.index;
                // Find line number
                const beforeMatch = content.substring(0, startIndex);
                const startLine = beforeMatch.split('\n').length;
                // Extract function body (simple brace matching)
                const body = this.extractFunctionBody(content, startIndex, lines, startLine);
                if (body && body.length > this.options.minChunkSize) {
                    functions.push({
                        name,
                        code: body,
                        filePath,
                        startLine,
                        type: 'function'
                    });
                }
            }
        }
        return functions;
    }
    /**
     * Extract function body using brace matching
     */
    extractFunctionBody(content, startIndex, lines, startLine) {
        const openingBraceIndex = content.indexOf('{', startIndex);
        if (openingBraceIndex === -1)
            return null;
        let braceCount = 1;
        let i = openingBraceIndex + 1;
        while (braceCount > 0 && i < content.length) {
            if (content[i] === '{')
                braceCount++;
            if (content[i] === '}')
                braceCount--;
            i++;
        }
        if (braceCount === 0) {
            return content.substring(startIndex, i);
        }
        return null;
    }
    /**
     * Create semantic chunks from extracted functions
     */
    createFunctionChunks(functions) {
        return functions.map(func => ({
            id: `${func.filePath}:${func.name}:${func.startLine}`,
            name: func.name,
            filePath: func.filePath,
            type: 'function',
            subtype: func.type || 'unknown',
            code: func.code,
            startLine: func.startLine,
            purpose: 'Implementation logic', // Default purpose
            complexity: { score: 0, level: 'low' } // Placeholder
        }));
    }
}
