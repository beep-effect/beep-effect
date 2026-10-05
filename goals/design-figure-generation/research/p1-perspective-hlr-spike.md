# P1 spike — true perspective hidden-line removal through replicad in Bun

Date: 2026-10-05. Verdict: **PASS.** Perspective HLR is reachable in-process in
Bun; replicad's public API does not expose it, so the driver wraps a
fifteen-line copy of replicad's own projection recipe with one extra argument.

## Setup (throwaway, outside the repo)

- `~/.cache/beep/spikes/replicad-hlr`, Bun 1.4.2
- `replicad@1.1.0`, `replicad-opencascadejs@1.1.0` (single-threaded WASM,
  loaded with `locateFile` pointing at `dist/replicad_single.wasm`)
- Script: [`p1-spike/spike.ts.txt`](./p1-spike/spike.ts.txt)

## Findings

1. **Public API is axonometric only.** `makeProjectedEdges` /
   `drawProjection` construct `new oc.HLRAlgo_Projector(camera.wrapped)`
   (`replicad.js` `src/projection/makeProjectedEdges.ts`), the no-focus
   overload, so `ProjectionCamera` cannot produce perspective.
2. **The WASM build has the perspective overload.** `replicad_single.d.ts`
   declares `HLRAlgo_Projector(CS: gp_Ax2, Focus: number)` ("Creates a
   perspective projector"). Replicating the recipe with that constructor
   (`HLRBRep_Algo` → `Add` → `Projector` → `Update` → `Hide` →
   `HLRBRep_HLRToShape` → `VCompound` + `Rg1LineVCompound` +
   `OutLineVCompound` → `BRepLib.BuildCurves3d`) works unchanged.
3. **Proof on a synthetic slotted-panel article** (two half-lapped panels +
   a notched top, compound of three solids):

   | Projection | visible edges | distinct line angles |
   | --- | ---: | ---: |
   | axonometric (public API) | 27 | 3 |
   | perspective, focus 400 | 27 | 21 |
   | perspective, focus 150 | 27 | 21 |

   Same edge set, same hidden-line decisions; only the perspective views
   lose their parallel families, which is the vanishing-point signature.
   Rendered proofs: [`axonometric-raw.png`](./p1-spike/axonometric-raw.png),
   [`perspective-f150.png`](./p1-spike/perspective-f150.png),
   [`ortho-front.png`](./p1-spike/ortho-front.png).
4. **Projected edges come back in camera space.** `startPoint`/`endPoint`
   `x,y` are already the 2D drawing coordinates (`z` is depth), so the sheet
   composer can emit segments directly; replicad's private `edgesToDrawing`
   is not needed. Curved edges arrive as curves (`geomType !== "LINE"`) and
   must be discretised or emitted as paths, which the spike did not cover.
5. **Focus semantics.** Smaller focus = stronger convergence; 150 at a
   camera distance of ~320 units looked like a natural design-patent
   perspective for this article; 400 is mild. Make it a figure parameter
   with a default, not a constant.
6. **HLR correctness check passed:** the second panel is hidden under the
   top except where it protrudes; the half-lap slot shows as a notch on
   the visible panel; interior surfaces never appear.

## Consequences for P2

- Kernel decision stands: replicad/opencascade.js in Bun; no build123d
  fallback is needed for perspective figures.
- `ProjectionEngine` owns the perspective recipe (a small driver-level
  function taking `ProjectionCamera` + `focus`), and keeps
  `makeProjectedEdges` for orthographic figures.
- Pin `replicad-opencascadejs` by content hash of `replicad_single.wasm`
  in the reproducibility manifest.
- Not covered by the spike, carried into P2: curved-edge discretisation,
  silhouette (`OutLine`) edges on cylinders, determinism of edge ordering
  across runs (sort before hashing), and the oblique "perspective" fallback
  the brief mentioned (no longer needed).
