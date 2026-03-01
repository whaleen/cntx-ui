# 🤖 Agent Handshake: cntx-ui

## Project Overview
- **Path:** `/Users/josh/Projects/_whaleen/cntx-ui`
- **Total Files:** 207
- **Semantic Intelligence:** 0 persistent chunks indexed.

## Codebase Organization (Bundles)
- **core-server**: Backend API (4 files)
- **bundle-system**: General Module (4 files)
- **ai-processing**: General Module (6 files)
- **mcp-integration**: General Module (3 files)
- **react-components**: UI Components (5 files)
- **bundle-ui**: UI Components (0 files)
- **ui-system**: UI Components (2 files)
- **config**: General Module (9 files)
- **testing**: General Module (2 files)
- **docs**: General Module (12 files)
- **master**: General Module (160 files)

## Intelligence Interface (MCP Tools)
You have access to a specialized "Repository Intelligence" engine. Use these tools for high-signal exploration:

### `agent/discover`
Discovery Mode: Comprehensive architectural overview.
**Parameters:**
- `scope` (string, optional): undefined

### `agent/query`
Query Mode: Answer technical questions.
**Parameters:**
- `question` (string, required): undefined

### `agent/investigate`
Investigation Mode: Suggest integration points.
**Parameters:**
- `feature` (string, required): undefined

### `artifacts/list`
List normalized project artifacts (OpenAPI and Navigation manifests).
*No parameters required*

### `artifacts/get_openapi`
Get OpenAPI artifact payload (summary + parsed content when JSON).
*No parameters required*

### `artifacts/get_navigation`
Get Navigation artifact payload (summary + parsed manifest).
*No parameters required*

### `artifacts/summarize`
Get compact summaries for OpenAPI and Navigation artifacts.
*No parameters required*

### `list_bundles`
List all project bundles.
*No parameters required*

### `read_file`
Read a file.
**Parameters:**
- `path` (string, required): undefined


---

## 🛠 Complete Tool & API Reference
Refer to the dynamic reference below for full parameter schemas and HTTP fallback endpoints.

# cntx-ui Tool Reference

This document maps the **Model Context Protocol (MCP)** tools to their **HTTP API** equivalents.

## Core Agent Tools

| MCP Tool | HTTP Endpoint | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `agent/discover` | `GET /api/status` | `scope?: string` | Architectural overview and health check. |
| `agent/query` | `POST /api/semantic-search` | `question: string` | Semantic search across the entire codebase. |
| `agent/investigate` | `POST /api/vector-db/search` | `feature: string` | Suggest integration points for new features. |
| `agent/organize` | `GET /api/bundles` | `activity: string` | Audit and optimize project bundle health. |

## Bundle Management

| MCP Tool | HTTP Endpoint | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `list_bundles` | `GET /api/bundles` | *None* | List all manual and smart bundles. |
| `get_bundle` | `GET /api/bundles/:name` | `name: string` | Get full XML content of a specific bundle. |

## Semantic Analysis

| MCP Tool | HTTP Endpoint | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `get_semantic_chunks`| `GET /api/semantic-chunks` | `refresh?: bool` | Get all surgically extracted code chunks. |
| `search_by_type` | `POST /api/vector-db/search-by-type` | `type: string` | Find chunks by AST type (e.g. arrow_function). |
| `search_by_domain` | `POST /api/vector-db/search-by-domain`| `domain: string` | Find chunks by business domain (e.g. auth). |

## File Operations

| MCP Tool | HTTP Endpoint | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `read_file` | `GET /api/files/:path` | `path: string` | Read file with injected semantic metadata. |
| `write_file` | `POST /api/files` | `path, content` | Write file with automatic backup. |



## Working Memory
This agent is **stateful**. All interactions in this directory are logged to a persistent SQLite database (`.cntx/bundles.db`), allowing for context retention across sessions.

---
*Generated automatically by cntx-ui. Optimized for LLM consumption.*
