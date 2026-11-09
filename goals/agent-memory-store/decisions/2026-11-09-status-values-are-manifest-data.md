---
title: "Status values are manifest data with a StatusLifecycle order, not static LiteralKit domains"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Generate one LiteralKit domain per status field from ops/manifest.json once the field set is closed, and type StatusTransition per field, by decision file"
---

Amends status-generated-from-manifest. Its sentence that the admission path models status as LiteralKit fields cannot hold in P0: the status fields and their values come from ops/manifest.json at runtime, so no static LiteralKit can name them. P0 models a value as StatusValue (a branded NonEmptyString), a field's order as StatusLifecycle { field, order } with a no-duplicates check, and the guard as the pure lifecycleAllows, which admits only forward or same-position moves (S14b: 12/14 regress without it). Backward moves still surface as the backwardStatusMove finding. The rest of the decision (manifest-generated status prose, typed fields with a lifecycle guard) stands. Code: packages/tooling/library/agent-memory-store/src/StatusLifecycle.models.ts. Rejected: a hard-coded LiteralKit of today's manifest values (goes stale the first time a packet adds a status and fails decoding of valid manifests).
