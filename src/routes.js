const express = require("express");
const client = require("./db");
const router = express.Router();

router.get("/prices", async (req, res) => {
    try { 
        const { poolId, networkId, limit = 1000 } = req.query;
        
        let filter = {};
        if(poolId && networkId){
            filter["meta.poolId"] = `${networkId}-${poolId.toLowerCase()}`;
        }
        else if(poolId){
            filter["meta.originalPoolId"] = poolId.toLowerCase(); 
        }
        else if(networkId){
            filter["meta.networkId"] = networkId;
        }

        const docs = await client
            .db()
            .collection("priceHistory")
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(Number(limit))
            .toArray();
        
        res.json(docs.reverse());
    } catch(err) {
        console.error("Error fetching prices:", err);
        res.status(500).json({error: "Internal server error"});
    }
});

router.get("/pools", async(req, res) => {
    try{
        const { networkId } = req.query;

        let filter = {};
        if(networkId){
            filter["meta.networkId"] = networkId;
        }

        const pools = await client
            .db()
            .collection("priceHistory")
            .distinct("meta.originalPoolId", filter);  

        res.json(pools);

    } catch(err) {
        console.error("Error fetching pools:", err);
        res.status(500).json({error: "Internal server error"}); 
    }
});

module.exports = router;
