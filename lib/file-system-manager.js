/**
 * File System Manager for cntx-ui
 * Handles file operations, pattern matching, and directory traversal
 */

import { readdirSync, statSync, existsSync, watch } from 'fs';
import { join, relative, extname, basename, dirname } from 'path';

export default class FileSystemManager {
  constructor(cwd = process.cwd(), options = {}) {
    this.CWD = cwd;
    this.verbose = options.verbose || false;
    this.watchers = [];
    this.ignorePatterns = [];
  }

  // === File Traversal ===

  getAllFiles(dir = this.CWD, files = []) {
    try {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);

        // Skip if should be ignored
        if (this.shouldIgnoreAnything(item, fullPath)) {
          continue;
        }

        try {
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            this.getAllFiles(fullPath, files);
          } else if (stat.isFile()) {
            if (!this.shouldIgnoreFile(fullPath)) {
              files.push(fullPath);
            }
          }
        } catch (error) {
          // Skip files we can't stat (permission issues, broken symlinks, etc.)
          continue;
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(`Cannot read directory ${dir}: ${error.message}`);
      }
    }

    return files;
  }

  getFileTree() {
    const files = this.getAllFiles();

    return files.map(file => {
      const stats = this.getFileStats(file);
      const relativePath = relative(this.CWD, file);

      return {
        path: relativePath,
        fullPath: file,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        type: this.getFileType(file)
      };
    });
  }

  // === Pattern Matching ===

  matchesPattern(path, pattern) {
    // Convert glob pattern to regex
    let regexPattern = pattern
      .replace(/\./g, '\\.')           // Escape dots
      .replace(/\*\*/g, '___GLOBSTAR___') // Temporary replace **
      .replace(/\*/g, '[^/]*')         // * matches anything except /
      .replace(/___GLOBSTAR___/g, '.*') // ** matches anything including /
      .replace(/\?/g, '[^/]');         // ? matches single char except /

    // Ensure pattern matches from start or after a directory separator
    if (!regexPattern.startsWith('.*') && !regexPattern.startsWith('[^/]*')) {
      regexPattern = '(^|/)' + regexPattern;
    }

    // Ensure pattern matches to end or before a directory separator
    if (!regexPattern.endsWith('.*') && !regexPattern.endsWith('[^/]*')) {
      regexPattern = regexPattern + '($|/)';
    }

    const regex = new RegExp(regexPattern);
    const relativePath = relative(this.CWD, path);

    return regex.test(relativePath) || regex.test(path);
  }

  shouldIgnoreFile(filePath) {
    const relativePath = relative(this.CWD, filePath);

    return this.ignorePatterns.some(pattern =>
      this.matchesPattern(filePath, pattern) ||
      this.matchesPattern(relativePath, pattern)
    );
  }

  shouldIgnoreAnything(itemName, fullPath) {
    // Hardcoded bad directories and files to always ignore
    const badDirs = [
      'node_modules', '.git', '.svn', '.hg', '.bzr', '_darcs',
      'CVS', '.cvs', 'RCS', 'SCCS', '{arch}', '.arch-ids',
      '.monotone', '_MTN', '.fslckout', '_FOSSIL_',
      '.fos', 'BitKeeper', 'ChangeSet', '.teamcity',
      '.idea', '.vscode', '.vs', '.gradle', '.settings',
      'target', 'build', 'dist', 'out', 'bin', 'obj',
      '.next', '.nuxt', '.vite', '.tmp', '.temp',
      '__pycache__', '.pytest_cache', '.coverage',
      '.nyc_output', 'coverage', 'lcov-report'
    ];

    const badExtensions = [
      '.log', '.tmp', '.temp', '.cache', '.pid', '.lock',
      '.swp', '.swo', '.DS_Store', 'Thumbs.db', '.env',
      '.min.js', '.min.css', '.map', '.pyc', '.pyo',
      '.class', '.jar', '.exe', '.dll', '.so', '.dylib',
      '.o', '.a', '.obj', '.lib', '.pdb'
    ];

    const badFiles = [
      '.gitignore', '.gitkeep', '.gitattributes',
      '.eslintcache', '.prettierignore',
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'npm-debug.log', 'yarn-debug.log', 'yarn-error.log'
    ];

    // Check bad directories
    if (badDirs.includes(itemName)) {
      return true;
    }

    // Check bad extensions
    const ext = extname(itemName);
    if (badExtensions.includes(ext)) {
      return true;
    }

    // Check bad files
    if (badFiles.includes(itemName)) {
      return true;
    }

    // Check if it's a hidden file/directory (starts with .)
    if (itemName.startsWith('.') && itemName !== '.cntx') {
      return true;
    }

    // Check ignore patterns if loaded
    if (this.ignorePatterns.length > 0) {
      const relativePath = relative(this.CWD, fullPath);
      if (this.ignorePatterns.some(pattern =>
        this.matchesPattern(fullPath, pattern) ||
        this.matchesPattern(relativePath, pattern)
      )) {
        return true;
      }
    }

    return false;
  }

  // === File Metadata ===

  getFileStats(filePath) {
    try {
      const stats = statSync(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      return {
        size: 0,
        mtime: new Date(0),
        ctime: new Date(0),
        isDirectory: false,
        isFile: false
      };
    }
  }

  getFileType(filePath) {
    const ext = extname(filePath).toLowerCase();
    const fileName = basename(filePath).toLowerCase();

    // Programming languages
    if (ext.match(/\.(js|jsx|mjs|cjs)$/)) return 'javascript';
    if (ext.match(/\.(ts|tsx)$/)) return 'typescript';
    if (ext.match(/\.(py|pyw)$/)) return 'python';
    if (ext.match(/\.(java|class)$/)) return 'java';
    if (ext.match(/\.(c|h)$/)) return 'c';
    if (ext.match(/\.(cpp|cxx|cc|hpp|hxx)$/)) return 'cpp';
    if (ext.match(/\.(cs)$/)) return 'csharp';
    if (ext.match(/\.(go)$/)) return 'go';
    if (ext.match(/\.(rs)$/)) return 'rust';
    if (ext.match(/\.(php)$/)) return 'php';
    if (ext.match(/\.(rb)$/)) return 'ruby';

    // Web technologies
    if (ext.match(/\.(html|htm)$/)) return 'html';
    if (ext.match(/\.(css|scss|sass|less|styl)$/)) return 'stylesheet';
    if (ext.match(/\.(vue)$/)) return 'vue';

    // Data formats
    if (ext.match(/\.(json)$/)) return 'json';
    if (ext.match(/\.(xml)$/)) return 'xml';
    if (ext.match(/\.(yaml|yml)$/)) return 'yaml';
    if (ext.match(/\.(toml)$/)) return 'toml';
    if (ext.match(/\.(ini)$/)) return 'ini';
    if (ext.match(/\.(csv)$/)) return 'csv';

    // Documentation
    if (ext.match(/\.(md|markdown)$/)) return 'markdown';
    if (ext.match(/\.(txt)$/)) return 'text';
    if (ext.match(/\.(rst)$/)) return 'restructuredtext';

    // Media
    if (ext.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/)) return 'image';
    if (ext.match(/\.(mp4|avi|mov|wmv|flv|webm)$/)) return 'video';
    if (ext.match(/\.(mp3|wav|flac|aac|ogg)$/)) return 'audio';

    // Archives
    if (ext.match(/\.(zip|tar|gz|bz2|xz|7z|rar)$/)) return 'archive';

    // Configuration
    if (fileName.includes('config') || fileName.includes('setup')) return 'configuration';

    return 'unknown';
  }

  getFileRole(file) {
    const fileName = basename(file).toLowerCase();
    const filePath = file.toLowerCase();
    const ext = extname(file).toLowerCase();

    // Entry points
    if (fileName.match(/^(main|index|app)\.(js|jsx|ts|tsx)$/)) {
      return 'entry_point';
    }

    // Configuration
    if (fileName.includes('config') || fileName.includes('setup') ||
      ext.match(/\.(json|yaml|yml|toml|ini)$/)) {
      return 'configuration';
    }

    // Documentation
    if (fileName.includes('readme') || ext === '.md' || ext === '.txt') {
      return 'documentation';
    }

    // Tests
    if (fileName.includes('.test.') || fileName.includes('.spec.') ||
      filePath.includes('/test/') || filePath.includes('/__tests__/')) {
      return 'test';
    }

    // Components
    if (ext.match(/\.(jsx|tsx|vue)$/) || filePath.includes('/components/')) {
      return 'component';
    }

    // Utilities
    if (filePath.includes('/utils/') || filePath.includes('/helpers/') ||
      filePath.includes('/lib/')) {
      return 'utility';
    }

    // Styles
    if (ext.match(/\.(css|scss|sass|less|styl)$/)) {
      return 'style';
    }

    return 'implementation';
  }

  // === File Categorization ===

  categorizeFiles(files) {
    const categories = {
      'entry_points': [],
      'components': [],
      'hooks': [],
      'utilities': [],
      'types': [],
      'styles': [],
      'tests': [],
      'configuration': [],
      'documentation': [],
      'other': []
    };

    files.forEach(file => {
      const ext = extname(file).toLowerCase();
      const fileName = basename(file).toLowerCase();
      const filePath = file.toLowerCase();

      // Entry points
      if (fileName.match(/^(main|index|app)\.(js|jsx|ts|tsx)$/)) {
        categories.entry_points.push(file);
      }
      // Components
      else if (ext.match(/\.(jsx|tsx|vue)$/) || filePath.includes('/components/')) {
        categories.components.push(file);
      }
      // Hooks
      else if (filePath.includes('/hooks/') || fileName.startsWith('use') && ext.match(/\.(js|ts)$/)) {
        categories.hooks.push(file);
      }
      // Utilities
      else if (filePath.includes('/utils/') || filePath.includes('/helpers/') || filePath.includes('/lib/')) {
        categories.utilities.push(file);
      }
      // Types
      else if (fileName.includes('.d.ts') || filePath.includes('/types/') || fileName.includes('types')) {
        categories.types.push(file);
      }
      // Styles
      else if (ext.match(/\.(css|scss|sass|less|styl)$/)) {
        categories.styles.push(file);
      }
      // Tests
      else if (fileName.includes('.test.') || fileName.includes('.spec.') || filePath.includes('/test/') || filePath.includes('/__tests__/')) {
        categories.tests.push(file);
      }
      // Configuration
      else if (ext.match(/\.(json|yaml|yml|toml|ini)$/) || fileName.includes('config')) {
        categories.configuration.push(file);
      }
      // Documentation
      else if (ext.match(/\.(md|txt|rst)$/)) {
        categories.documentation.push(file);
      }
      // Other
      else {
        categories.other.push(file);
      }
    });

    return categories;
  }

  identifyEntryPoints(files) {
    const entryPoints = [];
    const entryPatterns = [
      /^(main|index|app)\.(js|jsx|ts|tsx)$/i,
      /^server\.(js|ts)$/i,
      /^app\.(js|jsx|ts|tsx)$/i
    ];

    files.forEach(file => {
      const fileName = basename(file);
      if (entryPatterns.some(pattern => pattern.test(fileName))) {
        entryPoints.push(file);
      }
    });

    return entryPoints;
  }

  // === File Watching ===

  startWatching(onFileChange) {
    try {
      // Watch the current working directory recursively
      const watcher = watch(this.CWD, { recursive: true }, (eventType, filename) => {
        if (filename && !this.shouldIgnoreAnything(basename(filename), join(this.CWD, filename))) {
          onFileChange?.(eventType, filename);
        }
      });

      this.watchers.push(watcher);
      if (this.verbose) {
        console.log('📁 File watcher started');
      }
    } catch (error) {
      if (this.verbose) {
        console.error('Failed to start file watcher:', error.message);
      }
    }
  }

  stopWatching() {
    this.watchers.forEach(watcher => {
      try {
        watcher.close();
      } catch (error) {
        if (this.verbose) {
          console.error('Failed to close watcher:', error.message);
        }
      }
    });
    this.watchers = [];
    if (this.verbose) {
      console.log('📁 File watchers stopped');
    }
  }

  // === Content Type Detection ===

  getContentType(filePath) {
    const ext = extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip'
    };
    return contentTypes[ext] || 'text/plain';
  }

  // === Utilities ===

  setIgnorePatterns(patterns) {
    this.ignorePatterns = patterns;
  }

  relativePath(filePath) {
    return relative(this.CWD, filePath);
  }

  absolutePath(relativePath) {
    return join(this.CWD, relativePath);
  }

  isValidPath(filePath) {
    try {
      return existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  getDirectoryContents(dirPath) {
    try {
      const items = readdirSync(dirPath);
      return items.filter(item => !this.shouldIgnoreAnything(item, join(dirPath, item)));
    } catch (error) {
      return [];
    }
  }

  // === Cleanup ===

  destroy() {
    this.stopWatching();
  }
}
