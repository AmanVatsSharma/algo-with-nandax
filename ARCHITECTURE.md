# Architecture Documentation - Algo with NandaX

## System Overview

Algo with NandaX is a full-stack, cloud-ready algorithmic trading platform built with a modern microservices-inspired architecture. The system is designed for scalability, maintainability, and real-time performance.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend Layer                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Next.js 14 (App Router)                     │   │
│  │  - Server Components                                 │   │
│  │  - Client Components                                 │   │
│  │  - TanStack Query (Data Fetching)                   │   │
│  │  - Zustand (State Management)                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              NestJS API Server                      │   │
│  │  - RESTful API Endpoints                            │   │
│  │  - WebSocket Gateway                                │   │
│  │  - Authentication (JWT)                             │   │
│  │  - Request Validation                               │   │
│  │  - Rate Limiting                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
                ▼           ▼           ▼
    ┌──────────────┐  ┌──────────┐  ┌──────────────┐
    │  PostgreSQL  │  │  Redis   │  │  Bull Queue  │
    │   Database   │  │  Cache   │  │   Workers    │
    └──────────────┘  └──────────┘  └──────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   External Services   │
                │  - Zerodha Kite API   │
                │  - AI/ML Models       │
                └───────────────────────┘
```

## Core Modules

### 1. Authentication Module (`auth`)

**Responsibility**: User authentication and authorization

**Components**:
- JWT token generation and validation
- Passport strategies (Local, JWT)
- Token refresh mechanism
- Role-based access control (RBAC)

**Flow**:
```
User Login → Validate Credentials → Generate JWT → Store Refresh Token → Return Tokens
```

**Security**:
- bcrypt for password hashing (10 rounds)
- HTTP-only cookies for sensitive tokens
- Token rotation on refresh
- Automatic token expiration

### 2. Users Module (`users`)

**Responsibility**: User management and profiles

**Entities**:
- User profile information
- Subscription tiers (Free, Basic, Pro, Enterprise)
- User roles (Admin, User, Premium)
- Account settings

**Features**:
- User CRUD operations
- Soft deletes for data retention
- Email verification
- Last login tracking

### 3. Broker Module (`broker`)

**Responsibility**: Integration with trading brokers

**Current Support**:
- Zerodha Kite API

**Key Features**:
- OAuth-based authentication
- API key management
- Session token handling
- Connection status monitoring
- Multi-broker support architecture

**Kite API Integration**:
```typescript
// Authentication Flow
1. Generate login URL with API key
2. User authenticates on Kite
3. Receive request token
4. Generate access token using request token + API secret
5. Store access token (valid for 24 hours)
6. Use access token for all subsequent requests
```

**Supported Operations**:
- Place, modify, cancel orders
- Fetch positions, holdings
- Get quotes, OHLC data
- Historical data retrieval
- Instrument search

### 4. Strategy Module (`strategy`)

**Responsibility**: Trading strategy definition and management

**Strategy Types**:
- Momentum
- Mean Reversion
- Arbitrage
- Scalping
- Swing Trading
- Custom

**Components**:
- Strategy configuration
- Entry/exit rules
- Risk parameters (stop loss, take profit)
- Position sizing
- Backtesting results
- Performance metrics

**Data Model**:
```typescript
Strategy {
  id: UUID
  name: string
  type: StrategyType
  timeFrame: TimeFrame
  instruments: string[]
  maxCapitalPerTrade: number
  stopLossPercentage: number
  takeProfitPercentage: number
  maxPositions: number
  entryRules: JSON
  exitRules: JSON
  configuration: JSON
  performance: {
    totalTrades: number
    winRate: number
    totalPnL: number
  }
}
```

### 5. Agents Module (`agents`)

**Responsibility**: AI trading agent lifecycle management

**Agent Types**:
- **AI-Powered**: Uses ML models for decisions
- **Rule-Based**: Executes predefined rules
- **Hybrid**: Combines AI and rules

**Agent States**:
```
IDLE → RUNNING → PAUSED → STOPPED
       ↓
     ERROR
```

**Execution Flow**:
```
1. Agent Status Check (every minute via cron)
2. Fetch Market Data
3. Run Strategy Logic
4. Make Trading Decision (AI/Rules)
5. Execute Trade (if conditions met)
6. Update Performance Metrics
7. Send Real-time Updates via WebSocket
```

**Performance Tracking**:
- Total trades executed
- Active positions
- P&L (daily, total)
- ROI (Return on Investment)
- Sharpe ratio
- Max drawdown

### 6. Trading Module (`trading`)

**Responsibility**: Trade execution and management

**Components**:
- Trade lifecycle management
- Order placement via Bull queue
- Order status tracking
- P&L calculation
- Trade history

**Trade Execution Flow**:
```
1. Receive Trade Signal from Agent
2. Validate Capital Availability
3. Queue Order for Execution (Bull)
4. Place Order via Broker API
5. Update Trade Record with Order ID
6. Monitor Order Status
7. Update P&L on Execution
8. Notify User via WebSocket
```

**Order Types Supported**:
- Market
- Limit
- Stop Loss
- Stop Loss Market

### 7. Portfolio Module (`portfolio`)

**Responsibility**: Portfolio and position management

**Features**:
- Multiple portfolios per user
- Real-time position tracking
- Unrealized/realized P&L
- Portfolio analytics
- Historical performance

**Data Structure**:
```
Portfolio
  ├── Initial Capital
  ├── Current Capital
  ├── Total P&L
  └── Positions[]
        ├── Symbol
        ├── Quantity
        ├── Average Price
        ├── Current Price
        └── Unrealized P&L
```

### 8. Market Data Module (`market-data`)

**Responsibility**: Real-time and historical market data

**Data Sources**:
- Live quotes via Kite API
- OHLC data
- Historical candle data
- WebSocket streaming (planned)

**Caching Strategy**:
- Redis cache for quotes (TTL: 1 second)
- Historical data cache (TTL: 1 hour)
- Instrument list cache (TTL: 24 hours)

### 9. WebSocket Module (`websocket`)

**Responsibility**: Real-time bidirectional communication

**Events**:

**Client → Server**:
- `authenticate` - User authentication
- `subscribe-market-data` - Subscribe to instruments
- `unsubscribe-market-data` - Unsubscribe

**Server → Client**:
- `market-tick` - Real-time price updates
- `trade-update` - Trade execution updates
- `agent-update` - Agent status changes
- `portfolio-update` - Portfolio changes
- `notification` - System notifications

**Room Structure**:
- User rooms: `user:{userId}`
- Market data rooms: `market:{instrument}`

## Database Schema

### Entity Relationships

```
User (1) ─────────(N) BrokerConnection
  │
  ├─────────(N) Strategy
  │                │
  │                └─────(N) Agent
  │                         │
  │                         └─────(N) Trade
  │
  └─────────(N) Portfolio
                  │
                  └─────(N) Position
```

### Key Indexes

```sql
-- Performance indexes
CREATE INDEX idx_trades_user_status ON trades(userId, status);
CREATE INDEX idx_trades_agent_status ON trades(agentId, status);
CREATE INDEX idx_trades_symbol_created ON trades(symbol, createdAt);
CREATE INDEX idx_agents_user_status ON agents(userId, status);
CREATE INDEX idx_strategies_user_status ON strategies(userId, status);
```

## Job Queue Architecture

### Bull Queue System

**Queues**:

1. **Trading Queue** (`trading`)
   - Place order jobs
   - Close trade jobs
   - Order status updates

2. **Agents Queue** (`agents`)
   - Strategy execution jobs
   - Agent monitoring
   - Performance updates

3. **Market Data Queue** (`market-data`)
   - Data fetching jobs
   - Cache updates
   - Historical data sync

**Job Processing**:
```
API Request → Add Job to Queue → Redis → Bull Worker → Process → Update DB → WebSocket Notify
```

**Error Handling**:
- Automatic retry (3 attempts)
- Exponential backoff
- Dead letter queue for failed jobs
- Error logging and alerting

## Caching Strategy

### Redis Cache Usage

**Cache Keys**:
```
user:{userId}                    # User data (TTL: 5 min)
quotes:{instruments}             # Market quotes (TTL: 1 sec)
ohlc:{instruments}:{timeframe}  # OHLC data (TTL: 1 min)
instruments:{exchange}           # Instrument list (TTL: 24 hours)
```

**Cache Invalidation**:
- Time-based expiration (TTL)
- Event-based invalidation (on updates)
- Manual cache clear endpoints

## Security Architecture

### Authentication Flow

```
1. User Login
   ↓
2. Validate Credentials (bcrypt)
   ↓
3. Generate JWT Access Token (7 days)
   ↓
4. Generate Refresh Token (30 days)
   ↓
5. Hash and Store Refresh Token
   ↓
6. Return Tokens to Client
```

### Token Refresh Flow

```
1. Access Token Expires
   ↓
2. Client Sends Refresh Token
   ↓
3. Validate Refresh Token
   ↓
4. Generate New Access Token
   ↓
5. Generate New Refresh Token
   ↓
6. Invalidate Old Refresh Token
   ↓
7. Return New Tokens
```

### API Security

- **Rate Limiting**: 10 requests per minute per IP
- **CORS**: Configured for frontend domain only
- **Helmet**: Security headers
- **Input Validation**: Class-validator + DTOs
- **SQL Injection Prevention**: TypeORM parameterized queries
- **XSS Prevention**: Content sanitization

## Scalability Considerations

### Horizontal Scaling

**Stateless API Design**:
- JWT tokens (no session storage)
- Redis for shared state
- Bull for distributed job processing

**Load Balancing**:
```
                    Load Balancer
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    API Instance 1   API Instance 2   API Instance 3
        │                │                │
        └────────────────┼────────────────┘
                         │
                    Shared Redis
```

### Database Optimization

**Connection Pooling**:
- Max connections: 20
- Idle timeout: 10 seconds

**Query Optimization**:
- Strategic indexes
- Query result caching
- Pagination for large datasets
- Lazy loading for relations

### Performance Metrics

**Target SLAs**:
- API response time: < 200ms (p95)
- WebSocket latency: < 50ms
- Order execution: < 500ms
- Database query: < 100ms

## Monitoring & Observability

### Logging

**Log Levels**:
- ERROR: Critical errors
- WARN: Warning conditions
- INFO: Informational messages
- DEBUG: Debug information (dev only)

**Log Structure** (JSON):
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "context": "AgentsService",
  "message": "Agent started",
  "agentId": "uuid",
  "userId": "uuid"
}
```

### Metrics to Track

**Application Metrics**:
- Request rate
- Response time (p50, p95, p99)
- Error rate
- Active connections

**Business Metrics**:
- Total trades executed
- Active agents
- Total P&L
- User registrations

**Infrastructure Metrics**:
- CPU usage
- Memory usage
- Database connections
- Redis memory

## Deployment Architecture

### Docker Compose (Development)

```
┌─────────────────────────────────────────┐
│         Docker Compose Network          │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │   Web    │  │   API    │           │
│  │  :3000   │  │  :3001   │           │
│  └──────────┘  └──────────┘           │
│       │              │                 │
│       └──────┬───────┘                │
│              │                         │
│  ┌──────────┴──────────┐             │
│  │                      │             │
│  ▼                      ▼             │
│ ┌──────────┐      ┌─────────┐       │
│ │ Postgres │      │  Redis  │       │
│ │  :5432   │      │  :6379  │       │
│ └──────────┘      └─────────┘       │
└─────────────────────────────────────────┘
```

### Production (Kubernetes/Cloud)

```
                  Internet
                     │
                     ▼
              Load Balancer
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    Pod 1        Pod 2        Pod 3
    (API)        (API)        (API)
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    PostgreSQL    Redis      Bull Workers
    (Managed)   (Managed)    (Kubernetes)
```

## Future Enhancements

### Planned Features

1. **Advanced Backtesting Engine**
   - Historical data replay
   - Strategy optimization
   - Walk-forward analysis

2. **Machine Learning Pipeline**
   - Model training infrastructure
   - Feature engineering
   - Model versioning
   - A/B testing

3. **Multi-Asset Support**
   - Cryptocurrency trading
   - Forex markets
   - Options and futures

4. **Social Trading**
   - Strategy marketplace
   - Copy trading
   - Leaderboards

5. **Advanced Analytics**
   - Custom dashboards
   - Risk analytics
   - Performance attribution

### Technical Debt & Improvements

- [ ] Implement comprehensive e2e tests
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Set up CI/CD pipeline
- [ ] Implement distributed tracing
- [ ] Add health check endpoints
- [ ] Set up alerting system
- [ ] Implement audit logging
- [ ] Add data backup automation

---

**Last Updated**: January 2024
**Version**: 1.0.0
