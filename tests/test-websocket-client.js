const io = require("socket.io-client");

class WebSocketTester {
    constructor(serverUrl = "http://localhost:4000") {
        this.socket = io(serverUrl);
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.socket.on("connect", () => {
            console.log("✅ Connected to WebSocket server");
            console.log("Socket ID:", this.socket.id);
        });

        this.socket.on("disconnect", () => {
            console.log("❌ Disconnected from WebSocket server");
        });

        this.socket.on("priceUpdate", (data) => {
            console.log("📈 Price Update Received:");
            console.log(`  Pool: ${data.poolId} (Network: ${data.networkId})`);
            console.log(`  Price0: ${data.price0}`);
            console.log(`  Price1: ${data.price1}`);
            console.log(`  IV: ${data.impliedVolatility}`);
            console.log(`  Time: ${new Date(data.timestamp).toISOString()}`);
            console.log("---");
        });

        this.socket.on("connect_error", (error) => {
            console.error("Connection error:", error);
        });
    }

    subscribeToPool(poolId, networkId = null) {
        const roomId = networkId ? `${networkId}-${poolId}` : poolId;
        this.socket.emit("subscribe", roomId);
        console.log(`🔔 Subscribed to room: ${roomId}`);
    }

    subscribeToNetwork(networkId) {
        const roomId = `network-${networkId}`;
        this.socket.emit("subscribe", roomId);
        console.log(`🔔 Subscribed to network: ${networkId}`);
    }

    unsubscribe(roomId) {
        this.socket.emit("unsubscribe", roomId);
        console.log(`🔕 Unsubscribed from room: ${roomId}`);
    }

    disconnect() {
        this.socket.disconnect();
    }
}

// CLI interface
async function main() {
    const client = new WebSocketTester();

    // Example subscriptions - modify as needed
    const poolAddress = "0x123abc456def789012345678901234567890abcd";

    // Subscribe to different room types
    client.subscribeToPool(poolAddress, "1");  // Ethereum-specific
    client.subscribeToPool(poolAddress);       // Cross-network
    client.subscribeToNetwork("137");          // All Polygon pools

    console.log("WebSocket client running... Press Ctrl+C to exit");

    // Keep the process running
    process.on('SIGINT', () => {
        console.log("\nDisconnecting...");
        client.disconnect();
        process.exit(0);
    });
}

if (require.main === module) {
    main();
}

module.exports = { WebSocketTester };
