#!/bin/bash

# Setup script for Algo with NandaX
# This script helps set up the development environment

set -e

echo "🚀 Algo with NandaX - Setup Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Print success message
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Print error message
print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Print warning message
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js is installed: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check pnpm
if command_exists pnpm; then
    PNPM_VERSION=$(pnpm --version)
    print_success "pnpm is installed: $PNPM_VERSION"
else
    print_warning "pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
    print_success "pnpm installed successfully"
fi

# Check Docker
if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker is installed: $DOCKER_VERSION"
else
    print_warning "Docker is not installed. You'll need to install it for containerized setup."
fi

# Check Docker Compose
if command_exists docker-compose; then
    DOCKER_COMPOSE_VERSION=$(docker-compose --version)
    print_success "Docker Compose is installed: $DOCKER_COMPOSE_VERSION"
fi

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🔧 Setting up environment files..."

# Setup API environment file
if [ ! -f "apps/api/.env" ]; then
    cp apps/api/.env.example apps/api/.env
    print_success "Created apps/api/.env"
    print_warning "Please edit apps/api/.env and add your Zerodha Kite credentials"
else
    print_warning "apps/api/.env already exists"
fi

# Setup Web environment file
if [ ! -f "apps/web/.env" ]; then
    cp apps/web/.env.example apps/web/.env
    print_success "Created apps/web/.env"
else
    print_warning "apps/web/.env already exists"
fi

echo ""
echo "🐳 Do you want to start Docker containers? (y/n)"
read -r START_DOCKER

if [ "$START_DOCKER" = "y" ] || [ "$START_DOCKER" = "Y" ]; then
    echo "Starting Docker containers..."
    docker-compose up -d postgres redis
    
    echo "Waiting for services to be ready..."
    sleep 5
    
    print_success "Docker containers started"
    
    echo ""
    echo "🗄️  Running database migrations..."
    pnpm --filter @algo-nandax/api migration:run
    print_success "Database migrations completed"
fi

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Edit apps/api/.env and add your Zerodha Kite API credentials"
echo "2. Start the development servers:"
echo "   - Run: pnpm dev"
echo "   - Or start individually:"
echo "     - API: pnpm dev:api"
echo "     - Web: pnpm dev:web"
echo ""
echo "3. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - API: http://localhost:3001"
echo ""
echo "📚 For more information, see:"
echo "   - README.md - General documentation"
echo "   - SETUP.md - Detailed setup guide"
echo "   - ARCHITECTURE.md - Architecture documentation"
echo ""
echo "Happy trading! 🚀"
