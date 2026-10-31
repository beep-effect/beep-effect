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

P0 Slice 1 (schemas, route, census) — implemented 2026-10-31 in lane
`verification-route-s1` (`beep ci route plan|capture|census|replay`); the census over the
real corpus is the remaining P0 deliverable.

## Latest Evidence

Not started. Pre-packet evidence: the 2026-10-27/28 turbo dry-runs in the
exploration's `CAPTURE.md` (biome catalog bump: 188/189 build and check,
187/189 lint and test invalidated; 1/189 lint with a per-task negation).

## Notes

- No measurement window anywhere in this packet; the replay is the gate and the
  live shadow is a monitor that can revoke, never hold.
- Root `package.json` reaches every task by our own `turbo.json`
  (`futureFlags.globalConfiguration`, `global.inputs`), not by a turbo implicit;
  a negation without the `scripts` projection is unsound.
- `WaveOrder`, `ProofFact`, the scheduler and the rulesets are out of scope.
