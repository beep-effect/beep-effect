# Goal packet conflict-free appends

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Lanes record decisions as their own files; SPEC.md and PLAN.md blocks are generated projections, so sibling PRs never conflict on a shared tail.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/goal-packet-conflict-free-appends/GOAL.md
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

Implementation landed in lane feat/goal-packet-decision-files; awaiting the
orchestrator's merge at the gate.

## Latest Evidence

`bun run beep goals decisions check` -> `invalid=0 drift=0`;
`bun run beep goals doctor` -> `blocking_new=0`; `goals-decisions.test.ts`
passes. Decisions: [`decisions/`](./decisions/), rendered in
[`SPEC.md`](./SPEC.md#decision-log).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
