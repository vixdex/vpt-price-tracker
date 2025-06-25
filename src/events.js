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
        this.isEventListenerActive = false;
        this.pollingInterval = null;
        this.lastCheckedBlock = null;
    }

    async initialize() {
        try {
            // Auto-detect provider type
            if (this.rpcUrl.startsWith('ws://') || this.rpcUrl.startsWith('wss://')) {
                this.provider = new ethers.WebSocketProvider(this.rpcUrl);
            } else {
                this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
            }

            // Create contract instance
            this.hookContract = new ethers.Contract(
                this.hookAddress,
                this.getHookABI(),
                this.provider
            );

            // Get current block for historical data
            this.lastCheckedBlock = await this.provider.getBlockNumber();

            // Fetch historical events first (optional)
            await this.fetchHistoricalEvents();

            // Try event listeners first, fallback to polling
            await this.subscribeToEvents();
            
            console.log(`Connected to ${this.name} RPC`);
            
        } catch (error) {
            console.error(`Failed to initialize ${this.name}:`, error);
            throw error;
        }
    }

    async fetchHistoricalEvents(blocksBack = 1000) {
        try {
            const currentBlock = await this.provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - blocksBack);
            
            console.log(`Fetching historical events for ${this.name} from block ${fromBlock} to ${currentBlock}`);
            
            const events = await this.hookContract.queryFilter(
                "AfterVPTSwap",
                fromBlock,
                currentBlock
            );

            console.log(`Found ${events.length} historical events for ${this.name}`);
            
            // Process historical events
            for (const event of events) {
                const [poolAddress, iv, price0, price1, timeStamp] = event.args;
                await this.handleAfterVPTSwap(poolAddress, iv, price0, price1, timeStamp, event, true);
            }
            
        } catch (error) {
            console.error(`Error fetching historical events for ${this.name}:`, error);
        }
    }

    async subscribeToEvents() {
    // Skip event listeners for BuildBear specifically and go straight to polling
    if (this.rpcUrl.includes('buildbear.io')) {
        console.log(`🔄 BuildBear RPC detected for ${this.name}, using polling directly (BuildBear doesn't support eth_newFilter)`);
        await this.startPolling();
        return;
    }

    // For all other providers, try event listeners first, fallback to polling
    try {
        await this.tryEventListeners();
    } catch (error) {
        console.log(`Event listeners failed for ${this.name}, falling back to polling:`, error.message);
        await this.startPolling();
    }
}


   async tryEventListeners() {
    return new Promise((resolve, reject) => {
        // Set a longer timeout to detect if event listeners are actually working
        const timeout = setTimeout(() => {
            reject(new Error('Event listener validation timeout - falling back to polling'));
        }, 10000); // Increased to 10 seconds

        try {
            // Try to set up event listener
            this.hookContract.on("AfterVPTSwap", async (poolAddress, iv, price0, price1, timeStamp, event) => {
                try {
                    await this.handleAfterVPTSwap(poolAddress, iv, price0, price1, timeStamp, event);
                } catch (error) {
                    console.error(`Error handling AfterVPTSwap on ${this.name}:`, error);
                }
            });

            // Add error handler to detect RPC method failures
            this.provider.on('error', (error) => {
                if (error.message.includes('Method not found') || 
                    error.code === 'SERVER_ERROR' || 
                    error.message.includes('eth_newFilter') ||
                    error.message.includes('eth_getFilterLogs')) {
                    
                    console.log(`Detected unsupported RPC methods for ${this.name}, switching to polling`);
                    clearTimeout(timeout);
                    this.hookContract.removeAllListeners();
                    reject(new Error('RPC methods not supported'));
                    return;
                }
            });

            // Test the event listener setup with a small delay
            setTimeout(() => {
                try {
                    this.hookContract.listenerCount("AfterVPTSwap");
                    clearTimeout(timeout);
                    this.isEventListenerActive = true;
                    console.log(`✅ Event listeners validated for ${this.name}: ${this.hookAddress}`);
                    resolve();
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            }, 2000); // Wait 2 seconds before validating
            
        } catch (error) {
            clearTimeout(timeout);
            reject(error);
        }
    });
}


    async startPolling() {
        const pollInterval = 5000; // 5 seconds
        
        console.log(`🔄 Starting polling for ${this.name}: ${this.hookAddress} (every ${pollInterval/1000}s)`);
        
        this.pollingInterval = setInterval(async () => {
            try {
                const currentBlock = await this.provider.getBlockNumber();
                
                if (currentBlock > this.lastCheckedBlock) {
                    // Query for new events since last check
                    const events = await this.hookContract.queryFilter(
                        "AfterVPTSwap",
                        this.lastCheckedBlock + 1,
                        currentBlock
                    );

                    if (events.length > 0) {
                        console.log(`📊 Found ${events.length} new events for ${this.name} (blocks ${this.lastCheckedBlock + 1}-${currentBlock})`);
                    }

                    // Process each event
                    for (const event of events) {
                        const [poolAddress, iv, price0, price1, timeStamp] = event.args;
                        await this.handleAfterVPTSwap(poolAddress, iv, price0, price1, timeStamp, event);
                    }

                    this.lastCheckedBlock = currentBlock;
                }
            } catch (error) {
                console.error(`Error polling events on ${this.name}:`, error);
                
                // If polling fails repeatedly, try to reinitialize
                if (error.message.includes('connection') || error.message.includes('network')) {
                    console.log(`Network error detected for ${this.name}, attempting to reconnect...`);
                    await this.reconnect();
                }
            }
        }, pollInterval);
    }

    async reconnect() {
        try {
            // Clean up existing connections
            await this.cleanup();
            
            // Wait a bit before reconnecting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Reinitialize
            console.log(`Reconnecting to ${this.name}...`);
            await this.initialize();
            
        } catch (error) {
            console.error(`Failed to reconnect to ${this.name}:`, error);
        }
    }

    async handleAfterVPTSwap(poolAddress, iv, price0, price1, timeStamp, event, isHistorical = false) {
        let eventType;
        if (isHistorical) {
            eventType = '📚 HISTORICAL EVENT';
        } else if (this.isEventListenerActive) {
            eventType = '🔥 REAL-TIME EVENT';
        } else {
            eventType = '📊 POLLED EVENT';
        }
        
        console.log(`${eventType} RECEIVED on ${this.name}:`, {
            poolAddress,
            iv: iv.toString(),
            price0: price0.toString(),
            price1: price1.toString(),
            timeStamp: timeStamp.toString(),
            block: event.blockNumber
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
                transactionHash: event.transactionHash,
                eventSource: isHistorical ? 'historical' : (this.isEventListenerActive ? 'realtime' : 'polling')
            },
            price0: price0Value,
            price1: price1Value,
            impliedVolatility: ivValue,
            timestamp: timestamp
        };

        if (!isHistorical) {
            console.log(`💾 INSERTING DOCUMENT:`, JSON.stringify(document, null, 2));
        }
        
        try {
            await this.collection.insertOne(document);
            const sourceType = isHistorical ? 'historical' : (this.isEventListenerActive ? 'realtime' : 'polling');
            console.log(`✅ DATABASE INSERT SUCCESS - ${this.getNetworkName()} (${sourceType})`);
            
            if (!isHistorical) {
                console.log(`${this.getNetworkName()} - Pool: ${basePoolId}, Price0: ${price0Value}, Price1: ${price1Value}, IV: ${ivValue}`);
            }
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
        // Clean up event listeners
        if (this.hookContract) {
            this.hookContract.removeAllListeners();
        }
        
        // Clean up polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        // Clean up provider
        if (this.provider) {
            if (this.provider.destroy) {
                await this.provider.destroy();
            }
        }
        
        this.isEventListenerActive = false;
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
