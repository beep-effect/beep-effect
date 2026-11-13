# Effect-Native Legal Eval

## Status

Lifecycle: `superseded`

**Closed by operator ruling (finish board, 2026-11-13).** It never started, needs approval for containment and cost, and has no near-term driver; reopen it from the exploration if a legal-eval need comes back. The packet is `superseded` without meeting its completion gate. To resume, run `bun run beep goals set-status effect-native-legal-eval active` and re-graduate the next slice. Decision: [`decisions/2026-11-13-finish-board-ruling-close.md`](./decisions/2026-11-13-finish-board-ruling-close.md).

goals/tracked-changes-ingest-wedge lists this packet as a blocker; it is paused by the same ruling, and resuming it must first decide whether to re-open this packet or drop the dependency.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship a schema-first Effect-native legal evaluation framework and record one
upstream Calderwood & Harkness baseline run for external comparison.

## Launch

```text
/goal follow the instructions in goals/effect-native-legal-eval/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`research/SOURCES.md`](./research/SOURCES.md)
6. [Source exploration](../../explorations/harvey-lab-firm-knowledge/README.md)

## Current Phase

P0 baseline and contract audit: pin the on-demand synthetic C&H asset,
establish containment/cost approval, and map live judge/QA/eval seams.

## Latest Evidence

Scaffolded 2026-08-13 from the operator-ratified BRIEF and MAP.

## Notes

Real OIP data rooms are later, and stay out of the repo. The upstream harness is a
one-time external-comparison baseline, never the durable eval runtime.
