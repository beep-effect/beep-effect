# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-07-14 — Synthesis

Six codex gpt-5.6-sol (`--effort medium`) research lanes plus one codex verify
gate, over artifacts captured by cheap fetch agents (two independent
claude-in-chrome browser passes of the live `spacex_s1` demo + the downloaded
`graph.infranodus.com` bundle + web corpora). Per-lane reports and the
provenance ledger live in `research/`; adversarial verdicts in
`research/VERIFICATION.md`. Binding discipline: the bundle is **reference-only**
(prose parameters, no copied code); the eventual component is **clean-room**.

Coverage note: every quantitative style parameter below traces to the
proprietary bundle static analysis (`research/bundle-static-analysis.md`,
reference-only) and is cross-checked against two independent live browser
captures (`research/demo-behavior-matrix.md`). The live reference is a curated
**150-node** graph; it does **not** prove behavior at our ~2,500-node target —
that is a P1 benchmark obligation, not an established fact.

## External Landscape

### What InfraNodus's 3D view actually is (reverse-engineered)

The renderer at `graph.infranodus.com` is **three.js r158 + `d3-force-3d`**,
driven through a **`ForceGraph3D`** wrapper of the `react-force-graph` /
`3d-force-graph` / `three-forcegraph` family (surviving API keys `numDimensions`,
`nodeRelSize`, `linkCurvature`, `d3AlphaDecay`, `warmupTicks`, `cooldownTicks`,
`d3Force`). A-Frame 1.5.0 is bundled but **dormant** for the desktop view (it
serves the VR/AR adapters). Graph data is modeled with **graphology**
server-side; a legacy sigma.js v1 stack is loaded but inactive
(0 nodes). Source: `research/bundle-static-analysis.md` §1,
`research/seed/demo/scene-introspection.json`.

The six visual behaviors, as a clean-room parameter spec (all
reference-only, all citable to `research/bundle-static-analysis.md` with live
cross-checks in `research/demo-behavior-matrix.md`):

1. **Dark background** — WebGL clear color `#111111` (`background=dark`); bundle
   default `#000000`, light default `#e6e7eb`.
2. **3D force layout** — `d3-force-3d`, `numDimensions=3`. Many-body charge
   `-60` (3D)/`-30` (2D); link distance `50` same-community / `150`
   cross-community; alphaDecay `0.10`, alphaMin `0.02`, warmup 2 ticks, cooldown
   capped at 8000 ms wall-clock; collision radius `(10 + bc·bcScale)·2.5`.
   Server sends 2D `x/y` only; for the captured dataset **z is baked** into the
   node attributes (all 150 nodes have z, range ~-137..125). The bundle also
   configures an **active d3 force component** (the generic missing-z path uses a
   deterministic spherical seed). Per VERIFICATION.md §1/§2 these are NOT
   contradictory but also NOT proof of a static embedding: the safe contract is
   "baked xyz enters a d3-backed component"; **whether our product freezes
   precomputed positions (`fx/fy/fz`, cooldown 0) or runs a live sim is a P0
   design choice**, not an established fact. Do not inherit the "no active force"
   inference.
3. **Community-colored nodes** — 12-slot ColorBrewer **Paired** palette
   (`#a6cee3 #1f78b4 #b2df8a #33a02c #fb9a99 #e31a1c #fdbf6f #ff7f00 #cab2d6
   #6a3d9a #ffff99 #b15928`), assigned by an ordinal scale (first-seen domain
   order). Node marks are camera-facing **`THREE.Sprite`** with canvas-texture
   maps (circle / square topic / diamond context), size `10 + bc·bcScale`,
   `bcScale = min(150, 22.4/maxBc)`.
4. **Proportional distance-faded labels (the anti-overlap mechanism)** —
   canvas-rasterized text on `THREE.Sprite` (the `three-spritetext` technique;
   **not** troika SDF, **not** CSS2D/DOM). Depth test off, renderOrder 1000,
   billboarded. Visibility is an **importance-ranked adaptive-budget declutter,
   not a rectangle-collision test**: sort by `bc`, score ~ `cameraDistance /
   logicalSize` with edge/behind-center/margin penalties, boost top-10 by 0.2,
   budget `K = clamp(round(4.5·√visibleNodes · zoomFactor), 8, 90)` where
   `zoomFactor = (700/cameraDistance)^0.7`; ~top 15% of K fully opaque, then
   smoothstep fade, floor opacity `0.10`. Effect: readable hierarchy, residual
   overlaps still visible (decluttering, not strict non-overlap).
5. **Curved edges** — quadratic bézier (cubic for self-loops), curvature `0.25`,
   rendered as **triangulated tubes** (radial resolution 4; confirmed by draw-
   call interception: only `TRIANGLES`, zero `LINES`/`POINTS`), width
   `0.4–5.0` by weight, global opacity `≈0.95 − √edgeCount/100` (≈0.56 at 1500
   edges), undirected (no arrowheads).
6. **Selection dimming + 2D/3D toggle** — neighbors stay opacity `1.0`,
   non-neighbor ordinary nodes/labels drop to `0.10` (group nodes `0.35`);
   selected labels get a rounded translucent plate (`rgba(85,85,105,0.9)` dark);
   the dashed inter-selection path is a **screen-space SVG overlay** (2px,
   `6,8` dash, animated), not THREE geometry. Community colors persist (no single
   highlight color). The **2D/3D toggle** is the same scene: it animates each
   node's `position.z` between its stored layout value and `0` (non-destructive;
   z restored on return), `numDimensions` 3↔2, reheat. Controls =
   **TrackballControls**, perspective camera **40° FOV**.

Semantic grounding (`research/infranodus-method-corpus.md`, Paranyushkin
WWW'19 + 2011 papers, reference-only): **color = topical community** (Louvain
modularity), **size = betweenness centrality** ("topical brokers" / cross-topic
influence — high BC relative to degree = "conceptual gateway"). Layout lineage
is Force Atlas. Data confirms bc drives prominence: `top_nodes` is descending-bc
order; `segment` (bc-rank 3, low degree) gets a large label while max-degree
`company` and max-weighted-degree `stock` do not dominate. UX vocabulary to
reuse: "Topical cluster", "Size by betweenness (cross-topic influence)".

### Candidate rendering stacks (no pick — that is the goal's P0 design gate)

`research/library-landscape-3d.md`. Every candidate is license-permissive and
`three`-compatible with the repo's pinned `^0.185.1` (no version conflict), so
selection turns on control, effort, and measured 2.5k-node performance — for
which **no candidate ships a benchmark**, so P0/P1 must measure it.

- **3d-force-graph / react-force-graph-3d** (MIT, three `>=0.179 <1`): closest
  to InfraNodus's own stack; owns `d3-force-3d`, accepts precomputed positions
  (`fx/fy/fz` + `cooldownTicks(0)`), `linkCurvature`, `nodeThreeObject` can host
  Sprite/SDF labels. Wrapper-driver architecture, effort **M**.
- **Custom instanced three.js** (three MIT): direct typed-array ingestion,
  sparse slot updates, full control; must build camera/labels/picking/lifecycle.
  Effort **L**.
- **R3F 9 + drei** (MIT; drei `<Text>`/`<Billboard>`/`<Instances>`, three
  `>=0.159`, React 19/R3F 9 confirmed, `orb.tsx` precedent): declarative; must
  keep React reconciliation off the 2.5k hot path. Effort **M/L**.
- three-forcegraph (MIT, lower-level) noted. **reagraph (Apache-2.0): its
  `three ^0.184.0` EXCLUDES the repo's `0.185.1`** (0.x caret upper bound
  `<0.185.0`; VERIFICATION.md corrected lane (d)'s "no conflict") — it needs a
  lockfile override/patch or is disqualified, and its precomputed-position /
  SDF-label / sparse-update APIs are undocumented.

Label technique ranking (`research/label-anti-overlap.md`): **Rank 1 Troika SDF
+ screen-grid admission + bc/degree priority** (or drei `<Text>` if P0 picks
R3F); Rank 2 DOM overlay + grid + distance fade (low-effort proof/fallback,
reuses the repo's existing 300-cap overlay); Rank 3 instanced SDF glyphs
(best GPU scaling, highest effort). InfraNodus itself uses Sprite labels with
importance-budget fade and **no** collision test.

## In-Repo Capability Inventory

Full ledger with `file:line` citations in `research/integration-constraints.md`.

- **`@beep/cosmos`** (`packages/drivers/cosmos`) — render driver to mirror:
  `renderCosmosGraph(container, projection) → CosmosRenderHandle {backend,
  destroy, fps, update}`; `update()` is full-replacement (no deltas today); DOM
  label overlay capped at 300; colors are hardcoded RGBA (no theme tokens).
  **reuse (contract mirror) / extend.**
- **`OntologyGraphProjection`** (`packages/ontology/use-cases/.../Session.visualizer.ts`)
  — typed-array projection (`pointPositions` is **2D**, `nodes.length*2`) plus
  rich per-node metadata (kind, classification, cluster) and `labelDetail`
  (`full`/`key`/`hidden`, thresholds 250 / 2500). `key` does **not** currently
  select graph-theoretic key nodes — it forwards all labels; the overlay shows
  the first 300 in projection order. A z coordinate must cross
  `OntologyPinnedNode` + `OntologyGraphNode` + `OntologyGraphProjection`
  (interleaved xyz or a parallel buffer) and the worker message shape. **extend
  (3D layout / z).**
- **Ontology client atom chain** (`packages/ontology/client/.../Session.atoms.ts`)
  — `graphRequestAtom → ontologyGraphWorkerBridgeAtom → ontologyGraphProjectionAtom
  → renderRequestAtom → ontologyGraphRenderBridgeAtom → cosmosProjectionFromOntology
  (~:1244) → renderCosmosGraph`. The render bridge is the seam for a parallel 3D
  renderer + toggle; canvas-click→atom selection sync belongs here (the driver
  stays ontology-unaware). **extend (parallel 3D bridge + toggle atom).**
- **Ontology workbench** (`packages/ontology/ui/.../Session.workbench.tsx`) —
  bare graph mount (`graphContainerRef`), header fold/backend badges, tree-driven
  selection (`selectedOntologyResourceIriAtom` → `focusIri`). Stable ref identity
  is required (a past unstable ref caused renderer teardown). **extend (toggle
  UI).**
- **R3F precedent** — `packages/foundation/ui-system/ui/src/components/orb.tsx`
  (three `^0.185.1`, R3F `^9.6.1`, drei `^10.7.7`; MutationObserver reads theme
  class) + Storybook story. **reuse (pattern).**
- **Storybook** (`apps/storybook`) — glob is
  `packages/foundation/ui-system/*/stories/**`; a `@beep/ui` component is
  discovered automatically; a `drivers/*` component needs a glob addition.
- **FPS spike** — `apps/professional-desktop/src/spikes/CosmosSpike.tsx`
  (1k/10k/100k synthetic, WebKitGTK viability). **reuse (P1 benchmark pattern).**
- **3D engine + component** — **NET-NEW** (placement per P0).

Theme tokens: Tailwind CSS custom properties (`--background`, `--foreground`,
`--border`, `--primary`, five chart colors) + MUI color-scheme provider
(`colorSchemeSelector: "class"`, not next-themes). No graph-specific
`edge`/`community`/`label` token exists yet — a design input. `orb.tsx` reads
computed CSS via MutationObserver as precedent.

## Constraints Discovered

- **Doctrine (placement).** `standards/architecture/03-driver-boundaries.md`: a
  slice `ui` package may **not** import drivers; `client` may import only
  `@beep/<driver>/browser`. Three legal options
  (`research/integration-constraints.md` §5): (i) `packages/drivers/graph-3d`
  (`/browser` subpath) mounted from the ontology **client** bridge — cleanest
  driver route, but must stay ontology-unaware; (ii) an R3F component in
  `@beep/ui` (orb.tsx precedent) — clean for a *thin* primitive, strains the
  external-engine routing rule for a full force/worker engine; (iii) **hybrid**
  — engine in `@beep/graph-3d/browser` (client bridge) + a driver-neutral
  container/toggle shell in `@beep/ui` (ontology-ui consumes it). Note: cosmos
  today imports the driver **root** (no `/browser`), a pre-existing strain a new
  driver should not copy. P0 decides.
- **Single `three` instance is mandatory.** Cosmos uses raw WebGL2 (no three),
  so the only pin is `@beep/ui`'s `^0.185.1`; any install producing two `three`
  copies fails regardless of nominal semver compatibility — verify lockfile
  dedupe for the chosen candidate.
- **StrictMode is on** (`apps/professional-desktop/src/main.tsx`): WebGL
  acquisition must survive dev mount→cleanup→remount and fully release rAF,
  workers, observers, controls, geometries/materials, and the GL context. The
  2D/3D toggle must preserve stable container ref identity.
- **Tauri v2 / WebKitGTK + CSP `default-src 'self'`.** No remote textures/fonts/
  assets — **SDF fonts / label atlases must be bundled locally** (orb.tsx's
  remote Perlin texture is NOT admitted under the packaged CSP). WebGL2 works in
  the WebKitGTK webview per the Cosmos spike, but no pass/fail is recorded — P1
  must verify in both vite-browser and Tauri.
- **Workers stay DOM-free.** Any 3D layout added to the visualizer worker must
  keep its import graph free of `document` at module top level (Vite resolves
  worker imports with browser conditions).
- **No delta rendering today.** `cosmosProjectionFromOntology` drops
  `changedNodeIds`/`changedEdgeIds`; `update()` is full-replacement. Sparse 3D
  updates require extending the projection/handle contract (not required for v1).
- **Scale gap.** The live reference is 150 nodes with ~20–30 legible labels; our
  target is ~2,500. No captured artifact benchmarks any stack at 2.5k on
  WebKitGTK — P1 must produce FPS/draw-call/label-count evidence.
- **Demo-only behaviors to NOT replicate.** The reference's `dynamic=highlight` +
  `cutgraph=1` idle auto-cycle (continuous camera zoom + topic spotlighting,
  fluctuating instantiated-node counts) is a showcase artifact; it confounded
  clean hover/click characterization. Our interaction model (hover, click-select,
  orbit) is a fresh design decision, and workbench selection is tree-driven today.
- **Clean-room / license.** graph.infranodus.com bundle = proprietary,
  reference-only; Nodus Labs OSS = AGPL, understanding-only; candidate libraries
  = MIT/Apache-2.0, port-with-attribution. See `research/SOURCES.md`.

## Open Questions (for the design gate / P0)

1. Rendering stack + engine placement (drivers vs ui-system vs hybrid).
2. 3D layout location: extend the visualizer worker with z (d3-force-3d) vs
   renderer-internal simulation vs server-2D + client z-synthesis.
3. Label technique: Troika SDF vs drei `<Text>` vs DOM-overlay fallback; the
   fade/budget parameters seeded from the extracted InfraNodus formula.
4. Interaction model: raycast/GPU-pick hit-testing, canvas-click→atom selection
   sync, dimming values (0.10/0.35), orbit-control choice.
5. Theming: background/edge/label + cluster palette as tokens (no hex literals).
6. 2D/3D toggle UX in the workbench (cosmos stays default).
