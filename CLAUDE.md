# cntx-ui

Semantic code analysis and context management CLI for AI agents. Parses codebases with tree-sitter, indexes with local embeddings, exposes MCP tools.

## Architecture

```
bin/cntx-ui.ts          CLI entry (commands: init, watch, mcp, bundle, status)
server.ts               CntxServer orchestrator class + exported functions
lib/
  configuration-manager  Config, SQLite DB, ignore patterns, bundle state
  database-manager       SQLite schema (bundles, semantic_chunks, vector_embeddings)
  file-system-manager    File watching, glob matching, .cntxignore
  bundle-manager         Bundle generation, XML output
  semantic-splitter      Tree-sitter AST parsing (JS, TS, TSX, Rust)
  simple-vector-store    Transformers.js embeddings (all-MiniLM-L6-v2)
  mcp-server             MCP JSON-RPC 2.0 over stdio
  agent-runtime          Session management, manifest generation
  agent-tools            MCP tool definitions (discover, query, investigate, organize)
  api-router             HTTP REST endpoints
  websocket-manager      Real-time file change notifications
  heuristics-manager     Code categorization rules
web/                    React dashboard (Vite + shadcn/ui), built to web/dist/
templates/              Init templates (agent-rules, activities, config)
```

## Development

### Build and Test Locally

cntx-ui is globally installed via `npm link`, so local changes are live after build:

```bash
cd /Users/josh/Projects/_whaleen/cntx-ui
npm run build          # compiles TS to dist/
cntx-ui version        # confirms linked version
```

For full rebuild including web UI: `./build.sh`

### Version Bump + Publish

1. Edit version in `package.json`
2. `npm run build`
3. `npm publish` (requires 2FA passkey - must be run manually by Josh)
4. Push to main triggers GitHub Actions release workflow

### Testing in Target Repos

```bash
cd /path/to/target-repo
rm -rf .cntx .mcp.json   # clean slate
cntx-ui init              # should scaffold everything
cntx-ui status            # verify file detection
cntx-ui watch             # start server + MCP + semantic analysis
```

## Iteration Workflow

This project uses a build-test-file cycle across multiple repos.

### Phase 1: Work on cntx-ui

Make changes in this repo, build, verify:
```bash
npm run build && cntx-ui version
```

### Phase 2: Test in Target Repo

Test `cntx-ui init` in a target repo. Check:
- [ ] .cntx/ directory created with all expected files
- [ ] .mcp.json created and valid
- [ ] .cntxignore created with sane defaults
- [ ] agent-rules/ copied with core/, capabilities/, project-specific/
- [ ] Auto-detected bundles match project structure
- [ ] `cntx-ui status` runs without errors
- [ ] `cntx-ui watch` starts server, MCP, semantic analysis without crashes
- [ ] Semantic analysis completes for all supported file types
- [ ] MCP tools respond correctly

### Phase 3: File Issues

Create issues on nothingdao/cntx-ui for anything broken. Use this format:
```
Title: [concise description]
Body:
## Repro
- Target repo: [name]
- Command: `cntx-ui [command]`
- Error: [exact error or unexpected behavior]

## Expected
[what should happen]

## Context
[file types, repo size, any relevant details]
```

## Target Test Repos

Priority order for compatibility testing:

| Repo | Path | Stack | Status |
|------|------|-------|--------|
| den | _nothingdao/den | TS/React | Tested (minimal init) |
| tiles | _whaleen/tiles | TS/React | Tested (full init) |
| warehouse | _whaleen/warehouse | TS/React | Tested (partial init) |
| shadcn-solana | _nothingdao/shadcn-solana | TS/React | Not tested |
| earth | _nothingdao/earth | Unknown | Not tested |
| divine-liturgy | _orthfx/divine-liturgy | Unknown | Not tested |
| orthodox-reader | _orthfx/orthodox-reader | Unknown | Not tested |
| llmix | _whaleen/llmix | Unknown | Not tested |
| ephemeral | _whaleen/ephemeral | Unknown | Not tested |

## Known Gaps

### Tree-sitter Language Support
Only JS/TS/TSX/Rust. Need to add:
- Python (common in ML/scripting)
- Go
- CSS/SCSS (for frontend projects)
- HTML
- JSON (structural analysis)
- YAML/TOML (config files)
- Solidity (for web3 repos)
- Markdown (for docs)

### Init Consistency
- No `reinit` or `upgrade` command exists
- Repos initialized with older versions have incomplete .cntx/ contents
- Need idempotent init that fills in missing pieces without clobbering existing config
- `cntx-ui status` shows "Total files: N" but master bundle reports "0 files (0KB)" after fresh init (bundles not generated until `watch` or `bundle` is run, but status output is misleading)
- Dead code in server.ts `initConfig()` still tries to copy activities templates (gutted feature)

### MCP Integration
- .mcp.json uses relative cwd "." which may not resolve correctly in all contexts
- No validation that cntx-ui binary is actually available in PATH

## Agent Prompts

### For working ON cntx-ui itself:
```
I'm working on cntx-ui (nothingdao/cntx-ui) at /Users/josh/Projects/_whaleen/cntx-ui.
Read CLAUDE.md for full context. The tool is globally linked via npm link.
After any code changes, run `npm run build` to compile.
Do not run `npm publish` - I handle that manually.
Do not start dev servers.
```

### For testing cntx-ui in a target repo:
```
Test cntx-ui compatibility in [REPO_PATH].
First: rm -rf .cntx .mcp.json && cntx-ui init
Then: cntx-ui status
Check: all .cntx/ files present, no errors, correct bundle detection.
If issues found, create GitHub issues on nothingdao/cntx-ui with repro steps.
```

### For filing issues from test results:
```
Review these test results from cntx-ui testing in [REPO].
Create concise GitHub issues on nothingdao/cntx-ui for each problem found.
Include: repro steps, expected behavior, target repo context.
Label suggestions: bug, onboarding, tree-sitter, mcp, dx.
```
