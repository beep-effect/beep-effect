# InfraNodus 3D Renderer — Bundle Static Analysis

Method: targeted string searches and narrow surrounding reads of the proprietary bundle, plus a full CSS read and visual comparison of the three supplied screenshots. No source is reproduced; the output below is a clean-room prose parameterization, with the runtime probe preferred where available.
Availability: the scene/WebGL probes exist, but completed `spacex_s1.graph.json` and `behavior-notes.md` files do not; the graph capture has only an explicit non-final placeholder, so dataset-specific mappings remain unresolved.

## 1. Rendering library fingerprint

| Parameter | Finding | Confidence | Evidence |
|---|---|---:|---|
| WebGL engine | three.js revision **158**, WebGL2 | High | `research/seed/demo/scene-introspection.json:5-20`; `research/seed/demo/webgl-fingerprint.json:5-21` |
| Active desktop renderer | The `ForceGraph3D` React wrapper from the `react-force-graph` / `3d-force-graph` / `three-forcegraph` family | High | `research/seed/bundle/beautified/index-ZkCMfQ39.js:114312-114446`; active instantiation at `:125434-125480` |
| Layout engine | `d3-force-3d`, explicitly selected as the `d3` engine | High | `research/seed/bundle/beautified/index-ZkCMfQ39.js:98730-98823`; `:125437-125473` |
| A-Frame | Embedded and used by the bundle's VR/AR force-graph adapters, but **not** the captured desktop renderer | High | A-Frame adapter at `research/seed/bundle/beautified/index-ZkCMfQ39.js:105661-105946`; desktop component identity at `:114426-114446` |
| Graph data model | Graphology serialization is the input model, not the render engine | High | `research/seed/demo/scene-introspection.json:17-34` |
| Custom layer | Custom THREE sprite nodes/labels and screen-space SVG insight overlays are supplied to the force-graph component | High | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115475-115503`; `:118446-118545`; `:125466-125489` |

The surviving API fingerprint includes `numDimensions`, `nodeRelSize`, `linkCurvature`, `d3AlphaDecay`, `warmupTicks`, `cooldownTicks`, `d3Force`, and both `d3` and `ngraph` engine choices. The live view chooses `d3`, so the bundle's ngraph implementation and A-Frame adapters are dormant alternatives, not evidence of the active layout or render path.

Clean-room implementation spec: use a THREE r158-compatible WebGL2 scene driven by a 3D force-graph abstraction and `d3-force-3d`. Permit custom object factories for nodes and labels and an HTML/SVG overlay above the canvas. Do not build the ordinary desktop view as an A-Frame scene merely because A-Frame is present in the monolithic bundle.

## 2. Force layout parameters

| Parameter | 3D value | 2D value | Evidence |
|---|---:|---:|---|
| Dimensions | 3 | 2 | `research/seed/bundle/beautified/index-ZkCMfQ39.js:125437-125444` |
| Many-body strength | **-60** | **-30** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:104902-104913` |
| Many-body maximum range | **150** | **97.5** | Base distance 50, inter-group multiplier 3, 2D factor 0.65: `research/seed/bundle/beautified/index-ZkCMfQ39.js:124650-124665`; `:125342-125351` |
| Link distance, same community | **50** | **32.5** | Same evidence as above |
| Link distance, cross-community | **150** | **97.5** | Same evidence as above |
| Synthetic center-node link distance | 0 | 0 | `research/seed/bundle/beautified/index-ZkCMfQ39.js:125347` |
| Initial alpha | 1 on graph update/reheat | 1 on toggle/reheat | `research/seed/bundle/beautified/index-ZkCMfQ39.js:105561`; `:125236-125252` |
| Alpha minimum | **0.02** | **0.02** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115741-115758`; `:125451-125452` |
| Alpha decay | **0.10** | **0.10** | Same evidence |
| Velocity decay | Library default **0.40** | Library default **0.40** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:105041-105046`; no active override at `:125437-125480` |
| Warm-up | **2 ticks** | **2 ticks** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124656-124662`; `:125471` |
| Cooldown | Infinite tick allowance, **8,000 ms** wall-clock cap; alpha minimum can stop it earlier | Same | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124661-124662`; `:125471-125475` |
| Collision radius | `(10 + bc × normalizedBcScale) × 2.5` | Same expression × **1.5** instead of 2.5 | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124652-124665`; `:125342-125351` |

The input contract carries server `x` and `y` but no `z` (`~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-17`). In 3D, a missing `z` makes the simulation initializer replace the position with a deterministic index-based spherical seed before the forces run; it is not random scatter and it does not simply extrude the server's 2D coordinates. In 2D, supplied finite `x/y` can seed the simulation. When dimensions drop below three, the engine deletes `z` and `vz`; returning to 3D therefore creates a fresh deterministic 3D seed and reheats the layout (`research/seed/bundle/beautified/index-ZkCMfQ39.js:98759-98767`; `:104902-104913`).

The active force set is link, many-body charge, centering, collision, and a custom radial limit. That limit stops outward velocity when the predicted radius exceeds approximately `12 + nodeCount / 100` in 3D, multiplied by 0.7 in 2D (`research/seed/bundle/beautified/index-ZkCMfQ39.js:115382-115389`; `:124656-124657`; `:125342-125351`). The bundle also passes an ngraph-shaped physics object, but `forceEngine="d3"` means its gravity, spring, and drag values do not govern this view.

## 3. Node encoding

| Parameter | Value | Evidence |
|---|---|---|
| Importance metric | **Betweenness centrality (`bc`)**, not degree or `weighedDegree` | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115481-115487`; data vocabulary at `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-10` |
| BC scale | `min(150, 22.4 / maxBc)` | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124924-124928` |
| Logical node/label size | `10 + bc × bcScale` on desktop | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115475-115487`; default minimum at `:124663-124665` |
| Logical range | Minimum **10**; maximum normally **32.4** when the scale cap does not engage, otherwise lower | Derived from the two preceding artifact-backed parameters |
| Visible node mark | Camera-facing `THREE.Sprite` with a transparent canvas texture; ordinary node = circle, topic/group = square, context = diamond | Texture construction at `research/seed/bundle/beautified/index-ZkCMfQ39.js:115391-115412`; assignment at `:124924-124936` |
| Sprite diameter in world units | Ordinary node: `logicalSize × 0.5 × zoomDamping`; group: `logicalSize × 0.75 × zoomDamping` | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115557-115585` |
| Render strategy | One sprite group per node, not sphere meshes, points, or an instanced mesh | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115475-115503` |

The zoom damping shared by node marks and labels is `clamp((cameraDistance / 600)^0.65, 0.35, 3)`. This deliberately grows world-space marks as the camera recedes, partially counteracting perspective shrink without making them fully screen-constant (`research/seed/bundle/beautified/index-ZkCMfQ39.js:115356-115363`; `:115557-115585`). On narrow viewports the logical size receives a 0.9 multiplier; group sizing also has additional responsive multipliers on small screens (`:115481-115487`).

The renderer's 12-color community palette is:

| Palette slot | Hex | RGB |
|---:|---|---|
| 0 | `#a6cee3` | 166, 206, 227 |
| 1 | `#1f78b4` | 31, 120, 180 |
| 2 | `#b2df8a` | 178, 223, 138 |
| 3 | `#33a02c` | 51, 160, 44 |
| 4 | `#fb9a99` | 251, 154, 153 |
| 5 | `#e31a1c` | 227, 26, 28 |
| 6 | `#fdbf6f` | 253, 191, 111 |
| 7 | `#ff7f00` | 255, 127, 0 |
| 8 | `#cab2d6` | 202, 178, 214 |
| 9 | `#6a3d9a` | 106, 61, 154 |
| 10 | `#ffff99` | 255, 255, 153 |
| 11 | `#b15928` | 177, 89, 40 |

Evidence: the packed palette is decoded into six-digit colors at `research/seed/bundle/beautified/index-ZkCMfQ39.js:103747-103755`, then the community/group value is sent through an ordinal color scale at `:115364-115372` and `:124296-124317`. The absent graph JSON prevents a trustworthy community-ID-to-slot table: an ordinal scale assigns slots by first-seen domain order, so community number alone does not prove the slot.

## 4. Label implementation and anti-overlap mechanism

| Parameter | Value | Evidence |
|---|---|---|
| Label primitive | Canvas-rasterized text texture on a `THREE.Sprite` (the `three-spritetext` technique), colocated in the node's THREE group | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115106-115121`; `:115227-115300`; `:115475-115503` |
| Not used for graph labels | DOM/CSS2D labels and troika SDF text | Sprite construction above; runtime probe found no CSS2D/troika signature at `research/seed/demo/scene-introspection.json:37-39` |
| Typeface/raster size | `system-ui`, normal weight, rendered to texture at 90 px | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115116-115121`; `:115244-115251` |
| Label logical height | Same `10 + bc × bcScale` rule as node importance; a 14-unit floor is used only when measuring horizontal label alignment | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115413-115415`; `:115475-115509` |
| World-space label height | Approximately `(logicalSize + 8 padding units) × zoomDamping × 0.75` for a one-line unselected label | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115565-115578` |
| Depth behavior | Depth test disabled; render order 1000; label remains camera-facing | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115475-115503` |
| Update cadence | Camera-change ranking is throttled to roughly one update per 2 ms; sprite text scaling is recomputed with it | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124736-124749` |
| Visibility mechanism | Importance ranking and continuous opacity; **no rectangle collision test** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115322-115354`; `:115427-115472`; `:115587-115608` |
| Minimum ordinary opacity | **0.10** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115413-115415`; `:115607` |

The anti-overlap mechanism is a decluttering heuristic rather than geometric non-overlap:

1. Sort nodes by `bc` and compute a score roughly proportional to `cameraDistance / logicalSize`.
2. Penalize labels near the projected screen edge, behind the graph center, outside generous screen margins, or projecting above 100 px radius. A projected radius over 200 px is also marked too large for hover.
3. Favor the ten highest-centrality nodes by multiplying their score by 0.2.
4. Build an adaptive label budget `K = clamp(round(4.5 × sqrt(visibleNodeCount) × zoomFactor), 8, 90)`, where `zoomFactor = (700 / cameraDistance)^0.7`.
5. Keep approximately the first 15% of `K` fully opaque, with a floor of `max(2, round(10 × zoomFactor))`. Beyond half of `K`, fade with smoothstep; never drop ordinary node/label opacity below 0.10.
6. For content more than 35 world units behind the graph center, apply another smoothstep over 130 units, capped at an additional 85% reduction.

The exact constants and scoring terms survive at `research/seed/bundle/beautified/index-ZkCMfQ39.js:115322-115354`, the camera projection/penalties at `:115427-115472`, the opacity ramp at `:115587-115608`, and adaptive `K` at `:124736-124745`. This explains the screenshots: zooming changes both the adaptive budget and sprite scale, so more labels become legible, but labels can still overlap because the algorithm never tests label rectangles (`assets/screenshots/user-01-overview-labels.png`; `assets/screenshots/user-02-zoomed-labels.png`).

`labelsizeratio=2` appears in the captured URL (`research/seed/demo/webgl-fingerprint.json:3`) but the current JS bundle contains no `labelsizeratio` key and does not parse it. A clean-room implementation should therefore treat it as a legacy/no-op parameter for this build, not multiply the proven size formula by two.

## 5. Curved edges

| Parameter | Value | Evidence |
|---|---|---|
| Curve type | Quadratic Bézier for distinct endpoints; cubic Bézier only for self-loops | `research/seed/bundle/beautified/index-ZkCMfQ39.js:105180-105210` |
| Curvature | **0.25** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124652-124660`; `:125453-125456` |
| Curve rotation | **0.25 radians** around the source-target axis | Same evidence |
| Longitudinal sampling | 30 segments | `research/seed/bundle/beautified/index-ZkCMfQ39.js:105143-105169` |
| Tube radial resolution | **4** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124658-124660`; `:125453-125456` |
| Width | `0.4 + 4.6 × (edgeWeight / maxWeight)^1.2`, yielding **0.4–5.0** world units | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115835-115848` |
| Global opacity | `0.95 - sqrt(edgeCount) / 100`; for the probed 1,500-edge graph this is about **0.563** | Formula at `research/seed/bundle/beautified/index-ZkCMfQ39.js:125430-125465`; edge count at `research/seed/demo/scene-introspection.json:33-34` |
| Normal color alpha | Community-colored (default scheme) or monochrome; per-edge alpha rises linearly from **0.5 to 1.0** with normalized weight | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115868-115885` |
| Directionality | No arrowheads in the normal graph. Optional animated/highlighted pathways use four particles, not arrows | Defaults at `research/seed/bundle/beautified/index-ZkCMfQ39.js:104996-105019`; active particle callbacks at `:125424-125429`; `:125477-125479` |

For distinct nodes, place the quadratic control point at the midpoint, offset perpendicular to the link by `linkLength × 0.25`, then rotate that perpendicular offset 0.25 radians about the link axis. Render weighted edges as low-radial-resolution tubes so they remain inexpensive and slightly faceted. The graph model is explicitly undirected in the runtime capture (`research/seed/demo/scene-introspection.json:33-34`), so ordinary curvature does not imply direction.

## 6. Selection dimming

| Element/state | Dark theme | Light theme | Evidence |
|---|---:|---:|---|
| Selected node + label | 1.0 | 1.0 | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115417-115425`; `:115537-115552` |
| Single-selection neighbor node + label | 1.0 | 1.0 | Neighbor normalization at `research/seed/bundle/beautified/index-ZkCMfQ39.js:117013-117055`; state application at `:117086-117135` |
| Multi-selection neighbor node + label | `connections / maxConnections`, floor effectively controlled by state/data | Same | Same evidence |
| Non-neighbor ordinary node + label | **0.10** | **0.10** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115413-115415`; `:115547-115552` |
| Non-neighbor group node + label | **0.35** | **0.35** | Same evidence |
| Strongest highlighted edge | Community color, alpha **1.0** | Same | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115795-115820`; `:115853-115863` |
| Other highlighted edge | Community color, alpha **0.30** | Community color, alpha **0.20** | Same evidence |
| Non-highlighted edge | `rgba(80,80,80,0.30)` | `rgba(100,100,100,0.05)` | `research/seed/bundle/beautified/index-ZkCMfQ39.js:115795-115814`; `:115875-115886` |

Node and label opacity are changed together because both sprite materials belong to the same node object (`research/seed/bundle/beautified/index-ZkCMfQ39.js:115512-115522`). Selection adds a rounded translucent label plate: dark labels use approximately `rgba(85,85,105,0.9)` and light labels approximately `rgba(255,255,255,0.9)`; group labels instead use a 40%-lightened community color with a community-colored border (`:115417-115425`). There is no single global highlight color: selected relationships retain their community color. The supplied selection screenshot confirms the full-color neighborhood against a 0.10-opacity background (`assets/screenshots/user-00-selected-dimming.png`).

The dashed path between multiple selected/insight nodes is a **screen-space SVG overlay**, not THREE edge geometry. Use 2 px round-capped lines, a `6,8` dash pattern, a community-to-community gradient at 0.9 stop opacity, and animate dash offset by -28 over 0.9 s linearly. With more than three endpoints, draw only convex-hull neighbor pairs rather than the complete graph; with two or three, draw all pairs. Add a radial community glow around endpoints (opacity 0.35 at center, 0.16 at 55%, zero at edge, Gaussian blur 6). Evidence: `research/seed/bundle/beautified/index-ZkCMfQ39.js:118216-118249`; `:118446-118545`, with width constant at `:117732-117738`.

A separate two-community “gap connector” overlay uses 5 px strokes, `10,12` dashes, and the same 0.9 s cadence (`research/seed/bundle/beautified/index-ZkCMfQ39.js:117587-117699`). Do not confuse that specialized gap mode with ordinary multi-selection.

## 7. 2D/3D toggle

| Parameter | Finding | Evidence |
|---|---|---|
| Layout switch | Same force-graph instance; `numDimensions` changes from 3 to 2 | `research/seed/bundle/beautified/index-ZkCMfQ39.js:125437-125444` |
| Position behavior | 2D deletes `z/vz`; switching either way reheats the force simulation | `research/seed/bundle/beautified/index-ZkCMfQ39.js:104902-104913`; `:125230-125252` |
| Transition | Camera tween is 1,000 ms, but node depth is not tween-flattened; the force layout is recomputed | `research/seed/bundle/beautified/index-ZkCMfQ39.js:118914-118933`; dimension/reheat evidence above |
| Controls | **TrackballControls** by default | `research/seed/bundle/beautified/index-ZkCMfQ39.js:109338-109406` |
| 3D mouse mapping | Left rotate, middle/wheel dolly, right pan; pan speed 0.30 | `research/seed/bundle/beautified/index-ZkCMfQ39.js:119075-119086` |
| 2D mouse mapping | Rotation disabled; left pan, middle/wheel dolly, right mapped to rotate but inert; pan speed 0.15 | Same evidence |
| Camera | Perspective camera, **40° FOV** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:109338-109406`; FOV assignment at `:118914-118920` |
| Dark background | **#000000** by default; optional theme override; light default **#e6e7eb** | `research/seed/bundle/beautified/index-ZkCMfQ39.js:124296-124317`; active background binding at `:125443-125450` |

This is not a static 3D embedding merely projected flat. The toggle uses the same graph component and the same nodes/links, but changes force dimensionality, shortens link/charge ranges in 2D by 0.65, reduces collision scale from 2.5 to 1.5, deletes depth state, and reheats. The camera moves smoothly while the nodes re-layout; returning to 3D regenerates missing depth through the deterministic 3D initializer described in section 2.

The standard desktop component leaves `controlType` unset, so the force-graph wrapper selects TrackballControls. OrbitControls is bundled as an available alternative, but it is not selected for this captured view (`research/seed/bundle/beautified/index-ZkCMfQ39.js:109345-109406`).

## Sources

| id | title | upstream | location `file:line` | theme | disposition |
|---|---|---|---|---|---|
| `g3d-a-01` | Captured proprietary InfraNodus renderer bundle | `https://graph.infranodus.com/assets/index-ZkCMfQ39.js` | `research/seed/bundle/beautified/index-ZkCMfQ39.js:98730-125480` (targeted ranges only) | renderer, force layout, nodes, labels, edges, selection, toggle | `reference` |
| `g3d-a-02` | Bundle inventory and provenance | `https://graph.infranodus.com/` | `research/seed/bundle/raw/bundle-inventory.md:1-42` | capture provenance and bundle boundaries | `reference` |
| `g3d-a-03` | Live THREE scene introspection | local browser capture of InfraNodus SpaceX demo | `research/seed/demo/scene-introspection.json:1-53` | runtime renderer, graphology, scene, missing probes | `reference` |
| `g3d-a-04` | Live WebGL fingerprint | local browser capture of InfraNodus SpaceX demo | `research/seed/demo/webgl-fingerprint.json:1-58` | WebGL2, canvas, captured query parameters | `reference` |
| `g3d-a-05` | Captured proprietary stylesheet | `https://graph.infranodus.com/assets/index-BqJZWaTP.css` | `research/seed/bundle/beautified/index-BqJZWaTP.css:1-2569` | UI typography, theme tokens, canvas compositing | `reference` |
| `g3d-a-06` | Overview, zoom, and selection screenshots | local browser capture of InfraNodus SpaceX demo | `assets/screenshots/user-00-selected-dimming.png:binary`; `user-01-overview-labels.png:binary`; `user-02-zoomed-labels.png:binary` | visual confirmation | `reference` |
| `g3d-a-07` | GraphNode/GraphEdge attribute model | local `mcp-server-infranodus` checkout | `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-17` | input metrics and 2D coordinates | `reference` |

## Unresolved

- `research/seed/demo/spacex_s1.graph.json` is absent. Exact community-ID-to-palette-slot mapping, the dataset's `bc`/degree/`weighedDegree` ranges, and whether this particular response happened to include an undocumented `z` cannot be recovered safely.
- `research/seed/demo/spacex_s1.graph.json.INPROGRESS.txt:1-7` explicitly says its partial capture is non-final and must not be treated as graph data.
- `research/seed/demo/behavior-notes.md` is absent. The exact perceived duration of node re-layout, interaction inertia as experienced in the browser, and any mode-specific behavior not represented in the inspected bundle remain unconfirmed.
- The live scene probe did not recursively enumerate geometries/materials. Sprite and tube techniques are strongly established by the active construction path, but runtime draw-call counts, texture sizes per label, GPU memory, and whether all 1,500 edges survived filtering were not captured.
- The current bundle does not consume `labelsizeratio`; its historical meaning in an older renderer cannot be determined from these artifacts.
- CSS contains UI color tokens and an Ubuntu Mono face, but graph labels are canvas-texture sprites with their own `system-ui` setting. Screenshot antialiasing and exact on-screen pixels still depend on browser font resolution, device pixel ratio, and camera distance.
