# Label Rendering and Anti-Overlap Catalogue

## Method note

This lane compares six rendering techniques against the design target of about
2,500 graph nodes and at most 300 visible labels. Cost ratings are qualitative
design estimates, not benchmark results: the corpus contains a report that 300
dynamic CSS2D labels became laggy and added about 300 Troika draw calls in that
author's scene, but it does not contain a controlled benchmark of these six
techniques on our hardware and graph data. [g3d-c-01] The catalogue therefore
separates **rendering cost** from **admission control**: no renderer prevents
text overlap by itself, while the corpus's density-aware example achieved
clarity by filtering to high-priority labels before rendering. [g3d-c-02]

The InfraNodus screenshots were inspected as observations, not as source-code
evidence. They show proportional label sizes and strong depth/selection fading;
the overview is sparse, but the zoomed capture still contains collisions around
`money`/`operation` and `security`/`compute`. [g3d-c-03] [g3d-c-04]
[g3d-c-05] The requested `research/seed/demo/behavior-notes.md` artifact is not
present in this packet, so no implementation claim is inferred from it.

## 1. Technique catalogue

Ratings use **low / medium / high** relative to the other rows at 300 admitted
labels. “Distance fade” means that per-label opacity can be driven by camera
distance; “billboard” means the label can face the camera rather than merely
remaining in a fixed world orientation.

| Technique | Fidelity | GPU cost at 300 visible labels | DOM cost | Distance fade | Billboard | Effort | Library and license |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DOM/CSS overlay | High browser text fidelity, CSS styling, accessibility, and easy measurement; it remains visually sharp because the browser owns rasterization. Our existing overlay uses HTML spans, 11 px text, a dark shadow, and screen-space transforms. [g3d-c-06] | Low direct GPU text cost, but **high CPU/compositing risk** because 300 elements are repositioned every animation frame in the current renderer. [g3d-c-06] | **High**: one span per admitted label plus per-frame style writes; the current code caps at 300 but performs no collision rejection. [g3d-c-06] | Yes, by setting CSS opacity from projected/camera distance; this is proposed application logic over the existing spans. [g3d-c-06] | Effectively yes in screen space: DOM text does not rotate with the 3D scene, but every label must be projected and re-pinned. [g3d-c-06] | **Low–medium** because the repo already has the layer and cap; **medium** once 3D projection, measured rectangles, fades, and collision admission are added. [g3d-c-06] | Browser DOM/CSS; no added library. Existing implementation: `Cosmos.renderer.ts`. [g3d-c-06] |
| `CSS2DRenderer` | High browser text fidelity and CSS control; its output is DOM children. [g3d-c-07] | Low direct GPU text cost, but **high CPU/DOM risk** at this target; a corpus report says 300 moving CSS2D labels became laggy. [g3d-c-01] | **High**: `CSS2DRenderer.domElement` owns child elements and may assign z-index by render order and camera distance. [g3d-c-07] | Yes, via application-controlled CSS opacity; no distance-fade API is documented in the captured API. [g3d-c-07] | Screen-facing by construction, because objects are projected into the renderer's 2D DOM; it does not provide perspective size attenuation automatically in the captured API. [g3d-c-07] | **Medium**: easier scene attachment than a custom overlay, but it duplicates a capability the repo already has and still needs admission/measurement logic. [g3d-c-06] [g3d-c-07] | Three.js addon; Three.js package metadata records MIT. [g3d-c-08] |
| `THREE.Sprite` texture atlas | Medium–high if the atlas is generated at sufficient resolution; quality degrades when labels exceed their rasterized texture resolution. Sprites automatically face the camera, and the Three.js manual demonstrates canvas-generated label textures and aspect-correct scaling. [g3d-c-09] | **Low–medium if batched/atlased**, otherwise draw calls and materials can scale with labels; the corpus does not benchmark a 300-label atlas. This is an engineering estimate grounded in the use of one texture atlas and sprite quads. [g3d-c-09] | None because labels remain WebGL scene objects. [g3d-c-09] | Yes, through sprite material opacity or shader attributes; distance must be supplied by proposed application/shader logic. [g3d-c-09] | Yes, native `Sprite` behavior; the Three.js manual explicitly uses sprites for labels that always face the camera. [g3d-c-09] | **Medium–high**: atlas packing, text measurement, UVs, invalidation, Unicode/font fallback, and batching are ours to own; those concerns follow from replacing the manual's per-label canvas textures with a shared atlas. [g3d-c-09] | Three.js `Sprite`/`SpriteMaterial`, MIT. [g3d-c-08] [g3d-c-09] |
| `troika-three-text` SDF | **High**: SDF antialiasing, kerning, ligatures, bidi/joined scripts, Unicode fallback, outlines, and worker-based layout are documented. [g3d-c-10] | **Medium–high if instantiated once per label**: a corpus report observed roughly 300 added draw calls for 300 Troika labels. Glyph generation/layout is worker-based and the SDF atlas is shared/generated on demand, but neither fact guarantees batching of separate `Text` objects. [g3d-c-01] [g3d-c-10] | None because text is rendered as Three.js geometry/material, not DOM. [g3d-c-10] | Yes: `fillOpacity`, outline/stroke opacity, and material opacity are exposed; a distance ramp can update material opacity or a custom shader uniform/attribute. [g3d-c-10] | Yes with application billboarding, such as copying the camera quaternion; Troika text is a Three.js mesh and is not documented as automatically camera-facing. [g3d-c-10] | **Medium** for individual labels; lifecycle requires asynchronous `sync()` and `dispose()`, plus billboarding and admission logic. [g3d-c-10] | `troika-three-text` 0.52.4, MIT. [g3d-c-11] |
| Instanced SDF glyphs | Potentially **high**, with the same scale-independent SDF edge quality, but shaping, fallback fonts, kerning, and multi-glyph layout depend on how much of a text engine is reused. Troika documents the capabilities a bespoke path would otherwise need to preserve. [g3d-c-10] | **Lowest projected draw-call cost** when glyph quads share geometry/material/atlas and vary by instance attributes; Three.js documents `InstancedMesh` as drawing copies of one geometry/material in one draw call. This is a design inference, not a measured label benchmark. [g3d-c-12] | None because the proposed renderer is entirely GPU-backed. [g3d-c-12] | Yes, efficiently through proposed per-instance opacity/scale attributes in the glyph shader. [g3d-c-10] [g3d-c-12] | Yes, by camera-facing basis vectors in the vertex shader or per-frame quaternion/basis updates; Three.js sprites establish the billboard behavior to reproduce. [g3d-c-09] | **Highest**: glyph shaping, instance ranges per label, atlas management, bounding boxes, picking, updates, and shader maintenance become application responsibilities. [g3d-c-10] [g3d-c-12] | Custom Three.js implementation, with Three.js under MIT; any reused SDF/atlas code must retain the upstream attribution required by its permissive license. [g3d-c-08] [g3d-c-11] |
| drei `<Text>` | Same **high** SDF fidelity as Troika because drei declares `troika-three-text` as a dependency; drei also exposes `Text`, `Billboard`, `ScreenSpace`, and `ScreenSizer` abstractions. [g3d-c-13] | **Medium–high if one React/Troika object per label**; the wrapper does not, by itself, evidence batching of 300 distinct text objects. [g3d-c-01] [g3d-c-13] | None because `<Text>` wraps GPU-rendered Troika text rather than HTML. [g3d-c-10] [g3d-c-13] | Yes through Troika material/opacity properties and React state/frame updates. [g3d-c-10] [g3d-c-13] | Yes when composed with drei `Billboard`; the local README lists that abstraction separately from `Text`. [g3d-c-13] | **Low–medium in an R3F renderer**, because React bindings and billboarding helpers already exist; **high/inapplicable** if the chosen renderer is imperative Three.js and adopting R3F solely for labels. The repo already catalogs R3F, drei, and Three.js dependencies. [g3d-c-14] | `@react-three/drei`, MIT; its metadata depends on `troika-three-text` 0.52.4, also MIT. [g3d-c-11] [g3d-c-15] |

**Gate implication.** DOM/CSS and CSS2D are viable only if admission stays well
below the nominal 300 cap during most frames; WebGL text avoids DOM churn but
still needs the same collision gate. The corpus's strongest general result is
that rendering every annotation creates both frame-rate and occlusion
bottlenecks, while deterministic density filtering and progressive disclosure
control the visible set. [g3d-c-02]

## 2. Distance fade, size attenuation, and billboarding

The following are concrete **proposed ramps** for a perspective camera. They
are not claimed to be InfraNodus's undisclosed parameters. They operationalize
the observed pattern that near/important labels are bright and large while
background labels fade strongly. [g3d-c-03] [g3d-c-04]

Let `d` be camera-to-label distance, choose a fully legible distance `d0` and a
vanish distance `d1 > d0`, and define:

```text
t(d) = clamp((d - d0) / (d1 - d0), 0, 1)
smooth(t) = t²(3 - 2t)
opacity(d) = 1 - smooth(t(d))
```

This leaves labels opaque through `d0`, eases without a visible step, and makes
them exactly transparent at `d1`. For a more aggressive far-field cleanup, use
`opacity(d) = (1 - smooth(t(d)))²`; selected, hovered, and focused labels can
override the result to `1`. Troika exposes fill/material opacity for this ramp,
while DOM labels can receive the same value as CSS opacity. [g3d-c-06]
[g3d-c-10]

For screen-legible text, specify a desired pixel height that shrinks gently
before the label vanishes:

```text
p(d) = mix(18 px, 10 px, smooth(t(d)))
worldHeight(d) = p(d) * 2d * tan(fovY / 2) / viewportHeightPx
```

Under perspective projection, scaling world-space SDF text to
`worldHeight(d)` keeps its apparent height near `p(d)`: large enough to read
nearby, smaller in the distance, and removed by the opacity ramp before it
becomes illegible. Clamp the result to a product-tuned world-size interval to
avoid giant labels at extreme camera distances. This formula is a proposed
projection conversion; the corpus establishes that Troika `fontSize` is in
world units and that Three.js uses perspective distance for projected size.
[g3d-c-10] [g3d-c-16]

For sprites, a simpler artistic option is ordinary perspective attenuation:

```text
scale(d) = mix(sNear, 0.55 * sNear, smooth(t(d)))
opacity(d) = 1 - smooth(t(d))
```

The opacity gate, rather than scale alone, should remove far labels: shrinking
text indefinitely produces unreadable texture noise. Three.js documents sprites
as camera-facing label primitives, and its point/sprite material family supports
distance-sensitive sizing patterns. [g3d-c-09] [g3d-c-12]

Billboarding options are:

1. Use `THREE.Sprite`, which faces the camera automatically. [g3d-c-09]
2. For Troika meshes, copy the camera quaternion to each admitted label after
   camera movement, or compute a camera-right/camera-up basis in the vertex
   shader for a batched path. This is proposed application logic, grounded in
   the billboard behavior documented for sprites. [g3d-c-09] [g3d-c-10]
3. In R3F, compose drei `<Text>` with `<Billboard>`; both abstractions are
   present in the captured library documentation. [g3d-c-13]

The fade/scale ramps should run **before** collision admission: labels at zero
opacity should not reserve grid cells, while near labels should use their actual
post-scale screen rectangle. This ordering is a design inference from the
screen-space competition described in the density-control corpus. [g3d-c-02]

## 3. Screen-space declutter algorithm sketch

At each camera/layout change, project eligible node positions to viewport
coordinates and reject points outside the frustum or behind the camera. Build a
candidate record containing node id, text, projected anchor, depth, computed
opacity/scale, measured pixel rectangle, and importance. This mirrors the
existing repo path that asks the renderer for point positions and converts each
one to screen coordinates every frame. [g3d-c-06]

Sort candidates by a stable priority tuple: interaction override first
(selected, hovered, focused, pinned), then graph importance descending, then
nearer depth, then stable node id. Iterate in that order. For each candidate,
expand its rectangle by a small gutter (for example 2–4 px), determine every
fixed screen-grid cell touched by the rectangle, and accept the label only if
none of those cells is already occupied. When accepted, mark all touched cells;
when rejected, render no label. Stop at 300 accepted labels, matching the
existing renderer's explicit ceiling. The exact cell size and gutter are
product-tuning parameters, not values established by the corpus. [g3d-c-06]

Use the grid only as an acceleration index: collision is rectangle occupancy,
not “one anchor per cell,” so a long label blocks every cell it spans. Preserve
the previous frame's accepted set as a small hysteresis bonus to avoid labels
flickering when camera motion moves two rectangles across a boundary. Recompute
continuously while the camera/layout moves and once after settling; static
frames need no further DOM measurement or sorting. These are proposed runtime
details based on the repo's per-frame projection requirement and the corpus's
screen-space competition diagnosis. [g3d-c-02] [g3d-c-06]

Conceptually, this is the behavior attributed to sigma.js's label grid/density
controls in the local corpus index: screen space is divided into density cells
and only eligible labels pass. [g3d-c-17] However, the captured sigma.js
customization page itself documents font/size/color and custom canvas label
renderers but does **not** expose the `labelGrid` algorithm or prove a top-k
implementation. [g3d-c-18] The design gate should therefore borrow the
grid/priority concept, not claim source-level equivalence with sigma.js.

## 4. Importance and priority ordering

**Recommended priority signal for the gate:** interaction overrides, then
betweenness centrality when the domain projection supplies it, then weighted
degree as the inexpensive fallback, then stable id. InfraNodus's own captured
method material says it ranges nodes by influence using betweenness centrality,
and its demo URLs request `most_influential=bc`/`bc2` with proportional label
size. [g3d-c-19] Betweenness is therefore the closest evidence-backed signal
for reproducing the observed “bridge concepts are prominent” behavior.

Weighted degree remains the practical baseline for arbitrary ontology graphs:
it can be computed from the already-produced edge list, rewards locally well
connected nodes, and avoids making label admission depend on an unavailable
centrality field. This is a proposed fallback; the current projection contains
node/edge typed arrays but no degree, weighted-degree, betweenness, or priority
buffer. [g3d-c-20]

Reuse the existing level-of-detail vocabulary as follows:

- `labelDetail = "full"`: all nodes become candidates, but the screen grid and
  300-label ceiling still decide what is actually drawn. [g3d-c-06]
- `labelDetail = "key"`: only the top importance band becomes candidates, then
  the same grid admits non-overlapping labels. A percentile/top-k threshold is
  preferable to an absolute degree cutoff across differently sized graphs.
- `labelDetail = "hidden"`: no candidates, except a deliberate interaction
  override if product semantics require selected/hovered labels.

The repo already assigns `full` through 250 nodes, `key` through 2,500, and
`hidden` above 2,500. [g3d-c-21] That is a **graph-size level-of-detail decision**, not an
importance ranking. Today the client treats both `full` and `key` identically:
unless detail is `hidden`, it forwards every node label, and the renderer then
takes the first 300 labels by array order. [g3d-c-06] [g3d-c-22] Therefore,
making `key` real requires one explicit, reusable priority signal or ordered
candidate list from the projection; otherwise the 3D path would preserve the
name while continuing to select labels accidentally.

## 5. Ranked combined approaches for the design gate

### Rank 1 — Troika SDF + screen-grid admission + centrality/degree priority

This is the strongest quality/cost balance for an imperative Three.js path.
Troika provides sharp SDF text, font shaping, Unicode fallback, outlines for a
dark background, worker layout, and material opacity; the screen grid supplies
the overlap guarantee that SDF alone does not. [g3d-c-10] Betweenness-first,
weighted-degree-fallback ordering aligns the visible set with the captured
InfraNodus influence semantics and the repo's `key` detail slot. [g3d-c-19]
[g3d-c-21]

**Tradeoff carried into the gate:** separate `Text` objects may approach one
draw call per label, as reported for a 300-label scene, so the prototype must
measure draw calls and frame time at the actual 300-label ceiling. [g3d-c-01]
It also needs explicit billboarding and careful `sync()`/`dispose()` lifecycle.
[g3d-c-10]

### Rank 2 — Existing DOM overlay + measured grid admission + distance fade

This is the shortest path to proving the anti-overlap policy because the repo
already caps 300 spans, projects graph coordinates to screen coordinates, and
re-pins them per frame. [g3d-c-06] Browser text is easy to style and measure,
and the new work is concentrated in priority ordering, rectangle occupancy,
opacity, and hiding rejected spans.

**Tradeoff carried into the gate:** the target is exactly the scale where a
separate CSS2D report observed lag, and our current implementation writes up to
300 transforms every animation frame. [g3d-c-01] [g3d-c-06] This should be
ranked as the low-effort proof/fallback, not assumed to be the final production
renderer without profiling camera motion on target hardware.

### Rank 3 — Instanced SDF glyphs + shader fade/billboard + the same grid

This has the best projected GPU scaling because shared glyph geometry/material
can collapse many glyphs into a small number of draw calls, following the
single-draw-call purpose of Three.js instancing. [g3d-c-12] It preserves the
same admission and priority policy as ranks 1–2, so it is an optimization path
rather than a different UX.

**Tradeoff carried into the gate:** it has by far the highest implementation
and correctness burden, especially for shaping, kerning, Unicode fallback,
dynamic atlas updates, per-label bounds, and picking—capabilities Troika already
documents. [g3d-c-10] At only 300 visible labels, it should advance over rank 1
only if profiling proves draw-call cost, not overlap, is the remaining blocker.

**Conditional substitution.** If P0 chooses React Three Fiber, drei `<Text>` +
`<Billboard>` can replace raw Troika in rank 1 with lower React integration
effort; drei already depends on Troika and the repo already catalogs R3F/drei.
[g3d-c-13] [g3d-c-14] It is not ranked separately because it retains the same
per-label rendering and admission tradeoffs rather than constituting a distinct
anti-overlap strategy.

## Sources

| id | Local artifact | Use |
| --- | --- | --- |
| `g3d-c-01` | `explorations/graph-3d-navigation/research/seed/web/labels/07_discourse-css2d-label-optimization.md` | Runtime report for 300 CSS2D labels and Troika draw calls; anecdotal, not a controlled benchmark. |
| `g3d-c-02` | `explorations/graph-3d-navigation/research/seed/web/labels/08_mdpi-highperf-webgl-visual-analytics.md` | Annotation bottlenecks, density-aware high-priority filtering, progressive disclosure, and benchmark context. |
| `g3d-c-03` | `explorations/graph-3d-navigation/assets/screenshots/user-00-selected-dimming.png` | Selected-state dimming and proportional-label observation. |
| `g3d-c-04` | `explorations/graph-3d-navigation/assets/screenshots/user-01-overview-labels.png` | Sparse overview and proportional-label observation. |
| `g3d-c-05` | `explorations/graph-3d-navigation/assets/screenshots/user-02-zoomed-labels.png` | Zoomed-state observation, including residual collisions. |
| `g3d-c-06` | `packages/drivers/cosmos/src/Cosmos.renderer.ts` | Existing DOM overlay, 300 cap, styling, projection, and per-frame re-pinning. |
| `g3d-c-07` | `explorations/graph-3d-navigation/research/seed/web/labels/06_threejs-css2drenderer-docs.md` | CSS2D DOM ownership, render API, sorting, and distance-based z-index behavior. |
| `g3d-c-08` | `explorations/graph-3d-navigation/research/seed/web/libraries/threejs-package.json.md` | Three.js version and MIT license metadata. |
| `g3d-c-09` | `explorations/graph-3d-navigation/research/seed/web/labels/04_threejs-billboards-lod.md` | Sprite label textures, camera-facing billboards, and scale examples. |
| `g3d-c-10` | `explorations/graph-3d-navigation/research/seed/web/labels/01_troika-three-text-sdf-docs.md` | Troika SDF quality, layout, worker, opacity, outline, lifecycle, and units. |
| `g3d-c-11` | `explorations/graph-3d-navigation/research/seed/web/libraries/troika-three-text-package.json.md` | Troika package/version and MIT license metadata. |
| `g3d-c-12` | `explorations/graph-3d-navigation/research/seed/web/labels/05_threejs-visual-encyclopedia.md` | Three.js instancing, sprites, points, perspective, and level-of-detail descriptions. |
| `g3d-c-13` | `explorations/graph-3d-navigation/research/seed/web/libraries/drei-readme.md` | drei Text, Billboard, screen-space, and Instances abstraction inventory. |
| `g3d-c-14` | `package.json`; `packages/foundation/ui-system/ui/package.json` | In-repo Three.js, R3F, and drei dependency precedent. |
| `g3d-c-15` | `explorations/graph-3d-navigation/research/seed/web/libraries/drei-package.json.md` | drei MIT license and Troika dependency metadata. |
| `g3d-c-16` | `explorations/graph-3d-navigation/research/seed/web/labels/05_threejs-visual-encyclopedia.md` | Perspective-camera and distance-attenuation grounding for the proposed scale conversion. |
| `g3d-c-17` | `explorations/graph-3d-navigation/research/seed/web/labels/corpus-index.md` | Corpus-level attribution of sigma label-grid/density concepts. |
| `g3d-c-18` | `explorations/graph-3d-navigation/research/seed/web/labels/03_sigma-js-label-customization.md` | Captured sigma label appearance and custom-renderer API; also establishes what the capture does not document. |
| `g3d-c-19` | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/text-network-analysis-uc.md` | InfraNodus betweenness-centrality influence semantics and proportional-label demo parameters. |
| `g3d-c-20` | `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts` | Current projection buffers and absence of a label-priority metric. |
| `g3d-c-21` | `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts` | `fullLabelThreshold`, `keyLabelThreshold`, and `labelDetailFor` semantics. |
| `g3d-c-22` | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts` | Current client treatment of `full`, `key`, and `hidden`. |

## Unresolved

- The requested `explorations/graph-3d-navigation/research/seed/demo/behavior-notes.md`
  file is absent, so the exact InfraNodus fade curve, label budget, hysteresis,
  and collision algorithm remain unknown.
- No corpus artifact benchmarks all six techniques at 2,500 nodes / 300 visible
  labels on our supported hardware. The design gate needs an instrumented
  prototype recording frame time, draw calls, DOM update time, and admitted vs.
  rejected labels during camera motion.
- The captured sigma.js page does not document the internal `labelGrid` or
  `labelDensity` algorithm. Its exact cell policy, ordering, and hysteresis are
  unknown; only the corpus index attributes those concepts to sigma.js.
- The ontology projection has no current betweenness, weighted-degree, or label
  priority field. P0 must decide whether centrality is computed upstream,
  computed in the worker from projected edges, or omitted in favor of degree.
- Target values for `d0`, `d1`, minimum pixel height, grid-cell size, rectangle
  gutter, and hysteresis require viewport- and font-specific visual tuning; the
  proposed formulas define behavior but not final constants.
