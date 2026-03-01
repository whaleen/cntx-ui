/**
 * WebSocket Manager for cntx-ui
 * Handles real-time communication between server and dashboard
 */
import { WebSocketServer, WebSocket } from 'ws';
export default class WebSocketManager {
    bundleManager;
    configManager;
    verbose;
    isMcp;
    clients;
    wss;
    constructor(bundleManager, configManager, options = {}) {
        this.bundleManager = bundleManager;
        this.configManager = configManager;
        this.verbose = options.verbose || false;
        this.isMcp = options.isMcp || false;
        this.clients = new Set();
        this.wss = null;
    }
    log(message) {
        if (this.isMcp) {
            process.stderr.write(message + '\n');
        }
        else {
            console.log(message);
        }
    }
    initialize(httpServer) {
        this.wss = new WebSocketServer({ server: httpServer });
        this.wss.on('connection', (ws) => {
            this.handleConnection(ws);
        });
        this.wss.on('error', (error) => {
            if (this.verbose) {
                console.error('🔌 WebSocket server error:', error.message);
            }
        });
        if (this.verbose) {
            this.log('🔌 WebSocket server initialized');
        }
    }
    handleConnection(ws) {
        this.clients.add(ws);
        if (this.verbose) {
            this.log(`📱 WebSocket client connected (${this.clients.size} total clients)`);
        }
        // Send initial status
        this.sendUpdate(ws);
        ws.on('close', () => {
            this.clients.delete(ws);
            if (this.verbose) {
                this.log(`📱 WebSocket client disconnected (${this.clients.size} total clients)`);
            }
        });
        ws.on('error', (error) => {
            if (this.verbose) {
                console.error('WebSocket client error:', error.message);
            }
            this.clients.delete(ws);
        });
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                this.handleClientMessage(ws, data);
            }
            catch (error) {
                if (this.verbose) {
                    console.error('Invalid WebSocket message:', error.message);
                }
            }
        });
    }
    handleClientMessage(ws, data) {
        if (this.verbose) {
            this.log('📩 Received client message: ' + data.type);
        }
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
            case 'get_status':
                this.sendUpdate(ws);
                break;
            default:
                if (this.verbose) {
                    console.warn('Unknown message type:', data.type);
                }
        }
    }
    get connectedClientsCount() {
        return this.clients.size;
    }
    broadcast(type, payload) {
        const data = JSON.stringify({ type, payload, timestamp: Date.now() });
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(data);
                }
                catch (error) {
                    this.clients.delete(client);
                }
            }
        });
    }
    /**
     * Broadcast a general status update
     */
    broadcastUpdate() {
        if (this.verbose) {
            this.log('📢 Broadcasting status update to all clients');
        }
        this.clients.forEach(client => {
            this.sendUpdate(client);
        });
    }
    sendUpdate(client) {
        if (client.readyState !== WebSocket.OPEN)
            return;
        try {
            const bundles = this.configManager.getBundles();
            const bundleData = Array.from(bundles.entries()).map(([name, bundle]) => ({
                name,
                changed: bundle.changed,
                fileCount: bundle.files.length,
                content: bundle.content ? bundle.content.substring(0, 200) + '...' : '',
                files: bundle.files,
                lastGenerated: bundle.generated,
                size: bundle.size,
                patterns: bundle.patterns
            }));
            const updateData = {
                type: 'status_update',
                payload: {
                    bundles: bundleData,
                    scanning: this.bundleManager.isScanning || false,
                    totalFiles: this.bundleManager.fileSystemManager?.getAllFiles()?.length || 0
                },
                timestamp: Date.now()
            };
            client.send(JSON.stringify(updateData));
        }
        catch (error) {
            if (this.verbose) {
                console.error('Failed to send WebSocket update:', error.message);
            }
            this.clients.delete(client);
        }
    }
    broadcastBundleUpdate(bundleName) {
        if (this.verbose) {
            this.log(`📢 Broadcasting update for bundle: ${bundleName}`);
        }
        const bundle = this.configManager.getBundles().get(bundleName);
        if (!bundle)
            return;
        const updateData = {
            type: 'bundle_update',
            payload: {
                name: bundleName,
                changed: bundle.changed,
                fileCount: bundle.files.length,
                size: bundle.size,
                generated: bundle.generated
            },
            timestamp: Date.now()
        };
        this.broadcastToActiveClients(updateData);
    }
    broadcastFileChange(filename, eventType) {
        const updateData = {
            type: 'file_change',
            payload: {
                filename,
                eventType
            },
            timestamp: Date.now()
        };
        this.broadcastToActiveClients(updateData);
    }
    broadcastStatusUpdate(status) {
        const updateData = {
            type: 'status',
            payload: status,
            timestamp: Date.now()
        };
        this.broadcastToActiveClients(updateData);
    }
    ping() {
        const pingData = { type: 'ping', timestamp: Date.now() };
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(pingData));
            }
            else {
                this.clients.delete(client);
            }
        });
    }
    close() {
        if (this.wss) {
            if (this.verbose) {
                this.log('🔌 Closing WebSocket server');
            }
            this.clients.forEach(client => {
                try {
                    client.terminate();
                }
                catch (error) {
                    if (this.verbose) {
                        console.error('Error closing WebSocket client:', error.message);
                    }
                }
            });
            this.wss.close(() => {
                if (this.verbose) {
                    this.log('🔌 WebSocket server closed');
                }
            });
            this.clients.clear();
        }
    }
    getStatus() {
        return {
            connected: this.clients.size,
            server: this.wss ? 'running' : 'stopped'
        };
    }
    onBundleGenerated(bundleName) {
        this.broadcastBundleUpdate(bundleName);
    }
    onFileChanged(filename, eventType) {
        this.broadcastFileChange(filename, eventType);
        // Also broadcast bundle changes if needed
        const affectedBundles = this.getAffectedBundles(filename);
        affectedBundles.forEach(bundleName => {
            this.broadcastBundleUpdate(bundleName);
        });
    }
    onBundleSyncStarted(bundleName) {
        this.broadcast('bundle_sync_started', { name: bundleName });
    }
    onBundleSyncCompleted(bundleName) {
        this.broadcast('bundle_sync_completed', { name: bundleName });
    }
    onBundleSyncFailed(bundleName, error) {
        this.broadcast('bundle_sync_failed', { name: bundleName, error: error.message });
    }
    broadcastBundleFileChanged(bundleName, filename) {
        this.broadcast('bundle_file_changed', { bundleName, filename });
    }
    broadcastBundleSyncCompleted(bundleName) {
        this.broadcast('bundle_sync_completed', { bundleName });
    }
    broadcastToActiveClients(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                }
                catch (error) {
                    if (this.verbose) {
                        console.error('Failed to send WebSocket update:', error.message);
                    }
                    this.clients.delete(client);
                }
            }
        });
    }
    getAffectedBundles(filename) {
        const bundles = this.configManager.getBundles();
        const affectedBundles = [];
        bundles.forEach((bundle, name) => {
            const matchesBundle = bundle.patterns.some(pattern => this.bundleManager.fileSystemManager.matchesPattern(filename, pattern));
            if (matchesBundle) {
                affectedBundles.push(name);
            }
        });
        return affectedBundles;
    }
}
