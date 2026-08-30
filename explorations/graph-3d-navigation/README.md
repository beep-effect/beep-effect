# Graph 3D Navigation — InfraNodus-style 3D knowledge-graph view

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

InfraNodus's 3D graph view navigates large graphs far better than our flat 2D
workbench view — proportional, distance-faded labels solve the label-overlap
problem. Reverse-engineer the style (clean-room, reference-only) and graduate a
goal that ships an InfraNodus-grade React 3D graph component on our
cosmos/ontology rendering stack.

## Next Open Question

None — **graduated 2026-07-14** into
[`goals/graph-3d-view`](../../goals/graph-3d-view/README.md). Remaining design
questions (stack, placement, label technique, layout location) transferred to
that goal's P0 design gate with the research evidence attached.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

<Dated one-liners, newest first: what each session did and where it stopped.>

- 2026-07-14: **graduated** → `goals/graph-3d-view`. All six codex research
  lanes + verify gate complete; RESEARCH synthesis, DECISIONS (8 entries),
  BRIEF, and MAP written; SOURCES carried into the goal. Two independent browser
  passes cross-corroborated the clean-room visual spec (three.js r158 +
  d3-force-3d, ColorBrewer Paired palette, bc-proportional Sprite labels with
  adaptive-budget declutter, tube edges, 0.10/0.35 dimming, z-flatten toggle).
- 2026-07-14: packet opened; capture written (spark, six behaviors, data
  contract, locked interview decisions); SOURCES.md license discipline seeded;
  artifact fetch wave (F1–F5) + codex research lanes launched.
