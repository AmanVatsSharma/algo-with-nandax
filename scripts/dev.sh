#!/bin/bash

# Development script for Algo with NandaX
# Starts all development servers

set -e

echo "🚀 Starting Algo with NandaX Development Servers"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if .env files exist
if [ ! -f "apps/api/.env" ]; then
    print_warning ".env file not found in apps/api/"
    echo "Run 'pnpm setup' or copy .env.example to .env"
    exit 1
fi

if [ ! -f "apps/web/.env" ]; then
    print_warning ".env file not found in apps/web/"
    echo "Run 'pnpm setup' or copy .env.example to .env"
    exit 1
fi

# Check if Docker containers are running
echo "Checking Docker containers..."
if docker ps | grep -q "algo-postgres"; then
    print_success "PostgreSQL is running"
else
    print_warning "PostgreSQL is not running. Starting..."
    docker-compose up -d postgres
    sleep 3
fi

if docker ps | grep -q "algo-redis"; then
    print_success "Redis is running"
else
    print_warning "Redis is not running. Starting..."
    docker-compose up -d redis
    sleep 2
fi

echo ""
echo "Starting development servers..."
echo ""
echo "📊 API will be available at: http://localhost:3001"
echo "🌐 Web will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start development servers
pnpm dev
