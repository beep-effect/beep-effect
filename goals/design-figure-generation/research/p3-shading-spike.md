# P3 spike: procedural straight-line shading through the same HLR pass

Date: 2026-10-06. Throwaway script, out of repo, `replicad@1.1.0` /
`replicad-opencascadejs@1.1.0`, same synthetic box-and-wedge fixture as P1 plus a
separate post placed in front of it.

## Verdict

**The decision-log route works.** Hatch lines built on the model's own faces and
projected in the same `HLRBRep_Algo` pass as the solid are hidden exactly where the solid
hides them; no 2D clipping is needed.

## Method

1. For each planar face (`geomType === "PLANE"`) whose outward normal faces the camera
   (`n · eye > 0`), compute exposure `e = n · L`, with `L` the 1.84(m) light expressed in
   the camera frame: upper left, toward the viewer, 45° (`normalize(-right + up + eye)`).
2. Faces with `e` above a lit threshold get no shading; the rest get parallel lines whose
   pitch grows with `e` (darker face, denser lines).
3. Lines run along the face's longest straight edge. Each line is the
   `BRepAlgoAPI_Section` of the face with a plane through the face, so lines end
   exactly at the face boundary, holes and cut-outs included.
4. A half-pitch phase offset keeps lines off the face's own boundary edges (without it a
   hatch line lands on the outline and doubles it).
5. The hatch edges go into the HLR algorithm as their own shape next to the solid;
   `HLRBRep_HLRToShape.VCompound(hatch)` returns only the visible hatch pieces.

## Measured

| Case | Hatch edges in | Visible pieces out | Hidden pieces |
| --- | --- | --- | --- |
| Hatch alone (no solid in HLR) | 40 | 40 | 0 |
| With the solid and the separate post | 40 | 50 | 12 |

Visible pieces exceed the input because the post splits lines in two. Rasterised and read:
lines stop at the post's silhouette and resume beyond it.

## Consequences for slice 2

- Pitch is a paper quantity. The renderer computes the common sheet scale from the
  unshaded outlines first, converts the pitch range from mm to model units, then projects
  the shading. Shading never changes the view extents, so the scale is stable.
- Shading lines are a separate, thinner layer on the sheet; stipple is not generated, so
  the never-both-on-one-face rule holds by construction.
- Curved faces (cylinder walls) are not shaded in this pass; the decision log scopes the
  generator to planar faces.
- `makeCompound` disposes the shapes it is given: iterate the compound's faces, never the
  inputs (same gotcha as `@beep/occt`'s summary).
