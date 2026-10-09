# Repository Simplification and Confidence

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Retire tools without a demonstrated purpose, reach honest zero actionable debt, and give operational claims current evidence

This packet is the coordinating record for the program the operator approved
on 2026-10-09: owners, baseline receipts, recovery paths, decisions, and the
staged acceptance checklist for workstreams A-H and the `effect-vitest-canon`
reconciliation.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/repository-simplification-confidence/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: locked dispositions,
   constraints, acceptance, Decision Log, Exception Ledger.
3. [`PLAN.md`](./PLAN.md) - stages, lane owners and model routes, recovery
   paths, staged acceptance checklist.
4. [`research/BRIEF-2026-10-09.md`](./research/BRIEF-2026-10-09.md) - the
   approved brief, verbatim.
5. [`history/receipts/stage-1-ownership.md`](./history/receipts/stage-1-ownership.md) (stage 1 close, 2026-10-09) and [`research/baseline-2026-10-09.md`](./research/baseline-2026-10-09.md) -
   stage 1 baseline receipts.
6. [`research/knip-findings-2026-10-09.md`](./research/knip-findings-2026-10-09.md) -
   the 41 known Knip findings to disposition before Knip is removed.
7. [`research/SOURCES.md`](./research/SOURCES.md) - provenance and source
   index.
8. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction
   ledger.
9. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
10. [`research/sweeps/2026-10-09/README.md`](./research/sweeps/2026-10-09/README.md) -
    read-only sweeps at `e62411d63f` (each lane's inputs; PLAN.md "Lane inputs").
11. [`research/panel-acceptance-2026-10-09.md`](./research/panel-acceptance-2026-10-09.md) -
    workstream F panel acceptance probes.

## Current Phase

P1 Implement — in progress: stages 2 to 4 run in parallel lanes (`PLAN.md`,
Lane Plan). Stage 1 (ownership and recovery) closed on 2026-10-09 with
`history/receipts/stage-1-ownership.md`: the fleet handoff snapshot, the six
`effect-vitest-canon` lanes (heads, staged and unstaged state, digests) and
the stage-1 copies of the three global configuration files are recorded, and
nothing was adopted or discarded. P0 Research is complete.

## Latest Evidence

H1 OSV wave [PR #1562](https://github.com/beep-effect/beep-effect/pull/1562) ready for review;
Run 4 integrates main repairs #1564/#1565, corrects the stored-response cache proof
and repairs the census table; saved terminal parity remains attributed to its proof heads;
local parity has an inherited knowledge-reference blocker: [catalog receipt](./history/receipts/stage-4-h1-catalog.md#osv-exceptions)
and [lane handoff](./history/handoffs/rsc-h1-catalog-2026-10-09.md).

[G storage census and deferred retention](./history/receipts/stage-5-storage-cleanup.md)
and [G cache evidence](./history/receipts/stage-5-cache.md), 2026-10-09:
2,475 v3 rows across 262 checkout roots; zero real cleanup; local cache hits
proven. Owner-aware archive/recovery implementation is under qualification;
remote auth and home changes remain deferred. Source correction `d788c80ac5`;
[handoff](./history/handoffs/rsc-g-storage-2026-10-09.md).

[`research/baseline-2026-10-09.md`](./research/baseline-2026-10-09.md)
(implementation head `e62411d63f`, 2026-10-09);
[`research/sweeps/2026-10-09/README.md`](./research/sweeps/2026-10-09/README.md)
(14 sweeps and 19 gap follow-ups); Knip reconciliation at `e62411d63f`
(41 of 41 rows reproduced, `research/knip-findings-2026-10-09.md`).

## Notes

- Orchestrator: the program's Claude Fable orchestrator session, which holds
  the shared files and merges at the gate. Codex lane workers commit, push and
  publish from their own sibling worktree through Yeet (SPEC.md Decision Log);
  they never commit to another lane and never merge.
- Packet lane: `rsc-packet` in the implementation clone's sibling
  `-worktrees` root, cut from `e62411d63f`; its branch name is recorded in
  `research/baseline-2026-10-09.md`.
- Brief: operator scratch file `scratch_72.md`, copied verbatim to
  `research/BRIEF-2026-10-09.md`. The Notion copy is a separate preparation
  task, complete once the saved copies are verified (brief, Start here).
- Program review exception: every in-scope actionable finding is resolved,
  including P2 and below; the round-2 review cap does not apply (SPEC.md
  Exception Ledger).
