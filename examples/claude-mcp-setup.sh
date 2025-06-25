#!/bin/bash
# Copy this script to your project root and run it to set up cntx-ui MCP for Claude Desktop

PROJECT_DIR="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

# Create config directory if it doesn't exist
mkdir -p "$(dirname "$CONFIG_FILE")"

# Read existing config or create empty one
if [ -f "$CONFIG_FILE" ]; then
    EXISTING_CONFIG=$(cat "$CONFIG_FILE")
else
    EXISTING_CONFIG='{"mcpServers":{}}'
fi

# Use Node.js to merge the configs properly
node -e "
const fs = require('fs');
const config = $EXISTING_CONFIG;

if (!config.mcpServers) config.mcpServers = {};

// Add this project's MCP server
config.mcpServers['cntx-ui-$PROJECT_NAME'] = {
    'command': 'npx',
    'args': ['cntx-ui', 'mcp'],
    'cwd': '$PROJECT_DIR'
};

fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
"

echo "✅ Added cntx-ui-$PROJECT_NAME MCP server for: $PROJECT_DIR"
echo "📋 Your Claude Desktop config now includes multiple projects:"
node -e "
const config = JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8'));
Object.keys(config.mcpServers || {}).forEach(name => {
    if (name.startsWith('cntx-ui-')) {
        console.log('  • ' + name + ': ' + config.mcpServers[name].cwd);
    }
});
"
echo "🔄 Please restart Claude Desktop to use the updated configuration"