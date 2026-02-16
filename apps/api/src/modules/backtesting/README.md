# Backtesting Module (v1.5)

Backtesting module provides a first production-safe historical simulation pipeline.

## Endpoint

- `POST /api/v1/backtesting/run`
- `POST /api/v1/backtesting/run-portfolio`
- `POST /api/v1/backtesting/optimize`
- `POST /api/v1/backtesting/optimize-portfolio`

## Inputs

- `connectionId` (user-owned broker connection)
- `instrumentToken` (single-instrument endpoint)
- `instrumentTokens[]` (portfolio endpoint)
- `interval`
- `fromDate`, `toDate`
- optional strategy tuning:
  - `entryThresholdPercent`
  - `exitThresholdPercent`
  - `quantity`
  - `feePerTrade`
  - `slippageBps`
  - `stopLossPercent`
  - `takeProfitPercent`
  - `walkForwardWindows`
  - `initialCapital`

## Simulation model (v1.5)

- Fetches historical candles from broker API.
- Uses threshold-based momentum/reversal entries.
- Supports long and short simulated positions.
- Applies configurable slippage and fixed per-trade cost.
- Applies configurable slippage and market impact cost model.
- Applies optional stop-loss and take-profit constraints.
- Supports walk-forward style segmented runs over multiple windows.
- Computes net PnL, ending equity, max drawdown, and per-window summaries.
- Portfolio endpoint aggregates multi-instrument PnL and portfolio equity curve.
- Optimize endpoint runs threshold grid-search and ranks best strategy configurations.
- Portfolio optimize endpoint ranks candidate portfolio weight allocations.

## Flow

```mermaid
flowchart TD
  A[Run backtest request] --> B[Validate DTO + auth]
  B --> C[Fetch historical candles via BrokerService]
  C --> D[Normalize candle rows]
  D --> E[Split candles into walk-forward windows]
  E --> F[Simulate entries/exits with slippage + fees]
  F --> G[Apply stop-loss/take-profit exits]
  G --> H[Aggregate summary + drawdown + window stats]
  H --> I[Return trades + equity curve + summary]
```

## Portfolio flow

```mermaid
flowchart TD
  A[Run portfolio backtest request] --> B[Validate instrument list + weights]
  B --> C[Fetch candles per instrument]
  C --> D[Run single-instrument simulation per token]
  D --> E[Tag and merge trades]
  E --> F[Build portfolio equity curve]
  F --> G[Return aggregate summary + instrument breakdown]
```

## Optimization flow

```mermaid
flowchart TD
  A[Run optimize request] --> B[Load candles once]
  B --> C[Generate threshold combinations]
  C --> D[Run deterministic simulation for each combination]
  D --> E[Score by pnl minus drawdown penalty]
  E --> F[Return ranked top strategies]
```

## Portfolio optimization flow

```mermaid
flowchart TD
  A[Run optimize-portfolio request] --> B[Build candidate weight sets]
  B --> C[Run portfolio simulation per candidate]
  C --> D[Score with pnl-drawdown objective]
  D --> E[Return top portfolio candidates]
```

## Notes

- This remains deterministic and intentionally lightweight.
- Future versions should add market impact models, portfolio-level allocation, and richer strategy DSL support.
- Current market impact model is baseline (bps + participation multiplier), not full microstructure simulation.
