/**
 * Semantic Chunking Integration for cntx-ui Server
 * Extends the existing server with semantic analysis capabilities
 */

import SemanticChunker from './semantic-chunker.js'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

class SemanticIntegration {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath
    this.chunker = new SemanticChunker({
      includeImports: true,
      includeExports: true,
      detectComponentTypes: true,
      groupRelatedFiles: true,
      minChunkSize: 100,
      maxChunkSize: 10000
    })
  }

  /**
   * Analyze project and generate semantic bundle suggestions
   */
  async generateSemanticBundles() {
    try {
      console.log('🔍 Analyzing project for semantic chunking...')
      
      // Analyze different file types separately
      const analyses = await Promise.all([
        this.chunker.analyzeProject(this.projectPath, ['web/src/components/**/*.{tsx,ts}']),
        this.chunker.analyzeProject(this.projectPath, ['web/src/hooks/**/*.{tsx,ts}']),
        this.chunker.analyzeProject(this.projectPath, ['web/src/lib/**/*.{tsx,ts}']),
        this.chunker.analyzeProject(this.projectPath, ['web/src/utils/**/*.{tsx,ts}']),
        this.chunker.analyzeProject(this.projectPath, ['lib/**/*.js']),
      ])

      const [componentsAnalysis, hooksAnalysis, libAnalysis, utilsAnalysis, serverAnalysis] = analyses

      // Generate bundle suggestions
      const suggestions = this.generateBundleSuggestions([
        { name: 'components', analysis: componentsAnalysis },
        { name: 'hooks', analysis: hooksAnalysis },
        { name: 'lib', analysis: libAnalysis },
        { name: 'utils', analysis: utilsAnalysis },
        { name: 'server', analysis: serverAnalysis }
      ])

      console.log('✅ Semantic analysis complete!')
      
      return {
        timestamp: new Date().toISOString(),
        projectPath: this.projectPath,
        suggestions,
        analyses: {
          components: this.chunker.formatResults(componentsAnalysis),
          hooks: this.chunker.formatResults(hooksAnalysis),
          lib: this.chunker.formatResults(libAnalysis),
          utils: this.chunker.formatResults(utilsAnalysis),
          server: this.chunker.formatResults(serverAnalysis)
        },
        summary: this.generateOverallSummary(analyses)
      }
    } catch (error) {
      console.error('❌ Semantic analysis failed:', error.message)
      throw error
    }
  }

  /**
   * Generate bundle configuration suggestions based on semantic analysis
   */
  generateBundleSuggestions(namedAnalyses) {
    const suggestions = {
      recommended: {},
      alternative: {},
      notes: []
    }

    for (const { name, analysis } of namedAnalyses) {
      if (analysis.chunks.length === 0) continue

      // Recommended: Group by semantic purpose
      const purposeGroups = this.groupChunksByPurpose(analysis.chunks)
      
      for (const [purpose, chunks] of Object.entries(purposeGroups)) {
        const bundleName = `${name}-${purpose}`
        const patterns = this.generatePatternsForChunks(chunks)
        
        suggestions.recommended[bundleName] = patterns
      }

      // Alternative: Group by directory structure
      const dirGroups = this.groupChunksByDirectory(analysis.chunks)
      
      for (const [dir, chunks] of Object.entries(dirGroups)) {
        const bundleName = `${name}-${dir}`
        const patterns = this.generatePatternsForChunks(chunks)
        
        suggestions.alternative[bundleName] = patterns
      }
    }

    // Add specialized bundles
    this.addSpecializedBundles(suggestions, namedAnalyses)

    // Add optimization notes
    this.addOptimizationNotes(suggestions, namedAnalyses)

    return suggestions
  }

  /**
   * Group chunks by their primary purpose
   */
  groupChunksByPurpose(chunks) {
    const groups = {}
    
    for (const chunk of chunks) {
      const purpose = chunk.purpose || 'misc'
      if (!groups[purpose]) {
        groups[purpose] = []
      }
      groups[purpose].push(chunk)
    }
    
    return groups
  }

  /**
   * Group chunks by directory structure
   */
  groupChunksByDirectory(chunks) {
    const groups = {}
    
    for (const chunk of chunks) {
      // Extract directory from chunk name or files
      const dir = chunk.name.split('-')[0] || 'misc'
      if (!groups[dir]) {
        groups[dir] = []
      }
      groups[dir].push(chunk)
    }
    
    return groups
  }

  /**
   * Generate glob patterns for chunks
   */
  generatePatternsForChunks(chunks) {
    const patterns = new Set()
    
    for (const chunk of chunks) {
      for (const file of chunk.files) {
        // Convert file paths to glob patterns
        const pattern = this.fileToGlobPattern(file)
        patterns.add(pattern)
      }
    }
    
    return Array.from(patterns)
  }

  /**
   * Convert file path to glob pattern
   */
  fileToGlobPattern(filePath) {
    // Extract directory and create pattern
    const parts = filePath.split('/')
    const dir = parts.slice(0, -1).join('/')
    const ext = parts[parts.length - 1].split('.').pop()
    
    return `${dir}/**/*.${ext}`
  }

  /**
   * Add specialized bundle suggestions
   */
  addSpecializedBundles(suggestions, namedAnalyses) {
    // UI Components bundle
    const componentsAnalysis = namedAnalyses.find(a => a.name === 'components')?.analysis
    if (componentsAnalysis?.chunks.length > 0) {
      const uiComponents = componentsAnalysis.chunks.filter(c => 
        c.name.includes('ui') || c.tags.includes('has-components')
      )
      
      if (uiComponents.length > 0) {
        suggestions.recommended['ui-system'] = [
          'web/src/components/ui/**/*.tsx',
          'web/src/components/theme-*.tsx'
        ]
      }
    }

    // Test files bundle
    suggestions.recommended['tests'] = [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/__tests__/**/*'
    ]

    // Configuration bundle
    suggestions.recommended['config'] = [
      '*.config.{js,ts}',
      '*.json',
      'package.json',
      'tsconfig*.json',
      '.env*'
    ]

    // Documentation bundle
    suggestions.recommended['docs'] = [
      '**/*.md',
      'docs/**/*',
      'README*'
    ]
  }

  /**
   * Add optimization notes and recommendations
   */
  addOptimizationNotes(suggestions, namedAnalyses) {
    suggestions.notes = []

    // Analyze bundle sizes
    const totalFiles = namedAnalyses.reduce((sum, a) => sum + a.analysis.summary.totalFiles, 0)
    const totalChunks = namedAnalyses.reduce((sum, a) => sum + a.analysis.summary.totalChunks, 0)
    
    suggestions.notes.push({
      type: 'info',
      message: `Project has ${totalFiles} files organized into ${totalChunks} semantic chunks`
    })

    // Check for large files
    const largeFiles = []
    for (const { analysis } of namedAnalyses) {
      for (const [path, file] of Object.entries(analysis.files)) {
        if (file.lines > 300) {
          largeFiles.push({ path, lines: file.lines })
        }
      }
    }

    if (largeFiles.length > 0) {
      suggestions.notes.push({
        type: 'warning',
        message: `${largeFiles.length} files exceed 300 lines and may benefit from splitting`,
        details: largeFiles.slice(0, 3).map(f => `${f.path} (${f.lines} lines)`)
      })
    }

    // Check for high complexity
    const complexFiles = []
    for (const { analysis } of namedAnalyses) {
      for (const [path, file] of Object.entries(analysis.files)) {
        if (file.complexity?.level === 'high') {
          complexFiles.push({ path, score: file.complexity.score })
        }
      }
    }

    if (complexFiles.length > 0) {
      suggestions.notes.push({
        type: 'optimization',
        message: `${complexFiles.length} files have high complexity and may need refactoring`,
        details: complexFiles.slice(0, 3).map(f => `${f.path} (score: ${f.score})`)
      })
    }

    // Suggest bundle patterns
    suggestions.notes.push({
      type: 'suggestion',
      message: 'Consider using semantic bundles for better AI context understanding',
      details: [
        'UI components grouped by functionality',
        'Hooks grouped by domain logic',
        'Utilities grouped by purpose',
        'Tests separated for focused debugging'
      ]
    })
  }

  /**
   * Generate overall project summary
   */
  generateOverallSummary(analyses) {
    const totalFiles = analyses.reduce((sum, a) => sum + a.summary.totalFiles, 0)
    const totalSize = analyses.reduce((sum, a) => sum + a.summary.totalSize, 0)
    const totalLines = analyses.reduce((sum, a) => sum + a.summary.totalLines, 0)
    const totalChunks = analyses.reduce((sum, a) => sum + a.summary.totalChunks, 0)

    const fileTypes = {}
    const filePurposes = {}
    const complexityDistribution = {}

    for (const analysis of analyses) {
      // Merge file types
      for (const [type, count] of Object.entries(analysis.summary.fileTypes)) {
        fileTypes[type] = (fileTypes[type] || 0) + count
      }
      
      // Merge purposes
      for (const [purpose, count] of Object.entries(analysis.summary.filePurposes)) {
        filePurposes[purpose] = (filePurposes[purpose] || 0) + count
      }
      
      // Merge complexity
      for (const [level, count] of Object.entries(analysis.summary.complexityDistribution)) {
        complexityDistribution[level] = (complexityDistribution[level] || 0) + count
      }
    }

    return {
      totalFiles,
      totalSize,
      totalLines,
      totalChunks,
      fileTypes,
      filePurposes,
      complexityDistribution,
      averageFileSize: Math.round(totalSize / totalFiles),
      averageLinesPerFile: Math.round(totalLines / totalFiles),
      formattedSize: this.formatBytes(totalSize)
    }
  }

  /**
   * Convert semantic suggestions to cntx-ui bundle format
   */
  convertToConfigFormat(suggestions) {
    return {
      bundles: {
        // Keep existing master bundle
        master: ['**/*'],
        
        // Add recommended semantic bundles
        ...suggestions.recommended,
        
        // Add alternative bundles as commented examples
        // ...suggestions.alternative (uncomment to use directory-based grouping)
      }
    }
  }

  /**
   * Save analysis results to file
   */
  async saveAnalysisResults(results, outputPath = 'semantic-analysis.json') {
    try {
      const fullPath = join(this.projectPath, outputPath)
      writeFileSync(fullPath, JSON.stringify(results, null, 2))
      console.log(`📁 Analysis saved to ${fullPath}`)
      return fullPath
    } catch (error) {
      console.error('❌ Failed to save analysis:', error.message)
      throw error
    }
  }

  /**
   * Generate bundle config suggestions file
   */
  async generateBundleConfigSuggestions(results, outputPath = 'semantic-bundle-suggestions.json') {
    try {
      const config = this.convertToConfigFormat(results.suggestions)
      const fullPath = join(this.projectPath, outputPath)
      
      const output = {
        timestamp: results.timestamp,
        description: 'Semantic chunking suggestions for cntx-ui bundles',
        usage: 'Copy the bundles object to your .cntx/bundles.json file',
        ...config,
        notes: results.suggestions.notes,
        summary: results.summary
      }
      
      writeFileSync(fullPath, JSON.stringify(output, null, 2))
      console.log(`📦 Bundle suggestions saved to ${fullPath}`)
      return fullPath
    } catch (error) {
      console.error('❌ Failed to save bundle suggestions:', error.message)
      throw error
    }
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export default SemanticIntegration

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const integration = new SemanticIntegration()
  
  console.log('🚀 Starting semantic analysis integration...')
  
  try {
    const results = await integration.generateSemanticBundles()
    
    // Save full analysis
    await integration.saveAnalysisResults(results)
    
    // Save bundle suggestions
    await integration.generateBundleConfigSuggestions(results)
    
    console.log('\n📊 Project Summary:')
    console.log(`📁 ${results.summary.totalFiles} files analyzed`)
    console.log(`💾 ${results.summary.formattedSize} total size`)
    console.log(`📦 ${results.summary.totalChunks} semantic chunks created`)
    console.log(`🎯 ${Object.keys(results.suggestions.recommended).length} recommended bundles`)
    
    console.log('\n🎯 Recommended Bundles:')
    for (const [name, patterns] of Object.entries(results.suggestions.recommended)) {
      console.log(`  • ${name}: ${patterns.length} patterns`)
    }
    
    console.log('\n💡 Notes:')
    results.suggestions.notes.forEach(note => {
      const emoji = note.type === 'warning' ? '⚠️' : note.type === 'optimization' ? '🔧' : '💡'
      console.log(`  ${emoji} ${note.message}`)
    })
    
    console.log('\n✅ Semantic integration complete!')
    console.log('📄 Check semantic-bundle-suggestions.json for ready-to-use bundle configurations')
    
  } catch (error) {
    console.error('❌ Integration failed:', error.message)
    process.exit(1)
  }
}