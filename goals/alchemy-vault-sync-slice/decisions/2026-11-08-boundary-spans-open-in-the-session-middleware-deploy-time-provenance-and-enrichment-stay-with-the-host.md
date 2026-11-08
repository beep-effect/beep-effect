---
title: "Boundary spans open in the Session middleware; deploy-time provenance and enrichment stay with the host"
date: 2026-11-08
reversal: "Move VaultSyncApi.command and .read into the delivery client and drop the Session-level spans"
---

The observability plan (`research/11-observability-plan.md` §6) assigned its steps to PRs 3a, 3b1, 3c, 3b2 and the driver PR. Those merged before several steps were done. `research/13-observability-implementation.md` audits all 23 steps against `main` and records what the final PR implemented.

Decisions:

- `VaultSyncApi.command` and `VaultSyncApi.read` open in the Session middleware (`VaultSyncSessionLive`), not in the delivery client as the plan said. The middleware is the one point every transport passes through (HTTP, RPC, MCP, in-process and remote CLI), and the transport and request correlation id are known there. The span opens before the Session resolves the caller, so the Session spans and the kernel `Domain.send` / `Domain.decide` spans nest under it. A tracer test asserts that nesting for an HTTP command.
- Spans declared at `shape-only` list only `shape-only` keys. The catalog check rejects a `shape-only` span carrying a `standard` key, so identifiers (`destination_id`, `operation_id`, `request_correlation_id`) are declared at `standard` and named in the span description.
- The production host mounts both provenance mappings: genesis first, then the v1 request context (`principalKey`, `sourceKind`) through `AlchemyPostgresConfig.provenanceMappings`.
- Mounting `layerCatalogEnrichment` and naming the `POST /vault-sync/rpc` protocol span are host composition in `apps/professional-desktop`. They apply to every slice the sidecar serves, not only vault sync, so they are left to that host and recorded in doc 13 §3.
