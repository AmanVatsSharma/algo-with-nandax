.PHONY: help install dev build clean docker-up docker-down docker-logs

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	pnpm install

dev: ## Start development servers
	pnpm dev

dev-api: ## Start API development server
	pnpm dev:api

dev-web: ## Start Web development server
	pnpm dev:web

build: ## Build all applications
	pnpm build

build-api: ## Build API application
	pnpm build:api

build-web: ## Build Web application
	pnpm build:web

clean: ## Clean node_modules and build artifacts
	pnpm clean
	rm -rf dist build .next

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker container logs
	docker-compose logs -f

docker-rebuild: ## Rebuild and restart Docker containers
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

db-migrate: ## Run database migrations
	pnpm --filter @algo-nandax/api migration:run

db-migrate-create: ## Create a new migration
	pnpm --filter @algo-nandax/api migration:generate -- -n

db-migrate-revert: ## Revert last migration
	pnpm --filter @algo-nandax/api migration:revert

test: ## Run tests
	pnpm test

lint: ## Run linters
	pnpm lint

format: ## Format code
	pnpm format
