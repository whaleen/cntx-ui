/**
 * Heuristics Manager - Centralized service for loading and applying heuristics
 * Manages configuration-based code categorization logic
 */

import { readFileSync, existsSync, watchFile } from 'fs'
import { join } from 'path'

export default class HeuristicsManager {
  constructor(configPath = './heuristics-config.json') {
    this.configPath = configPath
    this.config = null
    this.cache = new Map()
    this.isWatching = false
    this.lastLoaded = null
  }

  /**
   * Load heuristics configuration from file
   */
  loadConfig() {
    try {
      if (!existsSync(this.configPath)) {
        console.warn(`Heuristics config not found at ${this.configPath}, using fallback`)
        this.config = this.getFallbackConfig()
        return
      }

      const configContent = readFileSync(this.configPath, 'utf8')
      const newConfig = JSON.parse(configContent)
      
      // Validate config structure
      this.validateConfig(newConfig)
      
      this.config = newConfig
      this.lastLoaded = Date.now()
      this.cache.clear() // Clear cache when config changes
      
      // Set up file watching if not already watching
      if (!this.isWatching) {
        this.setupFileWatcher()
      }
      
      console.log('✅ Heuristics configuration loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load heuristics config:', error.message)
      console.log('📦 Falling back to hardcoded heuristics')
      this.config = this.getFallbackConfig()
    }
  }

  /**
   * Validate heuristics configuration structure
   */
  validateConfig(config) {
    const required = ['purposeHeuristics', 'bundleHeuristics', 'semanticTypeMapping']
    
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Validate purpose heuristics structure
    if (!config.purposeHeuristics.patterns || !config.purposeHeuristics.fallback) {
      throw new Error('Invalid purposeHeuristics structure')
    }

    // Validate bundle heuristics structure  
    if (!config.bundleHeuristics.patterns || !config.bundleHeuristics.fallback) {
      throw new Error('Invalid bundleHeuristics structure')
    }
  }

  /**
   * Set up file watcher for config changes
   */
  setupFileWatcher() {
    if (!existsSync(this.configPath)) return
    
    watchFile(this.configPath, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log('📝 Heuristics config file changed, reloading...')
        this.loadConfig()
      }
    })
    
    this.isWatching = true
  }

  /**
   * Get configuration, loading if necessary
   */
  getConfig() {
    if (!this.config) {
      this.loadConfig()
    }
    return this.config
  }

  /**
   * Determine function purpose using configured heuristics
   */
  determinePurpose(func) {
    const config = this.getConfig()
    const name = func.name.toLowerCase()
    
    // Check each purpose pattern
    for (const [patternName, pattern] of Object.entries(config.purposeHeuristics.patterns)) {
      if (this.evaluateConditions(pattern.conditions, { func, name })) {
        return pattern.purpose
      }
    }
    
    // Return fallback
    return config.purposeHeuristics.fallback.purpose
  }

  /**
   * Suggest bundles for file using configured heuristics
   */
  suggestBundlesForFile(filePath) {
    const config = this.getConfig()
    const fileName = filePath.toLowerCase()
    const pathParts = fileName.split('/')
    const suggestions = []
    
    // Check each bundle pattern
    for (const [patternName, pattern] of Object.entries(config.bundleHeuristics.patterns)) {
      if (this.evaluateConditions(pattern.conditions, { fileName, filePath, pathParts })) {
        suggestions.push(pattern.bundle)
        
        // Check sub-patterns
        if (pattern.subPatterns) {
          for (const [subName, subPattern] of Object.entries(pattern.subPatterns)) {
            if (this.evaluateConditions(subPattern.conditions, { fileName, filePath, pathParts })) {
              suggestions.push(subPattern.bundle)
            }
          }
        }
      }
    }
    
    // Apply fallback logic if no suggestions
    if (suggestions.length === 0) {
      const fallback = config.bundleHeuristics.fallback
      
      if (fallback.webFallback && this.evaluateConditions(fallback.webFallback.conditions, { fileName, filePath, pathParts })) {
        suggestions.push(fallback.webFallback.bundle)
      } else if (fallback.defaultFallback) {
        suggestions.push(...fallback.defaultFallback.bundles)
      }
    }
    
    return [...new Set(suggestions)] // Remove duplicates
  }

  /**
   * Get semantic type cluster mapping
   */
  getSemanticTypeMapping() {
    const config = this.getConfig()
    const mapping = {}
    
    for (const [clusterName, cluster] of Object.entries(config.semanticTypeMapping.clusters)) {
      for (const type of cluster.types) {
        mapping[type] = cluster.clusterId
      }
    }
    
    return mapping
  }

  /**
   * Evaluate condition strings against context
   */
  evaluateConditions(conditions, context) {
    if (!Array.isArray(conditions)) {
      conditions = [conditions]
    }
    
    // For React hook pattern, we need AND logic (all conditions must be true)
    // For other patterns, we use OR logic (any condition can be true)
    const needsAndLogic = this.requiresAndLogic(conditions)
    
    if (needsAndLogic) {
      return conditions.every(condition => {
        try {
          return this.evaluateCondition(condition, context)
        } catch (error) {
          console.warn(`Failed to evaluate condition: ${condition}`, error)
          return false
        }
      })
    } else {
      return conditions.some(condition => {
        try {
          return this.evaluateCondition(condition, context)
        } catch (error) {
          console.warn(`Failed to evaluate condition: ${condition}`, error)
          return false
        }
      })
    }
  }

  /**
   * Determine if conditions require AND logic vs OR logic
   */
  requiresAndLogic(conditions) {
    // React hook pattern specifically needs AND logic
    if (conditions.length === 2 && 
        conditions.some(c => c.includes('name.startsWith')) && 
        conditions.some(c => c.includes('func.type'))) {
      return true
    }
    
    // Frontend pattern needs AND logic for web + src
    if (conditions.length === 2 && 
        conditions.some(c => c.includes("pathParts.includes('web')")) && 
        conditions.some(c => c.includes("pathParts.includes('src')"))) {
      return true
    }
    
    // Default to OR logic for other patterns
    return false
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, context) {
    const { func, name, fileName, filePath, pathParts } = context
    
    // Handle function type conditions
    if (condition.includes('func.type ===')) {
      const typeMatch = condition.match(/func\.type === ['"]([^'"]+)['"]/)
      if (typeMatch && func) {
        return func.type === typeMatch[1]
      }
    }
    
    // Handle name-based conditions
    if (condition.includes('name.startsWith(')) {
      const prefixMatch = condition.match(/name\.startsWith\(['"]([^'"]+)['"]\)/)
      if (prefixMatch && name) {
        return name.startsWith(prefixMatch[1])
      }
    }
    
    if (condition.includes('name.includes(')) {
      const includesMatch = condition.match(/name\.includes\(['"]([^'"]+)['"]\)/)
      if (includesMatch && name) {
        return name.includes(includesMatch[1])
      }
    }
    
    // Handle fileName conditions
    if (condition.includes('fileName.includes(')) {
      const includesMatch = condition.match(/fileName\.includes\(['"]([^'"]+)['"]\)/)
      if (includesMatch && fileName) {
        return fileName.includes(includesMatch[1])
      }
    }
    
    if (condition.includes('fileName.endsWith(')) {
      const endsWithMatch = condition.match(/fileName\.endsWith\(['"]([^'"]+)['"]\)/)
      if (endsWithMatch && fileName) {
        return fileName.endsWith(endsWithMatch[1])
      }
    }
    
    // Handle pathParts conditions
    if (condition.includes('pathParts.includes(')) {
      const includesMatch = condition.match(/pathParts\.includes\(['"]([^'"]+)['"]\)/)
      if (includesMatch && pathParts) {
        return pathParts.includes(includesMatch[1])
      }
    }
    
    return false
  }

  /**
   * Fallback configuration for when config file is unavailable
   */
  getFallbackConfig() {
    return {
      version: "1.0.0",
      purposeHeuristics: {
        patterns: {
          reactComponent: {
            conditions: ["func.type === 'react_component'"],
            purpose: "React component",
            confidence: 0.95
          },
          reactHook: {
            conditions: ["name.startsWith('use')", "func.type === 'function'"],
            purpose: "React hook",
            confidence: 0.9
          },
          apiHandler: {
            conditions: ["name.includes('api')", "name.includes('endpoint')"],
            purpose: "API handler",
            confidence: 0.85
          },
          dataRetrieval: {
            conditions: ["name.includes('get')", "name.includes('fetch')"],
            purpose: "Data retrieval",
            confidence: 0.8
          },
          dataCreation: {
            conditions: ["name.includes('create')", "name.includes('add')"],
            purpose: "Data creation",
            confidence: 0.8
          },
          dataModification: {
            conditions: ["name.includes('update')", "name.includes('edit')"],
            purpose: "Data modification",
            confidence: 0.8
          },
          dataDeletion: {
            conditions: ["name.includes('delete')", "name.includes('remove')"],
            purpose: "Data deletion",
            confidence: 0.8
          },
          validation: {
            conditions: ["name.includes('validate')", "name.includes('check')"],
            purpose: "Validation",
            confidence: 0.75
          },
          dataProcessing: {
            conditions: ["name.includes('parse')", "name.includes('format')"],
            purpose: "Data processing",
            confidence: 0.75
          }
        },
        fallback: {
          purpose: "Utility function",
          confidence: 0.5
        }
      },
      bundleHeuristics: {
        patterns: {
          frontend: {
            conditions: ["pathParts.includes('web')", "pathParts.includes('src')"],
            bundle: "frontend",
            confidence: 0.8,
            subPatterns: {
              uiComponents: {
                conditions: ["pathParts.includes('components')"],
                bundle: "ui-components",
                confidence: 0.9
              }
            }
          },
          server: {
            conditions: ["fileName.includes('server')", "fileName.includes('api')", "pathParts.includes('bin')"],
            bundle: "server",
            confidence: 0.85
          },
          configuration: {
            conditions: ["fileName.includes('config')", "fileName.includes('setup')", "fileName.endsWith('.json')", "fileName.endsWith('.sh')", "fileName.includes('package')"],
            bundle: "config",
            confidence: 0.9
          },
          documentation: {
            conditions: ["fileName.endsWith('.md')", "fileName.includes('doc')", "fileName.includes('readme')"],
            bundle: "docs",
            confidence: 0.95
          }
        },
        fallback: {
          webFallback: {
            conditions: ["pathParts.includes('web')"],
            bundle: "frontend",
            confidence: 0.6
          },
          defaultFallback: {
            bundles: ["server", "config"],
            confidence: 0.4
          }
        }
      },
      semanticTypeMapping: {
        clusters: {
          businessLogic: { types: ["business_logic", "algorithm"], clusterId: 0 },
          dataLayer: { types: ["data_processing", "database"], clusterId: 1 },
          apiLayer: { types: ["api_integration", "middleware", "routing"], clusterId: 2 },
          uiLayer: { types: ["ui_component", "page_component", "layout_component", "hook"], clusterId: 3 },
          utilities: { types: ["utility", "configuration", "function", "type_definition"], clusterId: 4 },
          testing: { types: ["testing", "documentation", "monitoring"], clusterId: 5 },
          infrastructure: { types: ["error_handling", "performance", "security"], clusterId: 6 },
          unknown: { types: ["unknown"], clusterId: 7 }
        }
      }
    }
  }

  /**
   * Update configuration (for API endpoints)
   */
  async updateConfig(newConfig) {
    this.validateConfig(newConfig)
    
    // TODO: Implement file writing when API endpoints are created
    // For now, just update in-memory config
    this.config = newConfig
    this.cache.clear()
    
    return true
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    // TODO: Implement performance tracking
    return {
      totalEvaluations: 0,
      accuracyScore: 0.0,
      lastUpdated: this.lastLoaded
    }
  }
}