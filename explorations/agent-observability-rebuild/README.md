# Agent observability: coverage, evidence, and improvement

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The Phoenix seven-day view shows 6,674 traces and 285 sessions. Audit collection across beep-effect clones, worktrees, and dankserver, then design trustworthy measurements of agent speed, experience, and work quality.

## Next Open Question

None — exploration graduated. The foundation packet `goals/agent-observability-foundation` is active and is the only authored packet. Harness enrollment and outcome experiments are planned follow-up work (see [MAP.md](./MAP.md)), not packet directories yet.

## Deliverables

- [Audit and findings](./RESEARCH.md)
- [Adopted design](./BRIEF.md)
- [Implementation sequence](./MAP.md)
- [Decisions](./DECISIONS.md)
- [Thirty scored ideas and three focused designs](./research/ADHD.md)
- [Independent factual review](./research/REVIEW.md) and [design review](./research/DESIGN-REVIEW.md)
- [Foundation packet](../../goals/agent-observability-foundation/README.md)
- Harness enrollment (`harness-telemetry-enrollment`): planned, not yet a packet
- Outcome experiments (`agent-outcome-experiments`): planned, not yet a packet

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-10-27: Audit completed; operator chose metadata plus curated examples and adopted design. Three paused implementation packets created with inherited evidence, dependencies and acceptance gates; exploration graduated. No production changes or goal execution.



- 2026-10-27: Packet opened for comprehensive read-only audit and first-principles redesign research.
- 2026-10-31: Corrected the status above: only the foundation packet exists; enrollment and experiments remain planned (see MAP.md).
