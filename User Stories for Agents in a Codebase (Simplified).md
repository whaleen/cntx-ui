# 🧠 User Stories for Agents in a Codebase

*A narrative guide for AI agents exploring codebases with cntx-ui*

---

## 1. Arrival

> *You arrive in a codebase. The environment is already prepared—cntx-ui has done the heavy lifting.*

- You land in a repository that has been analyzed by cntx-ui
- Semantic chunks are cached in `.cntx/semantic-cache.json`
- Bundles are organized in `.cntx/config.json`
- Vector search is ready for semantic queries
- You have tools available through the MCP server

**No blind exploration needed—the foundation is already built.**

---

## 2. Orientation

> *You notice the organized landscape. Structure emerges from the semantic analysis.*

- The codebase is pre-mapped with semantic types (`ui_component`, `api_integration`, etc.)
- Bundles group related functionality (`frontend`, `backend`, `config`, etc.)
- Vector embeddings allow semantic queries like "authentication logic" or "form validation"
- AST parsing provides precise symbol and dependency information

**The question isn't "What's here?" but "What do you want to know about what's here?"**

---

## 3. Initial Orders

> *The human agent gives direction. Your mode of operation is determined.*

You operate in one of four modes:

### **Discovery Mode**
*"Tell me about this codebase"*
- Summarize bundles and their purposes
- Identify architectural patterns
- Report on code organization and structure

### **Query Mode** 
*"Where is the user authentication handled?"*
- Use semantic search to find relevant chunks
- Cross-reference with AST analysis for precision
- Provide specific file and function references

### **Feature Investigation Mode**
*"I want to add dark mode—what already exists?"*
- Search for existing theming systems
- Identify UI components that need updating
- Find configuration patterns to follow

### **Passive Mode**
*"Let's discuss the architecture before I make changes"*
- Engage in conversation about design decisions
- Explain code relationships and patterns
- Plan development approaches collaboratively

---

## 4. Exploration Principles

> *You work with intelligence, not brute force.*

### **Bundle-Aware Navigation**
- Start with bundle boundaries (`frontend`, `backend`, `ui-components`)
- Respect the existing organization patterns
- Use bundles to scope your exploration appropriately

### **Semantic-First Discovery**
- Query by intent: "How are errors handled?" not "Find all .catch() calls"
- Use vector search for conceptual understanding
- Fall back to AST parsing for precise symbol location

### **Layered Understanding**
- **High-level**: Bundle organization and architecture
- **Mid-level**: Semantic chunk relationships and patterns
- **Low-level**: Function signatures and implementation details

---

## 5. Intelligent Responses

> *You provide context-rich, actionable information.*

### **Discovery Responses**
```
"This React application is organized into 5 main bundles:

• Frontend (47 components) - Modern React with TypeScript
• UI Components (23 reusable components) - Design system foundation  
• Backend (12 API endpoints) - Express.js with authentication
• Config (8 configuration files) - Build and deployment setup
• Semantic Engine (4 core modules) - Code analysis and chunking

Key patterns: Hook-based state management, component composition, 
semantic code organization."
```

### **Query Responses**
```
"User authentication is handled in 3 main areas:

1. `lib/auth.js` - Core JWT validation (lines 23-67)
2. `components/LoginForm.tsx` - UI authentication flow
3. `api/auth.js` - Login/logout endpoints

The system uses JWT tokens stored in localStorage, with middleware 
validation on protected routes."
```

### **Feature Investigation**
```
"For dark mode implementation, I found:

✅ Existing: Theme context in `contexts/ThemeProvider.tsx`
✅ Existing: CSS variables in `styles/variables.css`
⚠️  Partial: Some components use hardcoded colors
❌ Missing: Theme toggle component
❌ Missing: System preference detection

Recommended approach: Extend existing theme system rather than rebuild."
```

---

## 6. Precision Over Power

> *You leverage the prepared environment efficiently.*

### **Use What's Available**
- Semantic cache provides instant access to analyzed code
- Bundle system offers logical exploration boundaries  
- Vector search enables conceptual queries without full-text scanning
- MCP integration provides structured tool access

### **Avoid Redundant Work**
- Don't re-analyze what's already in the semantic cache
- Don't traverse every file when bundles provide organization
- Don't parse ASTs repeatedly when semantic types are cached

### **Focus on Value**
- Answer the specific question asked
- Provide actionable, contextual information
- Reference specific files, functions, and line numbers
- Explain relationships and dependencies clearly

---

## 7. Conversation Flow

> *You engage naturally while staying grounded in code.*

```
Human: "I want to understand how this app handles user sessions"

Agent: "Let me search for session-related code..."
        [Uses semantic search for "session management"]
        
        "I found 3 key areas:
        
        1. Session creation in `api/auth.js:createSession()`
        2. Session validation middleware in `lib/auth.js:validateSession()`  
        3. Client-side session state in `hooks/useAuth.ts`
        
        Would you like me to explain how these work together, or dive 
        deeper into a specific part?"