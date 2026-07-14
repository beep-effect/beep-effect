# Effect v4 Workflow Engine Spike Plan

## Status

Status: `pending` — P0 feasibility and persistence-store selection are the next
and only authorized phase.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Engine feasibility spike | pending | Select and justify the persistence store; inspect the encoded engine contract; map each of the 14 durability constraints to an executable proof or explicit limit; define the pass/fail and production-parity boundary. | A dated P0 evidence note locks store choice, atomicity/crash assumptions, parity limits, crash matrix, and proof mapping. Any contract contradiction blocks P1. |
| P1 Adapter, restart harness, and upgrade guard | pending (blocked by P0) | Implement the smallest `packages/drivers/workflow` adapter, representative workflow, controlled kill/restart harness, deterministic identities, and compile-time plus behavioral Effect-upgrade guard. | A fresh process can discover and resume the same persisted execution; focused evidence covers the keyed activity, clock, deferred acknowledgment, result, worker coordination, and upgrade rerun. |
| P2 Verify | pending | Execute every crash point, negative/control lane, competing-worker/failure-domain probe, focused package test, upgrade guard, and repo-wide quality gate. | The `SPEC.md` pass/fail contract is supported without unsupported durability claims; all acceptance checks pass or a reproducible engine gap is archived. |
| P3 Close | pending | Write the docketing handoff and pass/fail contract, publish/monitor through Yeet, respond to review, write the closeout reflection, and synchronize packet status/evidence. | `goals/law-docketing-reliability` has actionable handoff evidence; Yeet/GitHub reports the PR work mergeable; a schema-valid reflection exists. |

## P0 Feasibility Contract

- Select the persistent proof store by evidence, not convenience. Record its
  transaction/atomicity surface, recovery discovery mechanism, crash behavior,
  worker coordination, and mismatch from likely production topology.
- Produce a 14-row parity matrix matching `SPEC.md` constraints to tests,
  fixtures, fault injection, or an explicit unsupported boundary.
- Name every kill point before P1: register; activity start and finish; timer
  schedule and wake; deferred completion; terminal-result persistence.
- Lock deterministic execution-id and activity-idempotency-key derivation,
  retention, collision/version, and ambiguous-completion behavior.
- Treat `layerMemory` only as a negative control. The proof requires a fresh
  process against the same persistent store.
- Record a proceed or fail disposition. Failure produces a bounded handoff gap;
  it does not authorize a bespoke checkpoint layer.

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained`):

1. Archive `history/<YYYY-MM-DD>-workflow-engine-pass-fail.md` with the crash
   matrix, evidence links, explicit pass/fail, guarantees, and unsupported claims.
2. Archive `history/<YYYY-MM-DD>-law-docketing-handoff.md` with integration
   preconditions, idempotency/cursor rules, failure-domain ownership, and gaps.
3. Write a closeout reflection via `/reflect` (or copy
   `history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` and validate its frontmatter.
4. Run `bun run beep lint reflection-artifacts`.
5. Update `README.md`, this plan, and `ops/manifest.json` with final evidence and
   lifecycle/phase state; confirm Yeet/GitHub reports the PR work mergeable.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Read `research/SOURCES.md` and the live vendored modules before freezing the
  adapter. The workflow namespace is unstable and current source wins.
- Keep product workflows in their owning slice/server. The driver wraps the
  external engine contract only.
- Never smooth at-least-once delivery into an exactly-once claim. State the
  idempotency boundary and ambiguous crash window explicitly.
- Evidence may prove a local store contract only; do not generalize across
  untested store/process failure-domain overlap.

## Verification Commands

```sh
test "$(wc -m < goals/effect-v4-workflow-engine-spike/GOAL.md)" -le 4000
jq . goals/effect-v4-workflow-engine-spike/ops/manifest.json
rg -n "effect-v4-workflow-engine-spike|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-v4-workflow-engine-spike
git diff --check -- goals/effect-v4-workflow-engine-spike explorations/effect-orchestration-patterns explorations/ATLAS.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
