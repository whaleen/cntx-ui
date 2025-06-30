/**
 * Bundle Manager for cntx-ui
 * Handles bundle generation, XML creation, and file organization
 */

import { readFileSync, statSync } from 'fs';
import { relative, extname, basename, dirname } from 'path';

export default class BundleManager {
  constructor(configManager, fileSystemManager, verbose = false) {
    this.configManager = configManager;
    this.fileSystemManager = fileSystemManager;
    this.verbose = verbose;
    this._isScanning = false;
  }

  // === Bundle Generation ===

  async generateAllBundles() {
    this._isScanning = true;

    try {
      const bundles = this.configManager.getBundles();

      const totalBundles = bundles.size;
      let processedBundles = 0;

      for (const [name] of bundles) {
        if (this.verbose) {
          processedBundles++;
          const progress = `📊 Generating bundles: ${processedBundles}/${totalBundles} (${name})`;
          process.stdout.write(`\r${progress.padEnd(80)}`); // Pad to clear previous longer messages
        }
        await this.generateBundle(name);
      }

      if (this.verbose) {
        process.stdout.write('\r' + ''.padEnd(80) + '\r'); // Clear the line
      }
      this.configManager.saveBundleStates();
    } finally {
      this._isScanning = false;
    }
  }

  async generateBundle(name) {
    const bundles = this.configManager.getBundles();
    const bundle = bundles.get(name);

    if (!bundle) {
      throw new Error(`Bundle "${name}" not found`);
    }

    // Only regenerate from patterns if no manual files exist
    // This preserves manual file management while allowing pattern-based initialization
    if (!bundle.files || bundle.files.length === 0) {
      // Get all files matching bundle patterns
      const allFiles = this.fileSystemManager.getAllFiles();
      const bundleFiles = allFiles.filter(file =>
        bundle.patterns.some(pattern =>
          this.fileSystemManager.matchesPattern(file, pattern)
        )
      );

      // Convert to relative paths for storage (portable across environments)
      bundle.files = bundleFiles.map(file => this.fileSystemManager.relativePath(file));
    }
    // If bundle.files already exists, preserve manual file management

    // Ensure bundle.files always contains relative paths for storage consistency
    bundle.files = bundle.files.map(file =>
      file.startsWith('/') ? this.fileSystemManager.relativePath(file) : file
    );

    // Convert relative paths to absolute for XML generation
    const absoluteFiles = bundle.files.map(file =>
      this.fileSystemManager.absolutePath(file)
    );
    bundle.content = this.generateBundleXML(name, absoluteFiles);
    bundle.size = Buffer.byteLength(bundle.content, 'utf8');
    bundle.generated = new Date().toISOString();
    bundle.changed = false;

    return bundle;
  }

  generateBundleXML(bundleName, files) {
    const projectInfo = this.getProjectInfo();
    const categorizedFiles = this.categorizeFiles(files);
    const entryPoints = this.identifyEntryPoints(files);
    const bundlePurpose = this.getBundlePurpose(bundleName);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<codebase>
  <project_info>
    <name>${this.escapeXml(projectInfo.name)}</name>
    <bundle_name>${this.escapeXml(bundleName)}</bundle_name>
    <bundle_purpose>${this.escapeXml(bundlePurpose)}</bundle_purpose>
    <total_files>${files.length}</total_files>
    <generated_at>${new Date().toISOString()}</generated_at>
  </project_info>
  
  <overview>
    <description>
      This bundle contains ${files.length} files organized into different categories.
      ${bundlePurpose}
    </description>
    <entry_points>
${entryPoints.map(file => `      <file>${this.escapeXml(file)}</file>`).join('\n')}
    </entry_points>
  </overview>
  
  <file_structure>`;

    // Add categorized files
    Object.entries(categorizedFiles).forEach(([category, categoryFiles]) => {
      if (categoryFiles.length > 0) {
        xml += `
    <group name="${category}" description="${this.getTypeDescription(category)}">`;

        categoryFiles.forEach(file => {
          xml += `
      ${this.generateFileXML(file)}`;
        });

        xml += `
    </group>`;
      }
    });

    xml += `
  </file_structure>
</codebase>`;

    return xml;
  }

  // === File Organization ===

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

  getBundlePurpose(bundleName) {
    const purposes = {
      'master': 'Complete codebase overview with all project files',
      'frontend': 'User interface components, styling, and client-side logic',
      'backend': 'Server-side logic, API endpoints, and business logic',
      'components': 'Reusable UI components and their associated styles',
      'utilities': 'Shared utility functions and helper modules',
      'configuration': 'Project configuration files and environment setup',
      'tests': 'Test files and testing utilities',
      'documentation': 'Project documentation and README files',
      'types': 'TypeScript type definitions and interfaces',
      'styles': 'CSS, SCSS, and other styling files'
    };

    return purposes[bundleName] || `Files matching the ${bundleName} bundle patterns`;
  }

  getTypeDescription(type) {
    const descriptions = {
      'entry_points': 'Main application entry points and bootstrap files',
      'components': 'Reusable UI components and their implementations',
      'hooks': 'Custom React hooks and composable functions',
      'utilities': 'Shared utility functions and helper modules',
      'types': 'TypeScript type definitions and interfaces',
      'styles': 'CSS, SCSS, and other styling files',
      'tests': 'Test files and testing utilities',
      'configuration': 'Configuration files and environment setup',
      'documentation': 'Documentation, README files, and guides',
      'other': 'Other project files not fitting specific categories'
    };

    return descriptions[type] || 'Project files';
  }

  // === File Processing ===

  generateFileXML(file) {
    try {
      const stats = this.getFileStats(file);
      const content = readFileSync(file, 'utf8');
      const role = this.getFileRole(file);
      const relativePath = relative(this.configManager.CWD, file);

      return `<file path="${this.escapeXml(relativePath)}" role="${this.escapeXml(role)}" size="${stats.size}" modified="${stats.mtime.toISOString()}">
        <![CDATA[${content}]]>
      </file>`;
    } catch (error) {
      const relativePath = relative(this.configManager.CWD, file);
      return `<file path="${this.escapeXml(relativePath)}" role="error" error="${this.escapeXml(error.message)}">
        <!-- File could not be read -->
      </file>`;
    }
  }

  getFileRole(file) {
    const fileName = basename(file).toLowerCase();
    const filePath = file.toLowerCase();
    const ext = extname(file).toLowerCase();

    if (fileName.match(/^(main|index|app)\.(js|jsx|ts|tsx)$/)) {
      return 'entry_point';
    }
    if (fileName.includes('config') || fileName.includes('setup')) {
      return 'configuration';
    }
    if (fileName.includes('readme') || ext === '.md') {
      return 'documentation';
    }

    return 'implementation';
  }

  getFileStats(filePath) {
    try {
      const stats = statSync(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime
      };
    } catch (error) {
      return {
        size: 0,
        mtime: new Date(0),
        ctime: new Date(0)
      };
    }
  }

  escapeXml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // === Bundle State Management ===

  markBundlesChanged(filename) {
    const bundles = this.configManager.getBundles();

    bundles.forEach((bundle, name) => {
      const matchesBundle = bundle.patterns.some(pattern =>
        this.fileSystemManager.matchesPattern(filename, pattern)
      );

      if (matchesBundle) {
        bundle.changed = true;
      }
    });
  }

  getFileListWithVisibility(bundleName) {
    try {
      const allFiles = this.fileSystemManager.getAllFiles();
      const bundle = this.configManager.getBundles().get(bundleName);

      if (!bundle) {
        return [];
      }

      return allFiles.map(file => {
        const matchesBundle = bundle.patterns.some(pattern =>
          this.fileSystemManager.matchesPattern(file, pattern)
        );

        const isHidden = this.configManager.isFileHidden(file, bundleName);
        const relativePath = relative(this.configManager.CWD, file);

        return {
          path: relativePath,
          fullPath: file,
          included: matchesBundle && !isHidden,
          hidden: isHidden,
          matchesPattern: matchesBundle
        };
      });
    } catch (error) {
      console.error('Failed to get file list with visibility:', error.message);
      return [];
    }
  }

  // === Project Information ===

  getProjectInfo() {
    try {
      const packagePath = this.configManager.CWD + '/package.json';
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      return {
        name: pkg.name || 'Unknown Project',
        version: pkg.version || '1.0.0',
        description: pkg.description || 'No description available'
      };
    } catch (error) {
      return {
        name: 'Unknown Project',
        version: '1.0.0',
        description: 'No description available'
      };
    }
  }

  // === Bundle Operations ===

  async regenerateBundle(bundleName) {
    // Notify WebSocket clients that sync has started
    if (this.webSocketManager) {
      this.webSocketManager.onBundleSyncStarted(bundleName);
    }

    try {
      const bundle = await this.generateBundle(bundleName);
      this.configManager.saveBundleStates();

      // Notify WebSocket clients that sync completed successfully
      if (this.webSocketManager) {
        this.webSocketManager.onBundleSyncCompleted(bundleName);
      }

      return bundle;
    } catch (error) {
      // Notify WebSocket clients that sync failed
      if (this.webSocketManager) {
        this.webSocketManager.onBundleSyncFailed(bundleName, error);
      }
      throw error;
    }
  }

  async regenerateChangedBundles() {
    const bundles = this.configManager.getBundles();
    const changedBundles = [];

    for (const [name, bundle] of bundles) {
      if (bundle.changed) {
        await this.generateBundle(name);
        changedBundles.push(name);
      }
    }

    if (changedBundles.length > 0) {
      this.configManager.saveBundleStates();
    }

    return changedBundles;
  }

  getBundleContent(bundleName) {
    const bundle = this.configManager.getBundles().get(bundleName);
    return bundle ? bundle.content : null;
  }

  getBundleInfo(bundleName) {
    const bundle = this.configManager.getBundles().get(bundleName);
    if (!bundle) return null;

    return {
      name: bundleName,
      fileCount: bundle.files.length,
      size: bundle.size,
      generated: bundle.generated,
      changed: bundle.changed,
      patterns: bundle.patterns
    };
  }

  getAllBundleInfo() {
    const bundles = this.configManager.getBundles();
    return Array.from(bundles.entries()).map(([name, bundle]) => ({
      name,
      fileCount: bundle.files.length,
      size: bundle.size,
      generated: bundle.generated,
      changed: bundle.changed,
      patterns: bundle.patterns
    }));
  }

  // === Getters ===

  get isScanning() {
    return this._isScanning;
  }
}
