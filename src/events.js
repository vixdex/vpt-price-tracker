const client = require("./db");
const { ethers } = require("ethers");
require("dotenv").config();

class MultiChainEventManager {
    constructor() {
        this.networkManagers = new Map(); // networkId -> NetworkManager
        this.collection = null;
    }

    async initialize() {
        await client.connect();
        this.collection = client.db().collection("priceHistory");

        // Initialize each network from config
        const networks = JSON.parse(process.env.NETWORKS_CONFIG);

        for (const networkConfig of networks) {
            await this.addNetwork(networkConfig);
        }
    }

    async addNetwork(networkConfig) {
        const { networkId, name, rpcUrl, hookAddress } = networkConfig;

        try {
            const networkManager = new NetworkManager(
                networkId,
                name,
                rpcUrl,
                hookAddress,
                this.collection
            );

            await networkManager.initialize();
            this.networkManagers.set(networkId, networkManager);

            console.log(`Added network: ${name} (${networkId})`);
        } catch (error) {
            console.error(`Error adding network ${name}:`, error);
        }
    }

    async cleanup() {
        for (const [networkId, manager] of this.networkManagers) {
            await manager.cleanup();
        }
        this.networkManagers.clear();
    }
}

class NetworkManager {
    constructor(networkId, name, rpcUrl, hookAddress, collection) {
        this.networkId = networkId;
        this.name = name;
        this.rpcUrl = rpcUrl;
        this.hookAddress = hookAddress;
        this.collection = collection;
        this.provider = null;
        this.hookContract = null;
    }

    async initialize() {
        try {
            // Create WebSocketProvider
            this.provider = new ethers.WebSocketProvider(this.rpcUrl);

            // Create contract instance
            this.hookContract = new ethers.Contract(
                this.hookAddress,
                this.getHookABI(),
                this.provider
            );

            await this.subscribeToEvents();
            
            console.log(`Connected to ${this.name} WebSocket`);
            
        } catch (error) {
            console.error(`Failed to initialize ${this.name}:`, error);
            throw error;
        }
    }

    async subscribeToEvents() {
        // Listen to AfterVPTSwap events
        this.hookContract.on("AfterVPTSwap", async (poolAddress, iv, price0, price1, timeStamp, event) => {
            try {
                await this.handleAfterVPTSwap(poolAddress, iv, price0, price1, timeStamp, event);
            } catch (error) {
                console.error(`Error handling AfterVPTSwap on ${this.name}:`, error);
            }
        });

        console.log(`Listening to AfterVPTSwap events on ${this.name}: ${this.hookAddress}`);
    }

    async handleAfterVPTSwap(poolAddress, iv, price0, price1, timeStamp, event) {
        console.log(`🔥 EVENT RECEIVED on ${this.name}:`, {
            poolAddress,
            iv: iv.toString(),
            price0: price0.toString(),
            price1: price1.toString(),
            timeStamp: timeStamp.toString()
        });

        const ivValue = parseFloat(ethers.formatUnits(iv, 18));
        const price0Value = parseFloat(ethers.formatUnits(price0, 18));
        const price1Value = parseFloat(ethers.formatUnits(price1, 18));
        const timestamp = new Date(Number(timeStamp) * 1000);

        const basePoolId = poolAddress.toLowerCase();
        const networkPoolId = `${this.networkId}-${basePoolId}`;

        const document = {
            meta: {
                poolId: networkPoolId,
                originalPoolId: basePoolId,
                networkId: this.networkId,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            },
            price0: price0Value,
            price1: price1Value,
            impliedVolatility: ivValue,
            timestamp: timestamp
        };

        console.log(`💾 INSERTING DOCUMENT:`, JSON.stringify(document, null, 2));
        
        try {
            await this.collection.insertOne(document);
            console.log(`✅ DATABASE INSERT SUCCESS - ${this.getNetworkName()}`);
            console.log(`${this.getNetworkName()} - Pool: ${basePoolId}, Price0: ${price0Value}, Price1: ${price1Value}, IV: ${ivValue}`);
        } catch (error) {
            console.error(`❌ DATABASE INSERT FAILED:`, error);
        }
    }

    getNetworkName() {
        const networks = {
            "1": "ethereum",
            "137": "polygon",
            "42161": "arbitrum",
            "10": "optimism",
            "56": "bsc"
        };
        return networks[this.networkId] || "unknown";
    }

    getHookABI() {
        return [
            "event AfterVPTSwap(address indexed poolAddress, uint iv, uint price0, uint price1, uint timeStamp)"
        ];
    }

    async cleanup() {
        if (this.hookContract) {
            this.hookContract.removeAllListeners();
        }
        if (this.provider) {
            await this.provider.destroy();
        }
    }
}


// Initialize and start the event manager
const eventManager = new MultiChainEventManager();

async function startEventListener() {
    try {
        await eventManager.initialize();
        console.log("Multi-chain event manager initialized successfully");
    } catch (error) {
        console.error("Error starting event listener:", error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down event listener...');
    await eventManager.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down event listener...');
    await eventManager.cleanup();
    process.exit(0);
});

module.exports = { startEventListener, eventManager };
