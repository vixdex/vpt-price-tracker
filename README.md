# 📈 VPT Price Tracker

A **multi-chain real-time price tracking system** for VPT (Volatility Price Tokens). This service listens to smart contract events across Ethereum, Polygon, and Arbitrum, stores price data in MongoDB, and streams real-time updates to clients via WebSocket.

---

## 🔧 Functionality

* 📡 Listens to `AfterVPTSwap` events from deployed smart contracts on multiple blockchains.
* 📂 Stores price updates (with network context) in a MongoDB replica set.
* 🌐 Provides REST API endpoints for historical price data, with filtering by network and pool.
* 🔌 Streams real-time price updates to subscribed clients via WebSocket.

---

## 🏗️ Architecture

* **Event Listeners:** Independent WebSocket connections to each blockchain network.
* **Database:** MongoDB replica set using change streams for real-time event detection.
* **API Server:** Express.js server that exposes REST endpoints and WebSocket streams.
* **Clients:** Frontend/services subscribe to WebSocket rooms for live updates.

---

## 👥 Team Integration

### For Smart Contract Developers

* Deploy VPT contracts locally or on testnets/mainnet.
* Update configuration with contract addresses in `.env`.
* The system **automatically starts listening** to events from new contracts.

### For Frontend Developers

* REST API:
  `GET /api/prices?networkId=1&limit=100` for historical data.
* WebSocket:
  Connect to `ws://localhost:4000` and subscribe to price updates.
* Filtering support by:

  * Network
  * Pool
  * Cross-chain data

### For Trading & Analytics Teams

* Use **real-time price feeds** for automated trading strategies.
* Leverage **historical data** for backtesting and analytics.
* Multi-chain support enables **arbitrage opportunities** across networks.

---

## ➕ Adding New Networks

1. Deploy contracts to the new network.
2. Add the network config to `NETWORKS_CONFIG` in `.env`.
3. The system will automatically start monitoring the new chain.

---

## 🚀 Quick Start

### 1. Start Infrastructure

```bash
docker compose up -d
npx migrate-mongo up
```

### 2. Configure Contracts

```bash
cp .env.example .env
# Edit .env with your contract addresses and network configs
```

### 3. Start the System

```bash
npm start
```

### 4. Test with Local Blockchain

```bash
node tests/trigger-local-events.js --basic
```

---

## 🔁 API Examples

### REST API

* **Get latest prices across all networks:**

```bash
curl "http://localhost:4000/api/prices?limit=50"
```

* **Get Ethereum-only prices:**

```bash
curl "http://localhost:4000/api/prices?networkId=1&limit=20"
```

* **Get specific pool data:**

```bash
curl "http://localhost:4000/api/prices?poolId=0x123...&limit=100"
```

### WebSocket Integration

```js
const socket = io("http://localhost:4000");

// Subscribe to all price updates on Ethereum
socket.emit("subscribe", "network-1");

// Subscribe to a specific pool across all networks
socket.emit("subscribe", "0x123abc...");

// Listen for real-time updates
socket.on("priceUpdate", (data) => {
  console.log(`Price update: ${data.price0} / ${data.price1}`);
});
```

---

## 📂 Project Structure (Optional)

If useful, you can include a folder structure like:

```
├── api/
├── listeners/
├── utils/
├── tests/
├── .env.example
├── docker-compose.yml
├── README.md
└── index.js
```

---

## 📜 License

MIT © \[Your Name or Org]
