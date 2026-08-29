# Local-First Projection Sync — Decisions

## 2026-08-13 — Packet graduation and re-entry

**Decision:** Close the packet as `graduated`. A gated candidate trigger —
multi-window delivery evidence, a second projector-family owner, or graph
projection approval after SSPL review — reopens it at `decompose`.

The align gate closed on 2026-07-14. All seven questions and the fan-out
primitive are ratified. Full research and provenance remain in
[`RESEARCH.md`](./RESEARCH.md) and [`research/SOURCES.md`](./research/SOURCES.md).

## 2026-07-14 — Q1 Build-vs-buy — LOCKED

**Question:** Build a repo-native projection-dispatch seam, or purchase a sync
platform?

**Answer:** Build a thin repo-native seam. Commit a projection intent
transactionally with the accepted authority record in repo-native Postgres,
then use Effect v4 `DurableQueue` plus a persistence-backed worker for durable
projector work. Emit a deliberately weaker ephemeral "projection version
changed; re-query" hint only after durable state makes convergence possible.

**Rationale:** The need is accepted-record projection dispatch, not a second
authority, bidirectional synchronization, or a general replication platform.
ElectricSQL and PowerSync are materially broader than this boundary. The
original in-memory `EventStreamHub` cannot own durable work. The documents
`VaultSyncEngine` is useful precedent for cursor/status/retry concerns, but its
provider mirror semantics are not generalized or reused.

**Rejected options:** ElectricSQL or PowerSync adoption; database or IPC hints
as the durable path; generalizing `VaultSyncEngine`; copying TalentScore code.
TalentScore's license conflict remains deferred, so any design-pattern reuse is
clean-room only.

## 2026-07-14 — Q2 Standalone ownership — LOCKED

**Question:** Attach this work to another packet or graduate a standalone goal?

**Answer:** Graduate [`projection-dispatch-core`](../../goals/projection-dispatch-core/)
as its own goal. Desktop delivery is one bounded dependent increment inside the
goal.

**Rationale:** Projection dispatch has its own durable state, worker failure
domain, replay contract, authorization boundary, and restart proof. It is not
part of `epistemic-bitemporal-edge-core`, whose authority path excludes
projections, and it is not part of `hybrid-retrieval-fusion-core`, which owns
ranking rather than projection delivery.

**Rejected options:** The pre-draft recommendation to wedge the hub into
`ThreadStore` or desktop/workspace work; attaching it to the bitemporal
authority goal; attaching it to retrieval fusion; creating a shared package
before a second producer proves identical semantics.

## 2026-07-14 — Q3 First vertical slice — LOCKED

**Question:** What complete behavior must the first slice prove?

**Answer:** Prove one accepted-record projection cycle:

1. atomically commit one accepted authority record and one projection intent;
2. derive the idempotency key from `{ authorityRecordId, authorityVersion,
   projectionTarget }`;
3. process the intent through a persistence-backed `DurableQueue` worker;
4. update one deliberately trivial, rebuildable repo-native read projection;
5. record target cursor/status and prove retry without duplicates or regression;
6. emit an ephemeral version-change hint;
7. have the desktop re-query and observe the new version; and
8. kill/restart before and after worker completion, then reconnect without the
   hint and still converge.

**Rationale:** This is the smallest end-to-end proof that separates durable
projection truth from disposable UI freshness while exercising both ambiguous
completion windows.

**Rejected options:** UI-only invalidation; the pre-draft `ThreadStore` write
wedge; RRF, vector scoring, retrieval policy, FalkorDB, or generic multi-device
replication in the first slice.

## 2026-07-14 — Q4 Fan-out primitive — LOCKED

**Question:** What primitive carries durable projector work and live freshness?

**Answer:** Use two planes. The durable plane is `DurableQueue` with isolated
workers per target family, bounded concurrency, an explicit retry policy, and
recorded target cursor/status. The ephemeral plane uses the smallest primitive
proved by the transport topology: a scoped queue/stream for the current single
IPC session; `PubSub` only after same-process broadcast is demonstrated; a
per-audience connection registry only after multiple independently scoped
connections exist.

**Rationale:** Durable projector work and live hints have different delivery
guarantees. Keeping them separate prevents a missed notification from becoming
lost work and prevents speculative multi-window infrastructure.

**Rejected options:** The v3-era in-memory hub as durable ownership; one shared
worker failure domain for every target family; speculative `PubSub`, mailbox,
or connection-registry topology.

## 2026-07-14 — Q5 Placement — LOCKED

**Question:** Where do the contracts, persistence, workers, and desktop bridge
live?

**Answer:** Place schemas, dispatch/status ports, and the subscription RPC in
`packages/epistemic/use-cases`; worker/projector composition in
`packages/epistemic/server`; authority and projection persistence in
`packages/epistemic/tables`; and the workflow persistence adapter in
`packages/drivers/workflow`. Put the desktop handler merge and client
subscription in `apps/professional-desktop`.

**Rationale:** These homes follow existing slice roles while keeping the
unstable workflow store adapter reusable. The adapter and crash proof from
`goals/effect-v4-workflow-engine-spike` are a prerequisite. A shared
`@beep/projection` package is justified only by a second non-epistemic producer
with identical semantics.

**Rejected options:** `@beep/workspace-*`; an app-owned durable worker; a new
shared package now; projection behavior inside authority or retrieval ranking.

## 2026-07-14 — Q6 Subscription authentication and authorization — LOCKED

**Question:** What identifies a subscriber, and who authorizes its projection
scope?

**Answer:** Authenticate the desktop launch with the per-launch RPC token in
`apps/professional-desktop/server/RpcSessionAuth.ts`. Treat requested
workspace/matter scope as untrusted input; the server must resolve and
authorize the effective projection scope before registering the subscription.
The launch token authenticates a launch, not a user, so do not invent a
singleton `UserId`. Name a future principal boundary explicitly.

**Rationale:** The live desktop RPCs currently trust client-supplied
`workspaceId`. Repeating that gap on a long-lived subscription would turn an
authentication mechanism into false audience authorization.

**Rejected options:** Client-trusted workspace/matter scope; deriving a user
from the launch token; a global singleton audience; postponing authorization
until multi-user support.

## 2026-07-14 — Q7 FalkorDB — LOCKED

**Question:** Does v1 include or anticipate a FalkorDB graph projection?

**Answer:** FalkorDB is SSPL and excluded from v1. Any future graph projection
must be rebuildable, driver-isolated, non-authoritative, and separately
approved.

**Rationale:** This preserves the bitemporal authority doctrine and keeps
license, topology, and graph semantics out of the first projection-dispatch
proof.

**Rejected options:** FalkorDB in the first slice; graph storage in the
authority path; a graph-specific field in the v1 dispatch contract; treating
SSPL approval as implicit.

## Deferred questions

### 2026-07-14 — Durable adapter freeze — DEFERRED

Do not freeze the `DurableQueue`/`PersistedQueueFactory` adapter contract until
[`effect-v4-workflow-engine-spike`](../../goals/effect-v4-workflow-engine-spike/)
lands its persistence, atomicity, competing-worker, and kill/restart evidence.
This is a dependency gate, not an open align question.

### 2026-07-14 — Live multi-connection topology — DEFERRED

Do not choose `PubSub` or a connection registry until runtime proof shows
same-process broadcast or multiple independently scoped desktop connections.
The first slice uses one scoped queue/stream and must still converge without a
hint.

### 2026-07-14 — TalentScore license reconciliation — DEFERRED

The gold-intake ledger says MIT while packet prose says commercial. Until the
license of record is reconciled from authoritative upstream evidence,
TalentScore is reference-only and design-pattern reuse is clean-room. See
[`research/SOURCES.md`](./research/SOURCES.md#2-upstream-repositories--licenses).
