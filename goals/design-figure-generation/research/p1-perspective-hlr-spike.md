# P1 result: perspective hidden-line removal through replicad / opencascade.js

Date: 2026-10-05. Throwaway script, run out of repo in a disposable Bun
install (`replicad@1.1.0`, `replicad-opencascadejs@1.1.0`, Bun 1.4.2). The
subject was a 40 × 30 × 20 box fused with an off-centre triangular wedge, so
no two principal views coincide.

## Verdict

**Perspective HLR works in-process. No build123d fallback is needed for the
perspective figures.** The route is fixed as: replicad builds the solid;
the driver calls the opencascade.js HLR bindings directly with its own
camera.

## What was measured

| Question | Result |
| --- | --- |
| Does replicad's public API project in perspective? | No. `makeProjectedEdges` and `drawProjection` construct `HLRAlgo_Projector(gp_Ax2)`, the axonometric constructor. `ProjectionCamera` has no focal length. |
| Do the bundled bindings expose the perspective constructor? | Yes. `replicad-opencascadejs` binds `HLRAlgo_Projector(CS: gp_Ax2, Focus: number)`; `Perspective()` returns `true` on the result. |
| Does `HLRBRep_Algo` + `HLRBRep_HLRToShape` give correct visible edges under it? | Yes. 15 visible / 3 hidden edges for the fixture at three focal lengths, the same counts as the axonometric view from the same eye; parallel model edges converge, more strongly as the focus shortens. Checked by rasterising the SVGs and reading them. |
| Cost | WASM init about 90 ms; each HLR pass 1–4 ms on this article class. |
| Determinism | Two consecutive runs produced identical SVG hashes for all eight projections (coordinates rounded to 3 decimals, segments direction-normalised and sorted). |

Camera convention (OCCT): the `gp_Ax2` origin is the view-plane point, its
main direction points from the target toward the eye, and with a focus the
eye sits `Focus` model units along that direction. A focus equal to the
eye-to-target distance reproduces a pinhole camera at the eye.

## Consequences for slice 1

- `ProjectionEngine` takes an explicit camera value (eye direction, up
  vector, optional focus) and builds the `gp_Ax2` itself. The driver does
  not use replicad's `lookFromPlane` or `ProjectionCamera` setters:
  `lookFromPlane("top")` returned the **bottom** view of the fixture (its
  SVG hash equals an explicit `-Z` camera), and `setXAxis` writes the Y
  direction. A view-name table owned by the domain plus an asymmetric
  fixture test is the guard.
- `replicad-opencascadejs` (LGPL-2.1-only) is imported from its package
  root and linked, never vendored. Its single-thread WASM is pinned by
  SHA-256 `4c9f22e9f3828dca6f3c95405934cdbe624e593c35266f47f392ab337478dbde`
  for 1.1.0; the render manifest records the hash it loaded.
- Edge output of `HLRBRep_HLRToShape` is already in view-plane coordinates
  (z = 0), in model units. Straight edges sample to one segment; the sheet
  composer owns scale and placement.
- The build123d fallback stays a contract-level option only. It is not
  wired, and no Python toolchain enters the repo for slice 1.

## Not covered

Curved surfaces (silhouette edges come from `OutLineVCompound`, included
but not exercised by a planar fixture), compounds of separate solids, and
performance on large assemblies.
