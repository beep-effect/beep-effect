# Gate Output: Switch On What Exists

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Land the six located fixes that need no new model, so agents get shorter gate output this week.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/gate-output-switch-on/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth. Its Target Surfaces table holds the
   verified state of each fix site.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, inherited from the exploration.
6. [`decisions/`](./decisions/) - the exploration rulings this goal carries.
7. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started.

## Latest Evidence

2026-11-18 baseline, from the exploration: `@beep/glob`'s 273 green tests print 13,450 characters
through Turbo with an agent variable set in the shell, and 282 when Vitest sees the variable.

## Notes

Graduated 2026-11-18 from `explorations/agent-verification-output` (MAP candidate 1). It has no
dependency and starts at once, beside `agent-output-census` and `gate-report-core`. The census does
not gate this goal; if it lands first, the closeout also cites its rows.

Two exploration claims needed correcting against the checkout, and the spec carries the
corrections: package `check` scripts run `bun run beep:check` directly, so the probe cannot live in
`runPackageTask` alone; and only the lane-run envelope has a durable copy today.
