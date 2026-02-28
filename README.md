# cntx-ui

Semantic code analysis and context management for AI agents. Turns a codebase into searchable, structured context that agents can navigate efficiently.

## What it does

- **Semantic analysis** — parses your code at the function level using tree-sitter, extracts purpose, complexity, and relationships
- **Local vector search** — embeds code chunks locally (all-MiniLM-L6-v2 via Transformers.js) for semantic similarity search with no external API calls
- **Bundle system** — group files into logical bundles (by feature, layer, or pattern) for structured context delivery
- **MCP server** — exposes 28+ tools to Claude Code, Claude Desktop, or any MCP-compatible client
- **Web dashboard** — visual interface at localhost:3333 for managing bundles, browsing semantic analysis, and editing agent rules
- **Real-time sync** — watches for file changes and keeps analysis, bundles, and embeddings current

## Install

```bash
npm install -g cntx-ui
```

## Usage

```bash
cntx-ui init          # scaffold .cntx directory, generate .mcp.json
cntx-ui watch         # start web server on port 3333
cntx-ui mcp           # start MCP server on stdio
cntx-ui bundle <name> # regenerate a specific bundle
cntx-ui status        # show project health and bundle state
cntx-ui setup-mcp     # configure Claude Desktop integration
```

After `cntx-ui init`, agents discover tools automatically via `.mcp.json`. The `.cntx/AGENT.md` file provides an onboarding handshake with tool reference and project overview.

## Agent interface

Agents interact through MCP tools or the HTTP API:

| MCP Tool | What it does |
| :--- | :--- |
| `agent/discover` | Architectural overview of the codebase |
| `agent/query` | Semantic search — "where is auth handled?" |
| `agent/investigate` | Find integration points for a new feature |
| `agent/organize` | Audit and optimize bundle structure |
| `list_bundles` | List all bundles with metadata |
| `get_bundle` | Get full bundle content as XML |
| `get_semantic_chunks` | Get all analyzed code chunks |
| `read_file` / `write_file` | File operations with bundle context |

Full tool reference with parameters is generated in `.cntx/AGENT.md` and `.cntx/TOOLS.md`.

## How it works

1. **tree-sitter** parses source files into AST, extracts functions/types/interfaces
2. **Heuristics engine** classifies each chunk by purpose, business domain, and technical patterns based on file paths, imports, and naming conventions
3. **Embeddings** are generated locally and stored in SQLite for persistent vector search
4. **Bundles** group files by glob patterns — auto-suggested on init based on project structure
5. **MCP server** and **HTTP API** expose everything to agents with consistent response shapes

## Tech stack

- Node.js, better-sqlite3, ws (WebSocket)
- tree-sitter (AST parsing), Transformers.js (local embeddings)
- React 19, TypeScript, Vite, Tailwind CSS (web dashboard)
- Model Context Protocol (MCP) via JSON-RPC 2.0

## License

MIT
