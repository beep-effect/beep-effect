# Graph 3D View Spec

## Objective

Ship a React 3D knowledge-graph renderer reproducing the InfraNodus visual
grammar — dark background, force-directed 3D layout, community-colored nodes,
betweenness-proportional labels that fade with camera distance to stay readable
(the anti-overlap mechanism), curved edges, and selection dimming — rendering
**~2,500 nodes at interactive framerates**, and integrate it into the ontology
workbench behind a 2D/3D renderer toggle with the existing cosmos 2D view
remaining the default. The visual target is fully specified (clean-room, prose
parameters) in `research/`; this goal designs the stack, builds the generic
component, then wires it into the workbench.

## Non-Goals

- Analytics/insight panels, content-gap analysis, or any AI feature.
- Text-to-graph / NLP — we render an existing ontology graph, not build one.
- Replacing or regressing the cosmos 2D path (stays default; also serves the
  100k spike). No changes to cosmos behavior.
- InfraNodus feature parity: search, filters, the idle `dynamic=highlight`
  auto-cycle showcase, topic-callout pills, gap connectors.
- VR/AR (the bundle's dormant A-Frame path); graph editing via the 3D canvas
  beyond selection; server/data-model changes beyond adding a z coordinate to
  the projection.

## Source Hierarchy

1. User objective: an InfraNodus-style 3D graph on our stack that navigates
   large graphs without the 2D label-overlap problem.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`effect-first-development`,
   `schema-first-development`, `atom-reactivity-specialist`, `shadcn`).
3. Governing standards: `standards/ARCHITECTURE.md`,
   `standards/architecture/03-driver-boundaries.md`,
   `standards/architecture/07-non-slice-families.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/` (clean-room spec + integration ledger), `ops/`, `history/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- 3D engine + component: **NET-NEW**, placement decided at P0 (candidate:
  `packages/drivers/graph-3d` with a `/browser` subpath, and/or a component in
  `packages/foundation/ui-system/ui`).
- `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts`
  (+ worker/protocol) — add z / 3D layout.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts` — parallel
  3D render bridge + toggle atom + canvas-click→selection sync.
- `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx` — toggle
  UI.
- `apps/storybook` (glob, if placement requires it); `apps/professional-desktop`
  (P1 FPS-spike / P2 QA only).

## Constraints

- **Clean-room, reference-only.** No code copied or closely paraphrased from the
  `graph.infranodus.com` bundle or any AGPL Nodus Labs source. The visual spec
  in `research/bundle-static-analysis.md` is prose parameters; implement from it.
  An `rg` audit of new packages for bundle/AGPL-derived identifiers must be clean
  (acceptance criterion). See `research/SOURCES.md`.
- **Routing (binding, see `GOAL.md`).** All design, review, and user-facing
  frontend/renderer/UX code is the main agent's (Fable). Non-visual plumbing
  (worker 3D layout, projection schema, bridge/toggle atoms) is drafted by codex
  `gpt-5.6-sol --effort medium --write` jobs (one output file per job) and
  reviewed by Fable before commit. `research/` is frozen — no new web research;
  never copy bundle/AGPL code.
- **Doctrine.** Slice `ui` must not import drivers; `client` imports only
  `@beep/<driver>/browser`. The renderer mounts from the ontology client bridge
  (like cosmos). New driver must expose a `/browser` subpath (do not copy
  cosmos's root-import strain). Placement per `research/integration-constraints.md`
  §5.
- **Single `three` instance.** Pinned `three ^0.185.1`; verify lockfile resolves
  exactly one `three` for the chosen candidate (two = broken).
- **StrictMode-safe + Tauri/WebKitGTK + CSP `default-src 'self'`.** WebGL
  acquisition survives dev mount→cleanup→remount with full GL/worker/rAF/observer
  teardown; the toggle preserves stable container ref identity; SDF fonts/label
  atlases are bundled locally (no remote assets). Any layout in the visualizer
  worker keeps its import graph DOM-free.
- **Reuse, don't rebuild.** Mirror `CosmosRenderHandle`
  (`{destroy, fps, update, select}`); consume a flat 3D projection analogous to
  `CosmosGraphProjection`; extend `OntologyGraphProjection` for z; reuse the
  label-priority signal from `labelDetail`/`keyLabelThreshold`; model the FPS
  proof on `CosmosSpike.tsx`. Label importance = **betweenness centrality**.
- **Honor the verify-gate corrections** (`research/VERIFICATION.md` §5, binding
  on P0): reagraph `three ^0.184.0` excludes `0.185.1` (override or drop); the
  2D/3D toggle is non-destructive z flatten/restore; layout is baked-xyz into an
  active d3 component so freeze-vs-simulate is a P0 decision (not "no active
  force"); dark canvas is `#111111` (`#000000` is only the bundle fallback);
  selection dimming *values* (0.10/0.35) are confirmed but click *semantics* are
  unresolved; edge curvature/opacity constants are static-analysis (not
  demo-measured); **no stack is proven at 2.5k — the WebKitGTK benchmark is the
  acceptance gate, not assumed evidence.** Cite primary lane reports / seed
  files, never the `seed/web/*/corpus-index.md` summaries.
- **No new dependencies** beyond those named in the P0 `DESIGN.md`.

## Acceptance Criteria

- [ ] P0 `research/DESIGN.md` decides, each with cited evidence: rendering stack,
      engine placement + Storybook hosting, `Graph3DProjection` contract, 3D
      layout location, label technique, interaction/selection model, theming
      tokens, and 2D/3D toggle UX — plus a 2.5k benchmark result.
- [ ] A Storybook story renders a synthetic ~2,500-node graph exhibiting all six
      behaviors (dark bg, community colors, bc-proportional distance-faded
      labels, curved edges, selection dimming, 2D/3D toggle).
- [ ] An FPS probe (CosmosSpike-style) records sustained interactive framerate at
      2,500 nodes on the dev machine; the number is recorded in `README.md`
      even if it lands below the ~60fps aspiration (a proven lower ceiling is an
      acceptable outcome per the appetite).
- [ ] A `@vitest/browser` test mounts the component, asserts node count, drives
      `select(id)` and checks the dim state, and asserts clean `destroy()`
      (StrictMode double-mount safe).
- [ ] The workbench renderer toggle switches cosmos↔3D with cosmos as default;
      selection stays consistent both ways; default workbench load is unchanged
      (cosmos, zero diff to the cosmos driver).
- [ ] Clean-room `rg` audit of new packages is clean.
- [ ] `bun run beep goals doctor` and `bun run beep lint reflection-artifacts`
      pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Design gate | `test -f goals/graph-3d-view/research/DESIGN.md` + section grep | Passes |
| Storybook 2.5k story | build + visual review of the six behaviors | Renders |
| FPS at 2.5k | FPS-probe story readout recorded in `README.md` | Recorded |
| Browser test | `@vitest/browser` run (mount/select-dim/destroy) | Green |
| Workbench toggle | manual QA: cosmos default, 3D opt-in, selection sync | Passes |
| Cosmos regression | `git diff -- packages/drivers/cosmos` | Empty |
| Clean-room audit | `rg` new packages for bundle/AGPL identifiers | Clean |
| Packet launcher size | `test "$(wc -m < goals/graph-3d-view/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/graph-3d-view/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/graph-3d-view` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- 2,500-node interactive rendering proves infeasible on every candidate stack on
  the target hardware — record the proven ceiling and report before expanding
  the appetite.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
