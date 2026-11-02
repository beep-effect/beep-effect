# Turborepo quality cache adoption

## Status

Lifecycle: `active`

Source: [ops/manifest.json](./ops/manifest.json).
Launched 2026-10-28. See [PLAN.md](./PLAN.md) for the current audit and milestone
dependencies.

## Mission

Adopt every eligible quality computation in its proven profiles and optimize the full Turbo/CI/Yeet workflow with measured benefits and fresh hosted statuses.

## Launch

```text
/goal follow the instructions in goals/turborepo-quality-cache-adoption/GOAL.md
```

[GOAL.md](./GOAL.md) is the launcher; [SPEC.md](./SPEC.md) is normative.

## Read this first

1. [SPEC.md](./SPEC.md) and [PLAN.md](./PLAN.md).
2. [Source ledger](./research/SOURCES.md).
3. [Approved exploration](../../explorations/turborepo-quality-cache/README.md) and [program map](../../explorations/turborepo-quality-cache/MAP.md).
4. [Manifest](./ops/manifest.json), [friction ledger](./research/OPPORTUNITIES.md)
   and [history](./history/).

## Current phase

P0 Population, feature and value audit, in progress.

Refresh actual task/lane/workflow population and create the stable/canary feature and computation-disposition matrices using the existing owners' baselines.

## Latest evidence

The [source-bound population snapshot](./research/current-population.json) records 2,571
executable computations across 190 workspaces. The
[feature inventory](./research/current-feature-matrix.json) and
[client pins](./research/current-client-pins.json) record the current review
surface. The [completion audit](./research/current-completion-audit.json) keeps
the remaining acceptance evidence explicit. These inventories do not qualify
tasks or complete production observation. Re-run the census and refresh recipe
before using this snapshot as current if any retained census-source digest differs.

## Notes

P0 and feature/source inventory can start independently. P1 consumes the
qualification contract; broad promotion waits for its validated runner/pilot.
P3 requires passing protocol and current production trust readiness. Coordinate
cohort execution with trust's rollout rather than introducing a cycle between
whole-goal completion gates. Replacement cutover, if selected, stays in the
conditional migration goal; keep safe independent local improvements moving.
