import { readFileSync, writeFileSync, existsSync, mkdirSync, watch, readdirSync, statSync } from 'fs';
import { join, dirname, relative, extname } from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import { startMCPTransport } from './lib/mcp-transport.js';

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
  constructor(cwd = process.cwd()) {
    this.CWD = cwd;
    this.CNTX_DIR = join(cwd, '.cntx');
    this.CONFIG_FILE = join(this.CNTX_DIR, 'config.json');
    this.BUNDLES_FILE = join(this.CNTX_DIR, 'bundles.json');
    this.HIDDEN_FILES_CONFIG = join(this.CNTX_DIR, 'hidden-files.json');
    this.IGNORE_FILE = join(cwd, '.cntxignore');
    this.CURSOR_RULES_FILE = join(cwd, '.cursorrules');
    this.CLAUDE_MD_FILE = join(cwd, 'CLAUDE.md');

    this.bundles = new Map();
    this.ignorePatterns = [];
    this.watchers = [];
    this.clients = new Set();
    this.isScanning = false;

    this.hiddenFilesConfig = {
      globalHidden: [], // Files hidden across all bundles
      bundleSpecific: {}, // Files hidden per bundle: { bundleName: [filePaths] }
      userIgnorePatterns: [], // User-added ignore patterns
      disabledSystemPatterns: [] // System patterns the user disabled
    };
  }

  init() {
    if (!existsSync(this.CNTX_DIR)) mkdirSync(this.CNTX_DIR, { recursive: true });
    this.loadConfig();
    this.loadHiddenFilesConfig();
    this.loadIgnorePatterns();
    this.loadBundleStates();
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
        console.warn('Could not load hidden files config:', e.message);
      }
    }
  }

  saveHiddenFilesConfig() {
    try {
      writeFileSync(this.HIDDEN_FILES_CONFIG, JSON.stringify(this.hiddenFilesConfig, null, 2));
    } catch (e) {
      console.error('Failed to save hidden files config:', e.message);
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
        console.warn('Could not load bundle states:', e.message);
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
      console.log(`Regex error for pattern "${pattern}": ${e.message}`);
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
          console.log(`File ${eventType}: ${filename}`);
          this.markBundlesChanged(filename.replace(/\\\\/g, '/'));
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
    console.log('Scanning files and generating bundles...');

    this.bundles.forEach((bundle, name) => {
      this.generateBundle(name);
    });

    this.saveBundleStates();
    this.isScanning = false;
    console.log('Bundle generation complete');
  }

  generateBundle(name) {
    const bundle = this.bundles.get(name);
    if (!bundle) return;

    console.log(`Generating bundle: ${name}`);
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

    console.log(`Generated bundle '${name}' with ${bundle.files.length} files (${(bundle.size / 1024).toFixed(1)}kb)`);
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
    const server = createServer((req, res) => {
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
              console.error('Error serving index.html:', e);
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
              console.error('Error serving static file:', e);
            }
          }
        }
      }

      // API Routes
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
              console.log('🔍 Received config save request');
              const config = JSON.parse(body);
              console.log('📝 Config to save:', JSON.stringify(config, null, 2));

              // Ensure .cntx directory exists
              if (!existsSync(this.CNTX_DIR)) {
                console.log('📁 Creating .cntx directory...');
                mkdirSync(this.CNTX_DIR, { recursive: true });
              }

              // Write config file
              console.log('💾 Writing config to:', this.CONFIG_FILE);
              writeFileSync(this.CONFIG_FILE, JSON.stringify(config, null, 2));
              console.log('✅ Config file written successfully');

              // Reload configuration
              this.loadConfig();
              this.generateAllBundles();
              this.broadcastUpdate();

              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('OK');
              console.log('✅ Config save response sent');

            } catch (e) {
              console.error('❌ Config save error:', e);
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end(`Error: ${e.message}`);
            }
          });

          req.on('error', (err) => {
            console.error('❌ Request error:', err);
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
      console.log(`🚀 cntx-ui API running at http://localhost:${port}`);
      console.log(`📁 Watching: ${this.CWD}`);
      console.log(`📦 Bundles: ${Array.from(this.bundles.keys()).join(', ')}`);
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
}

export function startServer(options = {}) {
  const server = new CntxServer(options.cwd);
  server.init();
  return server.startServer(options.port);
}

export function startMCPServer(options = {}) {
  const server = new CntxServer(options.cwd);
  server.init();
  startMCPTransport(server);
  return server;
}

export function generateBundle(name = 'master', cwd = process.cwd()) {
  const server = new CntxServer(cwd);
  server.init();
  server.generateBundle(name);
  server.saveBundleStates();
}

export function initConfig(cwd = process.cwd()) {
  console.log('🚀 Starting initConfig...');
  console.log('📂 Working directory:', cwd);

  const server = new CntxServer(cwd);
  console.log('📁 CNTX_DIR:', server.CNTX_DIR);
  console.log('📄 CONFIG_FILE path:', server.CONFIG_FILE);

  const defaultConfig = {
    bundles: {
      master: ['**/*']
    }
  };

  try {
    // Create .cntx directory
    console.log('🔍 Checking if .cntx directory exists...');
    if (!existsSync(server.CNTX_DIR)) {
      console.log('📁 Creating .cntx directory...');
      mkdirSync(server.CNTX_DIR, { recursive: true });
      console.log('✅ .cntx directory created');
    } else {
      console.log('✅ .cntx directory already exists');
    }

    // List directory contents before writing config
    console.log('📋 Directory contents before writing config:');
    const beforeFiles = readdirSync(server.CNTX_DIR);
    console.log('Files:', beforeFiles);

    // Write config.json
    console.log('📝 Writing config.json...');
    console.log('📄 Config content:', JSON.stringify(defaultConfig, null, 2));
    console.log('📍 Writing to path:', server.CONFIG_FILE);

    writeFileSync(server.CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    console.log('✅ writeFileSync completed');

    // Verify file was created
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

  } catch (error) {
    console.error('❌ Error in initConfig:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }

  // Create cursor rules if they don't exist
  try {
    if (!existsSync(server.CURSOR_RULES_FILE)) {
      console.log('📋 Creating cursor rules...');
      const cursorRules = server.getDefaultCursorRules();
      server.saveCursorRules(cursorRules);
      console.log(`📋 Created ${relative(cwd, server.CURSOR_RULES_FILE)} with project-specific rules`);
    }
  } catch (error) {
    console.error('❌ Error creating cursor rules:', error);
  }

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

export function getStatus(cwd = process.cwd()) {
  const server = new CntxServer(cwd);
  server.init();

  console.log(`📁 Working directory: ${server.CWD}`);
  console.log(`📦 Bundles configured: ${server.bundles.size}`);
  server.bundles.forEach((bundle, name) => {
    const status = bundle.changed ? '🔄 CHANGED' : '✅ SYNCED';
    console.log(`  ${name}: ${bundle.files.length} files ${status}`);
  });

  const hasCursorRules = existsSync(server.CURSOR_RULES_FILE);
  console.log(`🤖 Cursor rules: ${hasCursorRules ? '✅ Configured' : '❌ Not found'}`);
}
