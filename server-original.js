import { readFileSync, writeFileSync, existsSync, mkdirSync, watch, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname, relative, extname, basename } from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import { startMCPTransport } from './lib/mcp-transport.js';
import SemanticSplitter from './lib/semantic-splitter.js';
import SimpleVectorStore from './lib/simple-vector-store.js';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return contentTypes[ext] || 'text/plain';
}

export class CntxServer {
  constructor(cwd = process.cwd(), options = {}) {
    this.CWD = cwd;
    this.CNTX_DIR = join(cwd, '.cntx');
    this.isQuietMode = options.quiet || false;
    this.CONFIG_FILE = join(this.CNTX_DIR, 'config.json');
    this.BUNDLES_FILE = join(this.CNTX_DIR, 'bundles.json');
    this.SEMANTIC_CACHE_FILE = join(this.CNTX_DIR, 'semantic-cache.json');
    this.HIDDEN_FILES_CONFIG = join(this.CNTX_DIR, 'hidden-files.json');
    this.IGNORE_FILE = join(cwd, '.cntxignore');
    this.CURSOR_RULES_FILE = join(cwd, '.cursorrules');
    this.CLAUDE_MD_FILE = join(cwd, 'CLAUDE.md');
    this.HEURISTICS_CONFIG_FILE = join(cwd, 'heuristics-config.json');
    this.ACTIVITIES_DIR = join(this.CNTX_DIR, 'activities', 'activities');

    this.bundles = new Map();
    this.ignorePatterns = [];
    this.watchers = [];
    this.clients = new Set();
    this.isScanning = false;
    this.mcpServer = null;
    this.mcpServerStarted = false;

    this.hiddenFilesConfig = {
      globalHidden: [], // Files hidden across all bundles
      bundleSpecific: {}, // Files hidden per bundle: { bundleName: [filePaths] }
      userIgnorePatterns: [], // User-added ignore patterns
      disabledSystemPatterns: [] // System patterns the user disabled
    };

    // Semantic splitting (parallel to bundle system)
    this.semanticSplitter = new SemanticSplitter({
      maxChunkSize: 2000,
      includeContext: true,
      groupRelated: true,
      minFunctionSize: 50
    });
    this.semanticCache = null;
    this.lastSemanticAnalysis = null;

    // Vector database for semantic search
    this.vectorStore = new SimpleVectorStore({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      collectionName: 'code-chunks'
    });
    this.vectorStoreInitialized = false;
  }

  init() {
    if (!existsSync(this.CNTX_DIR)) mkdirSync(this.CNTX_DIR, { recursive: true });
    this.loadConfig();
    this.loadHiddenFilesConfig();
    this.loadIgnorePatterns();
    this.loadBundleStates();
    this.loadSemanticCache(); // Load semantic cache on init
    this.startWatching();
    this.generateAllBundles();
  }

  loadConfig() {
    // Clear existing bundles to ensure deleted ones are removed
    this.bundles.clear();

    if (existsSync(this.CONFIG_FILE)) {
      const config = JSON.parse(readFileSync(this.CONFIG_FILE, 'utf8'));
      Object.entries(config.bundles || {}).forEach(([name, patterns]) => {
        this.bundles.set(name, {
          patterns: Array.isArray(patterns) ? patterns : [patterns],
          files: [],
          content: '',
          changed: false,
          lastGenerated: null,
          size: 0
        });
      });
    }

    if (!this.bundles.has('master')) {
      this.bundles.set('master', {
        patterns: ['**/*'],
        files: [],
        content: '',
        changed: false,
        lastGenerated: null,
        size: 0
      });
    }
  }

  loadHiddenFilesConfig() {
    if (existsSync(this.HIDDEN_FILES_CONFIG)) {
      try {
        const config = JSON.parse(readFileSync(this.HIDDEN_FILES_CONFIG, 'utf8'));
        this.hiddenFilesConfig = { ...this.hiddenFilesConfig, ...config };
      } catch (e) {
        if (!this.isQuietMode) console.warn('Could not load hidden files config:', e.message);
      }
    }
  }

  saveHiddenFilesConfig() {
    try {
      writeFileSync(this.HIDDEN_FILES_CONFIG, JSON.stringify(this.hiddenFilesConfig, null, 2));
    } catch (e) {
      if (!this.isQuietMode) console.error('Failed to save hidden files config:', e.message);
    }
  }

  isFileHidden(filePath, bundleName = null) {
    // Check global hidden files
    if (this.hiddenFilesConfig.globalHidden.includes(filePath)) {
      return true;
    }

    // Check bundle-specific hidden files
    if (bundleName && this.hiddenFilesConfig.bundleSpecific[bundleName]) {
      return this.hiddenFilesConfig.bundleSpecific[bundleName].includes(filePath);
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

      if (forceHide === null) {
        // Toggle current state
        if (isCurrentlyHidden) {
          this.hiddenFilesConfig.bundleSpecific[bundleName] = bundleHidden.filter(f => f !== filePath);
        } else {
          bundleHidden.push(filePath);
        }
      } else {
        // Force to specific state
        if (forceHide && !isCurrentlyHidden) {
          bundleHidden.push(filePath);
        } else if (!forceHide && isCurrentlyHidden) {
          this.hiddenFilesConfig.bundleSpecific[bundleName] = bundleHidden.filter(f => f !== filePath);
        }
      }
    } else {
      // Global hiding
      const isCurrentlyHidden = this.hiddenFilesConfig.globalHidden.includes(filePath);

      if (forceHide === null) {
        // Toggle current state
        if (isCurrentlyHidden) {
          this.hiddenFilesConfig.globalHidden = this.hiddenFilesConfig.globalHidden.filter(f => f !== filePath);
        } else {
          this.hiddenFilesConfig.globalHidden.push(filePath);
        }
      } else {
        // Force to specific state
        if (forceHide && !isCurrentlyHidden) {
          this.hiddenFilesConfig.globalHidden.push(filePath);
        } else if (!forceHide && isCurrentlyHidden) {
          this.hiddenFilesConfig.globalHidden = this.hiddenFilesConfig.globalHidden.filter(f => f !== filePath);
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

  addUserIgnorePattern(pattern) {
    if (!this.hiddenFilesConfig.userIgnorePatterns.includes(pattern)) {
      this.hiddenFilesConfig.userIgnorePatterns.push(pattern);
      this.saveHiddenFilesConfig();
      this.loadIgnorePatterns();
      this.generateAllBundles();
      return true;
    }
    return false;
  }

  removeUserIgnorePattern(pattern) {
    const index = this.hiddenFilesConfig.userIgnorePatterns.indexOf(pattern);
    if (index > -1) {
      this.hiddenFilesConfig.userIgnorePatterns.splice(index, 1);
      this.saveHiddenFilesConfig();
      this.loadIgnorePatterns();
      this.generateAllBundles();
      return true;
    }
    return false;
  }

  toggleSystemIgnorePattern(pattern) {
    const index = this.hiddenFilesConfig.disabledSystemPatterns.indexOf(pattern);
    if (index > -1) {
      // Re-enable the pattern
      this.hiddenFilesConfig.disabledSystemPatterns.splice(index, 1);
    } else {
      // Disable the pattern
      this.hiddenFilesConfig.disabledSystemPatterns.push(pattern);
    }

    this.saveHiddenFilesConfig();
    this.loadIgnorePatterns();
    this.generateAllBundles();
  }

  loadIgnorePatterns() {
    const systemPatterns = [
      // Version control
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',

      // Dependencies
      '**/node_modules/**',
      '**/vendor/**',
      '**/.pnp/**',

      // Build outputs
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/target/**',

      // Package files
      '**/*.tgz',
      '**/*.tar.gz',
      '**/*.zip',
      '**/*.rar',
      '**/*.7z',

      // Logs
      '**/*.log',
      '**/logs/**',

      // Cache directories
      '**/.cache/**',
      '**/.parcel-cache/**',
      '**/.nyc_output/**',
      '**/coverage/**',
      '**/.pytest_cache/**',
      '**/__pycache__/**',

      // IDE/Editor files
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.swp',
      '**/*.swo',
      '**/*~',

      // OS files
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/desktop.ini',

      // Environment files
      '**/.env',
      '**/.env.local',
      '**/.env.*.local',

      // Lock files
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/Cargo.lock',

      // cntx-ui specific
      '**/.cntx/**'
    ];

    // Read from .cntxignore file
    let filePatterns = [];
    if (existsSync(this.IGNORE_FILE)) {
      filePatterns = readFileSync(this.IGNORE_FILE, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    }

    // Combine all patterns
    this.ignorePatterns = [
      // System patterns (filtered by disabled list)
      ...systemPatterns.filter(pattern =>
        !this.hiddenFilesConfig.disabledSystemPatterns.includes(pattern)
      ),
      // File patterns
      ...filePatterns.filter(pattern =>
        !systemPatterns.includes(pattern) &&
        !this.hiddenFilesConfig.userIgnorePatterns.includes(pattern)
      ),
      // User-added patterns
      ...this.hiddenFilesConfig.userIgnorePatterns
    ];

    // Update .cntxignore file with current patterns
    const allPatterns = [
      '# System patterns',
      ...systemPatterns.map(pattern =>
        this.hiddenFilesConfig.disabledSystemPatterns.includes(pattern)
          ? `# ${pattern}`
          : pattern
      ),
      '',
      '# User patterns',
      ...this.hiddenFilesConfig.userIgnorePatterns,
      '',
      '# File-specific patterns (edit manually)',
      ...filePatterns.filter(pattern =>
        !systemPatterns.includes(pattern) &&
        !this.hiddenFilesConfig.userIgnorePatterns.includes(pattern)
      )
    ];

    writeFileSync(this.IGNORE_FILE, allPatterns.join('\n'));
  }

  loadBundleStates() {
    if (existsSync(this.BUNDLES_FILE)) {
      try {
        const savedBundles = JSON.parse(readFileSync(this.BUNDLES_FILE, 'utf8'));
        Object.entries(savedBundles).forEach(([name, data]) => {
          if (this.bundles.has(name)) {
            const bundle = this.bundles.get(name);
            bundle.content = data.content || '';
            bundle.lastGenerated = data.lastGenerated;
            bundle.size = data.size || 0;
          }
        });
      } catch (e) {
        if (!this.isQuietMode) console.warn('Could not load bundle states:', e.message);
      }
    }
  }

  saveBundleStates() {
    const bundleStates = {};
    this.bundles.forEach((bundle, name) => {
      bundleStates[name] = {
        content: bundle.content,
        lastGenerated: bundle.lastGenerated,
        size: bundle.size
      };
    });
    writeFileSync(this.BUNDLES_FILE, JSON.stringify(bundleStates, null, 2));
  }





  // Cursor Rules Methods
  loadCursorRules() {
    if (existsSync(this.CURSOR_RULES_FILE)) {
      return readFileSync(this.CURSOR_RULES_FILE, 'utf8');
    }
    return this.getDefaultCursorRules();
  }

  getDefaultCursorRules() {
    // Get project info for context
    let projectInfo = { name: 'unknown', description: '', type: 'general' };
    const pkgPath = join(this.CWD, 'package.json');

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        projectInfo = {
          name: pkg.name || 'unknown',
          description: pkg.description || '',
          type: this.detectProjectType(pkg)
        };
      } catch (e) {
        // Use defaults
      }
    }

    return this.generateCursorRulesTemplate(projectInfo);
  }

  detectProjectType(pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.react || deps['@types/react']) return 'react';
    if (deps.vue || deps['@vue/cli']) return 'vue';
    if (deps.angular || deps['@angular/core']) return 'angular';
    if (deps.express || deps.fastify || deps.koa) return 'node';
    if (deps.next || deps.nuxt || deps.gatsby) return 'fullstack';
    if (deps.typescript || deps['@types/node']) return 'typescript';
    if (pkg.type === 'module' || deps.vite || deps.webpack) return 'modern-js';

    return 'general';
  }

  generateCursorRulesTemplate(projectInfo) {
    const bundlesList = Array.from(this.bundles.keys()).join(', ');

    const templates = {
      react: `# ${projectInfo.name} - React Project Rules

## Project Context
- **Project**: ${projectInfo.name}
- **Type**: React Application
- **Description**: ${projectInfo.description}

## Development Guidelines

### Code Style
- Use TypeScript for all new components
- Prefer functional components with hooks
- Use Tailwind CSS for styling
- Follow React best practices and hooks rules

### File Organization
- Components in \`src/components/\`
- Custom hooks in \`src/hooks/\`
- Utilities in \`src/lib/\`
- Types in \`src/types/\`

### Naming Conventions
- PascalCase for components
- camelCase for functions and variables
- kebab-case for files and folders
- Use descriptive, meaningful names

### Bundle Context
This project uses cntx-ui for file bundling. Current bundles: ${bundlesList}
- **ui**: React components and styles
- **api**: API routes and utilities  
- **config**: Configuration files
- **docs**: Documentation

### AI Assistant Instructions
- When suggesting code changes, consider the current bundle structure
- Prioritize TypeScript and modern React patterns
- Suggest Tailwind classes for styling
- Keep components focused and reusable
- Always include proper TypeScript types
- Consider bundle organization when suggesting file locations

## Custom Rules
Add your specific project rules and preferences below:

### Team Preferences
- [Add team coding standards]
- [Add preferred libraries/frameworks]
- [Add project-specific guidelines]

### Architecture Notes
- [Document key architectural decisions]
- [Note important patterns to follow]
- [List critical dependencies]
`,

      node: `# ${projectInfo.name} - Node.js Project Rules

## Project Context
- **Project**: ${projectInfo.name}
- **Type**: Node.js Backend
- **Description**: ${projectInfo.description}

## Development Guidelines

### Code Style
- Use ES modules (import/export)
- TypeScript preferred for type safety
- Follow Node.js best practices
- Use async/await over promises

### File Organization
- Routes in \`src/routes/\`
- Middleware in \`src/middleware/\`
- Models in \`src/models/\`
- Utilities in \`src/utils/\`

### Bundle Context
This project uses cntx-ui for file bundling. Current bundles: ${bundlesList}
- **api**: Core API logic and routes
- **config**: Environment and configuration
- **docs**: API documentation

### AI Assistant Instructions
- Focus on scalable backend architecture
- Suggest proper error handling
- Consider security best practices
- Optimize for performance and maintainability
- Consider bundle organization when suggesting file locations

## Custom Rules
Add your specific project rules and preferences below:

### Team Preferences
- [Add team coding standards]
- [Add preferred libraries/frameworks]
- [Add project-specific guidelines]

### Architecture Notes
- [Document key architectural decisions]
- [Note important patterns to follow]
- [List critical dependencies]
`,

      general: `# ${projectInfo.name} - Project Rules

## Project Context
- **Project**: ${projectInfo.name}
- **Description**: ${projectInfo.description}

## Development Guidelines

### Code Quality
- Write clean, readable code
- Follow consistent naming conventions
- Add comments for complex logic
- Maintain proper file organization

### Bundle Management
This project uses cntx-ui for intelligent file bundling. Current bundles: ${bundlesList}
- **master**: Complete project overview
- **config**: Configuration and setup files
- **docs**: Documentation and README files

### AI Assistant Instructions
- When helping with code, consider the project structure
- Suggest improvements for maintainability
- Follow established patterns in the codebase
- Help optimize bundle configurations when needed
- Consider bundle organization when suggesting file locations

## Custom Rules
Add your specific project rules and preferences below:

### Team Preferences
- [Add team coding standards]
- [Add preferred libraries/frameworks]
- [Add project-specific guidelines]

### Architecture Notes
- [Document key architectural decisions]
- [Note important patterns to follow]
- [List critical dependencies]
`
    };

    return templates[projectInfo.type] || templates.general;
  }

  saveCursorRules(content) {
    writeFileSync(this.CURSOR_RULES_FILE, content, 'utf8');
  }

  loadClaudeMd() {
    if (existsSync(this.CLAUDE_MD_FILE)) {
      return readFileSync(this.CLAUDE_MD_FILE, 'utf8');
    }
    return this.getDefaultClaudeMd();
  }

  getDefaultClaudeMd() {
    // Get project info for context
    let projectInfo = { name: 'unknown', description: '', type: 'general' };
    const pkgPath = join(this.CWD, 'package.json');

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        projectInfo = {
          name: pkg.name || 'unknown',
          description: pkg.description || '',
          type: this.detectProjectType(pkg)
        };
      } catch (e) {
        // Use defaults if package.json is invalid
      }
    }

    return this.generateClaudeMdTemplate(projectInfo);
  }

  generateClaudeMdTemplate(projectInfo) {
    const { name, description, type } = projectInfo;

    let template = `# ${name}

${description ? `${description}\n\n` : ''}## Project Structure

This project uses cntx-ui for bundle management and AI context organization.

### Bundles

`;

    // Add bundle information
    this.bundles.forEach((bundle, bundleName) => {
      template += `- **${bundleName}**: ${bundle.files.length} files\n`;
    });

    template += `
### Development Guidelines

- Follow the existing code style and patterns
- Use TypeScript for type safety
- Write meaningful commit messages
- Test changes thoroughly

### Key Files

- \`.cntx/config.json\` - Bundle configuration
- \`.cursorrules\` - AI assistant rules
- \`CLAUDE.md\` - Project context for Claude
`;

    if (type === 'react') {
      template += `
### React Specific

- Use functional components with hooks
- Follow React best practices
- Use TypeScript interfaces for props
`;
    } else if (type === 'node') {
      template += `
### Node.js Specific

- Use ES modules (import/export)
- Follow async/await patterns
- Proper error handling
`;
    }

    return template;
  }

  saveClaudeMd(content) {
    writeFileSync(this.CLAUDE_MD_FILE, content, 'utf8');
  }

  loadHeuristicsConfig() {
    if (existsSync(this.HEURISTICS_CONFIG_FILE)) {
      const content = readFileSync(this.HEURISTICS_CONFIG_FILE, 'utf8');
      try {
        return JSON.parse(content);
      } catch (error) {
        console.warn('Failed to parse heuristics config, using default:', error.message);
        return this.getDefaultHeuristicsConfig();
      }
    }
    return this.getDefaultHeuristicsConfig();
  }

  saveHeuristicsConfig(config) {
    const content = JSON.stringify(config, null, 2);
    writeFileSync(this.HEURISTICS_CONFIG_FILE, content, 'utf8');
  }

  getDefaultHeuristicsConfig() {
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
    };
  }

  loadActivities() {
    const activities = [];
    const activitiesJsonPath = join(this.CNTX_DIR, 'activities', 'activities.json');
    let activitiesMeta = {};

    try {
      if (existsSync(activitiesJsonPath)) {
        const activitiesFile = readFileSync(activitiesJsonPath, 'utf8');
        const activitiesData = JSON.parse(activitiesFile);
        activitiesData.forEach(activity => {
          // Use the directory name as the ID
          const id = activity.references[0].split('/')[3];
          activitiesMeta[id] = { tags: activity.tags || [] };
        });
      }

      if (!existsSync(this.ACTIVITIES_DIR)) {
        return [];
      }

      const activityDirs = readdirSync(this.ACTIVITIES_DIR);
      
      for (const activityDir of activityDirs) {
        const activityPath = join(this.ACTIVITIES_DIR, activityDir);
        const statInfo = statSync(activityPath);
        
        if (statInfo.isDirectory()) {
          const meta = activitiesMeta[activityDir] || { tags: [] };
          const activity = this.loadSingleActivity(activityDir, activityPath, meta.tags);
          if (activity) {
            activities.push(activity);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load activities:', error.message);
    }
    
    return activities;
  }

  loadSingleActivity(activityId, activityPath, tags = []) {
    try {
      const readmePath = join(activityPath, 'README.md');
      const progressPath = join(activityPath, 'progress.md');
      const tasksPath = join(activityPath, 'tasks.md');
      const notesPath = join(activityPath, 'notes.md');
      
      if (!existsSync(readmePath)) {
        return null;
      }

      // Read all file contents
      const readmeContent = readFileSync(readmePath, 'utf8');
      const progressContent = existsSync(progressPath) ? readFileSync(progressPath, 'utf8') : 'No progress file found.';
      const tasksContent = existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8') : 'No tasks file found.';
      const notesContent = existsSync(notesPath) ? readFileSync(notesPath, 'utf8') : 'No notes file found.';
      
      // Parse README.md for activity metadata
      const nameMatch = readmeContent.match(/^# (.+)/m);
      const descMatch = readmeContent.match(/## Description\s*\n(.+)/m) || readmeContent.match(/## Introduction\/Overview\s*\n(.+)/m);
      
      let progress = 0;
      let status = 'pending';
      
      // Parse progress from progress.md
      if (existsSync(progressPath)) {
        const progressMatch = progressContent.match(/\*\*Overall Completion\*\*:\s*(\d+)%/);
        if (progressMatch) {
          progress = parseInt(progressMatch[1]);
        }
        
        // Determine status based on progress
        if (progress === 100) status = 'completed';
        else if (progress > 0) status = 'in_progress';
      }

      return {
        id: activityId,
        name: nameMatch ? nameMatch[1].replace('Activity: ', '') : activityId,
        description: descMatch ? descMatch[1].trim() : 'No description available',
        status,
        priority: 'medium',
        progress,
        updatedAt: statSync(activityPath).mtime.toISOString(),
        tags: tags,
        files: {
          readme: readmeContent,
          progress: progressContent,
          tasks: tasksContent,
          notes: notesContent
        }
      };
    } catch (error) {
      console.warn(`Failed to load activity ${activityId}:`, error.message);
      return null;
    }
  }

  async executeActivity(activityId) {
    // For now, just simulate execution
    // In the future, this would trigger actual agent execution
    console.log(`Executing activity: ${activityId}`);
    
    return {
      success: true,
      message: `Activity ${activityId} execution started`,
      activityId
    };
  }

  async stopActivity(activityId) {
    // For now, just simulate stopping
    // In the future, this would stop actual agent execution
    console.log(`Stopping activity: ${activityId}`);
    
    return {
      success: true,
      message: `Activity ${activityId} execution stopped`,
      activityId
    };
  }

  shouldIgnoreFile(filePath) {
    const relativePath = relative(this.CWD, filePath).replace(/\\\\/g, '/');

    // Hard-coded critical ignores
    if (relativePath.startsWith('node_modules/')) return true;
    if (relativePath.startsWith('.git/')) return true;
    if (relativePath.startsWith('.cntx/')) return true;

    return this.ignorePatterns.some(pattern => this.matchesPattern(relativePath, pattern));
  }

  matchesPattern(path, pattern) {
    if (pattern === '**/*') return true;
    if (pattern === '*') return !path.includes('/');
    if (pattern === path) return true;

    let regexPattern = pattern
      .replace(/\\/g, '/')
      .replace(/\./g, '\\.')
      .replace(/\?/g, '.');

    regexPattern = regexPattern.replace(/\*\*/g, 'DOUBLESTAR');
    regexPattern = regexPattern.replace(/\*/g, '[^/]*');
    regexPattern = regexPattern.replace(/DOUBLESTAR/g, '.*');

    try {
      const regex = new RegExp('^' + regexPattern + '$');
      return regex.test(path);
    } catch (e) {
      if (!this.isQuietMode) console.log(`Regex error for pattern "${pattern}": ${e.message}`);
      return false;
    }
  }

  shouldIgnoreAnything(itemName, fullPath) {
    // DIRECTORY NAME IGNORES (anywhere in the project)
    const badDirectories = [
      'node_modules',
      '.git',
      '.svn',
      '.hg',
      'vendor',
      '__pycache__',
      '.pytest_cache',
      '.venv',
      'venv',
      'env',
      '.env',
      'dist',
      'build',
      'out',
      '.next',
      '.nuxt',
      'coverage',
      '.nyc_output',
      '.cache',
      '.parcel-cache',
      '.vercel',
      '.netlify',
      'tmp',
      'temp',
      '.tmp',
      '.temp',
      'logs',
      '*.egg-info',
      '.cntx'
    ];

    if (badDirectories.includes(itemName)) {
      return true;
    }

    // FILE EXTENSION IGNORES
    const badExtensions = [
      // Logs
      '.log', '.logs',
      // OS files
      '.DS_Store', '.Thumbs.db', 'desktop.ini',
      // Editor files
      '.vscode', '.idea', '*.swp', '*.swo', '*~',
      // Media files (large and useless for AI)
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg',
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv',
      '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
      '.exe', '.dll', '.so', '.dylib', '.app', '.dmg', '.pkg',
      // Cache/temp files
      '.cache', '.tmp', '.temp', '.lock',
      // Compiled files
      '.pyc', '.pyo', '.class', '.o', '.obj', '.a', '.lib'
    ];

    const fileExt = extname(itemName).toLowerCase();
    if (badExtensions.includes(fileExt)) {
      return true;
    }

    // FILE NAME PATTERNS
    const badFilePatterns = [
      /^\..*/, // Hidden files starting with .
      /.*\.lock$/, // Lock files
      /.*\.min\.js$/, // Minified JS
      /.*\.min\.css$/, // Minified CSS
      /.*\.map$/, // Source maps
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      /Thumbs\.db$/,
      /\.DS_Store$/
    ];

    if (badFilePatterns.some(pattern => pattern.test(itemName))) {
      return true;
    }

    // PATH-BASED IGNORES (from your .cntxignore)
    return this.ignorePatterns.some(pattern => this.matchesPattern(fullPath, pattern));
  }

  getAllFiles(dir = this.CWD, files = []) {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const relativePath = relative(this.CWD, fullPath).replace(/\\\\/g, '/');

        // BULLETPROOF IGNORES - check directory/file names directly
        const shouldIgnore = this.shouldIgnoreAnything(item, relativePath);

        if (shouldIgnore) {
          continue; // Don't even log it, just skip
        }

        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          this.getAllFiles(fullPath, files);
        } else {
          files.push(relativePath);
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }

    return files;
  }

  startWatching() {
    const watcher = watch(this.CWD, { recursive: true }, (eventType, filename) => {
      if (filename && !this.isScanning) {
        const fullPath = join(this.CWD, filename);
        if (!this.shouldIgnoreFile(fullPath)) {
          if (!this.isQuietMode) console.log(`File ${eventType}: ${filename}`);
          this.markBundlesChanged(filename.replace(/\\\\/g, '/'));
          this.invalidateSemanticCache(); // Invalidate semantic cache on file changes
          this.broadcastUpdate();
        }
      }
    });
    this.watchers.push(watcher);
  }

  getFileTree() {
    const allFiles = this.getAllFiles();
    const fileData = allFiles.map(file => {
      const fullPath = join(this.CWD, file);
      try {
        const stat = statSync(fullPath);
        return {
          path: file,
          size: stat.size,
          modified: stat.mtime
        };
      } catch (e) {
        return {
          path: file,
          size: 0,
          modified: new Date()
        };
      }
    });
    return fileData;
  }

  markBundlesChanged(filename) {
    this.bundles.forEach((bundle, name) => {
      if (bundle.patterns.some(pattern => this.matchesPattern(filename, pattern))) {
        bundle.changed = true;
      }
    });
  }

  generateAllBundles() {
    this.isScanning = true;
    if (!this.isQuietMode) console.log('Scanning files and generating bundles...');

    this.bundles.forEach((bundle, name) => {
      this.generateBundle(name);
    });

    this.saveBundleStates();
    this.isScanning = false;
    if (!this.isQuietMode) console.log('Bundle generation complete');
  }

  generateBundle(name) {
    const bundle = this.bundles.get(name);
    if (!bundle) return;

    if (!this.isQuietMode) console.log(`Generating bundle: ${name}`);
    const allFiles = this.getAllFiles();

    // Filter files by bundle patterns
    let bundleFiles = allFiles.filter(file =>
      bundle.patterns.some(pattern => this.matchesPattern(file, pattern))
    );

    // Remove hidden files
    bundleFiles = bundleFiles.filter(file => !this.isFileHidden(file, name));

    bundle.files = bundleFiles;
    bundle.content = this.generateBundleXML(name, bundle.files);
    bundle.changed = false;
    bundle.lastGenerated = new Date().toISOString();
    bundle.size = Buffer.byteLength(bundle.content, 'utf8');

    if (!this.isQuietMode) console.log(`Generated bundle '${name}' with ${bundle.files.length} files (${(bundle.size / 1024).toFixed(1)}kb)`);
  }

  generateBundleXML(bundleName, files) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<cntx:bundle xmlns:cntx="https://cntx.dev/schema" name="${bundleName}" generated="${new Date().toISOString()}">
`;

    // Project information
    const pkgPath = join(this.CWD, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        xml += `  <cntx:project>
    <cntx:name>${this.escapeXml(pkg.name || 'unknown')}</cntx:name>
    <cntx:version>${pkg.version || '0.0.0'}</cntx:version>
`;
        if (pkg.description) xml += `    <cntx:description>${this.escapeXml(pkg.description)}</cntx:description>
`;
        xml += `  </cntx:project>
`;
      } catch (e) {
        xml += `  <cntx:project><cntx:error>Could not parse package.json</cntx:error></cntx:project>
`;
      }
    }

    // Bundle overview section
    const filesByType = this.categorizeFiles(files);
    const entryPoints = this.identifyEntryPoints(files);

    xml += `  <cntx:overview>
    <cntx:purpose>${this.escapeXml(this.getBundlePurpose(bundleName))}</cntx:purpose>
    <cntx:file-types>
`;

    Object.entries(filesByType).forEach(([type, typeFiles]) => {
      xml += `      <cntx:type name="${type}" count="${typeFiles.length}" />
`;
    });

    xml += `    </cntx:file-types>
`;

    if (entryPoints.length > 0) {
      xml += `    <cntx:entry-points>
`;
      entryPoints.forEach(file => {
        xml += `      <cntx:file>${file}</cntx:file>
`;
      });
      xml += `    </cntx:entry-points>
`;
    }

    xml += `  </cntx:overview>
`;

    // Files organized by type
    xml += `  <cntx:files count="${files.length}">
`;

    // Entry points first
    if (entryPoints.length > 0) {
      xml += `    <cntx:group type="entry-points" description="Main entry files for this bundle">
`;
      entryPoints.forEach(file => {
        xml += this.generateFileXML(file);
      });
      xml += `    </cntx:group>
`;
    }

    // Then organize by file type
    Object.entries(filesByType).forEach(([type, typeFiles]) => {
      if (type === 'entry-points') return; // Already handled above

      const remainingFiles = typeFiles.filter(file => !entryPoints.includes(file));
      if (remainingFiles.length > 0) {
        xml += `    <cntx:group type="${type}" description="${this.getTypeDescription(type)}">
`;
        remainingFiles.forEach(file => {
          xml += this.generateFileXML(file);
        });
        xml += `    </cntx:group>
`;
      }
    });

    xml += `  </cntx:files>
</cntx:bundle>`;
    return xml;
  }

  categorizeFiles(files) {
    const categories = {
      'components': [],
      'hooks': [],
      'utilities': [],
      'configuration': [],
      'styles': [],
      'types': [],
      'tests': [],
      'documentation': [],
      'other': []
    };

    files.forEach(file => {
      const ext = extname(file).toLowerCase();
      const basename = file.toLowerCase();

      if (basename.includes('component') || file.includes('/components/') ||
        ext === '.jsx' || ext === '.tsx' && !basename.includes('test')) {
        categories.components.push(file);
      } else if (basename.includes('hook') || file.includes('/hooks/')) {
        categories.hooks.push(file);
      } else if (basename.includes('util') || file.includes('/utils/') ||
        basename.includes('helper') || file.includes('/lib/')) {
        categories.utilities.push(file);
      } else if (ext === '.json' || basename.includes('config') ||
        ext === '.yaml' || ext === '.yml' || ext === '.toml') {
        categories.configuration.push(file);
      } else if (ext === '.css' || ext === '.scss' || ext === '.less') {
        categories.styles.push(file);
      } else if (basename.includes('type') || ext === '.d.ts' ||
        file.includes('/types/')) {
        categories.types.push(file);
      } else if (basename.includes('test') || basename.includes('spec') ||
        file.includes('/test/') || file.includes('/__tests__/')) {
        categories.tests.push(file);
      } else if (ext === '.md' || basename.includes('readme') ||
        basename.includes('doc')) {
        categories.documentation.push(file);
      } else {
        categories.other.push(file);
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  identifyEntryPoints(files) {
    const entryPoints = [];

    files.forEach(file => {
      const basename = file.toLowerCase();

      // Common entry point patterns
      if (basename.includes('main.') || basename.includes('index.') ||
        basename.includes('app.') || basename === 'server.js' ||
        file.endsWith('/App.tsx') || file.endsWith('/App.jsx') ||
        file.endsWith('/main.tsx') || file.endsWith('/main.js') ||
        file.endsWith('/index.tsx') || file.endsWith('/index.js')) {
        entryPoints.push(file);
      }
    });

    return entryPoints;
  }

  getBundlePurpose(bundleName) {
    const purposes = {
      'master': 'Complete project overview with all source files',
      'frontend': 'User interface components, pages, and client-side logic',
      'backend': 'Server-side logic, APIs, and backend services',
      'api': 'API endpoints, routes, and server communication logic',
      'server': 'Main server application and core backend functionality',
      'components': 'Reusable UI components and interface elements',
      'ui-components': 'User interface components and design system elements',
      'config': 'Configuration files, settings, and environment setup',
      'docs': 'Documentation, README files, and project guides',
      'utils': 'Utility functions, helpers, and shared libraries',
      'types': 'TypeScript type definitions and interfaces',
      'tests': 'Test files, test utilities, and testing configuration'
    };

    return purposes[bundleName] || `Bundle containing ${bundleName}-related files`;
  }

  getTypeDescription(type) {
    const descriptions = {
      'components': 'React/UI components and interface elements',
      'hooks': 'Custom React hooks and state management',
      'utilities': 'Helper functions, utilities, and shared libraries',
      'configuration': 'Configuration files, settings, and build configs',
      'styles': 'CSS, SCSS, and styling files',
      'types': 'TypeScript type definitions and interfaces',
      'tests': 'Test files and testing utilities',
      'documentation': 'README files, docs, and guides',
      'other': 'Additional project files'
    };

    return descriptions[type] || `Files categorized as ${type}`;
  }

  generateFileXML(file) {
    const fullPath = join(this.CWD, file);
    let fileXml = `      <cntx:file path="${file}" ext="${extname(file)}">
`;

    try {
      const stat = statSync(fullPath);
      const content = readFileSync(fullPath, 'utf8');

      // Add role indicator for certain files
      const role = this.getFileRole(file);
      const roleAttr = role ? ` role="${role}"` : '';

      fileXml = `      <cntx:file path="${file}" ext="${extname(file)}"${roleAttr}>
`;
      fileXml += `        <cntx:meta size="${stat.size}" modified="${stat.mtime.toISOString()}" lines="${content.split('\n').length}" />
        <cntx:content><![CDATA[${content}]]></cntx:content>
`;
    } catch (e) {
      fileXml += `        <cntx:error>Could not read file: ${e.message}</cntx:error>
`;
    }

    fileXml += `      </cntx:file>
`;
    return fileXml;
  }

  getFileRole(file) {
    const basename = file.toLowerCase();

    if (basename.includes('main.') || basename.includes('index.')) return 'entry-point';
    if (basename.includes('app.')) return 'main-component';
    if (file === 'server.js') return 'server-entry';
    if (basename.includes('config')) return 'configuration';
    if (basename.includes('package.json')) return 'package-config';
    if (basename.includes('readme')) return 'documentation';

    return null;
  }

  escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  getFileStats(filePath) {
    try {
      const fullPath = join(this.CWD, filePath);
      const stat = statSync(fullPath);
      return {
        size: stat.size,
        mtime: stat.mtime
      };
    } catch (e) {
      return {
        size: 0,
        mtime: new Date()
      };
    }
  }

  getFileListWithVisibility(bundleName = null) {
    const allFiles = this.getAllFiles();

    return allFiles.map(filePath => {
      const fileStats = this.getFileStats(filePath);
      const isGloballyHidden = this.hiddenFilesConfig.globalHidden.includes(filePath);
      const bundleHidden = bundleName ? this.isFileHidden(filePath, bundleName) : false;

      // Determine which bundles this file appears in
      const inBundles = [];
      this.bundles.forEach((bundle, name) => {
        const matchesPattern = bundle.patterns.some(pattern => this.matchesPattern(filePath, pattern));
        const notHidden = !this.isFileHidden(filePath, name);
        if (matchesPattern && notHidden) {
          inBundles.push(name);
        }
      });

      return {
        path: filePath,
        size: fileStats.size,
        modified: fileStats.mtime,
        visible: !isGloballyHidden && !bundleHidden,
        globallyHidden: isGloballyHidden,
        bundleHidden: bundleHidden,
        inBundles: inBundles,
        matchesIgnorePattern: this.shouldIgnoreFile(join(this.CWD, filePath))
      };
    });
  }

  startServer(port = 3333) {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      // CORS headers for ALL requests - MUST be first
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Serve static files for web interface
      if (url.pathname === '/' || url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.ico')) {
        const webDistPath = path.join(__dirname, 'web', 'dist');

        if (url.pathname === '/') {
          // Serve index.html for root
          const indexPath = path.join(webDistPath, 'index.html');
          if (existsSync(indexPath)) {
            try {
              const content = readFileSync(indexPath, 'utf8');
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content);
              return;
            } catch (e) {
              if (!this.isQuietMode) console.error('Error serving index.html:', e);
            }
          }

          // Fallback if no web interface built
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>cntx-ui Server</title>
              <style>
                body { font-family: system-ui, sans-serif; margin: 40px; }
                .container { max-width: 600px; }
                .api-link { background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0; }
                code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🚀 cntx-ui Server Running</h1>
                <p>Your cntx-ui server is running successfully!</p>
                
                <h2>Available APIs:</h2>
                <div class="api-link">
                  <strong>Bundles:</strong> <a href="/api/bundles">/api/bundles</a>
                </div>
                <div class="api-link">
                  <strong>Configuration:</strong> <a href="/api/config">/api/config</a>
                </div>
                <div class="api-link">
                  <strong>Files:</strong> <a href="/api/files">/api/files</a>
                </div>
                <div class="api-link">
                  <strong>Status:</strong> <a href="/api/status">/api/status</a>
                </div>
                
                <h2>Web Interface:</h2>
                <p>The web interface is not available because it wasn't built when this package was published.</p>
                <p>To enable the web interface, the package maintainer needs to run:</p>
                <pre><code>cd web && npm install && npm run build</code></pre>
                
                <h2>CLI Usage:</h2>
                <p>You can still use all CLI commands:</p>
                <ul>
                  <li><code>cntx-ui status</code> - Check current status</li>
                  <li><code>cntx-ui bundle master</code> - Generate specific bundle</li>
                  <li><code>cntx-ui init</code> - Initialize configuration</li>
                </ul>
              </div>
            </body>
          </html>
        `);
          return;
        } else {
          // Serve other static assets
          const filePath = path.join(webDistPath, url.pathname);
          if (existsSync(filePath)) {
            try {
              const content = readFileSync(filePath);
              const contentType = getContentType(filePath);
              res.writeHead(200, { 'Content-Type': contentType });
              res.end(content);
              return;
            } catch (e) {
              if (!this.isQuietMode) console.error('Error serving static file:', e);
            }
          }
        }
      }

      // API Routes
      console.log('🔍 Processing API request:', url.pathname);

      if (url.pathname === '/api/bundles') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const bundleData = Array.from(this.bundles.entries()).map(([name, bundle]) => ({
          name,
          changed: bundle.changed,
          fileCount: bundle.files.length,
          content: bundle.content.substring(0, 5000) + (bundle.content.length > 5000 ? '...' : ''),
          files: bundle.files,
          lastGenerated: bundle.lastGenerated,
          size: bundle.size
        }));
        res.end(JSON.stringify(bundleData));

      } else if (url.pathname === '/api/semantic-chunks') {
        console.log('🔍 Semantic chunks route matched! URL:', url.pathname);
        try {
          // Check if force refresh is requested
          const forceRefresh = url.searchParams.get('refresh') === 'true';

          const analysis = forceRefresh
            ? await this.refreshSemanticAnalysis()
            : await this.getSemanticAnalysis();

          console.log('✅ Semantic analysis successful');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            chunks: analysis.chunks || [],
            lastSemanticAnalysis: this.lastSemanticAnalysis
          }));
        } catch (error) {
          console.error('❌ Semantic analysis failed:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }

      } else if (url.pathname === '/api/semantic-chunks/export') {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { chunkName } = JSON.parse(body);
              const xmlContent = await this.exportSemanticChunk(chunkName);
              res.writeHead(200, { 'Content-Type': 'application/xml' });
              res.end(xmlContent);
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/bundles-from-chunk') {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { chunkName, files } = JSON.parse(body);
              await this.createBundleFromChunk(chunkName, files);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname.startsWith('/api/bundles/')) {
        const bundleName = url.pathname.split('/').pop();
        const bundle = this.bundles.get(bundleName);
        if (bundle) {
          res.writeHead(200, { 'Content-Type': 'application/xml' });
          res.end(bundle.content);
        } else {
          res.writeHead(404);
          res.end('Bundle not found');
        }

      } else if (url.pathname.startsWith('/api/regenerate/')) {
        const bundleName = url.pathname.split('/').pop();
        if (this.bundles.has(bundleName)) {
          this.generateBundle(bundleName);
          this.saveBundleStates();
          this.broadcastUpdate();
          res.writeHead(200);
          res.end('OK');
        } else {
          res.writeHead(404);
          res.end('Bundle not found');
        }

      } else if (url.pathname === '/api/files') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const fileTree = this.getFileTree();
        res.end(JSON.stringify(fileTree));

      } else if (url.pathname === '/api/config') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (existsSync(this.CONFIG_FILE)) {
            const config = readFileSync(this.CONFIG_FILE, 'utf8');
            res.end(config);
          } else {
            const defaultConfig = {
              bundles: {
                master: ['**/*'],
                api: ['src/api.js'],
                ui: ['src/component.jsx', 'src/*.jsx'],
                config: ['package.json', 'package-lock.json', '*.config.*'],
                docs: ['README.md', '*.md']
              }
            };
            res.end(JSON.stringify(defaultConfig));
          }
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              if (!this.isQuietMode) console.log('🔍 Received config save request');
              const config = JSON.parse(body);
              if (!this.isQuietMode) console.log('📝 Config to save:', JSON.stringify(config, null, 2));

              // Ensure .cntx directory exists
              if (!existsSync(this.CNTX_DIR)) {
                if (!this.isQuietMode) console.log('📁 Creating .cntx directory...');
                mkdirSync(this.CNTX_DIR, { recursive: true });
              }

              // Write config file
              if (!this.isQuietMode) console.log('💾 Writing config to:', this.CONFIG_FILE);
              writeFileSync(this.CONFIG_FILE, JSON.stringify(config, null, 2));
              if (!this.isQuietMode) console.log('✅ Config file written successfully');

              // Reload configuration
              this.loadConfig();
              this.generateAllBundles();
              this.broadcastUpdate();

              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('OK');
              if (!this.isQuietMode) console.log('✅ Config save response sent');

            } catch (e) {
              if (!this.isQuietMode) console.error('❌ Config save error:', e);
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end(`Error: ${e.message}`);
            }
          });

          req.on('error', (err) => {
            if (!this.isQuietMode) console.error('❌ Request error:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Internal Server Error');
            }
          });
        }

      } else if (url.pathname === '/api/cursor-rules') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          const rules = this.loadCursorRules();
          res.end(rules);
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { content } = JSON.parse(body);
              this.saveCursorRules(content);
              res.writeHead(200);
              res.end('OK');
            } catch (e) {
              res.writeHead(400);
              res.end('Invalid request');
            }
          });
        }

      } else if (url.pathname === '/api/cursor-rules/templates') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const templates = {
          react: this.generateCursorRulesTemplate({ name: 'My React App', description: 'React application', type: 'react' }),
          node: this.generateCursorRulesTemplate({ name: 'My Node App', description: 'Node.js backend', type: 'node' }),
          general: this.generateCursorRulesTemplate({ name: 'My Project', description: 'General project', type: 'general' })
        };
        res.end(JSON.stringify(templates));

      } else if (url.pathname === '/api/claude-md') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          const claudeMd = this.loadClaudeMd();
          res.end(claudeMd);
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { content } = JSON.parse(body);
              this.saveClaudeMd(content);
              res.writeHead(200);
              res.end('OK');
            } catch (e) {
              res.writeHead(400);
              res.end('Invalid request');
            }
          });
        }

      } else if (url.pathname === '/api/heuristics/config') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const heuristicsConfig = this.loadHeuristicsConfig();
          res.end(JSON.stringify(heuristicsConfig));
        } else if (req.method === 'PUT') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const newConfig = JSON.parse(body);
              this.saveHeuristicsConfig(newConfig);
              res.writeHead(200);
              res.end('OK');
            } catch (e) {
              res.writeHead(400);
              res.end('Invalid request');
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/test-pattern') {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { pattern } = JSON.parse(body);
              const allFiles = this.getAllFiles();
              const matchingFiles = allFiles.filter(file =>
                this.matchesPattern(file, pattern)
              );

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(matchingFiles));
            } catch (e) {
              res.writeHead(400);
              res.end('Invalid request');
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/hidden-files') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const stats = {
            totalFiles: this.getAllFiles().length,
            globallyHidden: this.hiddenFilesConfig.globalHidden.length,
            bundleSpecificHidden: this.hiddenFilesConfig.bundleSpecific,
            ignorePatterns: {
              system: [
                { pattern: '**/.git/**', active: !this.hiddenFilesConfig.disabledSystemPatterns.includes('**/.git/**') },
                { pattern: '**/node_modules/**', active: !this.hiddenFilesConfig.disabledSystemPatterns.includes('**/node_modules/**') },
                { pattern: '**/.cntx/**', active: !this.hiddenFilesConfig.disabledSystemPatterns.includes('**/.cntx/**') }
              ],
              user: this.hiddenFilesConfig.userIgnorePatterns,
              disabled: this.hiddenFilesConfig.disabledSystemPatterns
            }
          };
          res.end(JSON.stringify(stats));
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { action, filePath, filePaths, bundleName, forceHide } = JSON.parse(body);

              if (action === 'toggle' && filePath) {
                this.toggleFileVisibility(filePath, bundleName, forceHide);
              } else if (action === 'bulk-toggle' && filePaths) {
                this.bulkToggleFileVisibility(filePaths, bundleName, forceHide);
              }

              this.generateAllBundles();
              this.broadcastUpdate();

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        }

      } else if (url.pathname === '/api/files-with-visibility') {
        const bundleName = url.searchParams.get('bundle');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const files = this.getFileListWithVisibility(bundleName);
        res.end(JSON.stringify(files));

      } else if (url.pathname === '/api/ignore-patterns') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });

          // Read file patterns
          let filePatterns = [];
          if (existsSync(this.IGNORE_FILE)) {
            filePatterns = readFileSync(this.IGNORE_FILE, 'utf8')
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('#'));
          }

          const systemPatterns = ['**/.git/**', '**/node_modules/**', '**/.cntx/**'];

          const patterns = {
            system: systemPatterns.map(pattern => ({
              pattern,
              active: !this.hiddenFilesConfig.disabledSystemPatterns.includes(pattern)
            })),
            user: this.hiddenFilesConfig.userIgnorePatterns.map(pattern => ({ pattern, active: true })),
            file: filePatterns.filter(pattern =>
              !systemPatterns.includes(pattern) &&
              !this.hiddenFilesConfig.userIgnorePatterns.includes(pattern)
            ).map(pattern => ({ pattern, active: true }))
          };
          res.end(JSON.stringify(patterns));

        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { action, pattern } = JSON.parse(body);
              let success = false;

              switch (action) {
                case 'add':
                  success = this.addUserIgnorePattern(pattern);
                  break;
                case 'remove':
                  success = this.removeUserIgnorePattern(pattern);
                  break;
                case 'toggle-system':
                  this.toggleSystemIgnorePattern(pattern);
                  success = true;
                  break;
              }

              this.broadcastUpdate();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success }));
            } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        }

      } else if (url.pathname === '/api/bundle-visibility-stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const stats = {};

        this.bundles.forEach((bundle, bundleName) => {
          const allFiles = this.getAllFiles();
          const matchingFiles = allFiles.filter(file =>
            bundle.patterns.some(pattern => this.matchesPattern(file, pattern))
          );

          const visibleFiles = matchingFiles.filter(file => !this.isFileHidden(file, bundleName));
          const hiddenFiles = matchingFiles.length - visibleFiles.length;

          stats[bundleName] = {
            total: matchingFiles.length,
            visible: visibleFiles.length,
            hidden: hiddenFiles,
            patterns: bundle.patterns
          };
        });

        res.end(JSON.stringify(stats));

      } else if (url.pathname.startsWith('/api/bundle-categories/')) {
        const bundleName = url.pathname.split('/').pop();
        const bundle = this.bundles.get(bundleName);

        if (bundle) {
          const filesByType = this.categorizeFiles(bundle.files);
          const entryPoints = this.identifyEntryPoints(bundle.files);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            purpose: this.getBundlePurpose(bundleName),
            filesByType,
            entryPoints,
            totalFiles: bundle.files.length
          }));
        } else {
          res.writeHead(404);
          res.end('Bundle not found');
        }

      } else if (url.pathname === '/api/reset-hidden-files') {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { scope, bundleName } = JSON.parse(body);

              if (scope === 'global') {
                this.hiddenFilesConfig.globalHidden = [];
              } else if (scope === 'bundle' && bundleName) {
                delete this.hiddenFilesConfig.bundleSpecific[bundleName];
              } else if (scope === 'all') {
                this.hiddenFilesConfig.globalHidden = [];
                this.hiddenFilesConfig.bundleSpecific = {};
              }

              this.saveHiddenFilesConfig();
              this.generateAllBundles();
              this.broadcastUpdate();

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        }

      } else if (url.pathname === '/api/mcp-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });

        // Simple check - MCP is available if we can find package.json
        let isAccessible = true;
        let testResult = 'available';

        // Check if package.json exists using existing imports
        try {
          const packagePath = join(this.CWD, 'package.json');
          if (existsSync(packagePath)) {
            testResult = 'local_package_found';
          } else {
            testResult = 'using_global_npx';
          }
        } catch (error) {
          testResult = 'check_failed';
        }

        const mcpStatus = {
          running: isAccessible,
          accessible: isAccessible,
          testResult: testResult,
          command: 'npx cntx-ui mcp',
          workingDirectory: this.CWD,
          lastChecked: new Date().toISOString(),
          trackingEnabled: this.mcpServerStarted || false
        };
        res.end(JSON.stringify(mcpStatus, null, 2));

      } else if (url.pathname === '/api/cntxignore') {
        if (req.method === 'GET') {
          const ignorePath = join(this.CWD, '.cntxignore');
          try {
            if (existsSync(ignorePath)) {
              const content = readFileSync(ignorePath, 'utf8');
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(content);
            } else {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('# Add ignore patterns, one per line\nnode_modules/**\n*.log\n.git/**\ndist/**\nbuild/**');
            }
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read .cntxignore file' }));
          }
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const ignorePath = join(this.CWD, '.cntxignore');
              writeFileSync(ignorePath, body);
              this.loadIgnorePatterns();
              this.generateAllBundles();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, file: '.cntxignore' }));
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to write .cntxignore file' }));
            }
          });
        }

      } else if (url.pathname === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const statusInfo = {
          server: {
            version: '2.0.8',
            workingDirectory: this.CWD,
            startTime: new Date().toISOString(),
            isScanning: this.isScanning
          },
          bundles: {
            count: this.bundles.size,
            names: Array.from(this.bundles.keys()),
            totalFiles: Array.from(this.bundles.values()).reduce((sum, bundle) => sum + bundle.files.length, 0)
          },
          mcp: {
            available: true,
            serverStarted: this.mcpServerStarted,
            command: 'npx cntx-ui mcp',
            setupScript: './examples/claude-mcp-setup.sh'
          },
          files: {
            total: this.getAllFiles().length,
            hiddenGlobally: this.hiddenFilesConfig.globalHidden.length,
            ignorePatterns: this.ignorePatterns.length
          }
        };
        res.end(JSON.stringify(statusInfo, null, 2));

      } else if (url.pathname === '/api/vector-db/status') {
        // GET endpoint to get vector database status and stats
        if (req.method === 'GET') {
          try {
            if (!this.vectorStoreInitialized) {
              await this.vectorStore.initialize();
              this.vectorStoreInitialized = true;
            }

            // Check if we have semantic chunks and populate vector store if needed
            const semanticAnalysis = await this.getSemanticAnalysis();
            if (semanticAnalysis && semanticAnalysis.chunks) {
              const chunksWithEmbeddings = semanticAnalysis.chunks.filter(chunk => chunk.embedding);
              if (chunksWithEmbeddings.length > 0) {
                console.log(`🔍 Populating vector store with ${chunksWithEmbeddings.length} cached chunks`);
                await this.vectorStore.storePrecomputedChunks(chunksWithEmbeddings);
              }
            }

            const stats = await this.vectorStore.getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              initialized: this.vectorStoreInitialized,
              stats: stats
            }));
          } catch (error) {
            console.error('❌ Vector DB status error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/vector-db/rebuild') {
        // POST endpoint to rebuild vector database from semantic chunks
        if (req.method === 'POST') {
          try {
            console.log('🔧 Rebuilding vector database...');

            // Initialize vector store if needed
            if (!this.vectorStoreInitialized) {
              await this.vectorStore.initialize();
              this.vectorStoreInitialized = true;
            }

            // Clear existing vectors
            await this.vectorStore.clear();

            // Get semantic chunks
            const analysis = await this.getSemanticAnalysis();
            const chunks = analysis.chunks || [];

            if (chunks.length === 0) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                message: 'No semantic chunks found to store',
                chunksProcessed: 0
              }));
              return;
            }

            // Store chunks in vector database
            await this.vectorStore.storeChunks(chunks);

            const stats = await this.vectorStore.getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              message: 'Vector database rebuilt successfully',
              chunksProcessed: chunks.length,
              stats: stats
            }));

          } catch (error) {
            console.error('❌ Vector DB rebuild error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/vector-db/search') {
        // POST endpoint to search vector database
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { query, limit = 10, minSimilarity = 0.5 } = JSON.parse(body);

              if (!query) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Query is required' }));
                return;
              }

              // Initialize vector store if needed
              if (!this.vectorStoreInitialized) {
                await this.vectorStore.initialize();
                this.vectorStoreInitialized = true;
              }

              // Search for similar chunks
              const results = await this.vectorStore.findSimilar(query, {
                limit: parseInt(limit),
                minSimilarity: parseFloat(minSimilarity)
              });

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                query: query,
                results: results,
                totalFound: results.length
              }));

            } catch (error) {
              console.error('❌ Vector DB search error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/vector-db/search-by-type') {
        // POST endpoint to search by semantic type
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { semanticType, limit = 10 } = JSON.parse(body);

              if (!semanticType) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Semantic type is required' }));
                return;
              }

              // Initialize vector store if needed
              if (!this.vectorStoreInitialized) {
                await this.vectorStore.initialize();
                this.vectorStoreInitialized = true;
              }

              // Search by type
              const results = await this.vectorStore.findByType(semanticType, parseInt(limit));

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                semanticType: semanticType,
                results: results,
                totalFound: results.length
              }));

            } catch (error) {
              console.error('❌ Vector DB search by type error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/vector-db/search-by-domain') {
        // POST endpoint to search by business domain
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { domain, limit = 10 } = JSON.parse(body);

              if (!domain) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Domain is required' }));
                return;
              }

              // Initialize vector store if needed
              if (!this.vectorStoreInitialized) {
                await this.vectorStore.initialize();
                this.vectorStoreInitialized = true;
              }

              // Search by domain
              const results = await this.vectorStore.findByDomain(domain, parseInt(limit));

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                domain: domain,
                results: results,
                totalFound: results.length
              }));

            } catch (error) {
              console.error('❌ Vector DB search by domain error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname === '/api/activities') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const activities = this.loadActivities();
          res.end(JSON.stringify(activities));
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname.startsWith('/api/activities/') && url.pathname.endsWith('/execute')) {
        if (req.method === 'POST') {
          const activityId = url.pathname.split('/')[3];
          try {
            const result = await this.executeActivity(activityId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else if (url.pathname.startsWith('/api/activities/') && url.pathname.endsWith('/stop')) {
        if (req.method === 'POST') {
          const activityId = url.pathname.split('/')[3];
          try {
            const result = await this.stopActivity(activityId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }

      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      this.sendUpdate(ws);
    });

    server.listen(port, () => {
      if (!this.isQuietMode) {
        console.log(`🚀 cntx-ui API running at http://localhost:${port}`);
        console.log(`📁 Watching: ${this.CWD}`);
        console.log(`📦 Bundles: ${Array.from(this.bundles.keys()).join(', ')}`);
      }
    });

    return server;
  }

  broadcastUpdate() {
    this.clients.forEach(client => this.sendUpdate(client));
  }

  sendUpdate(client) {
    if (client.readyState === 1) {
      const bundleData = Array.from(this.bundles.entries()).map(([name, bundle]) => ({
        name,
        changed: bundle.changed,
        fileCount: bundle.files.length,
        content: bundle.content.substring(0, 2000) + (bundle.content.length > 2000 ? '...' : ''),
        files: bundle.files,
        lastGenerated: bundle.lastGenerated,
        size: bundle.size
      }));
      client.send(JSON.stringify(bundleData));
    }
  }

  cleanup() {
    this.watchers.forEach(watcher => watcher.close());
    this.saveBundleStates();
  }

  // Semantic Chunking Methods
  async getSemanticAnalysis() {
    // First, try to load from cache
    if (!this.semanticCache) {
      const cachedAnalysis = await this.loadSemanticCache();
      if (cachedAnalysis) {
        // loadSemanticCache already sets this.semanticCache and this.lastSemanticAnalysis
        return cachedAnalysis;
      }
    }

    // Check if we need to refresh the semantic analysis
    const shouldRefresh = !this.semanticCache || !this.lastSemanticAnalysis;

    console.log('🔍 Cache check - shouldRefresh:', shouldRefresh, 'lastAnalysis:', this.lastSemanticAnalysis, 'now:', Date.now());

    if (shouldRefresh) {
      try {
        // Auto-discover JavaScript/TypeScript files in the entire project
        const patterns = ['**/*.{js,jsx,ts,tsx,mjs}'];

        // Load bundle configuration for chunk grouping
        let bundleConfig = null;
        if (existsSync(this.CONFIG_FILE)) {
          bundleConfig = JSON.parse(readFileSync(this.CONFIG_FILE, 'utf8'));
        }

        this.semanticCache = await this.semanticSplitter.extractSemanticChunks(this.CWD, patterns, bundleConfig);
        this.lastSemanticAnalysis = Date.now();

        // Only enhance chunks with embeddings if they don't already have them
        await this.enhanceSemanticChunksIfNeeded(this.semanticCache);

        // Save to disk cache
        await this.saveSemanticCache(this.semanticCache);

        // Debug logging
        console.log('🔍 Semantic analysis complete. Sample chunk keys:',
          this.semanticCache.chunks.length > 0 ? Object.keys(this.semanticCache.chunks[0]) : 'No chunks');
        if (this.semanticCache.chunks.length > 0) {
          console.log('🔍 Sample chunk businessDomains:', this.semanticCache.chunks[0].businessDomains);
          console.log('🔍 Sample chunk has embedding:', !!this.semanticCache.chunks[0].embedding);
        }
      } catch (error) {
        console.error('Semantic analysis failed:', error.message);
        throw new Error(`Semantic analysis failed: ${error.message}`);
      }
    }

    return this.semanticCache;
  }

  async saveSemanticCache(analysis) {
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

  async loadSemanticCache() {
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

      console.log(`✅ Loaded semantic cache from disk (${cacheData.analysis.chunks.length} chunks with embeddings)`);
      
      // Set the lastSemanticAnalysis from the cache timestamp
      this.semanticCache = cacheData.analysis;
      this.lastSemanticAnalysis = cacheData.timestamp;
      
      return cacheData.analysis;
    } catch (error) {
      console.error('❌ Failed to load semantic cache:', error.message);
      return null;
    }
  }

  async refreshSemanticAnalysis() {
    console.log('🔄 Forcing semantic analysis refresh...');

    // Clear memory cache
    this.semanticCache = null;
    this.lastSemanticAnalysis = null;

    // Remove disk cache file
    try {
      if (existsSync(this.SEMANTIC_CACHE_FILE)) {
        unlinkSync(this.SEMANTIC_CACHE_FILE);
        console.log('🗑️ Cleared semantic cache file');
      }
    } catch (error) {
      console.error('❌ Failed to clear cache file:', error.message);
    }

    return this.getSemanticAnalysis();
  }

  async enhanceSemanticChunksIfNeeded(analysis) {
    if (!analysis || !analysis.chunks || analysis.chunks.length === 0) {
      console.log('🔍 No chunks to enhance');
      return;
    }

    // Check if chunks already have embeddings
    const chunksNeedingEnhancement = analysis.chunks.filter(chunk =>
      !chunk.embedding || !chunk.metadata || !chunk.semanticType
    );

    if (chunksNeedingEnhancement.length === 0) {
      console.log('🔍 All chunks already enhanced, skipping');
      return;
    }

    console.log(`🔍 Enhancing ${chunksNeedingEnhancement.length}/${analysis.chunks.length} chunks that need embeddings...`);

    // Initialize vector store if needed
    if (!this.vectorStoreInitialized) {
      console.log('🔍 Initializing vector store for embeddings...');
      await this.vectorStore.init();
      this.vectorStoreInitialized = true;
    }

    // Process only chunks that need enhancement in batches
    const batchSize = 10;
    for (let i = 0; i < chunksNeedingEnhancement.length; i += batchSize) {
      const batch = chunksNeedingEnhancement.slice(i, i + batchSize);

      await Promise.all(batch.map(async (chunk) => {
        try {
          // Add missing semantic metadata
          this.addSemanticMetadata(chunk);

          // Generate embedding for the chunk if it doesn't have one
          if (!chunk.embedding) {
            const content = this.getChunkContentForEmbedding(chunk);
            chunk.embedding = await this.vectorStore.generateEmbedding(content);
          }

        } catch (error) {
          console.error(`❌ Failed to enhance chunk ${chunk.name}:`, error.message);
          chunk.embedding = null; // Set to null if embedding fails
        }
      }));

      console.log(`🔍 Enhanced batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunksNeedingEnhancement.length / batchSize)}`);
    }

    console.log('✅ Semantic chunk enhancement complete');
  }

  async enhanceSemanticChunks(analysis) {
    if (!analysis || !analysis.chunks || analysis.chunks.length === 0) {
      console.log('🔍 No chunks to enhance');
      return;
    }

    console.log(`🔍 Enhancing ${analysis.chunks.length} chunks with embeddings and metadata...`);

    // Initialize vector store if needed
    if (!this.vectorStoreInitialized) {
      console.log('🔍 Initializing vector store for embeddings...');
      await this.vectorStore.init();
      this.vectorStoreInitialized = true;
    }

    // Process chunks in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < analysis.chunks.length; i += batchSize) {
      const batch = analysis.chunks.slice(i, i + batchSize);

      await Promise.all(batch.map(async (chunk) => {
        try {
          // Add missing semantic metadata
          this.addSemanticMetadata(chunk);

          // Generate embedding for the chunk
          const content = this.getChunkContentForEmbedding(chunk);
          chunk.embedding = await this.vectorStore.generateEmbedding(content);

        } catch (error) {
          console.error(`❌ Failed to enhance chunk ${chunk.name}:`, error.message);
          chunk.embedding = null; // Set to null if embedding fails
        }
      }));

      console.log(`🔍 Enhanced batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(analysis.chunks.length / batchSize)}`);
    }

    console.log('✅ Semantic chunk enhancement complete');
  }

  addSemanticMetadata(chunk) {
    // Add semanticType based on existing chunk data
    chunk.semanticType = this.inferSemanticType(chunk);

    // Add businessDomain based on file path and content
    chunk.businessDomain = this.inferBusinessDomain(chunk);

    // Add technicalPatterns based on code analysis
    chunk.technicalPatterns = this.inferTechnicalPatterns(chunk);

    // Ensure files array exists
    if (!chunk.files) {
      chunk.files = chunk.filePath ? [chunk.filePath] : [];
    }

    // Map existing fields to expected format
    chunk.metadata = {
      content: chunk.code || '',
      semanticType: chunk.semanticType,
      businessDomain: chunk.businessDomain,
      technicalPatterns: chunk.technicalPatterns,
      purpose: chunk.purpose || '',
      files: chunk.files,
      size: chunk.size || 0,
      complexity: chunk.complexity || 0
    };
  }

  inferSemanticType(chunk) {
    const code = chunk.code || '';
    const subtype = chunk.subtype || '';
    const name = chunk.name || '';
    const filePath = chunk.filePath || '';
    const nameLC = name.toLowerCase();
    const codeLC = code.toLowerCase();
    const filePathLC = filePath.toLowerCase();

    // === React UI Patterns ===
    if (
      filePathLC.includes('/components/') ||
      subtype.includes('react_component') ||
      codeLC.includes('jsx') ||
      codeLC.includes('tsx') ||
      codeLC.includes('react') ||
      nameLC.endsWith('component')
    ) {
      // Further specialize
      if (filePathLC.includes('/pages/') || nameLC.includes('page')) return 'page_component';
      if (filePathLC.includes('/layout/') || nameLC.includes('layout')) return 'layout_component';
      if (filePathLC.includes('/modal/') || nameLC.includes('modal')) return 'modal_component';
      if (filePathLC.includes('/form/') || nameLC.includes('form')) return 'form_component';
      return 'ui_component';
    }

    // === React Hooks ===
    if (
      filePathLC.includes('/hooks/') ||
      nameLC.startsWith('use') ||
      codeLC.includes('usestate') ||
      codeLC.includes('useeffect') ||
      codeLC.includes('usecontext') ||
      codeLC.includes('usereducer') ||
      codeLC.includes('usecallback') ||
      codeLC.includes('usememo') ||
      codeLC.includes('useref')
    ) {
      return 'hook';
    }

    // === React Contexts ===
    if (
      filePathLC.includes('/contexts/') ||
      codeLC.includes('createcontext') ||
      codeLC.includes('usecontext')
    ) {
      return 'context';
    }

    // === State Management ===
    if (
      filePathLC.includes('/store/') ||
      filePathLC.includes('/state/') ||
      filePathLC.includes('/reducers/') ||
      codeLC.includes('createreducer') ||
      codeLC.includes('usestore') ||
      codeLC.includes('useatom') ||
      codeLC.includes('recoil') ||
      codeLC.includes('zustand') ||
      codeLC.includes('redux') ||
      codeLC.includes('mobx')
    ) {
      return 'state_management';
    }

    // === API/Service Layer ===
    if (
      filePathLC.includes('/api/') ||
      filePathLC.includes('/services/') ||
      filePathLC.includes('/service/') ||
      codeLC.includes('fetch(') ||
      codeLC.includes('axios') ||
      codeLC.includes('request') ||
      codeLC.includes('graphql') ||
      codeLC.includes('trpc')
    ) {
      return 'api_integration';
    }

    // === Data/Models/Schemas ===
    if (
      filePathLC.includes('/models/') ||
      filePathLC.includes('/schemas/') ||
      filePathLC.includes('/entities/') ||
      nameLC.includes('model') ||
      nameLC.includes('schema') ||
      codeLC.includes('zod.') ||
      codeLC.includes('yup.') ||
      codeLC.includes('joi.')
    ) {
      return 'data_model';
    }

    // === Utility/Helpers/Lib ===
    if (
      filePathLC.includes('/utils/') ||
      filePathLC.includes('/helpers/') ||
      filePathLC.includes('/lib/') ||
      nameLC.includes('util') ||
      nameLC.includes('helper') ||
      nameLC.includes('tool')
    ) {
      return 'utility';
    }

    // === Configuration/Constants/Env ===
    if (
      filePathLC.includes('/config/') ||
      filePathLC.includes('/constants/') ||
      filePathLC.includes('/env/') ||
      filePath.endsWith('.config.js') ||
      filePath.endsWith('.config.ts') ||
      nameLC.includes('config') ||
      nameLC.includes('constant')
    ) {
      return 'configuration';
    }

    // === Styling/Theming ===
    if (
      filePathLC.includes('/styles/') ||
      filePathLC.includes('/theme/') ||
      filePath.endsWith('.css') ||
      filePath.endsWith('.scss') ||
      filePath.endsWith('.less') ||
      filePath.endsWith('.styled.ts') ||
      codeLC.includes('styled(') ||
      codeLC.includes('emotion') ||
      codeLC.includes('tailwind')
    ) {
      return 'styling';
    }

    // === Testing ===
    if (
      filePathLC.includes('/test/') ||
      filePathLC.includes('/__tests__/') ||
      filePath.endsWith('.test.js') ||
      filePath.endsWith('.test.ts') ||
      filePath.endsWith('.spec.js') ||
      filePath.endsWith('.spec.ts') ||
      codeLC.includes('jest') ||
      codeLC.includes('describe(') ||
      codeLC.includes('it(') ||
      codeLC.includes('expect(')
    ) {
      return 'testing';
    }

    // === Documentation ===
    if (
      filePathLC.includes('/docs/') ||
      filePath.endsWith('.md') ||
      filePath.endsWith('.mdx') ||
      nameLC.includes('readme') ||
      code.startsWith('/**') ||
      codeLC.includes('@param') ||
      codeLC.includes('@returns')
    ) {
      return 'documentation';
    }

    // === Error Handling ===
    if (
      filePathLC.includes('/errors/') ||
      nameLC.includes('error') ||
      codeLC.includes('try {') ||
      codeLC.includes('catch') ||
      codeLC.includes('throw') ||
      codeLC.includes('console.error')
    ) {
      return 'error_handling';
    }

    // === Performance/Optimization ===
    if (
      nameLC.includes('cache') ||
      nameLC.includes('memo') ||
      nameLC.includes('lazy') ||
      codeLC.includes('usememo') ||
      codeLC.includes('usecallback') ||
      codeLC.includes('debounce') ||
      codeLC.includes('throttle')
    ) {
      return 'performance';
    }

    // === Security/Auth ===
    if (
      filePathLC.includes('/auth/') ||
      nameLC.includes('auth') ||
      nameLC.includes('token') ||
      nameLC.includes('jwt') ||
      codeLC.includes('authenticate') ||
      codeLC.includes('authorize')
    ) {
      return 'security';
    }

    // === Monitoring/Analytics ===
    if (
      filePathLC.includes('/monitoring/') ||
      filePathLC.includes('/analytics/') ||
      nameLC.includes('monitor') ||
      nameLC.includes('metric') ||
      codeLC.includes('console.log') ||
      codeLC.includes('analytics')
    ) {
      return 'monitoring';
    }

    // === Type Definitions ===
    if (
      filePath.endsWith('.d.ts') ||
      codeLC.includes('interface ') ||
      codeLC.includes('type ')
    ) {
      return 'type_definition';
    }

    // === Business Logic ===
    if (
      filePathLC.includes('/business/') ||
      filePathLC.includes('/domain/') ||
      nameLC.includes('business') ||
      nameLC.includes('workflow') ||
      nameLC.includes('process')
    ) {
      return 'business_logic';
    }

    // === Data Processing/Algorithm ===
    if (
      nameLC.includes('algorithm') ||
      nameLC.includes('calculate') ||
      nameLC.includes('compute') ||
      nameLC.includes('sort') ||
      nameLC.includes('search') ||
      nameLC.includes('filter') ||
      codeLC.includes('for (') ||
      codeLC.includes('while (') ||
      codeLC.includes('recursive') ||
      codeLC.includes('binary') ||
      codeLC.includes('hash') ||
      codeLC.includes('math.')
    ) {
      return 'algorithm';
    }

    // === Fallbacks ===
    if (subtype.includes('function') || chunk.type === 'function_chunk') {
      return 'utility';
    }
    if (subtype.includes('react_component') || codeLC.includes('jsx')) {
      return 'ui_component';
    }

    return 'utility'; // Default fallback
  }

  inferBusinessDomain(chunk) {
    const filePath = chunk.filePath || '';
    const code = chunk.code || '';
    const name = chunk.name || '';

    const domains = [];

    // Authentication & Security
    if (filePath.includes('/auth/') || filePath.includes('/login/') ||
      name.toLowerCase().includes('auth') || name.toLowerCase().includes('login') ||
      code.includes('password') || code.includes('token') || code.includes('jwt')) {
      domains.push('authentication');
    }

    // API & Network
    if (filePath.includes('/api/') || filePath.includes('/server/') ||
      code.includes('fetch(') || code.includes('axios') || code.includes('request') ||
      code.includes('endpoint') || code.includes('POST') || code.includes('GET')) {
      domains.push('api_networking');
    }

    // UI & Components
    if (filePath.includes('/ui/') || filePath.includes('/components/') ||
      chunk.semanticType?.includes('react') || code.includes('className') ||
      code.includes('onClick') || code.includes('onChange')) {
      domains.push('user_interface');
    }

    // Data & State Management
    if (filePath.includes('/store/') || filePath.includes('/redux/') ||
      code.includes('useState') || code.includes('useReducer') ||
      code.includes('dispatch') || code.includes('state')) {
      domains.push('state_management');
    }

    // Database & Persistence
    if (filePath.includes('/db/') || filePath.includes('/database/') ||
      code.includes('SELECT') || code.includes('INSERT') || code.includes('mongoose') ||
      code.includes('prisma') || code.includes('sql')) {
      domains.push('database');
    }

    // Testing & Quality Assurance
    if (filePath.includes('/test/') || filePath.includes('.test.') || filePath.includes('.spec.') ||
      code.includes('expect') || code.includes('jest') || code.includes('describe')) {
      domains.push('testing');
    }

    // Configuration & Settings
    if (filePath.includes('/config/') || name.includes('Config') || name.includes('Settings') ||
      code.includes('process.env') || code.includes('CONFIG')) {
      domains.push('configuration');
    }

    // Business Logic & Domain Specific
    if (filePath.includes('/bundle/') || name.includes('bundle') || name.includes('Bundle')) {
      domains.push('bundle_management');
    }
    if (filePath.includes('/semantic/') || name.includes('semantic') || name.includes('Semantic')) {
      domains.push('semantic_analysis');
    }
    if (filePath.includes('/vector/') || name.includes('vector') || name.includes('Vector')) {
      domains.push('vector_operations');
    }

    // Utilities & Helpers
    if (filePath.includes('/util/') || filePath.includes('/lib/') || filePath.includes('/helper/') ||
      name.toLowerCase().includes('util') || name.toLowerCase().includes('helper')) {
      domains.push('utilities');
    }

    // Error Handling & Logging
    if (code.includes('console.log') || code.includes('logger') || code.includes('error') ||
      code.includes('try {') || code.includes('catch')) {
      domains.push('error_handling');
    }

    return domains.length > 0 ? domains : ['general'];
  }

  inferTechnicalPatterns(chunk) {
    const code = chunk.code || '';
    const patterns = [];

    // React patterns
    if (code.includes('useState') || code.includes('useEffect') || code.includes('useContext')) {
      patterns.push('react_hooks');
    }
    if (code.includes('async ') || code.includes('await ') || code.includes('Promise')) {
      patterns.push('async_operations');
    }
    if (code.includes('try {') || code.includes('catch')) {
      patterns.push('error_handling');
    }
    if (code.includes('fetch(') || code.includes('axios') || code.includes('http')) {
      patterns.push('http_requests');
    }
    if (code.includes('map(') || code.includes('filter(') || code.includes('reduce(')) {
      patterns.push('functional_programming');
    }
    if (code.includes('class ') && code.includes('extends')) {
      patterns.push('object_oriented');
    }
    if (code.includes('interface ') || code.includes('type ') || code.includes(': string') || code.includes(': number')) {
      patterns.push('typescript');
    }

    return patterns;
  }

  getChunkContentForEmbedding(chunk) {
    // Create a comprehensive text representation for embedding
    const parts = [];

    if (chunk.name) parts.push(`Function: ${chunk.name}`);
    if (chunk.purpose) parts.push(`Purpose: ${chunk.purpose}`);
    if (chunk.code) parts.push(`Code: ${chunk.code.substring(0, 1000)}`); // Limit code length
    if (chunk.filePath) parts.push(`File: ${chunk.filePath}`);

    return parts.join('\n');
  }

  async exportSemanticChunk(chunkName) {
    const analysis = await this.getSemanticAnalysis();
    const chunk = analysis.chunks.find(c => c.name === chunkName);

    if (!chunk) {
      throw new Error(`Chunk "${chunkName}" not found`);
    }

    // Generate XML content for the chunk files
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xmlContent += `<codebase_context semantic_chunk="${chunkName}">\n`;
    xmlContent += `  <chunk_info>\n`;
    xmlContent += `    <name>${chunkName}</name>\n`;
    xmlContent += `    <purpose>${chunk.purpose || 'No description'}</purpose>\n`;
    xmlContent += `    <file_count>${chunk.files.length}</file_count>\n`;
    xmlContent += `    <size>${chunk.size} bytes</size>\n`;
    xmlContent += `    <complexity>${chunk.complexity?.level || 'unknown'}</complexity>\n`;
    xmlContent += `    <tags>${(chunk.tags || []).join(', ')}</tags>\n`;
    xmlContent += `  </chunk_info>\n\n`;

    // Add each function in the chunk
    if (chunk.functions) {
      for (const func of chunk.functions) {
        xmlContent += `  <function name="${func.name}" file="${func.filePath}">\n`;
        xmlContent += `    <signature>${func.signature}</signature>\n`;
        xmlContent += `    <type>${func.type}</type>\n`;
        xmlContent += `    <lines>${func.startLine}-${func.endLine}</lines>\n`;

        if (func.context.imports.length > 0) {
          xmlContent += `    <imports>${func.context.imports.join(', ')}</imports>\n`;
        }

        xmlContent += `    <code>\n`;
        xmlContent += func.code
          .split('\n')
          .map((line, i) => `${(func.startLine + i).toString().padStart(3)}  ${line}`)
          .join('\n');
        xmlContent += `\n    </code>\n`;
        xmlContent += `  </function>\n\n`;
      }
    } else {
      // Fallback for file-based chunks
      for (const filePath of chunk.files || []) {
        const fullPath = join(this.CWD, filePath);
        if (existsSync(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            xmlContent += `  <file path="${filePath}">\n`;
            xmlContent += content
              .split('\n')
              .map((line, i) => `${(i + 1).toString().padStart(3)}  ${line}`)
              .join('\n');
            xmlContent += `\n  </file>\n\n`;
          } catch (error) {
            console.warn(`Could not read file ${filePath}:`, error.message);
          }
        }
      }
    }

    xmlContent += `</codebase_context>`;
    return xmlContent;
  }

  async createBundleFromChunk(chunkName, files) {
    // Load current config
    let config = {};
    if (existsSync(this.CONFIG_FILE)) {
      config = JSON.parse(readFileSync(this.CONFIG_FILE, 'utf8'));
    }

    if (!config.bundles) {
      config.bundles = {};
    }

    // Create bundle with the chunk name and files
    const bundleName = chunkName.toLowerCase().replace(/[-\s]+/g, '-');
    config.bundles[bundleName] = files;

    // Save config
    writeFileSync(this.CONFIG_FILE, JSON.stringify(config, null, 2));

    // Reload bundles
    this.loadConfig();
    this.generateAllBundles();
    this.saveBundleStates();
    this.broadcastUpdate();
  }

  invalidateSemanticCache() {
    this.semanticCache = null;
    this.lastSemanticAnalysis = null;
    
    // Remove the cache file entirely
    try {
      if (existsSync(this.SEMANTIC_CACHE_FILE)) {
        unlinkSync(this.SEMANTIC_CACHE_FILE);
        console.log('🗑️ Cleared semantic cache file');
      }
    } catch (error) {
      console.error('❌ Failed to clear cache file:', error.message);
    }
  }
}

export function startServer(options = {}) {
  const server = new CntxServer(options.cwd, { quiet: options.quiet });
  server.init();

  if (options.withMcp) {
    server.mcpServerStarted = true;
    if (!server.isQuietMode) {
      console.log('🔗 MCP server tracking enabled - use /api/status to check MCP configuration');
    }
  }

  return server.startServer(options.port);
}

export function startMCPServer(options = {}) {
  const server = new CntxServer(options.cwd, { quiet: true });
  server.init();
  startMCPTransport(server);
  return server;
}

export function generateBundle(name = 'master', cwd = process.cwd(), options = {}) {
  const server = new CntxServer(cwd, { quiet: options.quiet });
  server.init();
  server.generateBundle(name);
  server.saveBundleStates();
}

export function initConfig(cwd = process.cwd(), options = {}) {
  const isQuiet = options.quiet || false;
  if (!isQuiet) {
    console.log('🚀 Starting initConfig...');
    console.log('📂 Working directory:', cwd);
  }

  const server = new CntxServer(cwd, { quiet: isQuiet });
  if (!isQuiet) {
    console.log('📁 CNTX_DIR:', server.CNTX_DIR);
    console.log('📄 CONFIG_FILE path:', server.CONFIG_FILE);
  }

  const defaultConfig = {
    bundles: {
      master: ['**/*']
    }
  };

  try {
    // Create .cntx directory
    if (!isQuiet) console.log('🔍 Checking if .cntx directory exists...');
    if (!existsSync(server.CNTX_DIR)) {
      if (!isQuiet) console.log('📁 Creating .cntx directory...');
      mkdirSync(server.CNTX_DIR, { recursive: true });
      if (!isQuiet) console.log('✅ .cntx directory created');
    } else {
      if (!isQuiet) console.log('✅ .cntx directory already exists');
    }

    // List directory contents before writing config
    if (!isQuiet) {
      console.log('📋 Directory contents before writing config:');
      const beforeFiles = readdirSync(server.CNTX_DIR);
      console.log('Files:', beforeFiles);
    }

    // Write config.json
    if (!isQuiet) {
      console.log('📝 Writing config.json...');
      console.log('📄 Config content:', JSON.stringify(defaultConfig, null, 2));
      console.log('📍 Writing to path:', server.CONFIG_FILE);
    }

    writeFileSync(server.CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    if (!isQuiet) console.log('✅ writeFileSync completed');

    // Verify file was created
    if (!isQuiet) {
      console.log('🔍 Checking if config.json exists...');
      const configExists = existsSync(server.CONFIG_FILE);
      console.log('Config exists?', configExists);

      if (configExists) {
        const configContent = readFileSync(server.CONFIG_FILE, 'utf8');
        console.log('✅ Config file created successfully');
        console.log('📖 Config content:', configContent);
      } else {
        console.log('❌ Config file was NOT created');
      }

      // List directory contents after writing config
      console.log('📋 Directory contents after writing config:');
      const afterFiles = readdirSync(server.CNTX_DIR);
      console.log('Files:', afterFiles);
    }

  } catch (error) {
    if (!isQuiet) {
      console.error('❌ Error in initConfig:', error);
      console.error('Stack trace:', error.stack);
    }
    throw error;
  }

  // Create cursor rules if they don't exist
  try {
    if (!existsSync(server.CURSOR_RULES_FILE)) {
      if (!isQuiet) console.log('📋 Creating cursor rules...');
      const cursorRules = server.getDefaultCursorRules();
      server.saveCursorRules(cursorRules);
      if (!isQuiet) console.log(`📋 Created ${relative(cwd, server.CURSOR_RULES_FILE)} with project-specific rules`);
    }
  } catch (error) {
    if (!isQuiet) console.error('❌ Error creating cursor rules:', error);
  }

  if (!isQuiet) {
    console.log('✅ cntx-ui initialized successfully!');
    console.log('');
    console.log('🚀 Next step: Start the web interface');
    console.log('   Run: cntx-ui watch');
    console.log('');
    console.log('📱 Then visit: http://localhost:3333');
    console.log('   Follow the setup guide to create your first bundles');
    console.log('');
    console.log('💡 The web interface handles everything - no manual file editing needed!');
  }
}

export function getStatus(cwd = process.cwd(), options = {}) {
  const server = new CntxServer(cwd, { quiet: options.quiet });
  server.init();

  if (!options.quiet) {
    console.log(`📁 Working directory: ${server.CWD}`);
    console.log(`📦 Bundles configured: ${server.bundles.size}`);
    server.bundles.forEach((bundle, name) => {
      const status = bundle.changed ? '🔄 CHANGED' : '✅ SYNCED';
      console.log(`  ${name}: ${bundle.files.length} files ${status}`);
    });

    const hasCursorRules = existsSync(server.CURSOR_RULES_FILE);
    console.log(`🤖 Cursor rules: ${hasCursorRules ? '✅ Configured' : '❌ Not found'}`);
  }
}

export function setupMCP(cwd = process.cwd(), options = {}) {
  const isQuiet = options.quiet || false;
  const projectDir = cwd;
  const projectName = basename(projectDir);
  const configFile = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');

  if (!isQuiet) {
    console.log('🔗 Setting up MCP for Claude Desktop...');
    console.log(`📁 Project: ${projectName} (${projectDir})`);
  }

  // Create config directory if it doesn't exist
  const configDir = dirname(configFile);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Read existing config or create empty one
  let config = { mcpServers: {} };
  if (existsSync(configFile)) {
    try {
      const configContent = readFileSync(configFile, 'utf8');
      config = JSON.parse(configContent);
      if (!config.mcpServers) config.mcpServers = {};
    } catch (error) {
      if (!isQuiet) console.warn('⚠️  Could not parse existing config, creating new one');
      config = { mcpServers: {} };
    }
  }

  // Add this project's MCP server using shell command format that works with Claude Desktop
  const serverName = `cntx-ui-${projectName}`;
  config.mcpServers[serverName] = {
    command: 'sh',
    args: ['-c', `cd ${projectDir} && npx cntx-ui mcp`],
    cwd: projectDir
  };

  // Write updated config
  try {
    writeFileSync(configFile, JSON.stringify(config, null, 2));

    if (!isQuiet) {
      console.log(`✅ Added MCP server: ${serverName}`);
      console.log('📋 Your Claude Desktop config now includes:');

      Object.keys(config.mcpServers).forEach(name => {
        if (name.startsWith('cntx-ui-')) {
          console.log(`  • ${name}: ${config.mcpServers[name].cwd}`);
        }
      });

      console.log('🔄 Please restart Claude Desktop to use the updated configuration');
    }
  } catch (error) {
    if (!isQuiet) {
      console.error('❌ Error writing Claude Desktop config:', error.message);
      console.error('💡 Make sure Claude Desktop is not running and try again');
    }
    throw error;
  }
}
