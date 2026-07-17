# Graph 3D View — P0 Design Gate

Date: 2026-07-16 (v2, revised after the codex adversarial critique in
`DESIGN-REVIEW.md` — disposition table in §11). Author: Fable (main agent),
per the binding routing in `GOAL.md`. Inputs: the frozen research corpus in
this directory, the verify-gate corrections in `VERIFICATION.md` §5 (binding),
and a clean-room 2,500-node benchmark prototype built and measured for this
gate (§9, committed at `scratchpad/graph-3d-bench/`). No bundle or AGPL source
was consulted; every visual parameter cited below comes from the prose spec in
`bundle-static-analysis.md` / `demo-behavior-matrix.md` /
`label-anti-overlap.md`.

Decisions are numbered D1–D8. Verify-gate fixes (1)–(7) from
`VERIFICATION.md` §5 are marked **[fix N]**; §11 is the conformance table.

## D1. Rendering stack — custom instanced Three.js driver

**Decision: a repo-owned instanced renderer on catalog `three@0.185.1`
(architecture B / candidate iv in `library-landscape-3d.md` §3), no wrapper
library, no React inside the engine.**

Geometry strategy, proven by the §9 benchmark:

- **Nodes:** one `InstancedBufferGeometry` draw of camera-facing circle-masked
  quads; per-instance offset (xyz), size, color, alpha. Billboarding in the
  vertex shader; the reference's zoom damping
  `clamp((camDist/600)^0.65, 0.35, 3)` applied as a uniform
  (`bundle-static-analysis.md` §3).
- **Edges:** one `InstancedBufferGeometry` draw of quadratic-Bézier
  camera-facing ribbons — a 30-segment template extruded in the vertex shader,
  per-instance endpoints/control point/width/color/alpha. Control point =
  midpoint + perpendicular offset `len × 0.25` rotated 0.25 rad about the link
  axis; width `0.4 + 4.6·(w/maxW)^1.2`; global opacity
  `max(0.10, 0.95 − √E/100)` — **the clamp is part of this design**: the prose
  formula goes negative above 9,025 edges (`bundle-static-analysis.md` §5,
  static-analysis-confirmed **[fix 6]**). Ribbons, not tubes: the runtime
  census proves triangulated strips with no GL lines
  (`demo-behavior-matrix.md` §3); a camera-facing ribbon is the cheaper
  clean-room equivalent of the radial-4 tube at identical on-screen effect.
  Self-loops are a documented precondition violation: the projection rejects
  `source === target` (the ontology path already removes same-node edges), so
  the reference's cubic self-loop variant is intentionally out of contract.
- **Labels:** pooled canvas-texture sprites (D5), ≤96 draw calls.
- Fixed cost: 2 geometry draw calls + visible-label sprites. Benchmark
  steady-state: 78–92 total draw calls at 2,500 nodes (§9).

Why not the alternatives (`library-landscape-3d.md` §1, §3):

- **reagraph** — disqualified: its direct `three ^0.184.0` excludes the repo's
  `0.185.1` (0.x caret), forcing a second three or an override, and its
  precomputed-position API is undocumented (**[fix 1]**, `VERIFICATION.md` §1).
- **vasturiano `3d-force-graph` / `react-force-graph-3d` / `three-forcegraph`**
  — a new runtime dependency; one `Object3D` group per node (the reference
  runs it at 150 nodes; at 2,500 that is thousands of scene objects and
  per-sprite draw calls); requires converting our typed-array projection into
  retained JS object graphs; the library owns the simulation loop we
  deliberately freeze (D4); and the corpus contains no 2.5k evidence for it.
- **R3F + drei in `foundation/ui-system`** — the doctrine routes external
  engines and browser platform wrappers to `drivers`
  (`integration-constraints.md` §5; `standards/architecture/07-non-slice-families.md`);
  `orb.tsx` is precedent for a thin visual, not a graph engine with a worker
  protocol and picking. React reconciliation must be kept off the 2.5k hot
  path anyway, so JSX buys nothing for an imperative mount/update/destroy
  handle consumed from the client bridge.

**Dependencies: no new runtime packages.** The engine imports catalog `three`
and `three/addons/controls/TrackballControls.js` (ships inside the `three`
package). Single-three status, verified against the post-install lockfile: the
driver's bare `three` import resolves to the root `three@0.185.1`, and this
design adds no second range. One *pre-existing* nested copy exists in the
repo — `stats-gl` (a drei transitive dependency) pins `three ^0.170.0` under
`node_modules/stats-gl/node_modules/three`; it predates this goal, nothing in
the repo imports `stats-gl`, and it can only enter a bundle through drei's
unused Stats components. The chosen candidate therefore loads exactly one
three at runtime; the inherited nested copy is recorded, not introduced
(`integration-constraints.md` §8). Dev-only additions named here per the SPEC dependency
constraint: `@types/three` (already resolved in the lockfile at `0.185.1`;
gains a catalog pin + driver devDependency entry), plus the already-cataloged
`@vitest/browser` / `@vitest/browser-playwright` for the P1 browser test and
storybook types for stories.

**Lifecycle/ownership contract (StrictMode + Tauri).** The handle owns and its
`destroy()` releases, idempotently and in this order: the rAF loop; controls
(`TrackballControls.dispose`); every listener it registered (canvas
click/pointer, window resize — named handlers, never anonymous); observers
(resize/theme, if any are registered by the bridge they are the bridge's);
label pool textures + sprite materials; node/edge
geometries + shader materials; the `WebGLRenderer` (`dispose()`) and its
canvas element (removed from the container). WebGL context-loss registers a
`webglcontextlost` listener that surfaces a typed `Graph3DDriverError` through
the bridge's error atom rather than crashing. The §9 prototype implements
exactly this table and passes a destroy → mount → destroy → mount exercise
leaving a single canvas (`REMOUNT_OK`, §9); the P1 `@vitest/browser` test is
the binding StrictMode proof per SPEC.

## D2. Engine placement + Storybook hosting

**Decision: new driver package `packages/drivers/graph-3d` (`@beep/graph-3d`)
with the public browser surface on a `./browser` subpath. Stories colocated in
`packages/drivers/graph-3d/stories/**`, discovered by adding one driver glob to
`apps/storybook/.storybook/main.ts`.**

- Import path: `@beep/ontology-ui` → `@beep/ontology-client` →
  `@beep/graph-3d/browser`. Slice `ui` never imports the driver; the client
  bridge owns mount/update/selection/finalization exactly like the cosmos
  bridge today (`Session.atoms.ts` `ontologyGraphRenderBridgeAtom`, verified in
  this checkout at
  `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1279`).
- `./browser` subpath (not a browser-safe root): `@beep/pretext` is the live
  precedent (`packages/drivers/pretext/package.json` exports `./browser`);
  copying cosmos's root-only shape would reproduce a recorded doctrine strain
  (`integration-constraints.md` §5, option i).
- The driver stays ontology-unaware: it consumes `Graph3DProjection` (D3) and
  emits node indices. Community/IRI/atom semantics live in the slice client.
- Storybook: the current glob only matches `foundation/ui-system/*/stories`
  (`apps/storybook/.storybook/main.ts:27`, verified). `GOAL.md` scope
  explicitly allows the glob change. The storybook app is a composition root,
  not slice `ui`, so hosting driver stories does not violate the
  ui-cannot-import-drivers law (`integration-constraints.md` §6). The
  storybook CI lane already installs Playwright Chromium and runs story tests
  through these globs (`.github/workflows/storybook.yml`), so driver stories
  get hosted browser execution without new CI wiring.

## D3. `Graph3DProjection` contract

**Decision: a driver-owned schema class mirroring `CosmosGraphProjection`'s
flat typed-array shape, extended with the per-node/per-edge channels the
visual grammar requires, plus a handle that adds `select` to the cosmos
surface.**

```ts
// packages/drivers/graph-3d — shape, not final code
Graph3DProjection {
  nodeCount: Int
  edgeCount: Int
  nodeIds: Uint32Array          // length === nodeCount
  pointPositions: Float32Array  // interleaved xyz, length === 3 * nodeCount
  links: Float32Array           // source/target index pairs, length === 2 * edgeCount
  nodeCommunities: Uint16Array  // length === nodeCount; palette slot = ordinal % 12
  nodeImportance: Float32Array  // length === nodeCount; normalized [0,1] betweenness
  edgeWeights: Float32Array     // length === edgeCount; normalized [0,1]
  labels?: ReadonlyArray<string> // node order; length === nodeCount when present
}

Graph3DRenderHandle {
  backend: "three-instanced"
  destroy(): void
  fps(): number
  update(projection: Graph3DProjection): void
  select(nodeIndex: number | undefined): void
}

renderGraph3D(container, projection, options?) →
  Effect<Graph3DRenderHandle, Graph3DDriverError>
// options: { onNodeSelect?: (nodeIndex: number | undefined) => void }
```

- **Invariants are constructor validation**, schema-first: the lengths above,
  link indices in `[0, nodeCount)`, no self-loops (`source !== target`),
  importance/weights finite in `[0,1]`. Violations are decode/make failures,
  not renderer crashes.
- The handle mirrors `CosmosRenderHandle` (`Cosmos.renderer.ts:315`, verified)
  per the SPEC's reuse constraint; `select` and `onNodeSelect` are the
  intentional extensions `integration-constraints.md` §1 anticipated.
- `update` is full-projection replacement in P2, matching the cosmos bridge's
  behavior (`integration-constraints.md` §1). The instanced layout admits
  per-slot sparse writes, but topology-changing sparse updates (add/remove
  compaction, capacity growth, incident-edge rewrites) are explicitly **not**
  designed here — today's `changedEdgeIds` is always empty and the hints are
  not topology deltas (`integration-constraints.md` §2).
- Node size in-renderer: logical `10 + importance·scale` with
  `scale = min(150, 22.4/maxImportance)`, world diameter
  `logical × 0.5 × zoomDamping` (`bundle-static-analysis.md` §3). Passing
  normalized importance keeps the driver free of bc semantics.
- **Palette-slot stability:** `nodeCommunities` carries a *stable ordinal*, not
  a hash: the P2 mapping assigns ordinals by first-seen order of cluster IRIs
  sorted lexicographically at ordinal-table creation, and the table persists
  across projection updates within a session — a node keeps its color when
  the projection refreshes. Slot = ordinal mod 12 (the palette's ordinal-scale
  behavior, `bundle-static-analysis.md` §3).
- Selection state is handle-side (`select`), not projection data — selection
  must not force a projection rebuild (`integration-constraints.md` §9).
- Like cosmos, visual constants live in an internal `Graph3DConfig` with
  schema defaults, not a caller contract (`integration-constraints.md` §1;
  decide-by-consistency). Theming is fixed dark grammar (D7), so mount options
  carry no color tokens.

## D4. Layout location — worker-baked force-directed xyz, frozen renderer

**Decision: force-directed 3D positions are computed in the existing
visualizer worker (`Session.visualizer.ts`) and delivered as baked
coordinates; the renderer never runs a simulation. [fix 3 resolved: freeze]**

- The reference feeds baked xyz into an active d3 component; freeze-vs-simulate
  is explicitly our choice (`VERIFICATION.md` §1, §5.3). Freezing keeps the
  renderer stateless over layout, makes `update()` deterministic, avoids a
  `d3-force-3d` dependency, and honors the worker-DOM-free constraint
  (`integration-constraints.md` §7).
- **The layout algorithm (prototyped and timed in §9):** deterministic
  community-clustered spherical seed, then a d3-family force relaxation, all
  DOM-free in the worker:
  - forces per tick: bounded many-body repulsion (strength −60, max range 150,
    spatial-hash grid with cell = range, 27-cell neighborhood); link springs
    (rest length 50 same-community / 150 cross-community, degree-biased force
    split); centering (mean-recenter each tick); soft radial containment
    (product-tuned replacement for the reference's reference-scale collision
    and radial-velocity-limit terms, which do not transfer to 2,500 nodes).
  - schedule: alpha 1 → `alpha ×= 0.9` per tick, stop at alpha < 0.02 or 60
    ticks (≈ 39 ticks, the reference's alphaDecay 0.10 / alphaMin 0.02
    contract, `bundle-static-analysis.md` §2); velocity decay 0.4-family
    damping; **fully deterministic** — fixed iteration order, no randomness
    beyond the seed.
  - measured: ~1.3–1.4 s / 38 ticks at 2,500 nodes + 5,000 edges (§9),
    single-threaded — an acceptable one-time async cost inside the existing
    worker request, off the render thread.
- **Schema shape: a `pointDepths: Float32Array` buffer (one z per node,
  length = projected node count) added to `OntologyGraphProjection` and
  populated on every completed projection** — not an interleaved rewrite of
  `pointPositions`, so every existing 2D stride-2 consumer including the
  cosmos adapter is untouched (zero-cosmos-diff acceptance criterion;
  `integration-constraints.md` §2 poses exactly this fork). The field is
  structurally required on the projection (always computed; the 2D path simply
  ignores it), which keeps one schema shape — no versioned union, no
  optional-field ambiguity in either direction of the worker protocol.
- **Worker-protocol consequences, enumerated:** `OntologyGraphProjection` is
  embedded in the encoded command (previous projection for deltas) and both
  success results (`Session.worker-protocol.ts`), and both sides
  encode/decode across structured clone. Adding `pointDepths` therefore
  changes: the projection schema + its constructor call sites, the codec
  round-trip (Float32Array must survive encode/decode like `pointPositions`
  already does), worker fixtures/tests, and the delta path — a delta request
  carries the previous projection's depths in, and layout **seeds from
  previous positions** (x, y, *and* z retained via the existing
  previous-position mechanism extended to three components) so incremental
  updates preserve spatial continuity instead of re-randomizing.
- **Non-destructive toggle [fix 2]:** the 2D/3D toggle switches which renderer
  consumes the *same already-computed projection* — it never triggers a
  projection recompute, so the z buffer is literally the same `Float32Array`
  across flips. Flatten/restore is exact by construction, matching the
  observed behavior (`demo-behavior-matrix.md` §1).
- **Importance = true betweenness centrality, in the worker.** SPEC is
  normative ("Label importance = betweenness centrality") and the corpus
  proves degree misranks bridge nodes (`demo-behavior-matrix.md` §4), so the
  P2 mapping computes Brandes betweenness over the projected graph:
  undirected, unweighted, BFS variant; deterministic neighbor order (ascending
  node id); normalized to [0,1] by the max; ties broken by node id. Complexity
  O(V·E) ≈ 12.5M edge relaxations at 2,500 nodes / 5,000 edges — well under a
  second in the worker, and P2 records the measured cost next to the layout
  time. No degree fallback ships as the default; if a future graph scale makes
  Brandes untenable that is a recorded SPEC change, not a silent downgrade.
- `OntologyPinnedNode` keeps x/y only; pinning z is out of scope (SPEC:
  data-model changes beyond z are out).
- Per-node community ordinals: derived from cluster identity with the stable
  ordinal table of D3. Calibration reference: the final captured dataset is
  150 xyz-complete nodes, 1,497-of-1,500 captured edges, six communities with
  the resolved topic→palette mapping, bc 0–0.4035 (mean 0.0204), z spread
  ≈ −137..125 (`VERIFICATION.md` §1) — reference-scale facts used to sanity-
  check the mapping, never as 2.5k performance evidence.

## D5. Label technique — pooled canvas-sprite labels, rank/fade declutter

**Decision: canvas-rasterized `THREE.Sprite` labels from a fixed pool (≤96),
prioritized by importance rank with selection override, decluttered by the
reference's adaptive budget + opacity ramp. No troika, no DOM overlay.**

- Primitive: the reference's own technique — text rasterized to a canvas
  texture on a camera-facing sprite, `system-ui` at 90 texture px, depth test
  off, renderOrder 1000 (`bundle-static-analysis.md` §4, runtime-confirmed by
  the scene census). CSP-safe under Tauri's `default-src 'self'`: no remote
  fonts, no blob workers (`integration-constraints.md` §7). Troika's SDF
  fidelity is unnecessary at this raster size and brings worker/asset
  lifecycle risk plus a new dependency; the DOM overlay path is the documented
  CPU/compositing risk at 300 spans (`label-anti-overlap.md` §1) and stays
  cosmos-only.
- Budget and fade (all constants from `bundle-static-analysis.md` §4):
  `K = clamp(round(4.5·√visibleNodes·(700/camDist)^0.7), 8, 90)`; first 15% of
  K fully opaque with floor `max(2, round(10·zoomFactor))`; smoothstep fade
  beyond K/2; ordinary opacity floor **0.10**; depth fade for content >35
  world units behind graph center over 130 units, capped at 85% reduction.
  Label world height `(logical + 8) × zoomDamping × 0.75`.
- Priority: interaction override first (the selected node's label is always
  admitted — implemented and exercised in the §9 prototype), then
  `nodeImportance` descending (= betweenness, D4), then stable node id.
- Pool mechanics: sprites are reused, textures re-rasterized only on
  reassignment; the top-pool textures are pre-rasterized at mount, which
  eliminated the §9 cold-start spike.
- Rank/fade *is* the reference mechanism — it reduces, not eliminates, overlap
  (`VERIFICATION.md` §1; screenshots show residual collisions). The
  screen-grid rectangle admission from `label-anti-overlap.md` §3 is a P1
  stretch goal, not required for the six SPEC behaviors.
- `labelDetail` reuse: `full`/`key` gate the candidate set size, `hidden`
  empties it (`label-anti-overlap.md` §4).

## D6. Interaction and selection model

**Decision: TrackballControls; CPU screen-space picking; single-click select
with dim, empty-click clear; IRI-keyed selection with an explicit
remap-and-reapply transaction across projection updates.**

- Camera: perspective FOV 40°, `TrackballControls` — the reference's captured
  control class and mapping (3D: left rotate / wheel dolly / right pan, pan
  speed 0.30; `bundle-static-analysis.md` §7). Programmatic camera moves tween
  ~1,000 ms.
- Picking: project node positions to screen space on click, reject points
  behind the camera plane, take the nearest within a 24 px radius. Measured
  0.11–0.23 ms average, 2.2 ms worst at 2,500 nodes (§9) — no raycast/GPU-pick
  machinery is warranted. Lives in the driver; emits a node **index** valid
  for the projection currently rendered.
- Click semantics are ours to define — the reference's are unresolved
  (**[fix 6]**, idle-cycle confound; `demo-behavior-matrix.md` §1): click
  node = select; click empty canvas = clear; no drag-to-move nodes; no
  multi-select (out of scope).
- Dimming (values confirmed, `bundle-static-analysis.md` §6): selected node +
  neighbors 1.0; other ordinary nodes/labels **0.10** (0.35 reserved for
  group/cluster nodes when the projection carries them); non-highlighted edges
  `rgba(80,80,80,0.30)`; edges touching the selection keep community color at
  α 1.0. Applied as per-instance attribute rewrites — measured 2.5–14 ms for a
  full rewrite (§9).
- **The selection transaction (indices are projection-scoped, so IRI is the
  durable key):**
  1. Canvas click → driver emits the node index → bridge resolves
     `projection.nodes[index].iri` against the projection it mounted and
     writes `selectedOntologyResourceIriAtom` — the same atom tree selection
     writes, so canvas click behaves exactly like tree selection today,
     including the existing depth-1 focus reprojection
     (`integration-constraints.md` §9; decide-by-consistency). The renderer's
     local dim gives immediate feedback while the reprojection round-trips.
  2. On every projection update (any source), the bridge re-resolves the
     current selected IRI to an index in the **new** projection and calls
     `handle.select(newIndex)` after `handle.update(projection)`; if the IRI
     is absent from the new projection, `select(undefined)`.
  3. Echo suppression: `onNodeSelect` fires only from user clicks (the driver
     never fires it from `select()` calls), so bridge-applied selection cannot
     loop.
  4. Tree→canvas, canvas→tree, empty-clear, toggle (fresh mount applies the
     current selection after first render), and projection-update paths all
     reduce to steps 1–3.
  - If P2 QA finds reproject-on-click jarring in 3D, the recorded fallback is
    splitting a visual-selection IRI from `focusIri` — a client-only change
    the transaction above already isolates.

## D7. Theming tokens

**Decision: the graph canvas keeps a fixed dark grammar in both app themes —
`#111111` background, white labels, the 12-slot community palette — matching
the cosmos driver's existing hardcoded-color behavior. No live theme contract
is needed because nothing theme-dependent is rendered.**

- `#111111` is the observed clear color, not the `#000000` bundle fallback
  (**[fix 4]**). The 12-color palette is community identity encoding, stable
  across themes (color means topical community,
  `infranodus-method-corpus.md` §1).
- Cosmos today hardcodes point/link/label colors and ignores the app theme
  entirely (`integration-constraints.md` §4); the workbench mount surface
  (`bg-background`) themes the *surroundings*. The 3D canvas adopts the same
  convention — decide-by-consistency — which resolves the live-update gap the
  critique found: a theme flip changes nothing inside the canvas, so no
  `setTheme` path, no remount, no stale state.
- The repo has no graph token family and inventing one is out of packet scope.
  If a light graph grammar is wanted later, the prose spec records the
  reference light values (bg `#e6e7eb`, non-highlighted edges
  `rgba(100,100,100,0.05)`, light plates) and the recorded extension point is
  an idempotent handle-level theme setter driven by the bridge's
  `MutationObserver` (orb.tsx precedent) — deliberately not built now.
- Storybook stories render the dark grammar on a dark canvas.

## D8. 2D/3D toggle UX

**Decision: a `Switch` labeled "3D" in the workbench graph toolbar (same
control family as the existing "Inferred" switch), backed by a client atom
`ontologyGraphRendererAtom: "cosmos" | "graph3d"` defaulting to `"cosmos"`.**

- Placement: the toolbar row that already hosts the view-mode and fold-level
  `NativeSelect`s and the Inferred `Switch`
  (`Session.workbench.tsx:735-763`, verified) — decide-by-consistency.
- One stable container div with a stable ref callback identity — the workbench
  records a regression where an unstable ref caused repeated mount/teardown
  (`Session.workbench.tsx` graph-container comment;
  `integration-constraints.md` §7). The toggle flips which render-bridge atom
  consumes the container; the bridge being switched away destroys its handle
  in its finalizer (StrictMode-safe, same finalizer discipline as the cosmos
  bridge).
- Default path is byte-identical to today: toggle at `"cosmos"` mounts the
  existing bridge, and `git diff -- packages/drivers/cosmos` stays empty
  (acceptance criterion).
- Selection survives the flip both ways via the D6 transaction (both bridges
  resolve the same selected IRI against the projection they mount); z survives
  because the toggle never recomputes the projection (D4) — the flip is
  non-destructive flatten/restore **[fix 2]**.
- Camera state does not persist across a flip (each renderer fits its view on
  mount) — recorded limitation, matching cosmos's fit-on-init behavior.

## §9. 2,500-node benchmark

Clean-room prototype of exactly the D1 architecture + D4 layout algorithm,
built from the prose parameters only. **Durable source + raw outputs:
`scratchpad/graph-3d-bench/`** (committed; `README.md` there records the run
recipe and full JSON results). It is P0 evidence, superseded by P1's committed
FPS-probe story.

Protocol: 20 s scripted camera sweep — full orbit with dolly 900 → 260 → 900
world units (fill-rate worst case at the near pass) — with a selection-dim
full-attribute rewrite at t=8 s, cleared at t=12 s, and a full-projection
buffer rewrite at t=15 s. Labels re-ranked/faded every frame; picking measured
at viewport center every 30 frames; destroy → mount → destroy → mount
exercised after each run. Synthetic graph: 2,500 nodes, 8 communities,
pareto-skewed importance mirroring the reference bc distribution, 70%
intra-community edges, force-relaxed per D4.

Hardware/software: AMD Ryzen Threadripper 9970X, AMD Radeon AI PRO R9700
(radeonsi gfx1201, ANGLE OpenGL ES 3.2 — unmasked), CachyOS Linux 7.1.3,
headless Chromium via Playwright at 1600×1000, dpr 1.

| Metric | 2,500 n / 5,000 e | 2,500 n / 12,500 e |
| --- | ---: | ---: |
| avg fps | 59.3 | 60.0 |
| p95 / p99 frame | 19.6 / 26.4 ms | 16.8 / 16.9 ms |
| worst frame | 51.9 ms | 17.0 ms |
| layout (D4 relaxation) | 1,251 ms / 38 ticks | 1,410 ms / 38 ticks |
| mount | 75 ms | 23 ms |
| full update rewrite | 14 ms | 2.5 ms |
| pick avg / max | 0.23 / 2.2 ms | 0.11 / 0.6 ms |
| labels visible (avg/max) | 90 / 90 | 90 / 90 |
| draw calls / triangles | 78 / 305k | 92 / 755k |
| JS heap | 16 MB | 18 MB |
| destroy + double remount | clean, 1 canvas, 19.8 ms/mount | clean, 1 canvas, 12.9 ms/mount |

Earlier interactive in-pane runs (867×887): cold 50.9 avg with a single
2,025 ms first-frame spike (shader compile + label rasterization — eliminated
by mount-time pre-rasterization, now measured inside `mountMs`), warm 60.0
avg / worst 17.0 ms.

Reading: the architecture holds the 2,500-node target at the display cap with
2.5× edge headroom. **All runs are vsync-capped: they bound performance from
below and establish no ceiling.** Caveats, per **[fix 7]**: this is a
dev-machine Chromium result on strong hardware. The binding acceptance
benchmark remains the P2 run inside Tauri/WebKitGTK on the
professional-desktop spike surface (`SPEC.md` verification matrix) measuring
the same metric set (frame-time distribution, mount/update, memory, label
admission, picking, plus lockfile dedupe) — **D1 is provisional until that
gate passes**; if WebKitGTK falls materially short, the recorded fallback
order is: reduce edge segment count → halve the label pool → reduce DPR →
report the proven ceiling per the SPEC stop condition. Known risk axes:
dpr > 1 fill rate, WebKitGTK's GL stack vs ANGLE, sprite-label draw calls
(bounded by the ≤96 pool).

## §10. Scope of new files (P1/P2 preview, for routing)

| Surface | File(s) | Actor |
| --- | --- | --- |
| Driver scaffold (`packages/drivers/graph-3d`) | package.json / tsconfig / index.ts / browser.ts / Graph3D.errors.ts | Fable |
| `Graph3D.projection.ts` (schema + invariants + synthetic generator) | one file | codex `--write`, Fable review |
| `Graph3D.renderer.ts` (engine, labels, picking, dimming, lifecycle) | one file | Fable |
| Stories (six behaviors) + FPS probe story | `stories/**` | Fable |
| `@vitest/browser` test (mount / count / select-dim / destroy) | `test/**` | codex drafts assertions, Fable finalizes |
| Worker z + force layout + Brandes bc (`Session.visualizer.ts` + protocol) | one file focus | codex `--write`, Fable review |
| `graph3dProjectionFromOntology` + bridge/toggle atoms + selection transaction | `Session.atoms.ts` | codex `--write`, Fable review |
| Workbench toggle UI | `Session.workbench.tsx` | Fable |

Storybook glob (`apps/storybook/.storybook/main.ts`) gains one driver entry
(D2). Root catalog gains `@types/three` (D1). No other manifest changes.

## §11. Conformance table

Verify-gate must-fix items (`VERIFICATION.md` §5, binding) and the
`DESIGN-REVIEW.md` blocking findings, with dispositions:

| Item | Disposition |
| --- | --- |
| §5.1 reagraph three-range | Honored — disqualified in D1. |
| §5.2 non-destructive z flatten/restore | Honored — D4: toggle never recomputes; same buffer across flips. |
| §5.3 freeze-vs-simulate is a choice | Honored — D4 chooses freeze, with a real force relaxation in the worker. |
| §5.4 final-dataset facts carried | Honored — D4 calibration note (150 nodes / 1,497 edges / 6 communities / bc + z ranges). |
| §5.5 `#111111` dark target | Honored — D7. |
| §5.6 selection values confirmed, semantics unresolved | Honored — D6 keeps 0.10/0.35 values, defines our own click semantics. |
| §5.7 static-analysis vs demo-measured labeling | Honored — D1/D5 mark edge/label constants as static-analysis-confirmed. |
| §5.8 provenance repairs | Done at graduation (`SOURCES.md` rewritten; lane tables authoritative). |
| §5.9 quarantine secondary corpus indexes | Honored — no `corpus-index.md` citation anywhere in this design. |
| §5.10 target-scale benchmark protocol | Partially deferred by SPEC's own phasing: dev-machine result at P0/P1 (§9 records frame distribution, mount/update, memory, labels, picking, draw calls), WebKitGTK acceptance at P2 with D1 provisional until it passes. |
| Review #1 (benchmark auditability) | Fixed — committed parameterized source + raw outputs; pick/mount/update/labels/heap measured; ceiling language corrected. |
| Review #2 (betweenness) | Fixed — D4: Brandes in the worker, no silent fallback. |
| Review #3 (force-directed layout) | Fixed — D4 names forces, constants, schedule, determinism; prototyped + timed. |
| Review #4 (z contract) | Fixed — required-on-completion `pointDepths`, protocol consequences enumerated, delta continuity via 3-component previous positions. |
| Review #5 (selection across reprojection) | Fixed — D6 IRI-keyed remap-and-reapply transaction with echo suppression. |
| Review #6 (lifecycle contract) | Fixed — D1 ownership table; destroy/remount exercised in §9; P1 test remains the binding proof. |
| Review #7 (theming) | Fixed — D7 fixed dark grammar (cosmos convention); extension point recorded, not built. |
| Review #8 (conformance + palette stability) | Fixed — this table; D3 stable ordinal contract. |
