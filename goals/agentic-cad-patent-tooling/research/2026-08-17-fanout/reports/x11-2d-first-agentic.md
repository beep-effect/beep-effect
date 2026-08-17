# X11 — 2D-native agentic drawing vs 3D-then-project for patent figures

**Lane:** x11-2d-first-agentic
**Date:** 2026-08-17
**Status:** FINAL
**Question:** Is 2D-native agentic drawing a better path to patent figures than 3D-then-project?

**Confidentiality:** Public sources and the study's already-disclosed corpus *counts* (837 DWG, 201 STEP) only. No client figure content, unpublished specs, or pre-publication drawings.

---

## Verdict (read this first)

**Ship a hybrid whose canonical representation is a 2D scene graph. Treat 3D-then-project as an importer, not the architecture.**

A text → parametric solid → hidden-line projection → 2D figure pipeline is the right *manufacturing-drawing* architecture. It is the wrong *default* for this practice, for three independent reasons:

1. **Most patent figures have no underlying solid.** Method flowcharts, system block diagrams, circuits, chemical structures, GUI screens, graphs, tables, gene sequences, and program listings cannot be projected from a BREP. The academic figure-type taxonomies (CLEF-IP / Extended CLEF-IP / PatFigCLS) exist precisely because patents are a mixed visual language, not a catalogue of device orthographics. DeepPatent and DeepPatent2, the largest “patent drawing” corpora, are **design-patent** line drawings and must not be used as a utility-figure census.
2. **This practice already works in 2D.** The live working set is DWG-dominant (837 files) with SVG/AI as the figure deliverable and only 201 STEP solids. The filed artifact is black-line vector art under 37 CFR §1.84, not a solid that happens to have been projected.
3. **The daily job is edit-in-place.** Adding a reference numeral, cloning a lead line, producing a continuation variant, or restyling a flowchart is a 2D scene-graph mutation. A 3D-first system makes the common job go through the hardest step (author a correct solid) to change a label.

3D-then-project is still **mandatory as a lane** whenever a correct solid exists or is worth building: multi-view consistency, true hidden-line occlusion, section/detail cuts, exploded assemblies that must stay geometrically honest. That is a specialist importer into the 2D graph, not the trunk of the system.

What would change this mind is listed at the end. The short version: a figure-type census of *this* practice’s filed sheets showing a majority of true multi-view HLR device drawings, or inventor intake becoming STEP-first.

---

## 1. The 3D → project path

### 1.1 What the stack actually is

The open stack is one kernel with three faces:

| Face | What it is | Integration surface | Headless? |
| --- | --- | --- | --- |
| **OCCT HLR** | `HLRBRep_Algo` (exact B-rep vs faces) and `HLRBRep_PolyAlgo` (tessellated, faster, polygonal) | C++ API: Projector → Add shape → Update → Hide → extract edges | Yes. Pure geometry, no GUI. |
| **build123d** | Python over OCP/OCCT. `Part.project_to_viewport(origin, up, look_at)` returns `(visible_edges, hidden_edges)`. `TechnicalDrawing` is a *page border / title block*, not a TechDraw workbench. | Python library. `ExportSVG` writes visible/hidden as layers. | Yes. |
| **FreeCAD TechDraw** | App-side HLR, section, detail, balloons, first/third-angle projection groups. Page SVG/PDF is **Gui**. | `FreeCADCmd` / `import FreeCAD` for App; `TechDrawGui.exportPageAsSvg/Pdf` needs Qt offscreen. | **Conditional.** HLR itself is synchronous without `QApplication`. Composed sheet export is not. |

Primary sources:

- OCCT 8.0.1 `HLRBRep_Algo`: a framework that “calculates the visible and the hidden parts of the shape” by comparing each edge to each face for a given projector. Exact result; superimposed lines are **not** eliminated; points are not treated; complicated shapes are “time-consuming.” PolyAlgo trades exactness for speed. ([OCCT HLRBRep_Algo](https://occt3d.com/dev/doc/refman/html/class_h_l_r_b_rep___algo.html), checked 2026-08-17)
- build123d technical-drawing tutorial (docs dated with `design_date=2025-05-23` in the sample): `project_to_viewport` → translate onto an A4 `TechnicalDrawing` border → `ExportSVG` with `Visible` and `Hidden` (`ISO_DOT`) layers → dimensions via `ExtensionLine` / `Draft`. ([build123d tech drawing tutorial](https://build123d.readthedocs.io/en/latest/tech_drawing_tutorial.html), checked 2026-08-17)
- Sibling lane R4 on a live FreeCAD `26.3.0-dev` tree: `FreeCADCmd` runs TechDraw **App** HLR/section/detail/balloons with no X11. `TechDrawGui.exportPageAsSvg/Pdf` is registered only from `InitGui.py` and walks `Gui::Application` view providers. Two shipping shapes: (A) headless App + `writeDXFPage` / `projectToSVG` edge dumps, no composed sheet; (B) `QT_QPA_PLATFORM=offscreen` for real page SVG/PDF. CadQuery/build123d sit on the same kernel and have **no TechDraw equivalent**. (local `reports/r4-freecad.md`, 2026-08-17)

Quaoar’s 2023 note on an older comparative study is the honest quality bar: OCCT HLR is “quite Okay for small assemblies and single parts,” and the algorithm has been a “never-ending story” of incremental fixes versus commercial kernels. ([Quaoar, Hidden Line Removal / Comparative Study](https://www.quaoar.su/blog/page/hidden-line-removal-comparative-study), 2023-08-08; study PDF dated 2021-02-28)

CadQuery’s own SVG exporter has a long-standing partial-occlusion bug (`exportSvg` draws edges that start visible and then dive behind a face). That is the cheap path, not HLR. ([CadQuery #593](https://github.com/CadQuery/cadquery/issues/593), opened 2021-01-18, still the reference complaint)

### 1.2 What you get for free

Once — and only once — a **correct** solid (or assembly) exists:

1. **Correct occlusion.** Visible vs hidden edges fall out of `Hide()`. Hidden lines become the ISO dashed layer USPTO drawings expect for internal structure. You do not have to *guess* what is in front.
2. **Consistent multi-view.** Front / top / side / iso are the same geometry under four projectors. Change a hole diameter, re-project, all views update together. This is the entire point of a manufacturing drawing and the reason design-patent six-view sets exist.
3. **Section and detail views.** A cutting plane through the solid is a real intersection, not an artist’s hatched guess. FreeCAD `DrawViewSection` / `DrawViewDetail` and OCCT section tools do this. build123d can `section` a part and then project the result.
4. **Exploded assemblies that stay honest.** Offset instances of the same solids along assembly axes, then project. Lead lines and balloons can be placed on the projected edges. The explosion cannot invent a part that is not in the assembly.
5. **Exact (enough) geometry.** Exact HLR produces real 2D curves (lines, circles, ellipses, B-splines of silhouettes), not a pixel tracing. That is why patent illustrators who *do* start from CAD prefer the CAD package’s own HLR export (Edge/Patently said this out loud in 2023: CAD upload → line drawing is *not* supported; use the CAD tool’s HLR, then label). ([Edge blog, 2023-11-28](https://blog.withedge.com/p/assistant-magic-text-to-figure-detailed-spec), cited in sibling x3)
6. **Downstream cheapness *after* the model exists.** New embodiment? Tweak a parameter. Continuation that adds a port? Edit the solid, re-project the view set, re-drop numerals onto the same semantic faces if you kept a face→numeral map.

### 1.3 What it costs

The cost is the thing the rest of this report is about: **you must first have a correct 3D model, and that is the hard part.**

- **Text-to-CAD is not solved at attorney-sign-off quality.** Sibling landscape work (adam.new, Zoo/KittyCAD, CadQuery codegen) consistently shows that getting a plausible solid is easier than getting the solid the inventor actually built. A wrong solid produces *confidently wrong* hidden lines — the worst failure mode for a figure an attorney will swear to.
- **Most figure types have no solid to project** (census, §3).
- **Patent figures are allowed — and often required — to be schematic.** Exploded views omit fasteners. Flow arrows ignore occlusion. A “processor 102 coupled to a memory 104” block is *more* truthful than a photorealistic PCB. 3D-then-project fights that convention.
- **Numerals, lead lines, and §1.84 sheet assembly are not in the solid.** Every 3D pipeline still ends in a 2D compositor. FreeCAD’s composed sheet is the Gui. build123d’s tutorial hand-places `ExtensionLine` and `Text`. You are writing a 2D figure tool either way.
- **HLR quality is a long tail.** Superimposed edges, silhouette gaps on fillets, section hatching, and large assemblies are where OCCT still loses to commercial kernels (Quaoar). Patent line art is unforgiving of a missing silhouette.
- **Packaging.** Dragging FreeCAD+Qt+Coin3D into a Tauri desktop app for *page* SVG is a real cost. build123d/CadQuery package cleaner and stop at edges. Someone still has to compose the sheet.

**Position:** 3D→project is a **high-leverage importer** for the subset of work where a solid is the source of truth. It is a **disastrous default** if the system refuses to emit a figure until a solid exists.

---

## 2. The 2D-native path

### 2.1 What it is

An agent authors or edits **2D vector** directly:

| Tool | Role | Integration | Privilege |
| --- | --- | --- | --- |
| **`ezdxf`** | Read/modify/write DXF; native `SVGBackend` since 1.1 (no matplotlib required); CLI `ezdxf draw -o file.svg` | Python, MIT | Local |
| **SVG emission** | Direct `<g>`, `<path>`, `<text>`, `<line>` with stable `id`s | Any language | Local |
| **Diagram-as-code** | Mermaid, Graphviz/DOT, D2 → SVG | CLI + libraries | Local |
| **Canvas SDKs** | tldraw / Excalidraw scene graphs; agent kits that create/move shapes | TypeScript | Local if self-hosted |
| **2D constraint sketcher** | PlaneGCS or SolveSpace `slvs` under a scriptable sketch | Python/C | Local; WASM is *possible*, not a product |

`ezdxf` is explicitly “create new DXF documents and read/modify/write existing DXF documents” with a drawing add-on that renders model/paper space to SVG/PDF/PNG. ([ezdxf docs](https://ezdxf.readthedocs.io/), checked 2026-08-17; [SVG export tutorial](https://ezdxf.readthedocs.io/en/stable/tutorials/image_export.html))

That matches the corpus: DWG in, DXF as the interchange, SVG/AI as the illustrator deliverable, PDF as the filing target.

### 2.2 What you get

1. **Coverage of figure types that have no 3D model.** Flowcharts, block diagrams, circuit schematics, chemical structures, method-step figures, GUI frames, graphs, tables. These are the majority of *software-related* utility work and a large slice of mixed electrical/medical dockets. They are first-class 2D objects.
2. **Schematic honesty.** Patent figures are legal illustrations, not shop drawings. A draftsman routinely: omits hidden detail that does not aid the claim; uses exploded or “ghosted” parts; draws a cloud around a modified region; uses a single representative chip for a family. 2D-native does not have to unlearn manufacturing conventions.
3. **Edit locality.** “Add numeral 214 to the existing gearbox figure” is: insert a text node + leader, on a layer, with an id. It does not require reconstructing a solid from a 20-year-old DWG.
4. **LLM fit.** Models are dramatically better at emitting **graph text** (Mermaid/DOT/D2) and **structured scene JSON** than they are at emitting a watertight B-rep. See §4.
5. **The actual last mile is already 2D.** 37 CFR §1.84 and MPEP §608.02 care about black lines, margins, 1/8-inch numerals, sheet size, and reproduction. The USPTO does not ingest STEP.

MPEP §608.02 explicitly lists “graphical illustrations, diagrammatic views, flowcharts, and diagrams” as drawings that belong on drawing sheets, not in the specification. Utility drawings “do not require any particular views.” ([MPEP 608](https://www.uspto.gov/web/offices/pac/mpep/s608.html), checked 2026-08-17)

### 2.3 What it costs

1. **No occlusion guarantees.** An agent drawing a perspective device in SVG will happily put a hidden edge in front, clip a shaft through a housing, or shade a face that §1.84 will reject. Mechanical perspective and true section views are where 2D-native is *weaker*, not stronger.
2. **No dimensional truth.** A 2D sketch can be made to look like 25 mm without being 25 mm. Constraint solvers (§5) recover some of this; they do not recover a missing third dimension.
3. **Multi-view drift.** Front and side views authored separately will disagree after the third continuation. This is the classic draftsman failure mode, and the reason 3D-then-project exists.
4. **Exploded-view physics.** A 2D explosion is a composition. Parts can be forgotten, scaled inconsistently, or stacked in an order that implies an assembly that does not work.
5. **DWG fidelity.** Reading 837 AutoCAD DWGs losslessly is its own project (sibling x9). `ezdxf` is DXF, not DWG; LibreDWG/ODA sit on the other side of a license wall.

**Position:** These costs are real and they are **concentrated in one figure family** (device multi-views / sections / honest explosions). They are not a reason to route flowcharts through a solid modeler.

---

## 3. Figure-type census (the crux)

### 3.1 There is no published USPTO-wide figure-type histogram

This must be said before any percentage. I found **no** dataset that classifies a random sample of *all* US utility figures into “perspective device / exploded / section / flowchart / block / circuit / chemical / GUI / graph.” Every large public corpus is either:

- **design-patent only** (DeepPatent, DeepPatent2), or
- **utility, but restricted IPC + class-balanced for ML** (CLEF-IP 2011, Extended CLEF-IP, PatFigCLS Type split), or
- **text classification** (PatentNet — not figures).

Anyone who quotes DeepPatent’s 350k images as “most patent figures are device drawings” is quoting **design patents**. That is a different statute, a different drawing grammar (six orthographic views + perspective of ornamental appearance), and ~14% of 2025 USPTO grants.

### 3.2 What the datasets actually are

**DeepPatent (WACV 2022).** “More than 350,000 **design** patent drawings” from USPTO, built for retrieval, not type taxonomy. ([Kucer et al., DeepPatent](https://openaccess.thecvf.com/content/WACV2022/papers/Kucer_DeepPatent_Large_Scale_Patent_Drawing_Recognition_and_Retrieval_WACV_2022_paper.pdf); [GitHub](https://github.com/GoFigure-LANL/DeepPatent-dataset))

**DeepPatent2 (Scientific Data 2023).** “More than 2 million” / paper body: **2,785,762 segmented industrial design patent figures**, 14 years of US design patents (2007–), with automatically tagged projections and objects extracted from captions. ([Ajayi et al.](https://www.nature.com/articles/s41597-023-02653-7), 2023-11). This is the source PatFigCLS uses for *Projection / Object / USPC*, not for utility figure *type*.

**CLEF-IP 2011 image classification.** Utility patent images labeled into **nine** types: drawing, chemical structure, program listing, gene sequence, flowchart, graph, mathematics, table, symbol. ([Piroi et al., CLEF-IP 2011](https://ceur-ws.org/Vol-1177/CLEF2011wn-CLEF-IP-PiroiEt2011.pdf); [Hanbury et al. PaIR 2011 survey](https://dl.acm.org/doi/pdf/10.1145/2064975.2064979))

**Extended CLEF-IP 2011 (Ghauri, TPDL 2023).** Adds a tenth class, `block_or_circuit`, because “circuit diagrams… are an important type of visualization frequently used in patents.” **35,926** utility figures. Source IPC subclasses (from the EPO ViP@Scale write-up of the same group’s later work): **A43B (footwear), A61B (medical instruments), H10L (semiconductors)** — not a random USPTO draw. ([Ghauri et al. arXiv:2307.10471](https://arxiv.org/abs/2307.10471), 2023-07-19; [Zenodo dataset](https://zenodo.org/records/10019328); [EPO ViP@Scale slides](https://link.epo.org/elearning/en-ARP2021_Ewerth.pdf), citing the 10 types)

Ghauri Table 1 (reconstructed from the PDF text layer; train sets are **capped / balanced**, so they are **not** a population histogram):

| Type (Extended CLEF-IP) | Train | Val | Test |
| --- | ---: | ---: | ---: |
| Block / circuit | 450 | 50 | 100 |
| Chemical | 5,362 | 595 | 112 |
| **Drawing** | 5,009 | 556 | 274 |
| Flowchart | 279 | 31 | 102 |
| Gene sequence | 5,385 | 598 | 24 |
| Graph | 1,497 | 166 | 193 |
| Maths | 5,355 | 595 | 126 |
| Program listing | 5,016 | 557 | 26 |
| Symbol | 1,421 | 157 | 17 |
| Table | 4,952 | 550 | 66 |

Two readings, both legitimate:

- **Taxonomy reading (strong):** of the ten types the community bothers to label, **nine have no 3D model.** Only `drawing` is a candidate for HLR. That is the architectural fact.
- **Histogram reading (weak):** the test split has drawing as the single largest class (274/1,040 ≈ 26%), but the collection is footwear + medical + semiconductor and the splits are constructed for classification. **Do not treat 26% as “26% of US patent figures are device drawings.”**

**PatFigCLS / PatFigVQA (Awale et al., Jan 2025).** Reuses Extended CLEF-IP for *Type* (10 concepts, 1,040 test images) and DeepPatent2 for *Projection* (7), *USPC* (32), *Object* (1,447). Confirms the same type list and adds that LVLMs can classify type reasonably and struggle on subtle projections. ([arXiv:2501.12751](https://arxiv.org/abs/2501.12751), 2025-01-22)

**USPTO-PIP (Ghauri, from Wei et al. 2022 captions).** Among design-like view-labeled figures with >1,000 samples:

| View family | N (train-scale counts in Table 1) |
| --- | ---: |
| Perspective | 6,140 |
| Non-perspective (ortho family) | 18,470 |
| of which Front | 5,184 |
| Rear | 2,459 |
| Left | 2,407 |
| Right | 2,360 |
| Top | 3,260 |
| Bottom | 2,800 |

So **when a figure is a device view, it is mostly orthographic, not isometric.** That is exactly the set HLR is good at — and it is a *subset* of drawings, which are a *subset* of figures.

**Qatent PatFig (ICCVW 2023).** 30,000+ figures from 11,000+ **EPO** applications with short/long captions. Useful for captioning, not a type census. ([Aubakirova et al.](https://openaccess.thecvf.com/content/ICCV2023W/CLVL/papers/Aubakirova_PatFig_Generating_Short_and_Long_Captions_for_Patent_Figures_ICCVW_2023_paper.pdf))

**PatentNet** is a *document* multi-label classifier on CPC/IPC text, not a figure dataset. ([Roudsari et al., Scientometrics 2022](https://doi.org/10.1007/S11192-021-04179-4), cited by Awale). Do not use it here.

### 3.3 Technology mix (patents, not figures — a prior)

Utility vs design volume:

- USPTO issued **~325,600 utility** patents in 2024 and **~325,800** in 2025. ([Patently-O, 2025-12-30](https://patentlyo.com/patent/2025/12/surprising-headline-stability.html))
- **~52,000 design** patents in 2025 (+10% YoY), record high. Same source. Design is roughly **14% of grants**, 100% of which are appearance multi-views.

Software-related *utility patents* (GAO 2013 USPC/CPC methodology, not “pure software”):

- **63.5%** of US utility grants in 2022, **62.7%** in 2023 were “software-related.” ([Millien, IPWatchdog, 2023-03-28](https://ipwatchdog.com/2023/03/28/software-related-u-s-patent-grants-2022-remained-steady-chinese-software-patents-rose-8/); [2024-02-29 update](https://ipwatchdog.com/2024/02/29/us-epo-chinese-software-related-patent-grants-steady-2023/))
- Mid-2024 update: **61.0%**. ([IPWatchdog, 2024-08-20](https://ipwatchdog.com/2024/08/20/mid-year-2024-update-u-s-epo-chinese-software-related-patent-grants-remain-steady/))

WIPO world filings (2023 data, published 2025): **computer technology 13.2%** of published applications, electrical machinery 7.2%, measurement 6.2%, digital communication 5.8%, medical 4.9%. Top five = 37.4% and rising. ([WIPO WIPI 2025 highlights](https://www.wipo.int/web-publications/world-intellectual-property-indicators-2025-highlights/en/patents-highlights.html))

**Caveat, do not skip:** “software-related” under the GAO class list includes phones, cars, medical devices, and anything with a processor claim. Those patents typically ship **both** a device drawing **and** flowcharts/block diagrams. The 63% figure is a prior that *flowchart-capable tooling must exist*, not a claim that 63% of sheets are flowcharts.

Practitioner defaults agree on the software figure set even when they disagree on everything else:

- Arapacke: at least five software figures — system, components, main method flowchart, variant flowcharts, computer-readable medium. ([2023-03-29](https://arapackelaw.com/patents/mastering-software-patent-drawings/))
- PatentDrawingAI (2026-05-14): post-*Alice* software patents use flowcharts and block diagrams as “de-facto required”; a typical software set is architecture + one flowchart per independent method claim. ([patent drawing examples](https://patentdrawingai.com/blog/patent-drawing-examples))
- The Patent Drawings Company: “With the possible exception of mechanical drawings, **block diagrams make up the most common drawing included in the patent disclosure.**” ([types of utility illustrations](https://thepatentdrawingscompany.com/types-of-utility-patent-illustrations-in-patent/)) — **UNVERIFIED** as a measured census; treat as practitioner folklore that matches the taxonomy.

### 3.4 An honest estimated distribution (labeled)

I will not pretend a number I did not measure. The table below is an **estimate** for *US utility figure sheets in a mixed modern docket*, blending: (a) 61–63% software-related grants, (b) typical figure recipes per art, (c) CLEF-IP’s proof that non-drawing types are first-class, (d) the fact that even mechanical applications add method flowcharts. **Every cell is UNVERIFIED as a population parameter.**

| Figure family | Est. share of *utility sheets* | 3D-then-project helps? | 2D-native is the native form? |
| --- | ---: | --- | --- |
| Flowcharts / method-step diagrams | 20–30% | No | Yes |
| Block / system / network diagrams | 15–25% | No | Yes |
| Device line drawings (ortho / perspective / partial) | 15–25% | **Yes, if a solid exists** | Possible, error-prone |
| Circuit schematics | 5–10% | No | Yes |
| Exploded assemblies | 3–8% | **Yes (best case for 3D)** | Common in practice, weaker |
| Section / cutaway views | 3–7% | **Yes** | Weak |
| GUI / screenshot line-art | 5–10% | No | Yes (or image-trace) |
| Graphs / plots / waveforms | 3–6% | No | Yes |
| Chemical structures / Markush | 2–5% | No (use cheminformatics) | Adjacent 2D |
| Tables / maths / gene / program listings-as-figures | 2–5% | No | Yes |

**Design patents** (separate, ~14% of grants) invert this table: nearly 100% are multi-view appearance drawings. 3D-then-project is the *right default for a design-patent product*. It is not this study’s primary job unless the practice’s docket says so.

### 3.5 This practice’s corpus as a local prior

The study’s already-disclosed counts:

- **837 DWG** (13.8 GB, edited through 2026-05)
- **201 STEP**
- Vector **SVG / AI** as the figure deliverable

DWG is AutoCAD’s native container. It *can* hold 3D ACIS solids, but the volume ratio (4:1 DWG:STEP, and DWG as the *working* format) plus SVG/AI as the output is the signature of a **2D drafting shop**, not a parametric-solid shop. Even if a fraction of those DWGs are 3D, the thing that gets filed is 2D vector.

**Crux statement, defended:** a 3D-first architecture serves a **minority of figure types** in the US utility mix and a **minority of files** in this practice. It serves a *majority* only if you restrict the product to design patents or to mechanical device sheets where the inventor already has CAD.

---

## 4. Diagram generation in 2026

### 4.1 The reliable path is graph text, not pixels and not raw SVG

By 2025–2026 the industry consensus, with receipts:

| Target | LLM quality | Repair loop | USPTO-ready? |
| --- | --- | --- | --- |
| **Mermaid** | High. “So many examples in the wild… LLMs are pretty good at generating them.” Syntax errors are common and usually fixable from the parser message. | GenAIScript `system.diagrams` repairer (2025-05-16) does exactly this. | No. Colored, anti-aliased, no numerals/leaders. **A draft**, then restyle. |
| **Graphviz/DOT** | High for flow/block. Deterministic layout. Patent-diagram-generator skills already wrap Graphviz with reference numbering. ([Smithery skill](https://smithery.ai/skills/RobThePCGuy/patent-diagram-generator)) | DOT is pickier than Mermaid; still repairable. | Closer. Easy to force black/white, boxy nodes, numbered labels. |
| **D2** | Designed as a modern diagram-as-code language with a compiler to SVG. Same LLM niche as Mermaid. ([d2lang.com](https://d2lang.com/tour/hello-world)) | Compiler errors are a repair signal. | Same as Graphviz: restyle required. |
| **tldraw / Excalidraw** | Good *agent surface*: typed actions, shape IDs, sanitization of hallucinated IDs/coords. Official tldraw Agent starter kit + `agent.prompt('Draw a flowchart…')`. ([tldraw AI docs](https://tldraw.dev/docs/ai), updated 2026-01-31) | Sanitizer layer exists. Spatial quality varies. | Informal aesthetic by default; can be themed. Better as an **editor** than a filing emitter. |
| **Direct SVG** | Weak. Models invent coordinates, break viewBoxes, overlap labels. Research direction exists (“generate demonstration diagrams… as SVGs”) but is framed as *hard*. ([Evaluating LLM-Generated Diagrams via Graphs, arXiv:2510.25761](https://arxiv.org/html/2510.25761v1), 2025-10-29) | Visual QA required. | Only after a schema + linter. |

Microsoft GenAIScript (2025-05-16): first-pass Mermaid from a 1,200-line TypeScript file produced a class diagram with a parse error on `classDef`; a second turn with the parser message repaired it. That is the production pattern: **generate → parse → repair → render SVG → restyle to §1.84.** ([Mermaids Unbroken](https://microsoft.github.io/genaiscript/blog/mermaids/))

Flowchart2Mermaid (Dec 2025) measured the *inverse* problem (image → Mermaid) and got entity F1 > 0.94 and near-1.0 structural scores for GPT-4.1 / Gemini-2.5-Flash. That is not claim→figure, but it shows the **graph abstraction is stable enough** that models can reconstruct it. ([arXiv:2512.02170](https://arxiv.org/html/2512.02170v1), 2025-12-01)

Anecdote that matches attorney workflow: “Claude proposed a complex system diagram… 90% correct… 5 minutes to polish.” ([Awesome Testing, 2025-09-06](https://www.awesome-testing.com/2025/09/mermaid-diagrams))

### 4.2 Can a method-step figure be auto-drafted from claim text?

**Yes, as a first draft, today, and vendors already sell this.** **No, as an unsupervised filing.**

Evidence:

- **PatentPal** (live 2026): drop claims → generate spec **and figures** → export Word + Visio. Figures are flowcharts for methods and block diagrams for systems. This is claim-tree expansion into boxes-and-arrows, not CAD. ([patentpal.com](https://patentpal.com/), checked via sibling x3 on 2026-08-17)
- **AIPLA reviewer Henry H. Perritt** on this generation class: early auto-flowcharts were “fairly detailed but primitive”; an IP Author run “hallucinated drawings for a different invention entirely.” ([AIPLA Innovate review](https://www.aipla.org/list/innovate-articles/ai-aids-for-patent-prosecution---product-review), still live 2026-08-17)
- **Solve Intelligence / DeepIP / Patently Create** all advertise text or sketch → figure, with the independent 2026 take that software patents are the sweet spot and mechanical/chemistry need more iteration. (sibling x3; [Patentext, 2026-07-22](https://patentext.com/blog/solve-intelligence-vs-deepip/))
- **DeepIP PM Robin Kuhn** (2026-03-22): “The hard part is evals. Getting AI to produce work a patent attorney will sign off on is a much more specific problem than making something that sounds plausible.” ([@robinKnFR](https://x.com/robinKnFR/status/2035662712777080859))

So the pipeline that is **real in 2026**:

```
independent method claim
    → claim-tree / step list (structured)
    → Mermaid or DOT (nodes = steps, diamonds = decisions)
    → parse/repair
    → SVG
    → restyle: black  lines, 1/8" numerals, leaders, FIG. n
    → attorney pass (hallucinated steps are the lethal risk)
```

Reliability, my estimate: **structure 80–90%** on a well-written method claim (steps and branches exist in the text); **numeral/spec consistency 50–70%** without a live dictionary; **zero-hallucination of extra steps UNVERIFIED and should be treated as the eval target, not a given.**

**Position:** method-step auto-draft is the highest-ROI 2D-native feature in the product. It does not need, and must not wait for, a solid modeler.

---

## 5. Constraint-based 2D

Is there a scriptable 2D constraint solver worth using? **Yes. Two, both headless as libraries. Neither is a polished “agent sketcher product.” WASM is DIY.**

### 5.1 PlaneGCS (FreeCAD Sketcher’s solver)

- Extracted from FreeCAD Sketcher, LGPL-2.1-or-later.
- **`planegcs` on PyPI** (`pip install planegcs`): Python bindings, documented, example is a fully constrained equilateral triangle. ([spookylukey/planegcs](https://github.com/spookylukey/planegcs), checked 2026-08-17)
- Used outside FreeCAD (SALOME integration discussion on the FreeCAD forum).
- **Headless:** yes. It is a numeric solver, not a GUI.
- **WASM:** no official build found. C++ + Eigen + Boost (Boost being removed in upstream work) — portable in principle, not a 2026 product.
- **Worth using when:** an agent is authoring a *new mechanical 2D figure* that should stay coincident/parallel/equal as the inventor tweaks a dimension, and there is no solid.

FreeCAD Sketcher itself is available headless via `FreeCADCmd` (R4). That is the heavy way to get the same solver plus history.

### 5.2 SolveSpace `slvs`

- First-class **C API** in `include/slvs.h` (“geometric constraint solver… sample code”). Headless by design. ([solvespace/solvespace slvs.h](https://github.com/solvespace/solvespace/blob/master/include/slvs.h))
- **`py_slvs`** (realthunder): SWIG bindings, used as the primary solver for FreeCAD Assembly3. ([realthunder/slvs_py](https://github.com/realthunder/slvs_py))
- **`python-solvespace` / Pyslvs:** another Python wrap on PyPI.
- SolveSpace the *app* exports SVG/PDF/DXF; latest stable cited as 3.2 (2026-03-26) on Wikipedia. ([SolveSpace](https://en.wikipedia.org/wiki/SolveSpace))
- **WASM:** forum threads in 2024–2025 (“I plan to use Solvespace as a WASM component”, “very interested in building the library into a WASM module”) — **interest, not a shipped official WASM solver**. ([forum 2024-07-30](https://solvespace.com/forum.pl?action=viewthread&parent=5794&tt=1722369104); [forum 2025-10-09](https://solvespace.com/forum.pl?action=viewthread&parent=6196&tt=1760062167)). Compiling `slvs` (not the GUI) to WASM is a bounded engineering task, not research.
- Headless modeling of the *full CAD app* was requested in 2019 ([issue #375](https://github.com/solvespace/solvespace/issues/375)); the **solver** was never the blocker.

### 5.3 `ezdxf` + a solver

`ezdxf` has no constraint engine. The composition that makes sense:

```
planegcs / slvs  (parameters, constraints, solve)
        ↓ emit 2D primitives
ezdxf entities / SVG groups  (layers, linetypes, text, numerals)
        ↓
SVG / DXF / PDF
```

Do **not** put the solver inside DXF. DXF is the serialization.

### 5.4 Should the v1 product include a constraint solver?

**Not in the critical path for method/block figures.** Those are graph layout, not GCS.

**Yes as a library behind the “new mechanical 2D figure” lane**, with `planegcs` as the default (pip-installable, 2D-only, LGPL) and `slvs` as the upgrade if 3D sketch constraints or Assembly3-style systems appear.

**WASM:** only if the desktop app must solve in the renderer process. A Tauri sidecar running native `planegcs` is simpler and keeps privileged geometry off a random WASM download.

---

## 6. Edit-in-place: which representation makes an agent best?

The practical job, ranked by how often a solo practice actually types it:

1. Add / move / renumber a **reference numeral** and its leader.
2. Add a small element (a box, a port, a dashed box around a new module).
3. Produce a **variant** for a continuation or a second embodiment.
4. Restyle to survive a drawing objection (line weight, numeral height, margins).
5. Rebuild a view because the inventor changed the hardware.

### 6.1 Score the representations

| Representation | Add numeral | Add element | Continuation variant | Restyle §1.84 | Hardware change | Agent-editability |
| --- | --- | --- | --- | --- | --- | --- |
| **Raster / PDF page** | OCR + hope | Redraw | Redraw | Poor | Redraw | Worst |
| **Naked SVG paths** | Fragile (text may be outlined) | Possible | Copy-paste drift | CSS/attrs if not outlined | Manual | Poor unless IDs exist |
| **Semantic 2D scene graph** (SVG/DXF groups with `id`, `data-numeral`, `data-part`, layers) | **Best** | **Best** | Clone group, edit | **Best** | Local, may drift | **Best** |
| **Diagram-as-code** (Mermaid/DOT/D2) | Good if numerals are in the source | Good | **Best for methods** | Via renderer theme | N/A | Excellent for diagrams; useless for device art |
| **Parametric 2D sketch** (GCS) | Add as annotation layer | Good if constrained | Good if constraints hold | Separate | **Best without a solid** | Good; solver is a tool the agent calls |
| **3D solid + views** | Must live in a 2D overlay (numerals are not BREP) | Requires model edit | **Best for device views** | Overlay | **Best** | Worst unless the solid already exists and is parametric |
| **tldraw/Excalidraw store** | Good (text shapes) | Good | Good | Theme | Manual | Excellent UX, extra format to persist |

### 6.2 The argument

An agent is good when the mutation is **named, local, and checkable**.

- “Insert `text#num-214` at the end of `line#leader-214`, font 12 pt, layer `NUMERALS`” is named, local, and checkable (the numeral dictionary either contains 214 or it does not).
- “Fillet the inner housing and hope the HLR of view B still matches the spec’s ‘cylindrical recess’” is neither local nor checkable without a vision loop.

**Existing figures in this practice are DWG / SVG / AI.** The agent that wins is the one that can:

1. Ingest DWG→DXF (x9) or SVG/AI into a **semantic scene graph**.
2. Keep a **numeral dictionary** (part name ↔ number ↔ list of graphic ids ↔ spec anchors). Sibling x3: this is solved as *proofreading* (ClaimMaster, Patent Bots) and unsolved as *generation*.
3. Apply graph-level edits (add node, add leader, clone group, restyle).
4. Optionally **re-bind** a view to a solid when one exists (`data-source="hlr:part.step:front"`).

3D-as-canonical **inverts** the common edit. To add a numeral you either (a) ignore the solid and edit the projected SVG — at which point the solid is not canonical — or (b) store numerals as 3D billboards, which no patent tool does and which still project to 2D.

Continuation variants split cleanly:

- **Method / system figures:** edit the diagram source, re-render. 2D-native wins by a mile.
- **Device figures with a live parametric solid:** edit the solid, re-project, snap old numeral ids onto unchanged faces. 3D wins.
- **Device figures with only a DWG:** you do not have a solid. Pretending you do means a reverse-modeling project (sibling x6) before you can change a hole. 2D-native wins because it is the only representation you actually have.

**Position:** make the agent native to a **semantic 2D scene graph**. Attach 3D as provenance on some groups. Never the other way around.

---

## 7. Decision

### 7.1 Recommendation

**Hybrid. 2D-native trunk. 3D-then-project is lane 4, not lane 1.**

```
                    inventor inputs
         ┌──────────────┼──────────────┐
         │              │              │
    claims/spec      DWG/SVG/AI      STEP/solid
         │              │              │
         ▼              ▼              ▼
   diagram-as-code   vector ingest    OCCT HLR
   (Mermaid/DOT/D2)  (ezdxf + IDs)    (build123d /
         │              │              FreeCAD offscreen)
         └──────────────┼──────────────┘
                        ▼
              semantic 2D scene graph
              (groups, numerals, layers,
               optional hlr: provenance)
                        │
                        ▼
              §1.84 SVG / PDF sheet
              + numeral dictionary
```

**Build order for this practice:**

1. **Semantic 2D IR + numeral graph.** If you build nothing else, build this. It is the edit-in-place product.
2. **DWG/DXF/SVG ingest** (x9) into that IR. This is where the 837 files live.
3. **Claim → method/block figure** via diagram-as-code + §1.84 restyle. This is where 2026 LLMs are actually good, and where PatentPal/Solve already charge rent.
4. **HLR importer** (build123d `project_to_viewport` first; FreeCAD offscreen only if you need TechDraw section/balloon objects). Bind projected edges into the same IR. Do this when STEP shows up, not before.
5. **Constraint 2D** (`planegcs`) behind “draw a new mechanical view from a dimensioned sketch.” After 1–4.

**Do not build:** a system that cannot emit FIG. 2 of a method claim until CadQuery has produced a solid.

### 7.2 Why this is not a hedge

A hedge would be “support both equally.” This is not that.

- The **source of truth** is the 2D scene graph. 3D is optional provenance.
- The **default generate path** for a new application is: classify the needed figures from the claims (flowchart vs device vs both) → run the 2D lanes → offer HLR only if a solid is present or the figure type demands it.
- The **default edit path** never leaves 2D.

3D-then-project is how you *earn* multi-view consistency. It is not how you *store* a patent figure.

### 7.3 What would change my mind

Change the recommendation toward **3D-first** if any of these become true:

1. **A measured census of this practice’s filed sheets** (on-device, no cloud) shows **>50–60%** of figures are true multi-view / section / exploded device drawings whose geometry is supposed to stay consistent. Taxonomy evidence from CLEF-IP is not a substitute for *this docket*.
2. **Inventor intake becomes STEP-first** — the 201 STEP files grow to dominate the 837 DWGs, and new matters arrive as parametric models.
3. **Text-to-solid reaches attorney-sign-off** on the mechanical subset, so the “correct 3D model is the hard part” premise dies. (DeepIP’s own PM says evals are the unsolved piece as of 2026-03. Watch that.)
4. **USPTO or a major office starts requiring dimensional fidelity** or machine-readable 3D (ST.96 3D is not this yet). Then HLR is compliance, not convenience.
5. **The docket shifts to design patents.** Then invert the trunk: solid + six-view projector, 2D only for labels.

Change the recommendation toward **2D-only (drop HLR entirely)** if:

6. The mechanical device slice is small *and* inventors never send solids *and* a year of edit-in-place logs show zero “please match the other view” failures. I do not believe this today: 201 STEP files and 837 DWGs say mechanical drawing is real work here. Keeping an HLR importer is cheap insurance.

---

## Sources

| # | Source | Used for | Date |
| --- | --- | --- | --- |
| 1 | https://occt3d.com/dev/doc/refman/html/class_h_l_r_b_rep___algo.html | Exact vs poly HLR, limitations | 2026-08-17 |
| 2 | https://build123d.readthedocs.io/en/latest/tech_drawing_tutorial.html | `project_to_viewport`, `TechnicalDrawing`, SVG layers | 2026-08-17 |
| 3 | local `reports/r4-freecad.md` | FreeCADCmd vs TechDrawGui, headless HLR | 2026-08-17 |
| 4 | https://www.quaoar.su/blog/page/hidden-line-removal-comparative-study | HLR quality vs commercial | 2023-08-08 |
| 5 | https://github.com/CadQuery/cadquery/issues/593 | Cheap SVG ≠ HLR | 2021-01-18 |
| 6 | https://ezdxf.readthedocs.io/ | DXF R/W, SVG backend | 2026-08-17 |
| 7 | https://arxiv.org/abs/2307.10471 | Extended CLEF-IP 10 types, Table 1 | 2023-07-19 |
| 8 | https://zenodo.org/records/10019328 | Extended CLEF-IP dataset | 2023-10-18 |
| 9 | https://arxiv.org/abs/2501.12751 | PatFigCLS / type vs projection | 2025-01-22 |
| 10 | https://ceur-ws.org/Vol-1177/CLEF2011wn-CLEF-IP-PiroiEt2011.pdf | CLEF-IP 2011 9-class task | 2011 |
| 11 | https://www.nature.com/articles/s41597-023-02653-7 | DeepPatent2 = design patents | 2023-11 |
| 12 | https://openaccess.thecvf.com/content/WACV2022/papers/Kucer_DeepPatent_Large_Scale_Patent_Drawing_Recognition_and_Retrieval_WACV_2022_paper.pdf | DeepPatent = design | 2022 |
| 13 | https://link.epo.org/elearning/en-ARP2021_Ewerth.pdf | IPC subclasses of Extended CLEF-IP | 2025 slides |
| 14 | https://patentlyo.com/patent/2025/12/surprising-headline-stability.html | Utility vs design grant counts | 2025-12-30 |
| 15 | https://ipwatchdog.com/2024/02/29/us-epo-chinese-software-related-patent-grants-steady-2023/ | 62.7% software-related 2023 | 2024-02-29 |
| 16 | https://www.wipo.int/web-publications/world-intellectual-property-indicators-2025-highlights/en/patents-highlights.html | Computer technology 13.2% of world filings | 2025 |
| 17 | https://www.uspto.gov/web/offices/pac/mpep/s608.html | Flowcharts are drawings; no required views | 2026-08-17 |
| 18 | https://microsoft.github.io/genaiscript/blog/mermaids/ | LLM Mermaid + repair loop | 2025-05-16 |
| 19 | https://arxiv.org/html/2512.02170v1 | Flowchart2Mermaid F1 | 2025-12-01 |
| 20 | https://arxiv.org/html/2510.25761v1 | Direct SVG generation is hard | 2025-10-29 |
| 21 | https://tldraw.dev/docs/ai | Agent canvas APIs | 2026-01-31 |
| 22 | https://patentpal.com/ | Claims → flowchart/block figures | 2026-08-17 |
| 23 | https://www.aipla.org/list/innovate-articles/ai-aids-for-patent-prosecution---product-review | Primitive / hallucinated auto-figures | live 2026-08-17 |
| 24 | https://github.com/spookylukey/planegcs | Scriptable PlaneGCS | 2026-08-17 |
| 25 | https://github.com/realthunder/slvs_py | SolveSpace solver bindings | 2026-08-17 |
| 26 | https://github.com/solvespace/solvespace/blob/master/include/slvs.h | Headless C solver API | 2026-08-17 |
| 27 | https://arapackelaw.com/patents/mastering-software-patent-drawings/ | Software figure recipe | 2023-03-29 |
| 28 | https://patentdrawingai.com/blog/patent-drawing-examples | Software figure recipe 2026 | 2026-05-14 |
| 29 | sibling `reports/x3-patent-figure-automation.md` | Vendor figure capabilities | 2026-08-17 |
| 30 | sibling `reports/x9-dwg-dxf-ingest.md` | 837 DWG / 201 STEP counts | 2026-08-17 |

---

*End of x11-2d-first-agentic.*
