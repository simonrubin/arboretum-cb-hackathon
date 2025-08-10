# 🌳 Arboretum - Hackathon Sprint Version

**Real-time Arbitrage Trading Platform with X402 + CDP Integration**

Built for CodeNYC Hackathon 2025 - demonstrating cutting-edge Web3 payments and automated trading.

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

### 2. Frontend Setup  
```bash
# New terminal
cd frontend
bun install
cp .env.example .env.local
bun dev
```

### 3. Open Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 💡 What This Is

Arboretum transforms prediction market arbitrage into an accessible platform where:

1. **Background Detection**: Continuous monitoring finds profitable arbitrage opportunities
2. **Auto-Unlock System**: Alerts unlock automatically when users have sufficient balance
3. **X402 Payments**: Pay $2 USDC per executed trade using real X402 protocol
4. **CDP Integration**: Wallet management and profit distribution via Coinbase Developer Platform
5. **Automated Trading**: Set risk limits once, trades execute automatically

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js UI    │───▶│  FastAPI + X402 │───▶│ Arbitrage Bot   │
│  (Wallet SDK)   │    │   (Payments)    │    │  (Detection)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Coinbase Wallet │    │  Base Network   │    │ Polymarket +    │
│      (CDP)      │    │   (USDC)        │    │    Kalshi       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 Prize Track Integration

### Primary: Most Innovative Use of x402 + CDP ($8,000)
- ✅ **Real X402 Protocol**: Actual micropayments for trade execution
- ✅ **CDP Wallet SDK**: Seamless wallet connection and management  
- ✅ **Base Network**: All transactions on Coinbase's L2
- ✅ **Working Demo**: Live payments and profit distribution

### Innovation Highlights:
- **Pay-per-success model**: Only pay when trades are profitable
- **Auto-unlock system**: Friction-free user experience
- **Real arbitrage**: Actual market inefficiencies exploited
- **Agent-like automation**: Set preferences once, profit continuously

## 🔧 Environment Setup

### Backend (.env)
```bash
# Required for real demo
SERVICE_WALLET_ADDRESS=your_wallet_address
SERVICE_PRIVATE_KEY=your_private_key

# Optional (has fallbacks)
CDP_API_KEY=your_cdp_key
CDP_API_SECRET=your_cdp_secret
```

### Frontend (.env.local)  
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_NETWORK=base-sepolia
```

## Backend environment

Create an `.env` file in `arboretum/backend/` (never commit secrets; `.env` is already ignored) with at least:

```
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=true
DATABASE_URL=sqlite+aiosqlite:///./arboretum.db

BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Service wallet used to receive $0.01 unlock fees
SERVICE_WALLET_ADDRESS=
SERVICE_PRIVATE_KEY=

# Optional: Coinbase CDP
CDP_API_KEY=
CDP_API_SECRET=

# Optional: Coinbase CDP Data SQL API (enables on-chain unlock verification)
CDP_DATA_API_KEY=

# Optional external APIs
POLYMARKET_API_URL=https://clob.polymarket.com
KALSHI_API_URL=https://api.elections.kalshi.com/trade-api/v2
POLYMARKET_API_KEY=
KALSHI_API_KEY=

# WebSocket / Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=change_me

# Demo toggles
DEMO_MODE=true
MOCK_PAYMENTS=true
MOCK_TRADES=true
```

## 💳 Demo Modes

### Demo Mode (No Funds Required)
- Mock wallet balances and transactions
- Simulated arbitrage opportunities
- Full UI/UX experience
- Real code paths (just mocked responses)

### Live Mode (With Testnet Funds)
- Real Coinbase Wallet connection
- Actual X402 USDC payments on Base Sepolia
- Live arbitrage detection
- Real profit distribution

## 🧪 Key Features

### For Users:
- **Connect Wallet**: One-click Coinbase Wallet integration
- **Set Risk Limits**: Max $100/trade, $1000/day, etc.
- **Auto-Execution**: Trades happen automatically when profitable
- **Real Profits**: USDC profits distributed to your wallet
- **Transparent Fees**: $2 execution fee + 5% profit share

### For Developers:
- **Real X402**: Using official x402 FastAPI middleware
- **Real CDP**: Coinbase Advanced Trade API integration
- **Modern Stack**: Next.js 14, FastAPI, SQLAlchemy, WebSockets
- **shadcn/ui**: Beautiful, accessible React components
- **Production Ready**: Error handling, logging, database migrations

## 📊 Demo Script

**Opening** (30s):
"Arboretum automates arbitrage trading using Web3-native payments. Users set risk limits once, then profit automatically from market inefficiencies."

**Live Demo** (4 min):
1. **Wallet Connection** - Real Coinbase Wallet on Base Sepolia
2. **Risk Configuration** - Set max $100/trade, enable auto-execution
3. **Live Arbitrage** - Background detection finds NBA opportunity
4. **Auto-Unlock** - User has sufficient balance, trade unlocks instantly  
5. **X402 Payment** - $2 USDC execution fee paid via X402 protocol
6. **Trade Execution** - Simultaneous orders on Polymarket + Kalshi
7. **Profit Distribution** - $43 profit distributed via CDP

**Closing** (30s):
"This demonstrates the future of automated finance - agents that earn, built on Coinbase's cutting-edge infrastructure."

## 🚀 Current Status

**✅ Completed:**
- Real X402 FastAPI integration with payment verification
- Coinbase CDP service for wallet management and USDC transfers
- Next.js frontend with Coinbase Wallet SDK
- Database models and user management
- Auto-unlock logic based on balance and risk settings

**🔄 In Progress:**
- WebSocket system for real-time alerts
- Dashboard UI with shadcn components  
- Background arbitrage detection job
- End-to-end integration testing

**⏰ Remaining:** ~10 hours to completion

---

**Tech Stack**: FastAPI + X402 + CDP + Next.js + Base + USDC  
**Team**: Built for CodeNYC Hackathon  
**Goal**: Demonstrate real Web3 payments solving real trading problems