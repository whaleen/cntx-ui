/**
 * Agent Runtime for Codebase Exploration and Development
 * Now stateful with SQLite-based working memory
 */

import AgentTools from './agent-tools.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CntxServer } from '../server.js';
import DatabaseManager from './database-manager.js';

export interface DiscoveryOptions {
  scope?: string;
  includeDetails?: boolean;
  verbose?: boolean;
}

export interface QueryOptions {
  scope?: string | null;
  maxResults?: number;
  includeCode?: boolean;
  query?: string;
}

export class AgentRuntime {
  cntxServer: CntxServer;
  db: DatabaseManager;
  tools: AgentTools;
  currentSessionId: string | null;

  constructor(cntxServer: CntxServer) {
    this.cntxServer = cntxServer;
    this.db = cntxServer.databaseManager;
    this.tools = new AgentTools(cntxServer);
    this.currentSessionId = null;
  }

  /**
   * Initialize or resume a session
   */
  async startSession(id: string | null = null, title = 'New Exploration'): Promise<string> {
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
    
    // Auto-generate tool reference from MCP server
    let toolsReference = '';
    if (this.cntxServer.mcpServer) {
      const tools = (this.cntxServer.mcpServer as any).getToolDefinitions();
      toolsReference = (tools as any[])
        .filter(t => !t.name?.includes('activities'))
        .map(t => {
        let params: string[] = [];
        if (t.inputSchema?.properties) {
          params = Object.entries(t.inputSchema.properties).map(([name, prop]: [string, any]) => {
            const isReq = t.inputSchema.required?.includes(name) ? 'required' : 'optional';
            return `\`${name}\` (${prop.type}, ${isReq}): ${prop.description}`;
          });
        }
        return `### \`${t.name}\`\n${t.description}\n${params.length > 0 ? '**Parameters:**\n- ' + params.join('\n- ') : '*No parameters required*'}\n`;
      }).join('\n');
    }

    // Find TOOLS.md template
    let toolsMdPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../templates/TOOLS.md');
    if (!fs.existsSync(toolsMdPath)) {
      // Fallback for dist/lib/ context
      toolsMdPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates/TOOLS.md');
    }

    const manifest = `# 🤖 Agent Handshake: ${overview.projectPath.split('/').pop()}

## Project Overview
- **Path:** \`${overview.projectPath}\`
- **Total Files:** ${overview.totalFiles}
- **Semantic Intelligence:** ${summary.totalChunks} persistent chunks indexed.

## Codebase Organization (Bundles)
${bundles.map(b => `- **${b.name}**: ${b.purpose} (${b.fileCount} files)`).join('\n')}

## Intelligence Interface (MCP Tools)
You have access to a specialized "Repository Intelligence" engine. Use these tools for high-signal exploration:

${toolsReference || '*(MCP Server not yet initialized, tools will appear here)*'}

---

## 🛠 Complete Tool & API Reference
Refer to the dynamic reference below for full parameter schemas and HTTP fallback endpoints.

${fs.existsSync(toolsMdPath) ? fs.readFileSync(toolsMdPath, 'utf8') : '*(Tools documentation missing)*'}

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
  async logInteraction(role: string, content: string, metadata: any = {}) {
    if (!this.currentSessionId) await this.startSession();
    this.db.addMessage(this.currentSessionId!, role, content, metadata);
  }

  /**
   * Discovery Mode: "Tell me about this codebase"
   * Now logs the discovery process to memory
   */
  async discoverCodebase(options: DiscoveryOptions = {}) {
    const { scope = 'all', includeDetails = true, verbose = false } = options;
    
    try {
      await this.logInteraction('agent', `Starting codebase discovery for scope: ${scope}`);
      
      const discovery: any = {
        overview: await this.getCodebaseOverview(),
        bundles: await this.analyzeBundles(scope, verbose),
        architecture: await this.analyzeArchitecture(),
        patterns: await this.identifyPatterns(),
        recommendations: []
      };

      if (includeDetails) {
        discovery.semanticSummary = await this.getSemanticSummary();
        discovery.fileTypes = await this.analyzeFileTypes();
        discovery.complexity = await this.analyzeComplexity();
      }

      discovery.recommendations = await this.generateDiscoveryRecommendations();
      
      await this.logInteraction('agent', `Discovery complete. Found ${discovery.overview.totalFiles} files.`, { discovery });

      return discovery;
    } catch (error: any) {
      await this.logInteraction('agent', `Discovery failed: ${error.message}`);
      throw new Error(`Discovery failed: ${error.message}`);
    }
  }

  /**
   * Query Mode: "Where is the user authentication handled?"
   * Now recalls previous context from SQLite
   */
  async answerQuery(question: string, options: QueryOptions = {}) {
    const { maxResults = 10, includeCode = false, query } = options;
    const actualQuestion = question || query;

    if (!actualQuestion) {
      throw new Error('Missing question or query for search.');
    }

    try {
      await this.logInteraction('user', actualQuestion);
      
      // Perform semantic search via Vector Store
      let combinedResults = await this.cntxServer.vectorStore.search(actualQuestion, { limit: maxResults });

      // Heuristic fallback for common onboarding questions if results are poor
      const lowConfidence = combinedResults.length === 0 || combinedResults[0].similarity < 0.6;
      const isEntryQuery = /entry|start|main|index|run/i.test(actualQuestion);
      const isModelQuery = /model|schema|data|db|database/i.test(actualQuestion);

      let fallbackFiles: string[] = [];
      if (lowConfidence && (isEntryQuery || isModelQuery)) {
        const allFiles = this.cntxServer.fileSystemManager.getAllFiles();
        if (isEntryQuery) {
          // Look for common entry points like main.tsx, main.rs, App.tsx, etc.
          const entryPatterns = [/main\./i, /index\./i, /app\./i, /router\./i, /server\./i];
          entryPatterns.forEach(pattern => {
            fallbackFiles.push(...allFiles.filter(f => pattern.test(f)).slice(0, 3));
          });
        }
        if (isModelQuery) {
          const modelPatterns = [/model/i, /schema/i, /db/i, /database/i, /entity/i];
          modelPatterns.forEach(pattern => {
            fallbackFiles.push(...allFiles.filter(f => pattern.test(f)).slice(0, 3));
          });
        }
        fallbackFiles = [...new Set(fallbackFiles)].slice(0, 8);
      }

      // Generate contextual answer
      const answer = await this.generateContextualAnswer(question, { 
        chunks: combinedResults, 
        files: fallbackFiles 
      }, includeCode);

      // If no semantic results but we found fallbacks, improve the answer
      if (combinedResults.length === 0 && fallbackFiles.length > 0) {
        answer.response = `I couldn't find exact semantic matches, but based on common project structures, these files look relevant: ${fallbackFiles.join(', ')}`;
        answer.confidence = 0.4;
      }

      const response = {
        question,
        answer: answer.response,
        evidence: answer.evidence,
        confidence: answer.confidence,
        relatedFiles: [...new Set([
          ...combinedResults.map(c => c.filePath),
          ...fallbackFiles
        ])].slice(0, 8)
      };

      await this.logInteraction('agent', response.answer, { response });

      return response;
    } catch (error: any) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Feature Investigation Mode: Now persists the investigation approach
   */
  async investigateFeature(featureDescription: string, options: any = {}) {
    const { includeRecommendations = true, feature, description, area } = options;
    const actualDescription = featureDescription || feature || description || area;

    if (!actualDescription) {
      throw new Error('Missing feature description for investigation.');
    }

    try {
      await this.logInteraction('user', `Investigating feature: ${actualDescription}`);
      
      const investigation: any = {
        feature: actualDescription,
        existing: await this.findExistingImplementations(actualDescription),
        related: await this.findRelatedCode(actualDescription),
        integration: await this.findIntegrationPoints(actualDescription)
      };

      if (includeRecommendations) {
        investigation.approach = await this.suggestImplementationApproach(investigation);
      }

      await this.logInteraction('agent', `Investigation complete for ${featureDescription}`, { investigation });

      return investigation;
    } catch (error: any) {
      throw new Error(`Feature investigation failed: ${error.message}`);
    }
  }

  // --- Helper Methods ---

  async getCodebaseOverview() {
    const bundles = Array.from(this.cntxServer.bundleManager.getAllBundleInfo());
    const totalFiles = this.cntxServer.fileSystemManager.getAllFiles().length;
    const masterBundle = bundles.find(b => b.name === 'master');
    const totalSize = masterBundle ? masterBundle.size : bundles.reduce((sum, b) => sum + b.size, 0);

    return {
      projectPath: this.cntxServer.CWD,
      totalBundles: bundles.length,
      totalFiles,
      totalSize,
      bundleNames: bundles.map(b => b.name)
    };
  }

  async analyzeBundles(scope: string, verbose: boolean = false) {
    const bundles = this.cntxServer.bundleManager.getAllBundleInfo();
    const filtered = scope === 'all' ? bundles : bundles.filter(b => b.name === scope);
    
    return filtered.map(b => {
      const files = b.files || [];
      const purpose = this.inferBundlePurpose(b.name, files);
      
      // Implement compact mode: only show top 5 files if not verbose
      let displayFiles = files;
      if (!verbose && files.length > 5) {
        // Pick high-signal files: main, index, App, or just the first few
        const keyFiles = files.filter(f => /main|index|app|router|api|models/i.test(f));
        displayFiles = [...new Set([...keyFiles, ...files])].slice(0, 5);
      }

      return {
        ...b,
        purpose,
        files: displayFiles,
        totalFiles: files.length,
        isTruncated: !verbose && files.length > 5
      };
    });
  }

  inferBundlePurpose(name: string, files: string[]) {
    const n = name.toLowerCase();
    if (n === 'master') return 'Full Project Index (Source of Truth)';
    if (n.startsWith('smart:')) return 'Auto-grouped Code Structures (' + n.split('-').pop() + ')';
    if (n.includes('component') || n.includes('ui') || n.includes('view') || n.includes('screen')) return 'UI Components & Views';
    if (n.includes('api') || n.includes('server') || n.includes('backend') || n.includes('netlify')) return 'Backend API & Functions';
    if (n.includes('hook')) return 'React Hooks';
    if (n.includes('util') || n.includes('helper')) return 'Utility functions';
    if (n.includes('lib') || n.includes('service') || n.includes('store')) return 'Business logic & services';
    if (n.includes('database') || n.includes('db') || n.includes('model') || n.includes('schema')) return 'Data models & DB';
    if (n.includes('test') || n.includes('spec')) return 'Test suite';
    if (n.includes('doc') || n.includes('readme')) return 'Documentation';
    if (n.includes('script') || n.includes('bin')) return 'Scripts & CLI';
    if (n.includes('asset') || n.includes('public')) return 'Assets & static files';
    if (n.includes('style') || n.includes('css')) return 'Styles';
    
    // Fallback to file extension analysis if name is generic
    if (files.some(f => f.endsWith('.rs'))) return 'Rust Source';
    if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) return 'TypeScript Source';
    
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
    const chunks = this.db.db.prepare('SELECT COUNT(*) as count FROM semantic_chunks').get() as { count: number };
    return { totalChunks: chunks.count };
  }

  async analyzeFileTypes() {
    const rows = this.db.db.prepare('SELECT file_path FROM semantic_chunks').all() as { file_path: string }[];
    const exts: Record<string, number> = {};
    rows.forEach(r => {
      const ext = r.file_path.split('.').pop() || 'unknown';
      exts[ext] = (exts[ext] || 0) + 1;
    });
    return exts;
  }

  async analyzeComplexity() {
    const rows = this.db.db.prepare('SELECT complexity_score FROM semantic_chunks').all() as { complexity_score: number }[];
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

  async findExistingImplementations(featureDescription: string) {
    const results = await this.cntxServer.vectorStore.search(featureDescription, { limit: 5 });
    return results.map(r => ({
      file: r.filePath,
      name: r.name,
      purpose: r.purpose,
      relevance: r.similarity
    }));
  }

  async findRelatedCode(featureDescription: string) {
    // Search for keywords in the description
    const keywords = featureDescription.split(' ').filter(w => w.length > 4);
    const allFiles = this.cntxServer.fileSystemManager.getAllFiles();
    
    const matches = allFiles.filter(f => 
      keywords.some(k => f.toLowerCase().includes(k.toLowerCase()))
    ).slice(0, 5);

    return matches.map(f => ({
      file: f,
      reason: 'Filename contains relevant keywords'
    }));
  }

  async findIntegrationPoints(featureDescription: string) {
    const existing = await this.findExistingImplementations(featureDescription);
    const related = await this.findRelatedCode(featureDescription);
    
    const candidates = [...new Set([
      ...existing.map(e => e.file),
      ...related.map(r => r.file)
    ])];

    return candidates.map(f => {
      const ext = path.extname(f);
      let role = 'Likely touch point';
      if (ext === '.rs') role = 'Backend logic (Rust)';
      if (ext === '.tsx') role = 'UI/Frontend component';
      if (f.includes('router') || f.includes('api')) role = 'API/Routing';
      if (f.includes('store') || f.includes('hook')) role = 'State/Data management';
      
      return { file: f, role };
    });
  }

  async suggestImplementationApproach(investigation: any) {
    const points = investigation.integration || [];
    if (points.length === 0) {
      return { 
        strategy: 'Exploratory Search', 
        description: 'No clear integration points found. Recommendation: Perform a broader semantic search for core business entities.' 
      };
    }

    const primaryFile = points[0].file;
    return {
      strategy: `Extend ${primaryFile}`,
      description: `Based on the feature description, the primary integration point seems to be ${primaryFile}. You should examine this file and its dependencies to determine the exact insertion point.`,
      steps: [
        `1. Analyze ${primaryFile} for existing patterns.`,
        `2. Check related files: ${points.slice(1, 3).map((p: any) => p.file).join(', ')}`,
        `3. Implement the feature following the established coding style.`
      ]
    };
  }

  async generateContextualAnswer(question: string, results: any, includeCode: boolean) {
    let response = `Based on the codebase analysis:\n\n`;
    const hasSemantic = results.chunks.length > 0;
    const hasFallbacks = results.files && results.files.length > 0;

    if (hasSemantic) {
      const top = results.chunks[0];
      response += `The most relevant implementation found is \`${top.name}\` in \`${top.filePath}\` (Purpose: ${top.purpose}).\n\n`;
    } else if (hasFallbacks) {
      response += `I couldn't find an exact semantic match for your query, but these files look like strong candidates for the entry point or data model:\n\n`;
      results.files.forEach((f: string) => {
        response += `- \`${f}\`\n`;
      });
      response += `\nYou should start by examining these files.`;
    } else {
      response += `No direct semantic matches found. Try refining your query.`;
    }

    return {
      response,
      evidence: results.chunks.slice(0, 3),
      confidence: hasSemantic ? 0.8 : (hasFallbacks ? 0.4 : 0.2)
    };
  }
}

export default AgentRuntime;
