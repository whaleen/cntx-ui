# Performance Hierarchy - Universal Tool Usage Priority

## Core Principle
Always use the fastest, most efficient tool available for each task. Optimize for both response time and token efficiency.

## Priority Order

### 1. Vector Database (PRIMARY - if available)
- **Response time**: ~20ms
- **Token efficiency**: 90% savings vs traditional search
- **Best for**: Semantic discovery, pattern matching, "find functions that..."
- **Query format**: Semantic descriptions (3-5 descriptive words)
- **Example**: "React component state management"

### 2. Structured APIs (SECONDARY - if available)
- **Response time**: ~50ms
- **Token efficiency**: High (pre-processed data)
- **Best for**: Project structure, metadata, organized information
- **Examples**: Bundle systems, AST parsing, configuration APIs

### 3. Traditional Search (FALLBACK ONLY)
- **Response time**: 100ms+
- **Token efficiency**: Low (raw file content)
- **Best for**: Exact string matching, specific error messages
- **Use only when**: Vector search fails or exact keywords needed

## Decision Matrix

| Task Type | Primary Tool | Secondary | Fallback |
|-----------|-------------|-----------|----------|
| Code discovery | Vector search | Bundle API | grep/rg |
| Pattern matching | Vector search | AST parsing | file scanning |
| Architecture overview | Bundle API | Vector search | directory listing |
| Exact string search | grep/rg | Vector search | manual search |
| Error investigation | Vector search | log parsing | file reading |

## Performance Metrics
- **Vector search**: ~5k tokens per query
- **Structured APIs**: ~2k tokens per query  
- **File reading**: ~50k+ tokens per file
- **Directory scanning**: ~20k tokens per scan

## Universal Guidelines
1. **Always try semantic search first** for discovery tasks
2. **Use structured data when available** for metadata
3. **Reserve traditional search** for exact matches only
4. **Combine methods intelligently** (vector discovery → precise lookup)
5. **Fail gracefully** with clear explanations when tools are unavailable