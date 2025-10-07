# Quick Start Guide

Get up and running with Algo with NandaX in 5 minutes!

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Zerodha Kite API credentials

## Setup (Choose One)

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
pnpm setup

# Edit environment files with your Kite credentials
nano apps/api/.env

# Start development
pnpm dev
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Edit apps/api/.env and add your Kite credentials

# 3. Start Docker services
docker-compose up -d postgres redis

# 4. Run migrations
pnpm --filter @algo-nandax/api migration:run

# 5. Start development servers
pnpm dev
```

## Access

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Database**: localhost:5432 (postgres/postgres)
- **Redis**: localhost:6379

## First Steps

1. **Create Account**
   - Go to http://localhost:3000
   - Click "Get Started"
   - Register with your email

2. **Connect Broker**
   - Navigate to "Broker Connection"
   - Add your Zerodha API Key
   - Complete OAuth flow

3. **Create Strategy**
   - Go to "Strategies"
   - Click "Create Strategy"
   - Configure your trading rules

4. **Deploy Agent**
   - Go to "Agents"
   - Click "Create Agent"
   - Link to your strategy
   - Start the agent

## Common Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm dev:api               # Start API only
pnpm dev:web               # Start Web only

# Docker
pnpm docker:up             # Start containers
pnpm docker:down           # Stop containers
pnpm docker:logs           # View logs

# Database
pnpm --filter @algo-nandax/api migration:run      # Run migrations
pnpm --filter @algo-nandax/api migration:revert   # Revert migration

# Build
pnpm build                 # Build all
pnpm build:api            # Build API
pnpm build:web            # Build Web

# Utilities
pnpm clean                # Clean all artifacts
pnpm test                 # Run tests
pnpm lint                 # Run linters
```

## Using Makefile

```bash
make help                  # Show all commands
make install              # Install dependencies
make dev                  # Start development
make docker-up            # Start Docker containers
make docker-logs          # View logs
make db-migrate           # Run migrations
```

## Troubleshooting

**Database connection failed?**
```bash
docker-compose restart postgres
sleep 5
pnpm --filter @algo-nandax/api migration:run
```

**Port already in use?**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

**Docker issues?**
```bash
docker-compose down
docker-compose up -d
```

## Next Steps

- Read [SETUP.md](./SETUP.md) for detailed setup
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See [CONTRIBUTING.md](./CONTRIBUTING.md) to contribute
- Review [README.md](./README.md) for full documentation

## Need Help?

- Check existing issues on GitHub
- Review documentation
- Open a new issue with details

Happy Trading! 🚀
