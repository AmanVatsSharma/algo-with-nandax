# Agents Module

This module manages strategy execution cycles for autonomous trading agents.

## Runtime flow (current)

```mermaid
flowchart TD
  A[Cron tick every minute] --> B[Fetch RUNNING agents]
  B --> C[Queue execute-strategy job per agent]
  C --> D[Validate capital / positions / max trades/day]
  D --> E[Fetch live quotes via broker connection]
  E --> F[Generate decision (AI or rule-based)]
  F --> G{confidence >= threshold}
  G -->|no| H[Log and skip]
  G -->|yes| I{autoTrade && !paperTrading}
  I -->|no| J[Log simulated/disabled]
  I -->|yes| K[Execute market order via trading queue]
```

## Guardrails added

- Enforces `maxPositions` and `maxTradesPerDay`.
- Optional strategy config guardrails:
  - `maxDailyLoss`
  - `maxDailyProfit`
- Uses live broker quotes for decision inputs.
- Blocks live placement if:
  - agent is `paperTrading=true` (paper orders are simulated and stored as trades),
  - or `autoTrade=false`,
  - or quote/LTP is missing.

## AI provider abstraction (baseline)

- Added provider registry with deterministic adapters:
  - `openai`
  - `anthropic`
  - `heuristic` fallback
- Provider selection sources (in order):
  1. strategy configuration `aiProvider`
  2. agent model config provider
  3. agent model name prefix (`provider:model`)
  4. fallback `heuristic`
- Every decision now includes provider metadata for traceability.

## Remaining limitation

- External live LLM calls, latency-aware retries, and cost accounting are still pending.
