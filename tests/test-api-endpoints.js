const axios = require('axios');

class APITester {
    constructor(baseUrl = "http://localhost:4000") {
        this.baseUrl = baseUrl;
    }

    async testHealthEndpoint() {
        console.log("🏥 Testing health endpoint...");
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            const data = response.data;
            console.log("✅ Health check:", data);
        } catch (error) {
            console.error("❌ Health check failed:", error.message);
        }
    }

    async testPricesEndpoint() {
        console.log("\n📊 Testing prices endpoint...");

        const testCases = [
            "/api/prices?limit=5",
            "/api/prices?networkId=1&limit=3",
            "/api/prices?poolId=0x123abc456def789012345678901234567890abcd&limit=3"
        ];

        for (const testCase of testCases) {
            try {
                console.log(`\n🔍 Testing: ${testCase}`);
                const response = await axios.get(`${this.baseUrl}${testCase}`);
                const data = response.data;

                if (Array.isArray(data)) {
                    console.log(`✅ Returned ${data.length} records`);
                    if (data.length > 0) {
                        const sample = data[0];
                        console.log(`   Sample: Pool ${sample.meta?.originalPoolId}, Price0: ${sample.price0}, Price1: ${sample.price1}`);
                    }
                } else {
                    console.log("📋 Response:", data);
                }
            } catch (error) {
                console.error(`❌ Test failed for ${testCase}:`, error.message);
            }
        }
    }

    async testPoolsEndpoint() {
        console.log("\n🏊 Testing pools endpoint...");
        try {
            const response = await axios.get(`${this.baseUrl}/api/pools`);
            const data = response.data;
            console.log(`✅ Found ${data.length} pools:`, data);
        } catch (error) {
            console.error("❌ Pools test failed:", error.message);
        }
    }

    async runAllTests() {
        await this.testHealthEndpoint();
        await this.testPricesEndpoint();
        await this.testPoolsEndpoint();
    }
}

async function main() {
    const tester = new APITester();
    await tester.runAllTests();
}

if (require.main === module) {
    main();
}

module.exports = { APITester };
