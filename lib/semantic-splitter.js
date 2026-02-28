/**
 * Semantic Splitter - High-Performance AST-based Chunker
 * Uses tree-sitter for surgical, function-level code extraction
 * Integrated with HeuristicsManager for intelligent categorization
 */

import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import glob from 'glob'
import Parser from 'tree-sitter'
import JavaScript from 'tree-sitter-javascript'
import TypeScript from 'tree-sitter-typescript'
import HeuristicsManager from './heuristics-manager.js'

export default class SemanticSplitter {
  constructor(options = {}) {
    this.options = {
      maxChunkSize: 3000,       // Max chars per chunk
      includeContext: true,     // Include imports/types needed
      minFunctionSize: 40,      // Skip tiny functions
      ...options
    }
    
    // Initialize tree-sitter parsers
    this.parsers = {
      javascript: new Parser(),
      typescript: new Parser(),
      tsx: new Parser()
    }
    this.parsers.javascript.setLanguage(JavaScript)
    this.parsers.typescript.setLanguage(TypeScript.typescript)
    this.parsers.tsx.setLanguage(TypeScript.tsx)

    this.heuristicsManager = new HeuristicsManager()
  }

  getParser(filePath) {
    const ext = extname(filePath)
    switch (ext) {
      case '.ts': return this.parsers.typescript
      case '.tsx': return this.parsers.tsx
      default: return this.parsers.javascript
    }
  }

  /**
   * Main entry point - extract semantic chunks from project
   */
  async extractSemanticChunks(projectPath, patterns = ['**/*.{js,jsx,ts,tsx,mjs}'], bundleConfig = null) {
    console.log('🔪 Starting surgical semantic splitting via tree-sitter...');
    console.log(`📂 Project path: ${projectPath}`);
    console.log(`📋 Patterns: ${patterns}`);
    
    this.bundleConfig = bundleConfig;
    const files = this.findFiles(projectPath, patterns);
    console.log(`📁 Found ${files.length} files to split`);
    if (files.length > 0) {
      console.log('📄 Sample files:', files.slice(0, 5));
    }
    
    const allChunks = []
    
    for (const filePath of files) {
      try {
        const fileChunks = this.processFile(filePath, projectPath)
        allChunks.push(...fileChunks)
      } catch (error) {
        console.warn(`Failed to process ${filePath}: ${error.message}`)
      }
    }
    
    console.log(`🧩 Created ${allChunks.length} semantic chunks across project`)
    return {
      summary: {
        totalFiles: files.length,
        totalChunks: allChunks.length,
        averageSize: allChunks.reduce((sum, c) => sum + c.code.length, 0) / allChunks.length
      },
      chunks: allChunks
    }
  }

  findFiles(projectPath, patterns) {
    const files = []
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', '.git/**', '*.test.*', '*.spec.*']
      })
      files.push(...matches)
    }
    return [...new Set(files)]
  }

  processFile(relativePath, projectPath) {
    const fullPath = join(projectPath, relativePath);
    if (!existsSync(fullPath)) return [];
    
    // console.log(`  📄 Processing: ${relativePath}`);
    const content = readFileSync(fullPath, 'utf8');
    const parser = this.getParser(relativePath);
    const tree = parser.parse(content);
    const root = tree.rootNode;
    
    const elements = {
      functions: [],
      types: [],
      imports: this.extractImports(root, content, relativePath)
    };

    // Traverse AST for functions and types
    this.traverse(root, content, relativePath, elements);

    const chunks = this.createChunks(elements, content, relativePath);
    // if (chunks.length > 0) {
    //   console.log(`    ✅ Found ${chunks.length} chunks in ${relativePath}`);
    // }
    return chunks;
  }

  traverse(node, content, filePath, elements) {
    // Detect Function Declarations
    if (node.type === 'function_declaration' || node.type === 'method_definition' || node.type === 'arrow_function') {
      const func = this.mapFunctionNode(node, content, filePath)
      if (func && func.code.length > this.options.minFunctionSize) {
        elements.functions.push(func)
      }
    }

    // Detect Type Definitions (TS)
    if (node.type === 'interface_declaration' || node.type === 'type_alias_declaration') {
      const typeDef = this.mapTypeNode(node, content, filePath)
      if (typeDef) elements.types.push(typeDef)
    }

    // Recurse unless we've already captured the block (like a function body)
    if (node.type !== 'function_declaration' && node.type !== 'method_definition') {
      for (let i = 0; i < node.namedChildCount; i++) {
        this.traverse(node.namedChild(i), content, filePath, elements)
      }
    }
  }

  mapFunctionNode(node, content, filePath) {
    let name = 'anonymous';
    
    // Find name identifier based on node type
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) name = content.slice(nameNode.startIndex, nameNode.endIndex);
    } else if (node.type === 'arrow_function') {
      // 1. Check if assigned to a variable: const foo = () => {}
      const parent = node.parent;
      if (parent && parent.type === 'variable_declarator') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) name = content.slice(nameNode.startIndex, nameNode.endIndex);
      }
      // 2. Check if part of an object property: { foo: () => {} }
      else if (parent && parent.type === 'pair') {
        const keyNode = parent.childForFieldName('key');
        if (keyNode) name = content.slice(keyNode.startIndex, keyNode.endIndex);
      }
      // 3. Check if part of an assignment: this.foo = () => {}
      else if (parent && parent.type === 'assignment_expression') {
        const leftNode = parent.childForFieldName('left');
        if (leftNode) name = content.slice(leftNode.startIndex, leftNode.endIndex);
      }
    }

    const code = content.slice(node.startIndex, node.endIndex)
    
    return {
      name,
      type: node.type,
      filePath,
      startLine: node.startPosition.row + 1,
      code,
      isExported: this.isExported(node),
      isAsync: code.includes('async')
    }
  }

  mapTypeNode(node, content, filePath) {
    const nameNode = node.childForFieldName('name')
    if (!nameNode) return null
    
    return {
      name: content.slice(nameNode.startIndex, nameNode.endIndex),
      type: node.type,
      filePath,
      startLine: node.startPosition.row + 1,
      code: content.slice(node.startIndex, node.endIndex),
      isExported: this.isExported(node)
    }
  }

  extractImports(root, content, filePath) {
    const imports = []
    // Simple traversal for import statements
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i)
      if (node.type === 'import_statement') {
        imports.push({
          statement: content.slice(node.startIndex, node.endIndex),
          filePath
        })
      }
    }
    return imports
  }

  isExported(node) {
    let current = node
    while (current) {
      if (current.type === 'export_statement') return true
      current = current.parent
    }
    return false
  }

  createChunks(elements, content, filePath) {
    const chunks = [];
    const pathParts = filePath.toLowerCase().split(/[\\\/]/);
    
    for (const func of elements.functions) {
      // Pass full context to heuristics
      const heuristicContext = {
        ...func,
        includes: elements,
        pathParts
      };
      
      const purpose = this.heuristicsManager.determinePurpose(heuristicContext);
      const businessDomain = this.heuristicsManager.inferBusinessDomains(heuristicContext);
      const technicalPatterns = this.heuristicsManager.inferTechnicalPatterns(heuristicContext);
      const tags = this.generateTags(func);

      // if (businessDomain.length > 0) {
      //   console.log(`  💎 ${func.name}: Domains: [${businessDomain}], Patterns: [${technicalPatterns}]`);
      // }

      let chunkCode = '';
      if (this.options.includeContext) {
        const relevantImports = elements.imports
          .filter(imp => this.isImportRelevant(imp.statement, func.code))
          .map(imp => imp.statement)
          .join('\n');
        
        if (relevantImports) chunkCode += relevantImports + '\n\n';
      }
      chunkCode += func.code;

      chunks.push({
        id: `${filePath}:${func.name}:${func.startLine}`,
        name: func.name,
        filePath,
        type: 'function',
        subtype: func.type,
        code: chunkCode,
        startLine: func.startLine,
        complexity: this.calculateComplexity(func.code),
        purpose,
        tags,
        businessDomain,
        technicalPatterns,
        includes: {
          imports: elements.imports.map(i => i.statement),
          types: elements.types.map(t => t.name)
        },
        bundles: this.getFileBundles(filePath)
      });
    }
    
    return chunks;
  }

  isImportRelevant(importStatement, functionCode) {
    // Heuristic: does the function use any name from the import?
    const match = importStatement.match(/import\s+(?:\{([^}]+)\}|(\w+))/i)
    if (!match) return false
    const importedNames = match[1] ? match[1].split(',').map(n => n.trim()) : [match[2]]
    return importedNames.some(name => functionCode.includes(name))
  }

  calculateComplexity(code) {
    const indicators = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '?', '&&', '||'];
    let score = 1;
    indicators.forEach(ind => {
      // Escape special regex characters
      const escaped = ind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Only use word boundaries for word-like indicators
      const pattern = /^[a-zA-Z]+$/.test(ind) ? `\\b${escaped}\\b` : escaped;
      const regex = new RegExp(pattern, 'g');
      score += (code.match(regex) || []).length;
    });
    return {
      score,
      level: score < 5 ? 'low' : score < 15 ? 'medium' : 'high'
    };
  }

  generateTags(func) {
    const tags = [func.type]
    if (func.isExported) tags.push('exported')
    if (func.isAsync) tags.push('async')
    if (func.code.length > 2000) tags.push('large')
    return tags
  }

  getFileBundles(filePath) {
    if (!this.bundleConfig?.bundles) return []
    const bundles = []
    for (const [name, patterns] of Object.entries(this.bundleConfig.bundles)) {
      if (name === 'master') continue
      for (const pattern of patterns) {
        if (this.matchesPattern(filePath, pattern)) {
          bundles.push(name)
          break
        }
      }
    }
    return bundles
  }

  matchesPattern(filePath, pattern) {
    const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.')
    return new RegExp(`^${regex}$`).test(filePath)
  }
}
