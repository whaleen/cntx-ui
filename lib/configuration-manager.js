/**
 * Configuration Manager for cntx-ui
 * Handles all configuration files, settings, and persistence
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import DatabaseManager from './database-manager.js';

export default class ConfigurationManager {
  constructor(cwd = process.cwd(), options = {}) {
    this.CWD = cwd;
    this.CNTX_DIR = join(cwd, '.cntx');
    this.verbose = options.verbose || false;

    // Configuration files
    this.CONFIG_FILE = join(this.CNTX_DIR, 'config.json');
    this.BUNDLE_STATES_FILE = join(this.CNTX_DIR, 'bundle-states.json');
    this.HIDDEN_FILES_CONFIG_FILE = join(this.CNTX_DIR, 'hidden-files.json');
    this.IGNORE_FILE = join(this.CWD, '.cntxignore');
    this.GITIGNORE_FILE = join(this.CWD, '.gitignore');
    this.CURSOR_RULES_FILE = join(this.CWD, '.cursorrules');
    this.CLAUDE_MD_FILE = join(this.CWD, 'CLAUDE.md');
    this.HEURISTICS_CONFIG_FILE = join(this.CNTX_DIR, 'heuristics-config.json');
    this.SEMANTIC_CACHE_FILE = join(this.CNTX_DIR, 'semantic-cache.json');

    // Configuration data
    this.config = {};
    this.bundleStates = new Map();
    this.hiddenFilesConfig = {
      hiddenFiles: new Map(),
      userIgnorePatterns: []
    };
    this.ignorePatterns = [];

    // Initialize database manager
    this.dbManager = new DatabaseManager(this.CNTX_DIR, { verbose: this.verbose });
    
    // Load initial configuration
    this.loadConfig();
    
    // Load bundles (try SQLite first, fallback to JSON)
    this.loadBundleStates();
  }

  // === Bundle Configuration ===

  loadConfig() {
    if (existsSync(this.CONFIG_FILE)) {
      const config = JSON.parse(readFileSync(this.CONFIG_FILE, 'utf8'));

      // Load non-bundle settings only
      this.editor = config.editor || 'code';
      
      // Store full config for other non-bundle settings
      this.config = config;
    } else {
      // Set defaults
      this.editor = 'code';
      this.config = {};
    }

    // Bundle loading is now handled by loadBundleStates()
  }

  saveConfig(config) {
    writeFileSync(this.CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  // === Bundle States Persistence ===

  loadBundleStates() {
    // Try loading from SQLite first
    try {
      this.bundleStates = this.dbManager.loadBundles();
      
      if (this.bundleStates.size > 0) {
        if (this.verbose) {
          console.log('✅ Loaded bundles from SQLite database');
        }
        return;
      }
    } catch (error) {
      if (this.verbose) {
        console.log('⚠️ SQLite load failed, trying JSON fallback:', error.message);
      }
    }

    // Fallback to JSON file
    this.bundleStates.clear();
    
    if (existsSync(this.BUNDLE_STATES_FILE)) {
      try {
        const bundleStates = JSON.parse(readFileSync(this.BUNDLE_STATES_FILE, 'utf8'));

        bundleStates.forEach(state => {
          this.bundleStates.set(state.name, {
            patterns: state.patterns || [],
            files: (state.files || []).map(file => {
              if (file.startsWith('/')) {
                const relativePath = require('path').relative(this.CWD, file);
                return relativePath;
              } else {
                return file;
              }
            }),
            content: state.content || '',
            size: state.size || 0,
            generated: state.generated || null,
            changed: false
          });
        });
        
        // Migrate JSON data to SQLite
        this.dbManager.saveBundles(this.bundleStates);
        if (this.verbose) {
          console.log('📦 Migrated bundle data from JSON to SQLite');
        }
      } catch (error) {
        console.error('Failed to load bundle states from JSON:', error.message);
      }
    }

    // Ensure 'master' bundle exists
    if (!this.bundleStates.has('master')) {
      this.bundleStates.set('master', {
        patterns: ['**/*'],
        files: [],
        content: '',
        changed: false,
        size: 0,
        generated: null
      });
    }
  }

  saveBundleStates() {
    try {
      // Save to SQLite database (primary)
      this.dbManager.saveBundles(this.bundleStates);
      
      // Also save to JSON for compatibility/backup
      const bundleStates = Array.from(this.bundleStates.entries()).map(([name, bundle]) => ({
        name,
        contentPreview: bundle.content ? bundle.content.substring(0, 200) + '...' : '',
        size: bundle.size,
        fileCount: bundle.files ? bundle.files.length : 0,
        generated: bundle.generated,
        changed: bundle.changed,
        patterns: bundle.patterns,
        files: (bundle.files || []).map(file => {
          if (file.startsWith('/')) {
            return relative(this.CWD, file);
          } else {
            return file;
          }
        })
      }));

      writeFileSync(this.BUNDLE_STATES_FILE, JSON.stringify(bundleStates, null, 2));
      if (this.verbose) {
        console.log(`💾 Saved ${bundleStates.length} bundles to SQLite + JSON`);
      }
    } catch (error) {
      if (this.verbose) {
        console.warn('⚠️ Failed to save bundle states:', error.message);
      }
      // Try to save just the essential info
      try {
        const minimalStates = Array.from(this.bundleStates.entries()).map(([name, bundle]) => ({
          name,
          size: bundle.size || 0,
          fileCount: bundle.files ? bundle.files.length : 0,
          generated: bundle.generated || new Date().toISOString()
        }));
        writeFileSync(this.BUNDLE_STATES_FILE, JSON.stringify(minimalStates, null, 2));
        if (this.verbose) {
          console.log(`💾 Saved minimal bundle states for ${minimalStates.length} bundles`);
        }
      } catch (fallbackError) {
        if (this.verbose) {
          console.error('❌ Failed to save even minimal bundle states:', fallbackError.message);
        }
      }
    }
  }

  // === Hidden Files Configuration ===

  loadHiddenFilesConfig() {
    if (existsSync(this.HIDDEN_FILES_CONFIG_FILE)) {
      try {
        this.hiddenFilesConfig = JSON.parse(readFileSync(this.HIDDEN_FILES_CONFIG_FILE, 'utf8'));
      } catch (error) {
        console.error('Failed to load hidden files config:', error.message);
      }
    }
  }

  saveHiddenFilesConfig() {
    writeFileSync(this.HIDDEN_FILES_CONFIG_FILE, JSON.stringify(this.hiddenFilesConfig, null, 2));
  }

  isFileHidden(filePath, bundleName = null) {
    // Check global hidden files
    if (this.hiddenFilesConfig.globalHidden.includes(filePath)) {
      return true;
    }

    // Check bundle-specific hidden files
    if (bundleName && this.hiddenFilesConfig.bundleSpecific[bundleName]?.includes(filePath)) {
      return true;
    }

    return false;
  }

  toggleFileVisibility(filePath, bundleName = null, forceHide = null) {
    if (bundleName) {
      // Bundle-specific hiding
      if (!this.hiddenFilesConfig.bundleSpecific[bundleName]) {
        this.hiddenFilesConfig.bundleSpecific[bundleName] = [];
      }

      const bundleHidden = this.hiddenFilesConfig.bundleSpecific[bundleName];
      const isCurrentlyHidden = bundleHidden.includes(filePath);

      if (forceHide === true || (forceHide === null && !isCurrentlyHidden)) {
        if (!isCurrentlyHidden) {
          bundleHidden.push(filePath);
        }
      } else {
        const index = bundleHidden.indexOf(filePath);
        if (index > -1) {
          bundleHidden.splice(index, 1);
        }
      }
    } else {
      // Global hiding
      const isCurrentlyHidden = this.hiddenFilesConfig.globalHidden.includes(filePath);

      if (forceHide === true || (forceHide === null && !isCurrentlyHidden)) {
        if (!isCurrentlyHidden) {
          this.hiddenFilesConfig.globalHidden.push(filePath);
        }
      } else {
        const index = this.hiddenFilesConfig.globalHidden.indexOf(filePath);
        if (index > -1) {
          this.hiddenFilesConfig.globalHidden.splice(index, 1);
        }
      }
    }

    this.saveHiddenFilesConfig();
  }

  bulkToggleFileVisibility(filePaths, bundleName = null, forceHide = null) {
    filePaths.forEach(filePath => {
      this.toggleFileVisibility(filePath, bundleName, forceHide);
    });
  }

  // === Ignore Patterns Management ===

  addUserIgnorePattern(pattern) {
    if (!this.hiddenFilesConfig.userIgnorePatterns.some(p => p.pattern === pattern)) {
      this.hiddenFilesConfig.userIgnorePatterns.push({
        pattern,
        enabled: true,
        addedAt: new Date().toISOString()
      });
      this.saveHiddenFilesConfig();
    }
  }

  removeUserIgnorePattern(pattern) {
    const index = this.hiddenFilesConfig.userIgnorePatterns.findIndex(p => p.pattern === pattern);
    if (index > -1) {
      this.hiddenFilesConfig.userIgnorePatterns.splice(index, 1);
      this.saveHiddenFilesConfig();
    }
  }

  toggleSystemIgnorePattern(pattern) {
    const isDisabled = this.hiddenFilesConfig.disabledSystemPatterns.includes(pattern);

    if (isDisabled) {
      const index = this.hiddenFilesConfig.disabledSystemPatterns.indexOf(pattern);
      this.hiddenFilesConfig.disabledSystemPatterns.splice(index, 1);
    } else {
      this.hiddenFilesConfig.disabledSystemPatterns.push(pattern);
    }

    this.saveHiddenFilesConfig();
  }

  loadIgnorePatterns() {
    this.ignorePatterns = [];

    // System patterns - common files to ignore
    const systemPatterns = [
      'node_modules/**/*', '.git/**/*', '.svn/**/*', '.hg/**/*',
      '*.log', '*.tmp', '*.temp', '*.cache', '*.pid',
      '.DS_Store', 'Thumbs.db', '.env', '.env.*',
      'dist/**/*', 'build/**/*', 'coverage/**/*',
      '*.min.js', '*.min.css', '*.map',
      '**/*.lock', 'yarn.lock', 'package-lock.json',
      '.vscode/**/*', '.idea/**/*', '*.swp', '*.swo',
      '__pycache__/**/*', '*.pyc', '*.pyo',
      '.pytest_cache/**/*', '.coverage',
      'target/**/*', '*.class', '*.jar',
      'bin/**/*', 'obj/**/*', '*.exe', '*.dll',
      '.next/**/*', '.nuxt/**/*', '.vite/**/*',
      'public/build/**/*', 'static/build/**/*'
    ];

    // Add all system patterns (always enabled now)
    this.ignorePatterns.push(...systemPatterns);

    // File-based patterns (.cntxignore)
    if (existsSync(this.IGNORE_FILE)) {
      try {
        const content = readFileSync(this.IGNORE_FILE, 'utf8');
        content.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
          .forEach(pattern => this.ignorePatterns.push(pattern));
      } catch (error) {
        console.error('Failed to load .cntxignore:', error.message);
      }
    }

    if (this.verbose) {
      console.log(`🚫 Loaded ${this.ignorePatterns.length} ignore patterns`);
    }
  }

  updateIgnoreFile() {
    const header = '# cntx-ui ignore patterns\n# This file is auto-generated. User patterns are managed via the UI.\n\n';
    const userPatterns = this.hiddenFilesConfig.userIgnorePatterns
      .filter(p => p.enabled)
      .map(p => p.pattern)
      .join('\n');

    writeFileSync(this.IGNORE_FILE, header + userPatterns);
  }

  loadCntxignore() {
    if (existsSync(this.IGNORE_FILE)) {
      return readFileSync(this.IGNORE_FILE, 'utf8');
    }
    return '';
  }

  loadGitignore() {
    if (existsSync(this.GITIGNORE_FILE)) {
      return readFileSync(this.GITIGNORE_FILE, 'utf8');
    }
    return '';
  }

  saveGitignore(content) {
    writeFileSync(this.GITIGNORE_FILE, content);
  }

  // === Cursor Rules Management ===

  loadCursorRules() {
    if (existsSync(this.CURSOR_RULES_FILE)) {
      return readFileSync(this.CURSOR_RULES_FILE, 'utf8');
    }
    return this.getDefaultCursorRules();
  }

  saveCursorRules(content) {
    writeFileSync(this.CURSOR_RULES_FILE, content);
  }

  getDefaultCursorRules() {
    let pkg = {};
    try {
      const packagePath = join(this.CWD, 'package.json');
      if (existsSync(packagePath)) {
        pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to read package.json:', error.message);
    }

    const projectType = this.detectProjectType(pkg);
    return this.generateCursorRulesTemplate({ projectType, name: pkg.name });
  }

  detectProjectType(pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.react || deps['@types/react']) return 'react';
    if (deps.vue || deps['@vue/cli']) return 'vue';
    if (deps.angular || deps['@angular/core']) return 'angular';
    if (deps.next || deps['next']) return 'next';
    if (deps.express || deps.fastify) return 'node-backend';

    return 'javascript';
  }

  generateCursorRulesTemplate(projectInfo) {
    const { projectType, name } = projectInfo;

    const baseRules = `# Cursor Rules for ${name || 'Project'}

## Project Overview
This is a ${projectType} project. Please follow these guidelines when making changes:

## Code Style
- Use consistent indentation (2 spaces for JS/TS, 4 for Python)
- Follow existing naming conventions
- Add comments for complex logic
- Keep functions small and focused

## Architecture
- Maintain separation of concerns
- Follow established patterns in the codebase
- Consider performance implications
- Ensure code is testable

## Testing
- Write tests for new functionality
- Update existing tests when modifying code
- Aim for good test coverage
- Use descriptive test names`;

    const typeSpecificRules = {
      react: `
## React Specific
- Use functional components with hooks
- Follow component composition patterns
- Keep components focused on single responsibility
- Use TypeScript for type safety
- Handle loading and error states properly`,

      vue: `
## Vue Specific
- Use Composition API for new components
- Follow single-file component structure
- Use reactive refs appropriately
- Implement proper event handling
- Follow Vue style guide conventions`,

      angular: `
## Angular Specific
- Follow Angular style guide
- Use dependency injection properly
- Implement proper lifecycle hooks
- Use reactive forms for complex forms
- Follow module organization patterns`,

      'node-backend': `
## Backend Specific
- Implement proper error handling
- Use middleware for common functionality
- Validate input data
- Follow REST API conventions
- Implement proper logging`,

      javascript: `
## JavaScript Specific
- Use modern ES6+ features appropriately
- Handle promises and async operations properly
- Implement error handling
- Follow functional programming principles where applicable
- Use appropriate data structures`
    };

    return baseRules + (typeSpecificRules[projectType] || typeSpecificRules.javascript) + `

## File Organization
- Keep related files together
- Use descriptive file names
- Maintain consistent directory structure
- Avoid deeply nested directories

## Documentation
- Update README when adding features
- Document complex algorithms
- Keep inline comments current
- Use JSDoc for function documentation`;
  }

  // === Claude.md Management ===

  loadClaudeMd() {
    if (existsSync(this.CLAUDE_MD_FILE)) {
      return readFileSync(this.CLAUDE_MD_FILE, 'utf8');
    }
    return this.getDefaultClaudeMd();
  }

  saveClaudeMd(content) {
    writeFileSync(this.CLAUDE_MD_FILE, content);
  }

  getDefaultClaudeMd() {
    let projectInfo = {};
    try {
      const packagePath = join(this.CWD, 'package.json');
      if (existsSync(packagePath)) {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
        projectInfo = {
          name: pkg.name,
          description: pkg.description,
          projectType: this.detectProjectType(pkg)
        };
      }
    } catch (error) {
      projectInfo = { name: 'Project', description: '', projectType: 'javascript' };
    }

    return this.generateClaudeMdTemplate(projectInfo);
  }

  generateClaudeMdTemplate(projectInfo) {
    const { name, description, projectType } = projectInfo;

    return `# ${name || 'Project'} - Claude Context

## Project Overview
${description || 'A ' + projectType + ' project'}

## Architecture
Please describe your project architecture here:
- Main components/modules
- Data flow patterns
- Key dependencies
- Design decisions

## Development Guidelines
- Code style preferences
- Testing approach
- Deployment process
- Known limitations or considerations

## Context for AI
When working on this project, please:
- Follow existing patterns and conventions
- Consider the overall architecture
- Maintain code quality and consistency
- Ask for clarification on complex requirements

## Current Focus
<!-- Update this section with current development priorities -->
- Feature development
- Bug fixes
- Performance improvements
- Documentation updates`;
  }

  // === Heuristics Configuration ===

  loadHeuristicsConfig() {
    if (existsSync(this.HEURISTICS_CONFIG_FILE)) {
      try {
        return JSON.parse(readFileSync(this.HEURISTICS_CONFIG_FILE, 'utf8'));
      } catch (error) {
        console.error('Failed to load heuristics config:', error.message);
      }
    }
    return this.getDefaultHeuristicsConfig();
  }

  saveHeuristicsConfig(config) {
    writeFileSync(this.HEURISTICS_CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  getDefaultHeuristicsConfig() {
    return {
      bundlePurposePatterns: {
        'frontend': {
          patterns: ['src/components/**', 'src/pages/**', 'src/views/**', 'public/**', 'assets/**', 'styles/**'],
          description: 'User interface components and styling'
        },
        'backend': {
          patterns: ['src/api/**', 'src/server/**', 'src/routes/**', 'src/controllers/**', 'src/middleware/**'],
          description: 'Server-side logic and API endpoints'
        },
        'database': {
          patterns: ['src/models/**', 'src/schemas/**', 'src/migrations/**', 'prisma/**', 'db/**'],
          description: 'Database models and migrations'
        },
        'utilities': {
          patterns: ['src/utils/**', 'src/helpers/**', 'src/lib/**', 'lib/**'],
          description: 'Utility functions and shared libraries'
        },
        'configuration': {
          patterns: ['config/**', '*.config.js', '*.config.ts', '.env*', 'docker*', 'webpack*'],
          description: 'Configuration files and environment setup'
        },
        'testing': {
          patterns: ['test/**', 'tests/**', 'spec/**', '**/*.test.*', '**/*.spec.*', '__tests__/**'],
          description: 'Test files and testing utilities'
        },
        'documentation': {
          patterns: ['docs/**', '*.md', 'README*', 'CHANGELOG*', 'LICENSE*'],
          description: 'Documentation and readme files'
        },
        'build': {
          patterns: ['build/**', 'dist/**', 'out/**', 'target/**', 'bin/**'],
          description: 'Built/compiled output files'
        }
      },
      fileTypeHeuristics: {
        'javascript': {
          extensions: ['.js', '.jsx', '.mjs', '.cjs'],
          role: 'Implementation files containing business logic'
        },
        'typescript': {
          extensions: ['.ts', '.tsx'],
          role: 'Type-safe implementation files'
        },
        'configuration': {
          extensions: ['.json', '.yaml', '.yml', '.toml', '.ini'],
          role: 'Configuration and data files'
        },
        'styling': {
          extensions: ['.css', '.scss', '.sass', '.less', '.styl'],
          role: 'Styling and presentation files'
        },
        'markup': {
          extensions: ['.html', '.htm', '.xml', '.svg'],
          role: 'Markup and template files'
        },
        'documentation': {
          extensions: ['.md', '.txt', '.rst'],
          role: 'Documentation and text files'
        }
      }
    };
  }

  // === Semantic Cache Management ===

  loadSemanticCache() {
    try {
      if (!existsSync(this.SEMANTIC_CACHE_FILE)) {
        console.log('🔍 No semantic cache file found');
        return null;
      }

      const cacheData = JSON.parse(readFileSync(this.SEMANTIC_CACHE_FILE, 'utf8'));

      // Simple cache validation - could be enhanced with file modification time checks
      const cacheAge = Date.now() - cacheData.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > maxAge) {
        console.log('🔍 Semantic cache is too old, will regenerate');
        return null;
      }

      // Validate that chunks have embeddings
      const hasEmbeddings = cacheData.analysis?.chunks?.some(chunk => chunk.embedding);
      if (!hasEmbeddings) {
        console.log('🔍 Cached chunks missing embeddings, will regenerate');
        return null;
      }

      if (this.verbose) {
        console.log(`✅ Loaded semantic cache from disk (${cacheData.analysis.chunks.length} chunks with embeddings)`);
      }
      return { analysis: cacheData.analysis, timestamp: cacheData.timestamp };
    } catch (error) {
      console.error('❌ Failed to load semantic cache:', error.message);
      return null;
    }
  }

  saveSemanticCache(analysis) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        analysis: analysis,
        version: '1.0'
      };

      writeFileSync(this.SEMANTIC_CACHE_FILE, JSON.stringify(cacheData, null, 2));
      console.log('💾 Saved semantic cache with embeddings to disk');
    } catch (error) {
      console.error('❌ Failed to save semantic cache:', error.message);
    }
  }

  invalidateSemanticCache() {
    try {
      if (existsSync(this.SEMANTIC_CACHE_FILE)) {
        unlinkSync(this.SEMANTIC_CACHE_FILE);
        console.log('🗑️ Cleared semantic cache file');
      }
    } catch (error) {
      console.error('❌ Failed to clear cache file:', error.message);
    }
  }

  // === Bundle Creation from Chunks ===

  createBundleFromChunk(chunkName, files) {
    const bundleName = `chunk-${chunkName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Create bundle configuration
    const patterns = files.map(file => file.replace(/\\/g, '/'));

    this.bundleStates.set(bundleName, {
      patterns: patterns,
      files: [],
      content: '',
      changed: false,
      size: 0,
      generated: null
    });

    // Save to bundle-states.json (single source of truth)
    this.saveBundleStates();

    return bundleName;
  }

  // === Getters ===

  getBundles() {
    return this.bundleStates;
  }

  getIgnorePatterns() {
    return this.ignorePatterns;
  }

  getHiddenFilesConfig() {
    return this.hiddenFilesConfig;
  }

  getEditor() {
    return this.editor;
  }
}
