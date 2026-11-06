# Brief

## Problem

`@beep/shared-domain/entity` is a hand-rolled entity kit (BaseEntity, AuditEntity, OrgEntity, EntityKit, EntityRef, PublicEntityId, Principal, SourceKind, primitives) that bakes SQL column metadata, inheritance and audit stamping into every domain model. It is a weaker DDD substrate than `@alchemy.run/domain`'s Model / Command / Event / Aggregate / View / Projection / Stream / Policy / Saga / External System / Api / Story set, and 115 files across nine slice domain packages depend on it. `@beep/effect-drizzle` carries the write path those models imply. The operator has decided to adopt alchemy (D0); the open work is how, and in what order.

Why now: alchemy core is already in the repo (beep-effect-web, beta.84); the domain module reached beta.85 with the full abstraction set and a documented testing, local-first, MCP and observability story; the documents vault-sync slice needs durable operations, leases, deadlines and an external single-writer (Box) that the kit models badly today.

## Appetite

One goal packet, one slice, one quarter-of-a-cycle of focused work: the `documents` vault-sync bounded context migrated end to end, with the Postgres Platform driver and the doctrine amendments built inside that goal. Every other slice is a follow-on goal that reuses the driver, the conformance suite and the migration recipe. The appetite excludes any work on other slices beyond freezing the kit (D3).

## Solution Sketch

```
documents/domain        documents/use-cases            documents/server              app runtime
─────────────────       ────────────────────────       ───────────────────────       ─────────────
states, events          Domain.Model (assembled)       Postgres Platform Layer       HTTP + MCP host
commands, rejections    Api (HTTP/MCP/CLI contracts)   ClusterWorkflowEngine Layer   Session middleware
decide / evolve         policies, projections, sagas   Box External System adapter   CLI entry
Views (read contracts)  command dispatch = use-case    Projections → drizzle tables
Stories (InMemory)      boundary (errors, spans)       genesis import, replay-diff
```

Flows the first goal must prove:

1. **Bump and host.** Lockstep bump to beta.85 (D11). Postgres Platform driver implementing the alchemy `Platform` contract plus `WorkflowEngine` via `effect/cluster` (D1, D6), with a conformance suite that runs the same scenarios against `Domain.InMemory` and Postgres.
2. **Migrate vault-sync.** Aggregates for sync destination, sync operation (lease, deadline), sync conflict; Box as External System; Unique value for destination names (org-qualified, D14); Deadline on leases; Saga for the scan → push → reconcile flow; Policies for reactions. Genesis import of existing rows as v1 events (D7, D12), single-writer cutover, legacy tables rebuilt as Projections with a replay-and-diff proof (D15).
3. **Expose.** One Api: HTTP + OpenAPI, CLI, and an MCP server limited to Views (D13), all behind Session middleware that stamps principal and source kind into the envelope (D10). Views are tested as security boundaries.
4. **Frontend.** Optimistic prediction per command and a persisted offline intent queue flushed on reconnect; the server's `decide` remains the only authority (D8).
5. **Observe.** Kernel spans nested under registered boundary spans; correlation ids through outbox and workflow (D17).
6. **Doctrine.** ARCHITECTURE / DECISIONS / GLOSSARY amendments and the kit freeze land in the first PR (D16).

## Rabbit Holes

- **Platform contract drift.** 84 betas in 203 days; `Platform` is internal-shaped (Grok). Patch: the conformance suite is the contract; a bump is a named task, never incidental.
- **Backfill is Cloudflare-shaped.** Sam Goodwin's replay fan-out runs over Durable Objects. Patch: the Postgres driver owns a replay path (`SKIP LOCKED` workers or Cluster entities); replay of the genesis import is the first test.
- **Annotation propagation.** Whether `LiteralKit` / `$I.annote` metadata survives alchemy's Command/Event constructors is UNVERIFIED (Astra §4). Patch: a one-day type/runtime spike before any schema is written.
- **Envelope metadata survival.** D10 assumes principal/source in the envelope survive CatchUp/Backfill and the Postgres storage shape. Patch: assert it in the conformance suite.
- **Event version slot.** Whether alchemy's Event admits a version annotation or the driver owns upcasting (D12). Patch: spike alongside annotation propagation.
- **Saga durability on Postgres.** `ClusterWorkflowEngine` + `SqlMessageStorage` are shipped but unproven here. Patch: a crash-and-resume test on the scan → push saga.
- **Dual writes during cutover.** Patch: single-writer rule enforced by deleting the drizzle write path in the same PR as the cutover (D7).
- **One-person upstream.** Patch: repo-first; upstream offer only after conformance passes (D16).

## No-Gos

- No CRDT or local-replica sync engine in this goal (D8); CRDTs for collaborative content values belong to the document-editor packet.
- No migration of any slice other than `documents` vault-sync; no deletion of the entity kit until its last consumer migrates (D3).
- No Cloudflare Durable Objects as product storage (D1).
- No dual-write shadow period (D7).
- No MCP command tools in goal 1 (D13).
- No regenerated public ids (D14).
- No `@beep/shared-domain` facade over alchemy (D4).
- No continuous tracking of alchemy betas (D11).
