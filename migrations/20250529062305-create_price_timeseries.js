module.exports = {
  async up(db) {
    // Create REGULAR collection (not time-series)
    await db.createCollection("priceHistory");
    
    // Create indexes for better query performance
    await db.collection("priceHistory").createIndexes([
      // Index for network-specific queries
      { 
        key: { "meta.networkId": 1, "timestamp": 1 }, 
        name: "networkId_timestamp_idx" 
      }, 
      // Index for pool-specific queries
      { 
        key: { "meta.poolId": 1, "timestamp": 1 }, 
        name: "poolId_timestamp_idx" 
      },
      // Index for cross-network pool queries
      { 
        key: { "meta.originalPoolId": 1, "timestamp": 1 }, 
        name: "originalPoolId_timestamp_idx" 
      }
      // REMOVED: tokenSymbol index (not used anymore)
    ]);

    // Optional: TTL index for automatic data cleanup after 90 days
    await db.collection("priceHistory").createIndex(
      { "timestamp": 1 }, 
      { expireAfterSeconds: 60 * 60 * 24 * 90 }
    );

    console.log("Created priceHistory collection with indexes (no tokenSymbol)");
  },

  async down(db) {
    await db.collection("priceHistory").drop();
  }
};
