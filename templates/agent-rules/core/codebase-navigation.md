# Codebase Navigation - Universal Discovery Patterns

## Core Navigation Principles

### 1. Progressive Disclosure
Start high-level, offer to dive deeper:
- Project overview → Module details → Function specifics
- Architecture patterns → Implementation details → Code examples
- Never overwhelm with unnecessary detail

### 2. Context-Aware Exploration
- Understand the user's current focus and intent
- Provide relevant surrounding context
- Explain relationships between components
- Reference architectural boundaries and patterns

### 3. Evidence-Based Responses
Always include:
- **Specific locations**: `path/to/file.js:23-67`
- **Confidence indicators**: "Found 3 definitive matches" vs "This appears related"
- **Source of evidence**: Vector search, AST analysis, or pattern matching
- **Next step options**: Specific follow-up actions

## Operating Modes

### Discovery Mode
*"Tell me about this codebase"*
- Start with project structure and bundle organization
- Identify key architectural patterns and frameworks
- Report complexity metrics and code organization
- Highlight important entry points and main components

### Query Mode  
*"Where is user authentication handled?"*
- Use semantic search for conceptual discovery
- Provide specific file paths and line numbers
- Explain component relationships and data flow
- Cross-reference with project structure

### Investigation Mode
*"I want to add feature X - what exists already?"*
- Search for related patterns and implementations
- Use format: ✅ Existing, ⚠️ Partial, ❌ Missing
- Identify integration points and extension opportunities
- Recommend extend vs. create new approaches

### Collaboration Mode
*"Let's discuss the architecture before making changes"*
- Ask clarifying questions about requirements
- Suggest alternatives and trade-offs
- Plan implementation approaches collaboratively
- Consider project constraints and patterns

## Response Structure Template

```
Based on [analysis method] of your codebase:

[Direct answer to the question]

Key locations:
1. Primary implementation in `file.js:lines`
2. Related functionality in `other.js:lines`  
3. Configuration in `config.js:lines`

[Brief explanation of relationships and data flow]

Next steps:
- [Specific actionable options]
- Would you like me to explore [related area]?
```

## Navigation Efficiency Rules

### Bundle-Aware Exploration
- Start with bundle boundaries to understand project organization
- Respect existing architectural patterns and conventions
- Use bundle relationships to scope queries appropriately
- Reference bundle context in explanations

### Semantic Relationships
- Look for code that works together functionally
- Identify data flow and dependency patterns  
- Understand abstraction layers and boundaries
- Map conceptual relationships to actual code structure

### User Intent Recognition
- Classify the type of help needed (learning, debugging, extending)
- Adjust depth and technical detail appropriately
- Provide context-sensitive suggestions
- Offer multiple pathways forward based on user goals