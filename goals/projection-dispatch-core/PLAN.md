# Projection Dispatch Core Plan

## Status

Status: `pending` — P0 is blocked by the workflow-engine spike evidence.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Atomic handoff design and `DurableQueue` store-integration proof | blocked | After `effect-v4-workflow-engine-spike` lands, consume its adapter/evidence; define accepted-record/intent transaction, recoverable queue relay, key encoding, cursor/status state machine, retry/competing-worker contract, and scope authorization. | Prerequisite evidence is archived and mapped; every crash/atomicity/auth boundary is explicit; focused proof shows no lost intent or unsupported exactly-once claim. |
| P1 Implement | pending | Add schema-first ports/errors/RPC, epistemic persistence, isolated worker/projector, scoped hint stream, and desktop re-query/auth integration for one target. | One complete accepted-record cycle works and all denial/failure paths preserve durable convergence. |
| P2 Verify | pending | Run transaction, queue, duplicate/stale, cursor, isolation, auth/scope, dropped-hint, and two-window fresh-process kill/restart proof plus repo gates. | Every `SPEC.md` acceptance item is green or a reproducible blocker is archived without weakening the contract. |
| P3 Close | pending | Drive the PR to mergeable through Yeet, write the closeout reflection, archive evidence, and synchronize packet state. | Yeet/GitHub reports mergeable; reflection lint passes; README, PLAN, and manifest match evidence. |

## P0 Proof Contract

- Read the workflow spike's final adapter, pass/fail contract, store limits,
  crash matrix, competing-worker evidence, and Effect-upgrade guard.
- Map `DurableQueue.ts` dependencies (`WorkflowEngine`,
  `PersistedQueueFactory`) to the landed adapter without duplicating it.
- Specify one repo-native Postgres transaction for accepted record plus intent,
  then prove how pending intents reach the persisted queue again after
  every crash boundary.
- Freeze the versioned idempotency-key encoding and target cursor/status state
  machine only after duplicate, stale, ambiguous-completion, and concurrent
  recovery fixtures pass.
- Prove the current desktop connection topology. Keep one scoped queue/stream
  unless evidence authorizes `PubSub` or a registry.
- Define launch authentication, server-side workspace/matter authorization, and
  the future principal seam. Do not inherit client-trusted `workspaceId`.

## Blockers

- `goals/effect-v4-workflow-engine-spike` has not yet landed the required
  persistence adapter and crash evidence. P0 remains blocked; P1 must not begin.

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`, covering
   tooling, implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, this plan, and `ops/manifest.json` from final evidence.
4. Confirm Yeet/GitHub mergeability and archive the handoff/crash matrix.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- The durable plane owns convergence; hints may be absent, duplicated, or late.
- Keep target-family isolation explicit and the first projection intentionally
  trivial and rebuildable.
- Do not promote shared packaging or live fan-out topology without its trigger.

## Verification Commands

```sh
test "$(wc -m < goals/projection-dispatch-core/GOAL.md)" -le 4000
jq . goals/projection-dispatch-core/ops/manifest.json
rg -n "projection-dispatch-core|blockedBy|GOAL.md|agentLaunchers|packetAnchorDocument" goals/projection-dispatch-core
git diff --check -- goals/projection-dispatch-core explorations/local-first-projection-sync explorations/ATLAS.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
