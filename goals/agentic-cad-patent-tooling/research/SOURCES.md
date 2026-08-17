# SOURCES — Agentic CAD, Patent Tooling

Provenance ledger. Every claim in `SPEC.md` traces to a row here.

## In-repo evidence

| Source | What it establishes |
| --- | --- |
| `research/2026-08-17-fanout/reports/r7-beep-desktop-surface.md` | The dock/panel insertion contract; the app is Tauri 2 + React 19; WASM and module-worker precedent (PGlite, Oxigraph, ontology visualizer); **no blob store, no byte read-back, 25 MiB intake cap**, `FileFormatFamily` has no CAD members |
| `research/2026-08-17-fanout/reports/r8-beep-kg-model.md` | Where CAD belongs: vault bytes + `law-practice` ProductEntity + epistemic `EdgeVersion` + optional practice-KG projection; `PatentFigure` already exists as a URL value object; `KgNodeKind` is a closed kit |
| `research/2026-08-17-fanout/reports/r1-cadam.md` | adam.new's OSS sibling — LLM loop, geometry engine, licence posture |
| `research/2026-08-17-fanout/reports/r2-cadsense.md` | Bun + Turborepo TS CAD monorepo conventions |
| `research/2026-08-17-fanout/reports/r3-kittycad-zoo.md` | KCL, the Zoo engine cloud/local split, TS SDK surface |
| `research/2026-08-17-fanout/reports/r4-freecad.md` | FreeCAD headless; **TechDraw App-side HLR works without X11, composed page export needs Qt offscreen**; LGPL analysis |
| `research/2026-08-17-fanout/reports/r5-multi-agent-cad.md` | Multi-agent CAD topology, prompts, deterministic-coder path, evaluation |
| `research/2026-08-17-fanout/reports/r6-partmode.md` | Part/BOM data model relevance |

## External research lanes (all retrieved 2026-08-17, cited inline in each report)

| Lane | What it establishes |
| --- | --- |
| `x1-text-to-cad-market.md` | Product landscape; what changed since 2026-05-29 |
| `x2-agent-tool-surfaces.md` | What an agent can actually drive. `build123d-mcp` (Apache-2.0, offline, `validate()` over OCCT `BRepCheck_Analyzer`) and `agentcad` (Apache-2.0 CLI, JSON on stdout) are the only CAD agent surfaces worth binding. Onshape/Zoo/Fusion/Rhino are cloud or non-Linux |
| `x3-patent-figure-automation.md` | **The economics.** Illustrators $28–39/sheet offshore, $100–125 US, 2–5 days. ClaimMaster/Patent Bots already audit numerals *when a text layer exists*. No vendor is agent-driveable. Build the graph, buy the audit and the human last mile |
| `x4-web-cad-rendering-stack.md` | `occt-import-js` 7.6 MB WASM (LGPL-2.1) is the STEP path; **no JS package exposes OCCT hidden-line removal**; Chili3D and xeokit are AGPL; OCCT is LGPL-2.1 with the OCCT exception — ship the `.wasm` replaceable |
| `x5-llm-to-cad-codegen.md` | CadQuery/build123d is the converged codegen target; execute→validate→repair is the pattern that moves numbers; frontier models still fail 68–92% of complex parts; 2B–8B specialists fit one R9700 |
| `x6-image-to-3d-priorart.md` | Image/drawing → 3D for prior art; what is solved vs human-in-the-loop |
| `x7-iptech-competitive.md` | What solo/small IP firms adopt; where buying wins |
| `x8-confidentiality-standards.md` | **The rule surface.** 37 CFR 1.84 in operational detail; 1.84(p)(4)–(5) bijection; 1.152/MPEP 1503.02 design fork; Patent Center PDF 1.1–1.6, fonts embedded, flattened, ≥300 DPI, ≤25 MB; ABA Formal Op. 512; 89 FR 25609/25617; 15 CFR 734.13; 35 U.S.C. 184 / 37 CFR 5.11. **Corrects a prompt error: WIPO ST.94 does not exist** — PCT Rule 11 governs international figures, ST.91 covers 3D models |
| `x9-dwg-dxf-ingest.md` | **The DWG licence wall.** LibreDWG is GPL-3-or-later, no LGPL path, Worker isolation is not legal isolation; ODA File Converter is non-commercial for non-members; mlightcad proprietary parser $3k + $1.5k/yr; ODA membership $7.5k + $4.5k/yr; RealDWG Windows-only $8k/yr. **Embedded preview bitmaps are the 90% grid feature with no parse and no GPL.** 3D solids in DWG are opaque ACIS SAT/SAB |
| `x10-vector-figure-pipeline.md` | How draftsmen actually work; `.ai` is a PDF container with a private Illustrator stream; **the USPTO discards the filed PDF and stores a 300 dpi TIFF in IFW**; recommends a structured SVG scene graph plus a sidecar numeral graph |
| `x11-2d-first-agentic.md` | 2D-native vs 3D-then-project. Recommends a 2D scene graph as canonical with 3D→projection as an importer. **Names its own limit: no published USPTO-wide figure-type histogram exists; DeepPatent/DeepPatent2 are design-patent corpora and must not be used as a utility-figure census** |
| `x12-photo-to-starting-cad.md` | **The photo on-ramp, reframed to "get me started".** Fusion `Convert Mesh` caps near **10,000 facets** and gates Organic behind the paid Design Extension; Canvas `Calibrate` is uniform scale. `potrace -b dxf` / OpenCV contours is the ranked-1 local path. **COLMAP has an official HIP/ROCm backend**; **Meshroom hard-requires CUDA**; **RealityScan's EULA permits training on scans**; TRELLIS-AMD is RDNA3-proven, RDNA4 `gfx1201` UNVERIFIED |
| `x13-rtx3070-target.md` | **The target-hardware split.** The attorney's box is Windows + RTX 3070 (8 GB, CUDA): Meshroom's CUDA depth-map gate is satisfied, 8 GB caps generative 3D to Stable Fast 3D / Hunyuan3D-2.0-shape; the primary photo path and OCCT HLR are CPU-bound so the GPU is not load-bearing. Grounds SPEC's Target hardware section and D9/D10 |

## Corpus census (measured directly, 2026-08-17)

Run against the operator's salvaged practice drive under a narrow, dated
waiver: CAD files only, on the stated grounds that they derive from **publicly
filed** patents. Correspondence, financial, and mail-store files were not
touched. Only aggregate statistics are recorded here — no filenames, client
names, or content.

| Measurement | Result |
| --- | --- |
| `.dwg` | 837 files, 13.8 GB, mtime 2017-06 → 2026-05 |
| `.step` + `.stp` | 201 files, 6.3 GB, → 2026-05 |
| `.ai` | 175 files, 208 MB, → 2026-08 |
| `.sldprt` / `.sldasm` | 41 / 13 |
| `.3dm` | 30 |
| `.svg` | 552 — **not figure artwork** (386/400 sample under a Windows user profile, 252 under 2 KB, no vector-editor metadata) |
| Fusion (`.f3d`/`.f3z`) | **0** — consistent with Fusion 360 defaulting to cloud storage |
| DWG format version | 37 of 40 sampled are `AC1032` (AutoCAD 2018+) |
| `.ai` container | 173 of 175 are `%PDF-1.5`/`%PDF-1.6` |
| `.ai` with embedded fonts | 117 of 175 (live text, not outlined paths) |
| `.ai` containing `FIG. n` | 86 of the 117 font-bearing files |
| Mean distinct numeral-shaped tokens per extracted `.ai` | 7 |

Method: `find` + `stat` for counts and dates; first-6-byte read for DWG
version signatures; `/FontFile`/`/BaseFont` grep for font presence;
`pdftotext` for text extraction.

## Ideation

`research/2026-08-17-fanout/ideation/` holds five isolated divergent branches
(regulator, hostile competitor, inversion, remove-the-load-bearing-assumption,
biology) and three deepened branches. Four of five frames independently
converged on treating the illustrator artwork — not the 3D model — as the
figure of record, which is why that reframe sits in `SPEC.md` rather than in a
maybe-list. All three deepened branches named the *same* load-bearing risk
(are the files semantically rich or dumb linework?), which the corpus census
above then settled empirically: **positive for `.ai`, negative for `.svg`.**

## Superseded

- `research/agentic-cad-landscape.md` (2026-05-29) — repo-agnostic buyer's
  guide. Its tool evaluations remain useful; its headline recommendation
  (adopt CadQuery + build123d first) is **superseded for this practice** by
  the corpus census. Its conclusions that no turnkey disclosure→figure
  pipeline exists, and that cloud text-to-CAD is unusable for privileged work,
  still stand.
- `research/PROMPT.md` — the re-runnable brief that produced it.

## Reproduction

The 21 lane prompts are preserved verbatim in
`research/2026-08-17-fanout/prompts/`. Each pins its own output path and
citation contract, so the study can be re-run against a later snapshot.
