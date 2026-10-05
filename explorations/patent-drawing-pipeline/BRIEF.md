# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

A partner asks for a design-patent figure set (eight named views, one per
sheet) from photos, a sketch sheet, and a description. Today that is a
vendor order or hand illustration; nothing in the repo can produce it, and
agentic-cad deliberately stopped short of generation and 1.152 shading. In a
design patent the drawings are the claim: views must agree with each other,
shading must be present at filing, and post-filing fixes can be new matter.
AI image generators cannot prove view consistency; one parametric solid
projected eight times proves it by construction. We want that as a
repeatable `beep` feature, not a one-off.

## Appetite

Two slices, each a bounded lane:

- **Slice 1 (≈ 1–2 weeks of lane time):** spec → solid → eight unshaded
  hidden-line views → compliant Letter sheets → validator → attorney review
  for the live matter. Gated by a one-day perspective-HLR spike.
- **Slice 2 (≈ 1 week):** procedural shading + vision-judge rubric +
  sign-off event. Vendor shading-only pass remains the filing fallback.

Anything that threatens those bounds (fold features, photogrammetry, email
intake, desktop packaging) is cut, not stretched.

## Solution Sketch

```
spec.json (corpus root)            repo: synthetic fixture spec
  Matter + ModelSpec + Figures[]         │
        │ decode (LiteralKit view domain; 1:1 FIG↔description invariant)
        ▼
GeometryEngine   replicad/opencascade.js WASM in Bun  (build123d pixi fallback)
        │ compound of panel solids, tabs as rotated solids
        ▼
ProjectionEngine OCCT HLR per figure camera → visible edges (hidden dropped)
        │
ShadingEngine    (slice 2) seeded face hatching through the same HLR
        │
SheetComposer    Letter/A4 template with the sight as a hard clip, outlined
                 "FIG. n" + "n/N", pure-black fixed-width strokes → SVG → PDF
        │ rsvg-convert / qpdf as drivers (effect/process)
        ▼
DrawingSheetValidator  structural tier (MediaBox, PDF≤1.6, fonts) +
                       raster tier (300/600 dpi ink bbox vs. margins, B/W only)
        │ typed findings; exit 0 / 2 / other
        ▼
beep qa judge (drawing rubric) → attorney sign-off event (sheet-set hash)
manifest.json: spec hash, toolchain hashes, per-figure hashes, PDF hash,
validator report
```

Operator surface: `bun run beep drawings render --spec <path> --out <dir>`,
`… validate <pdf>`, `… judge <dir>`, `… sign <dir> --by <attorney> --confirmation <message-id|path>` (the confirmation artifact must contain the verbatim approval line for the sheet-set hash; `--by` is metadata).

## Rabbit Holes

- Perspective HLR through replicad's public API is unverified → spike first.
- No code-first kernel has a sheet-metal fold; tabs are rotated solids,
  score lines are grooves or added edges. Do not build a fold feature.
- Procedural shading may read as mechanical → vendor fallback, not
  iteration past the appetite.
- Byte-identical reruns need outlined text, rounded/sorted coordinates,
  stripped PDF dates, seeded jitter, pinned WASM hash and pixi lock.
- MuPDF.js is AGPL → external `pdftoppm`/`mutool` or pdfjs-dist only.
- Patent Center can blank a "valid" PDF → the raster tier is not optional.
- The written description and sketch disagree on a base-geometry detail →
  resolve against the physical article before modelling.
- Collapsed-state / tabs-up figures risk restriction (MPEP 1504.05) →
  attorney's call; the pipeline just makes each option cheap to render.

## No-Gos

- No image-model figure generation (diffusion, image-to-3D, tracing).
- No photos→CAD on-ramp, no email intake, no desktop-app surface (deferred
  to agentic-cad P6/P7 and a later packet).
- No real article geometry, photos, or renders in the repo.
- No utility-patent numeral grammar (agentic-cad P5 owns it).
- No replacing the illustrator for freeform/organic articles.
