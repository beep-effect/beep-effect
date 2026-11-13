# Ops Seat Timers

## Status

Lifecycle: `superseded`

**Closed by operator ruling (finish board, 2026-11-13).** It has not started since it graduated on 10-05, and it depends on fleet-root-registry. The fleet layout has since moved on (T3 fleet hosts). The packet is `superseded` without meeting its completion gate. To resume, run `bun run beep goals set-status ops-seat-timers active` and re-graduate the next slice. Decision: [`decisions/2026-11-13-finish-board-ruling-close.md`](./decisions/2026-11-13-finish-board-ruling-close.md).

It is the only provider of the `fleet/ops-seat` capability, which goals/legacy-drain and goals/ai-metrics-raw-retention require. Both are paused by the same ruling; whichever resumes first re-opens or re-graduates the ops-seat work.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Create the ops seat and re-render every user timer against it through the agent-permitted `--refresh` forms so the three legacy infra clones become retirable.

Depends on: [`goals/fleet-root-registry`](../../goals/fleet-root-registry/README.md)
Graduated from [`explorations/agent-fleet-layout`](../../explorations/agent-fleet-layout/README.md) on 2026-10-05.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ops-seat-timers/GOAL.md
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

P0 Research. Read `SPEC.md`, the exploration brief and map, then confirm scope against live source before implementing.

## Latest Evidence

Not started

## Notes

Decisions that shaped this goal live in the exploration's `DECISIONS.md`; do not re-litigate them here. Workstation facts (223 checkouts, 18 live, timers on beep-effect0/5/7, 22 GB ai-metrics raw) are in the exploration's `RESEARCH.md` and dated 2026-10-05.
