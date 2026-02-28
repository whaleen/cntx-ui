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

## Activities

| MCP Tool | HTTP Endpoint | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `list_activities` | `GET /api/activities` | *None* | List all ongoing agent missions. |
| `get_reasoning` | `GET /api/activities/:id/reasoning` | `id: string` | Recall agent interaction history for a task. |
