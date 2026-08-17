# PLAN — Agentic CAD, Patent Tooling

Mutable execution plan. `SPEC.md` is normative; this file sequences the work.

## Sequencing principle

The value is the **numeral graph**, and the cheapest path to it is the
Illustrator/PDF text layer that already exists (T1) — not the 3D stack. So the
plan front-loads the graph and defers geometry, inverting the order the
2026-05-29 research implied.

Every phase must be independently useful to Tom. No phase may end with
"infrastructure landed, nothing visible."

---

## P0 — Research (COMPLETE 2026-08-17)

20 cited lane reports in `research/2026-08-17-fanout/`, plus a corpus census
run directly against the salvaged practice drive. Findings are folded into
`SPEC.md`. See `research/SOURCES.md`.

Outstanding research debt, non-blocking:

- No published USPTO-wide figure-type histogram exists. DeepPatent/DeepPatent2
  are **design**-patent corpora and must not be used as a utility-figure
  census. The "most figures are diagrams" claim is therefore *unproven*, and
  the plan must not depend on it.
- `.ai` numeral extraction is proven at the file level, not at the
  numeral↔lead-line↔part level. P1 settles that.

---

## P1 — The numeral graph from artwork that already has text

**Why first:** highest payoff per unit of work, no new engine, no licence
risk, and it directly tests the load-bearing assumption.

1. Schema first. `bun run beep architecture add concept law-practice CadFigure
   --domain-kind entities --stage persistence` and the same for
   `ReferenceNumeral`; identities land in
   `packages/shared/domain/src/identity/LawPractice/` first.
2. `CadSource = Imported | Generated` tagged union (D5). Reuse
   `DocumentContentDigest`; do not invent a second hash type.
3. A `drivers/pdf-text` (or extend `@beep/doc-text`) extraction port that
   returns numeral tokens **with their page coordinates**, not just text.
4. Bijection service: `{in_spec, in_drawings, in_claims}` projections and the
   `1.84(p)(4)–(5)` failure set.
5. Prove it on real corpus files, reporting per-file numeral recall.

**Exit:** a real matter's figure set yields a numeral map, and the bijection
report names concrete inconsistencies.

**Also lands here (operator ask A3):** the derivation spine — `Activity` for the
render act, `EdgeVersion` for the assertion, and a new image-region locator
value object beside `TextAnchor` (which is text-only: `startChar`/`endChar`/
`quote`). This is what lets a figure be hovered back to its source, and it is
what makes a `37 CFR 11.18(b)` reasonable inquiry performable.

**Risk:** numerals extract as text but cannot be associated to *parts* without
lead-line geometry. Mitigation: ship the bijection (which needs only tokens)
before attempting lead-line tracing (which needs vector paths).

---

## P2 — Byte read-back and the document grid

The app can write a file into the vault at intake and then **never read it
back**. No viewer is possible until this exists.

1. Schema the RPC payload in `packages/documents/use-cases`; merge into
   `apps/professional-desktop/server/DesktopRpcs.ts`; provide the handler in
   `src/runtime/Layer.ts`.
2. Raise or bypass the 25 MiB renderer cap (`MAX_INTAKE_FILE_BYTES`) — STEP
   files in this corpus average ~37 MB and would be refused today. Do **not**
   Base64 a 37 MB file over RPC; stream or resolve a path.
3. Add CAD/figure members to `FileFormatFamily`, which today has no
   `step`/`dwg`/`ai` and classifies them `"unknown"`.
4. DWG preview tiles: extract the embedded thumbnail (BMP/WMF/PNG) directly
   from the documented preview section. **No entity parse, no GPL.**

**Exit:** a browsable grid of a matter's drawings, DWGs included, with no GPL
code in the binary.

---

## P3 — Viewers

Spike-first, mirroring how `Graph3DSpike` proved WebGL before docking.

1. `?cad-spike` flag next to `hasGraph3dSpikeFlag`; prove
   `occt-import-js` mounts, resizes, and tears down in the Tauri webview
   without leaking the GL context.
2. `packages/drivers/occt` via `create-package`, with a `/browser` export,
   matching `@beep/graph-3d`'s shape exactly.
3. Dock the panel: `DESKTOP_PANELS` entry, `cluster: "shell"` (a new `cad`
   cluster would silently appear under the Ontology disclosure), start closed,
   `renderMode: "always"`, raised `PanelConstraints`. Update the panel-count
   assertion in `test/dock-shell.test.tsx`.
4. Vector viewer for PDF/`.ai`/DXF with numeral overlay driven by P1's graph.
5. DXF only via a **user-installed** converter discovered on `PATH`
   (FreeCAD's `importDWG.py` detector is the reference pattern).

**Exit:** Tom opens a real matter and sees its drawings.

**Gate:** gesture-bearing viewport work runs the `browser-qa-loop` skill.

---

## P4 — Agent surface

1. `cad_find`, `cad_figure`, `cad_numerals`, `cad_provenance` on the existing
   practice-KG MCP, using the `readTool` + `PracticeKgToolResult` template
   verbatim. Read-only, closed-world, budget-tiered.
2. Derivation and support assertions ride `EdgeVersion` (`supports`) with
   bitemporal validity — a re-render supersedes, never updates in place.
3. Per-matter service policy + consent record (D4): which providers a matter
   permits, and a provenance edge on every artefact naming the service that
   produced or saw it. Recorded, queryable, and reportable — not a block.

---


## P5 — Figure compositor (operator ask A1)

**Platform gate (D10):** every component here needs a first-class Windows
build. build123d/OCP and FreeCAD both ship Windows; verify before committing.

Promoted out of "deferred" by `SPEC.md` A1. Projection is already solved; this
phase builds the `37 CFR 1.84` **compositor**.

1. Python sidecar as a second Tauri `externalBin`, alongside the existing one.
   Prefer `build123d` (`project_to_viewport` + `ExportSVG` with Visible /
   Hidden `ISO_DOT` layers) for parts; reach for FreeCAD `FreeCADCmd` only when
   sections, details, or its balloon/leader objects are needed.
2. Compose the sheet **yourself** from App-side properties — `writeDXFPage`
   drops balloons, leaders, and the template. `QT_QPA_PLATFORM=offscreen` in a
   second process is the fallback, not the default.
3. Patent numeral grammar, not BOM grammar: balloon bubble `None` (1.84(p)(1)
   forbids encircled characters), >= 0.32 cm text, lead lines that do not
   cross, no centre lines, no projection lines, hatching ~45 degrees, no solid
   black fill.
4. Sheet packager: A4 or Letter (one size per application), margins
   25/25/15/10 mm, `FIG. n` numbering independent of sheet numbering, sheet
   `k/N` in-sight.
5. Export to PDF 1.1-1.6, fonts embedded, layers flattened, <= 25 MB. Remember
   the Office rasterises to a 300 dpi TIFF in IFW — line weight and 1-bit
   purity matter more than DPI theatre.

**Exit:** a STEP part becomes a draft 1.84-shaped sheet with bound numerals.

---

## P6 — Photo on-ramp (operator ask A2)

**Platform gate (D10):** Windows builds required. `potrace` and OpenCV are
fine. With CUDA on the target box, Meshroom rejoins COLMAP as a photogrammetry
option — but only as the optional tier; the primary path stays CPU-only.

Deliberately **not** image-to-CAD. The deliverable is a Fusion starting point.

1. Local sidecar: photo -> rectify/deskew -> threshold -> silhouette ->
   `potrace -b dxf`, or OpenCV `findContours` + `approxPolyDP` when holes and
   sharp corners matter.
2. Emit a DXF the user drops into Fusion via `Insert > DXF`, plus the rectified
   image for a calibrated **Canvas** underlay. Fusion `Calibrate` is uniform
   scale, so rectification is the value-add.
3. Scale recovery from a ruler or a caliper'd feature in frame.
4. Every emitted artefact carries `derived, unverified` provenance (P1), plus
   the service that produced it, so it can never silently reach a claim chart.
5. Optional later, for organic parts where a silhouette lies: hosted
   reconstruction (Hunyuan3D 3.1 Pro 8-view, Rodin, Meshy, Tripo) is the
   quality option; Meshroom/COLMAP run locally on the target box's CUDA card
   when a matter's policy prefers it. RealityScan stays out — its EULA permits
   training on scans, which is a licensing choice, not a confidentiality one.

**Exit:** a photo of a real part becomes a sketch he can extrude in Fusion.

**Non-goal:** feeding a generative or photogrammetry mesh through Fusion
`Convert Mesh`. Autodesk caps it near 10,000 facets and gates Organic behind
the Design Extension.

---

## P7 — Ship to the attorney's machine, then close

Each phase ships its own PR. This phase additionally proves **delivery**:
tag `professional-desktop-v*` and drive `release-desktop.yml` green on the
Windows x64 target for the first time ever. D1 is not satisfiable without it.

`bun run beep yeet repair → verify → publish --pr → monitor` until
`merge-ready: yes`. Then a `/reflect` closeout under
`history/reflections/<YYYY-MM-DD>-<agent>.md`.

---

## Deferred (named, not forgotten)

| Item | Trigger to revisit |
| --- | --- |
| Paid DWG parser (mlightcad $3k, or ODA membership $7.5k + $4.5k/yr) | Only if preview tiles + user-installed DXF conversion prove insufficient |
| SHX font mapping | First real DWG that renders with wrong text metrics |
| Design-patent (`1.152`) shading | Only if the practice files designs through this tool |
| Prior-art overlay figures | After the numeral graph exists; it is the highest-value *second* capability |
| Metrology-grade reconstruction for claim comparison | Needs a real 3D scan + human scan-to-CAD; generative meshes are not evidence |

## Verification lane

- `bun run beep yeet verify` for repo proof.
- Corpus-truth check: numeral recall measured against real files, not
  fixtures. Fixture realism matters more than fixture volume here.
- `browser-qa-loop` for any pointer-gesture viewport milestone.

## Current blockers

None. P1 is startable.
