# Gate Report Core

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Build the gate-neutral report model and its console renderer by porting vitest-agent's core into `@beep/*` packages, and prove it on the `test` and `check` gates.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/gate-report-core/GOAL.md
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

P0 is complete: four package homes are confirmed by decision file. P1 (the model package) is in progress; P1 through P3 are the first vertical slice.

## Latest Evidence

Not started.

## Notes

Graduated 2026-11-18 from `explorations/agent-verification-output` (MAP candidate 3). Read that
packet's `BRIEF.md`, `DECISIONS.md` and `research/vitest-agent-core.md` (the port study, cited
against `.repos/vitest-agent` at `1cf1ab94`) before P0. Provenance and licenses are in
[`research/SOURCES.md`](./research/SOURCES.md); the decisions this goal carries are under
[`decisions/`](./decisions/).

This goal has no dependency and starts at once. `goals/gate-run-history`,
`goals/gate-report-rollout` and `goals/ci-gate-reports` build on it. When
`goals/agent-output-census` lands first, its rows join this goal's acceptance numbers.
