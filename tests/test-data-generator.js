const client = require("../src/db");
require("dotenv").config();

class PriceDataGenerator {
    constructor() {
        this.networks = [
            { networkId: "1", name: "ethereum" },
            { networkId: "137", name: "polygon" },
            { networkId: "42161", name: "arbitrum" }
        ];

        this.poolAddresses = [
            "0x123abc456def789012345678901234567890abcd",
            "0x456def789abc012345678901234567890abcdef",
            "0x789abc123def456789012345678901234567890"
        ];
    }

    generateRandomPrice(basePrice = 1.0, volatility = 0.1) {
        const change = (Math.random() - 0.5) * 2 * volatility;
        return Math.max(0.001, basePrice * (1 + change));
    }

    generateRandomIV(baseIV = 15.0, volatility = 5.0) {
        const change = (Math.random() - 0.5) * 2 * volatility;
        return Math.max(1.0, baseIV + change);
    }

    async generatePriceUpdate() {
        const network = this.networks[Math.floor(Math.random() * this.networks.length)];
        const poolAddress = this.poolAddresses[Math.floor(Math.random() * this.poolAddresses.length)];

        const basePoolId = poolAddress.toLowerCase();
        const networkPoolId = `${network.networkId}-${basePoolId}`;

        const price0 = this.generateRandomPrice(2.345, 0.05);
        const price1 = this.generateRandomPrice(1.789, 0.05);
        const iv = this.generateRandomIV();

        const document = {
            meta: {
                poolId: networkPoolId,
                originalPoolId: basePoolId,
                networkId: network.networkId,
                blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
                transactionHash: "0x" + Math.random().toString(16).substr(2, 64)
            },
            price0: price0,
            price1: price1,
            impliedVolatility: iv,
            timestamp: new Date()
        };

        return document;
    }

    async insertSingleUpdate() {
        await client.connect();
        const collection = client.db().collection("priceHistory");

        const document = await this.generatePriceUpdate();
        await collection.insertOne(document);

        console.log(`Inserted price update for pool ${document.meta.originalPoolId} on ${document.meta.networkId}`);
        console.log(`  Price0: ${document.price0}`);
        console.log(`  Price1: ${document.price1}`);
        console.log(`  IV: ${document.impliedVolatility}`);
    }

    async insertContinuousUpdates(intervalMs = 3000, count = 10) {
        console.log(`Starting to insert ${count} price updates every ${intervalMs}ms`);

        for (let i = 0; i < count; i++) {
            await this.insertSingleUpdate();

            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        console.log("Finished inserting test data");
    }

    async insertHistoricalData(count = 50) {
        await client.connect();
        const collection = client.db().collection("priceHistory");

        console.log(`Inserting ${count} historical price points...`);

        const allDocuments = [];
        const baseTime = Date.now() - (count * 60 * 1000); // Start 'count' minutes ago

        for (let i = 0; i < count; i++) {
            const document = await this.generatePriceUpdate();

            // Set historical timestamps
            const timestamp = new Date(baseTime + (i * 60 * 1000)); // 1 minute intervals
            document.timestamp = timestamp;

            allDocuments.push(document);
        }

        await collection.insertMany(allDocuments);
        console.log(`Inserted ${allDocuments.length} historical documents`);
    }
}

// CLI interface for testing
async function main() {
    const generator = new PriceDataGenerator();
    const command = process.argv[2];

    try {
        switch (command) {
            case "single":
                await generator.insertSingleUpdate();
                break;

            case "continuous":
                const interval = parseInt(process.argv[3]) || 3000;
                const count = parseInt(process.argv[4]) || 10;
                await generator.insertContinuousUpdates(interval, count);
                break;

            case "historical":
                const histCount = parseInt(process.argv[3]) || 50;
                await generator.insertHistoricalData(histCount);
                break;

            default:
                console.log("Usage:");
                console.log("  node test-data-generator.js single");
                console.log("  node test-data-generator.js continuous [intervalMs] [count]");
                console.log("  node test-data-generator.js historical [count]");
                break;
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { PriceDataGenerator };
