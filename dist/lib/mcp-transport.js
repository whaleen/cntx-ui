/**
 * MCP Stdio Transport
 * Handles the low-level communication for the Model Context Protocol
 */
import { MCPServer } from './mcp-server.js';
export function startMCPTransport(cntxServer) {
    // The MCPServer constructor already sets up stdin listener
    const mcpServer = new MCPServer(cntxServer);
    return mcpServer;
}
