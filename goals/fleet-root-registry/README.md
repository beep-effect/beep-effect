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

P1 Implement and P2 Verify complete (2026-11-06). P3 Yeet is next: one PR
driven to mergeable, with the closeout reflection in the same PR.

## Latest Evidence

2026-11-06: roots list (`BEEP_FLEET_ROOTS`, `roots.json`, derived), registry
overlay, `fleet --join`, `fleet describe` and `fleet register` landed in
`packages/tooling/tool/cli/src/commands/Worktree/` with the runbook
[`docs/runbooks/fleet-roots-and-registry.md`](../../docs/runbooks/fleet-roots-and-registry.md).
The fixture fleet proves byte-identity with roots unset against a pre-change
snapshot, and the workstation parity diff carries only live changes. The
`beep-effect0-worktrees` undercount is an origin-spelling mismatch (HTTPS clone
among SCP clones), fixed in #2852. Evidence:
[`history/evidence/2026-11-06-p1-p2.md`](./history/evidence/2026-11-06-p1-p2.md).

## Notes

Decisions that shaped this goal live in the exploration's `DECISIONS.md`
(2026-10-05 rounds plus 2026-11-06 amendments) and this packet's
`decisions/`; do not re-litigate them here. Workstation facts (223 checkouts,
18 live, timers on beep-effect0/5/7, 22 GB ai-metrics raw) are in the
exploration's `RESEARCH.md` and dated 2026-10-05.
