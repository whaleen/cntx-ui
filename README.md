# cntx-ui

Minimal file bundling and tagging tool for AI development with web interface.

## Features

- File bundling and organization for AI development workflows
- Web-based UI for managing bundles and configurations
- **Model Context Protocol (MCP) server** for AI integration
- Hidden files management
- Cursor rules integration
- WebSocket-based real-time updates
- CLI tools for automation

## Installation

### Global Installation (Recommended)

```bash
npm install -g cntx-ui
```

### Local Development Installation

```bash
git clone https://github.com/nothingdao/cntx-ui.git
cd cntx-ui
npm install
```

## Usage

### Initialize a Project

```bash
# Initialize cntx-ui in your project
cntx-ui init

# Start the web interface
cntx-ui watch

# Visit http://localhost:3333 to access the web UI
```

### CLI Commands

```bash
# Generate bundles
cntx-ui bundle <name>

# Check project status
cntx-ui status

# Start web server on custom port
cntx-ui watch [port]

# Start web server with MCP status tracking
cntx-ui watch --with-mcp

# Start MCP server for AI integration
cntx-ui mcp

# Add project to Claude Desktop MCP configuration
cntx-ui setup-mcp
```

### MCP Integration

cntx-ui can function as an MCP (Model Context Protocol) server, providing AI tools with direct access to your project bundles:

```bash
# Start MCP server
cntx-ui mcp
```

**Available MCP Resources:**
- `cntx://bundle/<name>` - Access any bundle as XML content
- `cntx://file/<path>` - Access individual project files

**Available MCP Tools:**
- `list_bundles` - List all available bundles
- `get_bundle` - Retrieve specific bundle content  
- `generate_bundle` - Regenerate a bundle
- `get_file_tree` - Get project file structure
- `get_project_status` - Get current project status

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm

### Setup Development Environment

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/nothingdao/cntx-ui.git
   cd cntx-ui
   npm install
   ```

2. **Install web dependencies:**
   ```bash
   cd web
   npm install
   cd ..
   ```

### Development Workflow

#### Running in Development Mode

1. **Start the backend server:**
   ```bash
   npm run dev
   ```

2. **Start the frontend development server:**
   ```bash
   npm run dev:web
   ```
   
   The web interface will be available at `http://localhost:5173` (Vite dev server)

#### Building the Project

1. **Build web interface only:**
   ```bash
   npm run build:web
   ```

2. **Build entire project:**
   ```bash
   npm run build
   ```

3. **Automated build with validation:**
   ```bash
   ./build.sh
   ```

### Project Structure

```
cntx-ui/
├── bin/                    # CLI executable
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── utils/          # Utility functions
│   │   └── lib/            # Libraries and configurations
│   ├── dist/               # Built frontend (generated)
│   └── package.json        # Frontend dependencies
├── server.js               # WebSocket server
├── package.json            # Main package configuration
├── build.sh                # Build automation script
└── test-local.sh           # Local testing script
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend server |
| `npm run dev:web` | Start frontend dev server |
| `npm run build` | Build entire project |
| `npm run build:web` | Build frontend only |
| `npm test:local` | Install and test package locally |

## MCP Server Setup

### Quick Setup with setup-mcp Command

The easiest way to configure cntx-ui for Claude Desktop:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Initialize cntx-ui if not already done
cntx-ui init

# Add this project to Claude Desktop MCP configuration
cntx-ui setup-mcp
```

This automatically adds your project to Claude Desktop's configuration file and allows you to work with multiple projects simultaneously.

### Claude Desktop Integration

#### Multi-Project Setup (Recommended)

You can use cntx-ui across multiple projects by running `setup-mcp` in each project directory:

```bash
# Project 1
cd /Users/you/project1
cntx-ui setup-mcp

# Project 2  
cd /Users/you/project2
cntx-ui setup-mcp
```

This creates entries in your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cntx-ui-project1": {
      "command": "sh",
      "args": ["-c", "cd /Users/you/project1 && node /path/to/cntx-ui/bin/cntx-ui.js mcp"],
      "cwd": "/Users/you/project1"
    },
    "cntx-ui-project2": {
      "command": "sh", 
      "args": ["-c", "cd /Users/you/project2 && node /path/to/cntx-ui/bin/cntx-ui.js mcp"],
      "cwd": "/Users/you/project2"
    }
  }
}
```

#### Manual Configuration

For manual setup, add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "cntx-ui-projectname": {
      "command": "sh",
      "args": ["-c", "cd /path/to/your/project && cntx-ui mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Other MCP Clients

For other MCP-compatible clients, use:
- **Command**: `cntx-ui mcp`
- **Transport**: stdio
- **Working Directory**: Your project root

### MCP Workflow

1. **Setup**: Run `cntx-ui setup-mcp` in each project you want to use with Claude Desktop
2. **Visual Configuration**: Use `cntx-ui watch` to configure bundles via web UI
3. **AI Integration**: AI clients connect via MCP to access bundles across all configured projects
4. **Real-time Updates**: Changes in web UI immediately available to AI tools
5. **Multi-Project**: Claude Desktop can access bundles from all configured projects simultaneously

## Testing

### Local Testing

1. **Run automated test suite:**
   ```bash
   ./test-local.sh
   ```

2. **Manual testing:**
   ```bash
   # Build and pack
   npm run build
   npm pack
   
   # Install globally for testing
   npm install -g ./cntx-ui-*.tgz
   
   # Test in a new project
   mkdir test-project && cd test-project
   cntx-ui init
   cntx-ui watch
   ```

### Test Coverage

The test suite covers:
- Project initialization
- Bundle generation
- Web server functionality
- API endpoints
- File management operations

## Publishing

### Prerequisites for Publishing

- npm account with publish permissions
- Clean git working directory
- All tests passing

### Publishing Steps

1. **Update version:**
   ```bash
   npm version patch  # or minor/major
   ```

2. **Build and validate:**
   ```bash
   ./build.sh
   ```

3. **Test locally:**
   ```bash
   ./test-local.sh
   ```

4. **Publish to npm:**
   ```bash
   # Stable release
   npm publish
   
   # Beta release
   npm publish --tag beta
   ```

### Automated Publishing Workflow

Use the build script for a complete workflow:

```bash
./build.sh
# Follow prompts for local testing
# If tests pass, run: npm publish
```

## Configuration

### Environment Variables

- `PORT` - Override default server port (default: 3333)
- `NODE_ENV` - Set environment (development/production)

### Project Configuration

cntx-ui creates these files in your project:
- `.cntx/config.json` - Main configuration
- `.cntxignore` - Files to ignore
- `.cursorrules` - Cursor editor rules

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing code style
4. Run tests: `./test-local.sh`
5. Submit a pull request

## Technology Stack

- **Backend:** Node.js, WebSocket (ws)
- **Frontend:** React 19, TypeScript, Vite
- **UI:** Tailwind CSS, Radix UI
- **State Management:** TanStack Query
- **Build Tools:** Vite, TypeScript compiler

## License

MIT

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/nothingdao/cntx-ui/issues)
- Documentation: Check the web interface for detailed usage guides
