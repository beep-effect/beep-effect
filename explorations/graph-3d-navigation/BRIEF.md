# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets.
-->

## Problem

The professional-desktop ontology workbench renders its knowledge graph as a
flat 2D view (`@beep/cosmos`, cosmos.gl). At scale, 2D graphs collapse into a
wall of overlapping node labels — the exact failure the user hit. InfraNodus's
3D knowledge-graph view navigates large graphs far better: a dark 3D force
layout, community-colored nodes, and **proportional, importance-ranked,
distance-faded labels** that keep the graph readable by showing a small hierarchy
of the most influential concepts instead of every label at once. We reverse-
engineered it (clean-room, reference-only) and now want that navigability on our
own rendering stack. Why now: the user surfaced it directly, the workbench's 2D
view is the live pain point, and the research corpus is complete and verified.

## Appetite

One phased goal packet (`goals/graph-3d-view`), P0→P3. The research is done and
paid for; the remaining budget is design + implementation. Bounded by: reuse the
existing projection/atom/worker/handle machinery (extend, don't rebuild), the
pinned `three ^0.185.1`, and cosmos-stays-default. Frontend/renderer/UX time is
Fable's; non-visual plumbing and any further analysis are codex's. The
scale target (2.5k) is a benchmark obligation, not a research-proven given — if
2.5k proves infeasible on the chosen stack at P1, the appetite is to ship a
lower proven ceiling with the number recorded, not to blow the budget chasing it.

## Solution Sketch

A React 3D knowledge-graph renderer reproducing the InfraNodus visual grammar,
consumed by the ontology workbench behind a 2D/3D toggle (cosmos default):

- **Engine** (placement per P0): a three.js/`d3-force-3d` renderer exposing a
  `Graph3DRenderHandle` mirroring `CosmosRenderHandle`
  (`{destroy, fps, update, select}`), consuming a flat 3D projection
  (typed-array xyz + per-node community/size/label-priority). Candidate stacks
  and the three legal placements (drivers / ui-system / hybrid) are in the
  research; P0 picks with a 2.5k benchmark.
- **Visual spec** (clean-room, from `research/bundle-static-analysis.md`):
  `#111111` background; Sprite (or SDF) community-colored nodes sized by
  betweenness; quadratic-bézier tube edges (curvature ~0.25, weight-scaled,
  translucent); TrackballControls + ~40° perspective.
- **The anti-overlap mechanism** (the point): importance-ranked adaptive-budget
  label declutter — `bc`-priority ordering, camera-distance budget/fade, 3D
  depth separation — not a rectangle-collision solver. Labels via Troika SDF or
  drei `<Text>` (Rank 1) with the DOM-overlay fallback (Rank 2) as the
  low-effort proof path. Priority signal reuses the projection's `key`/label-LOD
  slot.
- **Selection**: neighbors 1.0, non-neighbors dim to 0.10 (renderer-side
  material opacity); canvas-click→atom sync in the ontology client bridge (driver
  stays ontology-unaware); tree selection stays authoritative too.
- **Integration**: a parallel bridge atom off `ontologyGraphRenderBridgeAtom`
  consuming the richer `OntologyGraphProjection` (which already has clusters +
  label detail the flat cosmos path discards), a z coordinate added to the
  projection/worker, and a toggle in the workbench header.
- **Proof surface**: Storybook stories on synthetic graphs (2.5k), a
  CosmosSpike-style FPS probe, and a vitest browser test — before the workbench
  wiring.

## Rabbit Holes

- **2.5k performance is unproven.** No candidate ships a 2.5k benchmark and the
  reference is 150 nodes. P1 must measure FPS/draw-calls/label-count on the
  actual stack + WebKitGTK; the stack choice is contingent on it.
- **Label engine at scale.** 2.5k DOM labels is a known killer; keep the ≤300
  visible cap, SDF/sprite + screen-space budget. Getting instanced SDF perfect
  is a trap — Troika/drei `<Text>` is the pragmatic path.
- **`three` duplication.** Two `three` instances silently break everything;
  verify lockfile dedupe for the chosen candidate.
- **StrictMode + Tauri.** WebGL context must survive dev double-mount and full
  teardown; SDF fonts/atlases must be bundled (CSP blocks remote assets); toggle
  must keep stable container ref identity.
- **Simulate-then-freeze.** InfraNodus runs the force sim to settle then freezes;
  deciding worker-layout-with-z vs renderer-internal sim vs server-2D+z-synthesis
  is a P0 call with worker DOM-free + transferable-buffer constraints.
- **Bundle deobfuscation beyond parameters** — out of scope; the extracted prose
  spec is sufficient, don't chase minified internals further.

## No-Gos

- No analytics/insight panels, content-gap analysis, or AI features.
- No text-to-graph / NLP — we render an existing ontology graph, not build one
  from text.
- No replacing or regressing the cosmos 2D path (it stays default; also serves
  the 100k spike).
- No InfraNodus feature parity (search, filters, the idle auto-cycle showcase,
  topic-callout pills, gap connectors).
- No VR/AR (the bundle's A-Frame path), no graph editing via the 3D canvas
  beyond selection, no server/data-model changes beyond adding z to the
  projection.
