# Gate Report Rollout

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Put every remaining gate on the gate-report contract, make Yeet read gate reports instead of
streams, and remove the reasons agents poll: a heartbeat on long gates and a block-until-changed
mode on the status commands.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/gate-report-rollout/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: the gates by adapter kind, the machine
   formats, the heartbeat and block-until-changed rules, acceptance.
3. [`PLAN.md`](./PLAN.md) - phases and how they map to pull requests.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, linked to the exploration ledger.
6. [`decisions/`](./decisions/) - the exploration rulings this goal carries.
7. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started. P1 waits for `goals/gate-report-core` (manifest `blockedBy`).

## Latest Evidence

2026-11-18: packet authored from `explorations/agent-verification-output` (MAP candidate 5).

## Notes

Graduated 2026-11-18 with five siblings. `gate-report-core` supplies the report model, the
gate-run services and the `test` and `check` wiring; this goal names them by role until core
records final package names. `gate-run-history` and `ci-gate-reports` run beside this goal.
`ci-gate-reports` also edits `Yeet/internal/MonitorLoop.ts` (it exposes the log isolator; this
goal changes the monitor's per-poll output), so the second of the two to merge takes `main` first.
Census-based acceptance uses the planned census command of `agent-output-census` once it lands;
output-size fixtures stand in until then.
