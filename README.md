# Algo with NandaX

> AI-Powered Algorithmic Trading SaaS Platform with Zerodha Kite Integration

## 🚀 Overview

**Algo with NandaX** is a comprehensive, full-stack algorithmic trading platform that enables users to create, manage, and deploy AI-powered trading agents. The platform integrates seamlessly with Zerodha Kite API for real-time market data and trade execution.

### Key Features

- 🤖 **AI-Powered Trading Agents** - Deploy intelligent agents that learn and adapt to market conditions
- 💼 **Multiple Account Support** - Connect and manage UNLIMITED Zerodha trading accounts
- 🎨 **Futuristic Animated UI** - World-class dashboard with smooth animations and real-time visualizations
- 📊 **Strategy Builder** - Create and backtest custom trading strategies
- 📈 **Real-time Market Data** - Live quotes, OHLC data, and WebSocket streaming
- ⚡ **Automated Trading** - AI agents trade automatically 24/7 based on your strategies
- 🔐 **Secure OAuth Integration** - Bank-level security with Zerodha Kite OAuth 2.0
- 🔄 **Real-time Updates** - WebSocket notifications for trades, agents, and market data
- 📊 **Live Trading Terminal** - Professional command center with glowing effects and animations
- 💰 **Multi-Account P&L Tracking** - Consolidated view of all accounts and agent performance

## 🏗️ Architecture

### Monorepo Structure

```
algo-with-nandax/
├── apps/
│   ├── api/          # NestJS Backend API
│   └── web/          # Next.js Frontend
├── packages/         # Shared packages (future)
├── docker-compose.yml
└── pnpm-workspace.yaml
```

### Tech Stack

#### Backend (NestJS)
- **Framework**: NestJS with Express
- **Database**: PostgreSQL with TypeORM
- **Cache & Queues**: Redis + Bull
- **Authentication**: JWT with Passport
- **WebSocket**: Socket.io
- **Scheduling**: @nestjs/schedule
- **API Integration**: Zerodha Kite API

#### Frontend (Next.js)
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Icons**: Lucide React

#### Infrastructure
- **Container**: Docker & Docker Compose
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Package Manager**: pnpm

## 📦 Installation

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- Docker & Docker Compose (for containerized setup)
- PostgreSQL 14+ (if running locally)
- Redis 6+ (if running locally)

### Quick Start with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/AmanVatsSharma/algo-with-nandax.git
cd algo-with-nandax

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

The services will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Local Development Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Edit .env files with your configuration

# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Run database migrations
pnpm --filter @algo-nandax/api migration:run

# Start development servers
pnpm dev

# Or start individually
pnpm dev:api   # API on port 3001
pnpm dev:web   # Web on port 3000
```

## 🔧 Configuration

### Backend Environment Variables (apps/api/.env)

```env
# Application
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=algo_trading

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRATION=30d

# Zerodha Kite
KITE_API_KEY=your-kite-api-key
KITE_API_SECRET=your-kite-api-secret
KITE_REDIRECT_URL=http://localhost:3000/auth/kite/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Frontend Environment Variables (apps/web/.env)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh access token

### Strategy Endpoints

- `GET /api/v1/strategies` - List all strategies
- `POST /api/v1/strategies` - Create strategy
- `GET /api/v1/strategies/:id` - Get strategy details
- `PATCH /api/v1/strategies/:id` - Update strategy
- `DELETE /api/v1/strategies/:id` - Delete strategy

### Agent Endpoints

- `GET /api/v1/agents` - List all agents
- `POST /api/v1/agents` - Create agent
- `POST /api/v1/agents/:id/start` - Start agent
- `POST /api/v1/agents/:id/stop` - Stop agent
- `POST /api/v1/agents/:id/pause` - Pause agent

### Trading Endpoints

- `GET /api/v1/trades` - List all trades
- `POST /api/v1/trades` - Execute trade
- `POST /api/v1/trades/:id/close` - Close trade
- `GET /api/v1/trades/stats` - Get trading statistics

### Broker Endpoints

- `GET /api/v1/broker/connections` - List broker connections
- `POST /api/v1/broker/connection` - Create connection
- `GET /api/v1/broker/kite/login-url` - Get Kite login URL
- `POST /api/v1/broker/kite/connect` - Connect to Kite

## 🤖 AI Agent Framework

### Agent Types

1. **AI-Powered Agents**: Use machine learning models for decision making
2. **Rule-Based Agents**: Execute predefined trading rules
3. **Hybrid Agents**: Combine AI and rule-based approaches

### Agent Lifecycle

```
IDLE → RUNNING → (PAUSED) → STOPPED
         ↓
       ERROR
```

### Creating an Agent

```typescript
// Example agent configuration
{
  name: "Momentum Trader",
  strategyId: "strategy-uuid",
  type: "AI_POWERED",
  allocatedCapital: 100000,
  autoTrade: true,
  paperTrading: false,
  aiModelName: "momentum-v1",
  aiModelConfig: {
    indicators: ["RSI", "MACD", "SMA"],
    timeframe: "5min",
    threshold: 0.7
  }
}
```

## 📊 Database Schema

### Core Entities

- **Users** - User accounts and authentication
- **BrokerConnections** - Zerodha Kite API connections
- **Strategies** - Trading strategy definitions
- **Agents** - AI trading agents
- **Trades** - Trade execution records
- **Portfolios** - User portfolios
- **Positions** - Current trading positions

## 🔄 Real-time Features

### WebSocket Events

**Client → Server:**
- `authenticate` - Authenticate WebSocket connection
- `subscribe-market-data` - Subscribe to instrument updates
- `unsubscribe-market-data` - Unsubscribe from instruments

**Server → Client:**
- `market-tick` - Real-time market data updates
- `trade-update` - Trade execution updates
- `agent-update` - Agent status changes
- `portfolio-update` - Portfolio changes
- `notification` - System notifications

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run API tests
pnpm --filter @algo-nandax/api test

# Run with coverage
pnpm --filter @algo-nandax/api test:cov
```

## 🚀 Deployment

### Production Build

```bash
# Build all apps
pnpm build

# Or build individually
pnpm build:api
pnpm build:web
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secrets
4. Configure Zerodha Kite API credentials
5. Set up SSL/TLS certificates

### Docker Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

## 🔐 Security Best Practices

1. **Never commit sensitive credentials** to version control
2. **Use environment variables** for all secrets
3. **Enable JWT token rotation** in production
4. **Implement rate limiting** on public endpoints
5. **Use HTTPS** in production
6. **Encrypt sensitive data** in database
7. **Regular security audits** and dependency updates

## 📈 Performance Optimization

- **Database indexing** on frequently queried fields
- **Redis caching** for market data and quotes
- **Bull queues** for async job processing
- **WebSocket** for real-time updates instead of polling
- **Connection pooling** for database connections
- **CDN** for static assets

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Zerodha Kite API](https://kite.trade/) for broker integration
- [NestJS](https://nestjs.com/) for the backend framework
- [Next.js](https://nextjs.org/) for the frontend framework
- [TypeORM](https://typeorm.io/) for database management

## 📞 Support

For support, email support@algonandax.com or join our Slack channel.

## 🗺️ Roadmap

- [ ] Advanced backtesting engine
- [ ] More broker integrations (Upstox, Angel Broking)
- [ ] Mobile app (React Native)
- [ ] Advanced AI models (LSTM, Transformers)
- [ ] Social trading features
- [ ] Paper trading mode
- [ ] Advanced analytics dashboard
- [ ] Multi-asset support (Crypto, Forex)

---

**Built with ❤️ by the NandaX Team**
