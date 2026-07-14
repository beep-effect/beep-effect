# Local-First Projection Sync — Sources & Provenance

Provenance ledger for this packet: it joins the one mined gold nugget in this
packet's cluster to its upstream repo and unresolved license, the external
research already on disk, and the live repo bricks used by the ratified
two-plane projection-dispatch seam. Derived from the gold-intake cluster
**"Local-first projection sync (EventStreamHub)"** (route `new-exploration`,
wave `P2`, theme `desktop-portal`).

- Cluster: `Local-first projection sync (EventStreamHub)` — 1 nugget, 1 upstream repo.
- Gold-intake provenance: [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (`### Desktop & document portal` → `#### Per-user live connection hub for projection sync`, source line `GOLD_SYNTHESIS.md:1341`).
- Packet codex review: [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) (research-gate critique, 3 blocking + 5 advisory, folded into RESEARCH.md).

> **License conflict deferred, safe disposition fixed — see §2.** The gold-intake
> catalog (this packet's authoritative source bundle) records TalentScore as
> **MIT**. The packet prose (CAPTURE L48–49, RESEARCH "Licensing gravity",
> DECISIONS, raw research) instead asserts TalentScore is *commercial-licensed*
> without authoritative license evidence on disk to reconcile the two. The
> 2026-07-14 align gate therefore makes TalentScore **reference-only and
> clean-room design-pattern reuse only** until authoritative upstream evidence
> resolves the license of record. No code is copied and graduation does not
> depend on the donor.

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| TalentScore#10 | Per-user live connection hub for local-first real-time projection sync | TalentScore | `packages/server/src/public/event-stream/event-stream-hub.ts:83-118` | desktop-portal | P2 | **reference only** — clean-room study of targeted live fan-out; it does not own durable work |

**How this nugget informs the packet.** This is a single-nugget cluster: the
whole packet exists to evaluate and right-size TalentScore#10.

- *The precedent studied* — a **targeted server-push fan-out hub**: a scoped
  `Effect.Service` holding a guarded `MutableHashMap<UserId, ActiveConnection[]>`
  registry with `register` / `unregister` / `notifyUser`, fanning one typed
  event out to only that user's live connections and pruning dead consumers. The
  load-bearing contract is the `notifyUser` entry point the authority write path
  calls *after* it commits (RESEARCH "Authority / projection / offline
  boundary"). The upstream snippet carries the concrete signature:
  `notifyUser(userId, event)` iterating a user's connections and offering the
  event to each connection's queue with `{ discard: true }`.
- *What to leave* — the upstream's `effect/Mailbox` primitive and
  `conn.mailbox.offer(event)` / `Mailbox.toStream()` calls are a **dead v3 API**
  in this repo's pinned Effect v4 beta. The first ephemeral plane may use one
  scoped queue/stream for the current IPC session, but no donor hub or registry
  is implemented without topology proof. Leave the `Clock.currentTimeMillis`-gated prune as a half-open
  backstop only; prefer `Scope`-based register/unregister finalizers (codex
  gate-1, A2). Leave the upstream's WebSocket transport — the desktop reuses the
  proven Tauri-IPC streaming-RPC surface (§4).
- *Do not promote the nugget into architecture* — durable work belongs to
  repo-native intent persistence plus Effect v4 `DurableQueue`; the live hint is
  disposable. The per-user registry is gated because no user principal or
  multiple independently scoped desktop connections are proved today.

This is **not** a split cluster — no sibling packet shares this nugget.

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| TalentScore | T1 | **UNRESOLVED:** gold-intake says MIT; packet prose says commercial | **Reference-only; clean-room design-pattern study; never copy code until reconciled** | Targeted live fan-out as historical precedent only; no durable ownership and no invented `UserId` |

> **Cautions (echoed from the bundle).** `P2 desktop/local-first concern;
> coordinate with the authority/projection/cache standard.` The hub is the
> invalidation *signal* downstream of a committed authority write — it must
> compose with, not pre-empt, that standard's slice-ownership and
> projection/cache decisions.
>
> **Licensing gravity beyond the ported repo (from RESEARCH "Constraints").**
> The buy-it alternatives surveyed in §3 carry their own licenses —
> ElectricSQL **Apache-2.0**, Yjs **MIT**, PowerSync server/CLI **FSL**
> (source-available, non-compete, → Apache-2.0 at each release's 2nd
> anniversary; client SDKs Apache-2.0/MIT), Zero **own protocol** — all are
> explicit no-gos at the current single-user appetite, so their license
> questions are moot until a multi-device roadmap revives them. **FalkorDB ships
> under SSPLv1 (strong copyleft):** internal/single-user use does not trigger
> copyleft, but bundling/hosting/distributing a FalkorDB-backed projection
> triggers SSPL's service-source obligation. This wedge introduces **no FalkorDB
> runtime** (only a typed refresh event); track SSPLv1 as an open licensing gate
> (DECISIONS Q7) and require legal/architecture review before any FalkorDB
> projection ships. The 2026-07-14 decision excludes FalkorDB from v1 and
> requires separate approval for any driver-isolated, rebuildable,
> non-authoritative graph projection.

## 3. External research sources

All URLs below are reproduced from this packet's own
[`RESEARCH.md`](../RESEARCH.md) and
[`research/eventstreamhub-projection-fanout-and-attach-vs-standalone.md`](./eventstreamhub-projection-fanout-and-attach-vs-standalone.md)
("Sources" section). Grouped by the claim they ground.

**Effect-native primitives (the build-it path).**
- Effect — PubSub docs (broadcast vs Queue, backpressure variants): https://effect.website/docs/concurrency/pubsub/
- Effect — 3.8 release (experimental `effect/Mailbox`; v3 API, folded into v4 `Queue`): https://effect.website/blog/releases/effect/38/
- Effect — @effect/rpc README (streaming responses, `layerProtocolWebsocket`, server push): https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md
- Effect — 2.3 release (RPC rewrite adds streaming): https://effect.website/blog/releases/effect/23/
- Effect — @effect/rpc package: https://www.npmjs.com/package/@effect/rpc

**Sync engines (the buy-it alternatives, all rejected at this appetite).**
- ElectricSQL — Postgres Sync product: https://electric-sql.com/products/postgres-sync
- ElectricSQL — Shapes guide: https://electric-sql.com/docs/guides/shapes
- ElectricSQL — 1.0 GA (2025-03-17): https://electric-sql.com/blog/2025/03/17/electricsql-1.0-released
- ElectricSQL — source repo: https://github.com/electric-sql/electric
- ElectricSQL — @electric-sql/client: https://www.npmjs.com/package/@electric-sql/client
- PGlite — Electric sync integration: https://pglite.dev/docs/sync
- PowerSync — Service architecture: https://docs.powersync.com/architecture/powersync-service
- PowerSync — Sync Rules from first principles: https://www.powersync.com/blog/sync-rules-from-first-principles-partial-replication-to-sqlite
- PowerSync — Functional Source License (FSL): https://powersync.com/legal/fsl
- PowerSync — "A New Open Era": https://www.powersync.com/blog/new-open-era-for-powersync
- PowerSync — open-source package licensing: https://powersync.com/open-source
- PowerSync — Service release notes: https://releases.powersync.com/announcements/powersync-service
- Rocicorp Zero — 1.0 (InfoQ, 2026-06): https://www.infoq.com/news/2026/06/zero-version-1/
- Rocicorp Zero — when to use: https://zero.rocicorp.dev/docs/when-to-use

**Lighter local-first / CRDT alternatives (scanned, rejected on scope/posture).**
- Yjs — source repo: https://github.com/yjs/yjs
- Yjs — y-websocket provider + Awareness: https://docs.yjs.dev/ecosystem/connection-provider/y-websocket
- CRDT comparison (Yjs/Automerge/Loro, 2026): https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026

**DB-native triggers (complementary, not sufficient).**
- PostgreSQL — NOTIFY docs (<8000-byte payload, send-the-key pattern): https://www.postgresql.org/docs/current/sql-notify.html
- Stacksync — LISTEN/NOTIFY limit analysis: https://www.stacksync.com/blog/beyond-listen-notify-postgres-request-reply-real-time-sync
- PgBouncer — LISTEN/NOTIFY vs transaction pooling (issue #655): https://github.com/pgbouncer/pgbouncer/issues/655
- Redis — keyspace notifications (disabled by default, fire-and-forget): https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/
- Redis — issue #8782 (module datatypes must call `RM_NotifyKeyspaceEvent` explicitly): https://github.com/redis/redis/issues/8782
- FalkorDB — GRAPH.QUERY command docs (no subscribe/stream): https://docs.falkordb.com/commands/graph.query.html
- FalkorDB — design docs (GraphBLAS internals; no change-feed): https://docs.falkordb.com/design/
- FalkorDB — source repo: https://github.com/FalkorDB/FalkorDB
- FalkorDB — license (SSPLv1): https://docs.falkordb.com/References/license.html · https://github.com/FalkorDB/FalkorDB/blob/master/LICENSE.txt

## 4. In-repo capability references

Paths were rescanned on 2026-07-14. The ratified design composes these bricks:

- Effect v4 durable queue —
  `node_modules/effect/src/unstable/workflow/DurableQueue.ts` — **reuse after
  prerequisite proof** (`idempotencyKey`, persisted processing, worker
  concurrency, `WorkflowEngine` and `PersistedQueueFactory` requirements).
- Workflow persistence adapter — `packages/drivers/workflow` — **NET-NEW in
  `goals/effect-v4-workflow-engine-spike`**; do not freeze or duplicate it here.
- Epistemic contracts — `packages/epistemic/use-cases` — **NET-NEW dispatch,
  status, and subscription RPC contracts** in an existing slice/package.
- Epistemic persistence — `packages/epistemic/tables` — **NET-NEW accepted
  record/intent/projection/cursor persistence** in an existing slice/package.
- Epistemic worker composition — `packages/epistemic/server` — **NET-NEW
  isolated target-family worker/projector composition**.
- Documents precedent —
  `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts` and
  `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts` —
  **study only** for cursor/status/retry concerns; do not generalize its
  vault/provider model.
- Desktop re-query — `apps/professional-desktop/src/sync/Sync.atoms.ts` —
  **reuse pattern** for reactivity-keyed RPC reads and invalidation.
- Desktop transport —
  `apps/professional-desktop/src/transport/TauriIpcSocket.ts` and
  `IpcChatClient.ts` — **extend** the scoped Effect socket/RPC bridge; no
  multi-connection claim.
- Desktop launch auth —
  `apps/professional-desktop/server/RpcSessionAuth.ts` — **reuse authentication;
  NET-NEW server-side scope authorization**. The launch token is not a user
  principal.
- Scoped queue/stream hint — **NET-NEW, minimal and ephemeral**. `PubSub` and a
  per-audience registry stay gated by topology evidence.
- FalkorDB projection client — **NET-NEW / gated / not v1**. Existing Graphiti
  proxy orchestration is not a reusable projector.

## 5. Cross-links & provenance

- Cluster id: `local-first-projection-sync` (route `new-exploration`, wave `P2`, theme `desktop-portal`). Bundle `crossref`: none.
- Packet exploration trail: [`../CAPTURE.md`](../CAPTURE.md) · [`../RESEARCH.md`](../RESEARCH.md) · [`../DECISIONS.md`](../DECISIONS.md) (Q1–Q7 locked 2026-07-14) · [`../BRIEF.md`](../BRIEF.md) · [`../MAP.md`](../MAP.md) · [`../ops/manifest.json`](../ops/manifest.json).
- Raw per-subtopic research: [`./eventstreamhub-projection-fanout-and-attach-vs-standalone.md`](./eventstreamhub-projection-fanout-and-attach-vs-standalone.md).
- Codex review: [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md).
- Gold synthesis: [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) — `### Desktop & document portal` → `#### Per-user live connection hub for projection sync` (`GOLD_SYNTHESIS.md:1341`).
- Graduated goal: [`goals/projection-dispatch-core`](../../../goals/projection-dispatch-core/) — carries this ledger's relevant corpus for implementation.
- Cross-packet boundaries: `goals/epistemic-bitemporal-edge-core` is the authority producer; `goals/hybrid-retrieval-fusion-core` owns downstream ranking; `goals/effect-v4-workflow-engine-spike` owns the prerequisite persistence/crash proof.
- Superseded pre-draft: the `ThreadStore` attach wedge and in-memory durable hub premise remain historical research only.
