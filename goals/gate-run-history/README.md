# Gate Run History

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Record every gate report by branch and label each failure against the lane's own runs and main's hosted results, with a fix-loop delta on every re-run.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/gate-run-history/GOAL.md
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

P0 to P3 complete: lane history, labels from lane evidence, the fix-loop delta and the history queries. P4 (hosted-main baseline, `AC-H7`) waits for the carrier `goals/ci-gate-reports` ships; P5 to P7 follow it.
(P4) also waits on `goals/ci-gate-reports`.

## Latest Evidence

Not started.

## Notes

Graduated 2026-11-18 from `explorations/agent-verification-output` (MAP candidate 4). Read that
packet's `BRIEF.md` ("History"), `DECISIONS.md` (`history-baseline`) and
`research/vitest-agent-core.md` sections 3.2 to 3.4 and 9 before P0, then
`goals/gate-report-core/SPEC.md`, whose model and console slots this goal fills. Provenance and
licenses are in [`research/SOURCES.md`](./research/SOURCES.md); the decisions this goal carries
are under [`decisions/`](./decisions/).
