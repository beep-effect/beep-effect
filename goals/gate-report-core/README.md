# Gate Report Core

## Status

Lifecycle: `completed-retained`

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

P0 is complete: four package homes are confirmed by decision file. P1 is complete: the model package `@beep/gate-report` is built with its law tests. P2 is complete: the record and gate-run libraries are built with their contracts, services and tests. P3 and P4 are complete: the Vitest adapter, the slim check entry, the task-path consoles for every package and the root, and the gate queries are built. Every phase is complete. The goal landed as three pull requests: the model (#3407), the libraries (#3413), and the adapter, wiring and closeout (#3419); P1 through P3 are the first vertical slice.

## Latest Evidence

2026-11-19, measured on the wiring lane:

- A green `test` run of `@beep/glob` on the task path prints one line of 47 characters, against
  13,450 at the exploration baseline and 820 after the switch-on goal.
- A red test with a diff prints 14 lines, 520 characters; a package with unbuilt references prints
  5 lines.
- Root `test` and root `check`, a miss then a Turbo cache hit, print identical consoles.
- The slim check entry costs about 25 to 40 ms more than the probe plus compiler it replaces.

## Notes

Graduated 2026-11-18 from `explorations/agent-verification-output` (MAP candidate 3). Read that
packet's `BRIEF.md`, `DECISIONS.md` and `research/vitest-agent-core.md` (the port study, cited
against `.repos/vitest-agent` at `1cf1ab94`) before P0. Provenance and licenses are in
[`research/SOURCES.md`](./research/SOURCES.md); the decisions this goal carries are under
[`decisions/`](./decisions/).

This goal has no dependency and starts at once. `goals/gate-run-history`,
`goals/gate-report-rollout` and `goals/ci-gate-reports` build on it. When
`goals/agent-output-census` lands first, its rows join this goal's acceptance numbers.
