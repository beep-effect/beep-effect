# Local-First Projection Sync — Research

<!--
Stage 1 (synthesized 2026-06-29). Grounds CAPTURE's EventStreamHub nugget in
reality: cited external landscape + verified in-repo inventory + hard
constraints. Raw per-subtopic research lives in research/*.md; this file is the
synthesis. All in-repo paths verified via rg/ls on 2026-06-29 against Effect
4.0.0-beta.91.
-->

## 2026-07-14 Amendment — Effect v4 durable dispatch and live-source scan

The align gate supersedes the original hub-first wedge below where the two
conflict. The accepted design is a two-plane projection-dispatch seam:
repo-native Postgres stores an accepted authority record and projection intent
atomically; Effect v4 `DurableQueue` plus a persistence-backed worker owns
durable projector work; and a scoped queue/stream carries only a best-effort
"projection version changed; re-query" hint. The v3-era in-memory
`EventStreamHub` premise is no longer a durable-work candidate, and the earlier
`ThreadStore` attach recommendation is superseded by the standalone
`projection-dispatch-core` goal.

### Effect v4 `DurableQueue` accounting

The pinned live source is
`node_modules/effect/src/unstable/workflow/DurableQueue.ts`. `make` defines a
schema-backed payload and caller-supplied deterministic `idempotencyKey`;
`process` offers encoded work through `PersistedQueue`; and `worker` runs a
bounded-concurrency handler. The worker layer requires both `WorkflowEngine`
and `PersistedQueue.PersistedQueueFactory`. This is an unstable API and not, by
itself, proof that the accepted-record transaction and persisted queue share an
atomic boundary. `goals/effect-v4-workflow-engine-spike` therefore remains a
hard prerequisite: its adapter, persistence, competing-worker, ambiguous
completion, and real kill/restart evidence must land before the projection goal
freezes store integration.

### Live-source scan results

- `packages/epistemic/{use-cases,server,tables}` exist, but no accepted-record
  projection-dispatch schemas, ports, subscription RPC, intent/cursor tables, or
  target-family workers were found. Those pieces are honestly **NET-NEW**.
- `packages/drivers/workflow` is not yet a live package; its adapter is
  **NET-NEW** and owned first by `goals/effect-v4-workflow-engine-spike`.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts` and its
  server implementation provide cursor/status/reconciliation precedent. Their
  vault/provider semantics are studied, not generalized or reused.
- `apps/professional-desktop/src/sync/Sync.atoms.ts` proves reactivity-keyed RPC
  re-query; `src/transport/TauriIpcSocket.ts` and `IpcChatClient.ts` prove the
  Effect socket/RPC bridge. They do not prove multiple independently scoped
  connections.
- `apps/professional-desktop/server/RpcSessionAuth.ts` proves per-launch bearer
  authentication. It authenticates a launch, not a user. Existing desktop RPC
  handlers pass client-supplied `workspaceId` through, so server-authorized
  subscription scope and a future principal boundary are **NET-NEW**.

### Resulting boundary

The first slice is one trivial rebuildable repo-native read projection with a
deterministic key from `{ authorityRecordId, authorityVersion,
projectionTarget }`, recorded monotonic cursor/status, retry-no-duplicate and
no-regress proof, and kill/restart both before and after worker completion. A
desktop reconnect must converge by re-query even when the hint is absent. RRF,
vector scoring, retrieval policy, FalkorDB, and generic multi-device
replication are outside this accounting.

The wedge: after an authority write, push a typed event to every live desktop
connection so local-first FalkorDB/UI projections refresh without polling. The
ported shape (from TalentScore, port-shape-only — see licensing below) is a
**targeted server-push fan-out hub**: an in-process registry of live client
connections plus a typed `notify(userId, event)` entry point the write path
calls after it commits. It is NOT a sync engine, NOT a CRDT, NOT a DB
change-feed. Everything below is evaluated against that role. Raw:
[`research/eventstreamhub-projection-fanout-and-attach-vs-standalone.md`](./research/eventstreamhub-projection-fanout-and-attach-vs-standalone.md).

## External Landscape

**Effect-native primitives (the build-it path).** `PubSub` broadcasts every
published message to **all** subscribers (bounded = backpressure;
dropping/sliding/unbounded trade delivery for publisher throughput), versus a
`Queue` where each value goes to exactly one consumer
([effect.website/docs/concurrency/pubsub](https://effect.website/docs/concurrency/pubsub/)).
Implication: a single global `PubSub` would broadcast-then-filter every event to
every connection, whereas a per-user `MutableHashMap<UserId, connection[]>`
registry does **targeted** fan-out — the per-user registry is the right
primitive for authority→projection refresh; `PubSub` is right only if topic /
broadcast semantics are later wanted. The captured shape names `effect/Mailbox`
(an "asynchronous queue with a done/failure signal," added in Effect 3.8, with
`offer`/`takeAll`/`end`/`fail`/`toStream`,
[effect.website/blog/.../38](https://effect.website/blog/releases/effect/38/)) —
but that module **does not exist in this repo's Effect v4 beta**; see Constraints
for the `Queue` replacement.

**Effect RPC supports streaming responses / server push as first-class.** The
`@effect/rpc` rewrite added streaming responses; a handler can return a `Stream`;
the server exposes WebSocket transport (`layerProtocolWebsocket`, raw sockets via
`layerProtocolSocketServer`) while the client uses `RpcClient.layerProtocolSocket`
([github.com/Effect-TS/effect/.../rpc/README](https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md);
[effect.website/blog/.../23](https://effect.website/blog/releases/effect/23/);
[npmjs.com/package/@effect/rpc](https://www.npmjs.com/package/@effect/rpc)). The
**transport and serialization are proven and reusable** — a
`SubscribeProjectionEvents` streaming RPC reuses the same socket/ndjson surface
with no new transport machinery. It is **not, however, a literal drop-in**:
connection lifecycle and invalidation semantics are real design work (see the
implementation-surface checklist under Constraints).

**Sync engines (the buy-it alternatives — all over-scoped for one user).**
- *ElectricSQL* — read-path Postgres sync engine: an Elixir service consumes
  logical replication and fans declarative "Shapes" out over a CDN-cacheable
  HTTP API; **writes go through your own backend — Electric does not touch the
  write path**. GA 1.0 2025-03-17, **Apache-2.0**, pairs natively with PGlite
  ([electric-sql.com/products/postgres-sync](https://electric-sql.com/products/postgres-sync);
  [shapes guide](https://electric-sql.com/docs/guides/shapes);
  [1.0 GA](https://electric-sql.com/blog/2025/03/17/electricsql-1.0-released);
  [pglite.dev/docs/sync](https://pglite.dev/docs/sync)). Keeps a **SQL** (PGlite)
  projection fresh, does nothing for a FalkorDB graph projection; CDN fan-out is
  irrelevant at one user.
- *PowerSync* — bidirectional partial-replication engine: consumes a Postgres
  replication slot, partitions into "buckets" via YAML Sync Rules, streams to a
  client SQLite DB under a server-authoritative checkpoint model, and handles
  write-back. Server/CLI under the **Functional Source License (FSL)** —
  source-available, non-compete, converting to Apache-2.0 at each release's 2nd
  anniversary; client SDKs Apache-2.0/MIT
  ([powersync.com/legal/fsl](https://powersync.com/legal/fsl);
  [new open era](https://www.powersync.com/blog/new-open-era-for-powersync);
  [open-source](https://powersync.com/open-source);
  [service architecture](https://docs.powersync.com/architecture/powersync-service)).
  Adds write-back not needed for one-way authority→projection refresh.
- *Rocicorp Zero* — query-driven (own ZQL, own `zero-cache` server, own
  protocol, rebase-on-conflict), reached 1.0 June 2026
  ([infoq.com/news/2026/06/zero-version-1](https://www.infoq.com/news/2026/06/zero-version-1/);
  [zero.rocicorp.dev/docs/when-to-use](https://zero.rocicorp.dev/docs/when-to-use)).
  *Inference (not a sourced claim):* because Zero introduces its own query
  language, cache server, and wire protocol, adopting it would likely be a
  platform-level commitment rather than a drop-in. Out of scope for the current
  wedge.

**Lighter local-first / state-store alternatives (scanned for completeness,
Codex gate-1).** The sync-engine set above is the heavyweight end; a band of
lighter local-first state/sync stacks sits closer to this problem and is
rejected explicitly rather than omitted. Zero's own "when to use" page surveys
several of these and Electric positions its stack with PGlite-sync / TanStack DB
integration ([zero.rocicorp.dev/docs/when-to-use](https://zero.rocicorp.dev/docs/when-to-use);
[electric-sql.com/products/postgres-sync](https://electric-sql.com/products/postgres-sync)).

| Option | What it is | Cross-window server push? | Client-local reactive query invalidation? | Multi-device sync? | Verdict for this wedge |
| --- | --- | --- | --- | --- | --- |
| **LiveStore** | Event-sourcing + reactive SQLite state store | Via its own sync backend, not an app post-commit hook | Yes (reactive SQL) | Yes | Over-scoped: imports an event-sourcing/sync runtime to solve same-user refresh |
| **Jazz** | CRDT-backed local-first app framework + sync server | Via Jazz sync server | Yes | Yes (CRDT convergence) | Wrong shape: CRDT + hosted sync, same no-go as Yjs at single-authority |
| **InstantDB** | Hosted real-time DB (Firebase-like) with reactive queries | Yes, but server-hosted, not local PGlite authority | Yes | Yes | Rejected: hosted backend conflicts with PGlite-in-sidecar local authority + privilege posture |
| **TanStack DB / live queries** | Client reactive collections, pairs with Electric shapes | No (needs a sync source underneath, e.g. Electric) | Yes | Only via the sync source | Closest to the UI half, but still needs a push source — does not replace the hub |
| **PGlite reactive / live queries** | PGlite live-query extension over the local store | No — in-process to one PGlite instance | Yes, within one PGlite process | No | Same ceiling as `PgliteClient.listen`/`notify` (see comparison table): in-process only |

None delivers a server-originated, post-commit event to *other* live desktop
connections without adopting a hosted backend or a CRDT runtime; each is
rejected on scope/posture, not overlooked.

**CRDT / Yjs — wrong problem.** Yjs is the production-default CRDT (~920K weekly
downloads) with a `y-websocket` provider and a separate Awareness CRDT for
presence ([github.com/yjs/yjs](https://github.com/yjs/yjs);
[y-websocket + Awareness](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket);
[CRDT comparison 2026](https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026)).
CRDTs solve concurrent multi-writer convergence, not single-authority
read-projection invalidation; **MIT**-licensed but imports a merge/awareness
model with no current consumer.

**DB-native triggers — complementary, not sufficient.**
- *Postgres LISTEN/NOTIFY* — built-in, no new service, but the NOTIFY payload
  must be **< 8000 bytes** (docs recommend "send the key of the record"
  [postgresql.org/docs/current/sql-notify](https://www.postgresql.org/docs/current/sql-notify.html);
  [stacksync analysis](https://www.stacksync.com/blog/beyond-listen-notify-postgres-request-reply-real-time-sync)),
  is **incompatible with PgBouncer transaction pooling** (LISTEN state is
  connection-specific — [pgbouncer#655](https://github.com/pgbouncer/pgbouncer/issues/655)),
  and delivers only to currently-connected listeners. A fine server-side trigger
  to *wake* the hub, but it terminates inside Postgres — it does not reach the
  desktop client.
- *FalkorDB / Redis keyspace notifications — cannot be the change source.*
  FalkorDB's `GRAPH.QUERY` has no streaming/subscribe/change-feed semantics
  ([docs.falkordb.com/commands/graph.query](https://docs.falkordb.com/commands/graph.query.html);
  [design docs](https://docs.falkordb.com/design/)). Redis keyspace
  notifications are disabled by default and Pub/Sub is fire-and-forget (events
  during a disconnect are lost,
  [redis.io/.../keyspace-notifications](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/)).
  Decisively, for **custom module datatypes** notifications are NOT
  auto-generated — the module must explicitly call
  `RedisModule_NotifyKeyspaceEvent()`, and there is no evidence FalkorDB does so
  per-node/per-edge ([redis#8782](https://github.com/redis/redis/issues/8782)).
  Conclusion: **the application write path must emit the refresh event itself**;
  this is the single strongest argument for an app-level hub over a DB feed.

**Net external read:** the build-it path (per-user registry + streaming RPC over
the existing transport) is the right size; every buy-it sync engine assumes a
shared Postgres + multi-device fan-out that is an explicit no-go at one user.

## In-Repo Capability Inventory

The repo already owns the entire substrate the hub composes onto. The hub itself
is genuinely net-new; its primitives, transport, and authority boundary are not.

**Streaming server-push transport — ALREADY EXISTS, proven.**
- `@beep/agents-use-cases` — `packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts`:
  `SendMessageRpc`/`EditMessageRpc` declared `stream: true` (lines 93–122) in the
  `ChatRpcs` `RpcGroup` (line 140), imported from `effect/unstable/rpc/Rpc` +
  `RpcGroup`. A proven server→client streaming RPC surface; a
  `SubscribeProjectionEvents` RPC lands as a sibling.
- `@beep/professional-desktop` — `apps/professional-desktop/src/transport/IpcChatClient.ts`:
  client transport is `RpcClient.layerProtocolSocket()` over ndjson framing on a
  Tauri IPC socket (`effect/unstable/rpc`, lines 15/31). No new client transport
  needed.
- WebSocket fan-out substrate (if a real WS is ever needed instead of Tauri IPC):
  `@beep/observability` — `packages/foundation/capability/observability/src/server/DevTools.ts`
  uses `effect/unstable/socket/Socket` `layerWebSocket` (lines 10, 95–96).
- Effect-beta RPC **server** transports are present in this repo's Effect
  (`node_modules/effect/dist/unstable/rpc/RpcServer.d.ts`): `layerProtocolSocketServer`,
  `layerProtocolWebsocket`, `layerProtocolHttp`, `layerProtocolStdio` — resolves
  the raw research's UNVERIFIED item on server export names.

**Authority write boundary — ALREADY EXISTS (the notify hook site).**
- `@beep/workspace-use-cases` — `packages/workspace/use-cases/src/aggregates/Thread/ThreadStore.ts`:
  the single persistence boundary, with `appendTurn` / `createThread` /
  `setTitleIfEmpty` (lines 137–146). The hub must call `notifyUser` *after* this
  commits (consumer of the write, not a second source of truth).

**Hub home — ALREADY EXISTS (empty of the hub).**
- `@beep/workspace-server` — `packages/workspace/server` (name verified;
  `src/{index.ts,Layer.ts,aggregates/}`). Exports the `Thread` server namespace +
  a workspace Layer; the scoped `EventStreamHub` service co-locates here, next to
  the authority boundary it serves.

**Concurrency primitives — partially in-repo-proven.**
- `MutableHashMap` (the per-user registry container) is **in-repo-proven**:
  `@beep/nlp` (`packages/foundation/capability/nlp/src/Graph/{TextGraph,GraphOps,EffectGraph}.ts`),
  `@beep/repo-utils`
  (`packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts`, lines
  360/437), and a test in
  `packages/foundation/modeling/schema/test/MutableHashMap.test.ts`.
- `SynchronizedRef` (the mutable-registry guard) — the module exists in Effect v4
  (`effect/SynchronizedRef`) but **NOT FOUND** in any repo `src` (zero usages on
  2026-06-29). Available primitive, pattern not yet exercised here — first user.

**Client projection-refresh substrate — ALREADY EXISTS.**
- `@effect/atom-react` (v4.0.0-beta.91) + `effect/unstable/reactivity` `Atom` are
  wired in `apps/professional-desktop/src/runtime/ProfessionalAtomRuntime.ts`
  (and the chat UI under `apps/professional-desktop/src/chat/ui/*`). The client
  side that consumes the subscription stream and invalidates UI projections is
  the existing Atom runtime. (Note: the dependency is `@effect/atom-react`, not
  the older `@effect-atom/atom-react` name in auto-memory.)
- App-local runtime wiring exists: `apps/professional-desktop/src/runtime/`
  (`Layer.ts`, `Pglite.ts`, `Observability.ts`, `ProfessionalAtomProvider.tsx`).
  PGlite-in-sidecar is the single-user authority store today.

**Existing reactive-invalidation paths vs the hub — comparison (Codex gate-1).**
The repo already owns three reactive-invalidation primitives. Comparing them
against the hub narrows its remit to **cross-window / server-originated**
invalidation only — it does not eliminate the hub, because none of these
carries a post-commit event from the authority write to a *separate* live
connection.

| Path | Event sources it covers | Cross-window / server-originated? | Why insufficient alone |
| --- | --- | --- | --- |
| Atom RPC `reactivityKeys` / `Reactivity.mutation` / `invalidateUnsafe` (`packages/agents/client/src/Chat.atoms.ts:144,181,200,494,529`) | Client-local: invalidates UI projections after a mutation the *same window* issued | No — same process, same window | Cannot deliver an invalidation that originated on the server post-commit or in another window |
| `SqlClient.reactive` / `reactiveMailbox` (`node_modules/effect/dist/unstable/sql/SqlClient.d.ts:43,48`) | Re-runs a query as a `Stream`/`Queue` when its declared keys are invalidated | No — keyed off in-process Reactivity | A reactive *re-query* primitive; still needs something to push the invalidation across connections |
| `PgliteClient.listen` / `notify` (`packages/drivers/pglite/src/PgliteClient.service.ts`; `@effect/sql-pglite` `listen`/`notify`, SqlError-typed Stream) | Postgres-channel pub/sub within one PGlite instance | Only within that single PGlite sidecar process | Terminates inside the DB process; does not reach a separate desktop renderer connection, and PGlite is single-writer |
| Custom `EventStreamHub` (NET-NEW) | Server-originated, post-commit, fanned to every live desktop connection of a user | Yes — explicit per-`UserId` targeted fan-out across N windows/connections | (This is the unique remit the three above leave uncovered) |

Net: the hub is **not** redundant with the existing reactive substrate, but its
job is narrower than "all invalidation" — the in-window UI-projection refresh is
already handled by Atom reactivity; the hub exists only to bridge a
server-side, post-commit event to *other* live connections. A first slice that
re-implements in-window invalidation in the hub would overbuild.

**Governing precedent / scope docs — ALREADY EXIST.**
- `goals/desktop-chat-surface/SPEC.md`: "No collaboration; no multi-user
  presence" (line 32); "Live Layer composition is app-local … no God Layers"
  (lines 82–84). Constrains the hub to a slice service + app-local Layer wiring.
- `explorations/local-first-voice/DECISIONS.md` (lines 125–156): a prior
  in-repo loop right-sized desktop work to an **attached spike** (single-workspace
  chat only; "do NOT graduate a goal packet yet"). Direct precedent for attaching
  this wedge rather than standing up a standalone packet.

**Genuine gaps — NOT FOUND in repo `src` (2026-06-29):**
- `EventStreamHub` — **NOT FOUND** (zero in `packages/**/src`, `apps/**/src`).
- `notifyUser` — **NOT FOUND** (zero usages).
- `Mailbox` usage — **NOT FOUND** (and the module itself is absent in Effect v4;
  see Constraints).
- `PubSub` usage — **NOT FOUND** in any `src` (the `effect/PubSub` module exists;
  it is simply unused today).
- FalkorDB **domain/projection** driver / client code — **NOT FOUND** as code:
  no `packages/drivers/falkordb`, no FalkorDB projection client in any `src`.
  The "FalkorDB projection" the hub would refresh is **aspirational, not a built
  consumer** — today only the UI projection is a real downstream.
  - **Correction (Codex gate-1, 2026-06-29):** the earlier absolute "FalkorDB
    appears only in `docs/`, `standards/`, and `.env.example`" was false. The
    repo *does* contain FalkorDB operational precedent — Graphiti MCP/FalkorDB
    proxy orchestration under
    `packages/tooling/tool/cli/src/commands/Graphiti/internal/{ProxyOps,ProxyConfig}.ts`
    (e.g. `GRAPHITI_FALKOR_SERVICE = "falkordb"`, `FALKOR_CONTAINER`
    env, `/var/lib/falkordb/data` mount checks), plus container-name strings in
    `packages/tooling/library/repo-utils/src/ProcessArgs.ts` JSDoc examples.
    This is dev/infra orchestration of an external FalkorDB container, **not** a
    reusable in-process projection client — the projection-consumer gap stands,
    but the inventory should not claim "docs only."

## Constraints

**Effect v4 beta API drift — the central primitive must change (HARD).** This
repo is on `effect@4.0.0-beta.91`. There is **no `effect/Mailbox` module**
(verified: no `Mailbox.*` under `node_modules/effect/dist`). The Effect 3.8
experimental Mailbox folded into the unified **`Queue`** in v4:
`Queue.make<A, E>()` with `offer`/`offerAll`, `end` (success/done completion via
the `Done` cause tag), `fail` (error completion), `take`/`takeAll`, `shutdown`,
and `Stream.fromQueue` to drain it (verified in
`node_modules/effect/dist/Queue.d.ts` lines 247/692/848 + `Stream.d.ts`
`fromQueue`). The raw research's `conn.mailbox.offer(event)` /
`Mailbox.toStream()` references are a v3 API — the **concept maps cleanly** (one
Queue per live connection, drained as a Stream by that connection's RPC handler)
but the concrete code must be `Queue` + `Stream.fromQueue`. `PubSub` (module
`effect/PubSub`) is the stable broadcast fallback if Queue semantics churn.

**Import convention (Effect v4, LOCKED by repo law).** Imports are
`effect/unstable/…` for rpc (`effect/unstable/rpc/{Rpc,RpcGroup}`, `RpcClient`,
`RpcServer`), sockets (`effect/unstable/socket/Socket`), and reactivity
(`effect/unstable/reactivity`); root `effect` for core combinators
(`MutableHashMap`, `SynchronizedRef`, `Queue`, `PubSub`). Matches the existing
`Chat.rpc.ts` / `IpcChatClient.ts` / `ProfessionalAtomRuntime.ts` imports and the
`effect-v4-imports` skill.

**Licensing gravity — reimplement, never copy.**
- *TalentScore (the ported shape) is commercial-licensed* → port the **design
  shape** (scoped Service + per-user `MutableHashMap` registry + targeted
  `notifyUser` + dead-mailbox prune), **never copy code** (CAPTURE lines 33, 49).
- *PowerSync server/CLI = FSL* (source-available, **non-compete**, converts to
  Apache-2.0 at each release's 2nd anniversary) — matters only if ever embedded
  in a competing commercial offering; client SDKs Apache-2.0/MIT.
- *ElectricSQL = Apache-2.0*; *Yjs = MIT*; *Zero = own protocol* — all are
  clean-license but **explicit no-gos for the current appetite** (sync-engine
  scope), so the *sync-engine* license question is moot until a multi-device
  roadmap revives them.
- *FalkorDB = SSPLv1 — NOT a clean license (HARD, Codex gate-1).* FalkorDB ships
  under the **Server Side Public License v1** (strong copyleft;
  [docs.falkordb.com/References/license](https://docs.falkordb.com/References/license.html);
  [github.com/FalkorDB/FalkorDB `LICENSE.txt`](https://github.com/FalkorDB/FalkorDB/blob/master/LICENSE.txt)).
  Internal/single-user use does not trigger copyleft, but **offering FalkorDB's
  functionality as a service, or bundling/hosting/distributing a FalkorDB-backed
  projection, triggers SSPL's service-source obligation**. This is not a moot
  detail given the proposal names FalkorDB as a future projection consumer:
  - This wedge introduces **no FalkorDB runtime** — only a typed refresh event
    the write path emits; no FalkorDB code is bundled or distributed here.
  - Require explicit **legal / architecture review before** bundling, hosting,
    or distributing any FalkorDB-backed projection (especially in the
    privilege-sensitive legal-AI context). Track SSPLv1 as an open licensing
    gate, not a settled "clean" item. A non-SSPL graph backend may be warranted
    if the projection ever ships in a hosted/distributed product.

**Locked decisions / scope boundaries.**
- `desktop-chat-surface/SPEC.md` non-goal "No collaboration; no multi-user
  presence" **rules out CRDT/Yjs** for this wedge.
- "App-local live Layer; no God Layers" → the hub **service** belongs in
  `@beep/workspace-server`; only the live-Layer wiring + client subscription
  belong in `apps/professional-desktop`.
- local-first-voice precedent → **attach as a spike, do not graduate a standalone
  packet** at this appetite. Single-workspace / single-user today means the
  per-`UserId` map is degenerate (one key, N windows) — a thin hub suffices; a
  sync engine is unjustified.

**Authority / projection / offline boundary (load-bearing).** The hub is a
**consumer of** the committed `ThreadStore` write — `notifyUser` fires *after*
the transaction commits, never as a second source of truth. Because **FalkorDB
cannot self-emit reliable graph-change events** (custom-module datatypes require
an explicit `RedisModule_NotifyKeyspaceEvent` call; Redis pub/sub is
fire-and-forget; notifications off by default), the app write path must emit one
typed refresh event that **both** the UI projection and any future FalkorDB
projection consume. Today's authority store is **PGlite-in-sidecar, single-user**
(`apps/professional-desktop/src/runtime/Pglite.ts`), so the hub is invoked
**directly** from the `ThreadStore` write path — no Postgres LISTEN/NOTIFY in the
loop, and its <8000-byte-payload / PgBouncer-transaction-pooling limits only
apply once writes ever centralize on a shared server Postgres.

**Implementation surface — not a literal drop-in (HARD, Codex gate-1).** The
*transport exists and is proven* (the load-bearing fact). But "a few files /
drop-in" understates the design work that decides correctness. Before the hub is
real, this checklist must be resolved — treat it as design, not boilerplate:
- **User/session identity:** how a live connection resolves to a `UserId` (and,
  under Tauri, how N renderer windows map to one user) — the registry key.
- **Event schema + authorization:** the typed refresh event's `Schema`, and who
  is allowed to subscribe to whose events (single-user today, but the contract
  must not assume it).
- **Queue capacity / backpressure policy:** bounded vs sliding/dropping per
  connection, and what happens to a slow or stalled consumer.
- **Post-commit hook placement:** firing `notifyUser` *after* commit across
  **both** `ThreadStore` implementations (Drizzle and in-memory), without
  leaking the hub into the store's source-of-truth role.
- **Subscription finalizer + lifecycle tests:** `Scope`-based `register` /
  `unregister` on connection open/close, with finalizer tests; half-open-socket
  / stale-connection prune; reconnect / missed-event behavior.
- **Multi-window Tauri identity + observability:** per-connection tracing/metrics
  and the cross-window identity story.
- **Unresolved RPC home:** the subscription RPC contract placement
  (`@beep/agents-use-cases` vs `@beep/workspace-use-cases`) is still open (see
  Routing cautions) and gates where the contract lands.

Rough effort: this is a small-but-real slice (multi-file, with lifecycle and
authority-hook tests), **not** a single-file addition. Keep "transport proven"
and "invalidation/lifecycle is design work" as distinct facts.

**Routing cautions (defer to align stage).**
- Hub **service** → `@beep/workspace-server` (settled). Subscription **RPC
  contract** placement — `@beep/agents-use-cases` (beside `ChatRpcs`) vs
  `@beep/workspace-use-cases` — is an **UNRESOLVED** slice-ownership call for the
  authority/projection/cache standard; do not pre-commit.
- Live-Layer wiring + client subscription land **only** in
  `apps/professional-desktop` (shell / cross-slice composition; no slice product
  code in the app per auto-memory's vertical-slice rule).
- Coordinate explicitly with: `goals/desktop-chat-surface` (RPC surface +
  app-local Layer), `goals/workspace-thread-domain` (`ThreadStore` write hook),
  and the authority/projection/cache standard (hub = the invalidation signal,
  downstream of the committed write).
- **Escalation conditions** to revisit a sync engine / standalone packet (all
  explicit no-gos now): multi-device/multi-user fan-out (→ reconsider
  PowerSync/Electric over shared Postgres); a generic cross-slice event bus (→
  promote hub to shared-kernel service); real-time co-editing (→ Yjs/CRDT). Keep
  the hub behind a small port so the swap stays cheap.

**Unverified / carry-forward (from raw research, still open):** whether FalkorDB
calls `RedisModule_NotifyKeyspaceEvent` at all and at what granularity (mechanism
proves it is opt-in and undocumented for FalkorDB — confirm by reading FalkorDB
`src/` only if it becomes load-bearing); and the exact single- vs multi-consumer
guarantees of the v4 `Queue` done-signal — pin to beta.91 and read the live
`effect/Queue` source before committing the hub to it.

---

_Codex gate-1 folded 2026-06-29: 3 blocking + 5 advisory addressed._
