/**
 * Function-Level Semantic Chunker
 * Extracts individual functions/methods/components as discrete chunks
 * with intelligent context inclusion
 */

import { readFileSync, existsSync } from 'fs'
import { extname, basename, dirname, join } from 'path'
import glob from 'glob'

export default class FunctionLevelChunker {
  constructor(options = {}) {
    this.options = {
      includeContext: true,
      maxContextLines: 50,
      groupRelated: true,
      ...options
    }
  }

  /**
   * Extract function-level chunks from project
   */
  async extractFunctionChunks(projectPath, patterns = ['**/*.{js,jsx,ts,tsx,mjs}']) {
    console.log('🔍 Starting function-level extraction...')
    
    const files = this.findFiles(projectPath, patterns)
    console.log(`📁 Found ${files.length} files to analyze`)
    
    const allFunctions = []
    let processedFiles = 0
    
    for (const filePath of files) {
      try {
        const functions = this.extractFunctionsFromFile(filePath, projectPath)
        allFunctions.push(...functions)
        processedFiles++
      } catch (error) {
        console.warn(`Failed to extract from ${filePath}: ${error.message}`)
      }
    }
    
    console.log(`✅ Extracted ${allFunctions.length} functions from ${processedFiles} files`)
    
    // Create semantic chunks from functions
    const chunks = this.createFunctionChunks(allFunctions)
    console.log(`📦 Created ${chunks.length} function-level chunks`)
    
    return {
      summary: {
        totalFiles: processedFiles,
        totalFunctions: allFunctions.length,
        totalChunks: chunks.length
      },
      functions: allFunctions,
      chunks: chunks
    }
  }

  /**
   * Find files to analyze
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
   * Extract all functions from a single file
   */
  extractFunctionsFromFile(relativePath, projectPath) {
    const fullPath = join(projectPath, relativePath)
    if (!existsSync(fullPath)) return []
    
    const content = readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')
    
    const functions = []
    
    // Try tree-sitter first, fallback to regex
    try {
      const treeSitterFunctions = this.extractWithTreeSitter(content, relativePath)
      functions.push(...treeSitterFunctions)
    } catch (error) {
      // Fallback to regex extraction
      const regexFunctions = this.extractWithRegex(content, lines, relativePath)
      functions.push(...regexFunctions)
    }
    
    return functions
  }

  /**
   * Extract functions using regex patterns (robust fallback)
   */
  extractWithRegex(content, lines, filePath) {
    const functions = []
    
    // Patterns for different function types
    const patterns = [
      // Function declarations: function name() {}
      {
        pattern: /^[\s]*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm,
        type: 'function'
      },
      // Arrow functions: const name = () => {}
      {
        pattern: /^[\s]*(?:export\s+)?const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
        type: 'arrow_function'
      },
      // Class methods: methodName() {}
      {
        pattern: /^[\s]*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm,
        type: 'method'
      },
      // React components: export function ComponentName() {}
      {
        pattern: /^[\s]*export\s+(?:default\s+)?function\s+([A-Z][a-zA-Z0-9_$]*)\s*\(/gm,
        type: 'react_component'
      }
    ]
    
    for (const { pattern, type } of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const functionName = match[1]
        const startIndex = match.index
        
        // Find the line number
        const lineNumber = content.substring(0, startIndex).split('\n').length
        
        // Extract function body
        const functionInfo = this.extractFunctionBody(content, startIndex, lines, lineNumber)
        
        if (functionInfo && functionInfo.code.length > 10) { // Only include substantial functions
          functions.push({
            name: functionName,
            type: type,
            filePath: filePath,
            startLine: lineNumber,
            endLine: functionInfo.endLine,
            code: functionInfo.code,
            context: this.extractContext(content, functionInfo, filePath),
            signature: match[0].trim()
          })
        }
      }
    }
    
    return functions
  }

  /**
   * Extract function body by finding matching braces
   */
  extractFunctionBody(content, startIndex, lines, startLine) {
    // Find opening brace
    let braceIndex = content.indexOf('{', startIndex)
    if (braceIndex === -1) {
      // Handle arrow functions without braces: const fn = () => expression
      const lineEnd = content.indexOf('\n', startIndex)
      if (lineEnd !== -1) {
        const functionCode = content.substring(startIndex, lineEnd)
        return {
          code: functionCode,
          endLine: startLine
        }
      }
      return null
    }
    
    // Count braces to find matching closing brace
    let braceCount = 1
    let currentIndex = braceIndex + 1
    let inString = false
    let stringChar = null
    
    while (currentIndex < content.length && braceCount > 0) {
      const char = content[currentIndex]
      const prevChar = content[currentIndex - 1]
      
      // Handle string literals to avoid counting braces inside strings
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
          stringChar = null
        }
      }
      
      if (!inString) {
        if (char === '{') braceCount++
        else if (char === '}') braceCount--
      }
      
      currentIndex++
    }
    
    if (braceCount !== 0) return null // Unmatched braces
    
    // Extract the function code
    const functionCode = content.substring(startIndex, currentIndex)
    const endLine = startLine + functionCode.split('\n').length - 1
    
    return {
      code: functionCode.trim(),
      endLine: endLine
    }
  }

  /**
   * Extract relevant context for a function
   */
  extractContext(content, functionInfo, filePath) {
    const context = {
      imports: this.extractImports(content),
      types: this.extractTypes(content),
      dependencies: [],
      calledFunctions: this.extractCalledFunctions(functionInfo.code)
    }
    
    return context
  }

  /**
   * Extract import statements
   */
  extractImports(content) {
    const imports = []
    const importPattern = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"`]([^'"`]+)['"`]/g
    
    let match
    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[1])
    }
    
    return imports
  }

  /**
   * Extract type definitions
   */
  extractTypes(content) {
    const types = []
    const typePattern = /(?:type|interface)\s+([A-Z][a-zA-Z0-9]*)/g
    
    let match
    while ((match = typePattern.exec(content)) !== null) {
      types.push(match[1])
    }
    
    return types
  }

  /**
   * Extract function calls within code
   */
  extractCalledFunctions(code) {
    const calls = []
    const callPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g
    
    let match
    while ((match = callPattern.exec(code)) !== null) {
      const funcName = match[1]
      // Filter out common keywords and built-ins
      if (!['if', 'for', 'while', 'switch', 'catch', 'console', 'Object', 'Array'].includes(funcName)) {
        calls.push(funcName)
      }
    }
    
    return [...new Set(calls)] // Remove duplicates
  }

  /**
   * Create semantic chunks from extracted functions
   */
  createFunctionChunks(functions) {
    const chunks = []
    
    // Group functions by file and related functionality
    const fileGroups = this.groupFunctionsByFile(functions)
    
    for (const [filePath, fileFunctions] of Object.entries(fileGroups)) {
      // Create individual function chunks
      for (const func of fileFunctions) {
        chunks.push({
          name: `${func.name}`,
          type: 'function',
          subtype: func.type,
          filePath: func.filePath,
          functions: [func],
          size: func.code.length,
          complexity: this.calculateComplexity(func.code),
          context: func.context,
          purpose: this.determinePurpose(func),
          tags: this.generateTags(func)
        })
      }
    }
    
    return chunks
  }

  /**
   * Group functions by file
   */
  groupFunctionsByFile(functions) {
    const groups = {}
    
    for (const func of functions) {
      if (!groups[func.filePath]) {
        groups[func.filePath] = []
      }
      groups[func.filePath].push(func)
    }
    
    return groups
  }

  /**
   * Calculate function complexity
   */
  calculateComplexity(code) {
    const complexityIndicators = [
      'if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch',
      '&&', '||', '?', ':', 'async', 'await'
    ]
    
    let complexity = 1 // Base complexity
    
    for (const indicator of complexityIndicators) {
      const count = (code.match(new RegExp(`\\b${indicator}\\b`, 'g')) || []).length
      complexity += count
    }
    
    return {
      score: complexity,
      level: complexity < 5 ? 'low' : complexity < 15 ? 'medium' : 'high'
    }
  }

  /**
   * Determine function purpose
   */
  determinePurpose(func) {
    const name = func.name.toLowerCase()
    const code = func.code.toLowerCase()
    
    if (func.type === 'react_component') return 'React component'
    if (name.startsWith('use') && func.type === 'function') return 'React hook'
    if (name.includes('test') || name.includes('spec')) return 'Test function'
    if (name.includes('get') || name.includes('fetch')) return 'Data retrieval'
    if (name.includes('create') || name.includes('add')) return 'Data creation'
    if (name.includes('update') || name.includes('edit')) return 'Data modification'
    if (name.includes('delete') || name.includes('remove')) return 'Data deletion'
    if (name.includes('validate') || name.includes('check')) return 'Validation'
    if (code.includes('express') || code.includes('router')) return 'API endpoint'
    
    return 'Utility function'
  }

  /**
   * Generate tags for function
   */
  generateTags(func) {
    const tags = []
    
    tags.push(func.type)
    if (func.context.imports.length > 0) tags.push('has-imports')
    if (func.context.calledFunctions.length > 3) tags.push('complex-logic')
    if (func.code.includes('async')) tags.push('async')
    if (func.code.includes('export')) tags.push('exported')
    if (func.name.match(/^[A-Z]/)) tags.push('component-style')
    
    return tags
  }

  /**
   * Fallback tree-sitter extraction (if available)
   */
  extractWithTreeSitter(content, filePath) {
    // TODO: Implement tree-sitter extraction for functions
    // For now, return empty to force regex fallback
    return []
  }
}