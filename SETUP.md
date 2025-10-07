# Setup Guide - Algo with NandaX

This guide will help you set up the Algo with NandaX trading platform from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Zerodha Kite API Credentials](#getting-zerodha-kite-api-credentials)
3. [Installation Steps](#installation-steps)
4. [Database Setup](#database-setup)
5. [First-Time Configuration](#first-time-configuration)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** (v18 or higher)
  ```bash
  node --version  # Should be v18.x.x or higher
  ```

- **pnpm** (v8 or higher)
  ```bash
  npm install -g pnpm
  pnpm --version  # Should be 8.x.x or higher
  ```

- **Docker** and **Docker Compose**
  ```bash
  docker --version
  docker-compose --version
  ```

- **Git**
  ```bash
  git --version
  ```

### Optional (for local development without Docker)

- **PostgreSQL** (v14 or higher)
- **Redis** (v6 or higher)

## Getting Zerodha Kite API Credentials

To use this platform, you need Zerodha Kite API credentials:

1. **Create a Kite Connect App**
   - Visit [Kite Connect](https://kite.trade/)
   - Sign in with your Zerodha account
   - Go to "Create new app"
   - Fill in the details:
     - App name: Your app name
     - Redirect URL: `http://localhost:3000/auth/kite/callback`
     - Description: Brief description
   - Submit the form

2. **Get Your Credentials**
   - After approval, you'll receive:
     - **API Key** (used publicly)
     - **API Secret** (keep this secret!)
   - Note these down for configuration

3. **API Subscription**
   - Kite Connect requires a monthly subscription
   - Check current pricing on their website

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/AmanVatsSharma/algo-with-nandax.git
cd algo-with-nandax
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This will install all dependencies for both the API and Web applications.

### Step 3: Environment Configuration

#### Backend Configuration

```bash
# Copy the example environment file
cp apps/api/.env.example apps/api/.env

# Edit the file with your settings
nano apps/api/.env  # or use any text editor
```

**Required Environment Variables:**

```env
# Database (if using Docker, keep these defaults)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=algo_trading

# Redis (if using Docker, keep these defaults)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters

# Zerodha Kite (ADD YOUR CREDENTIALS)
KITE_API_KEY=your_kite_api_key
KITE_API_SECRET=your_kite_api_secret
KITE_REDIRECT_URL=http://localhost:3000/auth/kite/callback
```

#### Frontend Configuration

```bash
# Copy the example environment file
cp apps/web/.env.example apps/web/.env

# Edit if needed (defaults should work)
nano apps/web/.env
```

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

## Database Setup

### Option 1: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Wait a few seconds for PostgreSQL to be ready
sleep 5

# Run database migrations
pnpm --filter @algo-nandax/api migration:run
```

### Option 2: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
createdb algo_trading

# Or using psql
psql -U postgres -c "CREATE DATABASE algo_trading;"

# Run migrations
pnpm --filter @algo-nandax/api migration:run
```

## First-Time Configuration

### Start the Development Servers

#### Option 1: Start Everything with Docker

```bash
docker-compose up
```

#### Option 2: Start Manually

```bash
# Terminal 1: Start API
pnpm dev:api

# Terminal 2: Start Web
pnpm dev:web
```

### Access the Application

1. **Frontend**: Open http://localhost:3000
2. **API**: Open http://localhost:3001/api/v1
3. **API Health**: Open http://localhost:3001/api/v1/health (if you add a health endpoint)

### Create Your First User

1. Go to http://localhost:3000
2. Click "Get Started" or "Sign Up"
3. Fill in your details:
   - Name: Your name
   - Email: your@email.com
   - Password: At least 8 characters
4. Click "Create Account"

### Connect Zerodha Kite

1. After logging in, go to "Broker Connection"
2. Click "Add Connection"
3. Select "Zerodha Kite"
4. Enter your API Key
5. Click "Connect"
6. You'll be redirected to Zerodha login
7. Log in and authorize the app
8. You'll be redirected back with a connected status

### Create Your First Strategy

1. Go to "Strategies"
2. Click "Create Strategy"
3. Fill in the details:
   - Name: e.g., "My First Strategy"
   - Type: Select strategy type
   - Instruments: Add trading symbols (e.g., "NSE:SBIN", "NSE:INFY")
   - Configure parameters (capital, stop loss, etc.)
4. Click "Create"

### Create and Start an Agent

1. Go to "Agents"
2. Click "Create Agent"
3. Fill in:
   - Name: e.g., "Test Agent"
   - Select your strategy
   - Allocate capital
   - Configure settings
4. Click "Create"
5. Click the "Play" button to start the agent

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

**Error**: `ECONNREFUSED` or `Connection refused`

**Solution**:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Or if local
pg_isready -U postgres

# Restart PostgreSQL
docker-compose restart postgres
```

#### 2. Redis Connection Error

**Error**: `Error connecting to Redis`

**Solution**:
```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec -it algo-redis redis-cli ping
# Should respond: PONG

# Restart Redis
docker-compose restart redis
```

#### 3. Port Already in Use

**Error**: `Port 3000/3001 is already in use`

**Solution**:
```bash
# Find process using the port
lsof -i :3000  # or :3001

# Kill the process
kill -9 <PID>

# Or change the port in .env files
```

#### 4. pnpm Command Not Found

**Error**: `pnpm: command not found`

**Solution**:
```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

#### 5. Migration Errors

**Error**: Migration related errors

**Solution**:
```bash
# Revert all migrations
pnpm --filter @algo-nandax/api migration:revert

# Run migrations again
pnpm --filter @algo-nandax/api migration:run

# If issues persist, drop and recreate database
dropdb algo_trading
createdb algo_trading
pnpm --filter @algo-nandax/api migration:run
```

#### 6. Zerodha Kite Connection Fails

**Error**: Invalid credentials or connection timeout

**Solution**:
- Verify your API Key and Secret are correct
- Check if redirect URL matches exactly: `http://localhost:3000/auth/kite/callback`
- Ensure your Kite Connect subscription is active
- Check Zerodha API status page

### Getting Help

If you encounter issues not listed here:

1. Check the logs:
   ```bash
   # Docker logs
   docker-compose logs -f

   # Or specific service
   docker-compose logs -f api
   ```

2. Check the browser console for frontend errors
3. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Your environment (OS, Node version, etc.)

## Next Steps

After successful setup:

1. **Explore the Dashboard** - Familiarize yourself with the UI
2. **Read the API Documentation** - Understand available endpoints
3. **Create Test Strategies** - Start with paper trading
4. **Monitor Agents** - Watch how agents execute trades
5. **Review Trades** - Check trade history and performance

## Security Reminders

⚠️ **Important Security Notes:**

1. Never commit `.env` files to version control
2. Change default JWT secrets in production
3. Use strong, unique passwords
4. Keep your Kite API credentials secure
5. Regularly update dependencies
6. Enable 2FA on your Zerodha account

## Production Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md) (if you create one) or contact the development team.

---

**Happy Trading! 🚀**
