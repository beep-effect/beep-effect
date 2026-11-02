# T3 Code Spill Routing

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Add an advisory rule to `orchestrate`: read DankStation host pressure before substantive work and, above baseline-derived thresholds, launch on the next host in spill order through T3.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/t3code-spill-routing/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started; waits for at least one live spill host.

## Latest Evidence

Not started.

## Notes

Explain the MemAvailable-0 baseline sample before setting memory thresholds. An automatic dispatcher is a gated follow-up in the exploration MAP.
