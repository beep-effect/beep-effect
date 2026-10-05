# Design Figure Generation — Sources & Provenance

- **Cluster / origin:** 2026-10-05 deep-research sweep (5 Opus 5.5
  researchers + 1 writer) seeded by a live drawing request; full notes
  out-of-repo at `~/data-home/oppold-corpus/ops/patent-drawing-pipeline/deep-research/`.
- **Provenance:** inherited at graduation 2026-10-05 from `explorations/patent-drawing-pipeline/research/SOURCES.md` (primary ledger); `explorations/patent-drawing-pipeline/RESEARCH.md` §2026-10-05.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `replicad-hlr` | Projected edges via OCCT HLR | sgenoud/replicad | `packages/replicad/src/projection/makeProjectedEdges.ts` | hidden-line projection | reference (verify perspective in spike) |
| `b123d-techdraw` | Technical drawing tutorial | gumyr/build123d | docs `tech_drawing_tutorial` | projection + SVG layers | reference / port-with-attribution |
| `eyalk11-pd` | Reference numerals on Mermaid SVGs | eyalk11/patent_drawings | README | utility figures | reference only |
| `x-drawing` | Agent skill for monochrome patent SVGs | animaresearch/x-drawing | README | agent skill shape | reference only |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| sgenoud/replicad | MIT (per npm; verify LICENSE on disk before port) | port-with-attribution | HLR projection call shape |
| donalffons/opencascade.js | LGPL-2.1 (verify) | link only, never vendor | OCCT WASM kernel |
| gumyr/build123d | Apache-2.0 (verify) | port-with-attribution | drawing export workflow (fallback) |
| CadQuery/cadquery | Apache-2.0 (verify) | reference | `exportSvg(focus=…)` perspective |
| ArtifexSoftware/mupdf.js | AGPL-3.0 | clean-room / external binary only | none |
| eyalk11/patent_drawings | MIT | reference | none |
| animaresearch/x-drawing | MIT | reference | none |

## 3. External research sources

Rules: eCFR 37 CFR 1.84; Cornell LII 37 CFR 1.152; MPEP 1503, 1504; USPTO
Patent Center PDF guidelines; USPTO DOCX page; 89 FR 25609 (2024-04-11 AI
guidance); Oppedahl blog on Patent Center blank-page conversion. AI/CAD:
arXiv 2410.05340 (CADCodeVerify), 2505.19713 (CAD-Coder), 2609.22325
(ReliCAD), 2605.01171 (CADFit), 2311.12668 (GPT-4V CAD reading). Tools:
replicad docs/API, build123d tech-drawing tutorial, CadQuery import/export
docs, FreeCAD tracker #3077, Blender T86942, Inkscape bug 211761, pixi lock
file docs, npm mupdf, odiff-bin. Vendors: PatentFig AI, PatentDrawingAI
(Shopify + guide), DeepIP, Solve Intelligence, IP Illustrated pricing,
PatSketch, Fiverr listing, LegalClarity, Onshape pricing/forum, McNeel
core-hour billing, Zoo billing post, StackSheriff (Fusion Personal). All
URLs are reproduced in `RESEARCH.md` and the out-of-repo notes.

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/ffmpeg` subprocess driver shape | `packages/drivers/ffmpeg/src/FFmpeg.service.ts` | reuse pattern |
| `@beep/exiftool` | `packages/drivers/exiftool` | reuse pattern |
| `@beep/doc-text` (pdfjs/unpdf) | `packages/drivers/doc-text` | reuse |
| QA judge contract | `packages/tooling/tool/cli/src/commands/Qa/JudgeContract.ts`, `Inventory.schemas.ts`, `JudgeCheck.ts` | extend |
| Corpus root config | `packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts:60` | reuse |
| `@beep/m365`, `@beep/m365-mcp` | `packages/drivers/m365*` | reuse (intake) |
| `@beep/ecfr`, `@beep/uspto` | `packages/drivers/ecfr`, `packages/drivers/uspto` | reuse (rule provenance) |
| `packages/law-practice/*` | matter-level domain | extend |
| Geometry kernel wrapper, shading generator, sheet composer, drawing validator | — | NET-NEW |

## 5. Cross-links & provenance

- Source exploration: `explorations/patent-drawing-pipeline/` (`RESEARCH.md`, `DECISIONS.md`, `BRIEF.md`, `MAP.md`); this goal: `SPEC.md`, `PLAN.md`.
- Out-of-repo notes: `~/data-home/oppold-corpus/ops/patent-drawing-pipeline/deep-research/`.
- Sibling goal: `goals/agentic-cad-patent-tooling` (OCCT driver, 1.84 compositor P5, CAD domain; D6–D8).
