# Projection Dispatch Core Spec

## Objective

Deliver one complete accepted-record projection cycle in which a repo-native
Postgres transaction atomically persists one accepted authority record and one
projection intent; a persistence-backed Effect v4 `DurableQueue` worker applies
one trivial rebuildable repo-native read projection; target cursor/status makes
retry, duplication, and regression observable; and the professional desktop
re-queries after a disposable version-change hint. Real process kills before
and after worker completion, followed by reconnect without the hint, must still
converge to the durable version.

## Non-Goals

- ElectricSQL, PowerSync, or another sync-engine purchase.
- In-memory queue, stream, hub, notification, or IPC state owning durable work.
- RRF, vector scoring, retrieval policy, encoder, reranking, or fusion behavior.
- FalkorDB or any graph projection in v1.
- Generic multi-device replication, collaborative sync, or multi-user presence.
- Speculative `PubSub`, per-audience registry, or multi-window topology.
- Client-trusted workspace/matter subscription scope or an invented singleton
  `UserId`.
- Generalizing or reusing documents `VaultSyncEngine` semantics.
- A shared `@beep/projection` package before a second non-epistemic producer
  proves identical semantics.
- Changes to `goals/INDEX.md`.

## Source Hierarchy

1. The user-ratified 2026-07-14 graduation objective and
   [`BRIEF.md`](../../explorations/local-first-projection-sync/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. Exploration [`DECISIONS.md`](../../explorations/local-first-projection-sync/DECISIONS.md),
   [`MAP.md`](../../explorations/local-first-projection-sync/MAP.md), and research.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/epistemic/use-cases` for schema-first projection intent, target,
  cursor/status, typed errors, dispatch/status ports, and subscription RPC.
- `packages/epistemic/server` for isolated target-family worker and projector
  composition, retry policy, and the ephemeral hint publisher.
- `packages/epistemic/tables` for repo-native Postgres authority, projection
  intent, trivial read projection, cursor/status, and migration bindings.
- `packages/drivers/workflow` only through the persistence adapter and crash
  contract landed by `goals/effect-v4-workflow-engine-spike`.
- `apps/professional-desktop` for the RPC handler merge, scoped subscription,
  server-authorized projection scope, re-query, and focused integration proof.
- Focused package/app tests and packet evidence under `history/`.

## Constraints

1. **Appetite status: proposed — ratify before commit.** One focused goal: a
   persistence-backed accepted-record projection cycle plus bounded desktop
   freshness proof; cut additional projector families, multi-window topology,
   graph projection, and shared packaging.
2. `goals/effect-v4-workflow-engine-spike` is a hard prerequisite. P0 begins
   only after its persistence adapter, store atomicity limits, ambiguous
   completion, competing-worker, and real kill/restart evidence are available.
   Do not build a second adapter or bespoke durability layer.
3. P0 must prove the atomicity/recovery contract from accepted authority record
   through projection intent into `DurableQueue`. The record and intent commit
   atomically in repo-native Postgres; any relay to the persisted queue must be
   lossless under a documented recovery boundary without claiming exactly-once
   delivery.
4. The idempotency key is a deterministic, versioned encoding of exactly
   `{ authorityRecordId, authorityVersion, projectionTarget }`. Collision,
   retention, stale-work, and schema-evolution behavior must be explicit.
5. The first target is deliberately trivial, repo-native, and rebuildable. Its
   worker has target-family isolation, bounded concurrency, explicit retry, and
   no dependency on retrieval, graph, or ranking policy.
6. Target cursor/status is persistent and monotonic. Define queued, processing,
   succeeded, retryable-failed, terminal-failed, and stale/no-op behavior;
   status/cursor may not regress after retry or older-version delivery.
7. Prove retries do not duplicate the projection and an older authority version
   cannot overwrite a newer projection or cursor. Classify delivery honestly as
   at-least-once plus idempotent/effectively-once where evidence supports it.
8. Durable projection completion precedes the hint. The hint carries only the
   minimum target/scope/version needed to re-query and is never replay or
   recovery state.
9. The first ephemeral primitive is one scoped queue/stream for the current IPC
   session. Use `PubSub` only after same-process broadcast proof; use a
   per-audience registry only after multiple independently scoped connections
   exist.
10. Reconnect always queries durable target status/version. Kill the process
    before worker completion and after business completion; start a fresh
    process against the same store; withhold the hint; and still converge.
11. Authenticate the desktop session with the per-launch token in
    `apps/professional-desktop/server/RpcSessionAuth.ts`. The token authenticates
    a launch, not a user. Do not derive or invent `UserId` from it.
12. Requested workspace/matter scope is untrusted. The server must resolve and
    authorize effective projection scope before registering a subscription.
    Existing RPC trust in client-supplied `workspaceId` is a known gap and must
    not be copied. Name an explicit future principal boundary.
13. `VaultSyncEngine` and `Sync.atoms.ts` are precedent only for cursor/status
    and re-query shape. Do not share provider-mirror domain behavior.
14. FalkorDB is SSPL and excluded. Any future graph target requires a separate
    approved goal and remains rebuildable, driver-isolated, and non-authoritative.
15. Follow schema-first and Effect-first laws, package-alias test imports, and
    focused changes without unrelated churn.

## Decision Log

Full rationale and rejected options remain in the exploration.

| Date | Locked decision | Source |
| --- | --- | --- |
| 2026-07-14 | Thin repo-native transactional intent plus persistence-backed `DurableQueue`; sync engines and an in-memory durable hub rejected. | [`Q1`](../../explorations/local-first-projection-sync/DECISIONS.md#2026-07-14--q1-build-vs-buy--locked) |
| 2026-07-14 | Standalone `projection-dispatch-core`; desktop delivery is bounded inside it. | [`Q2`](../../explorations/local-first-projection-sync/DECISIONS.md#2026-07-14--q2-standalone-ownership--locked) |
| 2026-07-14 | One complete accepted-record cycle with retry/no-regress and two kill/restart windows. | [`Q3`](../../explorations/local-first-projection-sync/DECISIONS.md#2026-07-14--q3-first-vertical-slice--locked) |
| 2026-07-14 | Two unequal planes; isolated durable workers and the smallest proved ephemeral primitive. | [`Q4`](../../explorations/local-first-projection-sync/DECISIONS.md#2026-07-14--q4-fan-out-primitive--locked) |
| 2026-07-14 | Epistemic use-cases/server/tables, shared workflow driver, and app-local desktop bridge. | [`Q5`](../../explorations/local-first-projection-sync/DECISIONS.md#2026-07-14--q5-placement--locked) |
| 2026-07-14 | Per-launch authentication plus server-authorized projection scope; no invented user principal. | [`Q6`](../../explorations/local-first-projection-sync/DECISIONS.md#2026-07-14--q6-subscription-authentication-and-authorization--locked) |
| 2026-07-14 | FalkorDB excluded from v1; any future graph target is separately approved and non-authoritative. | [`Q7`](../../explorations/local-first-projection-sync/DECISIONS.md#2026-07-14--q7-falkordb--locked) |

## Acceptance Criteria

- [ ] P0 archives the sibling workflow spike evidence it consumes and an
      explicit atomic handoff/recovery contract from authority transaction to
      persisted queue, with no unsupported exactly-once claim.
- [ ] One transaction persists an accepted authority record and matching
      projection intent atomically in repo-native Postgres.
- [ ] The deterministic key encodes exactly `authorityRecordId`,
      `authorityVersion`, and `projectionTarget`, with collision/version tests.
- [ ] A persistence-backed `DurableQueue` worker with bounded concurrency and
      retry applies one isolated trivial rebuildable read projection.
- [ ] Persistent target cursor/status exposes the named states; retry makes no
      duplicate; stale work cannot regress projection data, version, or cursor.
- [ ] A scoped authenticated subscription emits a minimal version-change hint
      only after durable progress, and the desktop re-query observes the new
      durable version.
- [ ] Server-side authorization rejects an authenticated launch requesting a
      projection scope it is not allowed to subscribe to; no client-supplied
      workspace/matter scope is trusted and no `UserId` is fabricated.
- [ ] Fresh-process kill/restart proof covers a kill before worker completion
      and after worker completion. After reconnect with the hint withheld, the
      desktop still converges by durable status/version re-query.
- [ ] Tests prove target-family failure isolation and that the hint path can be
      dropped without losing or duplicating durable work.
- [ ] No sync platform, retrieval/ranking behavior, FalkorDB, graph target,
      speculative registry, shared projection package, or unrelated refactor
      enters the diff.
- [ ] Focused checks, repo quality, reflection lint, and Yeet PR-to-mergeable
      proof pass.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/projection-dispatch-core/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/projection-dispatch-core/ops/manifest.json` | Passes |
| Packet references | `rg -n "projection-dispatch-core|blockedBy|GOAL.md|agentLaunchers|packetAnchorDocument" goals/projection-dispatch-core` | Expected references present |
| Atomic handoff | P0 transaction/recovery design plus fault-injection proof | No lost accepted intent; delivery class explicit |
| Durable cycle | Focused persisted-queue integration and fresh-process harness | Both kill windows recover and converge |
| Retry/cursor | Duplicate, stale, ambiguous-completion, and competing-worker fixtures | No duplicate or regression; monotonic status |
| Auth/scope | Desktop RPC integration matrix | Launch token required; unauthorized scope rejected server-side |
| Hint independence | Withheld/dropped hint integration case | Reconnect re-query converges from durable state |
| Package quality | Focused epistemic/workflow/desktop checks selected in P0 | Green |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Blocked By

- [`goals/effect-v4-workflow-engine-spike`](../effect-v4-workflow-engine-spike/) —
  must land the `packages/drivers/workflow` persistence adapter and its
  store/crash/competing-worker evidence before this goal freezes P0 integration.

## Stop Conditions

- The workflow spike fails or cannot supply the persistence and kill/restart
  contract required for meaningful `DurableQueue` integration.
- Atomic accepted-record/intent persistence or lossless recoverable queue
  handoff cannot be proved without a bespoke durability layer or unsupported
  exactly-once claim.
- Cursor/status monotonicity, retry idempotence, stale-version rejection, or
  competing-worker ownership cannot be made explicit before public contracts.
- Server-authorized workspace/matter scope requires inventing a user principal
  or trusting client input.
- Implementation enters a non-goal, adds an unapproved dependency, or changes
  unrelated public API, auth, infrastructure, lockfiles, or generated files.
- Verification requires unnamed credentials, cost, destructive effects, or
  policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
