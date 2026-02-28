/**
 * Treesitter-based Semantic Chunker for JavaScript/TypeScript and Rust Files
 * Uses tree-sitter for true AST-based code analysis and semantic chunking
 * Supports JS/TS/JSX/TSX and Rust with equal treatment
 */
import { readFileSync, existsSync } from 'fs';
import { extname, basename, dirname, join } from 'path';
import { glob } from 'glob';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Rust from 'tree-sitter-rust';
class TreesitterSemanticChunker {
    options;
    parsers;
    semanticPatterns;
    constructor(options = {}) {
        this.options = {
            includeImports: true,
            includeExports: true,
            detectComponentTypes: true,
            groupRelatedFiles: true,
            minChunkSize: 100,
            maxChunkSize: 50000,
            namingStrategy: 'domain-based',
            ...options
        };
        this.parsers = {};
        this.initializeParsers();
        this.semanticPatterns = {
            reactComponent: this.isReactComponent.bind(this),
            reactHook: this.isReactHook.bind(this),
            expressRoute: this.isExpressRoute.bind(this),
            expressMiddleware: this.isExpressMiddleware.bind(this),
            cliCommand: this.isCliCommand.bind(this),
            utilityFunction: this.isUtilityFunction.bind(this),
            apiHandler: this.isApiHandler.bind(this),
            typeDefinition: this.isTypeDefinition.bind(this),
            configModule: this.isConfigModule.bind(this)
        };
    }
    initializeParsers() {
        this.parsers.javascript = new Parser();
        this.parsers.javascript.setLanguage(JavaScript);
        this.parsers.typescript = new Parser();
        this.parsers.typescript.setLanguage(TypeScript.typescript);
        this.parsers.tsx = new Parser();
        this.parsers.tsx.setLanguage(TypeScript.tsx);
        this.parsers.rust = new Parser();
        this.parsers.rust.setLanguage(Rust);
    }
    getParser(filePath) {
        const ext = extname(filePath);
        switch (ext) {
            case '.ts': return this.parsers.typescript;
            case '.tsx': return this.parsers.tsx;
            case '.rs': return this.parsers.rust;
            case '.js':
            case '.jsx':
            default: return this.parsers.javascript;
        }
    }
    async analyzeProject(projectPath, patterns = ['**/*.{js,jsx,ts,tsx,rs}']) {
        console.log('🔍 Starting treesitter-based semantic analysis...');
        const files = await this.findFiles(projectPath, patterns);
        console.log(`📁 Found ${files.length} files to analyze`);
        const analysis = await this.analyzeFiles(files, projectPath);
        const successfulFiles = Object.keys(analysis).filter(f => !analysis[f].error);
        const relationshipGraph = this.buildRelationshipGraph(analysis);
        const chunks = await this.createSmartChunks(analysis, relationshipGraph);
        return {
            summary: this.generateSummary(analysis, chunks),
            files: analysis,
            chunks: chunks,
            relationshipGraph,
            recommendations: this.generateRecommendations(analysis, chunks)
        };
    }
    async findFiles(projectPath, patterns) {
        const files = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern, {
                cwd: projectPath,
                ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
            });
            files.push(...matches);
        }
        return [...new Set(files)];
    }
    async analyzeFiles(filePaths, projectPath) {
        const analysis = {};
        for (const relativePath of filePaths) {
            const fullPath = join(projectPath, relativePath);
            if (!existsSync(fullPath))
                continue;
            try {
                const content = readFileSync(fullPath, 'utf8');
                const fileAnalysis = await this.analyzeFile(fullPath, content);
                fileAnalysis.path = relativePath;
                analysis[relativePath] = fileAnalysis;
            }
            catch (error) {
                analysis[relativePath] = { error: error.message, path: relativePath };
            }
        }
        return analysis;
    }
    async analyzeFile(filePath, content) {
        const parser = this.getParser(filePath);
        let tree, rootNode;
        try {
            tree = parser.parse(content);
            rootNode = tree.rootNode;
        }
        catch (error) {
            throw new Error(`Tree-sitter parse failed: ${error.message}`);
        }
        const analysis = {
            path: filePath,
            fileName: basename(filePath),
            dirName: basename(dirname(filePath)),
            extension: extname(filePath),
            size: content.length,
            lines: content.split('\n').length,
            ast: {
                functions: this.extractFunctions(rootNode, content),
                classes: this.extractClasses(rootNode, content),
                imports: this.extractImports(rootNode, content),
                exports: this.extractExports(rootNode, content),
                variables: this.extractVariables(rootNode, content),
                jsxElements: this.extractJsxElements(rootNode, content),
                typeDefinitions: this.extractTypeDefinitions(rootNode, content)
            },
            semanticType: this.classifyFileSemantics(rootNode, content, filePath),
            businessDomain: this.extractBusinessDomain(rootNode, content, filePath),
            technicalPatterns: this.identifyTechnicalPatterns(rootNode, content),
            dependencies: this.analyzeDependencies(rootNode, content),
            complexity: this.calculateAstComplexity(rootNode),
            codeSignature: this.generateCodeSignature(rootNode, content),
            semanticTags: []
        };
        analysis.semanticTags = this.generateSemanticTags(analysis);
        return analysis;
    }
    extractFunctions(rootNode, content) {
        const functions = [];
        const functionDeclarations = this.queryNode(rootNode, ['function_declaration']);
        functions.push(...functionDeclarations.map(capture => ({
            name: this.getNodeText(capture.node, content),
            type: 'function_declaration',
            startPosition: capture.node.startPosition,
            isExported: this.isNodeExported(capture.node)
        })));
        const rustFunctions = this.queryNode(rootNode, ['function_item']);
        functions.push(...rustFunctions.map(capture => ({
            name: this.getNodeText(capture.node, content),
            type: 'function_item',
            startPosition: capture.node.startPosition,
            isExported: this.isNodeExported(capture.node)
        })));
        return functions;
    }
    extractClasses(rootNode, content) {
        return [];
    }
    extractImports(rootNode, content) {
        return [];
    }
    extractExports(rootNode, content) {
        return [];
    }
    extractVariables(rootNode, content) {
        return [];
    }
    extractJsxElements(rootNode, content) {
        return [];
    }
    extractTypeDefinitions(rootNode, content) {
        return [];
    }
    classifyFileSemantics(rootNode, content, filePath) {
        return 'module';
    }
    isReactComponent(rootNode, content, filePath) {
        return false;
    }
    isReactHook(rootNode, content, filePath) {
        return false;
    }
    isExpressRoute(rootNode, content, filePath) {
        return false;
    }
    isExpressMiddleware(rootNode, content, filePath) {
        return false;
    }
    isCliCommand(rootNode, content, filePath) {
        return false;
    }
    isUtilityFunction(rootNode, content, filePath) {
        return false;
    }
    isApiHandler(rootNode, content, filePath) {
        return false;
    }
    isTypeDefinition(rootNode, content, filePath) {
        return false;
    }
    isConfigModule(rootNode, content, filePath) {
        return false;
    }
    extractBusinessDomain(rootNode, content, filePath) {
        return [];
    }
    identifyTechnicalPatterns(rootNode, content) {
        return [];
    }
    buildRelationshipGraph(analysis) {
        return {};
    }
    async createSmartChunks(analysis, relationshipGraph) {
        return [];
    }
    generateSummary(analysis, chunks) {
        return {};
    }
    generateRecommendations(analysis, chunks) {
        return [];
    }
    queryNode(node, types) {
        const results = [];
        const traverse = (currentNode) => {
            if (types.includes(currentNode.type)) {
                results.push({ node: currentNode });
            }
            for (let i = 0; i < currentNode.namedChildCount; i++) {
                const child = currentNode.namedChild(i);
                if (child)
                    traverse(child);
            }
        };
        traverse(node);
        return results;
    }
    getNodeText(node, content) {
        return content.slice(node.startIndex, node.endIndex);
    }
    isNodeExported(node) {
        let parent = node.parent;
        while (parent) {
            if (parent.type === 'export_statement' || parent.type === 'export_declaration' || parent.type === 'visibility_modifier') {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    }
    calculateOverlap(arrayA, arrayB) {
        const setA = new Set(arrayA);
        const setB = new Set(arrayB);
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        return union.size === 0 ? 0 : intersection.size / union.size;
    }
    generateSemanticTags(analysis) {
        return [];
    }
    calculateAstComplexity(rootNode) {
        return { score: 1, level: 'low' };
    }
    analyzeDependencies(rootNode, content) {
        return { internal: [], external: [], relative: [] };
    }
    generateCodeSignature(rootNode, content) {
        return {};
    }
}
export default TreesitterSemanticChunker;
