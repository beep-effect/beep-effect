# Legacy Drain

## Status

Lifecycle: `active`

Resumed by the operator on 2026-11-13. The `drainable` residue-reap class is built and observing the live fleet; the first apply wave is time-gated by the 7-day grace window (earliest 2026-11-20T22:06Z). goals/ops-seat-timers is replaced by the `timer-host` check: [`decisions/2026-11-13-resume-without-ops-seat-timers.md`](./decisions/2026-11-13-resume-without-ops-seat-timers.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Register the legacy `beep-effect*` clones read-only and drain them, lane by lane and clone by clone, under a drainable predicate the reaper enforces; land the seats-and-lanes worktree standard.

Depends on: [`goals/fleet-root-registry`](../../goals/fleet-root-registry/README.md), [`goals/lane-bootstrap`](../../goals/lane-bootstrap/README.md), [`goals/ops-seat-timers`](../../goals/ops-seat-timers/README.md)
Graduated from [`explorations/agent-fleet-layout`](../../explorations/agent-fleet-layout/README.md) on 2026-10-05.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/legacy-drain/GOAL.md
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

P3 Yeet. P0 to P2 are done: the `drainable` class (`ResidueReapDrain*.ts`), the seats/lanes/registry/drain section of `standards/git-worktrees.md`, and the `AGENTS.md` worktree bullet. Remaining: merge the PR, then run the first apply wave once grace windows elapse, and close out (P4).

## Latest Evidence

- 2026-11-13 first live dry run (`residue-reap --fleet --classes drainable`, 56 s): 352 fleet checkouts, 9 legacy clones holding 166,242,401,382 bytes; 221 lanes started grace windows, 129 refused with per-check reasons. Details: [`decisions/2026-11-13-first-live-observation.md`](./decisions/2026-11-13-first-live-observation.md).
- Design calls: [`decisions/2026-11-13-drainable-predicate-design.md`](./decisions/2026-11-13-drainable-predicate-design.md).
- Fixture proof: `packages/tooling/tool/cli/test/residue-reap-drain.test.ts`.

## Notes

Decisions that shaped this goal live in the exploration's `DECISIONS.md`; do not re-litigate them here. Workstation facts (223 checkouts, 18 live, timers on beep-effect0/5/7, 22 GB ai-metrics raw) are in the exploration's `RESEARCH.md` and dated 2026-10-05.
