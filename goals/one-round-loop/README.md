# One-Round Loop

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make the next crispening-scale effort need at most one CI round per PR:
a single local command renders CI's verdict (`beep ci local`, backed by
CLI-owned lane definitions so drift is structurally impossible), and
schema round-trip laws run deep enough pre-merge to catch
seed-dependent bugs on the PR that introduces them. The packet proves
itself on itself via the dogfood rule.

## Launch

```text
/goal follow the instructions in goals/one-round-loop/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` is the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) — normative: tiers, fences, Definition of
   Done (mechanisms + self-dogfood), verification matrix, stop
   conditions.
3. [`PLAN.md`](./PLAN.md) — phase table and execution notes.
4. [`research/decisions-locked.md`](./research/decisions-locked.md) —
   grilled rulings D1–D7 and R1–R4. Locked — do not reopen.
5. [`research/research-facts.md`](./research/research-facts.md) — the
   distilled fact base (CI lane inventory, verify delta, numRuns
   landscape, coverage internals, CLI surfaces).
6. [`ops/manifest.json`](./ops/manifest.json) — machine-readable
   routing; [`ops/progress.json`](./ops/progress.json) — resumable
   state incl. the dogfood ledger.

## Current Phase

P0 CI-lane inversion — pending; next action: execute `orl-001..003` in
[`tasks/tasks.jsonc`](./tasks/tasks.jsonc). P0 gates everything: the
dogfood rule (every packet PR passes `beep ci local` before push)
activates when P0 merges.

## Latest Evidence

Packet authored 2026-07-07 from the crispening closeout reflection
(`goals/repo-crispening-orchestration/history/reflections/2026-07-07-claude.md`)
plus three Explore research briefs; no implementation started.

## Notes

Locked decisions live in
[`research/decisions-locked.md`](./research/decisions-locked.md);
amendments require a superseding entry in
`standards/architecture/DECISIONS.md`. Sibling seam: this packet edits
tooling, CI, and test infrastructure only — the sole product-adjacent
edits are the three wire-preserving `withNormalizedCheck` migrations
(venice-ai, phoenix, m365; uspto optional as a noted tightening —
SPEC fence 4).
