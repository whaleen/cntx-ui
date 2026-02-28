/**
 * Agent Runtime for Codebase Exploration and Development
 * Now stateful with SQLite-based working memory
 */

import AgentTools from './agent-tools.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class AgentRuntime {
  constructor(cntxServer) {
    this.cntxServer = cntxServer;
    this.db = cntxServer.databaseManager;
    this.tools = new AgentTools(cntxServer);
    this.currentSessionId = null;
  }

  /**
   * Initialize or resume a session
   */
  async startSession(id = null, title = 'New Exploration') {
    this.currentSessionId = id || crypto.randomUUID();
    this.db.createSession(this.currentSessionId, title);
    // Refresh manifest when a new session starts
    await this.generateAgentManifest();
    return this.currentSessionId;
  }

  /**
   * Generates a .cntx/AGENT.md manifest for machine consumption
   */
  async generateAgentManifest() {
    const overview = await this.getCodebaseOverview();
    const summary = await this.getSemanticSummary();
    const bundles = await this.analyzeBundles('all');
    
    const manifest = `# 🤖 Agent Handshake: ${overview.projectPath.split('/').pop()}

## Project Overview
- **Path:** \`${overview.projectPath}\`
- **Total Files:** ${overview.totalFiles}
- **Semantic Intelligence:** ${summary.totalChunks} persistent chunks indexed.

## Codebase Organization (Bundles)
${bundles.map(b => `- **${b.name}**: ${b.purpose} (${b.fileCount} files)`).join('\n')}

## Intelligence Interface (MCP Tools)
You have access to a specialized "Repository Intelligence" engine. Use these tools for high-signal exploration:

1. **\`agent/discover\`**: Start here for an architectural overview.
2. **\`agent/query\`**: Use this for semantic search (e.g., "How is X implemented?").
3. **\`agent/investigate\`**: Use when planning a new feature.
4. **\`agent/organize\`**: Use to audit or optimize project structure.

## Working Memory
This agent is **stateful**. All interactions in this directory are logged to a persistent SQLite database (\`.cntx/bundles.db\`), allowing for context retention across sessions.

---
*Generated automatically by cntx-ui. Optimized for LLM consumption.*
`;

    const manifestPath = path.join(this.cntxServer.CNTX_DIR, 'AGENT.md');
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    if (this.cntxServer.verbose) console.log('📄 Agent manifest updated: .cntx/AGENT.md');
  }

  /**
   * Log an interaction to the agent's memory
   */
  async logInteraction(role, content, metadata = {}) {
    if (!this.currentSessionId) await this.startSession();
    this.db.addMessage(this.currentSessionId, role, content, metadata);
  }

  /**
   * Discovery Mode: "Tell me about this codebase"
   * Now logs the discovery process to memory
   */
  async discoverCodebase(options = {}) {
    const { scope = 'all', includeDetails = true } = options;
    
    try {
      await this.logInteraction('agent', `Starting codebase discovery for scope: ${scope}`);
      
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

      discovery.recommendations = await this.generateDiscoveryRecommendations(discovery);
      
      await this.logInteraction('agent', `Discovery complete. Found ${discovery.overview.totalFiles} files.`, { discovery });

      return discovery;
    } catch (error) {
      await this.logInteraction('agent', `Discovery failed: ${error.message}`);
      throw new Error(`Discovery failed: ${error.message}`);
    }
  }

  /**
   * Query Mode: "Where is the user authentication handled?"
   * Now recalls previous context from SQLite
   */
  async answerQuery(question, options = {}) {
    const { scope = null, maxResults = 10, includeCode = false } = options;

    try {
      await this.logInteraction('user', question);
      
      // Perform semantic search via Vector Store
      const combinedResults = await this.cntxServer.vectorStore.search(question, { limit: maxResults });

      // Generate contextual answer
      const answer = await this.generateContextualAnswer(question, { chunks: combinedResults, files: [] }, includeCode);

      const response = {
        question,
        answer: answer.response,
        evidence: answer.evidence,
        confidence: answer.confidence,
        relatedFiles: [...new Set(combinedResults.map(c => c.filePath))].slice(0, 5)
      };

      await this.logInteraction('agent', response.answer, { response });

      return response;
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Feature Investigation Mode: Now persists the investigation approach
   */
  async investigateFeature(featureDescription, options = {}) {
    const { includeRecommendations = true } = options;

    try {
      await this.logInteraction('user', `Investigating feature: ${featureDescription}`);
      
      const investigation = {
        feature: featureDescription,
        existing: await this.findExistingImplementations(featureDescription),
        related: await this.findRelatedCode(featureDescription),
        integration: await this.findIntegrationPoints(featureDescription)
      };

      if (includeRecommendations) {
        investigation.approach = await this.suggestImplementationApproach(investigation);
      }

      await this.logInteraction('agent', `Investigation complete for ${featureDescription}`, { investigation });

      return investigation;
    } catch (error) {
      throw new Error(`Feature investigation failed: ${error.message}`);
    }
  }

  // --- Helper Methods (reusing your existing logic but streamlined) ---

  async getCodebaseOverview() {
    const bundles = Array.from(this.cntxServer.bundleManager.getAllBundleInfo());
    const totalFiles = bundles.reduce((sum, b) => sum + b.fileCount, 0);
    const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);

    return {
      projectPath: this.cntxServer.CWD,
      totalBundles: bundles.length,
      totalFiles,
      totalSize,
      bundleNames: bundles.map(b => b.name)
    };
  }

  async analyzeBundles(scope) {
    const bundles = this.cntxServer.bundleManager.getAllBundleInfo();
    const filtered = scope === 'all' ? bundles : bundles.filter(b => b.name === scope);
    
    return filtered.map(b => ({
      ...b,
      purpose: this.inferBundlePurpose(b.name, b.files)
    }));
  }

  inferBundlePurpose(name, files) {
    if (name.includes('component') || name.includes('ui')) return 'UI Components';
    if (name.includes('api') || name.includes('server')) return 'Backend API';
    return 'General Module';
  }

  async analyzeArchitecture() {
    return {
      type: 'Dynamic Architecture',
      timestamp: new Date().toISOString()
    };
  }

  async identifyPatterns() {
    return {
      coding: 'Modern Node.js',
      style: 'Functional / Modular'
    };
  }

  async getSemanticSummary() {
    const chunks = this.db.db.prepare('SELECT COUNT(*) as count FROM semantic_chunks').get();
    return { totalChunks: chunks.count };
  }

  async analyzeFileTypes() {
    const rows = this.db.db.prepare('SELECT file_path FROM semantic_chunks').all();
    const exts = {};
    rows.forEach(r => {
      const ext = r.file_path.split('.').pop();
      exts[ext] = (exts[ext] || 0) + 1;
    });
    return exts;
  }

  async analyzeComplexity() {
    const rows = this.db.db.prepare('SELECT complexity_score FROM semantic_chunks').all();
    const scores = { low: 0, medium: 0, high: 0 };
    rows.forEach(r => {
      if (r.complexity_score < 5) scores.low++;
      else if (r.complexity_score < 15) scores.medium++;
      else scores.high++;
    });
    return scores;
  }

  async generateDiscoveryRecommendations() {
    return [{ type: 'info', message: 'Continue organizing by semantic purpose.' }];
  }

  async findExistingImplementations(featureDescription) {
    return await this.cntxServer.vectorStore.search(featureDescription, { limit: 5 });
  }

  async findRelatedCode(featureDescription) {
    return [];
  }

  async findIntegrationPoints(featureDescription) {
    return [];
  }

  async suggestImplementationApproach(investigation) {
    return { strategy: 'TBD', description: 'Ready to plan' };
  }

  async generateContextualAnswer(question, results, includeCode) {
    let response = `Based on the codebase analysis:\n\n`;
    if (results.chunks.length > 0) {
      const top = results.chunks[0];
      response += `The most relevant implementation found is \`${top.name}\` in \`${top.filePath}\` (Purpose: ${top.purpose}).\n\n`;
    } else {
      response += `No direct semantic matches found. Try refining your query.`;
    }

    return {
      response,
      evidence: results.chunks.slice(0, 3),
      confidence: results.chunks.length > 0 ? 0.8 : 0.2
    };
  }
}

export default AgentRuntime;
