/**
 * Heuristics Manager - Centralized service for loading and applying heuristics
 * Manages configuration-based code categorization logic
 */

import { readFileSync, writeFileSync, existsSync, watchFile } from 'fs'
import { join } from 'path'

export interface HeuristicPattern {
  conditions: string[];
  purpose: string;
  confidence: number;
}

export interface BundleHeuristic {
  conditions: string[];
  bundle: string;
  confidence: number;
  subPatterns?: Record<string, BundleHeuristic>;
}

export interface HeuristicsConfig {
  version: string;
  purposeHeuristics: {
    patterns: Record<string, HeuristicPattern>;
    fallback: { purpose: string; confidence: number };
  };
  bundleHeuristics: {
    patterns: Record<string, BundleHeuristic>;
    fallback: {
      webFallback?: { conditions: string[]; bundle: string; confidence: number };
      defaultFallback?: { bundles: string[]; confidence: number };
    };
  };
  semanticTypeMapping: {
    clusters: Record<string, { types: string[]; clusterId: number }>;
  };
}

export default class HeuristicsManager {
  configPath: string;
  config: HeuristicsConfig | null;
  cache: Map<string, any>;
  isWatching: boolean;
  lastLoaded: number | null;

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
      const newConfig = JSON.parse(configContent) as HeuristicsConfig
      
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
    } catch (error: any) {
      console.error('❌ Failed to load heuristics config:', error.message)
      console.log('📦 Falling back to hardcoded heuristics')
      this.config = this.getFallbackConfig()
    }
  }

  /**
   * Validate heuristics configuration structure
   */
  validateConfig(config: HeuristicsConfig) {
    const required = ['purposeHeuristics', 'bundleHeuristics', 'semanticTypeMapping'] as const
    
    for (const field of required) {
      if (!(config as any)[field]) {
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
  getConfig(): HeuristicsConfig {
    if (!this.config) {
      this.loadConfig()
    }
    return this.config!
  }

  /**
   * Determine function purpose using configured heuristics
   */
  determinePurpose(func: any): string {
    const config = this.getConfig();
    const name = (func.name || '').toLowerCase();
    const pathParts = func.pathParts || [];
    
    // Check each purpose pattern
    for (const [patternName, pattern] of Object.entries(config.purposeHeuristics.patterns)) {
      if (this.evaluateConditions(pattern.conditions, { func, name, pathParts })) {
        return pattern.purpose;
      }
    }
    
    // Return fallback
    return config.purposeHeuristics.fallback.purpose;
  }

  /**
   * Infer business domains (e.g. auth, editing, file-mgmt)
   */
  inferBusinessDomains(func: any): string[] {
    const domains = new Set<string>();
    const name = (func.name || '').toLowerCase();
    const path = (func.pathParts || []).join('/').toLowerCase();
    const imports = (func.includes?.imports || []).filter((i: any) => typeof i === 'string') as string[];

    // Path-based domains
    if (path.includes('auth')) domains.add('authentication');
    if (path.includes('component') || path.includes('ui')) domains.add('ui-layer');
    if (path.includes('service') || path.includes('api')) domains.add('api-integration');
    if (path.includes('test') || path.includes('spec')) domains.add('testing');

    // Import-based domains
    if (imports.some(i => i.includes('tauri'))) domains.add('desktop-runtime');
    if (imports.some(i => i.includes('tiptap') || i.includes('prosemirror'))) domains.add('text-editing');
    if (imports.some(i => i.includes('react'))) domains.add('frontend-ui');

    // Name-based domains
    if (/file|save|export|read|write/i.test(name)) domains.add('file-management');
    if (/login|user|session/i.test(name)) domains.add('authentication');

    return Array.from(domains);
  }

  /**
   * Infer technical patterns (e.g. hooks, async-io, event-handlers)
   */
  inferTechnicalPatterns(func: any): string[] {
    const patterns = new Set<string>();
    const name = (func.name || '').toLowerCase();
    const code = func.code || '';

    if (name.startsWith('use')) patterns.add('react-hooks');
    if (code.includes('async') || code.includes('await')) patterns.add('async-io');
    if (code.includes('on(') || code.includes('addListener') || name.startsWith('handle')) patterns.add('event-driven');
    if (code.includes('new ') || code.includes('class ')) patterns.add('object-oriented');
    if (func.isExported) patterns.add('public-api');

    return Array.from(patterns);
  }

  /**
   * Suggest bundles for file using configured heuristics
   */
  suggestBundlesForFile(filePath: string): string[] {
    const config = this.getConfig()
    const fileName = filePath.toLowerCase()
    const pathParts = fileName.split('/')
    const suggestions: string[] = []
    
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
  getSemanticTypeMapping(): Record<string, number> {
    const config = this.getConfig()
    const mapping: Record<string, number> = {}
    
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
  evaluateConditions(conditions: string | string[], context: any): boolean {
    const conds = Array.isArray(conditions) ? conditions : [conditions]
    
    // For purpose heuristics, we generally want high precision, so use AND logic 
    // if there are multiple conditions
    const needsAndLogic = conds.length > 1 || this.requiresAndLogic(conds)
    
    if (needsAndLogic) {
      return conds.every(condition => {
        try {
          return this.evaluateCondition(condition, context)
        } catch (error) {
          console.warn(`Failed to evaluate condition: ${condition}`, error)
          return false
        }
      })
    } else {
      return conds.some(condition => {
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
  requiresAndLogic(conditions: string[]): boolean {
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
  evaluateCondition(condition: string, context: any): boolean {
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

    // New: Check imports in the chunk context
    if (condition.includes('chunk.imports.includes(')) {
      const importMatch = condition.match(/chunk\.imports\.includes\(['"]([^'"]+)['"]\)/)
      if (importMatch && func?.includes?.imports) {
        return func.includes.imports
          .filter((i: any) => typeof i === 'string')
          .some((imp: string) => imp.includes(importMatch[1]))
      }
    }

    // New: Check for specific naming patterns (case-insensitive)
    if (condition.includes('name.matches(')) {
      const regexMatch = condition.match(/name\.matches\(['"]([^'"]+)['"]\)/)
      if (regexMatch && name) {
        return new RegExp(regexMatch[1], 'i').test(name)
      }
    }
    
    return false
  }

  /**
   * Fallback configuration for when config file is unavailable
   */
  getFallbackConfig(): HeuristicsConfig {
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
          serviceLayer: {
            conditions: ["pathParts.includes('services')"],
            purpose: "Service layer logic",
            confidence: 0.7
          },
          componentLayer: {
            conditions: ["pathParts.includes('components')"],
            purpose: "UI component logic",
            confidence: 0.7
          },
          tauriCommand: {
            conditions: ["name.matches('command')", "chunk.imports.includes('tauri')"],
            purpose: "Tauri backend command",
            confidence: 0.9
          },
          textEditing: {
            conditions: ["chunk.imports.includes('tiptap')", "chunk.imports.includes('prosemirror')"],
            purpose: "Rich text editing logic",
            confidence: 0.95
          },
          fileManagement: {
            conditions: ["pathParts.includes('services')", "name.matches('file|export|save')"],
            purpose: "File system service",
            confidence: 0.85
          },
          uiComponent: {
            conditions: ["pathParts.includes('components')", "name.matches('modal|button|menu|bar')"],
            purpose: "UI component logic",
            confidence: 0.85
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
   * Update configuration (for API endpoints) and persist to disk
   */
  async updateConfig(newConfig: HeuristicsConfig) {
    try {
      this.validateConfig(newConfig)
      
      // Write to disk
      writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), 'utf8')
      
      this.config = newConfig
      this.cache.clear()
      this.lastLoaded = Date.now()
      
      console.log('📝 Heuristics configuration updated and saved to disk')
      return true
    } catch (error: any) {
      console.error('❌ Failed to update heuristics config:', error.message)
      throw error
    }
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
