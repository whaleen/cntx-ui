# Vector Search Capabilities

## Overview
Vector search provides semantic code discovery through embedding-based similarity matching. This is the most efficient method for conceptual code exploration.

## When Available
- Look for vector database endpoints: `/api/vector-db/*`
- Check database status: `GET /api/vector-db/status`
- Verify chunk count and model information

## Core Capabilities

### Semantic Search
**Endpoint**: `POST /api/vector-db/search`

**Use for**:
- "Find functions that handle user authentication"
- "Locate error handling patterns"
- "Discover similar implementations"
- "Explore feature-related code"

**Query Format**:
```json
{
  "query": "semantic description of what you're looking for",
  "limit": 5,
  "minSimilarity": 0.2
}
```

**Best Practices**:
- Use 3-5 descriptive words: "user authentication login session"
- Be conceptual, not literal: "form validation" not "validateForm function"
- Lower similarity thresholds (0.1-0.2) for broader discovery
- Higher limits (5-10) for comprehensive exploration

### Type-Based Search
**Endpoint**: `POST /api/vector-db/search-by-type`

**Use for**:
- Finding all React components: `{"type": "react_component"}`
- Locating API handlers: `{"type": "api_integration"}`
- Discovering utility functions: `{"type": "utility"}`

### Domain-Based Search  
**Endpoint**: `POST /api/vector-db/search-by-domain`

**Use for**:
- Business domain exploration: `{"domain": "authentication"}`
- Technical domain focus: `{"domain": "user-interface"}`
- Architectural layer discovery: `{"domain": "api"}`

## Response Interpretation

### Result Structure
```json
{
  "results": [
    {
      "id": "functionName",
      "similarity": 0.85,
      "metadata": {
        "content": "actual code",
        "semanticType": "react_component",
        "businessDomain": ["authentication"],
        "technicalPatterns": ["hooks", "async_operations"],
        "purpose": "User login form",
        "files": ["src/auth/LoginForm.tsx"],
        "complexity": {"score": 5, "level": "medium"}
      }
    }
  ]
}
```

### Similarity Scores
- **0.8+**: Highly relevant, direct match
- **0.6-0.8**: Good relevance, related functionality  
- **0.4-0.6**: Potentially relevant, worth investigating
- **0.2-0.4**: Loosely related, may provide context
- **<0.2**: Probably not relevant

### Metadata Usage
- **semanticType**: Code classification (component, function, etc.)
- **businessDomain**: Functional area (auth, ui, api, etc.)
- **technicalPatterns**: Implementation patterns (async, hooks, etc.)
- **purpose**: Human-readable function description
- **complexity**: Cognitive complexity metrics

## Query Optimization Strategies

### Progressive Refinement
1. Start broad: "user management"
2. Refine: "user authentication login"
3. Specific: "user login form validation"

### Multiple Approaches
- Try different phrasings: "data fetching" vs "API calls" vs "HTTP requests"
- Use synonyms: "configuration" vs "settings" vs "options"
- Vary abstraction level: "React hooks" vs "state management" vs "useState"

### Fallback Strategies
1. **Lower similarity**: Try minSimilarity: 0.1 for broader results
2. **Increase limit**: Get more results to find relevant matches
3. **Different endpoints**: Try search-by-type or search-by-domain
4. **Simpler queries**: Use fewer, more basic terms

## Performance Characteristics

### Speed
- **Typical response**: 20-50ms
- **Token efficiency**: ~5k tokens vs 50k+ for file reading
- **Real-time updates**: Automatically stays current with code changes

### Accuracy
- **Best for**: Conceptual discovery and pattern matching
- **Less effective for**: Exact string matching, specific error messages
- **Coverage**: Function-level granularity across entire codebase

## Integration Patterns

### Vector-First Workflow
```
User Query → Semantic Search → [Optional: Type/Domain Refinement] → Traditional Search (if needed)
```

### Hybrid Discovery
1. **Vector search** for broad discovery
2. **Bundle system** for structural context
3. **Direct file access** for specific implementation details

### Error Handling
- **Empty results**: Try broader terms or lower similarity threshold
- **Server error**: Fall back to bundle system or traditional search
- **Offline**: Use available cached information and traditional methods