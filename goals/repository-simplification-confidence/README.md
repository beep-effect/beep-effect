# Repository Simplification and Confidence

## Status

Lifecycle: `active`

Latest E evidence: [GitHub audit](./history/receipts/stage-4-github-audit.md), [settings snapshots](./history/receipts/stage-3-github-settings.md), and [lane handoff](./history/handoffs/rsc-e-github-2026-10-09.md). The workflow wave is prepared; package proof, hosted behavior and cross-lane gates remain open.

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
5. [`research/baseline-2026-10-09.md`](./research/baseline-2026-10-09.md) -
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

P0 Research — in progress: stage 1, ownership and recovery. Revisions, tool
versions, located surfaces, the `effect-vitest-canon` lanes (the five unpublished lanes plus the
continuation lane carrying the staged work; see
`research/baseline-2026-10-09.md`), and fleet
state are recorded; stage 1 closes when every lane owner and recovery path in
`PLAN.md` is confirmed.

## Latest Evidence

[`research/baseline-2026-10-09.md`](./research/baseline-2026-10-09.md)
(implementation head `e62411d63f`, 2026-10-09);
[`research/sweeps/2026-10-09/README.md`](./research/sweeps/2026-10-09/README.md)
(14 sweeps and 19 gap follow-ups); Knip reconciliation at `e62411d63f`
(41 of 41 rows reproduced, `research/knip-findings-2026-10-09.md`).

## Notes

- Orchestrator: the program's Claude Fable orchestrator session, which commits for the
  program; workers never commit.
- Packet lane: `rsc-packet` in the implementation clone's sibling
  `-worktrees` root, cut from `e62411d63f`; its branch name is recorded in
  `research/baseline-2026-10-09.md`.
- Brief: operator scratch file `scratch_72.md`, copied verbatim to
  `research/BRIEF-2026-10-09.md`. The Notion copy is a separate preparation
  task, complete once the saved copies are verified (brief, Start here).
- Program review exception: every in-scope actionable finding is resolved,
  including P2 and below; the round-2 review cap does not apply (SPEC.md
  Exception Ledger).
