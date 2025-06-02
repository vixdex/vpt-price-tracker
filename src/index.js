const express = require("express");
const http = require("http");
const cors = require("cors");
const startStream = require("./stream");
const routes = require("./routes");
const { startEventListener } = require("./events");
require("dotenv").config();

const app = express();

//Middleware
app.use(cors());
app.use(express.json());
app.use("/api", routes);

//Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

server.listen(process.env.PORT, async () => {
    console.log(`Server listening on port ${process.env.PORT}`);

    try {
        await startStream(server);
        console.log("WebSocket streaming started");
        await startEventListener();
        console.log("Blockchain event listener started");

    }
    catch (err) {
        console.log("error: ", err);  
        process.exit(1);
    }
});
