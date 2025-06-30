/**
 * WebSocket Manager for cntx-ui
 * Handles real-time client communication and updates
 */

import { WebSocketServer } from 'ws';

export default class WebSocketManager {
  constructor(bundleManager, configManager, options = {}) {
    this.bundleManager = bundleManager;
    this.configManager = configManager;
    this.verbose = options.verbose || false;
    this.clients = new Set();
    this.wss = null;
  }

  // === WebSocket Server Setup ===

  initialize(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    if (this.verbose) {
      console.log('🔌 WebSocket server initialized');
    }
  }

  handleConnection(ws) {
    // Add client to our set
    this.clients.add(ws);
    if (this.verbose) {
      console.log(`📱 WebSocket client connected (${this.clients.size} total clients)`);
    }

    // Send initial update to the new client
    this.sendUpdate(ws);

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
      if (this.verbose) {
        console.log(`📱 WebSocket client disconnected (${this.clients.size} total clients)`);
      }
    });

    // Handle client errors
    ws.on('error', (error) => {
      if (this.verbose) {
        console.error('WebSocket client error:', error.message);
      }
      this.clients.delete(ws);
    });

    // Optional: Handle incoming messages from clients
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleClientMessage(ws, data);
      } catch (error) {
        if (this.verbose) {
          console.error('Invalid WebSocket message:', error.message);
        }
      }
    });
  }

  handleClientMessage(ws, data) {
    // Handle different types of client messages
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'request-update':
        this.sendUpdate(ws);
        break;

      case 'subscribe':
        // Future: Handle subscription to specific bundle updates
        ws.subscriptions = data.bundles || [];
        break;

      default:
        if (this.verbose) {
          console.warn('Unknown WebSocket message type:', data.type);
        }
    }
  }

  // === Client Management ===

  getClientCount() {
    return this.clients.size;
  }

  getActiveClients() {
    // Filter out clients that might be in a closed state
    const activeClients = new Set();

    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        activeClients.add(client);
      } else {
        // Remove dead connections
        this.clients.delete(client);
      }
    });

    return activeClients;
  }

  // === Broadcasting Updates ===

  broadcastUpdate() {
    const activeClients = this.getActiveClients();

    if (activeClients.size === 0) {
      return; // No clients to update
    }

    if (this.verbose) {
      console.log(`📡 Broadcasting update to ${activeClients.size} client(s)`);
    }

    activeClients.forEach(client => {
      this.sendUpdate(client);
    });
  }

  sendUpdate(client) {
    if (client.readyState !== 1) { // Not WebSocket.OPEN
      return;
    }

    try {
      const updateData = this.prepareUpdateData();
      client.send(JSON.stringify(updateData));
    } catch (error) {
      if (this.verbose) {
        console.error('Failed to send WebSocket update:', error.message);
      }
      this.clients.delete(client);
    }
  }

  prepareUpdateData() {
    const bundles = this.configManager.getBundles();

    const bundleData = Array.from(bundles.entries()).map(([name, bundle]) => ({
      name,
      changed: bundle.changed,
      fileCount: bundle.files.length,
      content: bundle.content.substring(0, 2000) + (bundle.content.length > 2000 ? '...' : ''),
      files: bundle.files,
      lastGenerated: bundle.generated,
      size: bundle.size,
      patterns: bundle.patterns
    }));

    return {
      type: 'bundle-update',
      timestamp: new Date().toISOString(),
      bundles: bundleData,
      serverStatus: {
        uptime: process.uptime(),
        scanning: this.bundleManager._isScanning || false,
        totalFiles: this.bundleManager.fileSystemManager?.getAllFiles()?.length || 0
      }
    };
  }

  // === Targeted Updates ===

  broadcastBundleUpdate(bundleName) {
    const activeClients = this.getActiveClients();

    if (activeClients.size === 0) {
      return;
    }

    if (this.verbose) {
      console.log(`📡 Broadcasting ${bundleName} bundle update to ${activeClients.size} client(s)`);
    }

    const bundle = this.configManager.getBundles().get(bundleName);
    if (!bundle) {
      return;
    }

    const updateData = {
      type: 'bundle-specific-update',
      timestamp: new Date().toISOString(),
      bundleName,
      bundle: {
        name: bundleName,
        changed: bundle.changed,
        fileCount: bundle.files.length,
        content: bundle.content.substring(0, 2000) + (bundle.content.length > 2000 ? '...' : ''),
        files: bundle.files,
        lastGenerated: bundle.generated,
        size: bundle.size,
        patterns: bundle.patterns
      }
    };

    activeClients.forEach(client => {
      try {
        if (client.readyState === 1) {
          client.send(JSON.stringify(updateData));
        }
      } catch (error) {
        if (this.verbose) {
          console.error('Failed to send bundle update:', error.message);
        }
        this.clients.delete(client);
      }
    });
  }

  broadcastFileChange(filename, eventType) {
    const activeClients = this.getActiveClients();

    if (activeClients.size === 0) {
      return;
    }

    const updateData = {
      type: 'file-change',
      timestamp: new Date().toISOString(),
      filename,
      eventType,
      message: `File ${eventType}: ${filename}`
    };

    activeClients.forEach(client => {
      try {
        if (client.readyState === 1) {
          client.send(JSON.stringify(updateData));
        }
      } catch (error) {
        if (this.verbose) {
          console.error('Failed to send file change update:', error.message);
        }
        this.clients.delete(client);
      }
    });
  }

  broadcastStatusUpdate(status) {
    const activeClients = this.getActiveClients();

    if (activeClients.size === 0) {
      return;
    }

    const updateData = {
      type: 'status-update',
      timestamp: new Date().toISOString(),
      status
    };

    activeClients.forEach(client => {
      try {
        if (client.readyState === 1) {
          client.send(JSON.stringify(updateData));
        }
      } catch (error) {
        if (this.verbose) {
          console.error('Failed to send status update:', error.message);
        }
        this.clients.delete(client);
      }
    });
  }

  // === Utility Methods ===

  ping() {
    const activeClients = this.getActiveClients();

    const pingData = {
      type: 'ping',
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    };

    activeClients.forEach(client => {
      try {
        if (client.readyState === 1) {
          client.send(JSON.stringify(pingData));
        }
      } catch (error) {
        this.clients.delete(client);
      }
    });
  }

  // === Cleanup ===

  close() {
    if (this.wss) {
      if (this.verbose) {
        console.log('🔌 Closing WebSocket server...');
      }

      // Close all client connections
      this.clients.forEach(client => {
        try {
          if (client.readyState === 1) {
            client.close(1000, 'Server shutting down');
          }
        } catch (error) {
          if (this.verbose) {
            console.error('Error closing WebSocket client:', error.message);
          }
        }
      });

      // Close the WebSocket server
      this.wss.close(() => {
        if (this.verbose) {
          console.log('🔌 WebSocket server closed');
        }
      });

      this.clients.clear();
    }
  }

  // === Health Check ===

  getHealthStatus() {
    return {
      connected: this.clients.size,
      active: this.getActiveClients().size,
      server: this.wss ? 'running' : 'stopped'
    };
  }

  // === Event Handlers for Integration ===

  onBundleGenerated(bundleName) {
    this.broadcastBundleUpdate(bundleName);
    this.broadcastBundleSyncCompleted(bundleName);
  }

  onBundlesGenerated() {
    this.broadcastUpdate();
  }

  onConfigChanged() {
    this.broadcastUpdate();
  }

  onFileChanged(filename, eventType) {
    // Notify which bundles are affected by this file change
    const affectedBundles = this.getAffectedBundles(filename);

    affectedBundles.forEach(bundleName => {
      this.broadcastBundleFileChanged(bundleName, filename);
    });

    this.broadcastFileChange(filename, eventType);

    // Also broadcast bundle updates after a short delay to allow bundle regeneration
    setTimeout(() => {
      this.broadcastUpdate();
    }, 500);
  }

  // === New Bundle Sync Event Handlers ===

  onBundleSyncStarted(bundleName) {
    const updateData = {
      type: 'bundle-sync-started',
      bundleName,
      timestamp: new Date().toISOString()
    };
    this.broadcastToActiveClients(updateData);
  }

  onBundleSyncCompleted(bundleName) {
    const updateData = {
      type: 'bundle-sync-completed',
      bundleName,
      timestamp: new Date().toISOString()
    };
    this.broadcastToActiveClients(updateData);
  }

  onBundleSyncFailed(bundleName, error) {
    const updateData = {
      type: 'bundle-sync-failed',
      bundleName,
      error: error.message || error,
      timestamp: new Date().toISOString()
    };
    this.broadcastToActiveClients(updateData);
  }

  broadcastBundleFileChanged(bundleName, filename) {
    const updateData = {
      type: 'bundle-file-changed',
      bundleName,
      filename,
      timestamp: new Date().toISOString()
    };
    this.broadcastToActiveClients(updateData);
  }

  broadcastBundleSyncCompleted(bundleName) {
    const updateData = {
      type: 'bundle-sync-completed',
      bundleName,
      timestamp: new Date().toISOString()
    };
    this.broadcastToActiveClients(updateData);
  }

  // Helper method to broadcast to all active clients
  broadcastToActiveClients(data) {
    const activeClients = this.getActiveClients();

    if (activeClients.size === 0) {
      return;
    }

    activeClients.forEach(client => {
      try {
        if (client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      } catch (error) {
        if (this.verbose) {
          console.error('Failed to send WebSocket update:', error.message);
        }
        this.clients.delete(client);
      }
    });
  }

  // Helper to find which bundles are affected by a file change
  getAffectedBundles(filename) {
    const bundles = this.configManager.getBundles();
    const affectedBundles = [];

    bundles.forEach((bundle, name) => {
      const matchesBundle = bundle.patterns.some(pattern =>
        this.bundleManager.fileSystemManager.matchesPattern(filename, pattern)
      );

      if (matchesBundle) {
        affectedBundles.push(name);
      }
    });

    return affectedBundles;
  }

  onHiddenFilesChanged() {
    this.broadcastUpdate();
  }

  onIgnorePatternsChanged() {
    this.broadcastUpdate();
  }
}
