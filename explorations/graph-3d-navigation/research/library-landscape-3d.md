# 3D Graph Rendering Library Landscape

**No final stack pick — evidence for the P0 design gate.**

Method note: this lane compares the captured 2026-07-14 library corpus with the live repository manifests and existing Cosmos adapter. “Compatible” means the declared semver range contains the repository's catalog version; it is not a runtime-performance endorsement. “Unknown” means the supplied local corpus does not establish the claim. Bundle and ~2,500-node claims are not inferred from marketing language or uncaptured badge targets. [g3d-d-01] [g3d-d-14] [g3d-d-15]

## 1. Candidate comparison matrix

| Candidate | License | `three` range vs repo `^0.185.1` | React 19 / R3F 9 evidence | Precomputed positions vs simulation ownership | Per-node color / size | Curved links | Labels / SDF-hosting | Hit testing | Data update / streaming | Bundle size | ~2,500-node evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **(i) `3d-force-graph` 1.80.0** | MIT. [g3d-d-02] | Declares `three >=0.179 <1`; `0.185.1` is inside the range, so **no conflict**. [g3d-d-02] [g3d-d-15] | Framework-free package; no React or R3F dependency/compatibility claim. [g3d-d-02] | Owns a `d3-force-3d` or ngraph simulation by default. With d3, nodes can be fixed by `fx/fy/fz`; `cooldownTicks(0)` stops built-in ticks, so precomputed positions are usable. [g3d-d-03] [g3d-d-08] | `nodeColor` and `nodeVal` accessors; custom `nodeThreeObject` is also available. [g3d-d-03] | Explicit 3D Bézier `linkCurvature`, including self-loops. [g3d-d-03] | `nodeLabel` supports text/HTML; `nodeThreeObject` can host a Three `Object3D`, hence a Troika `Text` mesh. Troika is SDF-based and accepts `three >=0.125.0`. [g3d-d-03] [g3d-d-09] [g3d-d-10] | Built-in pointer tracking exposes click/hover callbacks; corpus does not specify its raycast implementation, and warns tracking costs performance. [g3d-d-03] | `graphData` is documented for incremental updates; `refresh` redraws. Sparse complexity for in-place `changedNodeIds` is not documented. [g3d-d-03] | **Unknown**: corpus contains a Bundlephobia badge/link but no captured numeric result. [g3d-d-03] | **None in corpus**; pointer tracking has an explicit performance cost, but no 2.5k benchmark is supplied. [g3d-d-03] |
| **(ii) `react-force-graph-3d` via `react-force-graph` 1.48.2** | MIT. [g3d-d-04] | No direct `three` declaration; depends on `3d-force-graph ^1.79`, whose captured 1.80.0 range accepts `0.185.1`. **No conflict**, subject to one deduped workspace instance. [g3d-d-04] [g3d-d-02] [g3d-d-15] | Peer is `react: *`, and its dev types are React 19, so React 19 is range-compatible; it does not use R3F and the corpus gives no React-19 runtime test. [g3d-d-04] | Same underlying force ownership: d3/ngraph by default; d3 `fx/fy/fz` plus `cooldownTicks={0}` freezes precomputed coordinates. [g3d-d-05] [g3d-d-08] | `nodeColor` and `nodeVal` props; `nodeThreeObject` for custom Three objects. [g3d-d-05] | Explicit `linkCurvature` in 3D. [g3d-d-05] | `nodeLabel` plus `nodeThreeObject`; the latter can host Troika SDF text. [g3d-d-05] [g3d-d-09] | Built-in click/hover props and pointer tracker; exact raycast mechanics are not stated, and pointer tracking is documented as a performance cost. [g3d-d-05] | `graphData` prop supports incremental updates and `refresh` redraws, but no sparse `changedNodeIds` contract is documented. [g3d-d-05] | **Unknown**: only an uncaptured Bundlephobia badge/link is present. [g3d-d-05] | **None in corpus**; no 2.5k measurement. [g3d-d-05] |
| **(iii) `three-forcegraph` 1.43.4** | MIT. [g3d-d-06] | Peer `three >=0.118.3`; `0.185.1` satisfies it, so **no conflict**. [g3d-d-06] [g3d-d-15] | Framework-free Three `Object3D`; no React/R3F compatibility claim is needed or supplied. [g3d-d-06] [g3d-d-07] | Owns d3/ngraph layout, but the host owns the render loop through `tickFrame`. d3 `fx/fy/fz` and `cooldownTicks(0)` permit fixed precomputed positions. [g3d-d-07] [g3d-d-08] | `nodeColor`, `nodeVal`, and `nodeThreeObject`. [g3d-d-07] | Explicit 3D Bézier `linkCurvature`. [g3d-d-07] | No built-in label accessor in the captured API; `nodeThreeObject` can carry a Troika `Text` mesh. [g3d-d-07] [g3d-d-09] | No interaction API in the captured lower-level object; the host renderer must own raycasting/selection. [g3d-d-07] | `graphData` documents incremental updates; host calls `tickFrame`/`refresh`. Sparse complexity is unspecified. [g3d-d-07] | **Unknown**: package metadata records dist entrypoints, not numeric min/gzip size. [g3d-d-06] | **None in corpus**; no 2.5k benchmark. [g3d-d-07] |
| **(iv) Custom instanced Three.js** | Three.js is MIT; licensing of new repo-owned adapter code is a separate repo decision. [g3d-d-15] | Uses the catalog's single `three ^0.185.1` directly: **no conflict**. [g3d-d-14] [g3d-d-15] | React/R3F-independent if implemented as an imperative driver; no compatibility layer is required. [g3d-d-17] [g3d-d-19] | Renderer owns no simulation unless one is deliberately added; it can upload projection XYZ directly to instance matrices/buffers. Current projection is typed-array based, though only XY today. [g3d-d-17] | Implementation-owned per-instance matrix/color/scale. No ready-made graph accessor API. [g3d-d-15] [g3d-d-17] | Implementation-owned curve geometry/shader; no graph-specific curved-link feature comes from Three's package metadata. [g3d-d-15] | Can add Troika SDF meshes (`three >=0.125.0`), but label LOD/culling/batching are implementation work. [g3d-d-09] [g3d-d-10] | Implementation owns a Three raycast or GPU-picking path and ID-to-instance mapping. [g3d-d-15] [g3d-d-17] | Can map node ID → instance slot and mutate only changed matrices/colors; topology changes still require explicit buffer-capacity/index policy. Current Cosmos handle receives only full projections. [g3d-d-16] [g3d-d-17] | **Unknown until built**; depends on imported Three modules, shaders, controls, and label stack. [g3d-d-14] [g3d-d-15] | **None in corpus**; this is the architecture with the most direct control but requires a repo benchmark. [g3d-d-15] |
| **(v) R3F 9 + drei** | R3F and drei are MIT; drei's Troika dependency is MIT. [g3d-d-11] [g3d-d-12] [g3d-d-09] | Repo catalogs R3F `^9.6.1`, drei `^10.7.7`, Three `^0.185.1`; captured drei peers accept R3F `^9`, React 19, and Three `>=0.159`. **No conflict**. [g3d-d-12] [g3d-d-14] | Explicit peers: drei requires React/ReactDOM `^19` and R3F `^9`; the repo already renders an R3F `Canvas` using drei and Three in `orb.tsx`. [g3d-d-12] [g3d-d-18] | Declarative renderer owns no graph simulation by default; projection positions can be rendered directly. A simulation must be composed separately. [g3d-d-11] [g3d-d-13] | Three material/geometry props plus drei `Instances`/`Points`; per-instance data plumbing is implementation-owned. [g3d-d-11] [g3d-d-13] | drei lists line, quadratic/cubic Bézier, and Catmull-Rom helpers. [g3d-d-13] | drei lists `Text` and `Billboard`, and depends on Troika; suitable SDF host surface. [g3d-d-12] [g3d-d-13] | R3F exposes `onClick`/pointer events on meshes; per-instance selection strategy still needs design. [g3d-d-11] | React prop reconciliation is the default; for sparse hot-path updates, retain instanced refs and mutate only slots named by change hints, then invalidate/render. The corpus does not quantify this path. [g3d-d-11] [g3d-d-18] | **Unknown**: no captured numeric bundle result for the composed stack. [g3d-d-11] [g3d-d-12] | **None in corpus**; drei catalogs performance helpers but supplies no 2.5k measurement here. [g3d-d-13] |
| **(vi) `reagraph` 4.32.0** | Apache-2.0, a permissive port-with-attribution license. [g3d-d-20] | Direct dependency `three ^0.184.0`, which includes `0.185.1`; **no conflict**. It also aligns with repo R3F `^9.6.1` and drei `^10.7.7`. [g3d-d-20] [g3d-d-14] | React/ReactDOM peers are `>=16`; dependencies require R3F `^9.6.1` and drei `^10.7.7`; dev dependencies use React 19.2.7. This is strong manifest evidence, not a repo runtime test. [g3d-d-20] | Includes force-directed 3D layouts and depends on `d3-force-3d`; the supplied README does **not** document a fixed/precomputed-position API or `cooldownTicks: 0`, so ownership override is **unknown**. [g3d-d-20] [g3d-d-21] | README claims attribute/page-rank/centrality/custom sizing and customizable nodes; exact per-node color/size prop signatures are absent from corpus. [g3d-d-21] | README claims edge interpolation/styling, but does not establish arbitrary 3D curved-link or self-loop behavior. **Unknown.** [g3d-d-21] | Advanced label placement is claimed; custom Troika/SDF label injection is not documented. **Unknown.** [g3d-d-21] | Selection, dragging, lasso, and highlight hooks are features; exact raycast/picking path is undocumented. [g3d-d-21] | Captured usage replaces `nodes`/`edges` props; no sparse delta API is documented. Treat `changedNodeIds` handling as **unknown** pending source/API validation. [g3d-d-21] | **Unknown**: no numeric bundle size in supplied package/README. Its manifest shows a materially broad dependency set, but that is not a byte count. [g3d-d-20] | README says “high-performance” WebGL, but gives no node-count/FPS protocol; **no 2.5k evidence**. [g3d-d-21] |

Cross-candidate gate: none of the captured sources supplies a controlled ~2,500-node benchmark, numeric bundle measurement, or memory profile. Those must be measured in the professional-desktop/WebKitGTK target before P0 can treat performance as established. [g3d-d-01] [g3d-d-19]

License verification: the three vasturiano renderer candidates and their `d3-force-3d` engine are MIT; Three.js, R3F, drei, and Troika are MIT; Reagraph is Apache-2.0. Thus every evaluated third-party stack is permissive and is recorded here as port-with-attribution material; this does not replace preserving the applicable notices. [g3d-d-02] [g3d-d-04] [g3d-d-06] [g3d-d-09] [g3d-d-11] [g3d-d-12] [g3d-d-15] [g3d-d-20] [g3d-d-27]

## 2. Three.js version reconciliation

The repository's canonical versions are Three `^0.185.1`, R3F `^9.6.1`, and drei `^10.7.7`; the shared UI package consumes all three through the root catalog. `orb.tsx` imports all three surfaces in one component, providing a live checkout precedent for that exact catalog stack. [g3d-d-14] [g3d-d-18] [g3d-d-24] The professional desktop likewise obtains React `19.2.7`, ReactDOM `19.2.7`, Effect `4.0.0-beta.97`, `@effect/atom-react 4.0.0-beta.97`, and Vite `^8.1.4` from that catalog; the existing Cosmos driver catalogs `@cosmos.gl/graph 3.3.0`, Sigma `3.0.3`, and Graphology `0.26.0`. [g3d-d-14] [g3d-d-25] [g3d-d-26] A single resolved Three instance is a hard design constraint for this gate; the status below therefore assumes workspace deduplication is verified after installation.

| Candidate | Requested Three version | Collision with `^0.185.1`? | Required resolution |
|---|---|---|---|
| `3d-force-graph` 1.80.0 | Direct dependency `>=0.179 <1`; transitive `three-forcegraph` accepts `>=0.118.3`. [g3d-d-02] [g3d-d-06] | No; `0.185.1` is in both ranges. [g3d-d-15] | **Works as-is**, but verify the lockfile resolves one workspace Three instance. [g3d-d-02] [g3d-d-14] |
| `react-force-graph-3d` | No direct Three entry; `3d-force-graph ^1.79` supplies the range above. [g3d-d-04] [g3d-d-02] | No for captured compatible 1.x resolution. [g3d-d-02] [g3d-d-15] | **Works as-is**; pin/lock the compatible `3d-force-graph` resolution and verify dedupe. No override is justified by current ranges. [g3d-d-04] |
| `three-forcegraph` | Peer `>=0.118.3`. [g3d-d-06] | No. [g3d-d-15] | **Works as-is** with catalog Three supplied as the peer. [g3d-d-06] [g3d-d-14] |
| Custom instanced Three | Repository catalog `^0.185.1`. [g3d-d-14] | No. | **Works as-is**; depend on catalog Three only. [g3d-d-14] |
| R3F + drei | Repo R3F `^9.6.1`, drei `^10.7.7`, Three `^0.185.1`; captured drei accepts Three `>=0.159`. [g3d-d-12] [g3d-d-14] | No. | **Works as-is**; existing `orb.tsx` is the precedent. [g3d-d-18] |
| Reagraph | Direct `three ^0.184.0`; R3F `^9.6.1`; drei `^10.7.7`. [g3d-d-20] | No: `^0.184.0` admits `0.185.1`, and the React-Three dependencies align exactly with the catalog major/minor floor. [g3d-d-14] [g3d-d-20] | **Works as-is**, conditional on lockfile dedupe to one Three. A workspace override is only needed if installation actually produces a second instance; current semver does not require one. [g3d-d-14] [g3d-d-20] |

No candidate is disqualified by the captured Three ranges. Any install that produces two Three copies fails the gate despite nominal semver compatibility; resolve that concrete lockfile state by dedupe/override or disqualify the candidate. [g3d-d-02] [g3d-d-06] [g3d-d-12] [g3d-d-14] [g3d-d-20]

## 3. Candidate architectures against `Graph3DRenderHandle`

Target shape, deliberately mirroring Cosmos:

```ts
renderGraph3D(container, projection) -> Graph3DRenderHandle {
  destroy(): void
  fps(): number
  update(projection, changedNodeIds?): void
  select(nodeId | undefined): void
}
```

The current precedent is `renderCosmosGraph(container, projection)`, returning a handle with `backend`, `destroy`, `fps`, and full-projection `update`; the ontology client bridge owns mount/update/finalization. The current projection is typed arrays for node IDs, XY positions, link pairs, and optional labels. [g3d-d-16] [g3d-d-17] [g3d-d-22]

### A. Wrapper-driver

Place a browser-safe adapter in `packages/drivers/graph-3d`, wrapping vanilla `3d-force-graph` (or, at higher React integration cost, mounting `react-force-graph-3d` internally). The ontology client bridge maps its projection to graph objects, mounts once, calls `update`, forwards click/hover to `select`, samples FPS, and destroys the renderer in its atom finalizer—matching the existing Cosmos lifecycle. Client packages may import browser-safe driver subpaths, while UI packages may not import drivers. [g3d-d-03] [g3d-d-05] [g3d-d-19] [g3d-d-22]

- **Buys:** graph-specific camera controls, selection callbacks, fixed-position force inputs, curved links, labels/custom `Object3D`s, and documented incremental `graphData` behind a small repo-owned contract. [g3d-d-03] [g3d-d-05]
- **Costs:** converts typed arrays into object graphs; library owns substantial scene/simulation behavior; sparse-update complexity and 2.5k behavior remain unproven. [g3d-d-03] [g3d-d-17]
- **Integration effort:** **M** for vanilla `3d-force-graph`; **L** if the imperative driver must privately mount/unmount a React root for `react-force-graph-3d`. [g3d-d-02] [g3d-d-04] [g3d-d-16]
- **Main risk:** wrapper convenience may conceal per-node object/draw-call and pointer-picking costs at the target scale; no corpus benchmark closes that risk. [g3d-d-03]

### B. Custom-instanced driver

Build `packages/drivers/graph-3d` directly on catalog Three: one instanced node mesh (or points shader), batched/instanced links, explicit camera/controls, ID-to-slot indexes, Troika label LOD, and a picking strategy. `renderGraph3D` owns renderer resources and exposes the same imperative lifecycle as Cosmos. [g3d-d-09] [g3d-d-14] [g3d-d-16] [g3d-d-17]

- **Buys:** direct typed-array ingestion, deterministic external positions, sparse slot mutation, explicit draw-call/memory budgets, and complete control of selection/LOD. [g3d-d-17]
- **Costs:** must implement camera controls, curves, labels, picking, resize/context-loss handling, disposal, accessibility bridge, and all performance instrumentation. [g3d-d-09] [g3d-d-15] [g3d-d-16]
- **Integration effort:** **L**. The lifecycle contract is familiar, but nearly the entire graph renderer is new. [g3d-d-16]
- **Main risk:** engineering and correctness surface—especially picking, curved-link batching, label culling, and GPU resource lifecycle—moves into repo ownership. [g3d-d-09] [g3d-d-15]

### C. R3F-in-ui-system

Add a declarative component under `@beep/ui`, following the existing `orb.tsx` `Canvas`/`useFrame`/drei pattern. The ontology UI consumes driver-neutral props/state from the ontology client. This is not an imperative driver import: architecture permits client/UI consumption of `foundation/ui-system`, but UI packages do not import concrete drivers. [g3d-d-18] [g3d-d-19]

Its public React ref can mirror `Graph3DRenderHandle` (`destroy` becomes React unmount cleanup; `fps`, `update`, and `select` become ref methods), or the contract can be represented as props plus callbacks. Either way, the consumption path differs from the Cosmos bridge because React owns mount/unmount. [g3d-d-11] [g3d-d-18] [g3d-d-22]

- **Buys:** exact alignment with the installed React 19/R3F 9/drei/Three stack, reusable `Instances`, curve helpers, SDF `Text`, `Billboard`, and mesh pointer events; established repo component precedent. [g3d-d-11] [g3d-d-12] [g3d-d-13] [g3d-d-18]
- **Costs:** graph algorithms, instance-slot bookkeeping, sparse imperative mutation, and the client-to-component state boundary are custom; React reconciliation must stay off the 2.5k-node hot path. [g3d-d-11] [g3d-d-13]
- **Integration effort:** **M/L**: less renderer plumbing than B, more graph-specific design than A, plus a different mount contract. [g3d-d-13] [g3d-d-18]
- **Main risk:** a naïve one-component-per-node design or full prop-array replacement can erase instancing benefits; the corpus has no target-scale proof. [g3d-d-13]

## 4. Streaming and projection-delta handling

Current constraint: `OntologyGraphProjection` carries `changedNodeIds`/`changedEdgeIds`, but `cosmosProjectionFromOntology` omits both. `CosmosRenderHandle.update` therefore accepts a complete `CosmosGraphProjection`; the Cosmos backend replaces full point/link buffers and rebuilds labels, while Sigma clears and repopulates its graph. Sparse rendering requires extending the new 3D projection/handle boundary rather than pretending the current Cosmos contract already carries deltas. [g3d-d-16] [g3d-d-17] [g3d-d-22] [g3d-d-23]

| Candidate | Delta path for `changedNodeIds` | Avoids full rebuild? | Required adapter policy |
|---|---|---|---|
| `3d-force-graph` | Keep stable node objects keyed by ID; mutate `x/y/z` and `fx/fy/fz` for changed nodes, then use the documented incremental `graphData`/`refresh` path. [g3d-d-03] [g3d-d-08] | **Potentially**, but internal work per `graphData` call is undocumented. | Benchmark same-array/object mutation versus array replacement; topology changes may still need full graph-data submission. [g3d-d-03] |
| `react-force-graph-3d` | Memoize stable node/link objects and submit changed props through `graphData`; use the imperative `refresh` method when mutation is intentionally out-of-React. [g3d-d-05] | **Potentially**, not proven sparse internally. | Prevent React from recreating all objects; validate that ref/prop updates do not reheat or rebuild unexpectedly. [g3d-d-05] |
| `three-forcegraph` | Stable ID-keyed objects, mutate changed fixed coordinates, then `refresh`; host already controls `tickFrame`. [g3d-d-07] [g3d-d-08] | **Potentially**; internal mapper complexity is unspecified. | Keep topology and coordinate updates separate; measure `refresh` cost at 2.5k. [g3d-d-07] |
| Custom instanced Three | Maintain `nodeId -> instanceIndex`; update only changed matrices/colors and mark only affected GPU attributes/ranges dirty. [g3d-d-15] [g3d-d-17] | **Yes by design** for attribute/position changes. | Define add/remove compaction, buffer growth, edge adjacency invalidation, and changed-edge semantics; current `changedEdgeIds` evidence is incomplete. [g3d-d-23] |
| R3F + drei | Maintain stable instanced refs and ID-slot map; mutate changed instances imperatively, then invalidate/request a frame. Avoid rebuilding 2,500 JSX children. [g3d-d-11] [g3d-d-13] [g3d-d-18] | **Yes by design** if the hot path is ref-based; unknown if implemented as prop-array reconciliation. | Expose a narrow ref/store command from client state to the component and keep structural changes on a slower declarative path. [g3d-d-19] [g3d-d-22] |
| Reagraph | Captured API shows `nodes`/`edges` props only; no sparse mutation/ref API is documented. [g3d-d-21] | **Unknown**; assume full array replacement until source/API proof says otherwise. | Source-audit its stores/reconciliation or prototype with profiler before accepting it for frequent deltas. [g3d-d-20] [g3d-d-21] |

For all three architectures, `select(nodeId)` should be independent of projection replacement: A forwards selection to library styling/accessors, while B/C update the selected instance/material state through the ID-slot map. This is an architectural sketch, not a measured claim. [g3d-d-03] [g3d-d-11] [g3d-d-17]

## Sources

| id | local path | disposition |
|---|---|---|
| `g3d-d-01` | `explorations/graph-3d-navigation/research/seed/web/libraries/corpus-index.md` | reference |
| `g3d-d-02` | `explorations/graph-3d-navigation/research/seed/web/libraries/3d-force-graph-package.json.md` | port-with-attribution |
| `g3d-d-03` | `explorations/graph-3d-navigation/research/seed/web/libraries/3d-force-graph-readme.md` | reference |
| `g3d-d-04` | `explorations/graph-3d-navigation/research/seed/web/libraries/react-force-graph-package.json.md` | port-with-attribution |
| `g3d-d-05` | `explorations/graph-3d-navigation/research/seed/web/libraries/react-force-graph-readme.md` | reference |
| `g3d-d-06` | `explorations/graph-3d-navigation/research/seed/web/libraries/three-forcegraph-package.json.md` | port-with-attribution |
| `g3d-d-07` | `explorations/graph-3d-navigation/research/seed/web/libraries/three-forcegraph-readme.md` | reference |
| `g3d-d-08` | `explorations/graph-3d-navigation/research/seed/web/libraries/d3-force-3d-readme.md` | reference |
| `g3d-d-09` | `explorations/graph-3d-navigation/research/seed/web/libraries/troika-three-text-package.json.md` | port-with-attribution |
| `g3d-d-10` | `explorations/graph-3d-navigation/research/seed/web/libraries/troika-three-text-readme.md` | reference |
| `g3d-d-11` | `explorations/graph-3d-navigation/research/seed/web/libraries/react-three-fiber-readme.md` | reference |
| `g3d-d-12` | `explorations/graph-3d-navigation/research/seed/web/libraries/drei-package.json.md` | port-with-attribution |
| `g3d-d-13` | `explorations/graph-3d-navigation/research/seed/web/libraries/drei-readme.md` | reference |
| `g3d-d-14` | `package.json` | reference |
| `g3d-d-15` | `explorations/graph-3d-navigation/research/seed/web/libraries/threejs-package.json.md` | port-with-attribution |
| `g3d-d-16` | `packages/drivers/cosmos/src/Cosmos.renderer.ts` | reference |
| `g3d-d-17` | `packages/drivers/cosmos/src/Cosmos.projection.ts` | reference |
| `g3d-d-18` | `packages/foundation/ui-system/ui/src/components/orb.tsx` | reference |
| `g3d-d-19` | `standards/ARCHITECTURE.md` | reference |
| `g3d-d-20` | `explorations/graph-3d-navigation/research/seed/web/libraries/reagraph-package.json.md` | port-with-attribution |
| `g3d-d-21` | `explorations/graph-3d-navigation/research/seed/web/libraries/reagraph-readme.md` | reference |
| `g3d-d-22` | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts` | reference |
| `g3d-d-23` | `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts` | reference |
| `g3d-d-24` | `packages/foundation/ui-system/ui/package.json` | reference |
| `g3d-d-25` | `apps/professional-desktop/package.json` | reference |
| `g3d-d-26` | `packages/drivers/cosmos/package.json` | reference |
| `g3d-d-27` | `explorations/graph-3d-navigation/research/seed/web/libraries/d3-force-3d-package.json.md` | port-with-attribution |

## Unresolved

- Numeric minified/gzip bundle sizes for all six candidate stacks; the corpus captures badge URLs or package manifests, not results. [g3d-d-02] [g3d-d-04] [g3d-d-06] [g3d-d-11] [g3d-d-12] [g3d-d-20]
- Controlled professional-desktop/WebKitGTK measurements at ~2,500 nodes: FPS distribution, interaction latency, mount/update time, GPU/JS memory, label counts, and pointer-picking cost. No supplied candidate source provides this protocol/result. [g3d-d-01] [g3d-d-25]
- Lockfile proof that each installed candidate resolves exactly one physical `three` instance. Declared ranges are compatible, but no candidate was installed in this lane. [g3d-d-14]
- Runtime React 19 proof for `react-force-graph-3d`; `react: *` and React 19 dev types are manifest evidence only. [g3d-d-04]
- Reagraph fixed/precomputed-position control, arbitrary 3D curved links/self-loops, Troika/SDF label injection, picking implementation, and sparse-update API; none is documented in the supplied README/package capture. [g3d-d-20] [g3d-d-21]
- Internal sparse-update complexity of the vasturiano `graphData` path. “Incremental updates” is documented, but an O(changed-nodes) guarantee is not. [g3d-d-03] [g3d-d-05] [g3d-d-07]
- The new 3D projection's XYZ layout, node/edge add-remove semantics, `changedEdgeIds` contract, selection callback ownership, and label LOD budget. The current Cosmos projection is XY and drops ontology change hints. [g3d-d-17] [g3d-d-22] [g3d-d-23]
- Whether architecture C exposes an imperative ref matching `Graph3DRenderHandle` or uses props/callbacks only; React owns lifecycle either way, so P0 must choose the public boundary. [g3d-d-11] [g3d-d-18] [g3d-d-19]
