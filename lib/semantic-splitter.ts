/**
 * Semantic Splitter - High-Performance AST-based Chunker
 * Uses tree-sitter for surgical, function-level code extraction
 * Integrated with HeuristicsManager for intelligent categorization
 */

import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import Parser from 'tree-sitter'
import JavaScript from 'tree-sitter-javascript'
import TypeScript from 'tree-sitter-typescript'
import Rust from 'tree-sitter-rust'
import Json from 'tree-sitter-json'
import Css from 'tree-sitter-css'
import Html from 'tree-sitter-html'
import Sql from 'tree-sitter-sql'
import Markdown from 'tree-sitter-markdown'
import Toml from 'tree-sitter-toml'
import LegacyParser from 'tree-sitter-legacy'
import HeuristicsManager from './heuristics-manager.js'
import { SemanticChunk } from './database-manager.js'

export interface FunctionNode {
  name: string;
  type: string;
  filePath: string;
  startLine: number;
  code: string;
  isExported: boolean;
  isAsync: boolean;
  category: 'function' | 'structure';
}

export interface TypeNode {
  name: string;
  type: string;
  filePath: string;
  startLine: number;
  code: string;
  isExported: boolean;
}

export default class SemanticSplitter {
  options: {
    maxChunkSize: number;
    includeContext: boolean;
    minFunctionSize: number;
    minStructureSize: number;
    verbose: boolean;
    isMcp: boolean;
  };
  parsers: Record<string, Parser>;
  heuristicsManager: HeuristicsManager;
  bundleConfig: any;

  constructor(options: { maxChunkSize?: number, includeContext?: boolean, minFunctionSize?: number, minStructureSize?: number, verbose?: boolean, isMcp?: boolean } = {}) {
    this.options = {
      maxChunkSize: 3000,       // Max chars per chunk
      includeContext: true,     // Include imports/types needed
      minFunctionSize: 40,      // Skip tiny functions
      minStructureSize: 20,     // Skip tiny structures
      verbose: options.verbose || false,
      isMcp: options.isMcp || false,
      ...options
    }
    
    // Initialize tree-sitter parsers
    this.parsers = {
      javascript: new Parser(),
      typescript: new Parser(),
      tsx: new Parser(),
      rust: new Parser(),
      json: new Parser(),
      css: new Parser(),
      html: new Parser()
    }
    
    this.parsers.javascript.setLanguage(JavaScript)
    this.parsers.typescript.setLanguage(TypeScript.typescript)
    this.parsers.tsx.setLanguage(TypeScript.tsx)
    this.parsers.rust.setLanguage(Rust)
    this.parsers.json.setLanguage(Json)
    this.parsers.css.setLanguage(Css)
    this.parsers.html.setLanguage(Html)

    // Optional legacy parsers (native bindings often fail in global npm installs)
    try {
      this.parsers.sql = new (LegacyParser as any)()
      this.parsers.sql.setLanguage(Sql)
    } catch (e) {
      this.log('⚠️  SQL parser unavailable (native binding missing). Skipping SQL semantic analysis.');
    }

    try {
      this.parsers.markdown = new (LegacyParser as any)()
      this.parsers.markdown.setLanguage(Markdown)
    } catch (e) {
      this.log('⚠️  Markdown parser unavailable. Skipping MD semantic analysis.');
    }

    try {
      this.parsers.toml = new (LegacyParser as any)()
      this.parsers.toml.setLanguage(Toml)
    } catch (e) {
      this.log('⚠️  TOML parser unavailable. Skipping TOML semantic analysis.');
    }

    this.heuristicsManager = new HeuristicsManager()
  }

  log(message: string) {
    if (this.options.isMcp) {
      process.stderr.write(message + '\n');
    } else {
      console.log(message);
    }
  }

  getParser(filePath: string): Parser | null {
    const ext = extname(filePath).toLowerCase()
    let parser: Parser | undefined;

    switch (ext) {
      case '.json': parser = this.parsers.json; break;
      case '.css': 
      case '.scss': parser = this.parsers.css; break;
      case '.html': parser = this.parsers.html; break;
      case '.sql': parser = this.parsers.sql; break;
      case '.md': parser = this.parsers.markdown; break;
      case '.toml': parser = this.parsers.toml; break;
      case '.jsx': parser = this.parsers.javascript; break;
      case '.ts': parser = this.parsers.typescript; break;
      case '.tsx': parser = this.parsers.tsx; break;
      case '.rs': parser = this.parsers.rust; break;
      default: parser = this.parsers.javascript;
    }

    return parser || null;
  }

  /**
   * Main entry point - extract semantic chunks from project
   * Now accepts a pre-filtered list of files from FileSystemManager
   */
  async extractSemanticChunks(projectPath: string, files: string[] = [], bundleConfig = null) {
    this.log('🔪 Starting surgical semantic splitting via tree-sitter...')
    this.log(`📂 Project path: ${projectPath}`)
    
    this.bundleConfig = bundleConfig
    this.log(`📁 Processing ${files.length} filtered files`)
    
    const allChunks: SemanticChunk[] = []
    
    for (const filePath of files) {
      try {
        const fileChunks = this.processFile(filePath, projectPath)
        allChunks.push(...fileChunks)
      } catch (error: any) {
        console.warn(`⚠️ Failed to process ${filePath}: ${error.message}`)
        if (this.options.verbose) {
          console.error(error.stack)
        }
      }
    }
    
    this.log(`🧩 Created ${allChunks.length} semantic chunks across project`)
    return {
      summary: {
        totalFiles: files.length,
        totalChunks: allChunks.length,
        averageSize: allChunks.length > 0 ? allChunks.reduce((sum, c) => sum + (c.code || '').length, 0) / allChunks.length : 0
      },
      chunks: allChunks
    }
  }

  processFile(relativePath: string, projectPath: string): SemanticChunk[] {
    const fullPath = join(projectPath, relativePath)
    if (!existsSync(fullPath)) return []

    const content = readFileSync(fullPath, 'utf8')

    // Skip files larger than 200KB — tree-sitter and embeddings can't handle them well
    if (content.length > 200_000) {
      this.log(`⚠️  Skipping ${relativePath}: file too large (${Math.round(content.length / 1024)}KB)`)
      return []
    }

    const parser = this.getParser(relativePath)
    if (!parser) {
      if (this.options.verbose) {
        this.log(`⚠️  No parser available for ${relativePath}, skipping.`);
      }
      return [];
    }
    
    try {
      const tree = parser.parse(content)
      const root = tree.rootNode
      const ext = extname(relativePath).toLowerCase()
      
      const elements = {
        functions: [] as FunctionNode[],
        types: [] as TypeNode[],
        imports: [] as any[]
      }

      if (['.js', '.jsx', '.ts', '.tsx', '.rs'].includes(ext)) {
        elements.imports = this.extractImports(root, content, relativePath)
        // Traverse AST for functions and types
        this.traverse(root, content, relativePath, elements)
      } else if (ext === '.json') {
        this.extractJsonStructures(root, content, relativePath, elements)
      } else if (ext === '.css' || ext === '.scss') {
        this.extractCssStructures(root, content, relativePath, elements)
      } else if (ext === '.html') {
        this.extractHtmlStructures(root, content, relativePath, elements)
      } else if (ext === '.sql') {
        this.extractSqlStructures(root, content, relativePath, elements)
      } else if (ext === '.md') {
        this.extractMarkdownStructures(root, content, relativePath, elements)
      } else if (ext === '.toml') {
        this.extractTomlStructures(root, content, relativePath, elements)
      }

      // Create chunks from elements
      return this.createChunks(elements, content, relativePath)
    } catch (error: any) {
      this.log(`⚠️  Parser failed for ${relativePath}: ${error.message}`)
      if (this.options.verbose) {
        console.error(error.stack)
      }
      return []
    }
  }

  traverse(node: Parser.SyntaxNode, content: string, filePath: string, elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }) {
    // Detect Function Declarations (JS/TS)
    if (node.type === 'function_declaration' || node.type === 'method_definition' || node.type === 'arrow_function') {
      const func = this.mapFunctionNode(node, content, filePath)
      if (func && func.code.length > this.options.minFunctionSize) {
        elements.functions.push(func)
      }
    }

    // Detect Rust function items
    if (node.type === 'function_item') {
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

    // Detect Rust type definitions
    if (node.type === 'struct_item' || node.type === 'enum_item' || node.type === 'trait_item') {
      const typeDef = this.mapTypeNode(node, content, filePath)
      if (typeDef) elements.types.push(typeDef)
    }

    // Detect Rust impl blocks — traverse into body for methods
    if (node.type === 'impl_item') {
      const body = node.childForFieldName('body')
      if (body) {
        for (let i = 0; i < body.namedChildCount; i++) {
          const child = body.namedChild(i);
          if (child) this.traverse(child, content, filePath, elements)
        }
      }
      return // Don't recurse again below
    }

    // Recurse unless we've already captured the block (like a function body)
    if (node.type !== 'function_declaration' && node.type !== 'method_definition' && node.type !== 'function_item') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child) this.traverse(child, content, filePath, elements)
      }
    }
  }

  mapFunctionNode(node: Parser.SyntaxNode, content: string, filePath: string): FunctionNode | null {
    let name = 'anonymous';
    
    // Find name identifier based on node type
    if (node.type === 'function_declaration' || node.type === 'method_definition' || node.type === 'function_item') {
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
      isAsync: code.includes('async'),
      category: 'function'
    }
  }

  mapStructureNode(name: string, node: Parser.SyntaxNode, content: string, filePath: string): FunctionNode {
    return {
      name,
      type: node.type,
      filePath,
      startLine: node.startPosition.row + 1,
      code: content.slice(node.startIndex, node.endIndex),
      isExported: false,
      isAsync: false,
      category: 'structure'
    }
  }

  extractJsonStructures(root: Parser.SyntaxNode, content: string, filePath: string, elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }) {
    const rootNode = root.namedChild(0)
    if (!rootNode) return

    if (rootNode.type === 'object') {
      for (let i = 0; i < rootNode.namedChildCount; i++) {
        const child = rootNode.namedChild(i)
        if (child && child.type === 'pair') {
          const keyNode = child.childForFieldName('key') || child.namedChild(0)
          const name = keyNode ? content.slice(keyNode.startIndex, keyNode.endIndex).replace(/['"]/g, '') : 'pair'
          const structure = this.mapStructureNode(name, child, content, filePath)
          if (structure.code.length >= this.options.minStructureSize) {
            elements.functions.push(structure)
          }
        }
      }
    } else if (rootNode.type === 'array') {
      for (let i = 0; i < rootNode.namedChildCount; i++) {
        const child = rootNode.namedChild(i)
        if (child) {
          const structure = this.mapStructureNode(`item_${i + 1}`, child, content, filePath)
          if (structure.code.length >= this.options.minStructureSize) {
            elements.functions.push(structure)
          }
        }
      }
    }
  }

  extractCssStructures(root: Parser.SyntaxNode, content: string, filePath: string, elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }) {
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i)
      if (!node) continue
      if (node.type === 'rule_set' || node.type === 'at_rule') {
        const name = this.getCssRuleName(node, content)
        const structure = this.mapStructureNode(name, node, content, filePath)
        if (structure.code.length >= this.options.minStructureSize) {
          elements.functions.push(structure)
        }
      }
    }
  }

  getCssRuleName(node: Parser.SyntaxNode, content: string) {
    const selectorsNode = node.childForFieldName('selectors') || node.namedChild(0)
    if (selectorsNode) {
      return content.slice(selectorsNode.startIndex, selectorsNode.endIndex).trim()
    }
    const code = content.slice(node.startIndex, node.endIndex)
    return code.split('{')[0].trim() || 'rule'
  }

  extractHtmlStructures(root: Parser.SyntaxNode, content: string, filePath: string, elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }) {
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i)
      if (!node) continue
      if (node.type === 'element' || node.type === 'script_element' || node.type === 'style_element') {
        const name = this.getHtmlElementName(node, content)
        const structure = this.mapStructureNode(name, node, content, filePath)
        if (structure.code.length >= this.options.minStructureSize) {
          elements.functions.push(structure)
        }
      }
    }
  }

  getHtmlElementName(node: Parser.SyntaxNode, content: string) {
    const startTag = node.childForFieldName('start_tag') || node.namedChild(0)
    const tagNameNode = startTag?.childForFieldName('tag_name') || startTag?.namedChild(0)
    if (tagNameNode) {
      return content.slice(tagNameNode.startIndex, tagNameNode.endIndex)
    }
    return node.type
  }

  extractSqlStructures(root: Parser.SyntaxNode, content: string, filePath: string, elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }) {
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i)
      if (!node) continue
      const name = this.getSqlStatementName(node, content)
      const structure = this.mapStructureNode(name, node, content, filePath)
      if (structure.code.length >= this.options.minStructureSize) {
        elements.functions.push(structure)
      }
    }
  }

  getSqlStatementName(node: Parser.SyntaxNode, content: string) {
    const code = content.slice(node.startIndex, node.endIndex).trim()
    if (!code) return node.type
    const firstLine = code.split('\n')[0]
    const match = firstLine.match(/^\s*([A-Za-z_]+)/)
    if (match) return match[1].toUpperCase()
    return node.type
  }

  extractMarkdownStructures(root: Parser.SyntaxNode, content: string, filePath: string, elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }) {
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i)
      if (!node) continue
      if (this.isMarkdownStructureNode(node.type)) {
        const name = this.getMarkdownNodeName(node, content)
        const structure = this.mapStructureNode(name, node, content, filePath)
        if (structure.code.length >= this.options.minStructureSize) {
          elements.functions.push(structure)
        }
      }
    }
  }

  isMarkdownStructureNode(type: string) {
    return [
      'atx_heading',
      'setext_heading',
      'fenced_code_block',
      'indented_code_block',
      'tight_list',
      'loose_list',
      'list',
      'block_quote',
      'thematic_break'
    ].includes(type)
  }

  getMarkdownNodeName(node: Parser.SyntaxNode, content: string) {
    const text = content.slice(node.startIndex, node.endIndex).trim()
    if (node.type === 'atx_heading') {
      const withoutHashes = text.replace(/^#{1,6}\s*/, '').replace(/\s*#+\s*$/, '').trim()
      return withoutHashes || 'heading'
    }
    if (node.type === 'setext_heading') {
      const firstLine = text.split('\n')[0]?.trim()
      return firstLine || 'heading'
    }
    if (node.type === 'fenced_code_block' || node.type === 'indented_code_block') {
      return 'code_block'
    }
    if (node.type.includes('list')) {
      return 'list'
    }
    if (node.type === 'block_quote') {
      return 'blockquote'
    }
    if (node.type === 'thematic_break') {
      return 'break'
    }
    return node.type
  }

  extractTomlStructures(root: Parser.SyntaxNode, content: string, filePath: string, elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }) {
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i)
      if (!node) continue
      if (node.type === 'table' || node.type === 'table_array_element' || node.type === 'pair') {
        // Legacy parser uses namedChild instead of childForFieldName
        const keyNode = (node as any).childForFieldName?.('name')
          || (node as any).childForFieldName?.('key')
          || node.namedChild(0)
        const name = keyNode ? content.slice(keyNode.startIndex, keyNode.endIndex) : node.type
        const structure = this.mapStructureNode(name, node, content, filePath)
        if (structure.code.length >= this.options.minStructureSize) {
          elements.functions.push(structure)
        }
      }
    }
  }

  mapTypeNode(node: Parser.SyntaxNode, content: string, filePath: string): TypeNode | null {
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

  extractImports(root: Parser.SyntaxNode, content: string, filePath: string) {
    const imports = []
    // Simple traversal for import/use statements
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i)
      if (node && (node.type === 'import_statement' || node.type === 'use_declaration')) {
        imports.push({
          statement: content.slice(node.startIndex, node.endIndex),
          filePath
        })
      }
    }
    return imports
  }

  isExported(node: Parser.SyntaxNode) {
    // Rust: check for visibility_modifier (pub) as direct child
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child && child.type === 'visibility_modifier') return true
    }
    // JS/TS: check for export_statement ancestor or parent
    let parent = node.parent
    while (parent) {
      if (parent.type === 'export_statement' || parent.type === 'export_declaration') {
        return true
      }
      parent = parent.parent
    }
    return false
  }

  createChunks(elements: { functions: FunctionNode[], types: TypeNode[], imports: any[] }, content: string, filePath: string): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
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
        type: func.category === 'structure' ? 'structure' : 'function',
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

  isImportRelevant(importStatement: string, functionCode: string) {
    // Rust use statements: use std::collections::HashMap;
    const useMatch = importStatement.match(/^use\s+(.+);?\s*$/)
    if (useMatch) {
      const path = useMatch[1]
      // Extract the last segment (the actual imported name)
      const segments = path.replace(/[{}]/g, '').split('::')
      const lastSegment = segments[segments.length - 1].trim()
      return functionCode.includes(lastSegment)
    }
    // JS/TS import statements
    const match = importStatement.match(/import\s+(?:\{([^}]+)\}|(\w+))/i)
    if (!match) return false
    const importedNames = match[1] ? match[1].split(',').map(n => n.trim()) : [match[2]]
    return importedNames.some(name => functionCode.includes(name))
  }

  calculateComplexity(code: string) {
    const indicators = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '?', '&&', '||', 'match', 'loop', 'unsafe', 'unwrap', 'expect'];
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

  generateTags(func: FunctionNode) {
    const tags = [func.type]
    if (func.isExported) tags.push('exported')
    if (func.isAsync) tags.push('async')
    if (func.code.length > 2000) tags.push('large')
    return tags
  }

  getFileBundles(filePath: string) {
    if (!this.bundleConfig?.bundles) return []
    const bundles = []
    for (const [name, patterns] of Object.entries(this.bundleConfig.bundles)) {
      if (name === 'master') continue
      for (const pattern of (patterns as string[])) {
        if (this.matchesPattern(filePath, pattern)) {
          bundles.push(name)
          break
        }
      }
    }
    return bundles
  }

  matchesPattern(filePath: string, pattern: string) {
    const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.')
    return new RegExp(`^${regex}$`).test(filePath)
  }
}
