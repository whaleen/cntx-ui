# 🤖 Agent Specification for Codebase Exploration and Development

## Overview

This specification outlines a simplified agent architecture for codebase exploration and development, integrated with the existing cntx-ui infrastructure. The agent leverages existing semantic chunking, vector search, and MCP server capabilities without complex memory management.

---

## 🧱 1. System Components

### 1.1 Codebase Integration

- **Target**: TypeScript-based applications (current cntx-ui focus)
- **Location**: Local repositories managed by cntx-ui
- **Foundation**: Built on existing cntx-ui semantic analysis and vector search
- **Bundle-Aware**: Leverages existing bundle system for scoped exploration

---

## 🛠️ 2. Tools API (Agent Tooling Layer)

Built on top of existing cntx-ui infrastructure. Tools are exposed via the MCP server and implemented in `lib/agent-tools.js`.

### Core Toolset

|Tool Name|Description|Implementation|
|---|---|---|
|`readFile`|Get raw file contents|Direct filesystem access|
|`listFiles`|List files with bundle awareness|Uses existing bundle system + patterns|
|`searchSemanticChunks`|Semantic search of code chunks|Uses existing vector search in `semantic-integration.js`|
|`getBundle`|Get files in a specific bundle|Uses existing bundle system from `.cntx/config.json`|
|`parseAST`|Parse TypeScript via tree-sitter|Uses existing `treesitter-semantic-chunker.js`|
|`runCommand`|Execute CLI commands safely|Subprocess execution with safety checks|
|`getSemanticAnalysis`|Get full semantic analysis|Uses existing semantic cache|

### Extended Toolset (Future)

|Tool Name|Description|Implementation|
|---|---|---|
|`queryDependencies`|Analyze import/export relationships|Build on AST parsing|
|`findSimilarCode`|Find code patterns|Extend vector search|
|`validateChanges`|Check proposed changes|Static analysis + tests|

---

## 🧠 3. Semantic Foundation

### 3.1 Existing Infrastructure

**Leverages current cntx-ui capabilities:**
- ✅ Tree-sitter based AST parsing
- ✅ Semantic chunking with type classification
- ✅ Vector embeddings and similarity search
- ✅ Bundle organization system
- ✅ MCP server for tool integration

### 3.2 Data Sources

|Data Source|Location|Purpose|
|---|---|---|
|Semantic Cache|`.cntx/semantic-cache.json`|Pre-analyzed code chunks with embeddings|
|Bundle Config|`.cntx/config.json`|File organization and grouping|
|Vector Search|Existing implementation|Semantic similarity queries|
|AST Analysis|`lib/treesitter-semantic-chunker.js`|Code structure understanding|

---

## 🎯 4. Agent Behavior Modes (Stateless)

### 4.1 Discovery Mode
```javascript
async function discoverCodebase(scope = 'all') {
  // 1. Use bundle system to organize exploration
  // 2. Get semantic analysis for each bundle
  // 3. Summarize architecture and patterns
  // 4. Report findings with confidence levels
}
```

### 4.2 Query Mode
```javascript
async function answerQuery(question, scope = null) {
  // 1. Use vector search for semantic matching
  // 2. Parse AST for precise symbol lookup
  // 3. Cross-reference with bundle organization
  // 4. Provide contextual answers with code references
}
```

### 4.3 Feature Investigation Mode
```javascript
async function investigateFeature(featureDescription) {
  // 1. Search for existing implementations
  // 2. Identify related code patterns
  // 3. Find suitable integration points
  // 4. Report on feasibility and approach
}
```

### 4.4 Passive Mode
```javascript
async function discussAndPlan(userInput) {
  // 1. Engage in conversation about codebase
  // 2. Explain concepts and relationships
  // 3. Suggest exploration strategies
  // 4. Plan development approaches
}
```

---

## 📁 5. Integration with Existing cntx-ui

### 5.1 File Structure
```
lib/
├── mcp-server.js              # Enhanced with agent tools
├── semantic-integration.js    # Current vector search foundation  
├── treesitter-semantic-chunker.js # Current AST parsing
├── agent-tools.js             # NEW: Tool implementations
└── agent-runtime.js           # NEW: Behavior mode implementations

.cntx/
├── config.json              # Current bundle configuration
├── semantic-cache.json      # Current semantic analysis cache
└── (no new files needed)
```

### 5.2 MCP Server Enhancement
```javascript
// Add to existing lib/mcp-server.js
const agentTools = require('./agent-tools.js');
const agentRuntime = require('./agent-runtime.js');

// New MCP tool endpoints:
// - agent/discover
// - agent/query  
// - agent/investigate
// - agent/discuss
```

---

## 🧪 6. Implementation Phases

### Phase 1: Core Tools (Week 1)
- Implement `lib/agent-tools.js` with basic toolset
- Enhance MCP server with agent tool endpoints
- Test integration with existing semantic search

### Phase 2: Behavior Modes (Week 2)  
- Implement `lib/agent-runtime.js` with 4 behavior modes
- Create stateless exploration and query capabilities
- Test end-to-end agent interactions

### Phase 3: Polish & Integration (Week 3)
- Refine tool responses and error handling
- Add bundle-aware scoping
- Create example workflows and documentation

---

## 🎯 7. Success Criteria

- **Tool Integration**: All agent tools work seamlessly with existing cntx-ui data
- **Query Quality**: 80%+ relevance for semantic code queries
- **Discovery Accuracy**: Meaningful architectural summaries for typical codebases
- **MCP Compatibility**: Full integration with existing MCP workflows
- **Performance**: <2s response time for most agent operations

---

## 🔌 8. Future Extensions (Post-MVP)

- **Memory System**: Add session persistence for complex explorations
- **Multi-modal**: Support for images, diagrams, and rich media
- **Code Generation**: Propose and validate code changes
- **Collaboration**: Multi-agent coordination for complex tasks

---

This simplified approach builds incrementally on your existing foundation, delivering agent capabilities without architectural complexity.