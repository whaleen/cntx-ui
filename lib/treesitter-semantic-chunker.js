/**
 * Treesitter-based Semantic Chunker for JavaScript/TypeScript Files
 * Uses tree-sitter for true AST-based code analysis and semantic chunking
 * Supports JS/TS/JSX/TSX with equal treatment
 * Node ecosystem focus: React components, Express APIs, CLI tools, utilities
 */

import { readFileSync, existsSync } from 'fs'
import { extname, basename, dirname, relative, join } from 'path'
import glob from 'glob'
import { promisify } from 'util'
import Parser from 'tree-sitter'
import JavaScript from 'tree-sitter-javascript'
import TypeScript from 'tree-sitter-typescript'

const globAsync = promisify(glob)

class TreesitterSemanticChunker {
  constructor(options = {}) {
    this.options = {
      includeImports: true,
      includeExports: true,
      detectComponentTypes: true,
      groupRelatedFiles: true,
      minChunkSize: 100,
      maxChunkSize: 50000,
      namingStrategy: 'domain-based', // domain-based, pattern-based, graph-based
      ...options
    }
    
    // Initialize parsers for different languages
    this.parsers = {}
    this.initializeParsers()
    
    // Semantic patterns for Node ecosystem
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

  /**
   * Initialize tree-sitter parsers for different languages
   */
  initializeParsers() {
    // JavaScript parser
    this.parsers.javascript = new Parser()
    this.parsers.javascript.setLanguage(JavaScript)
    
    // TypeScript parser  
    this.parsers.typescript = new Parser()
    this.parsers.typescript.setLanguage(TypeScript.typescript)
    
    // TSX parser
    this.parsers.tsx = new Parser()
    this.parsers.tsx.setLanguage(TypeScript.tsx)
  }

  /**
   * Get appropriate parser for file extension
   */
  getParser(filePath) {
    const ext = extname(filePath)
    switch (ext) {
      case '.ts': return this.parsers.typescript
      case '.tsx': return this.parsers.tsx
      case '.js':
      case '.jsx':
      default: return this.parsers.javascript
    }
  }

  /**
   * Main entry point - analyze files and create semantic chunks
   */
  async analyzeProject(projectPath, patterns = ['**/*.{js,jsx,ts,tsx}']) {
    console.log('🔍 Starting treesitter-based semantic analysis...')
    
    const files = await this.findFiles(projectPath, patterns)
    console.log(`📁 Found ${files.length} files to analyze`)
    
    const analysis = await this.analyzeFiles(files, projectPath)
    const successfulFiles = Object.keys(analysis).filter(f => !analysis[f].error)
    console.log(`✅ Analyzed ${Object.keys(analysis).length} files (${successfulFiles.length} successful)`)
    if (successfulFiles.length > 0) {
      console.log('📝 Sample successful files:', successfulFiles.slice(0, 5))
    }
    
    const relationshipGraph = this.buildRelationshipGraph(analysis)
    console.log(`🔗 Built relationship graph with ${Object.keys(relationshipGraph).length} nodes`)
    
    const chunks = await this.createSmartChunks(analysis, relationshipGraph)
    console.log(`📦 Created ${chunks.length} semantic chunks`)
    
    return {
      summary: this.generateSummary(analysis, chunks),
      files: analysis,
      chunks: chunks,
      relationshipGraph,
      recommendations: this.generateRecommendations(analysis, chunks)
    }
  }

  /**
   * Find files matching patterns
   */
  async findFiles(projectPath, patterns) {
    const files = []
    
    for (const pattern of patterns) {
      const matches = await globAsync(pattern, {
        cwd: projectPath,
        ignore: [
          'node_modules/**', 'dist/**', 'build/**', '.git/**',
          '*.test.*', '*.spec.*', '**/test/**', '**/tests/**',
          '**/*.min.js', '**/*.bundle.js', '**/coverage/**',
          '**/.next/**', '**/.cache/**', '**/tmp/**', '**/temp/**'
        ]
      })
      
      // Extra filter to ensure no node_modules files get through
      const filteredMatches = matches.filter(file =>
        !file.includes('node_modules') &&
        !file.includes('dist/') &&
        !file.includes('.min.') &&
        !file.includes('.bundle.')
      )
      
      files.push(...filteredMatches)
    }
    
    return [...new Set(files)] // Remove duplicates
  }

  /**
   * Analyze all files using treesitter
   */
  async analyzeFiles(filePaths, projectPath) {
    const analysis = {}
    
    for (const relativePath of filePaths) {
      // Bulletproof check to skip node_modules
      if (relativePath.includes('node_modules')) {
        console.log(`Skipping node_modules file: ${relativePath}`);
        continue;
      }

      const fullPath = join(projectPath, relativePath)
      if (!existsSync(fullPath)) continue
      
      try {
        const content = readFileSync(fullPath, 'utf8')
        const fileAnalysis = await this.analyzeFile(fullPath, content)
        fileAnalysis.path = relativePath // Store relative path
        analysis[relativePath] = fileAnalysis
      } catch (error) {
        // Silently skip files that can't be parsed - they won't be included in semantic analysis
        // This is normal for complex files or unsupported syntax patterns
        analysis[relativePath] = { error: error.message, path: relativePath }
      }
    }
    
    return analysis
  }

  /**
   * Analyze a single file using treesitter AST
   */
  async analyzeFile(filePath, content) {
    const parser = this.getParser(filePath)
    
    // Skip files that are too large or have syntax errors
    if (content.length > 500000) { // Skip files > 500KB
      throw new Error('File too large')
    }
    
    let tree, rootNode
    try {
      // Use simple string parsing (confirmed working in tests)
      tree = parser.parse(content)
      rootNode = tree.rootNode
      
      // Check for parse errors
      if (rootNode.hasError()) {
        throw new Error('Parse error in file')
      }
    } catch (error) {
      throw new Error(`Tree-sitter parse failed: ${error.message}`)
    }
    
    const analysis = {
      path: filePath,
      fileName: basename(filePath),
      dirName: basename(dirname(filePath)),
      extension: extname(filePath),
      size: content.length,
      lines: content.split('\n').length,
      
      // AST-based analysis
      ast: {
        functions: this.extractFunctions(rootNode, content),
        classes: this.extractClasses(rootNode, content),
        imports: this.extractImports(rootNode, content),
        exports: this.extractExports(rootNode, content),
        variables: this.extractVariables(rootNode, content),
        jsxElements: this.extractJsxElements(rootNode, content),
        typeDefinitions: this.extractTypeDefinitions(rootNode, content)
      },
      
      // Semantic classification
      semanticType: this.classifyFileSemantics(rootNode, content, filePath),
      businessDomain: this.extractBusinessDomain(rootNode, content, filePath),
      technicalPatterns: this.identifyTechnicalPatterns(rootNode, content),
      
      // Relationships
      dependencies: this.analyzeDependencies(rootNode, content),
      complexity: this.calculateAstComplexity(rootNode),
      
      // Metadata
      codeSignature: this.generateCodeSignature(rootNode, content)
    }
    
    // Generate semantic tags based on AST analysis
    analysis.semanticTags = this.generateSemanticTags(analysis)
    
    return analysis
  }

  /**
   * Extract function declarations from AST
   */
  extractFunctions(rootNode, content) {
    const functions = []
    
    // Function declarations
    const functionDeclarations = this.queryNode(rootNode, '(function_declaration name: (identifier) @name)')
    functions.push(...functionDeclarations.map(capture => ({
      name: this.getNodeText(capture.node, content),
      type: 'function_declaration',
      startPosition: capture.node.startPosition,
      endPosition: capture.node.endPosition,
      isExported: this.isNodeExported(capture.node)
    })))
    
    // Arrow functions
    const arrowFunctions = this.queryNode(rootNode, '(variable_declarator name: (identifier) @name value: (arrow_function))')
    functions.push(...arrowFunctions.map(capture => ({
      name: this.getNodeText(capture.node, content),
      type: 'arrow_function',
      startPosition: capture.node.startPosition,
      endPosition: capture.node.endPosition,
      isExported: this.isNodeExported(capture.node.parent.parent)
    })))
    
    // Method definitions
    const methods = this.queryNode(rootNode, '(method_definition name: (property_name) @name)')
    functions.push(...methods.map(capture => ({
      name: this.getNodeText(capture.node, content),
      type: 'method',
      startPosition: capture.node.startPosition,
      endPosition: capture.node.endPosition,
      isExported: false // methods are part of classes
    })))
    
    return functions
  }

  /**
   * Extract class declarations from AST
   */
  extractClasses(rootNode, content) {
    const classes = []
    
    const classDeclarations = this.queryNode(rootNode, '(class_declaration name: (identifier) @name)')
    classes.push(...classDeclarations.map(capture => ({
      name: this.getNodeText(capture.node, content),
      type: 'class',
      startPosition: capture.node.startPosition,
      endPosition: capture.node.endPosition,
      isExported: this.isNodeExported(capture.node.parent),
      methods: this.extractClassMethods(capture.node.parent, content)
    })))
    
    return classes
  }

  /**
   * Extract class methods
   */
  extractClassMethods(classNode, content) {
    const methods = []
    
    try {
      const methodNodes = this.queryNode(classNode, '(method_definition)')
      methods.push(...methodNodes.map(capture => ({
        name: this.getNodeText(capture.node, content),
        type: 'method',
        startPosition: capture.node.startPosition,
        endPosition: capture.node.endPosition
      })))
    } catch (error) {
      // Handle case where method extraction fails
    }
    
    return methods
  }

  /**
   * Extract import statements from AST
   */
  extractImports(rootNode, content) {
    const imports = []
    
    const importStatements = this.queryNode(rootNode, '(import_statement source: (string) @source)')
    imports.push(...importStatements.map(capture => {
      const source = this.getNodeText(capture.node, content).replace(/['"]/g, '')
      return {
        source,
        statement: this.getNodeText(capture.node.parent, content),
        isRelative: source.startsWith('.'),
        isExternal: !source.startsWith('.') && !source.startsWith('/'),
        importedNames: this.extractImportedNames(capture.node.parent, content)
      }
    }))
    
    return imports
  }

  /**
   * Extract export statements from AST  
   */
  extractExports(rootNode, content) {
    const exports = []
    
    // Export declarations
    const exportDeclarations = this.queryNode(rootNode, '(export_statement)')
    exports.push(...exportDeclarations.map(capture => {
      const exportNode = capture.node
      const declaration = exportNode.namedChild(0)
      
      if (declaration) {
        return {
          type: declaration.type === 'export_clause' ? 'named' : 'declaration',
          name: this.extractExportName(declaration, content),
          statement: this.getNodeText(exportNode, content),
          isDefault: this.getNodeText(exportNode, content).includes('default')
        }
      }
      return null
    }).filter(Boolean))
    
    return exports
  }

  /**
   * Extract variable declarations from AST
   */
  extractVariables(rootNode, content) {
    const variables = []
    
    const variableDeclarations = this.queryNode(rootNode, '(variable_declarator name: (identifier) @name)')
    variables.push(...variableDeclarations.map(capture => ({
      name: this.getNodeText(capture.node, content),
      type: 'variable',
      startPosition: capture.node.startPosition,
      endPosition: capture.node.endPosition,
      isExported: this.isNodeExported(capture.node.parent.parent),
      declarationType: capture.node.parent.parent.type // const, let, var
    })))
    
    return variables
  }

  /**
   * Extract JSX elements from AST (for React components)
   */
  extractJsxElements(rootNode, content) {
    const jsxElements = []
    
    try {
      const jsxNodes = this.queryNode(rootNode, '(jsx_element)')
      jsxElements.push(...jsxNodes.map(capture => ({
        elementName: this.extractJsxElementName(capture.node, content),
        startPosition: capture.node.startPosition,
        endPosition: capture.node.endPosition
      })))
    } catch (error) {
      // JSX might not be available in JavaScript parser
    }
    
    return jsxElements
  }

  /**
   * Extract TypeScript type definitions from AST
   */
  extractTypeDefinitions(rootNode, content) {
    const types = []
    
    try {
      // Interface declarations
      const interfaces = this.queryNode(rootNode, '(interface_declaration name: (type_identifier) @name)')
      types.push(...interfaces.map(capture => ({
        name: this.getNodeText(capture.node, content),
        type: 'interface',
        startPosition: capture.node.startPosition,
        endPosition: capture.node.endPosition,
        isExported: this.isNodeExported(capture.node.parent)
      })))
      
      // Type alias declarations  
      const typeAliases = this.queryNode(rootNode, '(type_alias_declaration name: (type_identifier) @name)')
      types.push(...typeAliases.map(capture => ({
        name: this.getNodeText(capture.node, content),
        type: 'type_alias',
        startPosition: capture.node.startPosition,
        endPosition: capture.node.endPosition,
        isExported: this.isNodeExported(capture.node.parent)
      })))
    } catch (error) {
      // TypeScript types might not be available in JavaScript parser
    }
    
    return types
  }

  /**
   * Classify file semantics based on AST patterns
   */
  classifyFileSemantics(rootNode, content, filePath) {
    const classifications = []
    
    // Test each semantic pattern
    for (const [patternName, patternFn] of Object.entries(this.semanticPatterns)) {
      if (patternFn(rootNode, content, filePath)) {
        classifications.push(patternName)
      }
    }
    
    // Return primary classification (most specific first)
    const priority = ['reactComponent', 'reactHook', 'expressRoute', 'expressMiddleware',
                     'cliCommand', 'apiHandler', 'typeDefinition', 'configModule', 'utilityFunction']
    
    for (const pattern of priority) {
      if (classifications.includes(pattern)) {
        return pattern
      }
    }
    
    return 'module'
  }

  /**
   * Semantic pattern: React Component
   */
  isReactComponent(rootNode, content, filePath) {
    // Check for JSX elements
    const hasJsx = this.queryNode(rootNode, '(jsx_element)').length > 0
    
    // Check for React imports
    const hasReactImport = content.includes("import React") || content.includes("from 'react'")
    
    // Check for component naming pattern
    const fileName = basename(filePath, extname(filePath))
    const hasComponentName = fileName[0] === fileName[0].toUpperCase()
    
    // Check for function that returns JSX
    const functions = this.extractFunctions(rootNode, content)
    const hasComponentFunction = functions.some(fn =>
      fn.isExported && fn.name[0] === fn.name[0].toUpperCase()
    )
    
    return (hasJsx && (hasReactImport || hasComponentName)) ||
           (hasComponentFunction && hasReactImport)
  }

  /**
   * Semantic pattern: React Hook
   */
  isReactHook(rootNode, content, filePath) {
    const fileName = basename(filePath, extname(filePath))
    const hasHookName = fileName.startsWith('use') && fileName[3] === fileName[3].toUpperCase()
    
    const functions = this.extractFunctions(rootNode, content)
    const hasHookFunction = functions.some(fn =>
      fn.name.startsWith('use') && fn.name[3] === fn.name[3].toUpperCase() && fn.isExported
    )
    
    const hasReactHookImports = content.includes("from 'react'") &&
                                (content.includes('useState') || content.includes('useEffect'))
    
    return hasHookName || (hasHookFunction && hasReactHookImports)
  }

  /**
   * Semantic pattern: Express Route
   */
  isExpressRoute(rootNode, content, filePath) {
    const hasExpressImport = content.includes("from 'express'") || content.includes("require('express')")
    const hasRouterMethods = /\.(get|post|put|delete|patch)\s*\(/.test(content)
    const hasRoutePattern = /['"`]\/[^'"`]*['"`]/.test(content)
    
    return hasExpressImport && hasRouterMethods && hasRoutePattern
  }

  /**
   * Semantic pattern: Express Middleware
   */
  isExpressMiddleware(rootNode, content, filePath) {
    const hasMiddlewarePattern = /\(req,\s*res,\s*next\)|function\s*\([^)]*req[^)]*res[^)]*next/.test(content)
    const hasExpressImport = content.includes("from 'express'") || content.includes("require('express')")
    const fileName = basename(filePath).toLowerCase()
    
    return (hasMiddlewarePattern && hasExpressImport) || fileName.includes('middleware')
  }

  /**
   * Semantic pattern: CLI Command
   */
  isCliCommand(rootNode, content, filePath) {
    const hasCommanderImport = content.includes('commander') || content.includes('yargs')
    const hasProcessArgv = content.includes('process.argv')
    const hasCliPatterns = content.includes('.command(') || content.includes('.option(')
    const fileName = basename(filePath).toLowerCase()
    
    return hasCommanderImport || (hasProcessArgv && hasCliPatterns) || fileName.includes('cli')
  }

  /**
   * Semantic pattern: Utility Function
   */
  isUtilityFunction(rootNode, content, filePath) {
    const functions = this.extractFunctions(rootNode, content)
    const hasMultipleExportedFunctions = functions.filter(fn => fn.isExported).length > 1
    
    const fileName = basename(filePath).toLowerCase()
    const hasUtilityName = fileName.includes('util') || fileName.includes('helper') || fileName.includes('lib')
    
    const hasNoDomSpecificImports = !content.includes('react') && !content.includes('express')
    
    return hasUtilityName || (hasMultipleExportedFunctions && hasNoDomSpecificImports)
  }

  /**
   * Semantic pattern: API Handler
   */
  isApiHandler(rootNode, content, filePath) {
    const hasApiPattern = /api|handler|controller/i.test(filePath)
    const hasFetchPattern = content.includes('fetch(') || content.includes('axios')
    const hasHttpMethods = /\b(GET|POST|PUT|DELETE|PATCH)\b/.test(content)
    
    return hasApiPattern || (hasFetchPattern && hasHttpMethods)
  }

  /**
   * Semantic pattern: Type Definition
   */
  isTypeDefinition(rootNode, content, filePath) {
    const types = this.extractTypeDefinitions(rootNode, content)
    const hasTypeDefinitions = types.length > 0
    
    const fileName = basename(filePath).toLowerCase()
    const hasTypeFileName = fileName.includes('type') || fileName.includes('.d.ts')
    
    const hasOnlyTypes = hasTypeDefinitions &&
                        this.extractFunctions(rootNode, content).length === 0 &&
                        this.extractClasses(rootNode, content).length === 0
    
    return hasTypeFileName || hasOnlyTypes
  }

  /**
   * Semantic pattern: Config Module
   */
  isConfigModule(rootNode, content, filePath) {
    const fileName = basename(filePath).toLowerCase()
    const hasConfigName = fileName.includes('config') || fileName.includes('setting')
    
    const hasConfigPatterns = content.includes('module.exports') || content.includes('export default')
    const hasConfigObject = /\{[\s\S]*\}/.test(content) && !/function|class/.test(content)
    
    return hasConfigName && (hasConfigPatterns || hasConfigObject)
  }

  /**
   * Extract business domain terms from code
   */
  extractBusinessDomain(rootNode, content, filePath) {
    const domains = []
    
    // Focus on meaningful path segments instead of generic business terms
    const pathSegments = filePath.split('/').filter(s => s && s !== 'src' && s !== 'lib' && s !== 'components')
    const fileName = basename(filePath, extname(filePath))
    
    // Extract domain from directory structure (more reliable than keywords)
    if (pathSegments.length > 0) {
      const relevantSegments = pathSegments.slice(-2) // Last 2 directories
      domains.push(...relevantSegments.map(s => s.toLowerCase()))
    }
    
    // Add meaningful file-based domains
    if (fileName.toLowerCase().includes('config')) domains.push('configuration')
    if (fileName.toLowerCase().includes('test')) domains.push('testing')
    if (fileName.toLowerCase().includes('util')) domains.push('utilities')
    if (fileName.toLowerCase().includes('api')) domains.push('api')
    if (fileName.toLowerCase().includes('ui') || fileName.toLowerCase().includes('component')) {
      domains.push('user-interface')
    }
    
    // Only return meaningful, non-generic domains
    return [...new Set(domains)].filter(domain =>
      domain.length > 2 && !['web', 'src', 'ts', 'js', 'tsx', 'jsx'].includes(domain)
    )
  }

  /**
   * Identify technical patterns in the code
   */
  identifyTechnicalPatterns(rootNode, content) {
    const patterns = []
    
    // Framework patterns
    if (content.includes('react')) patterns.push('react')
    if (content.includes('express')) patterns.push('express')
    if (content.includes('typescript')) patterns.push('typescript')
    
    // Architecture patterns
    if (content.includes('async') && content.includes('await')) patterns.push('async-await')
    if (content.includes('Promise')) patterns.push('promises')
    if (content.includes('class') && content.includes('extends')) patterns.push('inheritance')
    
    // Design patterns
    const functions = this.extractFunctions(rootNode, content)
    if (functions.some(f => f.name.includes('Factory'))) patterns.push('factory-pattern')
    if (functions.some(f => f.name.includes('Observer'))) patterns.push('observer-pattern')
    
    return patterns
  }

  /**
   * Build relationship graph between files
   */
  buildRelationshipGraph(analysis) {
    const graph = {}
    
    for (const [filePath, fileAnalysis] of Object.entries(analysis)) {
      if (fileAnalysis.error) continue
      
      graph[filePath] = {
        imports: [],
        importedBy: [],
        semanticSimilarity: {},
        businessDomainOverlap: {},
        technicalPatternOverlap: {}
      }
    }
    
    // Build import relationships
    for (const [filePath, fileAnalysis] of Object.entries(analysis)) {
      if (fileAnalysis.error) continue
      
      for (const imp of fileAnalysis.ast.imports) {
        if (imp.isRelative) {
          // Resolve relative import to actual file path
          const importPath = this.resolveImportPath(filePath, imp.source)
          if (graph[importPath]) {
            graph[filePath].imports.push(importPath)
            graph[importPath].importedBy.push(filePath)
          }
        }
      }
    }
    
    // Calculate semantic similarities
    for (const [fileA, analysisA] of Object.entries(analysis)) {
      if (analysisA.error) continue
      
      for (const [fileB, analysisB] of Object.entries(analysis)) {
        if (analysisB.error || fileA === fileB) continue
        
        // Semantic type similarity
        const semanticSimilarity = analysisA.semanticType === analysisB.semanticType ? 1.0 : 0.0
        
        // Business domain overlap
        const domainOverlap = this.calculateOverlap(analysisA.businessDomain, analysisB.businessDomain)
        
        // Technical pattern overlap
        const patternOverlap = this.calculateOverlap(analysisA.technicalPatterns, analysisB.technicalPatterns)
        
        if (semanticSimilarity > 0 || domainOverlap > 0 || patternOverlap > 0) {
          graph[fileA].semanticSimilarity[fileB] = semanticSimilarity
          graph[fileA].businessDomainOverlap[fileB] = domainOverlap
          graph[fileA].technicalPatternOverlap[fileB] = patternOverlap
        }
      }
    }
    
    return graph
  }

  /**
   * Create smart chunks using clustering algorithms
   */
  async createSmartChunks(analysis, relationshipGraph) {
    
    // Start with individual files as nodes
    const nodes = Object.keys(analysis).filter(path => !analysis[path].error)
    console.log(`🧩 Starting with ${nodes.length} nodes for clustering`)
    
    // Apply different clustering strategies
    const strategies = [
      this.clusterBySemanticType.bind(this),
      this.clusterByBusinessDomain.bind(this),
      this.clusterByDependencyGraph.bind(this),
      this.clusterByDirectoryStructure.bind(this)
    ]
    
    let clusters = nodes.map(node => [node]) // Start with individual nodes
    
    // Apply clustering strategies
    for (const strategy of strategies) {
      clusters = strategy(clusters, analysis, relationshipGraph)
      console.log(`📦 After ${strategy.name}: ${clusters.length} clusters`)
    }
    
    // Convert clusters to named chunks
    const chunks = []
    const usedNames = new Set()
    
    for (const cluster of clusters) {
      if (cluster.length === 0) continue
      
      let chunkName = await this.generateChunkName(cluster, analysis)
      
      // Ensure unique names
      let uniqueName = chunkName
      let counter = 1
      while (usedNames.has(uniqueName)) {
        uniqueName = `${chunkName}-${counter}`
        counter++
      }
      usedNames.add(uniqueName)
      
      const chunk = {
        name: uniqueName,
        type: this.determineChunkType(cluster, analysis),
        files: cluster,
        size: cluster.reduce((sum, file) => sum + analysis[file].size, 0),
        complexity: this.calculateClusterComplexity(cluster, analysis),
        dependencies: this.calculateClusterDependencies(cluster, analysis),
        businessDomains: this.extractClusterBusinessDomains(cluster, analysis),
        technicalPatterns: this.extractClusterTechnicalPatterns(cluster, analysis),
        purpose: this.determineClusterPurpose(cluster, analysis),
        cohesion: this.calculateClusterCohesion(cluster, relationshipGraph),
        recommendations: this.generateClusterRecommendations(cluster, analysis),
        tags: this.generateTags(cluster, analysis)
      }
      
      chunks.push(chunk)
    }
    
    return chunks.sort((a, b) => b.cohesion - a.cohesion) // Sort by cohesion (best chunks first)
  }

  /**
   * Cluster files by semantic type
   */
  clusterBySemanticType(clusters, analysis, relationshipGraph) {
    const semanticGroups = {}
    
    for (const cluster of clusters) {
      for (const file of cluster) {
        const semanticType = analysis[file].semanticType
        if (!semanticGroups[semanticType]) {
          semanticGroups[semanticType] = []
        }
        semanticGroups[semanticType].push(file)
      }
    }
    
    return Object.values(semanticGroups).filter(group => group.length > 0)
  }

  /**
   * Cluster files by business domain
   */
  clusterByBusinessDomain(clusters, analysis, relationshipGraph) {
    const domainGroups = {}
    
    for (const cluster of clusters) {
      for (const file of cluster) {
        const domains = analysis[file].businessDomain
        
        if (domains.length === 0) {
          // Files with no clear domain go to 'general' group
          if (!domainGroups.general) domainGroups.general = []
          domainGroups.general.push(file)
        } else {
          // Files go to their primary domain group
          const primaryDomain = domains[0]
          if (!domainGroups[primaryDomain]) domainGroups[primaryDomain] = []
          domainGroups[primaryDomain].push(file)
        }
      }
    }
    
    return Object.values(domainGroups).filter(group => group.length > 0)
  }

  /**
   * Cluster files by dependency relationships
   */
  clusterByDependencyGraph(clusters, analysis, relationshipGraph) {
    const dependencyGroups = []
    const visited = new Set()
    
    for (const cluster of clusters) {
      for (const file of cluster) {
        if (visited.has(file)) continue
        
        // Find all files connected to this file through imports
        const connected = this.findConnectedFiles(file, relationshipGraph, new Set())
        
        // Filter to only files in current clusters
        const relevantConnected = connected.filter(f =>
          clusters.some(cluster => cluster.includes(f))
        )
        
        if (relevantConnected.length > 1) {
          dependencyGroups.push(relevantConnected)
          relevantConnected.forEach(f => visited.add(f))
        } else {
          // Isolated file becomes its own group
          dependencyGroups.push([file])
          visited.add(file)
        }
      }
    }
    
    return dependencyGroups.filter(group => group.length > 0)
  }

  /**
   * Cluster files by directory structure
   */
  clusterByDirectoryStructure(clusters, analysis, relationshipGraph) {
    const directoryGroups = {}
    
    for (const cluster of clusters) {
      for (const file of cluster) {
        const dir = dirname(file)
        if (!directoryGroups[dir]) {
          directoryGroups[dir] = []
        }
        directoryGroups[dir].push(file)
      }
    }
    
    return Object.values(directoryGroups).filter(group => group.length > 0)
  }

  /**
   * Generate intelligent chunk name
   */
  async generateChunkName(files, analysis) {
    const namingStrategies = {
      domainBased: this.generateDomainBasedName.bind(this),
      patternBased: this.generatePatternBasedName.bind(this),
      functionalityBased: this.generateFunctionalityBasedName.bind(this)
    }
    
    const names = {}
    
    for (const [strategy, generator] of Object.entries(namingStrategies)) {
      try {
        names[strategy] = generator(files, analysis)
      } catch (error) {
        names[strategy] = 'unnamed-chunk'
      }
    }
    
    // Choose best name based on strategy preference - prefer pattern-based for better names
    const strategy = 'patternBased' // Force pattern-based naming
    return names[strategy] || names.patternBased || names.functionalityBased || names.domainBased || 'unknown-chunk'
  }

  /**
   * Generate domain-based chunk name
   */
  generateDomainBasedName(files, analysis) {
    // Always fallback to pattern-based naming since domain extraction is unreliable
    return this.generatePatternBasedName(files, analysis)
  }

  /**
   * Generate pattern-based chunk name
   */
  generatePatternBasedName(files, analysis) {
    const semanticTypes = files.map(file => analysis[file].semanticType)
    const mostCommon = this.getMostCommon(semanticTypes)
    
    // Look at actual file names and directories for context
    const commonPath = this.findCommonPath(files)
    const dirName = commonPath ? basename(dirname(commonPath)) : null
    
    const typeNames = {
      reactComponent: 'ui-components',
      reactHook: 'react-hooks',
      expressRoute: 'server-routes',
      expressMiddleware: 'server-middleware',
      utilityFunction: 'utility-functions',
      typeDefinition: 'type-definitions',
      configModule: 'configuration',
      cliCommand: 'cli-tools',
      apiHandler: 'api-endpoints',
      module: 'shared-modules'
    }
    
    let baseName = typeNames[mostCommon] || 'mixed-files'
    
    // Add more specific context based on file paths
    if (commonPath) {
      if (commonPath.includes('/components/ui/')) {
        baseName = 'ui-library-components'
      } else if (commonPath.includes('/components/')) {
        baseName = 'application-components'
      } else if (commonPath.includes('/hooks/')) {
        baseName = 'custom-hooks'
      } else if (commonPath.includes('/lib/')) {
        baseName = 'core-utilities'
      } else if (commonPath.includes('/utils/')) {
        baseName = 'helper-utilities'
      } else if (dirName && dirName !== 'src' && dirName !== 'components' && dirName !== 'lib') {
        baseName = `${dirName}-${baseName}`
      }
    }
    
    return baseName
  }

  /**
   * Generate functionality-based chunk name
   */
  generateFunctionalityBasedName(files, analysis) {
    // Extract function names and find common themes
    const allFunctions = files.flatMap(file =>
      analysis[file].ast.functions.map(fn => fn.name.toLowerCase())
    )
    
    const commonWords = this.extractCommonWords(allFunctions)
    
    if (commonWords.length > 0) {
      return commonWords.slice(0, 2).join('-') + '-logic'
    }
    
    // Fallback to directory-based naming
    const dirs = files.map(file => basename(dirname(file)))
    const commonDir = this.getMostCommon(dirs)
    
    return commonDir + '-module'
  }

  /**
   * Helper methods for AST analysis
   */

  queryNode(node, query) {
    // Simplified query implementation
    // In a full implementation, you'd use tree-sitter's query language
    const results = []
    
    const traverse = (currentNode) => {
      // Match based on node type for now
      if (query.includes(currentNode.type)) {
        results.push({ node: currentNode })
      }
      
      for (let i = 0; i < currentNode.namedChildCount; i++) {
        traverse(currentNode.namedChild(i))
      }
    }
    
    traverse(node)
    return results
  }

  getNodeText(node, content) {
    return content.slice(node.startIndex, node.endIndex)
  }

  isNodeExported(node) {
    // Check if node is part of an export statement
    let parent = node.parent
    while (parent) {
      if (parent.type === 'export_statement') {
        return true
      }
      parent = parent.parent
    }
    return false
  }

  calculateOverlap(arrayA, arrayB) {
    const setA = new Set(arrayA)
    const setB = new Set(arrayB)
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    
    return union.size === 0 ? 0 : intersection.size / union.size
  }

  getMostCommon(arr) {
    const counts = {}
    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1
    }
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown'
  }

  generateSemanticTags(analysis) {
    const tags = []
    
    tags.push(analysis.semanticType)
    tags.push(...analysis.businessDomain)
    tags.push(...analysis.technicalPatterns)
    
    if (analysis.complexity.level) {
      tags.push(`complexity-${analysis.complexity.level}`)
    }
    
    if (analysis.lines < 50) tags.push('small')
    else if (analysis.lines < 200) tags.push('medium')  
    else tags.push('large')
    
    return [...new Set(tags)]
  }

  calculateAstComplexity(rootNode) {
    let complexity = 1
    
    const complexityNodes = ['if_statement', 'while_statement', 'for_statement',
                            'switch_statement', 'try_statement', 'catch_clause']
    
    const traverse = (node) => {
      if (complexityNodes.includes(node.type)) {
        complexity++
      }
      
      for (let i = 0; i < node.namedChildCount; i++) {
        traverse(node.namedChild(i))
      }
    }
    
    traverse(rootNode)
    
    return {
      score: complexity,
      level: complexity < 5 ? 'low' : complexity < 15 ? 'medium' : 'high'
    }
  }

  /**
   * Analyze dependencies from AST
   */
  analyzeDependencies(rootNode, content) {
    const dependencies = {
      internal: [],
      external: [],
      relative: []
    }
    
    const imports = this.extractImports(rootNode, content)
    
    for (const imp of imports) {
      if (imp.isRelative) {
        dependencies.relative.push(imp.source)
      } else if (imp.isExternal) {
        dependencies.external.push(imp.source)
      } else {
        dependencies.internal.push(imp.source)
      }
    }
    
    return dependencies
  }

  /**
   * Resolve relative import path to absolute path
   */
  resolveImportPath(fromFile, importPath) {
    // Simplified path resolution
    const dir = dirname(fromFile)
    return join(dir, importPath)
  }

  /**
   * Find all files connected through imports
   */
  findConnectedFiles(startFile, relationshipGraph, visited = new Set()) {
    if (visited.has(startFile)) return []
    
    visited.add(startFile)
    const connected = [startFile]
    
    if (relationshipGraph[startFile]) {
      // Follow imports
      for (const importedFile of relationshipGraph[startFile].imports) {
        connected.push(...this.findConnectedFiles(importedFile, relationshipGraph, visited))
      }
      
      // Follow files that import this one
      for (const importingFile of relationshipGraph[startFile].importedBy) {
        connected.push(...this.findConnectedFiles(importingFile, relationshipGraph, visited))
      }
    }
    
    return [...new Set(connected)]
  }

  /**
   * Extract imported names from import statement
   */
  extractImportedNames(importNode, content) {
    const names = []
    // Simplified implementation - would need more complex parsing
    const importText = this.getNodeText(importNode, content)
    const match = importText.match(/import\s+(?:\{([^}]+)\}|(\w+))/i)
    if (match) {
      if (match[1]) {
        // Named imports
        names.push(...match[1].split(',').map(n => n.trim()))
      } else if (match[2]) {
        // Default import
        names.push(match[2])
      }
    }
    return names
  }

  /**
   * Extract export name from export declaration
   */
  extractExportName(declaration, content) {
    const text = this.getNodeText(declaration, content)
    const match = text.match(/(?:function|class|const|let|var)\s+(\w+)/)
    return match ? match[1] : 'unnamed'
  }

  /**
   * Extract JSX element name
   */
  extractJsxElementName(jsxNode, content) {
    try {
      const openingElement = jsxNode.namedChild(0)
      if (openingElement) {
        const nameNode = openingElement.namedChild(0)
        return nameNode ? this.getNodeText(nameNode, content) : 'unknown'
      }
    } catch (error) {
      return 'unknown'
    }
    return 'unknown'
  }

  /**
   * Determine chunk type based on files
   */
  determineChunkType(files, analysis) {
    const semanticTypes = files.map(file => analysis[file].semanticType)
    const mostCommon = this.getMostCommon(semanticTypes)
    
    const typeMapping = {
      reactComponent: 'ui-components',
      reactHook: 'custom-hooks',
      expressRoute: 'api-routes',
      expressMiddleware: 'middleware',
      utilityFunction: 'utilities',
      typeDefinition: 'type-definitions',
      configModule: 'configuration',
      cliCommand: 'cli-commands',
      apiHandler: 'api-handlers'
    }
    
    return typeMapping[mostCommon] || 'mixed-module'
  }

  /**
   * Calculate cluster complexity
   */
  calculateClusterComplexity(files, analysis) {
    const complexities = files.map(file => analysis[file].complexity.score)
    const total = complexities.reduce((sum, c) => sum + c, 0)
    const average = total / files.length
    
    return {
      total,
      average,
      level: average < 5 ? 'low' : average < 15 ? 'medium' : 'high'
    }
  }

  /**
   * Calculate cluster dependencies
   */
  calculateClusterDependencies(files, analysis) {
    const allDeps = {
      internal: new Set(),
      external: new Set(),
      relative: new Set()
    }
    
    for (const file of files) {
      const deps = analysis[file].dependencies
      deps.internal.forEach(dep => allDeps.internal.add(dep))
      deps.external.forEach(dep => allDeps.external.add(dep))
      deps.relative.forEach(dep => allDeps.relative.add(dep))
    }
    
    return {
      internal: Array.from(allDeps.internal),
      external: Array.from(allDeps.external),
      relative: Array.from(allDeps.relative),
      totalCount: allDeps.internal.size + allDeps.external.size + allDeps.relative.size
    }
  }

  /**
   * Extract cluster business domains
   */
  extractClusterBusinessDomains(files, analysis) {
    const allDomains = files.flatMap(file => analysis[file].businessDomain)
    return [...new Set(allDomains)]
  }

  /**
   * Extract cluster technical patterns
   */
  extractClusterTechnicalPatterns(files, analysis) {
    const allPatterns = files.flatMap(file => analysis[file].technicalPatterns)
    return [...new Set(allPatterns)]
  }

  /**
   * Determine cluster purpose
   */
  determineClusterPurpose(files, analysis) {
    const semanticTypes = files.map(file => analysis[file].semanticType)
    const mostCommon = this.getMostCommon(semanticTypes)
    
    const purposeMapping = {
      reactComponent: 'User interface components and React elements',
      reactHook: 'Custom React hooks for state and logic sharing',
      expressRoute: 'API routes and endpoint handlers',
      expressMiddleware: 'Express middleware and request processing',
      utilityFunction: 'Utility functions and helper libraries',
      typeDefinition: 'TypeScript type definitions and interfaces',
      configModule: 'Configuration files and settings',
      cliCommand: 'Command-line interface and CLI tools',
      apiHandler: 'API client and data fetching logic'
    }
    
    return purposeMapping[mostCommon] || 'Mixed functionality module'
  }

  /**
   * Calculate cluster cohesion
   */
  calculateClusterCohesion(files, relationshipGraph) {
    if (files.length <= 1) return 1.0
    
    let connections = 0
    let totalPossible = files.length * (files.length - 1)
    
    for (const fileA of files) {
      for (const fileB of files) {
        if (fileA !== fileB && relationshipGraph[fileA]) {
          if (relationshipGraph[fileA].imports.includes(fileB) ||
              relationshipGraph[fileA].importedBy.includes(fileB) ||
              relationshipGraph[fileA].semanticSimilarity[fileB] > 0.5) {
            connections++
          }
        }
      }
    }
    
    return totalPossible > 0 ? connections / totalPossible : 0
  }

  /**
   * Generate cluster recommendations
   */
  generateClusterRecommendations(files, analysis) {
    const recommendations = []
    
    const totalSize = files.reduce((sum, file) => sum + analysis[file].size, 0)
    const avgComplexity = files.reduce((sum, file) => sum + analysis[file].complexity.score, 0) / files.length
    
    if (totalSize > 100000) {
      recommendations.push({
        type: 'warning',
        message: 'Large cluster - consider splitting by functionality'
      })
    }
    
    if (avgComplexity > 20) {
      recommendations.push({
        type: 'warning',
        message: 'High complexity cluster - review for refactoring opportunities'
      })
    }
    
    if (files.length === 1) {
      recommendations.push({
        type: 'info',
        message: 'Single file cluster - consider grouping with related files'
      })
    }
    
    return recommendations
  }

  /**
   * Extract common words from function names
   */
  extractCommonWords(functionNames) {
    const words = functionNames.flatMap(name =>
      name.split(/(?=[A-Z])|_|-/).filter(word => word.length > 2)
    )
    
    const wordCounts = {}
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1
    }
    
    return Object.entries(wordCounts)
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word)
  }

  /**
   * Generate code signature for caching and similarity comparison
   */
  generateCodeSignature(rootNode, content) {
    const functions = this.extractFunctions(rootNode, content)
    const classes = this.extractClasses(rootNode, content)
    const imports = this.extractImports(rootNode, content)
    const exports = this.extractExports(rootNode, content)
    
    return {
      functionCount: functions.length,
      classCount: classes.length,
      importCount: imports.length,
      exportCount: exports.length,
      exportedFunctions: functions.filter(f => f.isExported).map(f => f.name),
      importSources: imports.map(i => i.source),
      hasJsx: this.extractJsxElements(rootNode, content).length > 0,
      contentHash: this.simpleHash(content)
    }
  }

  /**
   * Simple hash function for content comparison
   */
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash
  }
  
  generateSummary(analysis, chunks) {
    const files = Object.values(analysis).filter(f => !f.error)
    
    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      totalLines: files.reduce((sum, f) => sum + f.lines, 0),
      semanticTypes: this.countByProperty(files, 'semanticType'),
      businessDomains: this.countDomains(files),
      technicalPatterns: this.countPatterns(files),
      totalChunks: chunks.length,
      averageChunkSize: chunks.reduce((sum, c) => sum + c.size, 0) / chunks.length,
      chunkTypes: this.countByProperty(chunks, 'type')
    }
  }

  generateRecommendations(analysis, chunks) {
    const recommendations = []
    
    // Add specific recommendations based on treesitter analysis
    
    return recommendations
  }

  countByProperty(items, property) {
    const counts = {}
    for (const item of items) {
      const value = typeof property === 'function' ? property(item) : item[property]
      counts[value] = (counts[value] || 0) + 1
    }
    return counts
  }

  countDomains(files) {
    const allDomains = files.flatMap(f => f.businessDomain)
    return this.countByProperty(allDomains, d => d)
  }

  countPatterns(files) {
    const allPatterns = files.flatMap(f => f.technicalPatterns)
    return this.countByProperty(allPatterns, p => p)
  }

  /**
   * Generate tags for a chunk based on its characteristics
   */
  generateTags(files, analysis) {
    const tags = new Set()
    
    // Add semantic type tags
    const semanticTypes = files.map(file => analysis[file].semanticType)
    for (const type of semanticTypes) {
      if (type === 'reactComponent') tags.add('react-component')
      if (type === 'reactHook') tags.add('react-hook')
      if (type === 'utilityFunction') tags.add('utility')
      if (type === 'expressRoute') tags.add('api')
      if (type === 'configModule') tags.add('config')
    }
    
    // Add directory-based tags
    const commonPath = this.findCommonPath(files)
    if (commonPath) {
      if (commonPath.includes('/components/')) tags.add('component')
      if (commonPath.includes('/hooks/')) tags.add('hook')
      if (commonPath.includes('/lib/')) tags.add('library')
      if (commonPath.includes('/utils/')) tags.add('utility')
      if (commonPath.includes('/ui/')) tags.add('ui-library')
    }
    
    // Add complexity tags
    const avgComplexity = files.reduce((sum, file) => sum + analysis[file].complexity.score, 0) / files.length
    if (avgComplexity > 15) tags.add('complex')
    if (avgComplexity < 5) tags.add('simple')
    
    return Array.from(tags)
  }

  /**
   * Find common path prefix for a group of files
   */
  findCommonPath(files) {
    if (files.length === 0) return null
    if (files.length === 1) return files[0]
    
    const pathParts = files.map(file => file.split('/'))
    const commonParts = []
    
    for (let i = 0; i < Math.min(...pathParts.map(p => p.length)); i++) {
      const part = pathParts[0][i]
      if (pathParts.every(p => p[i] === part)) {
        commonParts.push(part)
      } else {
        break
      }
    }
    
    return commonParts.length > 0 ? commonParts.join('/') : null
  }
}

export default TreesitterSemanticChunker
