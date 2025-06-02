const client = require("./db");
const { Server } = require("socket.io");  

module.exports = async function startStream(httpServer) {
    await client.connect();
    const coll = client.db().collection("priceHistory");

    const io = new Server(httpServer, {
        cors: {
            origin: "*", // change to actual frontend site
            methods: ["GET", "POST"],
        }
    });

    io.on("connection", (socket) => {
        console.log(`Client Connected: ${socket.id}`);
        
        socket.on("subscribe", (roomId) => {
            socket.join(roomId);
            console.log(`Client ${socket.id} connected to room ${roomId}`); 
        });
        
        socket.on("unsubscribe", (roomId) => {
            socket.leave(roomId);
            console.log(`Client ${socket.id} left the room ${roomId}`);
        });
        
        socket.on("disconnect", () => {
            console.log(`Client ${socket.id} disconnected`);
        });
    });

    const changeStream = coll.watch();
    changeStream.on("change", ({ fullDocument }) => {
        if (!fullDocument) {
            return;
        }
        
        const { poolId, originalPoolId, networkId } = fullDocument.meta;
        const updatePayload = {
            poolId: originalPoolId,
            networkPoolId: poolId,
            networkId,
            price0: fullDocument.price0,
            price1: fullDocument.price1,
            impliedVolatility: fullDocument.impliedVolatility,
            timestamp: fullDocument.timestamp,
            blockNumber: fullDocument.meta.blockNumber,
            transactionHash: fullDocument.meta.transactionHash
        };
        
        // For all connected to the pool
        io.to(poolId).emit("priceUpdate", updatePayload);
        // For all the devices that did not specify network
        io.to(originalPoolId).emit("priceUpdate", updatePayload);
        // Throughout the network
        io.to(`network-${networkId}`).emit("priceUpdate", updatePayload);
        
        console.log(`Broadcasted price update: ${originalPoolId} on network ${networkId}, Price0: ${fullDocument.price0}, Price1: ${fullDocument.price1}`);
    });

    changeStream.on("error", (error) => {
        console.error("Change stream error:", error);
    });

    console.log("WebSocket streaming initialized");
};
