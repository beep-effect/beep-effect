# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-10-05 — Deep-research sweep (5 researchers + writer, Opus 5.5)

Full report and per-topic notes (with every citation) are out-of-repo at
`$HOME/data-home/oppold-corpus/ops/patent-drawing-pipeline/deep-research/`
(`report.md`, `uspto_rules.md`, `ai_generation.md`,
`open_source_pipeline.md`, `commercial_options.md`,
`reproducible_pipeline.md`). They stay out of the public repo because they
use the live matter's article as the running example. This section carries
the matter-independent findings.

### Verdict

Model once, project eight figures. Build one exact parametric B-rep solid
from measured dimensions (Claude writes the CAD code; a human checks every
number), derive every figure from it by hidden-line removal, generate
surface shading procedurally, compose sheets from a template that cannot
violate 37 CFR 1.84 margins, and gate the output with a validator plus a
recorded attorney sign-off. Multi-view consistency then holds by
construction, which is the property a design claim actually needs: the
drawing *is* the claim, inconsistent views draw objections or 112
rejections, and post-filing shading fixes can be new matter.

## External Landscape

### USPTO rules (stable, assertable)

- 37 CFR 1.84 last amended 2015, 1.152 in 2000; eCFR current to 2026-10-01.
  <https://www.ecfr.gov/current/title-37/chapter-I/subchapter-A/part-1/subpart-B/subject-group-ECFR3e0ad1bb7ed0e5a/section-1.84>,
  <https://www.law.cornell.edu/cfr/text/37/1.152>.
- Sheets: A4 or 8.5×11 in, all the same size, shorter side at top. Margins at
  least top 2.5 cm, left 2.5 cm, right 1.5 cm, bottom 1.0 cm; no frame.
  Lines solid black, "uniformly thick and well-defined"; characters ≥ 0.32 cm;
  "FIG." + consecutive Arabic numerals (no brackets/circles); a single-view
  drawing is not numbered; sheet number "n/N" centred at top inside the
  sight; must read when reduced to two-thirds.
- Design specifics (1.152, MPEP 1503.02 / 1504,
  <https://www.uspto.gov/web/offices/pac/mpep/s1503.html>,
  <https://www.uspto.gov/web/offices/pac/mpep/s1504.html>): "sufficient
  number of views"; the 7-view set is convention, not rule. Views may be
  omitted only with a specification statement (identical, mirror, or flat
  and unornamented). Shading not formally required but needed to show
  contour and to distinguish open from solid areas; missing shading can
  render the claim non-enabled, and adding it later can be new matter.
  Straight-line or stipple shading, never both on one surface; no solid
  black; broken lines only for unclaimed environment/boundaries, never
  hidden surfaces; one position per view; exploded views only alongside a
  fully assembled view, parts bracketed. Reference numerals effectively
  banned (1.84(p)(5) + a design spec has no description to mention them).
- Filing: PDF 1.1–1.6, fonts embedded, no layers/annotations/encryption,
  rasters ≥ 300 dpi
  (<https://www.uspto.gov/patents/apply/applying-online/efs-web-pdf-guidelines>).
  DOCX surcharge does not cover drawings (<https://www.uspto.gov/patents/docx>).
  Patent Center has rendered "valid" PDFs blank
  (<https://blog.oppedahl.com/patentcenter-converts-perfectly-good-pdf-into-blank-piece-of-paper/>),
  so rasterize-and-check is a real gate.
- AI: April 2024 guidance (89 FR 25609,
  <https://www.govinfo.gov/content/pkg/FR-2024-04-11/html/2024-07629.htm>)
  allows AI-drafted drawings but demands verification before filing;
  relying on the tool is "not a reasonable inquiry". Design expedited
  examination ended under an August 2025 rule (law-firm summary only).
- No rule gives a numeric line width or shading pitch; the 0.25–0.35 mm
  floor in the notes is an inference from the two-thirds reduction test.

### Generative image models and AI-native products

- 2026 products: PatentFig AI ($20–80/mo), PatentDrawingAI ($9–79/mo),
  DeepIP, Solve Intelligence. No independent review, no side-by-side test,
  no filed-and-granted example found; all disclaim compliance;
  PatentDrawingAI's own guide says figures are generated one at a time.
- "Consistency" in 2026 image models means character identity across a
  turnaround, not dimensional agreement between views. Nothing ties a
  generated front elevation's width to a generated plan.
- Image-to-3D (Hunyuan3D, TRELLIS, TripoSR) is self-consistent but
  approximate: IoU 0.69 easy / 0.43 hard for the best model on a CAD
  benchmark (CADFit, arXiv 2605.01171). Thin panels and narrow slots are the
  worst case.
- Raster-to-vector (potrace) traces filled outlines, not centerlines, so
  traced line art has variable width; texture and shadows become false
  ornamentation.
- Code-CAD is the credible AI role: CADCodeVerify 96.5% compile success with
  VLM self-verification, structural-configuration errors = 48% of residual
  failures (arXiv 2410.05340); CAD-Coder 1.45% invalid (arXiv 2505.19713);
  ReliCAD 99.8% valid, IoU 0.875 (arXiv 2609.22325). Residual failure class
  (wrong feature count/placement/direction) compiles and looks plausible,
  hence human-measured parameters and a semantic judge.

### Open-source toolchain

- **replicad** (TypeScript over opencascade.js) wraps OCCT exact B-rep
  `HLRBRep_Algo`, returns visible and hidden edge sets incl. silhouettes
  (<https://replicad.xyz/docs/api/>,
  `packages/replicad/src/projection/makeProjectedEdges.ts` upstream). Runs
  in Bun in-process. UNVERIFIED: whether the public API exposes true
  perspective projection (it passes `ProjectionCamera` into
  `HLRAlgo_Projector`, so probably). One-day spike.
- **build123d** (Python, same kernel): `project_to_viewport` → (visible,
  hidden); `ExportSVG` with layer styles
  (<https://build123d.readthedocs.io/en/latest/tech_drawing_tutorial.html>).
  CadQuery `exportSvg(focus=…)` is the documented perspective route
  (<https://cadquery.readthedocs.io/en/latest/importexport.html>). Pin with
  pixi/uv.
- Rejected/limited: OpenSCAD and manifold-3d are mesh kernels, no HLR;
  FreeCAD TechDraw export needs the GUI module (Xvfb); Blender Line Art only
  if the input is already a mesh, and an orthographic-camera SVG export bug
  (T86942) is unconfirmed on 5.x. No code-first tool has a sheet-metal fold
  feature; model tabs as rotated solids, score lines as shallow grooves or
  added edges. Keep panels as separate solids in a compound so interlock
  edges draw.
- **Shading**: no open tool automates patent shading. Proposed deterministic
  generator: per visible planar face, exposure to an upper-left 45° light
  (1.84(m)) sets hatch spacing; seeded dashes; hatch lines pass through the
  same HLR so occluded shading vanishes; thinner layer. Untested; expect a
  light Inkscape touch-up kept as an SVG diff, or a vendor shading-only pass.
- **Sheet assembly**: generated SVG sheet with the sight rectangle as a hard
  clip (Letter ≈ 497.5 × 691.7 pt after margins), "FIG. n" and "n/N" as
  outlined paths (14–18 pt, vendored OFL font), strokes normalised to pure
  black fixed width, `rsvg-convert`/cairosvg → PDF, merge with qpdf/pypdf.
- **Validator**: structural tier (MediaBox A4/Letter on every page, PDF
  header ≤ 1.6, fonts embedded) via pdf-lib/pdfjs-dist; raster tier (render
  300 + 600 dpi, ink bounding box vs. margins in cm, only pure black/white,
  no filled black region above a small area). MuPDF.js is AGPL-3.0 → shell
  out to `pdftoppm`/`mutool` or use pdfjs-dist in-process.
- **Reproducibility**: pixi lockfile for the Python fallback; opencascade.js
  WASM pinned by hash; text to outlines; rounded/sorted SVG coordinates;
  strip PDF CreationDate/ModDate/ID or set from `SOURCE_DATE_EPOCH`; seeded
  jitter; `manifest.json` with spec hash, toolchain hashes, per-figure
  hashes, PDF hash, validator report.
- Prior art found: eyalk11/patent_drawings (MIT; numerals + leaders on
  Mermaid SVGs), animaresearch/x-drawing (MIT, 2026; agent skill for
  monochrome SVGs, no validation), PatentFig-AI (product). None has a 3D
  model behind the figures, measures margins/colour, or records a manifest.

### Commercial options (USD, 2025–2026 prices, see notes for dates)

| Route | ~Cost per 8-figure case |
| --- | --- |
| Offshore freelancer (~$10/figure) | $80–$320 |
| Fixed-price US-facing vendor ($39–$100/figure) | $312–$800 |
| USPTO average ($50–$350/sheet, $200 avg) | ~$1,600 |
| AI subscription + attorney QA | <$30 marginal |
| In-house CAD views + outsourced shading only | $160–$480 (inference; no vendor publishes a shading-only rate) |

- Onshape REST exports SVG/DWG but private docs start at $1,500/user/yr and
  the free tier makes every document public (unfiled-design disclosure
  risk). Rhino 8 $995 perpetual + Rhino.Compute $0.10/core-hour. Zoo
  text-to-CAD $0.50/min after 40 free min, STEP/glTF only. Fusion Personal
  and SolidWorks for Makers forbid commercial use. No vendor offers an
  illustration API.

## In-Repo Capability Inventory

- **Subprocess contract**: `@beep/ffmpeg`
  (`packages/drivers/ffmpeg/src/FFmpeg.service.ts`) is the canonical
  driver-level native-binary wrapper: `ChildProcess` / `ChildProcessSpawner`
  from `effect/process`, schema-first request/result models, typed error.
  Reuse the shape for `pdftoppm`/`rsvg-convert`/`qpdf` and for a pinned
  build123d fallback. `@beep/exiftool` is a second instance of the pattern.
- **PDF**: `pdf-lib` and `pdfjs-dist` are already catalog deps
  (`package.json`); `@beep/doc-text` (`packages/drivers/doc-text`) wraps
  unpdf/pdfjs for text extraction; `sharp` is a catalog dep (used by
  `@beep/face-detection` and the CLI) for raster comparison/thresholding.
- **Vision judge loop**: `packages/tooling/tool/cli/src/commands/Qa/`:
  `JudgeContract.ts` (typed qa-inventory/v1 judge: blocking gates, verdict
  schemas, evaluators), `Inventory.schemas.ts` (`QaInventory` fails decode
  when requiredCount mismatches P0/P1), `JudgeCheck.ts` (hallucinated
  evidence guard), `JudgeIngest.ts`, `JudgeLint.ts`, `Qa.render.ts`
  (REQUIRED FINDINGS verdict line), `QaJudgeGateId.ts`. Skill:
  `browser-qa-loop`. Extend with a drawing rubric rather than build a
  second judge.
- **Out-of-repo corpus root**: `BEEP_OPPOLD_CORPUS_ROOT`
  (`packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts:60`,
  `Config.String` fallback) is the established env-var pattern for client
  material; matter specs and photos belong under it.
- **Intake**: `@beep/m365` (Microsoft Graph delegated, read-only) and
  `@beep/m365-mcp` can read the request message; binary attachment download
  is NOT available through the connector used today (NOT FOUND in this
  session; check the driver's attachment verbs).
- **Law/USPTO context**: `@beep/uspto` (Open Data Portal metadata),
  `@beep/ecfr` (eCFR driver — can fetch 37 CFR 1.84/1.152 text for the
  validator's rule provenance), `@beep/govinfo`. `packages/law-practice/`
  (domain/server/tables/use-cases) is the slice for matter-level models.
- **3D**: `@beep/graph-3d` depends on three; no OCCT/replicad/manifold in
  the workspace (NOT FOUND). Geometry kernel wrapper is NET-NEW.
- **Shading generator, sheet composer, drawing validator**: NET-NEW.
- **Operator command**: `bun run beep <cmd>` CLI family
  (`packages/tooling/tool/cli/src/commands/*`), package scripts generated
  by `beep lint package-scripts --write`, new packages via
  `bun run beep create-package`.

## Constraints Discovered

- **Disclosure**: this repo is public. A real article's geometry (counts,
  profiles, fold angles) in a packet, fixture, or golden test is a public
  disclosure of an unfiled design. Only synthetic fixture articles may live
  in-repo; real matter specs, photos, and renders stay under the corpus root.
- **Legal**: inconsistent views → objection/112; post-filing shading or
  boundary changes → new matter; attorney verification is required under
  the 2024 AI guidance and should be a recorded event keyed to the sheet-set
  hash. Collapsed-state or tabs-up figures risk a restriction requirement
  (MPEP 1504.05) and are a claim-strategy call.
- **Technical**: perspective HLR in replicad unverified; no fold feature in
  any code-first kernel; procedural shading untested against an examiner or
  illustrator; thin-panel photogrammetry/image-to-3D unreliable, so
  dimensions come from calipers.
- **Licensing**: MuPDF.js AGPL → external binary only. opencascade.js is
  LGPL-2.1 (link, don't vendor); replicad MIT; build123d Apache-2.0 (verify
  in SOURCES before porting anything).
- **Process**: Effect v4 `effect/process` for subprocesses (verify API in
  `.repos/effect` before writing); schema → service → implementation order;
  LiteralKit for the view-name domain.
