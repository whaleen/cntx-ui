/**
 * Agent Runtime for Codebase Exploration and Development
 * Implements the four behavior modes: Discovery, Query, Feature Investigation, Passive
 */

import AgentTools from './agent-tools.js';

export class AgentRuntime {
  constructor(cntxServer) {
    this.cntxServer = cntxServer;
    this.tools = new AgentTools(cntxServer);
  }

  /**
   * Discovery Mode: "Tell me about this codebase"
   * Summarize bundles, architectural patterns, and code organization
   */
  async discoverCodebase(options = {}) {
    const { scope = 'all', includeDetails = true } = options;
    
    try {
      const discovery = {
        overview: await this.getCodebaseOverview(),
        bundles: await this.analyzeBundles(scope),
        architecture: await this.analyzeArchitecture(),
        patterns: await this.identifyPatterns(),
        recommendations: []
      };

      if (includeDetails) {
        discovery.semanticSummary = await this.getSemanticSummary();
        discovery.fileTypes = await this.analyzeFileTypes();
        discovery.complexity = await this.analyzeComplexity();
      }

      // Generate recommendations
      discovery.recommendations = await this.generateDiscoveryRecommendations(discovery);

      return discovery;
    } catch (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }
  }

  /**
   * Query Mode: "Where is the user authentication handled?"
   * Use semantic search and AST analysis for precise answers
   */
  async answerQuery(question, options = {}) {
    const { scope = null, maxResults = 10, includeCode = false } = options;

    try {
      // Extract key terms from question
      const searchTerms = this.extractSearchTerms(question);
      
      // Perform semantic search
      const semanticResults = await this.tools.searchSemanticChunks(searchTerms.primary, {
        bundle: scope,
        maxResults: maxResults * 2
      });

      // Perform bundle-aware file search if needed
      const fileResults = await this.searchInFiles(searchTerms, scope);

      // Combine and rank results
      const combinedResults = this.combineSearchResults(semanticResults, fileResults, question);

      // Generate contextual answer
      const answer = await this.generateContextualAnswer(question, combinedResults, includeCode);

      return {
        question,
        answer: answer.response,
        evidence: answer.evidence,
        confidence: answer.confidence,
        suggestions: answer.suggestions,
        relatedFiles: combinedResults.files.slice(0, 5),
        totalMatches: combinedResults.totalMatches
      };
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Feature Investigation Mode: "I want to add dark mode—what already exists?"
   * Search for existing implementations and identify integration points
   */
  async investigateFeature(featureDescription, options = {}) {
    const { includeRecommendations = true } = options;

    try {
      const investigation = {
        feature: featureDescription,
        existing: await this.findExistingImplementations(featureDescription),
        related: await this.findRelatedCode(featureDescription),
        dependencies: await this.analyzeDependencies(featureDescription),
        integration: await this.findIntegrationPoints(featureDescription),
        patterns: await this.identifyImplementationPatterns(featureDescription)
      };

      if (includeRecommendations) {
        investigation.recommendations = await this.generateImplementationRecommendations(investigation);
        investigation.approach = await this.suggestImplementationApproach(investigation);
      }

      return investigation;
    } catch (error) {
      throw new Error(`Feature investigation failed: ${error.message}`);
    }
  }

  /**
   * Passive Mode: "Let's discuss the architecture before I make changes"
   * Engage in conversation about design decisions and patterns
   */
  async discussAndPlan(userInput, context = {}) {
    try {
      const discussion = {
        userInput,
        context: await this.analyzeDiscussionContext(userInput, context),
        insights: await this.generateInsights(userInput),
        considerations: await this.identifyConsiderations(userInput),
        alternatives: await this.suggestAlternatives(userInput),
        questions: await this.generateClarifyingQuestions(userInput)
      };

      return discussion;
    } catch (error) {
      throw new Error(`Discussion planning failed: ${error.message}`);
    }
  }

  /**
   * Project Organizer Mode: Setup and maintenance of project organization
   * Adapts to project maturity - setup for fresh projects, optimization for established ones
   */
  async organizeProject(options = {}) {
    const { activity = 'detect', autoDetect = true, force = false } = options;

    try {
      const organization = {
        projectState: await this.detectProjectState(),
        currentActivity: activity,
        timestamp: new Date().toISOString()
      };

      // Auto-detect appropriate activity if requested
      if (autoDetect && activity === 'detect') {
        organization.suggestedActivity = this.suggestActivity(organization.projectState);
        organization.workflow = this.generateWorkflow(organization.projectState);
      }

      // Execute the requested activity
      switch (activity) {
        case 'detect':
          organization.analysis = await this.analyzeProjectMaturity();
          organization.recommendations = await this.generateSetupRecommendations(organization.projectState);
          break;

        case 'analyze':
          organization.semanticAnalysis = await this.performSemanticAnalysis();
          organization.readiness = this.assessBundlingReadiness(organization.semanticAnalysis);
          break;

        case 'bundle':
          organization.bundleSuggestions = await this.generateIntelligentBundles();
          organization.preview = await this.previewBundleChanges(organization.bundleSuggestions);
          break;

        case 'create':
          organization.bundleSuggestions = await this.generateIntelligentBundles();
          organization.creation = await this.createSuggestedBundles(organization.bundleSuggestions);
          break;

        case 'optimize':
          organization.optimizations = await this.analyzeOptimizationOpportunities();
          organization.recommendations = await this.generateOptimizationPlan();
          break;

        case 'audit':
          organization.audit = await this.auditCurrentOrganization();
          organization.issues = await this.identifyOrganizationalIssues();
          break;

        case 'cleanup':
          organization.cleanup = await this.suggestCleanupActions();
          organization.impact = await this.assessCleanupImpact();
          break;

        case 'validate':
          organization.validation = await this.validateCurrentOrganization();
          organization.health = await this.calculateOrganizationHealth();
          break;

        default:
          throw new Error(`Unknown activity: ${activity}`);
      }

      // Add next steps
      organization.nextSteps = this.generateNextSteps(organization, activity);

      return organization;
    } catch (error) {
      throw new Error(`Project organization failed: ${error.message}`);
    }
  }

  // Helper methods for Discovery Mode

  async getCodebaseOverview() {
    const bundles = Array.from(this.cntxServer.bundles.entries());
    const totalFiles = bundles.reduce((sum, [_, bundle]) => sum + bundle.files.length, 0);
    const totalSize = bundles.reduce((sum, [_, bundle]) => sum + bundle.size, 0);

    return {
      projectPath: this.cntxServer.CWD,
      totalBundles: bundles.length,
      totalFiles,
      totalSize,
      formattedSize: this.formatBytes(totalSize),
      bundleNames: bundles.map(([name]) => name)
    };
  }

  async analyzeBundles(scope) {
    const bundlesToAnalyze = scope === 'all' 
      ? Array.from(this.cntxServer.bundles.entries())
      : [[scope, this.cntxServer.bundles.get(scope)]].filter(([_, b]) => b);

    return Promise.all(bundlesToAnalyze.map(async ([name, bundle]) => {
      const fileTypes = this.categorizeFiles(bundle.files);
      return {
        name,
        fileCount: bundle.files.length,
        size: bundle.size,
        formattedSize: this.formatBytes(bundle.size),
        patterns: bundle.patterns,
        fileTypes,
        lastGenerated: bundle.lastGenerated,
        changed: bundle.changed,
        purpose: this.inferBundlePurpose(name, bundle.files, fileTypes)
      };
    }));
  }

  async analyzeArchitecture() {
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 100 });
    
    if (!analysis.chunks) {
      return { message: 'No semantic analysis available for architecture detection' };
    }

    const patterns = {
      frontend: this.detectFrontendPatterns(analysis.chunks),
      backend: this.detectBackendPatterns(analysis.chunks),
      testing: this.detectTestingPatterns(analysis.chunks),
      configuration: this.detectConfigPatterns(analysis.chunks)
    };

    return {
      type: this.determineArchitectureType(patterns),
      patterns,
      frameworks: this.identifyFrameworks(analysis.chunks),
      languages: this.identifyLanguages(analysis.chunks)
    };
  }

  async identifyPatterns() {
    const files = await this.tools.listFiles({ limit: 200 });
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 50 });

    return {
      organizational: this.identifyOrganizationalPatterns(files),
      coding: this.identifyCodingPatterns(analysis.chunks || []),
      naming: this.identifyNamingPatterns(files),
      structural: this.identifyStructuralPatterns(files)
    };
  }

  // Helper methods for Query Mode

  extractSearchTerms(question) {
    // Simple keyword extraction - could be enhanced with NLP
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'how', 'where', 'what', 'when', 'why'];
    const words = question.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));

    return {
      primary: words.join(' '),
      keywords: words,
      original: question
    };
  }

  async searchInFiles(searchTerms, scope) {
    const files = await this.tools.listFiles({ 
      bundle: scope,
      pattern: searchTerms.keywords.join('|'),
      limit: 50 
    });

    return {
      files: files.map(f => ({
        path: f.path,
        bundles: f.bundles,
        relevance: this.calculateFileRelevance(f.path, searchTerms.keywords)
      })),
      totalFiles: files.length
    };
  }

  combineSearchResults(semanticResults, fileResults, question) {
    const allFiles = new Set();
    const chunks = semanticResults.chunks || [];
    
    // Add files from semantic chunks
    chunks.forEach(chunk => {
      if (chunk.filePath) allFiles.add(chunk.filePath);
    });

    // Add files from direct search
    fileResults.files.forEach(f => allFiles.add(f.path));

    return {
      chunks,
      files: Array.from(allFiles),
      totalMatches: chunks.length + fileResults.totalFiles,
      semanticMatches: semanticResults.totalResults || 0,
      fileMatches: fileResults.totalFiles
    };
  }

  async generateContextualAnswer(question, results, includeCode) {
    const evidence = [];
    const suggestions = [];
    let confidence = 0;

    if (results.chunks.length > 0) {
      confidence += 0.6;
      evidence.push({
        type: 'semantic',
        count: results.chunks.length,
        message: `Found ${results.chunks.length} relevant code chunks`
      });

      if (includeCode) {
        evidence.push({
          type: 'code',
          samples: results.chunks.slice(0, 3).map(chunk => ({
            file: chunk.filePath,
            name: chunk.name,
            purpose: chunk.purpose,
            code: chunk.code
          }))
        });
      }
    }

    if (results.files.length > 0) {
      confidence += 0.3;
      evidence.push({
        type: 'files',
        count: results.files.length,
        files: results.files.slice(0, 5)
      });
    }

    // Generate response based on evidence
    let response = `Based on the analysis of your codebase:\n\n`;

    if (results.chunks.length > 0) {
      const topChunk = results.chunks[0];
      response += `The most relevant code is in \`${topChunk.filePath}\` where `;
      response += `${topChunk.purpose || topChunk.name} is implemented`;
      
      if (topChunk.startLine) {
        response += ` (lines ${topChunk.startLine}-${topChunk.endLine})`;
      }
      response += '.\n\n';

      if (results.chunks.length > 1) {
        response += `Additionally, found ${results.chunks.length - 1} other related implementations.\n\n`;
      }
    }

    if (results.files.length > 0) {
      response += `Key files to examine: ${results.files.slice(0, 3).join(', ')}\n\n`;
    }

    if (confidence < 0.5) {
      suggestions.push('Consider running semantic analysis if not already done');
      suggestions.push('Try rephrasing the question with more specific terms');
    }

    return {
      response: response.trim(),
      evidence,
      confidence: Math.min(confidence, 1.0),
      suggestions
    };
  }

  // Helper methods for Feature Investigation Mode

  async findExistingImplementations(featureDescription) {
    const searchTerms = this.extractSearchTerms(featureDescription);
    const results = await this.tools.searchSemanticChunks(searchTerms.primary, { maxResults: 20 });
    
    return {
      found: results.chunks.length > 0,
      implementations: results.chunks.map(chunk => ({
        file: chunk.filePath,
        name: chunk.name,
        purpose: chunk.purpose,
        type: chunk.subtype,
        bundles: chunk.bundles,
        confidence: chunk.relevanceScore || 0
      })),
      summary: `Found ${results.chunks.length} potentially related implementations`
    };
  }

  async findRelatedCode(featureDescription) {
    // Look for related patterns in bundle organization
    const bundles = await this.analyzeBundles('all');
    const relatedBundles = bundles.filter(bundle => 
      this.isFeatureRelated(featureDescription, bundle.name, bundle.purpose)
    );

    return {
      bundles: relatedBundles,
      patterns: this.identifyRelatedPatterns(featureDescription, relatedBundles)
    };
  }

  async generateImplementationRecommendations(investigation) {
    const recommendations = [];

    if (investigation.existing.found) {
      recommendations.push({
        type: 'extend',
        message: 'Extend existing implementation rather than creating new one',
        files: investigation.existing.implementations.slice(0, 3).map(impl => impl.file)
      });
    } else {
      recommendations.push({
        type: 'create',
        message: 'No existing implementation found - create new feature',
        suggestedLocation: this.suggestImplementationLocation(investigation.feature)
      });
    }

    if (investigation.related.bundles.length > 0) {
      recommendations.push({
        type: 'organize',
        message: 'Consider organizing in existing bundle structure',
        bundles: investigation.related.bundles.map(b => b.name)
      });
    }

    return recommendations;
  }

  // Utility methods

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  categorizeFiles(files) {
    const categories = {};
    files.forEach(file => {
      const ext = require('path').extname(file).toLowerCase();
      categories[ext] = (categories[ext] || 0) + 1;
    });
    return categories;
  }

  inferBundlePurpose(name, files, fileTypes) {
    if (name.includes('component') || name.includes('ui')) return 'UI Components';
    if (name.includes('api') || name.includes('server')) return 'Backend API';
    if (name.includes('test')) return 'Testing';
    if (name.includes('config')) return 'Configuration';
    if (files.some(f => f.includes('hook'))) return 'React Hooks';
    if (Object.keys(fileTypes).includes('.ts') || Object.keys(fileTypes).includes('.tsx')) return 'TypeScript Application';
    return 'General Purpose';
  }

  detectFrontendPatterns(chunks) {
    return {
      react: chunks.filter(c => c.subtype === 'react_component').length,
      hooks: chunks.filter(c => c.name && c.name.startsWith('use')).length,
      components: chunks.filter(c => c.purpose && c.purpose.includes('component')).length
    };
  }

  detectBackendPatterns(chunks) {
    return {
      apis: chunks.filter(c => c.purpose && c.purpose.includes('API')).length,
      middleware: chunks.filter(c => c.purpose && c.purpose.includes('middleware')).length,
      routes: chunks.filter(c => c.purpose && c.purpose.includes('route')).length
    };
  }

  detectTestingPatterns(chunks) {
    return {
      tests: chunks.filter(c => c.filePath && c.filePath.includes('test')).length,
      specs: chunks.filter(c => c.filePath && c.filePath.includes('spec')).length
    };
  }

  detectConfigPatterns(chunks) {
    return {
      configs: chunks.filter(c => c.purpose && c.purpose.includes('config')).length
    };
  }

  determineArchitectureType(patterns) {
    if (patterns.frontend.react > 0) return 'React Application';
    if (patterns.backend.apis > 0) return 'Backend API';
    return 'Mixed/Utility';
  }

  identifyFrameworks(chunks) {
    const frameworks = new Set();
    chunks.forEach(chunk => {
      if (chunk.includes?.imports) {
        chunk.includes.imports.forEach(imp => {
          if (imp.includes('react')) frameworks.add('React');
          if (imp.includes('express')) frameworks.add('Express');
          if (imp.includes('next')) frameworks.add('Next.js');
          if (imp.includes('vue')) frameworks.add('Vue');
        });
      }
    });
    return Array.from(frameworks);
  }

  identifyLanguages(chunks) {
    const languages = new Set();
    chunks.forEach(chunk => {
      if (chunk.filePath?.endsWith('.ts') || chunk.filePath?.endsWith('.tsx')) {
        languages.add('TypeScript');
      } else if (chunk.filePath?.endsWith('.js') || chunk.filePath?.endsWith('.jsx')) {
        languages.add('JavaScript');
      }
    });
    return Array.from(languages);
  }

  calculateFileRelevance(filePath, keywords) {
    let score = 0;
    const fileName = require('path').basename(filePath).toLowerCase();
    keywords.forEach(keyword => {
      if (fileName.includes(keyword.toLowerCase())) {
        score += 1;
      }
    });
    return score;
  }

  isFeatureRelated(featureDescription, bundleName, bundlePurpose) {
    const feature = featureDescription.toLowerCase();
    const name = bundleName.toLowerCase();
    const purpose = (bundlePurpose || '').toLowerCase();
    
    return name.includes(feature) || purpose.includes(feature) ||
           (feature.includes('ui') && (name.includes('component') || name.includes('ui'))) ||
           (feature.includes('api') && (name.includes('api') || name.includes('server')));
  }

  identifyRelatedPatterns(featureDescription, relatedBundles) {
    return relatedBundles.map(bundle => ({
      bundle: bundle.name,
      pattern: bundle.patterns,
      reason: `Similar naming/purpose pattern to ${featureDescription}`
    }));
  }

  suggestImplementationLocation(featureDescription) {
    const feature = featureDescription.toLowerCase();
    
    if (feature.includes('component') || feature.includes('ui')) {
      return 'web/src/components/';
    }
    if (feature.includes('hook')) {
      return 'web/src/hooks/';
    }
    if (feature.includes('api')) {
      return 'lib/';
    }
    if (feature.includes('util')) {
      return 'web/src/utils/';
    }
    
    return 'web/src/';
  }

  identifyOrganizationalPatterns(files) {
    const patterns = {
      directoryBased: files.some(f => f.path.includes('components/') || f.path.includes('utils/')),
      featureBased: files.some(f => f.path.split('/').length > 3),
      flatStructure: files.every(f => f.path.split('/').length <= 2)
    };
    return patterns;
  }

  identifyCodingPatterns(chunks) {
    return {
      functionalComponents: chunks.filter(c => c.subtype === 'react_component').length,
      hooks: chunks.filter(c => c.name && c.name.startsWith('use')).length,
      asyncFunctions: chunks.filter(c => c.isAsync).length,
      exportedFunctions: chunks.filter(c => c.isExported).length
    };
  }

  identifyNamingPatterns(files) {
    const patterns = {
      camelCase: files.filter(f => /[a-z][A-Z]/.test(require('path').basename(f.path, require('path').extname(f.path)))).length,
      kebabCase: files.filter(f => /-/.test(require('path').basename(f.path, require('path').extname(f.path)))).length,
      pascalCase: files.filter(f => /^[A-Z]/.test(require('path').basename(f.path, require('path').extname(f.path)))).length
    };
    return patterns;
  }

  identifyStructuralPatterns(files) {
    return {
      hasTests: files.some(f => f.path.includes('test') || f.path.includes('spec')),
      hasConfig: files.some(f => f.path.includes('config') || f.path.endsWith('.config.js')),
      hasDocumentation: files.some(f => f.path.endsWith('.md')),
      hasTypeDefinitions: files.some(f => f.path.endsWith('.d.ts'))
    };
  }

  async getSemanticSummary() {
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 100 });
    return analysis.summary || { message: 'No semantic summary available' };
  }

  async analyzeFileTypes() {
    const files = await this.tools.listFiles({ limit: 500 });
    return this.categorizeFiles(files.map(f => f.path));
  }

  async analyzeComplexity() {
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 100 });
    if (!analysis.chunks) return { message: 'No complexity data available' };
    
    const complexity = { low: 0, medium: 0, high: 0 };
    analysis.chunks.forEach(chunk => {
      const level = chunk.complexity?.level || 'low';
      complexity[level]++;
    });
    
    return complexity;
  }

  async generateDiscoveryRecommendations(discovery) {
    const recommendations = [];
    
    if (discovery.bundles.length > 10) {
      recommendations.push({
        type: 'organization',
        message: 'Consider consolidating similar bundles for better organization'
      });
    }
    
    if (discovery.semanticSummary?.totalChunks > 100) {
      recommendations.push({
        type: 'performance',
        message: 'Large codebase detected - consider using bundle-scoped queries for better performance'
      });
    }
    
    return recommendations;
  }

  async analyzeDependencies(featureDescription) {
    // Simple dependency analysis based on imports in semantic chunks
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 50 });
    const allImports = new Set();
    
    if (analysis.chunks) {
      analysis.chunks.forEach(chunk => {
        if (chunk.includes?.imports) {
          chunk.includes.imports.forEach(imp => allImports.add(imp));
        }
      });
    }
    
    return Array.from(allImports);
  }

  async findIntegrationPoints(featureDescription) {
    const searchResults = await this.tools.searchSemanticChunks(featureDescription, { maxResults: 10 });
    
    return searchResults.chunks.map(chunk => ({
      file: chunk.filePath,
      function: chunk.name,
      reason: `Potential integration point based on ${chunk.purpose}`
    }));
  }

  async identifyImplementationPatterns(featureDescription) {
    const bundles = await this.analyzeBundles('all');
    const patterns = [];
    
    bundles.forEach(bundle => {
      if (this.isFeatureRelated(featureDescription, bundle.name, bundle.purpose)) {
        patterns.push({
          bundle: bundle.name,
          fileTypes: bundle.fileTypes,
          organizationPattern: bundle.patterns
        });
      }
    });
    
    return patterns;
  }

  async suggestImplementationApproach(investigation) {
    if (investigation.existing.found) {
      return {
        strategy: 'extend',
        description: 'Build upon existing implementation',
        files: investigation.existing.implementations.slice(0, 2).map(impl => impl.file)
      };
    }
    
    return {
      strategy: 'create',
      description: 'Create new implementation following project patterns',
      location: this.suggestImplementationLocation(investigation.feature)
    };
  }

  async analyzeDiscussionContext(userInput, context) {
    return {
      intent: this.classifyIntent(userInput),
      scope: context.scope || 'general',
      complexity: this.assessComplexity(userInput)
    };
  }

  async generateInsights(userInput) {
    return [
      'Consider the existing bundle organization when planning changes',
      'Use semantic search to find similar implementations',
      'Check for related patterns in the codebase before implementing'
    ];
  }

  async identifyConsiderations(userInput) {
    return [
      'Impact on existing bundles and organization',
      'Compatibility with current architecture patterns',
      'Testing strategy for new implementations'
    ];
  }

  async suggestAlternatives(userInput) {
    return [
      'Extend existing functionality instead of creating new',
      'Consider configuration-based approach for flexibility',
      'Evaluate third-party solutions before custom implementation'
    ];
  }

  async generateClarifyingQuestions(userInput) {
    return [
      'Which bundle or area of the codebase is most relevant?',
      'Are there existing implementations we should build upon?',
      'What are the specific requirements or constraints?'
    ];
  }

  classifyIntent(userInput) {
    const input = userInput.toLowerCase();
    if (input.includes('implement') || input.includes('add') || input.includes('create')) {
      return 'implementation';
    }
    if (input.includes('refactor') || input.includes('improve') || input.includes('optimize')) {
      return 'optimization';
    }
    if (input.includes('understand') || input.includes('explain') || input.includes('how')) {
      return 'understanding';
    }
    return 'discussion';
  }

  assessComplexity(userInput) {
    const words = userInput.split(' ').length;
    if (words > 20) return 'high';
    if (words > 10) return 'medium';
    return 'low';
  }

  // Project Organizer Mode Helper Methods

  async detectProjectState() {
    const bundles = await this.analyzeBundles('all');
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 10 });
    
    // Determine project maturity
    const state = {
      bundleCount: bundles.length,
      hasOnlyMaster: bundles.length === 1 && bundles[0].name === 'master',
      hasSemanticAnalysis: analysis && analysis.chunks && analysis.chunks.length > 0,
      totalFiles: bundles.reduce((sum, b) => sum + b.fileCount, 0),
      maturityLevel: 'unknown'
    };

    // Classify maturity
    if (state.hasOnlyMaster && !state.hasSemanticAnalysis) {
      state.maturityLevel = 'fresh'; // Brand new project
    } else if (state.hasOnlyMaster && state.hasSemanticAnalysis) {
      state.maturityLevel = 'analyzed'; // Ready for bundling
    } else if (state.bundleCount > 1 && state.bundleCount < 5) {
      state.maturityLevel = 'organized'; // Basic organization
    } else if (state.bundleCount >= 5) {
      state.maturityLevel = 'mature'; // Well-organized
    }

    return state;
  }

  suggestActivity(projectState) {
    switch (projectState.maturityLevel) {
      case 'fresh':
        return 'analyze'; // Need semantic analysis first
      case 'analyzed':
        return 'bundle'; // Ready to plan bundles
      case 'organized':
        return 'optimize'; // Can optimize existing organization
      case 'mature':
        return 'audit'; // Regular maintenance
      default:
        return 'detect';
    }
  }

  generateWorkflow(projectState) {
    const workflows = {
      fresh: [
        { step: 'analyze', description: 'Generate semantic analysis', required: true },
        { step: 'bundle', description: 'Plan intelligent bundles', required: true },
        { step: 'create', description: 'Create the planned bundles', required: true },
        { step: 'validate', description: 'Verify organization', required: false }
      ],
      analyzed: [
        { step: 'bundle', description: 'Plan intelligent bundles', required: true },
        { step: 'create', description: 'Create the planned bundles', required: true },
        { step: 'validate', description: 'Verify organization', required: false }
      ],
      organized: [
        { step: 'audit', description: 'Review current organization', required: false },
        { step: 'optimize', description: 'Improve bundle structure', required: false },
        { step: 'validate', description: 'Verify improvements', required: false }
      ],
      mature: [
        { step: 'audit', description: 'Regular maintenance check', required: false },
        { step: 'cleanup', description: 'Remove obsolete patterns', required: false }
      ]
    };

    return workflows[projectState.maturityLevel] || workflows.fresh;
  }

  async analyzeProjectMaturity() {
    const bundles = await this.analyzeBundles('all');
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 50 });
    
    return {
      bundles: {
        count: bundles.length,
        types: bundles.map(b => ({ name: b.name, purpose: b.purpose, files: b.fileCount })),
        coverage: this.calculateBundleCoverage(bundles)
      },
      codebase: {
        hasSemanticAnalysis: analysis && analysis.chunks && analysis.chunks.length > 0,
        chunkCount: analysis?.chunks?.length || 0,
        complexity: analysis?.summary?.complexity || this.assessDefaultComplexity(bundles)
      },
      recommendations: this.generateMaturityRecommendations(bundles, analysis)
    };
  }

  async generateSetupRecommendations(projectState) {
    const recommendations = [];

    if (projectState.maturityLevel === 'fresh') {
      recommendations.push({
        priority: 'high',
        action: 'Generate semantic analysis',
        reason: 'Required before intelligent bundle creation',
        command: 'Use activity "analyze" to generate code analysis'
      });
    }

    if (projectState.hasOnlyMaster) {
      recommendations.push({
        priority: 'high', 
        action: 'Create logical bundles',
        reason: 'Only master bundle exists - organize code by purpose',
        command: 'Use activity "bundle" after semantic analysis'
      });
    }

    if (projectState.totalFiles > 50) {
      recommendations.push({
        priority: 'medium',
        action: 'Consider bundle size limits',
        reason: 'Large codebase may benefit from smaller, focused bundles'
      });
    }

    return recommendations;
  }

  async performSemanticAnalysis() {
    try {
      // Trigger semantic analysis if not available
      const existingAnalysis = await this.tools.getSemanticAnalysis({ maxChunks: 10 });
      
      if (!existingAnalysis.chunks || existingAnalysis.chunks.length === 0) {
        // Need to trigger analysis - this would typically call the cntx server's analysis
        return {
          status: 'analysis_needed',
          message: 'Semantic analysis needs to be generated first',
          instruction: 'Run semantic analysis before bundling'
        };
      }

      return {
        status: 'ready',
        chunkCount: existingAnalysis.totalChunks,
        summary: existingAnalysis.summary,
        readyForBundling: true
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        readyForBundling: false
      };
    }
  }

  assessBundlingReadiness(semanticAnalysis) {
    if (semanticAnalysis.status === 'ready') {
      return {
        ready: true,
        confidence: 'high',
        reason: `${semanticAnalysis.chunkCount} semantic chunks available for intelligent bundling`
      };
    }

    return {
      ready: false,
      confidence: 'none',
      reason: semanticAnalysis.message || 'Semantic analysis required'
    };
  }

  async generateIntelligentBundles() {
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 100 });
    
    if (!analysis.chunks) {
      return {
        status: 'error',
        message: 'Semantic analysis required before bundle generation'
      };
    }

    const suggestions = {
      recommended: {},
      reasoning: [],
      stats: {
        totalChunks: analysis.chunks.length,
        totalFiles: new Set(analysis.chunks.map(c => c.filePath)).size
      }
    };

    // Group by semantic purpose
    const purposeGroups = this.groupChunksByPurpose(analysis.chunks);
    
    Object.entries(purposeGroups).forEach(([purpose, chunks]) => {
      if (chunks.length >= 3) { // Only suggest if substantial
        const bundleName = this.purposeToBundleName(purpose);
        const patterns = this.generatePatternsForChunks(chunks);
        
        suggestions.recommended[bundleName] = {
          patterns,
          chunkCount: chunks.length,
          files: [...new Set(chunks.map(c => c.filePath))],
          purpose: purpose
        };

        suggestions.reasoning.push({
          bundle: bundleName,
          reason: `${chunks.length} functions with purpose: ${purpose}`,
          confidence: chunks.length > 5 ? 'high' : 'medium'
        });
      }
    });

    // Add standard bundles
    this.addStandardBundles(suggestions, analysis.chunks);

    return suggestions;
  }

  async previewBundleChanges(bundleSuggestions) {
    const currentBundles = await this.analyzeBundles('all');
    
    return {
      current: {
        count: currentBundles.length,
        bundles: currentBundles.map(b => ({ name: b.name, files: b.fileCount }))
      },
      proposed: {
        count: Object.keys(bundleSuggestions.recommended).length,
        bundles: Object.entries(bundleSuggestions.recommended).map(([name, bundle]) => ({
          name,
          files: bundle.files.length,
          purpose: bundle.purpose
        }))
      },
      impact: {
        filesReorganized: bundleSuggestions.stats?.totalFiles || 0,
        newBundles: Object.keys(bundleSuggestions.recommended).length,
        recommendation: 'Review and approve bundle organization before applying'
      }
    };
  }

  async createSuggestedBundles(bundleSuggestions) {
    if (!bundleSuggestions || !bundleSuggestions.recommended) {
      return {
        status: 'error',
        message: 'No bundle suggestions available'
      };
    }

    const results = {
      status: 'success',
      created: [],
      failed: [],
      total: Object.keys(bundleSuggestions.recommended).length
    };

    // Create each suggested bundle
    for (const [bundleName, bundleConfig] of Object.entries(bundleSuggestions.recommended)) {
      try {
        // Use the agent tools to create bundle via MCP
        const createResult = await this.createBundleViaMCP(bundleName, bundleConfig.patterns, bundleConfig.purpose);
        
        if (createResult.success) {
          results.created.push({
            name: bundleName,
            patterns: bundleConfig.patterns,
            files: bundleConfig.files?.length || 0,
            purpose: bundleConfig.purpose
          });
        } else {
          results.failed.push({
            name: bundleName,
            error: createResult.error || 'Unknown error'
          });
        }
      } catch (error) {
        results.failed.push({
          name: bundleName,
          error: error.message
        });
      }
    }

    // Update status based on results
    if (results.failed.length > 0) {
      results.status = results.created.length > 0 ? 'partial' : 'failed';
    }

    results.summary = `Created ${results.created.length}/${results.total} bundles successfully`;
    
    if (results.failed.length > 0) {
      results.summary += `. Failed to create ${results.failed.length} bundles.`;
    }

    return results;
  }

  async createBundleViaMCP(name, patterns, description) {
    try {
      // Check if bundle already exists
      const existingBundles = await this.analyzeBundles('all');
      if (existingBundles.some(b => b.name === name)) {
        return {
          success: false,
          error: `Bundle '${name}' already exists`
        };
      }

      // Don't allow creating or overwriting master bundle
      if (name === 'master') {
        return {
          success: false,
          error: 'Cannot create or overwrite master bundle'
        };
      }

      // Use the existing bundle creation functionality through the server
      // Create bundle in bundle-states.json (single source of truth)
      this.cntxServer.configManager.bundleStates.set(name, {
        patterns: patterns,
        files: [],
        content: '',
        changed: false,
        size: 0,
        generated: null
      });

      // Save bundle states
      this.cntxServer.configManager.saveBundleStates();

      // Regenerate bundles
      this.cntxServer.generateAllBundles();

      return {
        success: true,
        bundle: {
          name,
          patterns,
          description,
          created: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeOptimizationOpportunities() {
    const bundles = await this.analyzeBundles('all');
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 50 });
    
    const opportunities = [];

    // Check for oversized bundles
    bundles.forEach(bundle => {
      if (bundle.fileCount > 50) {
        opportunities.push({
          type: 'split',
          bundle: bundle.name,
          issue: `Large bundle with ${bundle.fileCount} files`,
          suggestion: 'Consider splitting by functionality'
        });
      }
    });

    // Check for undersized bundles
    bundles.forEach(bundle => {
      if (bundle.fileCount < 3 && bundle.name !== 'master') {
        opportunities.push({
          type: 'merge',
          bundle: bundle.name,
          issue: `Small bundle with only ${bundle.fileCount} files`,
          suggestion: 'Consider merging with related bundle'
        });
      }
    });

    // Check for misaligned purposes
    if (analysis.chunks) {
      const misaligned = this.findMisalignedFiles(bundles, analysis.chunks);
      misaligned.forEach(item => {
        opportunities.push({
          type: 'realign',
          file: item.file,
          issue: `File purpose '${item.purpose}' doesn't match bundle '${item.currentBundle}'`,
          suggestion: `Consider moving to '${item.suggestedBundle}' bundle`
        });
      });
    }

    return opportunities;
  }

  async generateOptimizationPlan() {
    const opportunities = await this.analyzeOptimizationOpportunities();
    
    const plan = {
      priority_1: opportunities.filter(o => o.type === 'split'),
      priority_2: opportunities.filter(o => o.type === 'realign'),
      priority_3: opportunities.filter(o => o.type === 'merge'),
      summary: `Found ${opportunities.length} optimization opportunities`
    };

    return plan;
  }

  async auditCurrentOrganization() {
    const bundles = await this.analyzeBundles('all');
    const analysis = await this.tools.getSemanticAnalysis({ maxChunks: 50 });
    
    return {
      bundleHealth: this.assessBundleHealth(bundles),
      coverage: this.calculateBundleCoverage(bundles),
      alignment: this.assessSemanticAlignment(bundles, analysis),
      recommendations: this.generateAuditRecommendations(bundles, analysis)
    };
  }

  async identifyOrganizationalIssues() {
    const bundles = await this.analyzeBundles('all');
    const issues = [];

    // Check for naming inconsistencies
    const namingPatterns = this.analyzeNamingPatterns(bundles);
    if (namingPatterns.inconsistent) {
      issues.push({
        type: 'naming',
        severity: 'medium',
        description: 'Inconsistent bundle naming patterns detected'
      });
    }

    // Check for duplicate patterns
    const duplicates = this.findDuplicatePatterns(bundles);
    duplicates.forEach(dup => {
      issues.push({
        type: 'duplication',
        severity: 'high',
        description: `Pattern '${dup.pattern}' used in multiple bundles: ${dup.bundles.join(', ')}`
      });
    });

    return issues;
  }

  generateNextSteps(organization, currentActivity) {
    const state = organization.projectState;
    const steps = [];

    switch (currentActivity) {
      case 'detect':
        if (state.maturityLevel === 'fresh') {
          steps.push('Run activity "analyze" to generate semantic analysis');
        } else if (state.maturityLevel === 'analyzed') {
          steps.push('Run activity "bundle" to create intelligent bundles');
        }
        break;

      case 'analyze':
        if (organization.semanticAnalysis?.readyForBundling) {
          steps.push('Run activity "bundle" to create logical bundle organization');
        }
        break;

      case 'bundle':
        if (organization.bundleSuggestions?.recommended) {
          steps.push('Review suggested bundles and run activity "create" to implement them');
          steps.push('After creation, run activity "validate" to verify organization');
        }
        break;

      case 'create':
        if (organization.creation?.status === 'success') {
          steps.push('Bundle creation completed successfully! Run activity "validate" to verify organization');
        } else if (organization.creation?.failed?.length > 0) {
          steps.push('Some bundles failed to create. Review errors and retry if needed');
        }
        break;

      case 'optimize':
        if (organization.optimizations?.length > 0) {
          steps.push('Review optimization opportunities and implement highest priority items');
        }
        break;
    }

    if (steps.length === 0) {
      steps.push('Project organization is up to date - consider periodic audits');
    }

    return steps;
  }

  // Additional helper methods

  purposeToBundleName(purpose) {
    const purposeMap = {
      'React component': 'ui-components',
      'API endpoint': 'api-endpoints', 
      'Utility function': 'utilities',
      'Configuration': 'configuration',
      'Type definition': 'types',
      'Test': 'tests'
    };
    
    return purposeMap[purpose] || purpose.toLowerCase().replace(/\s+/g, '-');
  }

  addStandardBundles(suggestions, chunks) {
    // Add configuration bundle
    suggestions.recommended.configuration = {
      patterns: ['*.config.*', 'package.json', 'tsconfig*.json', '.env*'],
      chunkCount: 0,
      files: [],
      purpose: 'Build and environment configuration'
    };

    // Add tests bundle if test files exist
    const testFiles = chunks.filter(c => c.filePath && (c.filePath.includes('test') || c.filePath.includes('spec')));
    if (testFiles.length > 0) {
      suggestions.recommended.tests = {
        patterns: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
        chunkCount: testFiles.length,
        files: testFiles.map(c => c.filePath),
        purpose: 'Test files and test utilities'
      };
    }
  }

  calculateBundleCoverage(bundles) {
    const totalFiles = bundles.reduce((sum, b) => sum + b.fileCount, 0);
    const masterBundle = bundles.find(b => b.name === 'master');
    
    if (masterBundle && bundles.length === 1) {
      return { coverage: 100, organized: false, recommendation: 'Create specific bundles for better organization' };
    }
    
    return { coverage: 100, organized: true, recommendation: 'Bundle organization looks good' };
  }

  assessBundleHealth(bundles) {
    const health = {
      score: 0,
      issues: [],
      strengths: []
    };

    // Check bundle count
    if (bundles.length === 1) {
      health.issues.push('Only master bundle - needs organization');
      health.score += 20;
    } else if (bundles.length > 1 && bundles.length <= 8) {
      health.strengths.push('Good bundle organization');
      health.score += 80;
    } else {
      health.issues.push('Too many bundles - consider consolidation');
      health.score += 60;
    }

    return health;
  }

  assessDefaultComplexity(bundles) {
    const totalFiles = bundles.reduce((sum, b) => sum + b.fileCount, 0);
    
    if (totalFiles < 20) return { level: 'low', score: 1 };
    if (totalFiles < 100) return { level: 'medium', score: 2 };
    return { level: 'high', score: 3 };
  }

  generateMaturityRecommendations(bundles, analysis) {
    const recommendations = [];
    
    if (bundles.length === 1) {
      recommendations.push('Create semantic bundles for better code organization');
    }
    
    if (!analysis || !analysis.chunks) {
      recommendations.push('Generate semantic analysis for intelligent bundling');
    }

    return recommendations;
  }

  findMisalignedFiles(bundles, chunks) {
    // Simplified implementation - would need more sophisticated logic
    return [];
  }

  analyzeNamingPatterns(bundles) {
    const patterns = bundles.map(b => b.name);
    const hasConsistentNaming = patterns.every(name => 
      name.includes('-') || name.toLowerCase() === name
    );
    
    return { inconsistent: !hasConsistentNaming };
  }

  findDuplicatePatterns(bundles) {
    const patternMap = new Map();
    
    bundles.forEach(bundle => {
      bundle.patterns.forEach(pattern => {
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, []);
        }
        patternMap.get(pattern).push(bundle.name);
      });
    });

    return Array.from(patternMap.entries())
      .filter(([pattern, bundleNames]) => bundleNames.length > 1)
      .map(([pattern, bundleNames]) => ({ pattern, bundles: bundleNames }));
  }

  async suggestCleanupActions() {
    return [
      { action: 'Remove unused bundle patterns', impact: 'low', effort: 'low' },
      { action: 'Consolidate similar bundles', impact: 'medium', effort: 'medium' }
    ];
  }

  async assessCleanupImpact() {
    return {
      estimatedTimeReduction: '10-15%',
      maintainabilityImprovement: 'medium',
      riskLevel: 'low'
    };
  }

  async validateCurrentOrganization() {
    const bundles = await this.analyzeBundles('all');
    return {
      valid: bundles.length > 1,
      score: bundles.length === 1 ? 30 : 85,
      issues: bundles.length === 1 ? ['Only master bundle exists'] : []
    };
  }

  async calculateOrganizationHealth() {
    const bundles = await this.analyzeBundles('all');
    const health = this.assessBundleHealth(bundles);
    
    return {
      overall: health.score > 70 ? 'good' : health.score > 40 ? 'fair' : 'poor',
      score: health.score,
      recommendations: health.issues
    };
  }

  assessSemanticAlignment(bundles, analysis) {
    // Simplified - would analyze if files are in semantically appropriate bundles
    return {
      aligned: bundles.length > 1,
      score: bundles.length > 1 ? 80 : 30
    };
  }

  generateAuditRecommendations(bundles, analysis) {
    const recommendations = [];
    
    if (bundles.length === 1) {
      recommendations.push('Create semantic bundles for better organization');
    }

    return recommendations;
  }
}

export default AgentRuntime;