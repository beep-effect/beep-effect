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

Implementation merged in #2702 (2026-11-06, merge 072748d024). Closeout
re-final PR in lane docs/goal-packet-conflict-free-appends-closeout carries the
reflection and `proposedCloseout`; adoption follows its merge.

## Latest Evidence

`bun run beep goals decisions check` -> `invalid=0 drift=0`;
`bun run beep goals doctor` -> `blocking_new=0`; `goals-decisions.test.ts`
passes (re-verified on main 2026-11-06; 13 packets now hold 47 decision
files, no open PR CONFLICTING). Reflection:
[`history/reflections/2026-11-06-claude.md`](./history/reflections/2026-11-06-claude.md).
Decisions: [`decisions/`](./decisions/), rendered in
[`SPEC.md`](./SPEC.md#decision-log).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
