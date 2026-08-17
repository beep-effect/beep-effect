# X10 — The Real Patent-Figure Production Pipeline (Vector, Not 3D)

**Lane:** x10-vector-figure-pipeline
**Date:** 2026-08-17 (sources fetched this day unless a publication date is given)
**Status:** complete
**Reader:** technical partner to a US patent attorney whose working corpus is hundreds of live `.svg` / `.ai` files plus AutoCAD `.dwg` — not a 3D-model library
**Method:** USPTO/MPEP primary text, illustrator rate cards, practitioner forums (r/Patents, r/patentexaminer), service-house pages, format specs, academic numeral-OCR papers, TypeScript/library docs, X.com keyword/semantic search
**Confidentiality note:** public sources only. No client corpus, unpublished specification, or pre-publication figure was opened or transmitted.

**How to read this report.** Dates on citations are publication dates or last-checked 2026-08-17. Claims that could not be pinned to a primary page are marked **UNVERIFIED**. X.com is thin and vendor-heavy on this topic; practitioner evidence lives on Reddit, service-house FAQs, and USPTO text.

---

## Executive snapshot

The filed patent FIGURE is a **2D black-line vector drawing** that must survive 37 CFR § 1.84 reproduction rules and then the USPTO's Image File Wrapper, which **throws the PDF away and stores a 300 dpi TIFF**. A 3D model is, at most, an *inventor input*. It is not the figure, not the filing object, and not the durable work product of a working prosecution practice.

That is not a theoretical claim. It is what the 2026 tool chain, the rate cards, the Patent Center PDF rules, and an in-house draftsman's r/patentexaminer thread all say.

**What draftsmen actually ship**

| Step | What moves | Typical format | Who |
| --- | --- | --- | --- |
| 1. Intake | Photos, sketches, CAD screenshots, SolidWorks/STEP/DWG, marked-up PDFs, a numeral wish-list | JPEG/PNG, PDF, DWG/DXF, sometimes a physical sample | Attorney / inventor → draftsman |
| 2. Working file | Layered line art, numerals, lead lines, hatching on a § 1.84 sheet | **Illustrator `.ai`**, AutoCAD **DWG**, CorelDRAW, Visio `.vsdx`, Inkscape **SVG** | Draftsman |
| 3. Review loop | 1–2 included revision cycles; attorney marks call-outs | PDF proof (sometimes the editable source) | Attorney ↔ draftsman |
| 4. Filing object | One PDF per sheet or a multi-page drawing PDF | **PDF 1.1–1.6**, fonts embedded, layers flattened | Attorney / filer via Patent Center |
| 5. What the Office keeps | Not the PDF. A **300 dpi (often 1-bit) TIFF** in IFW; original may land in SCORE if filed as “Drawings – Other than Black and White” | TIFF / regenerated PDF | USPTO |

**Economics any automation has to beat:** $28–$39/sheet offshore (PatDraw, Menteso), $100–$125/sheet US Illustrator houses (QuickPatents), $150–$500+ premium. Turnaround 1–7 days, not minutes. AI figure SKUs advertise $2–$4 effective per drawing; they are photo/sketch → line-art toys, not a CAD-faithful last mile.

**The key product idea — numerals as data — is half-solved and half-open.** ClaimMaster and Patent Bots already audit spec ↔ figure numerals **if the figure PDF/Visio/PPT has a text layer**. Nobody sells a robust “OCR numerals + trace lead lines from an arbitrary illustrator PDF → knowledge-graph part map” as an agent-driveable API. Academic work (USPTO 2014 competition, DeepPatent2 2023, PatentOCR July 2026) treats this as a *raster* vision problem because the Office publishes TIFFs, not SVG.

**Canonical internal representation, one sentence:** a **structured SVG scene graph** (physical millimetres, named `<g>` layers, live `<text>` numerals, first-class lead-line paths, hatching as real stroked lines not CSS patterns) plus a **sidecar numeral graph**. PDF is the filing export. DXF/DWG is upstream CAD. The 3D model is optional inventor input. Adobe `.ai` is a dual-stream PDF+private-AI container — readable without Adobe for the PDF preview, not a safe edit source.

The 3D-to-projection assumption in prior lanes of this study is **suspect for this practice**. It is the right model for a mechanical-CAD shop that already owns SolidWorks assemblies. It is the wrong model for a prosecution desk whose live files are SVG, Illustrator, and DWG line art.

---

## 1. How patent draftsmen actually work in 2026

### 1.1 The tool chain is 2D vector, split by invention type

Practitioner evidence (not vendor SEO) is consistent across two r/Patents threads from 2025:

- **Visio** for flowcharts and block diagrams. One attorney: “I use Visio to do the simple stuff like flowcharts and block diagrams. I outsource the rest to a draftsman.” Another: “I use Visio for 100% of what I do” but editing a curve is painful. ([r/Patents, “What software…”, June 2025](https://www.reddit.com/r/Patents/comments/1l3umsv/what_software_or_method_do_you_use_to_draw_the/); [r/Patents, “How to get the drawings done?”, 2025-02-07](https://www.reddit.com/r/Patents/comments/1ik4daa/how_to_get_the_drawings_done/))
- **CorelDRAW, Word, PowerPoint** appear in the same thread as in-house attorney tools. Advice from a practitioner (u/dratoff): “We use Visio (best), Word (sucks), PowerPoint, CorelDraw. If you are trying to save costs find out what software your attorney is most comfortable with, use that. **Make your drawings editable.**” ([same 2025-02-07 thread](https://www.reddit.com/r/Patents/comments/1ik4daa/how_to_get_the_drawings_done/))
- **AutoCAD** is the mechanical-illustrator default in every 2026 “best software” roundup, with 20–40 hour learning curves and no built-in § 1.84 templates. PatentDrawingAI’s May 2026 comparison prices AutoCAD at ~$1,865–$2,030/yr and calls it “the industry default for engineers already in the Autodesk ecosystem.” ([PatentDrawingAI, 2026-05-10 / updated 2026-06-15](https://patentdrawingai.com/blog/best-patent-drawing-software))
- **Adobe Illustrator** is the design-patent / surface-shading / “the drawing *is* the claim” tool. QuickPatents — a US house that has filed 2,400+ patents — states flatly: “**All patent drawings are done in Illustrator format** and delivered to you via .pdf files.” ([QuickPatents drawings page](https://www.quickpatents.com/drawings/), checked 2026-08-17)
- **Inkscape / Affinity Designer / LibreOffice Draw** are the free/cheap attorney-side editors. Affinity Designer v3 became free after the Canva acquisition (October 2025) — **UNVERIFIED** beyond PatentDrawingAI’s claim, but consistent with Canva’s public Affinity move. Inkscape is SVG-native and the only serious headless Linux editor. ([PatentDrawingAI software list, 2026-06-15](https://patentdrawingai.com/blog/best-patent-drawing-software); [Inkscape wiki, “Inkscape for Adobe Illustrator users”](https://wiki.inkscape.org/wiki/Inkscape_for_Adobe_Illustrator_users), last revised ~2020, still the live wiki page 2026-08-17)
- **SolidWorks / Fusion / FreeCAD** generate *views*, not figures. r/Patents: Fusion users cannot “convert the design into drawing in patent format.” A SolidWorks user: it “takes some post processing” and “is not very good with some drawing specifics, e.g. hatching.” An X.com founder/CTO, 2026-08-15: “None of the CAD apps I use can put together patent drawings using AI. In any case these get reviewed by patent attorneys & probably changed anyway.” ([@GregAtkinson_jp, 2026-08-15](https://x.com/GregAtkinson_jp/status/2088437064547324326); [r/Patents Fusion thread](https://www.reddit.com/r/Patents/comments/1l3umsv/what_software_or_method_do_you_use_to_draw_the/))

Menteso, an India-staffed house at $29/$39 per sheet, lists its stack in FAQ as “**AutoCAD, MS Visio, CorelDRAW, AutoDesk Inventor, SolidWorks**.” Intake explicitly includes “sketches, photos, videos, 3D files and Solid Works files.” The 3D file is an *input*. The deliverable is a PTO sheet. ([Menteso patent-drawings page](https://menteso.com/patent-drawings/), checked 2026-08-17)

Northern Virginia Graphics sells the attorney-side version of the same idea: **Visio-ready** layered files so the lawyer can drop numerals while drafting the spec, instead of ping-ponging PDFs. That is a real product slot — “give the attorney an editable vector file, not a locked PDF.” ([NVG Visio services](https://nvg-inc.com/microsoft-visio-patent-drawing-services/), checked 2026-08-17)

**PerspireIP’s 2026 ranking** lists AutoCAD, “PatentOrder,” Illustrator, Visio, SolidWorks, Inkscape, CorelDRAW. **PatentOrder as a real, purchasable product is UNVERIFIED** — it appears in that one SEO article with a $99/mo claim and no independent corroboration in this pass. Treat the rest of that article as marketing paraphrase of § 1.84, not as a primary source. ([PerspireIP, 2026-04-24](https://www.perspireip.com/blog/patent-drawing-software/))

### 1.2 Attorney → draftsman handoff

The handoff is not “here is a STEP file, project it.” It is a **brief plus pictures**:

1. Attorney (or inventor) sends **photos of a prototype, pencil sketches, existing CAD screenshots, or a DWG/SolidWorks file**, plus a list of views wanted (front/side/top/perspective/exploded/section) and often a first-pass numeral scheme written on printouts. QuickPatents: “If you have digital photos, please print these out and **label them as appropriate with numerical call-outs, figure numbers, etc.** before sending them to us.” Design patents require “very detailed sketches or photos … from all angles (front, back, left side, right side, top, bottom, and one perspective view) … or an actual product sample.” ([QuickPatents](https://www.quickpatents.com/drawings/))
2. Draftsman **traces** — not photogrammetry, not hidden-line 3D. A US attorney on r/Patents: “if you've got a prototype, I sometimes will take a photo of it, put it into a paint program with like 80% transparency turned on, **trace the lines**, and then delete the photo.” ([r/Patents, 2025-02-07](https://www.reddit.com/r/Patents/comments/1ik4daa/how_to_get_the_drawings_done/))
3. First PDF proof comes back in **1–7 days**. QuickPatents: “delivered within a week,” two included revision cycles, third draft is final, further cycles hourly. Menteso: “1–4 days,” “Iterations – Will NOT be Charged,” India day-shift 6AM–5PM PST. ([QuickPatents](https://www.quickpatents.com/drawings/); [Menteso](https://menteso.com/patent-drawings/))
4. Attorney marks **additional call-outs, missing lead lines, “make this an exploded view,”** and sends the PDF back. Scope changes (new figures, perspective → exploded) are not “minor” and get re-quoted.
5. Final delivery is **PDF for Patent Center**. Better houses also archive the **Illustrator / DWG / Visio source** for the inevitable replacement sheet two years later. QuickPatents: “archived for future tweaks” and “done in Illustrator format … delivered … via .pdf.” NVG: the *point* of Visio-ready files is that the attorney keeps the editable source.

This is why a working corpus that is 552 `.svg` + 175 `.ai` + 837 `.dwg` is not a mystery. It is exactly the three working-file dialects of this pipeline: **SVG (Inkscape / interchange), AI (Illustrator house), DWG (AutoCAD house)**. The 3D model, if it exists, is sitting in the inventor’s SolidWorks seat, not in the attorney’s figure folder.

### 1.3 Turnaround and per-sheet pricing (2026, live cards)

| Tier | Posted rate | Turnaround | Source (checked 2026-08-17) |
| --- | --- | --- | --- |
| Offshore / India-staffed | **$28/sheet** (PatDraw); **$29 utility / $39 design** (Menteso) | 1–5 days (Menteso 1–4) | [PatDraw press release](https://www.effectualservices.com/press-release/patdraw-launches-professional-patent-illustrations-at-just-28-per-sheet); [Menteso](https://menteso.com/patent-drawings/) |
| US Illustrator house | **$100 utility / $125 design** per sheet; two free revision cycles | ~1 week | [QuickPatents](https://www.quickpatents.com/drawings/) |
| Specialized firms (survey) | **$50–$150 / sheet** | 2–5 days | [PatentDrawingAI cost guide, 2026-05-20](https://patentdrawingai.com/blog/patent-drawing-cost) — vendor-authored, treat as a compiled range not a primary card |
| Premium / biotech | **$150–$500+ / sheet** | 3–10 days | same survey |
| Freelancers (Upwork/Fiverr) | **$25–$75 / sheet** | 3–7 days | same survey |
| AI figure SKUs | **~$2–$4 effective** on subscription | minutes | [PatentDrawingAI](https://patentdrawingai.com/blog/patent-drawing-cost) self-report |

Hidden costs that rate cards bury: rush 24–48 h surcharges, “new figure / exploded-from-perspective” re-quotes, and **format-conversion extras** (EPS, TIFF, layered AI). PatentDrawingAI’s own cost article admits traditional houses “charge extra for EPS or TIFF … Layered Illustrator or PDF files.” That last item is the thing a knowledge-graph system should *be* — the layered source — not an upsell.

### 1.4 File formats at each step (what actually changes hands)

```
inventor CAD (STEP/SLDPRT/DWG) ─┐
photo / napkin sketch ──────────┼─→ draftsman working file (.ai | .dwg | .vsdx | .svg)
attorney markup on PDF ─────────┘              │
                                               ├─ review PDF (flattened, fonts outlined or embedded)
                                               └─ filing PDF (Patent Center, PDF 1.1–1.6)
                                                         │
                                                         ▼
                                              USPTO IFW TIFF @ 300 dpi
                                              (+ SCORE original if DOTBW)
```

**Software should slot in at four places, not at “text-to-CAD”:**

1. **Ingest** the working file (SVG / PDF-compatible AI / DXF extracted from DWG) *without* sending it to a cloud model.
2. **Hold a structured figure IR** whose numerals and lead lines are data (section 4).
3. **Audit** spec ↔ figure numerals the way ClaimMaster/Patent Bots already do when a text layer exists.
4. **Export** a Patent-Center-safe PDF that is *still vector* on the way in, knowing the Office will rasterize it — so line weight and 1-bit purity matter more than 2400 dpi (section 6).

X.com is almost useless as primary evidence here. A 2026-08-17 keyword search for `patent drawing|illustration|illustrator` returns Samsung leak posts, a Kawasaki robot-horse recap, and one founder saying CAD apps cannot emit patent drawings ([@GregAtkinson_jp](https://x.com/GregAtkinson_jp/status/2088437064547324326)). Semantic search for “Illustrator AutoCAD SVG USPTO figures” returns logo-animation and DALL·E product-shot threads. **Do not treat X as a practitioner forum for this topic.**

---

## 2. The `.ai` format — a PDF with a secret second brain

### 2.1 What an `.ai` file actually is

A modern Adobe Illustrator `.ai` file is **a PDF container** (`%PDF-1.5` header and all) that *may* also carry a private Illustrator-native stream.

- Saved **with** “Create PDF Compatible File” (the default): Acrobat, Preview, pdf.js, Ghostscript, Inkscape, and `pdf2svg` can all *see* a page that looks like the artboard. Optional-content groups (layers) may appear in the PDF catalog. The **real** Illustrator document — swatches, live effects, native layers, artboards as AI understands them — lives in a private stream Illustrator consults first. ([Datalogics, “Adobe Illustrator and PDF Compatibility”, 2022-04-06](https://www.datalogics.com/adobe-illustrator-and-pdf-compatibility))
- Saved **without** PDF compatibility: the file still has a PDF header, but the only visible page is a warning: *“This is an Adobe Illustrator File that was saved without PDF Content.”* Non-Adobe tools are blind. ([same Datalogics article](https://www.datalogics.com/adobe-illustrator-and-pdf-compatibility))
- Edit the PDF side in Acrobat and reopen in Illustrator: Illustrator detects the two streams have diverged and offers **keep AI (discard PDF edits)** or **keep PDF (lose Illustrator-native features such as swatches)**. There is no merge. ([same](https://www.datalogics.com/adobe-illustrator-and-pdf-compatibility))

Adobe’s own format list still treats `.ai` as a first-class native and lists DWG/DXF as import formats — the same two worlds this corpus already has. ([Adobe “Supported file formats”, updated 2025-10-27](https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/supported-file-formats.html))

**Implication for a Linux/Tauri app:** treat `.ai` as “PDF preview + maybe-recoverable vectors,” never as a round-trippable edit format. If the attorney’s house saved PDF-compatible (almost all do, because they email PDFs), you can render and even extract paths. You cannot write a new `.ai` that Illustrator will treat as native without Adobe.

### 2.2 What you can do without Adobe, and what you lose

| Tool | Reads PDF-compatible `.ai`? | What you get | What you lose |
| --- | --- | --- | --- |
| **pdf.js** | Yes, as PDF | On-screen render, text-layer extraction if glyphs were not outlined | AI private stream, artboards-as-AI, live effects, some OCG/layer semantics |
| **Ghostscript** | Yes | Raster or PDF rewrite; `pdf2ps` / `pdfwrite` | Same; also any AI-only constructs |
| **Poppler `pdftocairo -svg` / `pdf2svg`** | Yes | One SVG per page via Cairo | Layers flattened or approximated; text sometimes paths, sometimes `<text>`; gradients/meshes degraded; no AI private data |
| **Inkscape** (internal Poppler, or `--pdf-poppler`) | Yes, AI since version 9 | Editable SVG; default import **keeps text as text**; meshes → tiled approximations; transparency modes don’t work | Gradient meshes, multiple strokes/fills per object, ICC/PMS, native AI layers/artboards. Wiki: “Inkscape opens Adobe’s AI (since version 9) and PDF files (with some limitations).” ([Inkscape wiki](https://wiki.inkscape.org/wiki/Inkscape_for_Adobe_Illustrator_users)) |
| **Inkscape CLI** | `inkscape file.ai --export-type=svg` (or rename `.ai` → `.pdf`) | Same as GUI import | Same |
| **svglib** (Python / ReportLab) | Only if you first treat it as PDF/SVG | SVG→ReportLab; **not** an AI reader | Masks, ForeignObject, limited CSS; the wrong direction for ingest |

Older (pre-AI-9 / EPS-flavoured) `.ai` files need Ghostscript and are often opened by renaming to `.eps`. Linux Inkscape usually detects PDF-1.5 `.ai` without the rename; a 2018 `file(1)` on a CC2018 `.ai` reports `PDF document, version 1.5`. ([LogosByNick, “Open and Create AI Files With Inkscape”](https://logosbynick.com/open-save-ai-files-inkscape/); Inkscape wiki as above)

**Artboards.** Illustrator artboards become PDF pages only if the author exported them that way. A single `.ai` with six artboards and “PDF compatible” on is often **one PDF page showing the active artboard**, with the other boards living only in the private stream — **UNVERIFIED** as a hard rule (Adobe community answers conflict by version and by “Export for Screens” vs “Save As”). Do not assume one-artboard-per-figure without inspecting page count.

**Layers.** PDF Optional Content Groups *may* survive in the PDF-compatible stream (Datalogics observed `/OCGs` in a PDF-compatible save). USPTO then **requires those layers to be flattened before filing** (section 6). For an internal IR, recover named groups if present; do not depend on them.

**The AI-in-SVG trap.** When Illustrator exports SVG with “Preserve Illustrator Editing Capabilities,” it writes **real SVG plus a binary AI blob**. Inkscape edits the SVG; Illustrator re-opens the blob and **your Inkscape edits vanish**. The wiki’s fix: delete the blob, or uncheck “Preserve Adobe Illustrator Editing” on export. ([Inkscape wiki](https://wiki.inkscape.org/wiki/Inkscape_for_Adobe_Illustrator_users); [Inkscape FAQ, linked from that page](https://inkscape.org/learn/faq/#inkscape-edits-svg-file-which-was-originally-created-adobe-illustrator-are-lost-when-importing-back-ai))

**Round-trip policy for this system:** `.ai` → PDF-side extract → **canonical SVG** → never write `.ai` back. If the draftsman must stay in Illustrator, they own the `.ai`; the system owns the SVG + numeral graph.

---

## 3. SVG as the patent-figure substrate

### 3.1 What § 1.84 actually requires (not “what looks like a patent drawing”)

Binding text, 37 CFR § 1.84 (Cornell LII, checked 2026-08-17; same language in MPEP 608.02, November 2024 revision):

- **Sheet:** A4 (21.0 × 29.7 cm) or US Letter (21.6 × 27.9 cm). All sheets in an application the same size. ([§ 1.84(f)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Margins / sight:** top ≥ 2.5 cm, left ≥ 2.5 cm, right ≥ 1.5 cm, bottom ≥ 1.0 cm. Usable sight ≤ 17.6 × 24.4 cm on Letter. No frames around the sight; scan cross-hairs on two catercorner margin corners. ([§ 1.84(g)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Lines:** “durable, clean, black … sufficiently dense and dark, and **uniformly thick and well-defined**. The weight of all lines and letters must be heavy enough to permit adequate reproduction.” Different thicknesses are allowed *when they mean something*. ([§ 1.84(l)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Scale test:** still legible after reduction to **two-thirds**. No “actual size” / “scale ½” callouts. ([§ 1.84(k)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Shading:** encouraged if it helps; **spaced lines preferred**; “solid black shading areas are not permitted” except bar graphs. Light from upper-left at 45°. ([§ 1.84(m)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Hatching:** regularly spaced oblique parallels, preferably 45°, broken where a numeral sits. Different parts / materials hatch differently. ([§ 1.84(h)(3)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Numerals:** Arabic preferred; **not encircled**; ≥ **0.32 cm (⅛ in)** tall; same part → same number in every view; numbers in the spec must appear in the drawings and vice versa. ([§ 1.84(p)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Lead lines:** straight or curved, short, **must not cross**, originate next to the numeral, required unless the numeral sits on the surface and is underlined. ([§ 1.84(q)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Sheet numbers:** `n/N` in the sight, top-center, larger than reference characters. ([§ 1.84(t)](https://www.law.cornell.edu/cfr/text/37/1.84))
- **Views:** `FIG.` + Arabic, independent of sheet numbers; a **single** view must **not** be numbered and must **not** say `FIG.` ([§ 1.84(u)](https://www.law.cornell.edu/cfr/text/37/1.84))

USPTO § 1.84 does **not** name a millimetre line weight. The IP5 “safe format” working paper (31 March 2023) is the closest multi-office number: **solid ≈ 0.4 mm, leader/dashed ≈ 0.2 mm** (0.57 / 1.13 DTP points), still readable at ⅔ reduction. USPTO’s own column in that table only restates “uniformly thick … heavy enough to permit adequate reproduction.” ([IP5 Allowable Features in Drawings, 2023-03-31](https://link.epo.org/ip5/IP5_Allowable%20Features%20in%20Drawings_20230331_revised.pdf)) Service blogs that say “USPTO recommends 0.2–0.6 mm” (e.g. PatentsInk 2025-01-28) are **paraphrase, not the CFR**. Use 0.2 / 0.4 mm as the *IP5-safe* default, not as US law.

### 3.2 Is SVG a good canonical representation? Yes, with discipline

SVG is the only open, editable, XML, browser-native, Inkscape-native format that can hold:

- stroked paths with explicit `stroke-width` in **millimetres** (`width="215.9mm" height="279.4mm"` + a viewBox in mm),
- live `<text>` for numerals,
- named `<g id="numerals">` / `<g id="leads">` / `<g id="hatching">` / `<g id="geometry">`,
- and a DOM an agent can query.

It is a **bad** canonical representation if you treat “any SVG Illustrator dumped” as the IR. Typical AI/Inkscape SVG is a soup of `matrix()` transforms, CSS classes, clipped groups, and `<text>` that has already been outlined.

**Line weights.** SVG `stroke-width` maps cleanly to § 1.84(l) *if* you pin units and forbid hairlines. A 0.4 mm stroke at Letter size is a real physical width; it will still be 0.4 mm after a correct mm-preserving SVG→PDF. What fails is `stroke-width="1"` in a unitless 0–1000 viewBox that some renderer interprets as 1 px. **Canonical SVG must be in millimetres, with a documented user-unit = 1 mm.**

**Text / fonts.** Patent Center PDF rules: **every glyph must be embedded**; subsetting is allowed; fonts must be licensed as embeddable. ([USPTO Patent Center PDF Guidelines](https://www.uspto.gov/patents/apply/applying-online/efs-web-pdf-guidelines), page still live 2026-08-17; historically EFS-Web, same text.) Two legal strategies:

| Strategy | Machine-readable later? | USPTO-safe? | When to use |
| --- | --- | --- | --- |
| **Live `<text>` + embed a licensed sans (Arial, Liberation Sans, Nimbus Sans) on PDF export** | Yes — this is the whole point of section 4 | Yes, *if* the PDF embed step actually subsets the font | **Internal IR and review PDFs** |
| **Outline numerals to paths** (`inkscape --export-text-to-path`) | No. ClaimMaster/Patent Bots will not see them. OCR becomes the only recovery | Yes — no font, no embed problem | **Filing PDF only**, and only if you do not trust the embedder |

Do **not** outline in the canonical file. Outline (or embed-and-subset) at the filing-export boundary. § 1.84(p)(3)’s 0.32 cm minimum is a **rendered height**, not a font-size attribute; validate after transform flatten.

**Hatching.** SVG `<pattern>` tiles are the wrong primitive. USPTO hatching is **a finite set of parallel stroked lines** that must break around numerals and survive ⅔ reduction as distinguishable strokes. A CSS/SVG pattern can drop, shift phase, or rasterize depending on the PDF backend. **Canonical hatching = real path strokes in a `hatching` group**, generated from a hatch descriptor (angle, pitch, bounds). Material identity lives in the descriptor (`data-material="metal"`), not in a visual convention the Office does not actually standardize beyond “different parts hatch differently.”

**Shading.** § 1.84(m) wants spaced lines, not gradients, not gray fills, not SVG `fill-opacity`. Solid black areas are forbidden. If a design-patent surface shade is required, it is still **stroked lines**. Do not put `<linearGradient>` in a utility-figure IR.

**Reference numerals: `<text>` vs outlines.** For the IR, **`<text>` is mandatory**. That is the only way a knowledge graph can read `10` next to a lead line without OCR. For the filing PDF, either embed or outline. A hybrid used by careful houses — live text in the AI/SVG, outlined in the filed PDF — is compatible with this system **if** the numeral graph is extracted *before* outlining.

### 3.3 SVG → PDF at “the required resolution”

There is no SVG resolution. There is a **PDF page size** and, after the Office eats it, a **300 dpi TIFF**. The job of the exporter is:

1. Keep strokes as PDF path operators (`S`, `s`), not as embedded images.
2. Keep page size exactly Letter or A4.
3. Either embed/subset fonts or convert text to paths.
4. Flatten layers (Patent Center: layered PDFs are flattened by the Office; invisible layers are lost). ([PDF Guidelines](https://www.uspto.gov/patents/apply/applying-online/efs-web-pdf-guidelines))
5. Target PDF **1.4–1.6** (Guidelines allow 1.1–1.6; 1.7/2.0 are not listed).
6. No 3D, no attachments, no comments, no encryption.

Headless Linux renderers ranked for *vector preservation* (not prettiness):

| Renderer | Vectors survive? | Stroke widths? | Notes |
| --- | --- | --- | --- |
| **Inkscape CLI** `inkscape in.svg --export-filename=out.pdf --export-pdf-version=1.5` | Yes | Yes, if units were real | Best default. `--export-text-to-path` for filing. `--batch-process` to close GUI. ([inkscape(1)](https://www.mankier.com/1/inkscape); [Inkscape wiki CLI](https://wiki.inkscape.org/wiki/Using_the_Command_Line)) |
| **`rsvg-convert -f pdf`** (librsvg) | Usually | Usually | Fast; historically weaker on filters/text. Fine for simple line art. |
| **CairoSVG** | Usually | Usually | Good for simple SVG; CSS/filter gaps. |
| **`svglib` + ReportLab** | Partial | Partial | Known-limited CSS, no masks, no ForeignObject. Not for § 1.84 sheets. ([svglib README, checked 2026-08-05 commit activity](https://github.com/deeplook/svglib)) |
| **Chromium headless print** | Risky | Risky | Easy to rasterize, easy to emit PDF 1.7, easy to use unlicensed fonts. Do not use as the filing path. |

Inkscape’s own manual: “Never save as PDF only, but always keep an SVG file, because the PDF file format supports a different set of features from the SVG file format.” ([Inkscape Beginners’ Guide, Exporting a PDF](https://inkscape-manuals.readthedocs.io/en/latest/export-pdf.html)) That is the correct architecture: **SVG is source, PDF is export.**

---

## 4. Reference numerals as data

### 4.1 The idea, stated sharply

A patent figure is a **bipartite graph**:

- **Nodes:** parts (spec nouns) and numerals (the Arabic tokens on the sheet).
- **Edges:** “numeral *n* designates part *p*”; “lead line from glyph *n* terminates on geometry group *g*”; “figure *F* contains numeral *n*”; “spec paragraph *k* mentions *p*/*n*.”

§ 1.84(p)(4)–(5) *is* that graph: same part → same number; no number unused; no number for two parts. If the figure IR stores numerals as `<text data-numeral="42" data-part="widget">42</text>` and lead lines as `<path data-from-numeral="42" data-to-group="g-widget-body">`, the graph is free. If the figure is a 300 dpi TIFF, the graph is a research problem.

### 4.2 Who is already doing this?

**On the drafting / proofreading side (text layer required):**

- **ClaimMaster** loads figures from **Visio, PDF with a text layer, PowerPoint, or Word**. It overlays part names on numerals, flags spec-only / figure-only numbers, checks margins/font size against MPEP, and exports an annotated PDF or a two-column figure table. It does **not** claim OCR of outlined numerals or lead-line tracing. ([ClaimMaster tutorial, “Checking Part Numbers and Names”](https://www.patentclaimmaster.com/blog/tutorial-checking-part-numbers-names/), checked 2026-08-17)
- **Patent Bots** (2018, still the live feature): process figures in **PPTX, VSDX, and PDF**; three error classes (in spec not drawings / in drawings not spec / same number, two meanings); figure numbers must appear in the brief description, the spec body, *and* the drawings. 2025-09-29 feature post: while you draft, it “automatically extracts the text related to the reference labels and dynamically builds a list.” 2026 feature page: “Reference Labels” and “Figure Numbers” checks; **“Unlike some competitors, Patent Bots does not generate patent figures.”** ([Patent Bots, 2018-10-30](https://blog.patentbots.com/2018/10/improved-reference-label-checking.html); [2025-09-29](https://blog.patentbots.com/2025/09/patent-bots-in-action-reference-label.html); [feature overview, 2026-07-08](https://www.patentbots.com/feature-overview))
- **IPRally “Smart reference numbers”** (2022-04-08): computer-vision overlay of part names onto *published* patent images for search review, plus auto-rotate. This is a **reader** feature on issued patents, not a drafting IR. ([IPRally](https://www.iprally.com/news/patent-drawing-reviews-simplified-smart-reference-numbers))
- **Rowan / DeepIP / Solve / Patlytics** keep a live numeral dictionary *inside their workspace* if you draft there (see lane x3). None expose an agent API that ingests an outside Illustrator PDF and returns a numeral graph. **UNVERIFIED** beyond those vendors’ marketing and the x3 lane.

**On the vision-research side (raster, because that is what USPTO publishes):**

- **USPTO 2014 competition / Riedl et al.** (IJDAR 2016; arXiv:1410.6751): 232 teams; detect figure regions *and* part labels on US patent drawing images. Failures catalogued then are still the failures: labels on hatching, labels touching geometry, landscape sheets, cursive/odd fonts, over-segmentation of “12a”. First-place figure-region detection was in the ~70% band; title-correct figure regions ~79% — numbers from the paper’s own abstract/body (HBS/IJDAR writeup). ([arXiv:1410.6751](https://arxiv.org/abs/1410.6751); [ACM IJDAR page](https://dl.acm.org/doi/abs/10.1007/s10032-016-0260-8))
- **Gong 2021, “Recognizing Figure Labels in Patents”** (ODU): “existing OCR methods often fail to recognize labels in patent drawings, primarily due to patent drawings being mainly composed of lines.” Open-source OCR is not enough; rotation is its own problem. ([ODU Digital Commons](https://digitalcommons.odu.edu/cgi/viewcontent.cgi?article=1280&context=computerscience_fac_pubs))
- **DeepPatent2** (Scientific Data, 2023-11-07): 2.7 M+ *design-patent* drawings, 2007–2020, from USPTO TIFFs + XML. OCR bake-off on 100 design figures: **AWS Rekognition F1 96.8% / recall 96.0%**; Google Vision F1 94.1% / recall 88.9%; **Tesseract precision 96.6% / recall 44.4%**. They adopted Rekognition and a post-process to fuse multi-token detections (label F1 0.807 → 0.968). This is **figure-title / view-label** OCR on design patents, not utility part-numeral + lead-line association. ([Nature Scientific Data 10:772](https://www.nature.com/articles/s41597-023-02653-7))
- **PatentOCR** (Scientific Data, published 2026-07-07): **2,236 drawings, 20,165 pixel-level annotations of component identifiers *and their associated arrows or guiding lines***. This is the first public dataset that treats **the lead line as a first-class object**. Baseline is “combination of four models”; the HTML version available 2026-08-17 is an unedited early-access manuscript, so reported accuracies should be treated as **UNVERIFIED** until the typeset paper. ([doi:10.1038/s41597-026-07829-5](https://www.nature.com/articles/s41597-026-07829-5))

**On the generation side:** PatentDrawingAI and PatentFig AI advertise auto-label / Auto-Label that “identifies components and places reference numerals.” That is *proposed* numerals on *generated* line art, not extraction from a draftsman’s file. Solve Intelligence (2025-05-10 blog, cited in lane x3) claims NLP+CV matching of spec part names onto a drawing. None of these emit a documented numeral graph.

**Nobody found in this pass** ships: *SVG `<text>` + `<g>` as the interchange standard between attorney, draftsman, and a knowledge graph.* NVG’s Visio-ready files and ClaimMaster’s “PDF with a text layer” are the closest industrial cousins. **That absence is the build case.**

### 4.3 Extraction tooling, two stacks

**From a vector figure (the path this practice should prefer):**

1. Parse SVG / PDF content stream.
2. Collect text objects whose content matches `/^\d{1,3}[A-Za-z]?$/` (and the usual `12a` / `12A` variants). Filter by height ≥ 0.32 cm after CTM flatten.
3. Collect stroked paths that (a) do not close, (b) have one endpoint in a radius of a numeral glyph, (c) do not cross another candidate lead (or flag the crossing as a § 1.84(q) error).
4. Walk the other endpoint to the nearest geometry group.
5. Emit `{numeral, bbox, leadPath, targetGroup?, figId}`.
6. Join to spec via the existing ClaimMaster-style noun+number regex (`widget 10`).

This is computational geometry, not ML. It fails when the draftsman outlined the numerals (common in “safe” Illustrator exports) or drew leads as many short segments. Fix: refuse outlined numerals in the IR; run a one-time outline→text recovery (vision) only as a migration.

**From a raster figure (issued patents, IFW downloads, outlined PDFs):**

1. Deskew / detect landscape (Gong 2021; IPRally auto-rotate).
2. Detect numeral candidates (PatentOCR-style detector, not raw Tesseract — Tesseract’s 44% recall on this domain is disqualifying as a sole engine).
3. Trace lead lines: ridge / line-detector from the numeral bbox along dark 1-pixel-wide strokes until a T-junction with geometry. PatentOCR’s “associated arrows or guiding lines” annotations exist specifically for this.
4. Accept that F1 will not be attorney-grade on dense utility hatching. Use the result as a *proposal* the attorney confirms, not as a silent write to the graph.

**Do not send unpublished figures to AWS Rekognition / Google Vision.** DeepPatent2’s winning engine is a cloud API. For this practice the raster path has to be local (PaddleOCR / a fine-tuned detector on PatentOCR’s public set / a small VLM on-box). Cloud OCR of pre-publication figures is a confidentiality defect, not a quality win.

### 4.4 What the knowledge graph should store

Per figure sheet:

- `figureId`, `sheetIndex`, `viewType` (ortho | perspective | exploded | section | flowchart | other)
- `numeral[]`: `{token, partId?, textOrigin: live|outlined|ocr, bboxMm, lead: {path, crossesOther: bool}, targetGroupId?}`
- `part[]`: `{partId, preferredName, aliases[], specAnchors[]}`
- `violations[]`: unused-in-spec, unused-in-figure, colliding-names, lead-cross, below-min-height, outside-sight

That is the same checklist ClaimMaster already sells — the difference is **owning the figure IR so the check does not depend on a vendor’s PDF text-layer parser.**

---

## 5. Vector editing programmatically (TypeScript, with geometric rigor)

The stack splits into **DOM/SVG I/O**, **path math**, and **CAD ingest**. Do not ask one library to do all three.

### 5.1 SVG read / write / tidy

| Library | Role | Rigor | Caution |
| --- | --- | --- | --- |
| **`svgo`** | Optimize / strip cruft | None (it *deletes* precision) | Run only with a locked preset. Default SVGO will merge paths, drop `id`s, collapse groups — i.e. destroy the numeral IR. Allowlist: numeric precision, unused-namespace strip. Never `mergePaths` on a patent IR. |
| **`@svgdotjs/svg.js`** | Friendly SVG DOM | Low | Fine for constructing sheets (margin guides, `FIG.` labels, numeral `<text>`). Not a geometry kernel. |
| **`svg.js` (legacy) / Snap.svg** | Same generation | Low | Prefer `@svgdotjs/svg.js`. |
| **`svg-path-commander`** (thednp, TS, 2.3.1 as of 2026-04) | `d` attribute parse / abs / normalize / reverse / morph | Medium | Best TS-native path toolkit found in this pass. Credits Paper.js and fontello/svgpath. ([npm svg-path-commander](https://www.npmjs.com/package/svg-path-commander)) |
| **`svgpath` (fontello)** | Path transform | Medium | Mature, smaller. |

### 5.2 Geometry kernel (the thing that makes lead-line and hatch code honest)

| Library | Role | Rigor | Caution |
| --- | --- | --- | --- |
| **Paper.js** | Bézier scene graph, boolean-ish ops, hit-testing | Medium-high for illustration | Canvas-oriented; SVG import/export exists. Good for interactive lead-line editing. Boolean ops are *illustration*-grade, not CAD-grade. |
| **flatten-js** (`@flatten-js/core`) | Points, segments, arcs, polygons, **Boolean**, SVG emitters | High for 2D linear/arc | “Does not concern too much about visualization.” The right kernel for “does this lead cross that lead” and “break hatch lines around a numeral box.” TypeScript types ship in the package. ([alexbol99/flatten-js](https://github.com/alexbol99/flatten-js)) |
| **clipper / `js-angusj-clipper` / Clipper2 WASM** | Polygon offset + Boolean (Vatti) | High for polygons | The industry answer for offsetting. Does **not** eat cubic Béziers — flatten first (flatten-js or Paper.js), clip, optionally refit. Needed if you ever offset a section hatch or grow a numeral exclusion zone. |
| **martinez / polygon-clipping** | Polygon Boolean | Medium | Lighter than Clipper; watch degenerates. |

**Recommended kernel for this system:** flatten-js (queries, crossings, hatch-line generation) + Clipper2 (offsets, exclusion zones around numeral boxes) + svg-path-commander (talk to SVG `d`). Paper.js only if there is an on-canvas editor.

### 5.3 DXF → SVG, honestly

The `dxf` npm package (skymakerolof/dxf) is the honest one: it **parses** HATCH, MTEXT, DIMENSION, STYLE, and then says, in the README, that those are **not supported for SVG rendering**. “Geometric elements are supported, but dimensions, text, hatches and styles (except for line colors) are not.” CLI: `dxf-to-svg`. ([skymakerolof/dxf](https://github.com/skymakerolof/dxf))

That is disqualifying as a *faithful* patent-figure ingest if the DWG/DXF is the draftsman’s working file — because the working file’s whole job is **text + hatch + lineweight**. It is acceptable as a **geometry preview** of inventor CAD.

`dxf-viewer` (WebGL / three.js, 1.0.48 as of 2026-06-08) is a viewer, not an SVG writer; it does claim some hatch and font handling for display. ([npm dxf-viewer](https://www.npmjs.com/package/dxf-viewer))

For anything like fidelity, the realistic 2026 options are the ones lane x9 is already enumerating: **ezdxf (Python, MIT)** for DXF entity coverage, **ODA** (not redistributable commercially without a license), **LibreDWG** (GPL-3, contaminates a closed Tauri binary). There is no TypeScript library that faithfully emits SVG hatch + SHX text + lineweights from a modern AutoCAD file. **Plan: DWG → (licensed converter or ezdxf) → a geometry dump you re-stroke in the SVG IR, then a human (or a numeral-placement tool) re-applies numerals.** Do not pretend `dxf-to-svg` is the figure.

### 5.4 What “programmatic edit” should mean in this product

Safe, automatable, geometrically well-defined:

- Place / move / renumber a numeral; recompute a short non-crossing lead.
- Generate 45° hatch in a closed boundary, broken around numeral boxes.
- Enforce 0.32 cm numeral height and 0.2 / 0.4 mm stroke classes.
- Pack views onto a § 1.84 sheet with a ⅔-reduction smoke test (scale the whole sight to 66.7% and check numeral height + hatch pitch).
- Diff two IR versions as a numeral-graph delta (“added 142, moved 10, lead 36 now crosses 38”).

Not automatable at attorney grade in 2026:

- “Make this an exploded view” from a single perspective SVG.
- Hidden-line projection from a STEP file that looks like a QuickPatents sheet.
- LLM-authored Bézier traces of a photo that a draftsman would sign.

---

## 6. PDF as the filing target

### 6.1 What Patent Center will accept

From the live [Patent Center PDF Guidelines](https://www.uspto.gov/patents/apply/applying-online/efs-web-pdf-guidelines) (still the EFS-Web URL, still the governing page 2026-08-17):

- Page size A4 or Letter. Larger pages are reduced to Letter and may distort.
- PDF **1.1 through 1.6** only.
- **All fonts embedded** (subset OK); embeddable license required.
- Black text recommended.
- Images ≥ 300 DPI; lossless preferred; **do not downsample**; CCITT G4 for bi-tonal; no PDF Alternates.
- **Layers must be flattened**; invisible layers are discarded. USPTO will flatten on ingest if you do not.
- No 3D, multimedia, attachments, multi-page-embedded objects, comments.
- No passwords / encryption.
- No executables.

Drawings themselves may be “scanned as a PDF” per the utility filing guide; the DOCX-spec mandate does **not** apply to drawings. ([USPTO utility filing guide](https://www.uspto.gov/patents/basics/apply/utility-patent))

### 6.2 What the Office then *does* to your beautiful vector PDF

This is the fact that changes product design. An in-house draftsman on r/patentexaminer (2024-05-22, thread still the canonical practitioner discussion in 2026) saves “final PDF at 2400 dpi” and watches PAIR chew it into jagged 300 dpi JPEGs. Examiner and filer replies, paraphrased and consistent with each other:

- IFW does **not** keep your PDF. It **discards text, rasterizes each page to TIFF ~300 dpi, often half-toned**, and later rebuilds a PDF from the TIFF. Publication OCR’s *that* PDF. ([u/Nice-Impression-4125 in that thread](https://www.reddit.com/r/patentexaminer/comments/1cy0eee/how_can_i_improve_the_quality_of_my_drawings_when/))
- If the PDF contains **vector black line art**, the rasterizer has a chance. If anyone in the chain (docket header, “print to PDF,” a grayscale JPEG of the figure dropped on a page) turned the figure into a **soft-mask image**, IFW half-tones it into soup.
- “Black and white” means **1-bit**, not “looks gray.” u/DavidG2P: convert to **1-bit G4/JBIG** before filing if you want to avoid dithering. u/stharward: submit **black-and-white vector**; confirm in Acrobat that objects are paths, not “Filled Path: Image.”
- Workaround: file as **“Drawings – Other than Black and White” (DOTBW)** so the original lands in **SCORE**. IFW still shows the degraded TIFF; examiners *can* open SCORE. Several practitioners say they always DOTBW, even for pure B&W, for this reason. Design applications get SCORE more routinely than utility. ([same thread, u/jotun86, u/GraceArtFace](https://www.reddit.com/r/patentexaminer/comments/1cy0eee/how_can_i_improve_the_quality_of_my_drawings_when/))

**Product consequence:** a 2400 dpi raster PDF is *worse* than a clean 1-bit vector PDF. The system’s filing export should be:

```
canonical SVG
  → Inkscape CLI, PDF 1.5, text outlined OR font subset-embedded
  → optional Ghostscript -sDEVICE=pdfwrite -dCompatibilityLevel=1.5
     -dColorConversionStrategy=/Gray -dProcessColorModel=/DeviceGray
     (and, if adopting the 1-bit school, a G4 monochrome flatten)
  → validate: page size, PDF version ≤ 1.6, no OCGs, no fonts-unembedded,
     no image XObjects that are the actual figure
```

Do **not** “print as image @ 300 dpi” (the USPTO’s own flatten recipe on that page) unless you are killing a stubborn layer warning. That recipe is how vector dies.

### 6.3 Vector vs raster, decided

| | Vector PDF | 1-bit G4 PDF | 8-bit / JPEG-in-PDF |
| --- | --- | --- | --- |
| IFW quality | Best case if Office rasterizes from paths | Predictable, no dither | Worst (half-tone soup) |
| Numeral recovery from *filed* package | Lost (Office discarded the text) | Lost | Lost |
| Numeral recovery from *your* archive | Perfect if you kept the SVG | Perfect if you kept the SVG | Perfect if you kept the SVG |
| Design-patent photos | N/A | N/A | Required; use SCORE/DOTBW |

**The archive is the SVG + numeral graph. The filing PDF is a disposable projection.** Anyone who treats the Patent Center download as source of truth has already lost the figure.

---

## 7. AI on vector art in 2026 — honest quality

### 7.1 LLM → SVG code

Frontier models can emit *valid* SVG for icons, mascots, and “pelican on a bicycle” jokes. They cannot emit a § 1.84 utility sheet.

- SVGMaker’s April 2026 bake-off: “Both Claude and ChatGPT can generate basic SVG code, but **neither consistently outputs production-ready files** without manual cleanup.” GPT-4o: simple icons OK, complex paths/gradients fail. Claude Sonnet 3.7: cleaner markup, still precision errors. ([svgmaker.io, 2026-04-13](https://svgmaker.io/blogs/can-claude-or-chatgpt-generate-production-ready-svgs))
- Reason-SVG (arXiv 2505.24499): generating high-quality SVG “requires advanced reasoning for structural validity, semantic accuracy, and visual coherence — areas where current LLMs often struggle.” GPT-4o / Claude 3.7 / Gemini 2.5 Pro: valid-SVG rate ~94.5%, **CLIPScore ~0.29**, no drawing-constraint adherence. ([arXiv HTML](https://arxiv.org/html/2505.24499v2))
- StarVector SVG-Bench (CVPR 2025): **GPT-4-V DinoScore 0.852** on SVG-Stack vs StarVector-8B **0.966**; GPT-4-V has **no score** on SVG-Diagrams (blank in their table). StarVector’s own caveat: “**will not work for natural images or illustrations**”; trained on icons, logos, diagrams, charts. ([StarVector project page](https://starvector.github.io/starvector/))
- Simon Willison’s November 2025 “LLM SVG Generation Benchmark” / pelican-riding-a-bicycle is the right *qualitative* test: models make charming cartoons, not manufacturing drawings. ([simonwillison.net, 2025-11-25](https://simonwillison.net/2025/Nov/25/llm-svg-generation-benchmark/))

**Use LLMs for:** proposing a numeral list from spec text; writing SVG *sheet furniture* (margins, `FIG. 2`, `2/7`); rewriting a lead-line path that flatten-js already computed; explaining a ClaimMaster-style violation. **Do not use LLMs for:** the geometry of the invention.

### 7.2 Image → SVG (vectorizers)

| Tool | What it is | Useful for patent line art? |
| --- | --- | --- |
| **Potrace / AutoTrace / VTracer** | Classical / fast neural trace | Yes for a *clean* B&W scan. Outputs path soup, no semantics, no text. StarVector bench: AutoTrace 0.874 / Potrace 0.875 / VTracer 0.882 on SVG-Diagrams — below StarVector-8B 0.959. |
| **Vectorizer.AI** | Commercial AI trace → SVG/PDF/EPS/DXF | Good logos; will happily trace a numeral into a blob. Cloud. |
| **Recraft vectorizer + “AI Vector Generator”** | Trace *and* text-to-SVG | Marketing-grade. Cloud. Not a § 1.84 engine. |
| **StarVector-8B** (open weights) | VLM that *writes SVG code* (primitives + `<text>`) from an image | **Most interesting research tool in this lane.** Explicitly claims technical diagrams and text elements. Still a DinoScore model, not a draftsman. Local, so confidentiality-compatible. Token length on SVG-Diagrams is 3,486 ± 1,918 — a utility sheet may blow the 4k generate cap they show in the sample. |
| **Adobe / Corel PowerTrace / Inkscape Trace Bitmap** | Classical, local | The actual draftsman tool for “photo at 80% opacity → trace.” Predictable, editable, no cloud. |

A vectorizer that does not emit **live `<text>` for the numerals it just traced** has destroyed the only thing that made the figure machine-readable. Prefer StarVector-class code generation or a two-stage (trace geometry, OCR numerals, replace with `<text>`) over a dumb potrace of the whole sheet.

### 7.3 VLMs *reading* technical drawings

This is further along than VLMs *drawing* them.

- DeepPatent2 + Rekognition: high-90s F1 on *design* figure labels in a controlled bake-off.
- PatentOCR 2026: finally annotates lead lines.
- IPRally / &AI: production CV+LLM for *published* patents (figure index, part-name overlay). &AI (2026-02-04): LLM figure-label extraction beats regex across offices; they still treat the figure as a raster. ([&AI “Litigation-Grade Patent Parsing”](https://www.tryandai.com/blog/how-and-ai-solved-patent-parsing))
- General VLMs (GPT-4o, Claude, Gemini) can *describe* a published figure and list visible numerals. They hallucinate missing parts and invent leads. Fine for a review assistant on **issued** art; not a source of truth for an unpublished sheet, and not a local-only pipeline unless you use a local VLM.

**Quality verdict, 2026-08-17:** AI is useful as a **numeral auditor, a first-pass tracer, and a published-art reader**. It is not useful as a **replacement draftsman** for anything a § 1.84 examiner will stare at. The $28–$100/sheet human last mile is not a transitional cost. It is the quality floor.

---

## Recommendation: canonical internal representation

### The durable source of truth

**A structured SVG document (one file per sheet) plus a sidecar numeral graph.**

Not the 3D model. Not the filed PDF. Not the DWG. Not the `.ai`.

```
                    inventor 3D / DWG / photo          ← inputs, disposable
                              │
                              ▼
                 ┌─────────────────────────┐
                 │  Figure IR (durable)    │
                 │  SVG (mm, named groups) │◄── draftsman may still
                 │  + numeral graph (JSON) │    edit in AI/Inkscape
                 └────────────┬────────────┘    if round-trip is clean
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
        review PDF      filing PDF         KG / spec audit
        (text live)   (outlined/1-bit)    (ClaimMaster-class)
```

### Why SVG wins the IR contest

| Candidate | Durable? | Editable by a draftsman? | Numerals as data? | § 1.84 native? | Linux/headless? | Lock-in |
| --- | --- | --- | --- | --- | --- | --- |
| **Structured SVG + graph** | Yes | Inkscape / Affinity / AI (import) / any XML tool | Yes, if `<text>` + `data-*` | Yes, if you enforce units/weights | Yes | None |
| **PDF** | No (Office rasterizes; your own PDF is an export) | Poor (Illustrator will flatten AI features) | Only if text not outlined | Page size only | Yes | Low |
| **DXF / DWG** | As CAD, yes; as a figure, no | AutoCAD only, in practice | TEXT/MTEXT *can* be, SHX often isn’t | No sheet/margin/FIG. model | DWG is a licensing minefield (see x9) | Autodesk |
| **`.ai` native** | Yes for an Illustrator house | Best-in-class | Yes inside AI; invisible outside | Only via templates | No | Adobe |
| **3D model that generated it** | Durable *as a part*, not as a figure | Wrong user (inventor, not draftsman) | No numerals | No | Mixed | High |
| **IFW TIFF** | What the world sees | No | OCR only | It *is* the Office’s copy | Yes | USPTO |

**Why not the 3D model as source of truth.** Hidden-line projections do not produce § 1.84 figures. They produce engineering views that still need: sheet furniture, numeral placement, non-crossing leads, 45° hatch with breaks, broken-line unclaimed environment, exploded brackets, the “single view must not say FIG.” rule, and a ⅔-reduction legibility pass. SolidWorks users on r/Patents already say hatching is bad and “post processing” is required. An X.com CAD founder says the same in 2026. 3D is a **generator of candidate geometry**, the way a photo is. The figure begins when a human (or a very constrained tool) commits 2D strokes and a numeral graph.

**Why not DWG.** This practice *has* 837 DWGs — they are the AutoCAD-house working files and/or inventor CAD. Lineweights, SHX text, and hatches are the first things JS DXF→SVG pipelines drop. DWG licensing for a closed desktop app is the x9 problem. Keep DWG as an **ingest dialect**: recover geometry, then re-host it in the SVG IR.

**Why not `.ai` as the IR.** It is a dual-stream trap (section 2). Fine as a draftsman-owned satellite. The system should import the PDF-compatible stream and never write `.ai`.

**Why not PDF as the IR.** Filing requirements make it the *export*. IFW makes it ephemeral. Outlined fonts make it opaque. Keep PDF at the boundary.

### SVG IR conventions (the actual schema to implement)

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     width="215.9mm" height="279.4mm"
     viewBox="0 0 215.9 279.4"
     data-ir="beep-figure/v1"
     data-sheet="2" data-sheet-total="7">
  <g id="guides" data-role="non-printing">…margin + sight + cross-hairs…</g>
  <g id="geometry" data-role="invention">…stroked paths, fill=none…</g>
  <g id="hatching" data-role="section">…real 0.2 mm strokes, not <pattern>…</g>
  <g id="leads" data-role="leads">
    <path data-numeral="42" d="…"/>
  </g>
  <g id="numerals" data-role="numerals">
    <text data-numeral="42" data-part="widget"
          font-family="Liberation Sans" font-size="3.2"
          x="…" y="…">42</text>
  </g>
  <g id="furniture" data-role="sheet">
    <text data-role="fig-label">FIG. 3</text>
    <text data-role="sheet-number">2/7</text>
  </g>
</svg>
```

Companion JSON (or the same facts in the knowledge graph):

```json
{
  "ir": "beep-figure/v1",
  "sheet": { "index": 2, "total": 7, "size": "letter" },
  "figures": [{ "id": "FIG.3", "kind": "perspective" }],
  "parts": [{ "id": "widget", "name": "widget", "numeral": "42" }],
  "numerals": [{
    "token": "42",
    "origin": "live-text",
    "figure": "FIG.3",
    "leadCrosses": false
  }]
}
```

Stroke classes, locked: `geometry = 0.4 mm`, `lead | hatch | hidden = 0.2 mm`, all `#000`, no gray. User unit = 1 mm. No CSS transforms left unresolved in the saved file (flatten on write). No `<image>` except as a locked, non-printing underlay used during trace. `svgo` may not touch `id` or `data-*`.

### How software slots into the real pipeline

1. **Do not try to replace the draftsman on mechanical / design art.** Beat $28–$100/sheet only on *iteration* (renumber, lead repair, sheet pack, ⅔ check) and on *audit* (spec ↔ figure graph).
2. **Do replace the “PDF ping-pong.”** NVG already sells this: give the attorney a layered editable file. Your version is SVG + graph, not Visio.
3. **Ingest dialects, in order of fidelity:** native IR SVG → Inkscape SVG → PDF-compatible `.ai` via Poppler/Inkscape → vector PDF with text layer → DXF geometry-only → raster + local OCR (migration / issued art).
4. **Export dialects:** review PDF (live text, embedded Liberation Sans) for the attorney; filing PDF (Inkscape, PDF 1.5, outlined text or 1-bit G4) for Patent Center; DOTBW upload so SCORE keeps a clean copy.
5. **Buy, don’t build:** ClaimMaster / Patent Bots as a *check* against the spec Word document, until the graph is richer than theirs. Their figure parsers are the compatibility test: if they can read your review PDF’s text layer, you did the IR right.
6. **Never cloud-OCR unpublished figures.** Local detector (PatentOCR’s public set is the fine-tune corpus) or a local VLM. Rekognition’s 96.8% F1 is not available at this desk.

### The 3D-to-projection assumption, retired

Prior lanes in this study asked “which CAD kernel projects a 3D model into a patent figure?” The evidence in *this* practice is that the question is off by one abstraction layer. The attorney’s figure folder is a **vector illustration** folder. 3D, when it appears, is an inventor-side artifact that a draftsman traces — the same way they trace a photo. An agentic system that starts at STEP and hopes to land at § 1.84 will spend its budget on hidden-line rendering and still need the entire IR this report describes. An agentic system that starts at **SVG + numerals as data**, treats DWG/AI as ingest, and treats 3D as optional geometry input, is sitting where the work already is.

---

## Sources

### Primary / regulatory

- 37 CFR § 1.84, Cornell LII, https://www.law.cornell.edu/cfr/text/37/1.84 — checked 2026-08-17
- MPEP 608.02 (R-01.2024, November 2024), BitLaw copy, https://www.bitlaw.com/source/mpep/608-02.html — checked 2026-08-17
- USPTO Patent Center PDF Guidelines, https://www.uspto.gov/patents/apply/applying-online/efs-web-pdf-guidelines — checked 2026-08-17
- USPTO Nonprovisional (Utility) Patent Application Filing Guide, https://www.uspto.gov/patents/basics/apply/utility-patent — checked 2026-08-17
- IP5 Offices, “Allowable features in drawings,” 31 March 2023, https://link.epo.org/ip5/IP5_Allowable%20Features%20in%20Drawings_20230331_revised.pdf

### Practitioner / commercial pipeline

- QuickPatents drawings + rate card, https://www.quickpatents.com/drawings/ — checked 2026-08-17
- Menteso drawings + FAQ (tool list, intake, $29/$39, 1–4 days), https://menteso.com/patent-drawings/ — checked 2026-08-17
- PatDraw $28/sheet announcement, https://www.effectualservices.com/press-release/patdraw-launches-professional-patent-illustrations-at-just-28-per-sheet
- NVG Visio-ready patent drawings, https://nvg-inc.com/microsoft-visio-patent-drawing-services/ — checked 2026-08-17
- r/Patents, “What software or method do you use…”, https://www.reddit.com/r/Patents/comments/1l3umsv/what_software_or_method_do_you_use_to_draw_the/ — 2025
- r/Patents, “How to get the drawings done?”, https://www.reddit.com/r/Patents/comments/1ik4daa/how_to_get_the_drawings_done/ — 2025-02-07
- r/patentexaminer, “How can I improve the quality of my drawings when they are posted to PAIR?”, https://www.reddit.com/r/patentexaminer/comments/1cy0eee/how_can_i_improve_the_quality_of_my_drawings_when/ — 2024-05-22 (SCORE / IFW / 1-bit discussion)
- @GregAtkinson_jp, 2026-08-15, https://x.com/GregAtkinson_jp/status/2088437064547324326
- PatentDrawingAI, “10 Best Patent Drawing Software in 2026,” 2026-05-10 / 2026-06-15, https://patentdrawingai.com/blog/best-patent-drawing-software
- PatentDrawingAI, “How Much Do Patent Drawings Cost in 2026,” 2026-05-20, https://patentdrawingai.com/blog/patent-drawing-cost
- PerspireIP, “7 Best Tools, Ranked for 2026,” 2026-04-24, https://www.perspireip.com/blog/patent-drawing-software/ — **SEO; PatentOrder product UNVERIFIED**

### `.ai` / SVG / PDF toolchain

- Datalogics, “Adobe Illustrator and PDF Compatibility,” 2022-04-06, https://www.datalogics.com/adobe-illustrator-and-pdf-compatibility
- Adobe, “Supported file formats in Adobe Illustrator,” 2025-10-27, https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/supported-file-formats.html
- Inkscape wiki, “Inkscape for Adobe Illustrator users,” https://wiki.inkscape.org/wiki/Inkscape_for_Adobe_Illustrator_users
- Inkscape wiki, “Using the Command Line,” https://wiki.inkscape.org/wiki/Using_the_Command_Line
- Inkscape Beginners’ Guide, “Exporting a PDF File,” https://inkscape-manuals.readthedocs.io/en/latest/export-pdf.html
- inkscape(1), https://www.mankier.com/1/inkscape
- LogosByNick, “How To Open And Create AI Files With Inkscape,” https://logosbynick.com/open-save-ai-files-inkscape/
- pdf2svg (Poppler+Cairo), https://cityinthesky.co.uk/opensource/pdf2svg/
- svglib README, https://github.com/deeplook/svglib

### Numerals / extraction

- ClaimMaster, “Checking Part Numbers and Names,” https://www.patentclaimmaster.com/blog/tutorial-checking-part-numbers-names/
- Patent Bots, “Improved Reference Label Checking,” 2018-10-30, https://blog.patentbots.com/2018/10/improved-reference-label-checking.html
- Patent Bots, “Reference Label Drafting,” 2025-09-29, https://blog.patentbots.com/2025/09/patent-bots-in-action-reference-label.html
- Patent Bots feature overview, 2026-07-08, https://www.patentbots.com/feature-overview
- IPRally, “Smart reference numbers,” 2022-04-08, https://www.iprally.com/news/patent-drawing-reviews-simplified-smart-reference-numbers
- Riedl et al., “Detecting Figures and Part Labels in Patents,” arXiv:1410.6751, https://arxiv.org/abs/1410.6751
- Gong, “Recognizing Figure Labels in Patents,” 2021, https://digitalcommons.odu.edu/cgi/viewcontent.cgi?article=1280&context=computerscience_fac_pubs
- Wei / Ajayi et al., “DeepPatent2,” *Scientific Data* 10:772 (2023-11-07), https://www.nature.com/articles/s41597-023-02653-7
- Wang, Qiu, Chen, “PatentOCR,” *Scientific Data* (2026-07-07), https://www.nature.com/articles/s41597-026-07829-5
- &AI, “Litigation-Grade Patent Parsing,” 2026-02-04, https://www.tryandai.com/blog/how-and-ai-solved-patent-parsing

### Libraries

- svg-path-commander, https://www.npmjs.com/package/svg-path-commander
- flatten-js, https://github.com/alexbol99/flatten-js
- Paper.js Path reference, https://paperjs.org/reference/path/
- skymakerolof/dxf, https://github.com/skymakerolof/dxf
- dxf-viewer, https://www.npmjs.com/package/dxf-viewer

### AI / vector generation

- StarVector, CVPR 2025, https://starvector.github.io/starvector/
- SVGMaker, “Can Claude or ChatGPT Generate Production-Ready SVGs?,” 2026-04-13, https://svgmaker.io/blogs/can-claude-or-chatgpt-generate-production-ready-svgs
- Reason-SVG, arXiv:2505.24499, https://arxiv.org/html/2505.24499v2
- Simon Willison, “LLM SVG Generation Benchmark,” 2025-11-25, https://simonwillison.net/2025/Nov/25/llm-svg-generation-benchmark/
- Vectorizer.AI, https://vectorizer.ai/
- Recraft vectorizer, https://www.recraft.ai/ai-image-vectorizer

### X.com (negative result)

- Keyword `("patent drawing" OR "patent illustration" OR "patent illustrator")` Latest, 2026-08-17: no toolchain evidence; only news-leak and anecdote posts
- Semantic “how patent illustrators produce USPTO figures with Illustrator AutoCAD SVG”: no practitioner hits
