# InfraNodus 3D demo behavior matrix

Method: clean-room observation of two independent 2026-07-14 browser captures, all saved screenshots, the exported live graph store, and runtime scene/WebGL measurements; no renderer bundle source was inspected in this lane.
Boundary: lane (a) is used only where explicitly marked as a corroborating cross-check, and contested or cycle-confounded behavior remains unresolved.

## 1. Interaction -> behavior matrix

The principal experimental confound is itself part of the observed behavior: with no input, the demo periodically moves between a normal overview, a tiny approximately 15% view, and an extreme single-node close-up while changing highlighted topic pairs. The cycle advances over roughly 2-3 second observations, but its full period and easing were not measured. It makes a visual change after a click insufficient evidence that the click caused the change. [g3d-b-01] [g3d-b-02]

| Interaction | Observed visual response | Confidence / boundary |
|---|---|---|
| Hover node | Hovering the visible `financial` dot produced no captured tooltip, cursor change, or reliably separable highlight. | Inconclusive. The autonomous camera/highlight cycle was active, so no pure hover response was isolated. |
| Click/select node | Attempts on `share` and other dots produced no repeatable before/after change attributable to the click. A real highlight treatment does exist: selected/highlighted node and label sprites remain fully opaque while other sprites can dim; topic callouts can also open the AI Insights panel when the click lands near them. The runtime sample measured opacity values 1.0 and 0.35, but that particular sample is more consistent with the automatic topic cycle than with single-node selection. The supplied two-node selection screenshot independently shows `million` and `operation` in backed label pills, a bright neighborhood, glow endpoints, and dashed inter-selection paths while unrelated content becomes nearly invisible. | Treatment is observed; click causality is not. Do not specify click-to-recenter, toggle-selection, or multi-select modifier semantics from this capture. |
| Click empty space | A dramatic zoom-out followed one likely empty-canvas click, then reversed without further input. | Not attributable to the click because the same zoom cycle occurs autonomously. No verified clear-selection behavior. |
| Drag node | No node was successfully dragged or shown to acquire a new position. Drag gestures across the canvas caused camera motion and WebGL redraws, not a measured node-position mutation. | Unresolved. Do not implement draggable nodes on this evidence alone. |
| Scroll / zoom | Wheel input smoothly dollies the perspective camera: parallax changes between near and far nodes, so this is not a flat canvas scale. Toolbar zoom buttons perform the same kind of move in much smaller fixed steps. At extreme distance (the UI showed about 15%), the graph becomes a tiny cluster with zero legible labels; normal framing exposes roughly 20-30; extreme close-up may leave one oversized centered label and thick multi-pixel edge ribbons. | High for visual response; thresholds, dolly speed, limits, and easing were not measured. |
| Rotate / orbit | Canvas drag moves the whole graph coherently with smooth depth/parallax, consistent with camera orbit/trackball motion rather than nodes independently simmering. Three drag gestures triggered 216 draw calls for the first and 256 for the next two combined, versus zero during a hidden-tab five-second idle probe. | High that drag drives camera redraw; orbit versus unrestricted trackball class and exact sensitivity remain unmeasured. |
| 2D / 3D toggle | The same THREE/WebGL2 canvas, scene, nodes, and edges remain mounted. In 2D, every sampled per-node group animates to `position.z = 0`; returning to 3D restores the same prior z values (examples `40.36`, `141.79`, `87.15`, `-42.73`, `69.54`) rather than randomizing or replacing the renderer. A visible flatten/unflatten transition completes within the approximately two-second observation delay. | Definitive runtime observation. Exact duration/easing was not measured. One concurrent pass saw URL label/edge presets flip too, but shared-tab interference prevents treating those query changes as a clean toggle contract. |

## 2. Screenshot-by-screenshot annotation

Counts below mean labels legible at the saved 1920-pixel image, not the number of label sprites instantiated. Anti-aliasing, partial occlusion, and dim text make counts approximate. [g3d-b-03]

| Screenshot | State and framing | Visible labels / named examples | Dimming, edges, and color |
|---|---|---|---|
| `01-default-3d.png` | Sparse topic-level 3D overview centered in a large `#111111` field. | Exactly six legible topic callouts: Infrastructure Scale, Stock Classes, Operational Losses, Growth Metrics, Market Security, Cost Performance. | No selected pill. Six community colors are present. Translucent curved, community-tinted connections have visibly different widths. |
| `02-zoom-out-labels.png` | Extreme zoom-out: the graph occupies only a few dozen pixels at screen center. | Zero reliably legible labels at full-image scale; only tiny colored marks/text fragments remain. | No selection can be read. Edge and color detail collapse into the central speck. |
| `03-zoom-in-labels.png` | Not a distinct zoom-in capture: byte-for-byte identical to `02-zoom-out-labels.png`. | Same zero reliably legible labels. | Same state; it supplies no zoom-in evidence. |
| `04-selected-dimming.png` | Close topic-highlight state around the Stock Classes and Operational Losses neighborhoods. Despite the filename, the capture does not prove a manual single-node selection. | About 25 legible labels: roughly 19 ordinary labels (including `share`, `stock`, `common`, `class`, `operation`, `offering`, `spacex`, `purchase`, `financial`, `condition`, `income`, `business`, `loss`) plus six topic callouts. | The two green communities and their edges are bright; blue/red/salmon/cyan topic callouts and unrelated edges recede. `share` is the dominant ordinary label. Curved weighted ribbons are especially clear on `common`/`stock` routes. |
| `06-edge-curvature.png` | Close six-topic overview chosen to expose connection geometry. | Six topic labels. | Clear smooth bows rather than straight screen segments; several parallel connections separate spatially. Width ranges from hairline to broad ribbon. All six community colors appear. |
| `07-community-colors.png` | Not an independent palette state: byte-for-byte identical to `01-default-3d.png`. | Same six topic labels. | Same six colors and translucent curved edges; useful only as duplicate corroboration. |
| `live-01-default.png` | Raw WebGL canvas capture during the automatic Stock Classes / Operational Losses phase. | About 30 legible labels: all six topic callouts plus roughly two dozen ordinary labels such as `share`, `stock`, `common`, `purchase`, `operation`, `financial`, `offer`, `offering`, `income`, `condition`, `loss`, `business`, and `spacex`. | Green neighborhoods dominate; other topic callouts are still colored but subdued. Dense curved edges remain readable because most are thin/translucent and depth-separated. |
| `user-00-selected-dimming.png` | Full application chrome with two selected concepts, `million` and `operation`, at 12% UI zoom. | Roughly 18-22 labels remain readily legible, led by the two backed selected labels and nearby `segment`, `december`, `increase`, `launch`, `infrastructure`, `space`, `cost`, `class`, `spacex`, and `income`; many unrelated labels remain only faint traces. | Selected labels use dark translucent rounded plates. Neighborhood nodes/edges stay saturated; non-neighbors are visually near 10% opacity. Dashed, glowing paths join selected/highlighted endpoints. Community colors remain intact rather than changing to one selection color. |
| `user-01-overview-labels.png` | Unselected normal overview, with graph centered and substantial empty margin. | Roughly 25-30 clearly legible ordinary labels. Large hubs include `segment`, `share`, `ai`, and `stock`; medium labels include `satellite`, `common`, `purchase`, `financial`, `space`, `class`, `cost`, and `condition`; additional low-priority names are faint. | No backed selection labels. Six colors intermix in depth. Most of the 1,500 edges are extremely faint; a small set of high-weight green ribbons is prominent. Some text still overlaps or occludes, so the design reduces rather than eliminates collisions. |
| `user-02-zoomed-labels.png` | Closer overview than `user-01`, with the graph occupying more of the canvas. | Roughly 30-35 labels are legible or partly legible. `million`, `share`, `segment`, and `ai` dominate; more medium labels resolve (`launch`, `infrastructure`, `business`, `financial`, `result`, `expense`, `loss`, `agreement`), while some rear/low-priority labels remain faint. | No selection pills. Curved colored edges are denser and thicker on screen. Depth and opacity still suppress rear labels, but several central labels overlap, confirming there is no perfect no-overlap guarantee. |

## 3. Measured visual parameters

| Parameter | Observed / measured specification | Evidence quality |
|---|---|---|
| Graph background | WebGL clear color `[0.0667, 0.0667, 0.0667, 1]`, or `#111111`; the surrounding DOM body being white is irrelevant to the captured canvas. The user screenshots include application chrome over a visually similar near-black field. | Direct WebGL read plus pixel histogram. |
| Community palette | Six communities and six repeatable hues: light cyan `~#a6cee3`, blue `~#1f78b4`, light yellow-green `~#b2df8a`, green `~#33a02c`, salmon `~#fb9a99`, red `~#e31a1c`. Screenshot quantization produces close variants such as `#b1de85` and darker translucent reds. Lane (a)'s independently extracted palette matches these six observed slots. | Direct screenshot/color sample; lane (a) cross-check only for exact nominal hex. |
| Community mapping visible in topic state | Infrastructure Scale = light cyan; Growth Metrics = blue; Stock Classes = light yellow-green; Operational Losses = green; Cost Performance = salmon; Market Security = red. | Repeated topic callouts in `01`, `04`, `06`, `07`, and `live-01`. |
| Node / label size range | Ordinary dots range from near-pixel specks to hub circles roughly 4-5 times their diameter at the same framing; square topic marks can be larger still. Label text ranges from near-invisible to dominant hub/topic labels roughly 4-6 times the height of minor readable labels. Runtime example: a node sprite scale was `13.73 x 13.73`; its label sprite was `49.54 x 26.14`. | Direct scene measurement plus screenshot-relative estimate; not a universal min/max. |
| Labels by distance | Extreme out (about 15%): 0 legible. Default: approximately 20-30. Closer overview: approximately 30-35. Extreme single-node fill: 1 visible label because the rest are outside the viewport. Topic callouts survive farther out than ordinary word labels. | Cross-corroborated screenshots and interaction notes. |
| Automatic highlight dimming | Sprite material histogram contained only 1.0 and 0.35: 40 sprites at 1.0 and 8 at 0.35 in one 48-sprite phase. Dots and labels dim together. Attribution is to the automatic topic transition, not proven manual selection. | Direct runtime measurement. |
| Manual multi-selection dimming | Non-neighbors in `user-00` appear approximately 10% as bright/opaque while selected nodes and their neighborhood remain full strength. Lane (a) independently reports a 0.10 non-neighbor value, consistent with the image; the live capture did not directly sample this state. | Screenshot estimate with lane (a) cross-check; not a lane-(b) material read. |
| Edges | Smooth curved 3D connections with strong width variation by relationship. No `Line`, `LineSegments`, or `Points` existed in the scene census, and intercepted draw modes were 1,020 `TRIANGLES` calls with no line primitives: reproduce as triangulated ribbons/tubes, not native GL lines. Edges are normally translucent; screenshot appearance is commonly in the approximate 0.3-0.6 visual-alpha band, but no edge-material alpha was directly isolated. Lane (a) computes about 0.563 global opacity for this edge count and curvature 0.25; those numbers are corroborative, not live measurements. | Geometry/draw mode direct; alpha/curvature numeric values not directly measured in lane (b). |
| Label primitive and facing | Each ordinary label is text rasterized into a canvas texture on a `THREE.Sprite`, paired with its dot sprite. Sprites remain camera-facing as the view rotates (billboarding); no CSS2D or Troika label object was found. | Direct scene census plus rotation observation. |
| Rendering cadence | Zero draw calls during a five-second hidden-tab idle window; camera drags trigger hundreds of draw calls. A true FPS value could not be captured because `requestAnimationFrame` was suspended while the automation tab was hidden. | Direct but environment-limited. |

## 4. Data versus rendered view

### Stored graph

| Quantity | Captured value | Reconciliation |
|---|---:|---|
| Nodes | 150 / 150 captured | Every node includes `key`, `weighedDegree`, `degree`, `bc`, `community`, `x`, `y`, and `z`. The view therefore receives a fully baked 3D embedding in this capture. |
| Edges | 1,500 in the live graph store; 1,497 triples preserved in the file | Three edges (0.2%) were lost during chunk reassembly, not absent from the app. Edges are undirected, non-multi, with self-loops allowed. |
| Communities | 6 | Counts are 17, 23, 11, 17, 18, and 64 for community IDs 0-5. Named topics are Growth Metrics, Stock Classes, Cost Performance, Market Security, Operational Losses, and Infrastructure Scale. |
| Metric ranges | `degree` 47-477; `weighedDegree` 294-3,110; `bc` 0-0.4035103 | `bc` is highly skewed: its mean is only 0.02037. z spans about -137.10 to 125.12. |

### `maxnodes=150` and curation

The baseline URL asks for `maxnodes=150`, and the resulting store contains exactly 150 nodes, so the rendered product is already a curated top-N slice rather than the full source corpus. That coincidence does not prove where or how the ranking occurs. Changing the URL to `maxnodes=50` produced no visible difference in a single approximately four-second screenshot; it was not followed by a store-count measurement. Therefore the safe behavioral contract is: **the reference demonstration presents at most the captured 150-node slice, but this capture does not establish that changing the query parameter re-culls an already cached graph.** [g3d-b-04] [g3d-b-05]

The live scene is more aggressively transient than the store: one probe saw 147 direct per-node groups; a later traversal during automatic highlighting saw only 36 groups and 48 sprites. This supports additional topic/visibility curation, but does not distinguish actual add/remove filtering from transition-time object lifecycle or LOD. It must not be converted into a fixed “24 rendered nodes” rule. [g3d-b-06]

### Which metric drives label prominence?

The strongest observed relationship is with **betweenness centrality (`bc`)**, not raw degree or weighted degree alone:

- The graph's exact `top_nodes` list is the descending-bc order for its first 30 entries, and the default visible-label count is also roughly 20-30.
- `million`, `share`, `segment`, and `ai` are bc ranks 1-4 and repeatedly receive the largest persistent labels.
- `segment` is decisive: it is bc rank 3 and visually one of the largest labels, while its degree is only 163 and weighted degree 915, far below leaders on those measures.
- Conversely, `company` has maximum degree 477 but bc rank 14 and does not dominate the screenshots; `stock` has maximum weighted degree 3,110 but is visually below the top bc hubs.

Thus use `bc` as the primary importance/ranking signal for faithful behavior, with zoom and highlight state modulating visibility. Degree and weighted degree remain correlated network-importance signals and edge weight clearly affects ribbon thickness, but the capture does not support using either as the sole label-size metric. Lane (a) independently identifies `bc`, corroborating this data/image inference. [g3d-b-04] [g3d-b-03] [g3d-b-13]

## 5. Anti-overlap behavior to reproduce

This demo avoids a solid wall of text through a stack of reductions, not through one perfect collision solver:

1. **Curate before rendering.** The demonstrated dataset is capped at 150 stored nodes. A 150-node reference cannot by itself prove behavior at the project's approximately 2,500-node target.
2. **Rank and size by importance.** High-bc gateway nodes receive much larger dots and labels and remain readable; minor nodes become dots, faint text, or neither at overview distance. This creates a small visual hierarchy rather than 150 equal labels.
3. **Use a camera-dependent label budget/fade.** At extreme distance there are zero legible ordinary labels; around default distance there are roughly 20-30; closer framing reveals roughly 30-35. Topic callouts survive farther out. Visibility changes continuously in apparent opacity/scale rather than all labels snapping on at once.
4. **Exploit 3D depth.** A spread of roughly 262 world units in z separates nodes and curved ribbons. Orbiting changes parallax, allowing the viewer to move occluded content apart. Rear or unrelated content is visibly fainter, while sprites keep text facing the camera.
5. **Attenuate context during focus.** Automatic topic highlighting dims sprites to 0.35. Explicit multi-selection is more severe: selected labels gain plates/glows and neighbors remain saturated while unrelated content falls to approximately 0.10, making the selected subgraph readable without deleting context.
6. **Keep edges subordinate.** Most of 1,500 edges are thin and translucent; only high-weight relations become broad ribbons. Curvature and depth split parallel routes that would otherwise stack directly atop one another.

The result is effective decluttering, not strict geometric non-overlap: central text overlaps are plainly visible in both user overview screenshots and `live-01-default.png`. A faithful clean-room implementation should therefore target **priority, attenuation, and recoverability through navigation**, while separately measuring whether a true screen-space collision pass is needed for the project's larger graph target. Lane (a) likewise found an importance/fade budget rather than rectangle collision; that is a useful corroboration, not the basis of the observations above. [g3d-b-03] [g3d-b-13]

## Sources

| id | source | contribution | disposition |
|---|---|---|---|
| `g3d-b-01` | `research/seed/demo/interaction-notes.md` | interaction trials, autonomous zoom-cycle, label bands, definitive z-flatten toggle | `reference` |
| `g3d-b-02` | `research/seed/demo/behavior-notes.md` | independent zoom, edge, topic highlight, palette, and shared-tab observations | `reference` |
| `g3d-b-03` | `assets/screenshots/*.png` | all ten captured visual states, duplicate detection, visible labels/colors/edges | `reference` |
| `g3d-b-04` | `research/seed/demo/spacex_s1.graph.json` | 150 nodes, 1,500 expected edges, six communities, xyz and metric distributions | `reference` |
| `g3d-b-05` | `research/seed/demo/url-param-matrix.md` | one-variable visual checks and limits of `maxnodes`, `dynamic`, and `selected` attribution | `reference` |
| `g3d-b-06` | `research/seed/demo/scene-introspection.json` | THREE census, sprite labels, draw mode, opacity histogram, graph-store shape | `reference` |
| `g3d-b-07` | `research/seed/demo/scene-introspection-selected.json` | 1.0/0.35 sprite sample and selection-attribution caveat | `reference` |
| `g3d-b-08` | `research/seed/demo/webgl-fingerprint.json` | WebGL2 canvas dimensions and renderer fingerprint | `reference` |
| `g3d-b-09` | `research/seed/demo/fps-probe.md` | interaction-driven draw counts and hidden-tab FPS limitation | `reference` |
| `g3d-b-10` | `research/seed/demo/network-requests.json` | live graph endpoint provenance and response-body capture limitation | `reference` |
| `g3d-b-11` | `research/seed/demo/resource-inventory.json` | visible THREE renderer versus loaded inactive/legacy graph libraries | `reference` |
| `g3d-b-12` | `research/seed/demo/graph-app-standalone-notes.md` | same graph UI shell and data-driven postMessage surface | `reference` |
| `g3d-b-13` | `research/bundle-static-analysis.md` | explicitly marked parameter cross-checks only; not used as observational evidence | `reference` |
| `g3d-b-14` | `research/seed/demo/F1-MANIFEST.md` | capture provenance, duplicate files, concurrent-pass anomalies, edge-loss disclosure | `reference` |
| `g3d-b-15` | `research/seed/demo/canvas-capture-attempts.md` | confirms `live-01-default.png` is a non-blank direct WebGL canvas capture | `reference` |
| `g3d-b-16` | `CAPTURE.md` | target URL vocabulary and user-requested visual behaviors | `reference` |

## Unresolved

- Pure hover behavior: tooltip, cursor, halo, neighbor emphasis, and hover leave/reset were not isolated from the automatic cycle.
- Manual click semantics: hit radius, single versus toggle selection, modifier-assisted multi-select, camera recentering, and empty-space clear were not reproducibly captured.
- Node dragging: whether nodes are draggable at all, whether a drag pins coordinates, and whether changes persist across 2D/3D mode.
- Autonomous camera/highlight cycle: responsible query parameter(s), full period, dwell time, easing, topic order, pause/cancel rule, and whether user input suspends it.
- Exact zoom model: camera FOV/near/far, dolly limits, wheel sensitivity, toolbar increment, label thresholds, and whether apparent distance fade contains screen-edge or behind-center penalties.
- Exact manual-selection opacity was not sampled from the live THREE scene. Approximately 0.10 is an image estimate corroborated by lane (a), whereas 0.35 was directly measured only during an attribution-confounded automatic highlight phase.
- Exact edge curve control points, curvature scalar, ribbon tessellation, and material alpha were not measured live. Lane (a)'s 0.25 curvature and approximately 0.563 global opacity remain static-analysis cross-checks.
- Exact community-ID-to-palette-slot assignment beyond the named topic callouts, and whether first-seen order can change it on other datasets.
- `maxnodes` enforcement stage and ranking rule. The baseline returns exactly 150, but the `maxnodes=50` visual trial did not measure the backing store.
- Whether fluctuating scene-group counts reflect topic filtering, LOD/culling, transition cleanup, or all three.
- A foreground-browser FPS/latency measurement; hidden-document `requestAnimationFrame` suspension prevented a valid FPS result.
- Behavior at the project's approximately 2,500-node target. The reference evidence covers only a 150-node store and fewer simultaneously instantiated/legible elements.
