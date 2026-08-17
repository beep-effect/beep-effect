# SPEC — Agentic CAD, Patent Tooling

Normative contract. Packet anchor document. Repo standards outrank this file
when they conflict.

## Mission

Give a solo patent practice a CAD capability inside
`apps/professional-desktop`: open the drawings and models a matter already
has, and make the **reference-numeral / figure graph** a first-class,
agent-queryable part of the knowledge graph.

## The reframe this packet is built on

The 2026-05-29 research (`research/agentic-cad-landscape.md`) was
repo-agnostic tool discovery and optimised for **3D solids** — CadQuery /
build123d / STEP. Two evidence sources overturned that default:

1. **Corpus census (2026-08-17).** The practice's real salvaged corpus is
   DWG-dominant, not STEP-dominant:

   | Format | Files | Size | Active through |
   | --- | ---: | ---: | --- |
   | `.dwg` (AutoCAD) | 837 | 13.8 GB | 2026-05 |
   | `.step` / `.stp` | 201 | 6.3 GB | 2026-05 |
   | `.ai` (Illustrator) | 175 | 208 MB | 2026-08 |
   | `.sldprt` / `.sldasm` | 54 | 720 MB | 2025-05 |
   | `.3dm` (Rhino) | 30 | 10 MB | 2021-06 |

   DWG outnumbers STEP **4:1**. Sampling shows **37 of 40 DWGs are AC1032
   (AutoCAD 2018+)**.

2. **Illustrator artwork carries live numerals.** Of the 175 `.ai` files,
   **173 are PDF-compatible**, **117 embed fonts** (live text, not outlined
   paths), and of those **86 contain `FIG. n`** with a mean of 7 distinct
   numeral-shaped tokens per file. The figure set is machine-readable today.

   Counter-check: the 552 `.svg` files are **not** figure artwork — 386 of a
   400-file sample sit under a Windows user profile, 252 are under 2 KB, and
   none carry Illustrator/Inkscape metadata. They are UI/web icons. Do not
   plan against them.

**Therefore:** the durable object is the **2D figure and its numeral graph**,
not the 3D solid. 3D→hidden-line projection is an importer lane for the
subset of work where a correct solid exists, not the trunk of the system.

## Decisions (locked 2026-08-17)

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Achieved = Tom uses it on a real, privileged matter | Packaging and distribution to his machine are in scope, not a later packet |
| D2 | Wedge = render + link CAD that already exists; **no generation** | Only certainly-achievable capability; every other capability sits on it |
| D3 | Figures are **draft quality**; a human finishes them | Illustrators cost $28–39/sheet offshore, $100–125 US. Replacing them is not the value |
| D4 | **Quality first. Cloud is available and expected where it is better.** Local is one deployment mode, not a requirement | Practising attorneys already use cloud AI routinely. Frontier models are materially better at the hard parts here (figure understanding, CAD codegen), and refusing them costs quality for a compliance posture the profession does not actually hold. Confidentiality is handled as a per-matter *policy and consent record*, not as an architectural wall |
| D5 | Durable node is a tagged union `CadSource = Imported \| Generated` | The wedge only ever produces `Imported`; generation later produces `Generated` where the program is the node |
| D6 | Geometry staged: WASM worker now, Python sidecar when figures land | No JS package binds OCCT hidden-line removal; the sidecar is only needed once figures are generated |
| D7 | Ownership split: `drivers/*` engines, `law-practice` meaning, `documents` bytes | Every piece has a live in-repo template; nothing is invented |
| D8 | **Never link a GPL DWG reader; never redistribute ODA File Converter** | LibreDWG is GPL-3-or-later with no LGPL path; a Web Worker is architectural isolation, not legal isolation. ODA's own FAQ: non-members may use the File Converter for non-commercial applications only |
| D9 | **The app runs on the attorney's box; heavy work goes to cloud APIs, not to the developer's workstation** | Keeps deployment simple and avoids routing privileged files through a non-lawyer's machine (Model Rule 5.3), while leaving cloud services fully available. One install, no second box to operate |
| D10 | **Target platform is Windows x64.** Linux is the dev platform, not the delivery platform | The attorney runs Windows with Fusion installed (Fusion is Windows/Mac only). Every sidecar, converter, and tool chosen in P5/P6 must have a first-class Windows build — no Linux-only or WSL-dependent components |

## The three operator asks (2026-08-17) — one pipeline, not three features

The practitioner named three wants. Reframed against evidence they are a single
chain with three entry points, and the provenance spine is what makes the other
two defensible.

```
photo ──trace + calibrate──► Fusion sketch ──he models──► solid
                                                            │
                                                       export STEP
                                                            │
                                                HLR + 1.84 compositor
                                                            │
                                                      patent figure
                                                            │
                                hover ◄────provenance edges──┘
                                      (original photo AND solid)
```

### A1 — CAD/Fusion → 2D patent-grade figure — FEASIBLE

Hidden-line projection is solved three times over (Fusion's Drawing workspace,
`build123d.project_to_viewport`, FreeCAD TechDraw). **Do not build a
projector; build the `1.84` compositor.**

FreeCAD TechDraw runs the load-bearing parts headlessly under `FreeCADCmd`
(proven by its own App-side tests): `DrawViewBalloon` (`Text` = the numeral
string, page-level `NextBalloonIndex`), `DrawLeaderLine` (`WayPoints`,
start/end symbols), and `DrawViewSection`/`DrawViewDetail` compute
synchronously when `!isGuiUp()`.

The hole: **`writeDXFPage` — the only App-side page exporter — does not emit
balloons, leaders, rich annotations, or the sheet template.** Either compose
the SVG from App-side properties (`Origin`, `Text`, `X`, `Y` are all reachable)
or run a second process as the GUI binary under `QT_QPA_PLATFORM=offscreen`.

Evidence that the gap is grammar, not geometry: TechDraw's default balloon
shape is `Circular`, and `37 CFR 1.84(p)(1)` **forbids** reference characters
enclosed in outlines or encircled. Set the bubble to `None`. TechDraw draws
mechanical BOM balloons; patent numerals are a different visual language over
the same objects.

Cost: weeks for the engine adapter. The work is patent-style numeral layout, a
USPTO title-block template (stock ones are ISO/ASME), packaging a stripped
build, and process isolation so a bad HLR cannot kill the desktop app.

Fusion is Windows/Mac only and cloud-tied — hence **zero `.f3d` files** in the
corpus. Do not drive Fusion. The interface is *Fusion → export STEP/DXF →
local sidecar*.

### A2 — Photos → CAD — FEASIBLE ONLY AS "GET ME STARTED"

Operator clarification: the bottleneck is **starting**, not fidelity. He is a
competent Fusion user who will finish the model himself.

That splits the accuracy bar in two, and the split is load-bearing:

| Job | Bar | Why |
| --- | --- | --- |
| Starting a **figure** | Very low | `1.84(k)` forbids scale callouts — figures are not to scale |
| **Prior-art / accused-product** | Metrology-grade | Claim limitations turn on real dimensions |

A generated body must therefore carry `derived, unverified` provenance so it
can never silently reach a claim chart.

**A rough solid is a worse starting point than a good sketch.** Two reasons:
Fusion is history-based, so an imported body arrives with no sketches, no
timeline, no parameters; and Autodesk's own docs cap **Convert Mesh at ~10,000
facets** ("the conversion process may fail" above it), with the Organic method
gated behind the paid Design Extension. Photogrammetry and generative meshes
are orders of magnitude over that ceiling.

Ranked local paths:

1. **Photo → rectify → silhouette → `potrace -b dxf` (or OpenCV
   `findContours` + `approxPolyDP` for holes/sharp corners) → Fusion
   `Insert > DXF` → extrude**, with the photo as a calibrated **Canvas**
   underlay. CPU-only, offline, deterministic, no invented geometry, and it
   yields an editable sketch-extrude history he owns. Note Fusion's `Calibrate`
   is *uniform* scale — rectify first.
2. **COLMAP** → mesh as a Fusion reference body. **Official HIP/ROCm backend**,
   BSD, offline — the only serious open photogrammetry that is not CUDA-gated.
   For organic/doubly-curved parts where a silhouette lies.
3. **TRELLIS-AMD** as a "shape sketch" to orbit and trace from. RDNA3 proven;
   **RDNA4 `gfx1201` UNVERIFIED**. Never a measurement.

Ruled out: **Meshroom** (hard CUDA requirement for depth maps),
**RealityScan 2.2** (supports RDNA4 but is Windows-GUI-only and its **EULA
permits training on scans unless opted out** — disqualified under D4),
Polycam / ReCap Photo (cloud).

### A3 — Hover a figure → see its source CAD/photos — FEASIBLE, BUILD FIRST

Pure provenance, already modelled in-repo: `EdgeVersion` (bitemporal
`supports`), `Activity` (renderer/camera/commit snapshot), and
`ObservationVersionRef {sourceId, textDigest}`. A re-render supersedes rather
than updates, so "which source produced FIG. 3 as of the filing" stays
answerable.

Two gaps: **byte read-back does not exist** (P2), and **there is no
image-region locator** — `TextAnchor` is text-only (`startChar`/`endChar`/
`quote`), so a figure callout needs a new value object beside it, not a reuse.

Why this is first rather than last: under **37 CFR 11.18(b)** the practitioner
personally certifies every paper after "an inquiry reasonable under the
circumstances," and USPTO guidance states that *"simply relying on the accuracy
of an AI tool is not a reasonable inquiry"* (89 FR 25614). Provenance is the
mechanism by which that inquiry is performed. Without it, a generated figure is
an unsourced assertion.

## Target hardware (2026-08-17)

Two machines, two roles. **D9 fixes all client-data processing on Machine A.**

| | Machine A — the attorney | Machine B — the developer |
| --- | --- | --- |
| OS | **Windows** | Linux |
| GPU | **NVIDIA RTX 3070, 8 GB** (CUDA, CC 8.6) | 2x AMD Radeon AI PRO R9700, 64 GB (ROCm) |
| Holds client files | **Yes** | No, and must stay that way |
| Role | Runs the shipped app; all privileged processing | Development, and local LLM work on non-client data |

**CUDA changes the optional tiers, not the plan.** With an NVIDIA card the
photogrammetry rule-out reverses — **Meshroom/AliceVision's CUDA-gated
depth-map step is satisfied**, so it joins COLMAP as an option. But 8 GB caps
generative image-to-3D to the smaller models:

| Model | Stated requirement | On 8 GB |
| --- | --- | --- |
| Stable Fast 3D | ~6 GB | fits |
| Hunyuan3D-2.0, shape only | 6 GB | fits |
| Hunyuan3D-2.0 + texture | 16 GB | no |
| TRELLIS | official >=16 GB; community FP16 ~8 GB | borderline |
| Hunyuan3D-2.1 | 10 / 21 / 29 GB | no |
| TRELLIS.2 | >=24 GB | no |

**The GPU is not load-bearing.** The ranked-1 photo on-ramp (rectify →
silhouette → `potrace`/OpenCV → DXF) is CPU-only, and OCCT hidden-line removal
for the figure compositor is CPU-bound. The 3070 improves the optional
reconstruction lanes and is irrelevant to P5's and P6's primary paths. Do not
design a GPU dependency into either.

### Delivery risk against D1

`.github/workflows/release-desktop.yml` already carries a four-target matrix
(macOS arm64/x64, Linux x64, **Windows x64 `x86_64-pc-windows-msvc`**) with
native per-runner compilation, `.msi`/`.nsis` bundles, and minisign-signed
updater artifacts. It has **never run** — no `professional-desktop-v*` tag
exists. D1 is not satisfiable until it does, and the first execution should be
treated as its own milestone, not a formality at the end.

## What cloud unlocks (D4)

Relaxing the local-only assumption changes several earlier rule-outs. These are
the places where a frontier model or hosted service is simply better, and the
plan should reach for them:

| Capability | Local ceiling | With cloud |
| --- | --- | --- |
| **Numerals from outline-only art** | Blocked — no text layer to parse | A frontier VLM reads the drawing directly. This is the gap `x3` named as unfilled by any vendor: "OCR numerals + trace lead lines from an arbitrary illustrator PDF → structured part map." It is the packet's highest-value feature and cloud is what makes it tractable |
| **CAD codegen** | 2B-8B specialists collapse on real geometry (Text2CAD-Bench) | GPT-5.2 / Claude 4.5 lead every 2026 human-curated bench. Local specialists were never competitive here |
| **Image → 3D** | 8 GB caps to Stable Fast 3D / Hunyuan3D-2.0 shape-only | Hunyuan3D 3.1 Pro (8-view, ~1.5M faces), Rodin 2.5, Meshy 6, Tripo P1 — all API-only, all better |
| **Text → CAD** | none worth shipping | Zoo Text-to-CAD, adam.new become real options |

What does **not** change, because these were geometry and licence arguments
rather than confidentiality arguments:

- A rough solid is still a worse Fusion starting point than a good sketch
  (history-based modelling + the ~10,000-facet `Convert Mesh` ceiling).
- The DWG licence wall is unchanged — GPL and redistribution terms do not care
  where inference runs.
- The `1.84` compositor is still the gap, and hidden-line removal is still CPU
  geometry.

## Scope

**In**

- A new dock panel in `apps/professional-desktop` for viewing matter CAD.
- `packages/drivers/*` for engine wrappers (OCCT WASM, DWG preview, DXF).
- `CadModel` / `CadFigure` / `ReferenceNumeral` concepts in
  `packages/law-practice/domain`, scaffolded via `bun run beep architecture`.
- A byte read-back path — the app currently **cannot** re-read a file after
  intake, which blocks every viewer feature.
- `cad_*` read tools on the existing practice-KG MCP surface.

**Out (this packet)**

- Text-to-CAD / model generation of any kind.
- Filing-ready `37 CFR 1.84` compliance certification.
- Replacing the human illustrator.
- Design-patent shading grammar (`37 CFR 1.152`) — materially different rules.

## Constraints

- **Confidentiality is a recorded decision, not a wall.** Cloud models and
  services are available. What the software owes is provenance: which service
  saw which artefact, under which matter's consent record, and when. ABA Formal
  Op. 512 is explicit that boilerplate engagement language is not informed
  consent — so the consent record is a product feature, not a checkbox.
- **Repo laws.** Schema-first; Effect v4 validated against `.repos/effect`;
  `HashMap`/`HashSet` only; `Effect.fn`/`Effect.fnUntraced`; no raw
  `useState`/`useEffect` for product state; new packages via
  `bun run beep create-package`; new concepts via `bun run beep architecture`.
- **Licence hygiene.** OCCT-family WASM is LGPL-2.1 — ship the `.wasm` as a
  replaceable loose file with `THIRD_PARTY_NOTICES`. No AGPL (Chili3D,
  xeokit). No GPL DWG reader linked or bundled in any form.
- **CSP.** `worker-src 'self'`, no `unsafe-eval`. Workers must use the literal
  `new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })`
  form or packaged CSP rejects them.

## Format tiers (not one milestone)

| Tier | Formats | Path | Cost |
| --- | --- | --- | --- |
| T1 | PDF, `.ai` (PDF-compatible) | render + extract text layer | Near-free; highest graph payoff |
| T2 | STEP / STP | `occt-import-js` (7.6 MB WASM, LGPL) in a worker | Low; production-proven |
| T3 | DWG | embedded preview bitmap for the grid; DXF via a **user-installed** converter discovered on `PATH` | Medium; licence-constrained |
| T4 | `.3dm`, `.sldprt` | `rhino3dm` is permissive; SolidWorks needs upstream conversion | Rhino low, SolidWorks effectively closed |

## Acceptance

- [ ] A dock panel opens a matter's PDF/`.ai` figure sheet and a STEP part.
- [ ] Byte read-back exists: a panel can fetch a file it did not just drop.
- [ ] `.ai`/PDF text extraction produces a `{numeral → occurrences}` map
      persisted as `ReferenceNumeral` records linked to a `PatentAsset`.
- [ ] The `37 CFR 1.84(p)(4)–(5)` bijection is computed and reportable:
      numerals in drawings but not spec, in spec but not drawings, and one
      numeral bound to two parts.
- [ ] DWG files render a preview tile in a browsable grid with no GPL code
      linked into the app.
- [ ] `cad_*` MCP tools answer numeral and figure questions locally.
- [ ] A licence audit records every third-party engine and its obligations.
- [ ] Shipped as a PR driven to mergeable via `/yeet`.

## Stop conditions

- The bijection audit cannot be computed from real corpus files — the numeral
  graph is the value, and if it cannot be extracted the packet should stop and
  re-plan rather than pivot to generation.
- DWG support would require linking GPL code or redistributing a converter
  whose terms forbid it.
- A provider's terms conflict with a matter's recorded consent policy.
- Verification needs unnamed credentials, cost, or destructive side effects.
