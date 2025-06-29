# Tasks: Refactor JavaScript to TypeScript

## Relevant Files

- `tsconfig.json` - TypeScript configuration file
- `package.json` - Build scripts and dependencies
- `lib/agent-runtime.js` - Agent runtime implementation
- `lib/agent-tools.js` - Agent tools implementation
- `lib/function-level-chunker.js` - Function level chunker
- `lib/mcp-server.js` - MCP server implementation
- `lib/mcp-transport.js` - MCP transport layer
- `lib/semantic-splitter.js` - Semantic splitter implementation
- `lib/simple-vector-store.js` - Vector store implementation
- `lib/treesitter-semantic-chunker.js` - Tree-sitter chunker
- `server.js` - Main server file
- `bin/cntx-ui.js` - CLI implementation

### Notes

- Unit tests should typically be placed alongside the code files they are testing
- Use `npx tsc` to run TypeScript compilation
- Consider using `@types/node` for Node.js type definitions

## Tasks

- [ ] 1.0 Setup TypeScript Configuration

  - [ ] 1.1 Install TypeScript and necessary dependencies
  - [ ] 1.2 Create initial `tsconfig.json` with appropriate settings
  - [ ] 1.3 Update `package.json` scripts for TypeScript compilation
  - [ ] 1.4 Configure ESLint for TypeScript support

- [ ] 2.0 Convert Core Library Files

  - [ ] 2.1 Convert `lib/agent-runtime.js` to TypeScript
  - [ ] 2.2 Convert `lib/agent-tools.js` to TypeScript
  - [ ] 2.3 Convert `lib/mcp-server.js` to TypeScript
  - [ ] 2.4 Convert `lib/mcp-transport.js` to TypeScript

- [ ] 3.0 Convert Chunker and Processing Files

  - [ ] 3.1 Convert `lib/function-level-chunker.js` to TypeScript
  - [ ] 3.2 Convert `lib/semantic-splitter.js` to TypeScript
  - [ ] 3.3 Convert `lib/treesitter-semantic-chunker.js` to TypeScript
  - [ ] 3.4 Convert `lib/simple-vector-store.js` to TypeScript

- [ ] 4.0 Convert Server and CLI Files

  - [ ] 4.1 Convert `server.js` to TypeScript
  - [ ] 4.2 Convert `bin/cntx-ui.js` to TypeScript
  - [ ] 4.3 Update build scripts to handle TypeScript compilation

- [ ] 5.0 Testing and Validation
  - [ ] 5.1 Ensure all files compile without TypeScript errors
  - [ ] 5.2 Run existing tests to verify functionality is maintained
  - [ ] 5.3 Add type definitions for external dependencies
  - [ ] 5.4 Update documentation to reflect TypeScript usage
