# Local-First Projection Sync — Brief

## Problem

Accepted authority records need durable, replayable, isolated projection
dispatch that survives process restarts. The desktop also needs prompt visual
freshness, but a live notification is inherently disposable: it may be missed
during a disconnect and must never own convergence. Buying a synchronization
platform would import replication, write-back, and protocol scope far beyond
accepted-record projection dispatch.

## Appetite

**Status: proposed — ratify before commit.**

One focused goal: a persistence-backed accepted-record projection cycle plus
bounded desktop freshness proof; cut additional projector families,
multi-window topology, graph projection, and shared packaging.

This is a scope budget, not an estimate. P0 may stop the goal if the workflow
spike cannot supply the required persistence and crash contract; it may not
quietly grow a bespoke durability layer.

## Solution Sketch

Use two explicitly unequal planes:

```text
accepted authority transaction (repo-native Postgres)
  -> accepted record + projection intent, atomically
  -> persistence-backed DurableQueue
  -> isolated target-family worker (bounded concurrency + retry)
  -> trivial rebuildable read projection + target cursor/status
  -> best-effort "projection version changed; re-query" hint
  -> authenticated, server-authorized desktop subscription
  -> desktop re-queries and observes the durable version
```

The durable plane owns convergence. Its deterministic idempotency key is
`{ authorityRecordId, authorityVersion, projectionTarget }`; each target family
has an isolated worker and recorded cursor/status. The first projector writes a
deliberately trivial repo-native read model so retry, no-duplicate, and
no-regress behavior are visible without importing retrieval or graph policy.

The ephemeral plane owns latency only. Start with one scoped queue/stream for
the current single IPC session. Promote to `PubSub` only with same-process
broadcast proof, or to a per-audience connection registry only when multiple
independently scoped connections exist. A reconnect must re-query current
status/version and converge even when no hint was received.

Contracts live in epistemic use-cases; persistence in epistemic tables;
workers/projectors in epistemic server; the workflow persistence adapter in
drivers/workflow; and the desktop handler/subscription in the app. The desktop
launch token authenticates the RPC session, while the server independently
authorizes requested workspace/matter scope before subscription registration.

The first slice proves the entire cycle and kills the process both before and
after worker completion. It then reconnects without delivering the hint and
still observes the new projection version.

## Rabbit Holes

- **Atomic authority-to-queue handoff:** the accepted record and projection
  intent must commit atomically; P0 must prove how the persisted intent reaches
  `DurableQueue` without a loss or unsupported exactly-once claim.
- **Pinned-beta store integration:** live `DurableQueue.ts` depends on
  `PersistedQueueFactory` and `WorkflowEngine`; freeze nothing until the
  workflow-engine spike supplies persistence and crash evidence.
- **Multi-window topology:** Tauri IPC may represent one shared session or
  independently scoped connections. Measure before choosing broadcast or a
  registry.
- **Scope authorization:** `RpcSessionAuth` authenticates a launch, not a user.
  The server must authorize workspace/matter scope and name the future principal
  boundary without inventing `UserId`.
- **Cursor semantics:** specify per-target monotonicity, retry after ambiguous
  completion, stale-version handling, poison work, and when status may advance.

## No-Gos

- No ElectricSQL, PowerSync, or other sync-engine purchase.
- No in-memory queue, stream, hub, notification, or IPC path owning durable work.
- No RRF, vector scoring, retrieval policy, encoder, or ranking behavior.
- No FalkorDB or graph projection in v1.
- No generic multi-device replication or collaborative sync.
- No speculative `PubSub`, multi-window registry, or shared projection package.
- No client-trusted workspace/matter subscription scope and no invented
  singleton `UserId`.
- No reuse/generalization of documents `VaultSyncEngine`; precedent study only.
