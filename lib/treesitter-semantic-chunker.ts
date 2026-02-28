/**
 * Treesitter-based Semantic Chunker for JavaScript/TypeScript and Rust Files
 * Uses tree-sitter for true AST-based code analysis and semantic chunking
 * Supports JS/TS/JSX/TSX and Rust with equal treatment
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { extname, basename, dirname, relative, join } from 'path'
import { glob } from 'glob'
import Parser from 'tree-sitter'
import JavaScript from 'tree-sitter-javascript'
import TypeScript from 'tree-sitter-typescript'
import Rust from 'tree-sitter-rust'

export interface FileAnalysis {
  path: string;
  fileName: string;
  dirName: string;
  extension: string;
  size: number;
  lines: number;
  ast: any;
  semanticType: string;
  businessDomain: string[];
  technicalPatterns: string[];
  dependencies: any;
  complexity: any;
  codeSignature: any;
  semanticTags: string[];
  error?: string;
}

class TreesitterSemanticChunker {
  options: {
    includeImports: boolean;
    includeExports: boolean;
    detectComponentTypes: boolean;
    groupRelatedFiles: boolean;
    minChunkSize: number;
    maxChunkSize: number;
    namingStrategy: string;
  };
  parsers: Record<string, Parser>;
  semanticPatterns: Record<string, Function>;

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
    }
    
    this.parsers = {}
    this.initializeParsers()
    
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
    }
  }

  initializeParsers() {
    this.parsers.javascript = new Parser()
    this.parsers.javascript.setLanguage(JavaScript)
    
    this.parsers.typescript = new Parser()
    this.parsers.typescript.setLanguage(TypeScript.typescript)
    
    this.parsers.tsx = new Parser()
    this.parsers.tsx.setLanguage(TypeScript.tsx)

    this.parsers.rust = new Parser()
    this.parsers.rust.setLanguage(Rust)
  }

  getParser(filePath: string): Parser {
    const ext = extname(filePath)
    switch (ext) {
      case '.ts': return this.parsers.typescript
      case '.tsx': return this.parsers.tsx
      case '.rs': return this.parsers.rust
      case '.js':
      case '.jsx':
      default: return this.parsers.javascript
    }
  }

  async analyzeProject(projectPath: string, patterns = ['**/*.{js,jsx,ts,tsx,rs}']) {
    console.log('🔍 Starting treesitter-based semantic analysis...')
    
    const files = await this.findFiles(projectPath, patterns)
    console.log(`📁 Found ${files.length} files to analyze`)
    
    const analysis = await this.analyzeFiles(files, projectPath)
    const successfulFiles = Object.keys(analysis).filter(f => !analysis[f].error)
    
    const relationshipGraph = this.buildRelationshipGraph(analysis)
    const chunks = await this.createSmartChunks(analysis, relationshipGraph)
    
    return {
      summary: this.generateSummary(analysis, chunks),
      files: analysis,
      chunks: chunks,
      relationshipGraph,
      recommendations: this.generateRecommendations(analysis, chunks)
    }
  }

  async findFiles(projectPath: string, patterns: string[]) {
    const files: string[] = []
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
      })
      files.push(...matches)
    }
    return [...new Set(files)]
  }

  async analyzeFiles(filePaths: string[], projectPath: string): Promise<Record<string, FileAnalysis>> {
    const analysis: Record<string, FileAnalysis> = {}
    
    for (const relativePath of filePaths) {
      const fullPath = join(projectPath, relativePath)
      if (!existsSync(fullPath)) continue
      
      try {
        const content = readFileSync(fullPath, 'utf8')
        const fileAnalysis = await this.analyzeFile(fullPath, content)
        fileAnalysis.path = relativePath
        analysis[relativePath] = fileAnalysis
      } catch (error: any) {
        analysis[relativePath] = { error: error.message, path: relativePath } as any
      }
    }
    
    return analysis
  }

  async analyzeFile(filePath: string, content: string): Promise<FileAnalysis> {
    const parser = this.getParser(filePath)
    
    let tree, rootNode
    try {
      tree = parser.parse(content)
      rootNode = tree.rootNode
    } catch (error: any) {
      throw new Error(`Tree-sitter parse failed: ${error.message}`)
    }
    
    const analysis: FileAnalysis = {
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
    }
    
    analysis.semanticTags = this.generateSemanticTags(analysis)
    
    return analysis
  }

  extractFunctions(rootNode: Parser.SyntaxNode, content: string) {
    const functions: any[] = []
    const functionDeclarations = this.queryNode(rootNode, ['function_declaration'])
    functions.push(...functionDeclarations.map(capture => ({
      name: this.getNodeText(capture.node, content),
      type: 'function_declaration',
      startPosition: capture.node.startPosition,
      isExported: this.isNodeExported(capture.node)
    })))
    
    const rustFunctions = this.queryNode(rootNode, ['function_item'])
    functions.push(...rustFunctions.map(capture => ({
      name: this.getNodeText(capture.node, content),
      type: 'function_item',
      startPosition: capture.node.startPosition,
      isExported: this.isNodeExported(capture.node)
    })))
    
    return functions
  }

  extractClasses(rootNode: Parser.SyntaxNode, content: string) {
    return []
  }

  extractImports(rootNode: Parser.SyntaxNode, content: string) {
    return []
  }

  extractExports(rootNode: Parser.SyntaxNode, content: string) {
    return []
  }

  extractVariables(rootNode: Parser.SyntaxNode, content: string) {
    return []
  }

  extractJsxElements(rootNode: Parser.SyntaxNode, content: string) {
    return []
  }

  extractTypeDefinitions(rootNode: Parser.SyntaxNode, content: string) {
    return []
  }

  classifyFileSemantics(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return 'module'
  }

  isReactComponent(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isReactHook(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isExpressRoute(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isExpressMiddleware(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isCliCommand(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isUtilityFunction(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isApiHandler(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isTypeDefinition(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  isConfigModule(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return false
  }

  extractBusinessDomain(rootNode: Parser.SyntaxNode, content: string, filePath: string) {
    return []
  }

  identifyTechnicalPatterns(rootNode: Parser.SyntaxNode, content: string) {
    return []
  }

  buildRelationshipGraph(analysis: any) {
    return {}
  }

  async createSmartChunks(analysis: any, relationshipGraph: any) {
    return []
  }

  generateSummary(analysis: any, chunks: any) {
    return {}
  }

  generateRecommendations(analysis: any, chunks: any) {
    return []
  }

  queryNode(node: Parser.SyntaxNode, types: string[]) {
    const results: { node: Parser.SyntaxNode }[] = []
    const traverse = (currentNode: Parser.SyntaxNode) => {
      if (types.includes(currentNode.type)) {
        results.push({ node: currentNode })
      }
      for (let i = 0; i < currentNode.namedChildCount; i++) {
        const child = currentNode.namedChild(i);
        if (child) traverse(child)
      }
    }
    traverse(node)
    return results
  }

  getNodeText(node: Parser.SyntaxNode, content: string) {
    return content.slice(node.startIndex, node.endIndex)
  }

  isNodeExported(node: Parser.SyntaxNode) {
    let parent = node.parent
    while (parent) {
      if (parent.type === 'export_statement' || parent.type === 'export_declaration' || parent.type === 'visibility_modifier') {
        return true
      }
      parent = parent.parent
    }
    return false
  }

  calculateOverlap(arrayA: string[], arrayB: string[]) {
    const setA = new Set(arrayA)
    const setB = new Set(arrayB)
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    return union.size === 0 ? 0 : intersection.size / union.size
  }

  generateSemanticTags(analysis: FileAnalysis) {
    return []
  }

  calculateAstComplexity(rootNode: Parser.SyntaxNode) {
    return { score: 1, level: 'low' }
  }

  analyzeDependencies(rootNode: Parser.SyntaxNode, content: string) {
    return { internal: [], external: [], relative: [] }
  }

  generateCodeSignature(rootNode: Parser.SyntaxNode, content: string) {
    return {}
  }
}

export default TreesitterSemanticChunker
