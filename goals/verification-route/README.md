# Verification Route

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Given a change, run only the checks its kind can affect, cheapest first, and
prove it by replay over merged PRs instead of a measurement window: a total
footprint record per lane, `classify` and `route` in repo-cli, the loss census,
final-check shadow then enforced, hosted `skip-satisfied` per lane. Graduated
2026-10-28 from
[`explorations/verification-route`](../../explorations/verification-route/README.md)
(BRIEF, MAP, 16 rulings).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/verification-route/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (decision log inherited from the exploration).
3. [`PLAN.md`](./PLAN.md) - three slices, one PR each; cut line at the census.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance; the exploration's ledger is primary.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Slice 1 complete (2026-10-31, lane `verification-route-s1`). Next: P1 Slice 2,
starting from the ranked refinements in
[`research/census-2026-10-31.md`](./research/census-2026-10-31.md): the taxonomy refinement
for packet data files first, then footprint refinements with mutation fixtures.

## Latest Evidence

- [`research/census-2026-10-31.md`](./research/census-2026-10-31.md): census and replay over
  6,328 hosted runs (5,083 PR heads, 11,710 h); replay recall 100% at the all-`unknown`
  record; the corpus is pinned by sha256 in `research/corpus/RECEIPTS.json`.
- Pre-packet evidence: the 2026-10-27/28 turbo dry-runs in the exploration's `CAPTURE.md`
  (biome catalog bump: 188/189 build and check, 187/189 lint and test invalidated; 1/189 lint
  with a per-task negation).

## Notes

- No measurement window anywhere in this packet; the replay is the gate and the
  live shadow is a monitor that can revoke, never hold.
- Root `package.json` reaches every task by our own `turbo.json`
  (`futureFlags.globalConfiguration`, `global.inputs`), not by a turbo implicit;
  a negation without the `scripts` projection is unsound.
- `WaveOrder`, `ProofFact`, the scheduler and the rulesets are out of scope.
