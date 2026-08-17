# Agentic CAD for IP / Patent Practice — Tool Landscape & Buyer's Guide

> **Status (2026-08-17): superseded in part.** This report is repo-agnostic tool
> discovery optimised for 3D solids. A corpus census of the practice's real files
> (837 AutoCAD DWG vs 201 STEP; 86 of 175 Illustrator sheets carrying extractable
> `FIG. n` text) reframed the packet around the 2D figure and its numeral graph.
> See `../SPEC.md` and `SOURCES.md`. The tool evaluations below remain useful.

**Audience:** a solo intellectual-property / patent attorney evaluating AI/LLM-driven CAD
tools to adopt.
**Inspiration anchor:** [adam.new](https://adam.new) — text-to-parametric-3D CAD (YC W25; $4.1M
seed, Oct 2025).
**Date of research:** 2026-05-29. Several entries below are time-sensitive (see Caveats).
**Scope note:** This report evaluates each tool on its own published merits and integration
surfaces. It does **not** assume or design any specific downstream integration architecture.

---

## How to read this report

Every tool is described on two axes the attorney cares about:

**A. Integration surface (the "rung" it sits on)** — what the tool exposes for programmatic use
or automation, highest first:

1. **Native MCP server** (turnkey for agentic tooling)
2. **Documented REST / gRPC / HTTP API**
3. **CLI / headless / batch mode**
4. **Scriptable language or embeddable library** (Python / JS / etc.)
5. **File-format interop only** (STEP / STL / SVG / DXF / GLTF)

This is a *descriptive* statement of what is available to integrate or automate — not a
fit-score against any particular system.

**B. Deployment & confidentiality** — `cloud-only | hybrid | self-hostable | fully
local/offline` — and the **ABA/state-bar Rule 1.6** implication of sending client or invention
data to it. A tool that transmits privileged matter data to a vendor cloud (especially one that
may train on it) is flagged.

> **Rule 1.6 framing (professional-responsibility overlay):** Routing a privileged invention
> disclosure through a cloud service that reserves the right to train on the data, or that gives
> no contractual confidentiality assurance, is a legitimate confidentiality concern. Where a tool
> can run locally / self-hosted, that is called out as the privilege-safe path. Where the best
> capability is cloud-only, the trade-off is stated rather than hidden.

---

## The four jobs

1. **USPTO/WIPO patent FIGURES** — generating/cleaning the black-line 2D drawings filed with
   patents (numbered figures, reference numerals, shading/line-weight rules, WIPO ST.96 / USPTO
   drawing standards).
2. **Invention 3D MODELING** — turning an invention disclosure or verbal description into an
   editable parametric 3D model (what adam.new does).
3. **PRIOR-ART / reverse-modeling** — reconstructing existing devices or accused products from
   descriptions, photos, or specs to compare against claims.
4. **Full DISCLOSURE→FIGURE pipeline** — an agentic flow that ingests a disclosure and
   auto-drafts the figure set + figure descriptions + reference-numeral mapping.

---

## Executive summary

The "Agentic CAD" market splits cleanly into two camps with opposite confidentiality profiles.
**Cloud SaaS** — Zoo (Text-to-CAD / Zookeeper), Autodesk's forthcoming "neural CAD" for
Fusion/Forma, and MakeIt3D — offers the most polished text-to-CAD generation but transmits the
invention prompt to a vendor server; Zoo's free tier explicitly reserves the right to train on
that data, a direct Rule 1.6 red flag for privileged disclosures. **Open-source / local
libraries** — CadQuery and build123d (both Apache-2.0 Python frameworks on the industrial
OpenCASCADE B-rep kernel) — can run fully on the attorney's machine, and CadQuery is in fact the
code representation that modern text-to-CAD systems (MakeIt3D, the *Text-to-CadQuery* research
line) generate under the hood. A third open-source option, the GPLv3 web app CADAM (adam.new's
own open-source counterpart), runs its *geometry* locally but by default sends the invention
prompt/image to a cloud LLM for the generation step, so it is privilege-safe only if paired with
a local model (see Job 2) — it is **not** in the same fully-offline category as CadQuery/build123d. For an IP attorney whose top constraint is confidentiality, the
strongest *adoptable* primitives are the local Python kernels: **build123d is uniquely able to
project a 3D model into black-line 2D drawings (visible/hidden edges, title block, SVG/DXF
export)** — the patent-figure job — while **CadQuery is the canonical headless geometry backend**
for invention 3D modeling. The cloud tools are worth knowing for non-privileged or
already-public work (e.g., reverse-modeling a product already on the market), but the privilege-
safe core of any adopted toolkit is local.

---

# Landscape by job

## Job 1 — USPTO/WIPO patent FIGURES (black-line 2D drawings)

This is the most underserved job by the "text-to-CAD" SaaS crowd, which targets *3D* output.
The capability that actually matters here — projecting a 3D model to **standardized 2D
orthographic + isometric views with separated visible/hidden edges and a title block, exported
as vector SVG/DXF** — is best served today by an open-source Python library.

- **build123d (OSS, Apache-2.0)** is the standout. It provides a `project_to_viewport` method
  that creates a camera-like 2D projection of a 3D scene and returns **separate visible-edge and
  hidden-edge sets**; a `TechnicalDrawing` class that draws a border/title block (A4 page size,
  title, drawing number, designed-by); `DimensionLine` / `ExtensionLine` / callout primitives;
  and dedicated `ExportDXF` / `ExportSVG` classes with a configurable `LineType` enum (e.g.,
  `LineType.ISO_DOT` for hidden lines) — exactly the building blocks for patent-style black-line
  figures. [Claims 20, 21, 22 — primary: build123d README + source + readthedocs]
  - **Honest limit:** build123d gives you the *workflow primitives* for black-line figures but
    does **not** auto-apply USPTO-specific conventions — it will not auto-number reference
    numerals or auto-letter figures (FIG. 1, FIG. 2 …) for you. You script those.
- **CadQuery (OSS, Apache-2.0)** can export DXF/SVG too and is the sister project, but its
  drawing/title-block ergonomics are weaker than build123d's dedicated `drafting` module; for the
  pure figures job build123d leads.
- **Cloud text-to-CAD tools (Zoo, Autodesk, MakeIt3D)** are oriented to 3D output (STEP/GLTF/STL)
  and do not advertise a patent-figure (numbered black-line 2D) generation surface; you would
  export their 3D model and then project to 2D in a separate step (e.g., via build123d).

**Verdict for Job 1:** the only tool in this set that natively produces patent-figure-style 2D
line drawings — and does so **fully locally** — is **build123d**.

## Job 2 — Invention 3D MODELING (disclosure → editable parametric model)

This is the adam.new job, and it is the most crowded.

**Cloud SaaS / commercial:**

- **Zoo — Text-to-CAD / "Zookeeper"** (commercial, cloud). Generates a CAD model from a text
  prompt; can also emit **KCL** (Zoo's parametric CAD scripting language) from the prompt.
  STEP is the source-of-truth output. [Claims 0, 1, 5]
- **Autodesk "neural CAD"** (commercial, **not yet GA**). Announced at AU 2025 as *upcoming*
  generative-AI foundation models that create CAD geometry from a text prompt, to be integrated
  into Fusion and Forma — Autodesk's ML alternative to the classical parametric kernels used for
  40+ years. As of May 2026 it is still not generally available. [Claims 6, 7]
- **MakeIt3D — Text-to-CAD** (commercial, cloud, "Beta"). An LLM writes **CadQuery Python code**
  that models the shape parametrically; a secure CAD worker (OpenCASCADE kernel) executes it to
  produce real 3D geometry — same text-to-parametric-CAD category as adam.new. [Claim 8]
- **adam.new** (commercial, cloud) — the inspiration tool; text → parametric CAD file.

**Open-source / local:**

- **CADAM (OSS, GPLv3)** — the open-source text-to-CAD web app, built and maintained by the
  AdamCAD team (it is literally hosted at adam.new/cadam). Converts natural language **and**
  images into editable parametric 3D models; generates parametric OpenSCAD and exports
  STL/SCAD/DXF; the CAD engine runs **entirely in the browser** via OpenSCAD WebAssembly
  (Three.js / R3F rendering), so geometry computation is local. **But** the AI generation step
  requires an external LLM API key (Anthropic Claude primary; also OpenRouter/OpenAI/Google), so
  by default the invention text is sent to a third-party cloud LLM. [Claims 11, 12, 13, 14]
- **CadQuery (OSS, Apache-2.0)** — the Python parametric-CAD library on the OCCT kernel; the
  canonical *headless geometry backend* that text-to-CAD systems generate code for. [Claims 15,
  16, 17, 18, 23]
- **build123d (OSS, Apache-2.0)** — sister Python BREP framework on OCCT; also suitable for 3D
  modeling and uniquely strong at the 2D-figure side. [Claims 19, 20]

**Research signal:** the field is converging on **CadQuery code as the LLM target** because
CadQuery is a Python scripting language an LLM can emit *directly* — avoiding the intermediate
command-sequence / CAD-vector representations that pretrained models cannot handle — so models can
be fine-tuned to generate 3D models as CadQuery scripts (Text-to-CadQuery, arXiv 2505.06507). This
rests only on CadQuery being a direct script target, **not** on any claim that LLMs "already excel"
at CAD/spatial reasoning (that stronger claim was refuted — see Caveats). [Claim 23]

**Verdict for Job 2:** for *privilege-safe* work, the local Python kernels (CadQuery / build123d)
are the adoptable core; for *convenience on non-privileged* work, Zoo's API is the most mature
cloud option, with Autodesk's neural CAD a watch-item once it ships.

## Job 3 — PRIOR-ART / reverse-modeling (reconstruct existing devices from photos/specs)

This job has two sub-modes: **image/photo → 3D** and **description/spec → 3D**.

- **MakeIt3D's REST API** is the most concrete image→3D automation surface found, but it is
  **image-to-3D mesh only**, not text-to-CAD: three endpoints (`POST /v1/generate`,
  `GET /v1/generate/:id`, `GET /v1/generate/:id/result`) take a source image and return a
  textured 3D mesh (GLB/OBJ/STL). It is **in development / not yet public** ("schema will be
  published before launch"; early-partner access only). So it can help reconstruct the *shape* of
  an accused product from a photo, but it does **not** produce an editable parametric CAD model,
  and it is cloud-only. [Claims 9, 10]
- **CADAM** accepts **image references** to guide generation in addition to text, and produces
  editable parametric output — useful for reverse-modeling from a reference image into an
  *editable* model, with the local-geometry / cloud-LLM trade-off noted above. [Claims 11, 13, 14]
- **Zoo Text-to-CAD** is text-driven; for prior-art described in words (a spec, a claim chart) it
  can generate an editable STEP/KCL model to compare against. [Claims 0, 5]
- **CadQuery / build123d** are the natural targets for *manually or agentically* reconstructing a
  device from a spec into a precise, dimensioned, editable model that you control end-to-end,
  locally.

**Verdict for Job 3:** no single tool nails "photo → editable parametric CAD" privately today.
Image→mesh (MakeIt3D, cloud, mesh-only) and text/image→parametric (CADAM/Zoo) are partial
solutions; the privilege-safe path for an *editable* reconstruction is scripting it in
CadQuery/build123d, optionally seeded by a local image-to-3D step.

## Job 4 — Full DISCLOSURE→FIGURE pipeline (ingest disclosure → figure set + descriptions + numerals)

No single shipping product was confirmed to do the *entire* agentic flow (ingest a disclosure →
auto-draft the numbered figure set + figure descriptions + reference-numeral mapping). This job
is currently **assembled, not bought**:

- **Generation stage** (disclosure text → 3D model): a text-to-CAD step — Zoo Text-to-CAD/KCL
  (cloud), MakeIt3D (cloud), CADAM (local geometry + cloud LLM), or a local LLM emitting CadQuery
  code (the Text-to-CadQuery paradigm). [Claims 0, 5, 8, 11, 23]
- **Figure stage** (3D model → numbered black-line 2D figures): **build123d**'s
  `project_to_viewport` + `TechnicalDrawing` + `ExportSVG`/`ExportDXF`, with reference numerals
  and figure numbers scripted on top. [Claims 20, 21, 22]
- **Description / numeral-mapping stage**: an LLM pass authoring figure descriptions and the
  reference-numeral table — no confirmed turnkey tool; this is the gap an attorney's own tooling
  or an agent would fill.

Because CadQuery is **designed to run headless as a library** (no GUI; built for "integration
into servers" and scripts), it is the natural geometry backend for an automated
disclosure-to-model pipeline, and build123d is the natural figure backend. [Claim 18]

**Verdict for Job 4:** there is no off-the-shelf privilege-safe "disclosure → figure set"
product; the closest adoptable foundation is a **local CadQuery/build123d pipeline** (geometry +
figures) with an LLM stage for prose/numerals. If full automation with cloud convenience is
acceptable for non-privileged work, Zoo's API is the most complete generation surface to anchor
on.

---

# Comparison table

| Tool | Job(s) | Type | Integration surface (rung) | Deployment | Privilege verdict (Rule 1.6) | Price signal |
|---|---|---|---|---|---|---|
| **Zoo Text-to-CAD / Zookeeper** | 2, 3, (4 gen) | SaaS (commercial) | **REST API** (`POST /ai/text-to-cad/{output_format}` @ api.zoo.dev) + KCL scriptable language + STEP/GLTF/OBJ/etc. interop; official Python/TS/Go/Rust client libs (rung 2) | **Cloud-only** (geometry engine cloud; engine not open source; even desktop app needs internet) | **Caution → red flag on Free tier.** Data transmitted to Zoo; **Free plan: Zoo may train on usage data.** Cloud mitigations exist (SOC 2 Type II was *expected Q4 2025* — that deadline has now passed; confirm current status at zoo.dev/trust — plus ITAR/US region and enterprise private training) but data still leaves the firm. | Free tier (trains on data) + paid plans / server-minute billing |
| **Autodesk "neural CAD" (Fusion/Forma)** | 2, (3) | SaaS (commercial) | Not yet GA — no published API surface for it yet (will live inside Fusion/Forma) | **Cloud** (Autodesk cloud-AI) | **Unknown/likely cloud** — evaluate when it ships; assume cloud transmission until Autodesk states otherwise. | Bundled into Fusion/Forma (commercial); not yet available |
| **MakeIt3D — Text-to-CAD** | 2 | SaaS (commercial, Beta) | **File-format interop only** for the text-to-CAD feature (STL; CadQuery code can also yield STEP/3MF). **No API/CLI/SDK for text-to-CAD** (rung 5) | **Cloud-only** (browser; secure CAD worker, OCCT kernel, cloud LLM) | **Caution.** Invention text + execution in vendor cloud; no stated training opt-out found; treat as not privilege-safe absent a confidentiality agreement. | Beta SaaS |
| **MakeIt3D — image-to-3D API** | 3 | SaaS (commercial) | **REST API** (`POST /v1/generate`, `GET /v1/generate/:id`, `…/result`) — **image→mesh only, not CAD**; pre-launch (rung 2, but wrong job for editable CAD) | **Cloud-only** | **Caution.** Image + output in vendor cloud; mesh only (not editable CAD). | Pre-launch; early-partner access |
| **adam.new** | 2 | SaaS (commercial) | Web app (text→parametric CAD file); programmatic surface not characterized here | **Cloud** | **Caution** — cloud transmission; evaluate vendor terms before privileged use. | Commercial (YC W25; $4.1M seed) |
| **CADAM** | 2, 3, (4 gen) | **OSS (GPLv3)** | Self-hostable **web app**; CAD engine = OpenSCAD WASM **in-browser**; exports STL/SCAD/DXF (rung: self-hosted app + file interop) | **Hybrid** — geometry **local** (browser/WASM), **but AI generation needs external LLM API key** (Anthropic/OpenAI/Google/OpenRouter) | **Mixed.** Geometry stays local; **invention prompt/image is sent to a cloud LLM by default** (no documented local-LLM/baseURL option). Privilege-safe only if paired with a local model endpoint (not shipped). | **Free / open source** (you pay LLM API costs) |
| **CadQuery** | 2, 3, (1/4 backend) | **OSS (Apache-2.0)** | **Scriptable Python library** (headless, no GUI; built for server/script integration) + STEP/DXF/STL/3MF interop (rung 4) | **Fully local / offline** (pip/conda/Docker; no cloud component) | **Privilege-safe.** Runs entirely on the attorney's machine; no data egress. Apache-2.0 permits self-hosting/offline use. | **Free / open source** |
| **build123d** | **1**, 2, (4 figure) | **OSS (Apache-2.0)** | **Scriptable Python library** on OCCT; `project_to_viewport`, `TechnicalDrawing`, `ExportSVG`/`ExportDXF`, `LineType` (rung 4) + SVG/DXF/STEP interop | **Fully local / offline** (pip/conda; runtime deps are all local geometry/math/file libs — no network clients) | **Privilege-safe.** Fully offline; no data egress. | **Free / open source** |

> Confidence on each row's facts is anchored to the per-claim citations in the section above and
> the source list at the foot of this report. Cloud-tool *internal* confidentiality practices
> beyond what each vendor publishes are not independently audited here.

---

# Ranked picks per job

## Job 1 — Patent FIGURES
- **TOP PICK: build123d (OSS, Apache-2.0).**
  - **Integration / automation points (what it exposes):** Python library API — `Shape
    .project_to_viewport(viewport_origin, viewport_up, look_at)` returns `(visible_edges,
    hidden_edges)`; `TechnicalDrawing` (border/title block, A4, title, drawing number);
    `DimensionLine`/`ExtensionLine`/callouts; `ExportSVG(scale=…).write("fig.svg")` and
    `ExportDXF(... line_type=LineType.ISO_DOT)` for vector black-line output with configurable
    line weights/types. Rung 4 (scriptable library) + rung-5 SVG/DXF interop. [Claims 20–22]
  - **Deployment / privilege:** fully local/offline, no data egress — **privilege-safe** for
    confidential matters. [Claim 19]
  - **Caveat:** you script USPTO numbering/reference-numeral conventions yourself; it is not a
    turnkey USPTO-compliant figure generator.
- **RUNNER-UP: CadQuery (OSS, Apache-2.0).** Same kernel and license, also exports DXF/SVG and
  runs fully local, but its figure/title-block ergonomics are weaker than build123d's `drafting`
  module. Privilege-safe. [Claims 15–18]

## Job 2 — Invention 3D MODELING
- **TOP PICK (privilege-safe): CadQuery (OSS, Apache-2.0).**
  - **Integration / automation points:** importable **Python module** (`pip install cadquery`),
    explicitly built to run **headless without a GUI** for "integration into servers" and
    scripts; B-rep solids on the industrial **OCCT** kernel; STEP/DXF/STL/3MF export. It is also
    the LLM-target code format the field is standardizing on (Text-to-CadQuery), so a local LLM
    can emit CadQuery directly. Rung 4. [Claims 15, 16, 18, 23]
  - **Deployment / privilege:** fully local/offline; Apache-2.0; **privilege-safe**. [Claim 17]
- **RUNNER-UP (cloud convenience): Zoo Text-to-CAD / Zookeeper.**
  - **Integration / automation points:** documented **REST API** `POST
    /ai/text-to-cad/{output_format}` at `api.zoo.dev` (bearer token); selectable output via typed
    `FileExportFormat` path param; STEP is source-of-truth; optional `kcl` parameter returns
    parametric **KCL** code; official **Python/TS/Go/Rust** client libraries. Rung 2. [Claims 0,
    1, 5]
  - **Deployment / privilege:** **cloud-only**; engine not open source. **Do not use the Free
    tier for privileged disclosures** (Zoo may train on Free-plan data); a paid/enterprise tier
    with private-training + a confidentiality agreement is the minimum bar, and even then data
    leaves the firm. [Claims 2, 3, 4]
  - **Watch-item, not yet pickable:** **Autodesk neural CAD** — strong capability, but not GA as
    of May 2026; re-evaluate (including its deployment/privilege posture) when it ships. [Claims
    6, 7]

## Job 3 — PRIOR-ART / reverse-modeling
- **TOP PICK (for editable, privilege-safe reconstruction): CadQuery / build123d scripted
  reconstruction.** Reconstruct the device from the spec/photo as a precise, dimensioned,
  **editable** model you control entirely on-device. Rung 4; fully local; privilege-safe. [Claims
  15–22]
- **RUNNER-UP (photo → quick shape): MakeIt3D image-to-3D REST API.** Concrete `POST /v1/generate`
  image→mesh surface, useful to capture an accused product's *shape* from a photo — but it is
  **mesh-only (not editable CAD)**, **cloud-only**, and **pre-launch**, so treat as a non-
  privileged convenience / rough-capture step only. [Claims 9, 10]
  - **Alt runner-up (image+text → editable):** **CADAM** accepts image references and emits
    editable parametric output; geometry local, **LLM cloud** — privilege-safe only if the prompt
    is non-confidential or a local model is wired in. [Claims 11, 13, 14]

## Job 4 — Full DISCLOSURE→FIGURE pipeline
- **TOP PICK: a local CadQuery + build123d pipeline.** CadQuery (headless geometry backend,
  disclosure→model) + build123d (model→numbered black-line figures via `project_to_viewport` /
  `TechnicalDrawing` / `ExportSVG`), with a local LLM emitting CadQuery code and authoring figure
  descriptions/numeral tables. Fully local; privilege-safe; no turnkey product needed. [Claims
  18, 20–23]
- **RUNNER-UP (cloud convenience, non-privileged): Zoo Text-to-CAD API** as the generation
  anchor, exporting STEP, then projecting to figures locally with build123d. Generation stage is
  cloud (privilege trade-off per Job 2). [Claims 0, 1, 5]
- **Reality check:** no confirmed single product performs the *entire* disclosure→figure-set +
  descriptions + numeral-mapping flow; this job is assembled, and the description/numeral-mapping
  stage has no turnkey tool.

---

# If he adopts ONE thing first — start here

**Adopt the local OpenCASCADE Python stack — CadQuery + build123d — first.**

Rationale for a confidentiality-bound solo IP attorney:

1. **It is the only option that is unambiguously privilege-safe out of the box.** Both are
   Apache-2.0, pip-installable, run **fully local/offline** on the industrial OCCT B-rep kernel,
   and send **no data anywhere**. Nothing about routing a privileged disclosure through them
   triggers a Rule 1.6 concern. [Claims 15–19]
2. **Together they cover three of the four jobs locally:** invention 3D modeling (CadQuery),
   patent black-line figures (build123d's `project_to_viewport` + `TechnicalDrawing` +
   `ExportSVG`/`ExportDXF`), and the figure stage of a disclosure→figure pipeline. [Claims 16,
   20–22]
3. **It is the format the AI is converging on anyway.** CadQuery code is the LLM target in modern
   text-to-CAD research (Text-to-CadQuery) and in commercial tools (MakeIt3D generates CadQuery
   under the hood), so starting here keeps the door open to bolting on a local-LLM text→CadQuery
   step later without re-platforming. [Claims 8, 23]
4. **The cloud tools remain available as opt-in accelerators for non-privileged work** — Zoo's
   REST API for fast text→STEP generation on already-public subject matter, and Autodesk neural
   CAD once it ships — but they are convenience layers on top of, not replacements for, the local
   privilege-safe core. [Claims 0–7]

In short: **build123d + CadQuery as the privilege-safe foundation; reach for Zoo's API (paid/
enterprise tier only) when the matter is non-confidential and you want speed; watch Autodesk
neural CAD.**

---

# Caveats & time-sensitivity

- **Cloud confidentiality is vendor-asserted, not audited here.** Zoo's mitigations (SOC 2 Type
  II *expected* Q4 2025 — **a deadline that had already passed when this report was written
  (2026-05-29) and whose outcome was not verified here; confirm Zoo's current SOC 2 status
  directly before any privileged use** — ITAR/US-regulated region, enterprise private-data
  training) are claims on the vendor's trust page; the **Free-tier training statement is the
  firm, primary-sourced red flag**. Any privileged use of a cloud tool needs a signed
  confidentiality/DPA and a no-training assurance reviewed by the attorney. [Claims 2, 4]
- **Autodesk neural CAD is not generally available** as of May 2026 (announced AU 2025 as
  "upcoming"; multiple May-2026 sources confirm no GA date). Its integration surface and
  deployment/privilege posture cannot be evaluated until it ships. [Claims 6, 7]
- **MakeIt3D is early.** The text-to-CAD feature is Beta with **no API/CLI/SDK** (file-export
  only); the image-to-3D REST API is **pre-launch** ("schema not final"), image→mesh only, and
  not editable CAD. Endpoints and availability may change. [Claims 9, 10]
- **CADAM's local-ness is partial.** Geometry runs in-browser (local), but generation requires an
  **external LLM API key** and ships **no documented local-model option**, so by default the
  prompt/image goes to a cloud LLM. "Self-hostable + private" requires wiring a local model
  yourself. [Claims 13, 14]
- **build123d patent-figure capability is primitives, not turnkey USPTO compliance.** It produces
  the black-line views, layers, and title block, but reference-numeral numbering and figure
  lettering per USPTO/WIPO ST.96 must be scripted. [Claim 20]
- **One refuted claim (for transparency):** the assertion that LLMs "already excel at Python
  generation and spatial reasoning, making fine-tuning on text-to-CadQuery effective" did **not**
  survive verification (vote 1-2) and is **not** relied on here. The narrower, verified point —
  that CadQuery is a Python scripting language LLMs can target directly, avoiding command-sequence
  /CAD-vector intermediates — *is* used. [Claim 23 vs. refuted item]
- **WIPO ST.96 / USPTO drawing-rule conformance** (line-weight, shading, margin, numeral
  standards) was not found to be natively enforced by any tool in this set; conformance is a
  scripting/QA responsibility on top of the geometry/figure primitives.
- **Pricing** is directional only (free/OSS vs. cloud-tiered) and changes frequently; confirm at
  purchase time.

---

# Open questions

1. **Does any vendor offer a privilege-safe (no-training, signed-DPA, ideally on-prem/VPC)
   enterprise tier of a cloud text-to-CAD tool** that an IP firm could use for privileged
   disclosures — e.g., a Zoo enterprise/private deployment that keeps data in the firm's tenancy?
   (Zoo publishes enterprise private-training and an ITAR region, but on-prem/self-host of the
   engine appears unavailable.) [Claims 2, 3]
2. **What is Autodesk neural CAD's actual deployment and data-handling model** once GA — cloud-
   only, hybrid, or any on-device/edge inference — and what are its programmatic surfaces
   (API/SDK inside Fusion/Forma)? Not knowable until release. [Claims 6, 7]
3. **Is there a turnkey or near-turnkey "disclosure → numbered figure set + figure descriptions +
   reference-numeral mapping" product** (Job 4 end-to-end), or does this remain an assemble-it-
   yourself pipeline for the foreseeable future?
4. **Which local image-to-3D / photo-to-CAD options** (for the prior-art/reverse-modeling job)
   can run fully offline and feed an *editable* CadQuery/build123d model, rather than a cloud
   mesh-only service like MakeIt3D's image API? [Claims 9, 10]

---

# Source list (primary, per claim)

- Zoo Text-to-CAD API reference — `POST /ai/text-to-cad/{output_format}`, STEP source-of-truth,
  bearer token, cloud-only:
  https://zoo.dev/docs/developer-tools/api/ml/generate-a-cad-model-from-text [Claims 0, 1, 2]
- Zoo FAQ — engine not open source / Design Studio open source; KCL from Text-to-CAD; Free-plan
  training: https://zoo.dev/docs/faq [Claims 3, 4, 5]
- Zoo Design Studio app (engine closed, video-stream architecture): GitHub `KittyCAD/modeling-app`
  [Claim 3]
- Autodesk newsroom — upcoming neural CAD foundation models in Fusion/Forma (AU 2025):
  https://adsknews.autodesk.com/en/news/upcoming-3d-generative-ai-foundation-models/ [Claims 6, 7]
- MakeIt3D Text-to-CAD (CadQuery + OCCT worker; STL/STEP/3MF; no API/CLI/SDK for text-to-CAD):
  https://makeit3d.app/cad [Claims 8, 9]
- MakeIt3D developer/API docs (image→mesh REST API; pre-launch): https://makeit3d.app/developers
  [Claim 10] *(note: the API specifics live on /developers, not /cad)*
- CADAM — open-source text-to-CAD web app; GPLv3; OpenSCAD-WASM in-browser; external LLM keys:
  https://github.com/Adam-CAD/CADAM [Claims 11, 12, 13, 14]
- CadQuery — Python parametric CAD library on OCCT; Apache-2.0; headless/server use:
  https://github.com/CadQuery/cadquery (docs: https://cadquery.readthedocs.io) [Claims 15, 16, 17,
  18]
- build123d — Apache-2.0 Python BREP framework on OCCT; technical-drawing / 2D-exporter /
  projection capabilities: https://github.com/gumyr/build123d (docs:
  https://build123d.readthedocs.io) [Claims 19, 20, 21, 22]
- Text-to-CadQuery (LLMs generating CadQuery code directly): https://arxiv.org/pdf/2505.06507
  [Claim 23]
