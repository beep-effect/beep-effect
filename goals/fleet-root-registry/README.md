# Fleet Root Registry

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

One per-repository list of discovery roots read by every path-dependent CLI surface, plus a thin authored seat/lane registry beside the session ledger, joined onto the derived fleet mirror as a compact row with on-demand expansion.

Depends on: none (first bet in the map).
Graduated from [`explorations/agent-fleet-layout`](../../explorations/agent-fleet-layout/README.md) on 2026-10-05.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/fleet-root-registry/GOAL.md
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

P0 Research complete (2026-11-06 re-grounding). P1 Implement is next: schemas
first (`FleetRoots`, `FleetRegistry`, seat-role and drain-status kits), then
the `Context.Service` contracts, then stores, discovery plumbing and the
`--join`/`describe`/`register` commands.

## Latest Evidence

2026-11-06: packet re-grounded against live source in a `/grill-with-docs`
session. Findings: the fleet root already exists as a per-call option
(`Fleet.service.ts resolveFleetScope`); discovery is one level deep and
origin-matched, so the original nested `projects/beep/seats/main` criterion
could not pass; the session ledger already records lane, branch and PR per
checkout. Eleven decisions locked under `decisions/`. Workstation census moved
from 223 checkouts in 23 clones (2026-10-05) to 37 clones, 24 worktree roots
holding 249 lanes, and 56 lanes under the sibling `beep-effect-worktrees`
root.

## Notes

Decisions that shaped this goal live in the exploration's `DECISIONS.md`
(2026-10-05 rounds plus 2026-11-06 amendments) and this packet's
`decisions/`; do not re-litigate them here. Workstation facts (223 checkouts,
18 live, timers on beep-effect0/5/7, 22 GB ai-metrics raw) are in the
exploration's `RESEARCH.md` and dated 2026-10-05.
