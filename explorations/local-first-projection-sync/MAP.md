# Local-First Projection Sync — Map

## Candidate Goal Packets

| Candidate | Stage | Mission | Depends on |
| --- | --- | --- | --- |
| [`projection-dispatch-core`](../../goals/projection-dispatch-core/) | **FIRST — graduates now** | Deliver one restart-safe accepted-record projection cycle with durable target isolation and a disposable desktop freshness hint. | **blockedBy:** [`effect-v4-workflow-engine-spike`](../../goals/effect-v4-workflow-engine-spike/) |
| Desktop multi-window delivery increment | gated | Prove multiple independently scoped live desktop connections, then select the smallest correct broadcast/registry topology. | Core cycle complete plus live topology evidence |
| Additional projector families | gated | Add another rebuildable target family only when a real consumer proves isolation and promotion needs. | Core cycle complete; explicit target owner |
| Future graph projection | gated; separate approval | Add a rebuildable, driver-isolated, non-authoritative graph target under an approved license and topology. | Core cycle; SSPL/license review; graph-specific goal |

The three gated rows are re-entry points under the repository's
reopen-at-`decompose` convention. Reopen when a candidate trigger fires:
multi-window delivery evidence, an owner for a second projector family, or an
approved graph projection after SSPL review.

## Sequencing

1. `effect-v4-workflow-engine-spike` must land its persistence adapter and crash
   evidence first. It owns the reusable workflow persistence proof in
   `packages/drivers/workflow`.
2. `projection-dispatch-core` consumes that proven contract, resolves atomic
   authority-to-intent-to-queue handoff in P0, then implements and verifies the
   first vertical slice.
3. Keep multi-window topology, more target families, and graph projection gated
   until their explicit demand and proofs exist. The exploration remains active
   after this graduation because those candidates remain.

## First Vertical Slice

1. Commit one accepted authority record and its projection intent atomically.
2. Compute the durable idempotency key from `{ authorityRecordId,
   authorityVersion, projectionTarget }`.
3. Process the intent through a persistence-backed `DurableQueue` worker for one
   target family with bounded concurrency and retry.
4. Write one trivial rebuildable repo-native read projection and monotonically
   record target cursor/status.
5. Prove retry produces no duplicate and an older authority version cannot
   regress the projection or cursor.
6. Emit a best-effort projection-version hint after durable progress.
7. Authenticate the desktop launch, server-authorize the requested projection
   scope, subscribe over the existing IPC/RPC transport, re-query, and observe
   the new version.
8. Kill/restart before worker completion and after worker completion; reconnect
   without the hint in both cases and still converge from durable state.

The slice excludes RRF, vector scoring, retrieval policy, FalkorDB, graph
semantics, and generic multi-device replication.

## Cross-Packet Boundaries

| Packet | Relationship |
| --- | --- |
| [`epistemic-bitemporal-edge-core`](../../goals/epistemic-bitemporal-edge-core/) | Authority producer. It accepts and persists authoritative records; its authority path excludes projections and direct authoritative projection writes. |
| [`hybrid-retrieval-fusion-core`](../../goals/hybrid-retrieval-fusion-core/) | Downstream consumer boundary. It owns ranking/RRF, not projection dispatch, storage, or durable workers. |
| [`effect-v4-workflow-engine-spike`](../../goals/effect-v4-workflow-engine-spike/) | Durability prerequisite. Its persistence-backed workflow adapter and kill/restart contract must land before this goal freezes its adapter use. |

## Capability Check

| Component | Exact live capability | Disposition |
| --- | --- | --- |
| Durable queue definition/worker | `node_modules/effect/src/unstable/workflow/DurableQueue.ts` | **Reuse after prerequisite proof.** Supplies schema, deterministic `idempotencyKey`, persisted queue processing, worker concurrency, and `WorkflowEngine`/`PersistedQueueFactory` requirements. |
| Workflow persistence adapter | `packages/drivers/workflow` | **NET-NEW in sibling goal.** This directory is the placement selected by `effect-v4-workflow-engine-spike`; consume only after its evidence lands. |
| Projection dispatch schemas/ports/RPC | `packages/epistemic/use-cases` | **NET-NEW.** Existing slice/package, no current dispatch/status/subscription contract. |
| Intent/projection/cursor tables | `packages/epistemic/tables` | **NET-NEW.** Existing slice/package, no current projection-dispatch persistence. |
| Worker/projector composition | `packages/epistemic/server` | **NET-NEW.** Existing slice/package, isolated target-family composition to add. |
| Cursor/status precedent | `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts` and `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts` | **Study only.** Useful precedent for status/cursor/retry surfaces; do not generalize or reuse its vault/provider semantics. |
| Desktop re-query precedent | `apps/professional-desktop/src/sync/Sync.atoms.ts` | **Reuse pattern.** Atom RPC reactivity keys and re-query behavior; not durable delivery. |
| Desktop IPC transport | `apps/professional-desktop/src/transport/TauriIpcSocket.ts` and `IpcChatClient.ts` | **Extend.** Existing scoped Effect socket/RPC transport; multi-connection topology remains unproved. |
| Launch authentication | `apps/professional-desktop/server/RpcSessionAuth.ts` | **Reuse plus extend authorization.** Per-launch bearer authentication exists; principal and server-authorized scope resolution are **NET-NEW**. |
| Ephemeral hint primitive | scoped Effect queue/stream in the desktop RPC handler | **NET-NEW, deliberately minimal.** `PubSub`/registry gated by topology proof. |
| Shared `@beep/projection` package | none | **NOT NOW.** Promote only after a second non-epistemic producer proves identical semantics. |

## Inherited Risks

- Atomic authority/intention commit does not itself prove lossless handoff into
  the Effect persisted queue; P0 must close the gap with the sibling adapter's
  actual transaction and recovery semantics.
- The pinned beta API is unstable and must remain behind compile-time and
  behavioral upgrade guards.
- Cursor/status semantics must remain monotonic across retries, stale work,
  ambiguous completion, and competing recovery.
- Current RPC handlers trust client-supplied `workspaceId`; the subscription
  must add server-side authorization rather than copy that gap.
- Multi-window connection topology and TalentScore's license remain deferred;
  neither may block the single-session clean-room first slice.
