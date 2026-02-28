# cntx-ui

**cntx-ui** is the interface layer between human mental models and machine understanding of codebases. It transforms raw source code into a traversable knowledge graph for AI agents, providing surgical context management, semantic discovery, and real-time synchronization.

## 🚀 Key Capabilities

### 🧠 Semantic Code Understanding
Unlike simple file bundlers, `cntx-ui` performs function-level analysis of your codebase:
- **Semantic Splitting:** Automatically extracts functions, types, and interfaces with their relevant context (imports/dependencies).
- **Heuristic Categorization:** Classifies code by purpose (e.g., API Handlers, React Hooks, UI Components) using a configurable heuristics engine.
- **Complexity Metrics:** Identifies hotspots and architectural patterns automatically.

### 🔍 Local Vector Search
Integrated RAG (Retrieval-Augmented Generation) without external dependencies:
- **Local Embeddings:** Powered by `Transformers.js` using the `all-MiniLM-L6-v2` model.
- **In-Memory Vector Store:** Perform semantic similarity searches across your codebase to find related implementations instantly.

### 🤖 AI Agent Runtime
A specialized runtime that exposes advanced behavior modes via MCP:
- **Discovery Mode:** Generates comprehensive architectural overviews.
- **Query Mode:** Answers specific questions using semantic search and AST analysis.
- **Investigation Mode:** Analyzes existing implementations to suggest integration points for new features.
- **Organizer Mode:** Audits and optimizes project organization and bundle health.

### 📦 Smart Bundling & MCP
- **Dynamic Bundles:** Group files by human intent or machine discovery.
- **MCP Server:** Expose bundles, files, and agent tools directly to Claude Desktop or any MCP-compatible client.
- **Real-time Sync:** WebSocket-based updates ensure your AI context is always fresh.

---

## 🛠 Installation

### Global Installation (Recommended)
```bash
npm install -g cntx-ui
```

### Local Development
```bash
git clone https://github.com/nothingdao/cntx-ui.git
cd cntx-ui
npm install
cd web && npm install
```

---

## 📖 Usage

### Initialize a Project
```bash
cntx-ui init
cntx-ui watch
```
*Visit `http://localhost:3333` to access the Visual Dashboard.*

### CLI Commands
| Command | Description |
| :--- | :--- |
| `cntx-ui status` | View project health and bundle coverage. |
| `cntx-ui bundle <name>` | Manually trigger a bundle generation. |
| `cntx-ui setup-mcp` | Automatically configure Claude Desktop integration. |
| `cntx-ui mcp` | Start the MCP server on stdio. |

---

## 🏗 Technology Stack
- **Backend:** Node.js, `better-sqlite3`, `ws`
- **AI/ML:** `Transformers.js` (Local Embeddings), `chromadb` (Vector Store)
- **Parsing:** `tree-sitter`, Custom Semantic Splitter
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Lucide
- **Protocol:** Model Context Protocol (MCP)

---

## 🗺 Vision
We are building more than a tool; we are building **Repository Intelligence**. Our goal is to create a self-documenting, AI-optimized environment where the friction between "knowing" a codebase and "modifying" it vanishes.

See [VISION.md](./VISION.md) for the full roadmap.

## 📄 License
MIT
