/**
 * True Semantic Splitting - Function-level code chunks with context
 * Creates surgical, self-contained chunks for AI consumption
 * Operates parallel to file-level bundle system
 */

import { readFileSync, existsSync } from 'fs'
import { extname, basename, dirname, join } from 'path'
import glob from 'glob'
import HeuristicsManager from './heuristics-manager.js'

export default class SemanticSplitter {
  constructor(options = {}) {
    this.options = {
      maxChunkSize: 2000,       // Max chars per chunk
      includeContext: true,     // Include imports/types needed
      groupRelated: true,       // Group related functions
      minFunctionSize: 50,      // Skip tiny functions
      ...options
    }
    
    // Initialize heuristics manager
    this.heuristicsManager = new HeuristicsManager()
  }

  /**
   * Extract semantic chunks from project
   */
  async extractSemanticChunks(projectPath, patterns = ['**/*.{js,jsx,ts,tsx,mjs}'], bundleConfig = null) {
    console.log('🔪 Starting semantic splitting...')
    
    const files = this.findFiles(projectPath, patterns)
    console.log(`📁 Found ${files.length} files to split`)
    
    // Load bundle configuration if provided
    this.bundleConfig = bundleConfig
    
    const allFunctions = []
    const allTypes = []
    const allImports = []
    
    // Extract all code elements
    for (const filePath of files) {
      try {
        const elements = this.extractCodeElements(filePath, projectPath)
        allFunctions.push(...elements.functions)
        allTypes.push(...elements.types)
        allImports.push(...elements.imports)
      } catch (error) {
        console.warn(`Failed to extract from ${filePath}: ${error.message}`)
      }
    }
    
    console.log(`⚡ Extracted ${allFunctions.length} functions, ${allTypes.length} types`)
    
    // Create semantic chunks
    const chunks = this.createSemanticChunks(allFunctions, allTypes, allImports)
    console.log(`🧩 Created ${chunks.length} semantic chunks`)
    
    return {
      summary: {
        totalFiles: files.length,
        totalFunctions: allFunctions.length,
        totalChunks: chunks.length,
        averageChunkSize: chunks.reduce((sum, c) => sum + c.code.length, 0) / chunks.length
      },
      chunks: chunks
    }
  }

  /**
   * Find files to analyze (same logic as bundles)
   */
  findFiles(projectPath, patterns) {
    const files = []
    
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: projectPath,
        ignore: [
          'node_modules/**', 'dist/**', 'build/**', '.git/**',
          '*.test.*', '*.spec.*', '**/test/**', '**/tests/**',
          '**/*.min.js', '**/*.bundle.js'
        ]
      })
      
      files.push(...matches.filter(file => 
        !file.includes('node_modules') && 
        !file.includes('dist/') &&
        !file.includes('.min.')
      ))
    }
    
    return [...new Set(files)]
  }

  /**
   * Extract functions, types, and imports from a file
   */
  extractCodeElements(relativePath, projectPath) {
    const fullPath = join(projectPath, relativePath)
    if (!existsSync(fullPath)) return { functions: [], types: [], imports: [] }
    
    const content = readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')
    
    return {
      functions: this.extractFunctions(content, lines, relativePath),
      types: this.extractTypes(content, lines, relativePath),
      imports: this.extractImports(content, relativePath)
    }
  }

  /**
   * Extract functions with robust regex patterns
   */
  extractFunctions(content, lines, filePath) {
    const functions = []
    
    // Pattern 1: Regular function declarations
    const functionRegex = /^(\s*)(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm
    
    // Pattern 2: Arrow functions assigned to const/let
    const arrowRegex = /^(\s*)(?:export\s+)?const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*[\{]/gm
    
    // Pattern 3: Class methods
    const methodRegex = /^(\s+)(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm
    
    // Pattern 4: React components (function components)
    const componentRegex = /^(\s*)(?:export\s+(?:default\s+)?)?function\s+([A-Z][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm
    
    const patterns = [
      { regex: functionRegex, type: 'function' },
      { regex: arrowRegex, type: 'arrow_function' },
      { regex: methodRegex, type: 'method' },
      { regex: componentRegex, type: 'react_component' }
    ]
    
    for (const { regex, type } of patterns) {
      let match
      while ((match = regex.exec(content)) !== null) {
        const functionName = match[2]
        const indentation = match[1]
        const startIndex = match.index
        
        // Skip if it's a keyword or common false positive
        if (['if', 'for', 'while', 'switch', 'catch'].includes(functionName)) {
          continue
        }
        
        const startLine = content.substring(0, startIndex).split('\n').length
        const functionBody = this.extractFunctionBody(content, startIndex)
        
        if (functionBody && functionBody.length > this.options.minFunctionSize) {
          functions.push({
            name: functionName,
            type: type,
            filePath: filePath,
            startLine: startLine,
            code: functionBody,
            indentation: indentation.length,
            isExported: match[0].includes('export'),
            isAsync: match[0].includes('async'),
            size: functionBody.length
          })
        }
      }
    }
    
    return functions
  }

  /**
   * Extract function body using brace matching
   */
  extractFunctionBody(content, startIndex) {
    const openBraceIndex = content.indexOf('{', startIndex)
    if (openBraceIndex === -1) return null
    
    let braceCount = 0
    let currentIndex = openBraceIndex
    let inString = false
    let stringChar = null
    
    while (currentIndex < content.length) {
      const char = content[currentIndex]
      const prevChar = content[currentIndex - 1] || ''
      
      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
          stringChar = null
        }
      }
      
      // Count braces outside strings
      if (!inString) {
        if (char === '{') braceCount++
        else if (char === '}') braceCount--
        
        if (braceCount === 0) {
          // Found the closing brace
          return content.substring(startIndex, currentIndex + 1).trim()
        }
      }
      
      currentIndex++
    }
    
    return null // Unmatched braces
  }

  /**
   * Extract type definitions and interfaces
   */
  extractTypes(content, lines, filePath) {
    const types = []
    
    // TypeScript interfaces
    const interfaceRegex = /^(\s*)(?:export\s+)?interface\s+([A-Z][a-zA-Z0-9_$]*)\s*\{/gm
    
    // Type aliases
    const typeRegex = /^(\s*)(?:export\s+)?type\s+([A-Z][a-zA-Z0-9_$]*)\s*=/gm
    
    const patterns = [
      { regex: interfaceRegex, type: 'interface' },
      { regex: typeRegex, type: 'type_alias' }
    ]
    
    for (const { regex, type } of patterns) {
      let match
      while ((match = regex.exec(content)) !== null) {
        const typeName = match[2]
        const startIndex = match.index
        const startLine = content.substring(0, startIndex).split('\n').length
        
        let typeBody
        if (type === 'interface') {
          typeBody = this.extractTypeBody(content, startIndex)
        } else {
          // For type aliases, extract until semicolon or newline
          const endIndex = content.indexOf(';', startIndex)
          typeBody = content.substring(startIndex, endIndex + 1).trim()
        }
        
        if (typeBody) {
          types.push({
            name: typeName,
            type: type,
            filePath: filePath,
            startLine: startLine,
            code: typeBody,
            isExported: match[0].includes('export')
          })
        }
      }
    }
    
    return types
  }

  /**
   * Extract type body (similar to function body)
   */
  extractTypeBody(content, startIndex) {
    const openBraceIndex = content.indexOf('{', startIndex)
    if (openBraceIndex === -1) return null
    
    let braceCount = 0
    let currentIndex = openBraceIndex
    
    while (currentIndex < content.length) {
      const char = content[currentIndex]
      
      if (char === '{') braceCount++
      else if (char === '}') braceCount--
      
      if (braceCount === 0) {
        return content.substring(startIndex, currentIndex + 1).trim()
      }
      
      currentIndex++
    }
    
    return null
  }

  /**
   * Extract import statements
   */
  extractImports(content, filePath) {
    const imports = []
    const importRegex = /^(\s*)import\s+(.+?)\s+from\s+['"`]([^'"`]+)['"`]/gm
    
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importStatement = match[0].trim()
      const importPath = match[3]
      
      imports.push({
        statement: importStatement,
        path: importPath,
        filePath: filePath,
        isRelative: importPath.startsWith('.'),
        isExternal: !importPath.startsWith('.')
      })
    }
    
    return imports
  }

  /**
   * Create semantic chunks from extracted elements
   */
  createSemanticChunks(functions, types, imports) {
    const chunks = []
    
    // Create function-level chunks
    for (const func of functions) {
      const chunk = this.createFunctionChunk(func, types, imports)
      if (chunk) {
        chunks.push(chunk)
      }
    }
    
    // Create type-only chunks for standalone types
    for (const type of types) {
      if (!this.isTypeUsedInFunctions(type, functions)) {
        chunks.push(this.createTypeChunk(type, imports))
      }
    }
    
    return chunks
  }

  /**
   * Create a semantic chunk for a function with its context
   */
  createFunctionChunk(func, allTypes, allImports) {
    let chunkCode = ''
    const includedImports = new Set()
    const includedTypes = new Set()
    
    // Find relevant imports for this function
    const fileImports = allImports.filter(imp => imp.filePath === func.filePath)
    
    // Find types referenced in the function
    const referencedTypes = this.findReferencedTypes(func.code, allTypes)
    
    // Add necessary imports
    for (const imp of fileImports) {
      if (this.isImportRelevant(imp, func.code)) {
        chunkCode += imp.statement + '\n'
        includedImports.add(imp.path)
      }
    }
    
    // Add referenced types
    for (const type of referencedTypes) {
      chunkCode += '\n' + type.code + '\n'
      includedTypes.add(type.name)
    }
    
    // Add the function itself
    chunkCode += '\n' + func.code
    
    // Create chunk with adaptive sizing - never lose functions
    let finalCode = chunkCode.trim()
    let contextLevel = 'full'
    
    // If too large, try with reduced context
    if (chunkCode.length > this.options.maxChunkSize) {
      // Fallback 1: Function + essential imports only (no types)
      finalCode = ''
      for (const imp of fileImports.slice(0, 3)) { // Limit to 3 imports
        if (this.isImportRelevant(imp, func.code)) {
          finalCode += imp.statement + '\n'
        }
      }
      finalCode += '\n' + func.code
      contextLevel = 'reduced'
    }
    
    // If still too large, function only
    if (finalCode.length > this.options.maxChunkSize) {
      finalCode = func.code
      contextLevel = 'minimal'
    }
    
    // Always create a chunk - never lose functions
    return {
      name: func.name,
      type: 'function_chunk',
      subtype: func.type,
      code: finalCode,
      size: finalCode.length,
      filePath: func.filePath,
      startLine: func.startLine,
      isExported: func.isExported,
      isAsync: func.isAsync,
      complexity: this.calculateComplexity(func.code),
      includes: {
        imports: contextLevel === 'minimal' ? [] : Array.from(includedImports),
        types: contextLevel === 'full' ? Array.from(includedTypes) : []
      },
      purpose: this.determinePurpose(func),
      tags: [...this.generateTags(func), contextLevel === 'full' ? 'full-context' : contextLevel === 'reduced' ? 'reduced-context' : 'minimal-context'],
      bundles: this.getFileBundles(func.filePath)
    }
  }

  /**
   * Create a chunk for standalone types
   */
  createTypeChunk(type, allImports) {
    let chunkCode = ''
    const includedImports = new Set()
    
    // Add relevant imports if any
    const fileImports = allImports.filter(imp => imp.filePath === type.filePath)
    for (const imp of fileImports.slice(0, 3)) { // Limit imports
      chunkCode += imp.statement + '\n'
    }
    
    chunkCode += '\n' + type.code
    
    return {
      name: type.name,
      type: 'type_chunk',
      subtype: type.type,
      code: chunkCode.trim(),
      size: chunkCode.length,
      filePath: type.filePath,
      startLine: type.startLine,
      isExported: type.isExported,
      purpose: 'Type definition',
      tags: ['type', type.type],
      bundles: this.getFileBundles(type.filePath)
    }
  }

  /**
   * Find types referenced in function code
   */
  findReferencedTypes(functionCode, allTypes) {
    const referenced = []
    
    for (const type of allTypes) {
      // Check if type name appears in function code
      const typeRegex = new RegExp(`\\b${type.name}\\b`, 'g')
      if (typeRegex.test(functionCode)) {
        referenced.push(type)
      }
    }
    
    return referenced
  }

  /**
   * Check if import is relevant to function
   */
  isImportRelevant(importStatement, functionCode) {
    // Simple heuristic: check if any imported identifiers appear in function
    const importMatch = importStatement.statement.match(/import\s+(.+?)\s+from/)
    if (!importMatch) return false
    
    const imported = importMatch[1]
    
    // Handle different import styles
    if (imported.includes('{')) {
      // Named imports: import { foo, bar } from 'module'
      const namedImports = imported.match(/\{([^}]+)\}/)?.[1]
      if (namedImports) {
        const names = namedImports.split(',').map(name => name.trim())
        return names.some(name => functionCode.includes(name))
      }
    } else {
      // Default import: import foo from 'module'
      const defaultImport = imported.trim()
      return functionCode.includes(defaultImport)
    }
    
    return false
  }

  /**
   * Check if type is used in any function
   */
  isTypeUsedInFunctions(type, functions) {
    const typeRegex = new RegExp(`\\b${type.name}\\b`, 'g')
    return functions.some(func => typeRegex.test(func.code))
  }

  /**
   * Calculate function complexity (cyclomatic complexity)
   */
  calculateComplexity(code) {
    let complexity = 1 // Base complexity
    
    // Simple complexity indicators - just count control flow structures
    const indicators = {
      'if': (code.match(/\bif\s*\(/g) || []).length,
      'else if': (code.match(/\belse\s+if\b/g) || []).length,
      'for': (code.match(/\bfor\s*\(/g) || []).length,
      'while': (code.match(/\bwhile\s*\(/g) || []).length,
      'switch': (code.match(/\bswitch\s*\(/g) || []).length,
      'case': (code.match(/\bcase\s+/g) || []).length,
      'catch': (code.match(/\bcatch\s*\(/g) || []).length,
      'ternary': (code.match(/\?\s*[^?\.\s]/g) || []).length,
      'logical_and': (code.match(/&&\s*[^&=]/g) || []).length,
      'logical_or': (code.match(/\|\|\s*[^|=]/g) || []).length
    }
    
    // Sum all complexity indicators
    for (const count of Object.values(indicators)) {
      complexity += count
    }
    
    // Return complexity with reasonable thresholds
    return {
      score: complexity,
      level: complexity <= 3 ? 'low' : complexity <= 8 ? 'medium' : 'high'
    }
  }

  /**
   * Determine function purpose using heuristics configuration
   */
  determinePurpose(func) {
    return this.heuristicsManager.determinePurpose(func)
  }

  /**
   * Generate tags for function
   */
  generateTags(func) {
    const tags = [func.type]
    
    if (func.isExported) tags.push('exported')
    if (func.isAsync) tags.push('async')
    if (func.size > 1000) tags.push('large')
    if (func.code.includes('console.log')) tags.push('has-logging')
    if (func.code.includes('throw')) tags.push('can-throw')
    if (func.code.includes('return')) tags.push('returns-value')
    
    return tags
  }

  /**
   * Determine which bundles a file belongs to
   */
  getFileBundles(filePath) {
    if (!this.bundleConfig?.bundles) return []
    
    const bundles = []
    for (const [bundleName, patterns] of Object.entries(this.bundleConfig.bundles)) {
      // Skip master bundle as requested
      if (bundleName === 'master') continue
      
      // Check if file matches any pattern in this bundle
      for (const pattern of patterns) {
        if (this.matchesPattern(filePath, pattern)) {
          bundles.push(bundleName)
          break // Don't add the same bundle multiple times
        }
      }
    }
    
    return bundles
  }

  /**
   * Simple pattern matching (basic glob support)
   */
  matchesPattern(filePath, pattern) {
    // Convert glob pattern to regex
    const regex = pattern
      .replace(/\*\*/g, '.*')  // ** matches any directories
      .replace(/\*/g, '[^/]*') // * matches any characters except /
      .replace(/\./g, '\\.')   // Escape dots
    
    return new RegExp(`^${regex}$`).test(filePath)
  }
}