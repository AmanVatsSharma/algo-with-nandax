#!/bin/bash

# Clean script for Algo with NandaX
# Removes build artifacts and dependencies

set -e

echo "🧹 Cleaning Algo with NandaX"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "This will remove:"
echo "- node_modules directories"
echo "- Build artifacts (dist, build, .next)"
echo "- pnpm lock file"
echo ""
echo "⚠️  Docker containers and volumes will NOT be removed"
echo ""
echo "Do you want to continue? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "Cleaning..."

# Remove node_modules
if [ -d "node_modules" ]; then
    rm -rf node_modules
    print_success "Removed root node_modules"
fi

if [ -d "apps/api/node_modules" ]; then
    rm -rf apps/api/node_modules
    print_success "Removed apps/api/node_modules"
fi

if [ -d "apps/web/node_modules" ]; then
    rm -rf apps/web/node_modules
    print_success "Removed apps/web/node_modules"
fi

# Remove build artifacts
if [ -d "apps/api/dist" ]; then
    rm -rf apps/api/dist
    print_success "Removed apps/api/dist"
fi

if [ -d "apps/web/.next" ]; then
    rm -rf apps/web/.next
    print_success "Removed apps/web/.next"
fi

if [ -d "apps/web/out" ]; then
    rm -rf apps/web/out
    print_success "Removed apps/web/out"
fi

# Remove lock file (optional)
echo ""
echo "Do you want to remove pnpm-lock.yaml? (y/n)"
read -r REMOVE_LOCK

if [ "$REMOVE_LOCK" = "y" ] || [ "$REMOVE_LOCK" = "Y" ]; then
    if [ -f "pnpm-lock.yaml" ]; then
        rm pnpm-lock.yaml
        print_success "Removed pnpm-lock.yaml"
    fi
fi

echo ""
echo "✅ Cleaning completed!"
echo ""
echo "To reinstall dependencies, run: pnpm install"
