# Current Implementation Matrix (Code-Verified)

Last updated: 2026-02-16

This document reflects **actual code state** and intentionally separates shipped vs in-progress vs planned.

## Legend

- ✅ Shipped in code
- 🚧 In progress / partial
- 📌 Planned (not implemented yet)

---

## Platform Core

| Capability | Status | Notes |
|---|---|---|
| API compile health | ✅ | `pnpm --filter @algo-nandax/api build` passes |
| Web compile health | ✅ | `pnpm --filter @algo-nandax/web build` passes |
| Unit test baseline | ✅ | API has Jest + ts-jest with foundational specs |
| Structured request tracing | ✅ | Request id middleware + response header |
| Global exception envelope | ✅ | Global exception filter added |

## Authentication & Session

| Capability | Status | Notes |
|---|---|---|
| JWT auth (access token) | ✅ | Existing and active |
| Refresh token rotation | ✅ | Rotated on refresh |
| Refresh token in httpOnly cookie | ✅ | Enabled; localStorage refresh token removed |
| Websocket JWT handshake auth | ✅ | Client identity no longer trusted from payload only |

## Broker / Kite

| Capability | Status | Notes |
|---|---|---|
| OAuth callback route | ✅ | `/auth/kite/callback` implemented |
| Session exchange flow | ✅ | Callback + API connect flow wired |
| Kite auth header format | ✅ | `token api_key:access_token` |
| Session token request encoding | ✅ | Form encoded for `/session/token` |
| Broker ownership checks | ✅ | User-scoped operations enforced |
| Access token encryption at rest | ✅ | AES-GCM via `TokenCryptoService` |
| Order state reconciliation | ✅ | Trading processor fetches latest order state |

## Trading & Agent Runtime

| Capability | Status | Notes |
|---|---|---|
| Queue retries + backoff | ✅ | Trading + agent queues configured |
| Queue dedupe via jobId | ✅ | Place/close/execute job-level dedupe |
| Direction-aware PnL | ✅ | BUY/SELL calculations corrected |
| Agent uses live quotes | ✅ | Uses broker quote API instead of static placeholder |
| Guardrails max positions/day trades | ✅ | Enforced in agent processor |
| Daily PnL guardrails (`maxDailyLoss`/`maxDailyProfit`) | ✅ | Strategy config-aware |
| Fill reconciliation from tradebook | 🚧 | Latest order status used; tradebook-level precision pending |
| Full risk module (VaR, portfolio risk, kill-switch orchestration) | 📌 | Not yet delivered |

## Security & Compliance

| Capability | Status | Notes |
|---|---|---|
| DTO validation coverage for key external APIs | ✅ | Expanded across major controllers |
| IDOR hardening for critical routes | ✅ | User-scoped retrieval/update in key modules |
| Audit logging module | ✅ | `@Audit` decorator + interceptor + `GET /audit/logs` |
| Immutable/regulated retention policies | 📌 | Not yet implemented |

## Product UX / Routes

| Capability | Status | Notes |
|---|---|---|
| Missing dashboard route fixes | ✅ | settings / agents/new / strategies/new / accounts/[id] |
| Broker connect popup flow | ✅ | Callback + window message flow |
| End-to-end polished strategy backtest UI | 📌 | Not shipped yet |

## Advanced Platform

| Capability | Status | Notes |
|---|---|---|
| Multi-provider AI orchestration | 📌 | Planned |
| Full backtesting engine | 📌 | Planned |
| Multi-tenant white-label | 📌 | Planned |
| SSO/SAML enterprise auth | 📌 | Planned |

---

## Verification Commands

```bash
pnpm --filter @algo-nandax/api build
pnpm --filter @algo-nandax/web build
pnpm --filter @algo-nandax/api test --runInBand
```

---

## Module docs (authoritative for internals)

- `apps/api/src/modules/auth/README.md`
- `apps/api/src/modules/broker/README.md`
- `apps/api/src/modules/agents/README.md`
- `apps/api/src/modules/trading/README.md`
- `apps/api/src/modules/market-data/README.md`
- `apps/api/src/modules/websocket/README.md`
- `apps/api/src/modules/audit/README.md`
