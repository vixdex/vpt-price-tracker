const { ethers } = require("ethers");

const chains = [
    { name: "Ethereum", port: 8545, chainId: 1 },
    { name: "Polygon", port: 8546, chainId: 137 },
    { name: "Arbitrum", port: 8547, chainId: 42161 }
];

const abi = [
    "function simulateSwap(address poolAddress, uint256 iv, uint256 price0, uint256 price1) external",
    "function simulateMultipleSwaps(uint256 count) external",
    "function triggerRealisticSwap(address poolAddress) external",
    "function totalSwaps() view returns (uint256)",
    "event AfterVPTSwap(address indexed poolAddress, uint256 iv, uint256 price0, uint256 price1, uint256 timeStamp)"
];

async function verifyEventEmission() {
    console.log("🔍 DIAGNOSTIC: Verifying Smart Contract Event Emission");
    console.log("=" .repeat(60));
    
    // Contract addresses (update these with your actual deployed addresses)
    const contractAddresses = {
        8545: "0x5FbDB2315678afecb367f032d93F642f64180aa3",  // Ethereum
        8546: "0x5FbDB2315678afecb367f032d93F642f64180aa3",                         // Polygon (update after deployment)
        8547: "0x5FbDB2315678afecb367f032d93F642f64180aa3"   // Arbitrum
    };
    
    for (const chain of chains) {
        console.log(`\n🌐 Testing ${chain.name} (Port: ${chain.port})`);
        console.log("-".repeat(40));
        
        try {
            // Connect to local Anvil chain
            const provider = new ethers.JsonRpcProvider(`http://localhost:${chain.port}`);
            const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
            
            console.log(`📡 Connected to ${chain.name} RPC`);
            
            // Get network info
            const network = await provider.getNetwork();
            const blockNumber = await provider.getBlockNumber();
            const balance = await provider.getBalance(signer.address);
            
            console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`   Current Block: ${blockNumber}`);
            console.log(`   Signer Balance: ${ethers.formatEther(balance)} ETH`);
            
            // Create contract instance
            const contract = new ethers.Contract(contractAddresses[chain.port], abi, signer);
            console.log(`   Contract Address: ${contractAddresses[chain.port]}`);
            
            // Check initial state
            try {
                const totalSwaps = await contract.totalSwaps();
                console.log(`   Total Swaps Before: ${totalSwaps}`);
            } catch (error) {
                console.log(`   ⚠️  Could not read totalSwaps: ${error.message}`);
            }
            
            // Test 1: Single swap with detailed verification
            console.log(`\n   🧪 Test 1: Single Swap with Event Verification`);
            
            const poolAddress = "0x123abc456def789012345678901234567890abcd";
            const iv = ethers.parseUnits("15.5", 18);
            const price0 = ethers.parseUnits("2345", 18);
            const price1 = ethers.parseUnits("1789", 18);
            
            console.log(`   📝 Triggering swap:`);
            console.log(`      Pool: ${poolAddress}`);
            console.log(`      IV: 15.5%`);
            console.log(`      Price0: 2345 ETH`);
            console.log(`      Price1: 1789 ETH`);
            
            // Execute transaction
            const tx = await contract.simulateSwap(poolAddress, iv, price0, price1);
            console.log(`   📨 Transaction Hash: ${tx.hash}`);
            
            // Wait for confirmation
            console.log(`   ⏳ Waiting for confirmation...`);
            const receipt = await tx.wait();
            
            console.log(`   ✅ Transaction Confirmed!`);
            console.log(`      Block Number: ${receipt.blockNumber}`);
            console.log(`      Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`      Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
            
            // Check for events in transaction receipt
            console.log(`\n   🔍 Analyzing Transaction Logs:`);
            console.log(`      Total Logs: ${receipt.logs.length}`);
            
            if (receipt.logs.length === 0) {
                console.log(`   ❌ NO EVENTS EMITTED! This is the problem.`);
                console.log(`      The contract might not be emitting events correctly.`);
            } else {
                console.log(`   🎉 Events Found! Decoding...`);
                
                for (let i = 0; i < receipt.logs.length; i++) {
                    const log = receipt.logs[i];
                    console.log(`\n   📋 Log ${i + 1}:`);
                    console.log(`      Address: ${log.address}`);
                    console.log(`      Topics: ${log.topics.length}`);
                    
                    try {
                        // Try to decode with contract interface
                        const decoded = contract.interface.parseLog(log);
                        console.log(`   ✨ DECODED EVENT:`);
                        console.log(`      Event Name: ${decoded.name}`);
                        console.log(`      Pool Address: ${decoded.args.poolAddress}`);
                        console.log(`      IV: ${ethers.formatUnits(decoded.args.iv, 18)}%`);
                        console.log(`      Price0: ${ethers.formatUnits(decoded.args.price0, 18)} ETH`);
                        console.log(`      Price1: ${ethers.formatUnits(decoded.args.price1, 18)} ETH`);
                        console.log(`      Timestamp: ${new Date(Number(decoded.args.timeStamp) * 1000).toISOString()}`);
                        
                        // This confirms events ARE being emitted!
                        console.log(`   🏆 SUCCESS: Events are being emitted correctly!`);
                        
                    } catch (decodeError) {
                        console.log(`   ⚠️  Could not decode log: ${decodeError.message}`);
                        console.log(`      Raw log data:`, {
                            address: log.address,
                            topics: log.topics,
                            data: log.data
                        });
                    }
                }
            }
            
            // Check final state
            try {
                const totalSwapsAfter = await contract.totalSwaps();
                console.log(`\n   📊 Total Swaps After: ${totalSwapsAfter}`);
                
                if (totalSwapsAfter > 0) {
                    console.log(`   ✅ Contract state updated correctly!`);
                } else {
                    console.log(`   ❌ Contract state not updated - possible issue!`);
                }
            } catch (error) {
                console.log(`   ⚠️  Could not read final totalSwaps: ${error.message}`);
            }
            
            // Test 2: Query for recent events using filter
            console.log(`\n   🔎 Test 2: Querying Recent Events`);
            try {
                const filter = contract.filters.AfterVPTSwap();
                const recentEvents = await contract.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
                
                console.log(`   📈 Found ${recentEvents.length} events in block ${receipt.blockNumber}`);
                
                if (recentEvents.length > 0) {
                    const event = recentEvents[0];
                    console.log(`   🎯 Event Data:`);
                    console.log(`      Pool: ${event.args.poolAddress}`);
                    console.log(`      Price0: ${ethers.formatUnits(event.args.price0, 18)}`);
                    console.log(`      Price1: ${ethers.formatUnits(event.args.price1, 18)}`);
                    console.log(`      Block: ${event.blockNumber}`);
                    console.log(`      Transaction: ${event.transactionHash}`);
                }
            } catch (queryError) {
                console.log(`   ❌ Event query failed: ${queryError.message}`);
            }
            
        } catch (error) {
            console.log(`   ❌ ${chain.name} test failed: ${error.message}`);
            console.log(`      Stack: ${error.stack}`);
        }
    }
    
    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔬 DIAGNOSTIC SUMMARY:`);
    console.log(`   1. If you see "Events Found! Decoding..." - Events ARE being emitted`);
    console.log(`   2. If you see "NO EVENTS EMITTED!" - Contract issue`);
    console.log(`   3. If transactions fail - Network/deployment issue`);
    console.log(`   4. If events exist but your app doesn't receive them - WebSocket listener issue`);
    console.log(`${"=".repeat(60)}\n`);
}

// Sequential stress test with proper nonce management
async function stressTestEvents() {
    console.log("⚡ STRESS TEST: Sequential Event Generation");
    console.log("-".repeat(50));
    
    const contractAddresses = {
        8545: "0x5FbDB2315678afecb367f032d93F642f64180aa3"  // Use your working Ethereum address
    };
    
    try {
        const provider = new ethers.JsonRpcProvider("http://localhost:8545");
        const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
        const contract = new ethers.Contract(contractAddresses[8545], abi, signer);
        
        console.log("📨 Sending 5 sequential transactions with proper nonce management...");
        
        // Get starting nonce
        let nonce = await provider.getTransactionCount(signer.address, "pending");
        console.log(`🔢 Starting nonce: ${nonce}`);
        
        const transactions = [];
        
        // Method 1: Sequential with manual nonce management
        for (let i = 0; i < 5; i++) {
            console.log(`   📤 Transaction ${i + 1}/5 (nonce: ${nonce + i})`);
            
            const tx = await contract.simulateSwap(
                "0x123abc456def789012345678901234567890abcd",
                ethers.parseUnits((15 + i).toString(), 18),
                ethers.parseUnits((6000 + i * 100).toString(), 18),
                ethers.parseUnits((1500 + i * 50).toString(), 18),
                {
                    nonce: nonce + i,  // Manual nonce management
                    gasLimit: 50000,   // Explicit gas limit
                    gasPrice: ethers.parseUnits("2", "gwei") // Explicit gas price
                }
            );
            
            transactions.push(tx);
            console.log(`   📝 Hash: ${tx.hash}`);
            
            // Small delay to prevent overwhelming Anvil
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log("⏳ Waiting for all confirmations...");
        const receipts = await Promise.all(transactions.map(tx => tx.wait()));
        
        let totalEvents = 0;
        receipts.forEach((receipt, i) => {
            console.log(`   ✅ Transaction ${i + 1}: Block ${receipt.blockNumber}, ${receipt.logs.length} events`);
            totalEvents += receipt.logs.length;
        });
        
        console.log(`🎉 Total events generated: ${totalEvents}`);
        
        // Check final total
        const finalTotal = await contract.totalSwaps();
        console.log(`📊 Final total swaps: ${finalTotal}`);
        
    } catch (error) {
        console.log(`❌ Sequential stress test failed: ${error.message}`);
    }
}

// Parallel stress test for high-frequency trading simulation
async function parallelStressTest() {
    console.log("🚀 PARALLEL STRESS TEST: High-Frequency Trading Simulation");
    console.log("-".repeat(60));
    
    const contractAddresses = {
        8545: "0x9A676e781A523b5d0C0e43731313A708CB607508"
    };
    
    try {
        const provider = new ethers.JsonRpcProvider("http://localhost:8545");
        const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
        const contract = new ethers.Contract(contractAddresses[8545], abi, signer);
        
        // Get starting nonce
        const startNonce = await provider.getTransactionCount(signer.address, "pending");
        console.log(`🔢 Starting nonce: ${startNonce}`);
        
        // Create 5 transactions with different nonces and escalating gas prices
        const txPromises = [];
        
        console.log("📤 Preparing parallel transactions...");
        for (let i = 0; i < 5; i++) {
            const gasPrice = ethers.parseUnits((2 + i * 0.5).toString(), "gwei"); // Escalating gas prices
            
            const txPromise = contract.simulateSwap(
                "0x123abc456def789012345678901234567890abcd",
                ethers.parseUnits((15 + i).toString(), 18),
                ethers.parseUnits((2000 + i * 100).toString(), 18),
                ethers.parseUnits((1500 + i * 50).toString(), 18),
                {
                    nonce: startNonce + i,
                    gasLimit: 50000,
                    gasPrice: gasPrice
                }
            );
            
            txPromises.push(txPromise);
            console.log(`   📋 Queued transaction ${i + 1} with nonce ${startNonce + i}, gas: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
        }
        
        console.log("📨 Sending all transactions simultaneously...");
        const startTime = Date.now();
        const transactions = await Promise.all(txPromises);
        const submitTime = Date.now() - startTime;
        
        console.log(`⚡ All transactions submitted in ${submitTime}ms`);
        console.log("📝 Transaction hashes:");
        transactions.forEach((tx, i) => {
            console.log(`   ${i + 1}. ${tx.hash}`);
        });
        
        console.log("⏳ Waiting for confirmations...");
        const receipts = await Promise.all(transactions.map(tx => tx.wait()));
        const totalTime = Date.now() - startTime;
        
        let totalEvents = 0;
        let totalGasUsed = 0n;
        receipts.forEach((receipt, i) => {
            console.log(`   ✅ Transaction ${i + 1}: Block ${receipt.blockNumber}, ${receipt.logs.length} events, Gas: ${receipt.gasUsed}`);
            totalEvents += receipt.logs.length;
            totalGasUsed += receipt.gasUsed;
        });
        
        console.log(`\n🎉 PARALLEL STRESS TEST RESULTS:`);
        console.log(`   📊 Total events generated: ${totalEvents}`);
        console.log(`   ⛽ Total gas used: ${totalGasUsed.toString()}`);
        console.log(`   ⏱️  Total time: ${totalTime}ms`);
        console.log(`   📈 Events per second: ${((totalEvents * 1000) / totalTime).toFixed(2)}`);
        
    } catch (error) {
        console.log(`❌ Parallel stress test failed: ${error.message}`);
    }
}

// Multi-chain stress test
async function multiChainStressTest() {
    console.log("🌐 MULTI-CHAIN STRESS TEST: Cross-Network Event Generation");
    console.log("-".repeat(60));
    
    const contractAddresses = {
        8545: "0x9A676e781A523b5d0C0e43731313A708CB607508",  // Ethereum
        8547: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"   // Arbitrum (skip Polygon if broken)
    };
    
    const testChains = [
        { name: "Ethereum", port: 8545 },
        { name: "Arbitrum", port: 8547 }
    ];
    
    try {
        console.log("📤 Triggering simultaneous events across multiple chains...");
        
        const chainPromises = testChains.map(async (chain, chainIndex) => {
            const provider = new ethers.JsonRpcProvider(`http://localhost:${chain.port}`);
            const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
            const contract = new ethers.Contract(contractAddresses[chain.port], abi, signer);
            
            console.log(`   🔗 ${chain.name}: Starting transactions...`);
            
            const transactions = [];
            for (let i = 0; i < 3; i++) {
                const tx = await contract.simulateSwap(
                    "0x123abc456def789012345678901234567890abcd",
                    ethers.parseUnits((15 + chainIndex * 10 + i).toString(), 18),
                    ethers.parseUnits((2000 + chainIndex * 500 + i * 100).toString(), 18),
                    ethers.parseUnits((1500 + chainIndex * 300 + i * 50).toString(), 18)
                );
                
                transactions.push(tx);
                console.log(`   📝 ${chain.name} TX ${i + 1}: ${tx.hash}`);
                
                // Small delay between transactions on same chain
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const receipts = await Promise.all(transactions.map(tx => tx.wait()));
            const totalEvents = receipts.reduce((sum, receipt) => sum + receipt.logs.length, 0);
            
            console.log(`   ✅ ${chain.name}: ${totalEvents} events generated`);
            return { chain: chain.name, events: totalEvents, receipts };
        });
        
        const results = await Promise.all(chainPromises);
        
        console.log(`\n🎊 MULTI-CHAIN RESULTS:`);
        let grandTotal = 0;
        results.forEach(result => {
            console.log(`   🌐 ${result.chain}: ${result.events} events`);
            grandTotal += result.events;
        });
        console.log(`   🏆 Grand Total: ${grandTotal} events across all chains`);
        
    } catch (error) {
        console.log(`❌ Multi-chain stress test failed: ${error.message}`);
    }
}

// Continuous event generation for testing WebSocket persistence
async function continuousEventTest(durationSeconds = 30) {
    console.log(`🔄 CONTINUOUS EVENT TEST: ${durationSeconds}s of steady events`);
    console.log("-".repeat(50));
    
    const contractAddresses = {
        8545: "0x9A676e781A523b5d0C0e43731313A708CB607508"
    };
    
    try {
        const provider = new ethers.JsonRpcProvider("http://localhost:8545");
        const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
        const contract = new ethers.Contract(contractAddresses[8545], abi, signer);
        
        console.log(`⏰ Starting continuous events for ${durationSeconds} seconds...`);
        console.log("💡 Perfect for testing WebSocket connection stability!");
        
        const startTime = Date.now();
        const endTime = startTime + (durationSeconds * 1000);
        let eventCount = 0;
        
        while (Date.now() < endTime) {
            try {
                const tx = await contract.simulateSwap(
                    "0x123abc456def789012345678901234567890abcd",
                    ethers.parseUnits((15 + (eventCount % 10)).toString(), 18),
                    ethers.parseUnits((2000 + (eventCount * 10)).toString(), 18),
                    ethers.parseUnits((1500 + (eventCount * 5)).toString(), 18)
                );
                
                eventCount++;
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                console.log(`   📤 Event ${eventCount} (${elapsed}s): ${tx.hash}`);
                
                // Wait 3 seconds between events
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (error) {
                console.log(`   ⚠️  Error in continuous test: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`🏁 Continuous test complete: ${eventCount} events generated in ${durationSeconds}s`);
        
    } catch (error) {
        console.log(`❌ Continuous test failed: ${error.message}`);
    }
}

async function main() {
    console.log("🚀 VPT Event Emission Diagnostic & Stress Testing Tool");
    console.log("🕐 Timestamp:", new Date().toISOString());
    console.log("=" .repeat(70));
    
    try {
        const mode = process.argv[2];
        
        switch (mode) {
            case "--basic":
                console.log("🔍 Running basic diagnostic...");
                await verifyEventEmission();
                break;
                
            case "--stress":
                console.log("⚡ Running sequential stress test...");
                await stressTestEvents();
                break;
                
            case "--parallel":
                console.log("🚀 Running parallel stress test...");
                await parallelStressTest();
                break;
                
            case "--multichain":
                console.log("🌐 Running multi-chain stress test...");
                await multiChainStressTest();
                break;
                
            case "--continuous":
                const duration = parseInt(process.argv[3]) || 30;
                console.log(`🔄 Running continuous test for ${duration}s...`);
                await continuousEventTest(duration);
                break;
                
            case "--all":
                console.log("🎯 Running complete test suite...");
                await verifyEventEmission();
                console.log("\n" + "=".repeat(70));
                await stressTestEvents();
                console.log("\n" + "=".repeat(70));
                await parallelStressTest();
                console.log("\n" + "=".repeat(70));
                await multiChainStressTest();
                break;
                
            default:
                await verifyEventEmission();
                console.log("\n" + "=".repeat(70));
                console.log("💡 AVAILABLE TEST MODES:");
                console.log("   node tests/trigger-local-events.js --basic        # Basic event verification");
                console.log("   node tests/trigger-local-events.js --stress       # Sequential stress test");
                console.log("   node tests/trigger-local-events.js --parallel     # Parallel trading simulation");
                console.log("   node tests/trigger-local-events.js --multichain   # Cross-network testing");
                console.log("   node tests/trigger-local-events.js --continuous 30 # 30s continuous events");
                console.log("   node tests/trigger-local-events.js --all          # Complete test suite");
                console.log("=" .repeat(70));
                break;
        }
        
    } catch (error) {
        console.error("💥 Fatal error:", error);
    }
    
    console.log("\n✅ Testing complete!");
}

if (require.main === module) {
    main();
}

module.exports = { 
    verifyEventEmission, 
    stressTestEvents, 
    parallelStressTest,
    multiChainStressTest,
    continuousEventTest
};
