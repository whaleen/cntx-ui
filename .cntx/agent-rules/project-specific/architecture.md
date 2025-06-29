# Project Architecture - cntx-ui Specific

## Project Overview
cntx-ui is a semantic code analysis and bundle management system with integrated vector search capabilities, designed to help agents and developers understand and navigate codebases intelligently.

## Technology Stack

### Backend
- **Node.js**: Server runtime and API layer
- **Express-style routing**: Custom HTTP request handling
- **File system operations**: Direct fs module usage for file management
- **Vector embeddings**: @xenova/transformers for local semantic search
- **WebSocket**: Real-time updates and communication

### Frontend  
- **React + TypeScript**: Modern component-based UI
- **Vite**: Build tool and development server
- **TanStack Query**: Data fetching and state management
- **shadcn/ui**: Component library with Radix UI primitives
- **Tailwind CSS**: Utility-first styling system

### Analysis Engine
- **Semantic splitter**: Function-level code analysis
- **Tree-sitter**: AST parsing for precise code understanding
- **Vector store**: Embedding-based similarity search
- **Heuristics engine**: Configurable code categorization rules

## Key Architectural Patterns

### Bundle-Driven Organization
- **Logical groupings**: Files organized by purpose (frontend, backend, ui-components)
- **Bundle API**: RESTful endpoints for bundle management
- **Real-time updates**: File watching and automatic regeneration
- **XML export**: Structured output for external tool consumption

### Semantic Analysis Pipeline
```
Source Code → Tree-sitter Parsing → Function Extraction → 
Semantic Classification → Vector Embedding → Search Index
```

### Agent-Centric Design
- **Vector-first discovery**: Semantic search as primary exploration method
- **Modular instructions**: Composable agent rules and capabilities
- **Activity system**: Structured task management for complex work
- **Progressive disclosure**: Start high-level, drill down as needed

## Directory Structure

```
cntx-ui/
├── lib/                          # Core analysis engines
│   ├── semantic-splitter.js      # Function-level code analysis
│   ├── simple-vector-store.js    # Local embedding search
│   ├── heuristics-manager.js     # Configurable code classification
│   └── mcp-server.js             # Model Context Protocol integration
├── web/                          # React frontend application
│   ├── src/components/           # UI components
│   ├── src/lib/                  # Client-side utilities
│   └── dist/                     # Built static assets
├── .cntx/                        # Configuration and cache
│   ├── activities/               # Agent task definitions
│   ├── agent-rules/              # Modular agent instructions
│   ├── bundles.json             # Bundle configuration
│   └── semantic-cache.json      # Analysis cache
└── server.js                    # Main HTTP server and API
```

## Key Components and Responsibilities

### Server Layer (`server.js`)
- **HTTP API**: RESTful endpoints for all functionality
- **File watching**: Real-time change detection and cache invalidation
- **Bundle management**: File organization and generation
- **Vector integration**: Embedding generation and search
- **Static serving**: Frontend application hosting

### Analysis Engine (`lib/`)
- **Semantic splitter**: Extracts functions with context and metadata
- **Vector store**: Manages embeddings and similarity search
- **Heuristics manager**: Applies configurable classification rules
- **MCP server**: Provides agent-friendly API access

### Frontend (`web/src/`)
- **Bundle interface**: Visual bundle management and exploration
- **Activities dashboard**: Agent task monitoring and file viewing
- **Semantic visualization**: Vector search and analysis results
- **Settings management**: Configuration and preferences

## Data Flow Patterns

### Code Analysis Flow
1. **File change detection** → Cache invalidation
2. **Semantic analysis** → Function extraction + classification  
3. **Vector embedding** → Search index update
4. **Bundle regeneration** → Updated file groupings
5. **Client notification** → Real-time UI updates

### Agent Discovery Flow
1. **Vector search** → Semantic code discovery
2. **Bundle context** → Architectural understanding
3. **Activity reference** → Task and progress context
4. **Precise lookup** → Specific implementation details

## Performance Characteristics

### Analysis Performance
- **Semantic analysis**: ~2-5 seconds for full codebase
- **Vector embedding**: ~100ms per code chunk
- **Search queries**: ~20ms response time
- **Bundle generation**: ~500ms for large bundles

### Caching Strategy
- **Semantic cache**: 24-hour TTL with change invalidation
- **Vector index**: In-memory with disk persistence
- **Bundle cache**: Real-time updates with file watching
- **Client cache**: React Query with 5-minute TTL

## Integration Points

### Agent Tool Integration
- **Vector search API**: Semantic code discovery
- **Bundle API**: Structural project understanding
- **Activities API**: Task management and progress tracking
- **MCP protocol**: Standardized agent communication

### External Tool Support
- **Cursor integration**: .cursorrules file support
- **GitHub integration**: Repository analysis and understanding
- **Export formats**: XML bundles for external tool consumption
- **CLI interface**: Command-line bundle generation

## Development Patterns

### Configuration-Driven Development
- **Heuristics config**: JSON-based code classification rules
- **Bundle patterns**: Glob-based file organization
- **Agent rules**: Modular instruction composition
- **Environment config**: Flexible deployment options

### Real-Time Architecture
- **WebSocket communication**: Live updates between server and client
- **File watching**: Immediate response to code changes
- **Cache invalidation**: Automatic refresh of stale data
- **Progressive enhancement**: Graceful degradation when features unavailable