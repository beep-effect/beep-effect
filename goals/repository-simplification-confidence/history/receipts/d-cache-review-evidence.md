---
"@beep/occt": minor
"@beep/pdf-tools": minor
"@beep/technical-drawing": minor
---

Add the design-figure generation slice 1 packages. `@beep/occt` builds solids from a flat
primitive spec over replicad / opencascade.js and projects canonical visible and hidden
segments with exact hidden-line removal, orthographic or perspective. `@beep/pdf-tools` wraps
`rsvg-convert` and poppler's `pdftoppm` behind `effect/process`, merges pages with pdf-lib at a
fixed PDF version and creation date, inspects structure, and measures non-anti-aliased page
rasters. `@beep/technical-drawing` owns the view domain, 37 CFR 1.84 sheet composition with
stroke lettering, the filing validator rules, omission proofs, and the render manifest behind a
geometry-engine port and a PDF-backend port; `beep drawings render` / `validate` serve them.
`render --shade` adds 37 CFR 1.152 straight-line shading: planar faces are hatched by exposure to
the 1.84(m) light, the hatch is hidden by the same projection pass as the outlines, and faces
seen square-on stay unshaded. `drawings statement` and `drawings sign email|pdf` record an approval keyed to
the sheet-set hash only from an approver-authored artifact carrying the verbatim statement line;
`@beep/pdf-tools` gains `pageText` for the initialed page.
