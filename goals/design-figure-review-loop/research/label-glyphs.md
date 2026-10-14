# Label glyph outlines (P2, PR-C)

Recipe and provenance for the vendored label glyph data in
`packages/foundation/capability/technical-drawing/src/internal/LabelGlyphs.ts`. Review items F2
(sheet number, Arial 18 pt) and F3 (FIG label, Times New Roman 24 pt).

## What is vendored

Two faces, `sans` and `serif`, each with the sheet-label alphabet only: `0`-`9`, `F`, `I`, `G`,
`.`, `/` and the space. Per face: `unitsPerEm`, `capHeight` (OS/2 `sCapHeight`), and per glyph the
advance width, the exact ink box (curve extrema, not control points) and the outline as `M`/`L`/`Q`/`Z`
commands in font units, y up. The composer fills the outlines as one `label-outlines` path, so
sheet PDFs stay font-free.

| Face | Source file | Version | sha256 | unitsPerEm | capHeight |
|------|-------------|---------|--------|-----------:|----------:|
| `sans` | `LiberationSans-Regular.ttf` | 2.1.5 | `baccc64becc3eb7d104b7c84d99f5314a0a1f896e2b3ea6c2f22fc08d2003bee` | 2048 | 1409 |
| `serif` | `LiberationSerif-Regular.ttf` | 2.1.5 | `86b9ea1c2f41bed9d7c09ccad4abc2894b33df5de60e5bbbece5d48610911870` | 2048 | 1341 |

Both are the CachyOS `ttf-liberation 2.1.5-2` files under `/usr/share/fonts/liberation/`
(OS/2 `fsType` 0). Liberation Sans and Serif have the character widths of Arial and Times New Roman.
Cap heights: sans 18 pt is 0.437 cm, serif 24 pt is 0.554 cm, both above the 0.32 cm of 37 CFR
1.84(p)(3). Liberation Sans capitals run about 4 % shorter than Arial's.

## Licence

OFL-1.1. The package carries `licenses/OFL-1.1.txt` with the source copyright notices and the
Reserved Font Names (Liberation; Arimo, Tinos, Cousine). The subset is a Modified Version: inside
the package its faces are called `sans` and `serif`, never by a Reserved Font Name. The generated
file names its sources only as provenance.

## Generator

`packages/foundation/capability/technical-drawing/scripts/generate-label-glyphs.ts`, run with
`bun run generate` in the package (Biome formats the output) and checked with `bun run
generate:check` (regenerate, then `git diff --exit-code` on the data file). It takes the two
Liberation files under `/usr/share/fonts/liberation/` by default, or two TTF paths as arguments.
It calls the package's own `outlineFontFile` from `src/internal/LabelOutline.ts`, the function the
`fontFile` route calls, so both outline through the same code and the opentype.js 1.3.4 that
replicad pins in `bun.lock`; it loads opentype.js through the same non-literal dynamic import, so no
program loads the DOM-referencing `@types/opentype.js`. The script reads each TTF, records its
sha256 and name-table version, decodes each face into the `LabelFace` schema and writes the two
faces as `LabelFace.make(...)` literals with a provenance header. Re-running it on 2026-10-13
reproduced the committed glyph data exactly.

Drift check: a workstation-gated test renders a sheet with both label styles twice, once from the
vendored faces and once with `fontFile` pointing at the two Liberation files, and requires
byte-equal SVG plus the recorded sha256 of each file. It skips where the files are absent (hosted
runners).

## Operator font files

`LabelStyle.fontFile` names an absolute TrueType path (for example a licensed Arial or Times New
Roman). The renderer reads it, outlines the alphabet through the same `outlineFontFile`, refuses a
cap height under 0.32 cm, and records `{ fontFile, sha256 }` in `RenderManifest.labelFonts`. The
repository never ships such a file.

- opentype.js is imported dynamically with a non-literal specifier and read through a local
  `OpenTypeFontLike` shim, so neither the package program nor its consumers load the DOM-referencing
  typings. `opentype.js` is a declared dependency (catalog `1.3.4`, the version replicad pins), and
  `knip.jsonc` ignores it for this workspace because knip cannot see a non-literal import.
- Proof: on every runner, a label-alphabet font built in the test with opentype.js (one box per
  glyph) is outlined through the route, its sha256 lands in `labelFonts`, and the sheet carries a
  `label-outlines` path of the font's cap height; a not-a-font file fails with `DrawingError`
  reason `font` and the parser's own message (a failed opentype.js import has another one). On the
  workstation the drift check above also runs.

## Measurements (hosted composer tests)

- Placement by ink box: the sheet number's ink top sits within 0.01 pt of the label line (top
  margin plus `labelGapMm`) on sheets 1-8, although `/` rises 75 font units (0.66 pt at 18 pt)
  above the sans cap height; the `FIG. n` ink bottom sits within 0.01 pt of its line.
- Solid black: the largest all-ink square of the label outlines (serif 24 pt FIG label, sans
  18 pt sheet number) is 0.86 mm sampled every 0.02 mm, 0.84 mm at the test's 0.04 mm, on every
  sheet: under the validator's 1.5 mm limit.
- Pinned composer output: sheet 3 of 8 with both styles, `cfr-strict` margins and a 1 mm label
  gap has SVG sha256 `dcfb8611b16781c15f0caf34506a913c44d795e88ce09fc01e6a33bb2b1f6112`.
