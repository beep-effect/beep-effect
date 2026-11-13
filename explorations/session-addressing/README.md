# Session Addressing

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The orchestrator can message almost any session and cannot find the one that
owns a given PR, branch or lane. Sends are keyed by display name or T3 thread
id; work is keyed by PR and lane; nothing joins them.

## Next Open Question

None. Graduated into [`goals/session-route-resolver`](../../goals/session-route-resolver/README.md).
Two gated candidates remain in [`MAP.md`](./MAP.md); a fired gate reopens this
packet at `decompose`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-11-12: operator confirmed the brief; graduated
  `goals/session-route-resolver` with D1 to D7 as decision files.
- 2026-11-12: packet opened from the orchestrator brief; census run on
  DankStation and all five linked T3 environments; one align round settled
  D1 to D7; brief and map drafted. 
