# Useful agent outcomes and Phoenix experiments

## Status

Lifecycle: `superseded`

**Closed by operator ruling (finish board, 2026-11-13).** It was never started, has no next step and depends on telemetry work that is not in flight; the only recent touch was the bulk research-intake routing sweep. The packet is `superseded` without meeting its completion gate. To resume, run `bun run beep goals set-status agent-outcome-experiments active` and re-graduate the next slice. Decision: [`decisions/2026-11-13-finish-board-ruling-close.md`](./decisions/2026-11-13-finish-board-ruling-close.md).

Authored but not started. Source: [manifest](./ops/manifest.json). No implementation, deployment or experiment execution occurred during packet preparation.

## Mission

Turn qualified telemetry into understandable task outcomes, calibrated annotations and repeatable experiments that improve harness experience and accepted work.

## Launch

Only on an explicit implementation launch, use:

```text
/goal follow the instructions in goals/agent-outcome-experiments/GOAL.md
```

## Read This First

1. [SPEC.md](./SPEC.md) — normative scope and proof.
2. [PLAN.md](./PLAN.md) — phased implementation and dependencies.
3. [GOAL.md](./GOAL.md) — compact launcher.
4. [Sources](./research/SOURCES.md) — inherited audit evidence and provenance.
5. [Source exploration](../../explorations/agent-observability-rebuild/README.md).

## Current Phase

P0 pending. Refresh source/live evidence and reproduce the assigned defects before implementation. Dependencies: agent-observability-foundation, harness-telemetry-enrollment.

## Latest Evidence

The October27 audit is design provenance, not this goal's completion proof. Implementation: **not started**.
