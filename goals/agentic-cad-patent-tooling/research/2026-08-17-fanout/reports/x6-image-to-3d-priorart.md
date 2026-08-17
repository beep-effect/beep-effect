# X6 — Image / Drawing / Text → 3D for Prior-Art and Infringement Analysis

**Lane:** x6-image-to-3d-priorart
**As of:** 2026-08-17
**Use case:** A patent attorney has (a) prior-art patent figures (2D line drawings, often multi-view), (b) photos of an accused product, and (c) a text description. They want a 3D or dimensioned representation to compare against claim limitations.

**Method:** primary papers, official repos/model cards, vendor pages, USPTO drawing rules, and X.com 2026 product announcements. Items that could not be independently reproduced or that rest on marketing copy are marked **UNVERIFIED**. Dates on citations are publication or last-checked dates.

**Confidentiality note:** this report uses only public papers, product pages, and social evidence. No client disclosure or unpublished figure content.

---

## Executive snapshot

**None of the 2024–2026 image-to-3D generators produce CAD/B-rep.** TRELLIS, TRELLIS.2, Hunyuan3D 2.x/3.x, Rodin Gen-2.5, Meshy 6, Tripo P1, CSM, and Stable Fast 3D all emit **textured triangle meshes** (GLB/OBJ), optionally with PBR maps. They are game/e-commerce asset tools. They hallucinate unseen sides. They do not emit parametric features, sketch-extrude history, or dimensioned solids.

**The legally relevant path is not “photo → Meshy → compare to claim.”** It is three different jobs that must stay separate:

1. **Accused-product geometry** — if you have the physical object, industrial 3D scan + human scan-to-CAD is the only path with metrology-grade numbers. Photogrammetry is usable with a scale bar and a human. Generative image-to-3D is **not evidence**.
2. **Prior-art patent figures** — utility figures are **not to scale** (37 CFR 1.84(k) forbids “actual size” / “scale 1/2”). Classic orthographic-to-solid algorithms assume three clean, aligned vector views with the annotation layer stripped. Patent sheets violate every one of those assumptions. Automatic figure → dimensioned solid is **not viable in 2026**.
3. **Claim comparison** — even a perfect B-rep does not decide infringement or invalidity. Claim construction, numeral-to-spec mapping, and element-by-element comparison remain attorney work. 3D is at best a communication aid.

What *is* newly usable in 2025–2026: CAD-Recode / cadrille as a **first-pass sketch-extrude guess** on simple mechanical solids (human must edit the CadQuery); Fusion / Geomagic / Quicksurface as HITL mesh→B-rep; DeepPatent / DeepPatent2 / PatentOCR as figure-understanding datasets, not reconstruction engines; and TRELLIS / Hunyuan3D-2.1 as **local, open-weight illustration tools** (NVIDIA first; TRELLIS has a working AMD ROCm community fork).

---

## 1. Image → 3D generative models

### 1.1 The representation gap (read this first)

Every model in this section is trained to produce a **looks-right mesh** for games, AR, and product viz. None of them:

- emit B-rep faces/edges/vertices with analytic surfaces,
- emit sketch-extrude or CSG history,
- preserve manufacturing features (threads, snap-fits, draft, wall thickness),
- refuse to invent the unseen back of a single photo,
- treat a USPTO line drawing as an orthographic engineering view.

Feeding a TRELLIS/Hunyuan/Meshy mesh into Fusion “Convert Mesh” does **not** turn a generative asset into claim-comparable CAD. It turns one approximate surface into another. See §2.

### 1.2 Comparison table (as of 2026-08-17)

| System | First public / current | Output | Open weights? | Local VRAM (vendor or repo) | AMD ROCm | CAD/B-rep? |
| --- | --- | --- | --- | --- | --- | --- |
| **TRELLIS** (Microsoft) | 2024 paper; CVPR 2025 Spotlight | Mesh + 3D Gaussians + radiance field | Yes, MIT. [github.com/microsoft/TRELLIS](https://github.com/microsoft/TRELLIS) | Official: NVIDIA ≥16 GB. Community FP16 ~8 GB. | Community fork **TRELLIS-AMD**, tested RX 7800 XT 16 GB, May 2026 | No |
| **TRELLIS.2** | Dec 2025 (arXiv 2512.14692) | PBR mesh via O-Voxel, up to 1536³ | Yes. [microsoft.github.io/TRELLIS.2](https://microsoft.github.io/TRELLIS.2/); HF `microsoft/TRELLIS.2-4B`. Project page: research/academic materials, not commercial exploitation. | Official: NVIDIA ≥24 GB (A100/H100). 512³ ~3 s / 1024³ ~17 s / 1536³ ~60 s on H100. | Community ROCm port claimed (`Lamothe/TRELLIS.2_rocm`, r/ROCm Dec 2025). **UNVERIFIED** quality vs CUDA. | No |
| **Hunyuan3D-2.0** | Jan 2025 (arXiv 2501.12202) | Textured mesh | Yes. [github.com/Tencent-Hunyuan/Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) | Repo: 6 GB shape, 16 GB shape+texture. | NVIDIA-first. Community WinPortable / 2GP exist. Official ROCm: **UNVERIFIED**. | No |
| **Hunyuan3D-2.1** | 13 Jun 2025 (arXiv 2506.15442) | Mesh + PBR (albedo/normal/rough/metal) | Weights + training code. Tencent Hunyuan 3D 2.1 **Community License**, not Apache. [github.com/Tencent-Hunyuan/Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) | Official: 10 GB shape / 21 GB texture / 29 GB full. Shape 3.3B + Paint 2B. | NVIDIA CUDA 12.4 in official install. Official ROCm: **UNVERIFIED**. | No |
| **Hunyuan3D 3.0 / 3.1 Pro** | 3.0 announced ~16 Sep 2025; 3.1 Pro in API catalogs Feb 2026 | High-poly mesh, up to ~1.5M faces, 8-view input, 4K PBR | **No.** Cloud / Tencent Cloud API / reseller APIs (Runware, Scenario, Layer). 2.5/3.x weights withheld (HN commentary Jun 2025). | N/A locally | N/A | No |
| **Rodin Gen-2.5** (Hyper3D) | Press release 26 May 2026 | Native 3D mesh, UV, optional parts/refine | **No.** [hyper3d.ai](https://hyper3d.ai/) | N/A locally | N/A | No |
| **Meshy 6** | In production by Apr 2026 reviews | Quad or tri mesh, watertight claims, remesh, A/T-pose | **No.** [meshy.ai](https://www.meshy.ai/) | N/A locally | N/A | No |
| **Tripo P1** (and Tripo 3.1 / H3.1) | Head-to-heads on X Aug 2026 | Game-oriented mesh, rigging/workflow extras | **No.** [studio.tripo3d.ai](https://studio.tripo3d.ai/) | N/A locally | N/A | No |
| **CSM** (Common Sense Machines) | Ongoing; Image-to-Kit / Cube topology | Production mesh, parts, sketch input | **No.** [csm.ai](https://www.csm.ai/) | N/A locally | N/A | No |
| **Stable Fast 3D** | 1 Aug 2024 (arXiv 2408.00653) | UV-unwrapped mesh + delighting | Yes, Stability Community License (non-commercial / <$1M revenue). [github.com/Stability-AI/stable-fast-3d](https://github.com/Stability-AI/stable-fast-3d) | ~6 GB default; 0.5 s / asset claimed on 7 GB GPU | **HIP support merged 18 Jan 2025** (`texture_baker` HIP kernels). Experimental, not a full ROCm product cert. | No |

Sources for the table: TRELLIS.2 project page (checked 2026-08-17); TRELLIS GitHub hardware note; TRELLIS-AMD README (status May 2026); Hunyuan3D-2.1 README Models Zoo; Runware Hunyuan 3.1 Pro docs dated 10 Feb 2026; Hyper3D Rodin 2.5 USA Today PR 26 May 2026; Stability SF3D announcement 1 Aug 2024 and GitHub; X posts cited in §1.5.

### 1.3 Per-model notes that matter for this use case

**TRELLIS / TRELLIS.2.** Structured latents (SLAT, then O-Voxel). TRELLIS.2 is a 4B flow-matching transformer; official page lists open surfaces, non-manifold, interior structure, and PBR (base color, roughness, metallic, alpha). That is topology flexibility for *graphics*, not feature CAD. Microsoft’s TRELLIS.2 page is explicit: “purely a research project” and materials “not intended for commercial exploitation” ([microsoft.github.io/TRELLIS.2](https://microsoft.github.io/TRELLIS.2/), checked 2026-08-17). License on the original TRELLIS repo is MIT; TRELLIS.2 project-page disclaimer is stricter — **read both before shipping**. Local-run on NVIDIA is real. Local-run on AMD is real for TRELLIS-1 via [CalebisGross/TRELLIS-AMD](https://github.com/CalebisGross/TRELLIS-AMD) (RX 7800 XT, ROCm 7.2.1, staged 16 GB; GLB bake 5–10 min; ~7% silent triangle culls documented). TRELLIS.2-on-ROCm is a second-hand Reddit/GitHub claim.

**Hunyuan3D.** The open line stops at **2.1**. Official 2.1 README: shape then PBR paint; 10/21/29 GB; Mac/Win/Linux via PyTorch CUDA; ComfyUI community nodes exist. Benchmarks in the 2.1 README are ULIP/Uni3D/CLIP-FID — perceptual, not dimensional. The 3.0/3.1 Pro line (8-view, 1.5M faces, “watertight,” “clean quads”) is **API-only**. Reseller pages (Scenario, Runware, 3daistudio) describe 8-view input as front/back/left/right/top/bottom plus 45° — useful if you already have those photos of an *accused product*, useless for a typical utility-patent sheet. Tencent X account @TencentHunyuan announced Hunyuan3D 3.0 with “3× higher precision, 1536³ geometric… Available via Tencent Cloud API” (16 Sep 2025, [x.com/TencentHunyuan/status/1967873084960260470](https://x.com/TencentHunyuan/status/1967873084960260470)).

**Rodin / Meshy / Tripo.** Closed SaaS. August 2026 X head-to-heads treat **Tripo P1, Meshy V6, Hunyuan V3.1 Pro, Rodin 2.5** as the current commercial quartet (@mintdotgg, 13–14 Aug 2026, posts 2087923562745151977 and 2088363640202162667). Those tests score *helmet reflections and game usability*, not hole diameters. A 16 Aug 2026 indie-dev post claimed “Image to 3D model is basically solved” (@SyntheticBeef, 2089066120154427726) — true for a textured prop, false for a claim chart. Meshy’s own tutorial (checked 2026-08-17) recommends Meshy 6 as default for “cleanest geometry”; that is marketing, not a metrology claim.

**CSM.** Sketch- and image-conditioned production meshes, parts, Image-to-Kit. Meta wrote up CSM’s use of SAM 2 (1 May 2025, [ai.meta.com/blog/segment-anything-common-sense-machines-3d-assets](https://ai.meta.com/blog/segment-anything-common-sense-machines-3d-assets/)). Still a mesh vendor, not a CAD kernel.

**Stable Fast 3D.** Oldest of the “fast feed-forward” open meshes (TripoSR lineage). 6 GB, ~0.5 s, UV + delight. HIP kernels landed Jan 2025. Quality is 2024-class; do not use it as a 2026 SOTA stand-in. Useful as a cheap local previewer.

### 1.4 What these models do to *patent figures* and *product photos*

| Input | What the generator actually does | Fit for legal comparison |
| --- | --- | --- |
| Single product photo | Invents occluded sides and internals; bakes lighting into geometry | **No.** Hallucinated back/underside is fatal for “every element present.” |
| 4–8 calibrated product photos | Hunyuan 3.1 Pro / some Meshy-Tripo multi-view modes constrain more of the hull | **Still no** for internals, hidden fasteners, wall thickness. Illustration only. |
| Utility patent line drawing (isometric + numerals) | Out-of-distribution. Models trained on photos/renders treat hatching, lead lines, and exploded parts as geometry | **No.** Numerals become blobs; exploded parts become a fused blob. |
| Three clean orthographic photos of a physical part | Better hull; still a mesh, still no features | Illustration / starting mesh for HITL scan-to-CAD, not a claim chart. |
| Text description of a claim | Text-to-3D (Hunyuan/Meshy/Tripo) produces a *plausible object matching the words*, not the accused product or the prior-art figure | **Dangerous.** Looks like evidence; is a prompt hallucination. |

### 1.5 X.com 2026 release pulse (this field announces there first)

Confirmed in-the-wild as of mid-August 2026:

- **Commercial SOTA set people actually A/B:** Tripo P1, Meshy V6, Hunyuan 3.1 Pro, Rodin 2.5. Same-image helmet tests by @mintdotgg, 13–14 Aug 2026 ([2087923562745151977](https://x.com/mintdotgg/status/2087923562745151977), [2088363640202162667](https://x.com/mintdotgg/status/2088363640202162667)).
- **Open-weight SOTA people run locally:** TRELLIS.2 (announced Dec 2025; still the 2026 “Microsoft open-sourced 4B image-to-3D” meme — Community Notes on a 30 Mar 2026 recap correctly flag the Dec 2025 date). Hunyuan3D-2.1 remains the local Tencent line; 3.x is API.
- **Practitioner caution, not hype:** @mattworkman (16 Aug 2026, 2088981238652489896): “Image to 3D is juuust getting to the point where it can start to be used in production or the base of a model. Just need topo/UV/texture atlas etc. to keep improving.” That is a *game-asset* bar.
- **Hunyuan3D-2 multi-view used as four-view → mesh:** @kuma3ism, 16 Aug 2026 (2089076302393532597), Japanese workflow: four-view figure → hunyuan3d-2mv mesh → hunyuan3d-2-1-full texture. Interesting as a *figure-sheet* experiment; quality for mechanical features **UNVERIFIED**.
- **TRELLIS.2 local pipeline still finicky:** @asuka__create, 16 Aug 2026 (2088994003928940619), asking for machine specs because Trellis 2 pipelines “just don’t work well.”

---

## 2. Mesh → CAD / B-rep reverse engineering

This is the step people skip when they say “we’ll just convert the GLB.” It is the hard step.

### 2.1 Academic / open methods (point cloud or mesh → parametric)

**CAD-Recode** (Rukhovich et al., ICCV 2025; arXiv 2412.14042, v2 11 Mar 2025). Point cloud → **executable CadQuery Python** → B-rep when the script runs. Qwen2-1.5B + one linear point encoder. Trained on 1M procedurally generated sketch-extrude programs. Project page claim: **~10× lower Chamfer Distance** and **>20% higher IoU** than prior DeepCAD/Fusion360 methods; DeepCAD test CD **0.30** (×10³, median) vs CAD-SIGNet 3.43 when trained on their 1M set ([cad-recode.github.io](https://cad-recode.github.io/), checked 2026-08-17). Weights: Hugging Face `filapro/cad-recode-v1.5`. Output is **editable code**, which is the right representation for a human attorney/engineer to correct.

Caveats the page itself implies: trained on sketch-extrude families (line/arc/circle + box/cylinder abstractions). Fillets, lofts, sweeps, patterns, threads, sheet metal, and freeform are out of distribution. Real-world CC3D scans (noisy, missing, filleted) are much worse for the SFT-only recipe — cadrille’s paper cites CAD-Recode CC3D IoU ~60% without test-time sampling, ~74% with 10 samples (see next).

**cadrille** (Kolodiazhnyi et al., ICLR 2026; arXiv 2505.22914v3, 17 Feb 2026). Same CadQuery-output idea, but **multimodal**: point clouds, multi-view images, *or* text, on a Qwen2-VL. SFT on the 1M procedural set, then **RL** (DPO / Dr.CPPO) on handcrafted meshes *without* needing CAD-sequence labels. After RL they report, on their tables: image-recon DeepCAD CD 0.17 / IoU 92.2 / IR 0.0; point-cloud DeepCAD CD 0.17 / IoU 90.2 / IR 0.0; and they claim SOTA across 10 benchmarks including real-scan **CC3D** ([arxiv.org/html/2505.22914v3](https://arxiv.org/html/2505.22914v3), [github.com/col14m/cadrille](https://github.com/col14m/cadrille)). This is the first paper that can ingest *photos + a text claim* and emit a CAD script.

Caveats: DeepCAD/Fusion360 test shapes are still **simple mechanical solids**. “IoU 90% on DeepCAD” is not “the snap-fit housing in Fig. 3 matches the accused product to 0.1 mm.” Invalidity ratio near zero means the script *runs*, not that the solid is the right solid. Combining modalities in one prompt is listed as future work, not a shipped capability.

**Point2CAD** (Liu, Obukhov, Wegner, Schindler, CVPR 2024; arXiv 2312.04962). Hybrid analytic-neural: segment primitives, fit, recover B-rep topology. SOTA on ABC in 2024. Surfaces/edges/corners evaluated; ComplexGen is the usual baseline in their tables. Open-weights research code. Breaks down when primitive segmentation is wrong — which is the usual case on organic or heavily filleted parts.

**ComplexGen** (Guo et al., SIGGRAPH / TOG 2022). B-rep as a **chain complex** (vertices, curves, patches + incidence). Sparse-CNN encoder + tri-path transformer + global optimization. Structurally more complete than earlier primitive-fitters on ABC-scale CAD. Still research; not a product.

**Mesh2Brep** (Shen et al., 2025; PubMed 40030873). Robust primitive fitting + intersection-aware constraints. Authors claim it beats both classical and recent learning methods on their tests. **UNVERIFIED** outside the paper.

**Img2CAD** (You et al., SIGGRAPH Asia 2025; arXiv 2408.01437). Single-view photo → VLM (finetuned Llama 3.2) predicts discrete CAD program structure, then “TrAssembler” fills continuous parameters. ShapeNet-ish common objects, not USPTO figures. First-steps paper, not a legal tool.

**CAD2Program** (Wang et al., AAAI 2025; arXiv 2412.11892). Raster *engineering drawing* → InternVL → Python-like parametric program. **Cabinet furniture only**, 368k in-house drawings. Critical empirical point: using the **annotation layer** (dimensions, symbols) jumps reconstruction F1 from **62.65 → 82.76** and param accuracy 81.94 → 97.21 (Table 1 of the paper). That is the opposite of classic pipelines, which *strip* annotations. Domain is cabinets, not general mechanical patents.

**Related 2025–2026 CAD-from-drawings:** Zhang, Polette, Pinquié et al., “Reinforcement learning-based parametric CAD models reconstruction from 2D orthographic drawings,” SSRN 5174280 (2025) — cited by cadrille; full numbers not independently extracted here (**UNVERIFIED** beyond existence).

### 2.2 Commercial scan-to-CAD (this is what actually ships parts)

| Tool | What it does | Accuracy posture | Human? | Price signal |
| --- | --- | --- | --- | --- |
| **Autodesk Fusion — Convert Mesh** | Faceted (every triangle becomes a face — useless as CAD), Organic (T-splines-ish solid), Prismatic (merge face groups into planes/cylinders) | Prismatic is the only “looks like CAD” path. Autodesk support article (10 Jun 2024) is a troubleshooting page for **failed** prismatic converts; forum users report ~90% fail on random STLs without careful face groups. Face-groups blog, 3 Jun 2026: prismatic is commercial-license and needs Accurate face groups at 0.0001 mm boundary. | Yes. Face-group cleanup is the job. | Fusion subscription; prismatic is a paid-seat feature |
| **Geomagic Design X** (Hexagon) | Industry-standard scan → parametric CAD; live deviation vs scan; SolidWorks plugin; wizards for extrude/revolve/sweep | Hexagon markets “accurate CAD models from 3D scan data, faster.” Third-party 2026 guides cite **3–10× faster** than manual rebuild (Hexagon-sourced — treat as marketing). Metrology shops quote **±0.015 mm** *for the scan*, not for the auto-B-rep. | Always. “Wizards + analyst.” | Subscription from ~$1,900/yr “Go” plan (GoMeasure3D, 5 Jan 2026) up through Plus/Pro |
| **QUICKSURFACE** | Scan-to-CAD, 2026 kernel **Siemens Parasolid** | 2025 “Best 3D Scan-to-CAD” award (vendor PR, 31 Jul 2025). Competent mid-market alternative to Design X. | Yes | Mid-market; cheaper than full Design X historically |
| **Geomagic for SOLIDWORKS, Verisurf Reverse, PolyWorks, SpaceClaim/Discovery, CATIA DSE, NX Realize Shape** | Same family: region-fit, deviation color maps, history rebuild | Industrial RE. Accuracy is the *scanner + operator*, not a published auto-F1. | Yes | Enterprise |

**Honest accuracy.** On a **prismatic machined part** with a metrology scan (Artec/Hexagon/Creaform class, 0.02–0.1 mm), a skilled operator in Design X or Quicksurface produces a B-rep whose deviation map is good enough for aftermarket reverse engineering and, with a scale reference, for **showing** that a hole or boss is present. On an **organic consumer product**, you get NURBS patches, not features. On a **TRELLIS/Meshy mesh**, you get a B-rep of a hallucination.

Academic CD/IoU numbers are computed on **normalized** DeepCAD/ABC solids in a unit box. They do not transfer to “this 4.2 mm snap beam is in the accused product.”

### 2.3 Photogrammetry / scan of the *accused product* (the only honest photo path)

If the attorney has the physical product:

- **Industrial structured-light / laser scan:** Artec documents sub-millimeter as the RE bar; case writeups cite 0.1 mm on large assemblies ([artec3d.com/learning-center/accuracy-precision-resolution](https://www.artec3d.com/learning-center/accuracy-precision-resolution), 8 Oct 2024). Aftermarket RE practice quotes ±0.05–0.2 mm typical ([pshdesign.com](https://pshdesign.com/the-best-metrology-3d-scanners/), checked 2026-08-17).
- **Photogrammetry (many photos + scale bar):** textures look great; **scale drift** is the failure mode. A 2025 *Sensors* comparison (Nazim et al., PMC12693997) measured photogrammetry **relative error >10%** vs structured light on their object; structured-light scanner mode was the most stable. That paper’s absolute mm errors are object-scale-specific — do not quote them as a universal scanner spec.
- **Phone LiDAR / one-shot “scan this product” apps:** illustration.

**Generative image-to-3D is not a substitute for a scan.** A single photo cannot constrain the back, the interior, or any dimension.

---

## 3. Multi-view engineering drawing → 3D solid (the patent-figure case)

**This is the highest-value item and the one the 2026 generative-mesh wave does not solve.**

### 3.1 What the classic problem actually is

Given two or three **axis-aligned orthographic projections** (front / top / side) of a solid, recover a unique (or a small set of) 3D solid(s) whose projections match. This is a 1970s–2000s computational-geometry problem, not a 2024 diffusion problem.

Canonical lineage (as summarized by Wang et al. 2024, arXiv 2412.11892 §2.1, and the 1993 Wang & Grinstein review):

| Year | Work | Contribution |
| --- | --- | --- |
| 1973 | Idesawa, “A system to generate a solid figure from three views” | First practical system |
| 1980–81 | Markowsky & Wesley; Wesley & Markowsky | Principled pipeline: 3D vertices → edges → faces → solids, with ghost-element pruning |
| 1983 | Sakurai & Gossard | Solid from orthographic views in a CAD setting |
| 1986 | Gu, Tang, Sun | Efficient reconstruction |
| 1986 | Bin (CAD journal) | CSG from 2D orthographic views |
| 1988 | Lequette | Industrial-strength variant |
| 1994 | Yan, Chen, Tang | Broader surface types |
| 1996 | You & Yang | |
| 1998 | Shin & Shin; Kuo | Efficiency / completeness |
| 2001 | Liu et al. | |
| 2006 | Gong, Zhang, Sun (several CAD papers) | **Quadric** surfaces, extrusion + revolution |
| 2007 | Fahiem et al. review | “Crucial research area since decades” |
| 2020 | Hoang, “3D Solid Reconstruction from 2D Orthographic Views” | Two-view systems still being published |
| 2023 | Zhang, Pinquié, Polette, Carasi, de Charnace, Pernot | Automatic 3D CAD from 2D orthographic drawings. Validated on Fusion 360 Gallery SVGs; authors report **99.59% F-score** on well-reconstructed models ([pastel.hal.science/G-SCOP_CI_CC/hal-04164264v1](https://pastel.hal.science/G-SCOP_CI_CC/hal-04164264v1); dataset on Zenodo record 7785223). Input is **clean vector SVG**, not a USPTO TIFF. |
| 2023 | Hu et al., PlankAssembly | Learning-based; **cuboid planks only**; needs three vector views |
| 2024–25 | CAD2Program (Wang et al.) | Raster drawing + annotations → parametric program; **cabinets** |
| 2025 | Zhang et al. RL parametric CAD from orthographic drawings (SSRN 5174280) | Continues the Grenoble / Pinquié line |

Wang et al. 2024 state the industrial fact of record: *“in the current design and manufacturing industry, human labor is still extensively used to manually realize these 3D object models… We are yet to see the successful application of automatic techniques in commercial CAD software.”* ([arxiv.org/html/2412.11892v1](https://arxiv.org/html/2412.11892v1), 16 Dec 2024). That sentence is still true in August 2026.

### 3.2 Assumptions that hold on a Fusion 360 drawing and **fail on a patent figure**

Classic and 2023 Zhang-style systems assume most of the following. USPTO utility figures typically violate all of them.

| Assumption | Engineering drawing | USPTO utility figure |
| --- | --- | --- |
| Exactly 3 axis-aligned views, same scale | Yes, by construction | Mixed isometric, perspective, exploded, sectional, fragmentary, schematic |
| Clean **vector** geometry layer | SVG/DXF | Raster TIFF/PDF; even “vector” PDFs are often flattened |
| Annotation layer stripped | Required by classic methods | Numerals, lead lines, hatching, flow arrows, phantom lines, FIG. labels **are the drawing** |
| Hidden lines dashed correctly | Drafting standard | Often omitted; 37 CFR 1.84 allows various view types |
| Dimensioned, to scale | Yes | **Forbidden to mark scale.** 37 CFR 1.84(k): indications such as “actual size” or “scale 1/2” are not permitted ([law.cornell.edu/cfr/text/37/1.84](https://www.law.cornell.edu/cfr/text/37/1.84)). Drawings disclose *shape and relationship*, not manufacturing dimensions. |
| Single solid, manifold | Typical benchmark | Assemblies, exploded brackets, alternate embodiments, flowcharts, block diagrams |
| Algebraic surfaces (plane/quadric) | The 2006 Gong line | Freeform consumer products, organics, textiles, GUI mockups |

Zhang 2023’s 99.59% F-score is on **Fusion 360 Gallery-derived SVG triples** of CAD solids — the distribution the algorithm was built for. It is not a patent-figure number. Citing it as “orthographic reconstruction is solved” is a category error.

### 3.3 What a patent sheet actually contains

A typical US utility sheet is a **communication drawing**, not a manufacturing drawing:

- Views may be plan, elevation, section, **or perspective** (37 CFR 1.84(h)).
- Exploded views with a bracket are explicitly allowed (1.84(h)(1)).
- Detail views may be at a **different scale** from the parent view (1.84(h)).
- Reference characters sit *outside* the outline, joined by lead lines that must not cross (1.84(p), 1.84(q)).
- The same part must keep the same numeral across all figures; every numeral must appear in the spec and vice versa (MPEP 608.02 practice).
- Hatching denotes sectioned material, not geometry.
- Phantom lines, hidden lines, and flow arrows are semantic, not solid edges.

A reconstruction system that treats every black stroke as a silhouette edge will invent walls out of lead lines and hatch.

### 3.4 Modern learning approaches aimed at drawings (not photos)

1. **Strip annotations, run classic reconstruction.** Requires a working geometry/annotation separator. CAD2Program argues this separation is *itself* unsolved because dimension lines and object edges look the same. No production patent-figure separator exists.
2. **Keep annotations, let a VLM read them (CAD2Program).** Works when the output primitive family is closed (cabinets) and you have 368k labeled pairs. There is no public 368k **utility-patent-figure → B-rep** corpus. DeepPatent2 is design patents (appearance), not utility solids.
3. **Four-view raster → Hunyuan3D-2mv** (the Aug 2026 amateur workflow). Produces a *mesh that looks like the four views*. No features, no numerals, no dimensions, no claim mapping.
4. **cadrille on rendered multi-view images of a CAD solid.** Those images are shaded perspective renders of DeepCAD parts, not line drawings. Transfer to USPTO figures is **UNVERIFIED** and likely poor.

### 3.5 Design-patent multi-view is a different, slightly easier problem

Design patents *do* ship consistent multi-view sets (front/back/left/right/top/bottom/perspective) of a single article of manufacture. DeepPatent2 tagged 22,394 viewpoint strings and notes that objects have “diverse and disproportionate viewpoints, which poses challenges for 3D reconstruction from 2D sketches” (Ajayi et al., *Sci Data* 2023, [pmc.ncbi.nlm.nih.gov/articles/PMC10630310](https://pmc.ncbi.nlm.nih.gov/articles/PMC10630310/)). The authors list 3D reconstruction as a *hoped-for* use of the dataset, not a delivered model.

A design-patent six-view set is closer to Hunyuan 3.1 Pro’s 8-view API than a utility sheet is. Even then the output is a mesh of the **ornamental appearance**, which is the right object for design-patent infringement (ordinary-observer test) and the wrong object for utility claim limitations.

### 3.6 Bottom line for this section

- **Classic reconstruction is mature on the problem it stated in 1980** and is still not in commercial CAD as an unsupervised button.
- **2023 Zhang-style vector pipelines are excellent on clean CAD exports** and have not been shown on USPTO rasters.
- **2024–2026 VLMs (CAD2Program, cadrille, Img2CAD) reconstruct parametric solids from drawings or photos only inside narrow primitive families**, with a human expected to read the script.
- **Automatic utility-figure → dimensioned solid, general mechanical subject matter, 2026: not viable.**

---

## 4. Patent drawing vectorization and figure understanding

This is the preprocessing layer everyone needs and almost nobody has as a closed product.

### 4.1 Raster → clean vectors

USPTO bulk figures are TIFF (design and many utility). Published PDFs are mixed raster/vector.

| Tool / method | What it does | Patent-aware? |
| --- | --- | --- |
| Potrace / Autotrace / vtracer | Bitmap → SVG paths | No. Hatching becomes a thousand tiny polygons. Numerals become outlines. |
| Adobe Illustrator Image Trace, Vectorizer.ai | Same, better cleanup | No |
| PatentDrawingAI, PatentFig.ai | Marketed as “vectorize / upscale / 37 CFR 1.84” | **Generation and cleanup of outgoing figures**, not reverse-understanding of prior art. PatentDrawingAI (checked 2026-08-17) auto-places numerals on *new* drawings and says files “never train AI.” That is a drafting tool. |
| Human illustrator | The actual industry | $30–$150/utility sheet (see sibling lane x3) |

There is **no published model** whose job is “USPTO utility TIFF → CAD-clean geometry layer + separate annotation layer,” evaluated on a public utility-figure test set.

### 4.2 Reference-numeral OCR and lead-line association

This is the mapping `numeral → leader → graphic feature → spec paragraph → claim element`. It is the actual attorney pain.

**What exists:**

- **Generic OCR on figures.** DeepPatent2 evaluated engines on design-patent figure *labels* (the “FIG. 1” tokens), not utility reference numerals. AWS Rekognition + a rectifier: F1 **0.968** (recall 0.960, precision 0.976) vs Tesseract F1 0.608 (Ajayi et al. 2023, Table 3). Design-patent “FIG. n” is large, isolated, high-contrast. Utility reference numerals are 0.32 cm minimum, often rotated, often colliding with hatching.
- **DeepPatent2 caption NER.** DistilBERT+BiLSTM-CRF on design-patent *captions* (not on-drawing numerals): F1 0.960 overall, 0.927 object name, 0.992 viewpoint (n=300 test captions).
- **PatentOCR** (Wang et al., *Scientific Data* 2026, [doi:10.1038/s41597-026-07829-5](https://www.nature.com/articles/s41597-026-07829-5)). New dedicated benchmark: **2,236 patent drawings, 20,165 pixel-level fine-grained annotations and their associated arrows or guiding lines.** This is the first public dataset that treats **lead-line association** as a first-class label. As of 2026-08-17 the Nature page exists; a production model built on it was **not** found. Treat the dataset as real; treat “solved OCR+leaders” as **UNVERIFIED**.
- **PatentLMM / PatentMME** (arXiv 2501.15074, Jan 2025). Multimodal model for *generating figure descriptions* from HUPD-linked figures (~900k figures crawled). Description generation ≠ numeral-to-geometry graph.
- **Hoque et al. 2022** (ODU / LANL): compound-figure segmentation on US patents. Point-shooting 92.5%, MedT 97% on their 500-file design-patent set. Reused as DeepPatent2’s segmenter.

**What does not exist as a product:** a system that, given a utility figure and the spec, emits a verified table `{12 → “housing 12” → claim 1 preamble}` with lead-line geometry attached. Rowan-style drafting tools keep a numeral dictionary **inside a document the firm authored**. They do not extract numerals from a 1998 prior-art TIFF.

### 4.3 Datasets (do not confuse the names)

| Name | What it actually is | Size | Utility vs design | 3D / numerals? |
| --- | --- | --- | --- | --- |
| **DeepPatent** (Kucer et al., WACV 2022) | Design-patent drawing **retrieval** benchmark + “PatentNet” retrieval network | >350k drawings | **Design** | Retrieval only. No 3D, no numeral graph. [github.com/GoFigure-LANL/DeepPatent-dataset](https://github.com/GoFigure-LANL/DeepPatent-dataset) |
| **DeepPatent2** (Ajayi et al., *Sci Data* 2023) | Segmented design figures + object name + viewpoint from captions | 2.79M segmented figures from 366,275 design patents (2007–2020); 132,890 object names; 22,394 viewpoints. Verified overall error **11.7%**. Harvard Dataverse 10.7910/DVN/UG4SBD | **Design** | Multi-view tags. Authors *propose* 3D reconstruction as future work. OCR is of FIG. labels. |
| **PatentNet** (Li et al., arXiv 2106.12139) | Incomplete-multiview industrial-goods image DB from **design patents**, Locarno 32 / 219 subclasses | Claims **>6M** images; promised at iplab.gpnu.edu.cn / GitHub. Public-dump availability in 2026 **UNVERIFIED** | **Design** | Classification / retrieval / clustering. Not reconstruction. |
| **PatentNet** (Roudsari et al., *Scientometrics* 2021) | **Text** multi-label CPC/IPC classifier | USPTO-2M | Text | Unrelated name collision |
| **PatentNet** (inside the DeepPatent paper) | The authors’ retrieval **network** | — | — | A model, not a dataset |
| **PatentOCR** (Wang et al., *Sci Data* 2026) | Fine-grained drawing annotations + arrows/lead lines | 2,236 drawings / 20,165 annotations | Patent drawings (paper title; mix **UNVERIFIED** without full PDF) | **Lead-line task.** No 3D. |
| **IMPACT** (NeurIPS 2024 Datasets) | Multimodal patent analysis | 0.5M design patents, **3.61M figures** + captions | **Design** | Captions, not B-rep |
| **HUPD** (Harvard USPTO Dataset) | Utility patent **text** | 4.5M+ applications | Utility text | Figures not first-class |
| **USPTO bulk** | Official XML + TIFF | All granted / PGPub | Both | Raw. No labels. |
| **CLEF-IP 2011** | Heterogeneous patent images (flowcharts, chemistry…) | ~10k | Mixed | 9-class retrieval |
| **CAD2Program cabinets** | In-house 368k drawing↔parametric pairs | 368k | Furniture drawings, not patents | The only large drawing→program set; not public USPTO |

**Implication:** the large public figure datasets are **design-patent appearance** corpora. They are the right pretraining data for “what does this bottle look like from the left,” and the wrong pretraining data for “reconstruct the internal mechanism of US 7,xxx,xxx Fig. 4.”

### 4.4 Vectorization + understanding pipeline that is actually buildable in 2026

A HITL pipeline that is honest:

1. Pull TIFF/PDF from USPTO bulk / PatentsView ODP (PatentsView → data.uspto.gov transition 20 Mar 2026).
2. Segment compound sheets (DeepPatent2/MedT-class; expect ~5–12% error, flag mismatches).
3. OCR FIG. labels (Rekognition-class, F1 ~0.97 on design labels; budget worse on utility numerals).
4. Run a lead-line detector trained or few-shot-prompted on PatentOCR-style boxes (**new, unproven in production**).
5. Align numerals to spec with a dictionary + fuzzy match; **attorney confirms**.
6. Do **not** auto-build a solid. Optionally: human traces three views into CAD, or a VLM proposes a CadQuery draft for a *simple* housing.

That pipeline is a **document-understanding** product, not a 3D product.

---

## 5. Honest accuracy assessment for legal comparison

### 5.1 What “good enough” would have to mean

| Legal task | Geometric bar | Can 2026 automation meet it? |
| --- | --- | --- |
| **Design-patent** ordinary-observer comparison | Appearance similarity; multi-view consistency | **Closest yes.** DeepPatent-style retrieval is a real research task. A Hunyuan/TRELLIS mesh from a design-patent six-view set can be a *visual aid*. It is not the test the court applies. |
| **Utility infringement (literal)** | Every limitation present in the accused product | **No, from figures or a single photo.** You need the product (or a metrology scan of it) and a claim construction. A generated mesh cannot prove a limitation. |
| **Utility infringement (DOE)** | Insubstantial differences; function-way-result | **No.** Legal + factual. 3D is a prop. |
| **§102 anticipation from a patent figure** | A single reference discloses every limitation | A figure can disclose a limitation **as a drawing**. Reconstructing a 3D model is neither necessary nor sufficient. Examiners and courts read the figure. An automated solid that “fills in” hidden structure is a new, uncited disclosure — i.e., a liability. |
| **§103 obviousness** | Combination + motivation | 3D irrelevant except as a teaching aid. |
| **Claimed dimensions / ranges** | Numbers live in the **spec and claims**, not the figure | Figures are not to scale (1.84(k)). Measuring a reconstructed solid and comparing to a claim range is **incompetent** unless the spec supplies the number. |
| **ITC / damages / design-around** | Often wants a real CAD of the accused product | **HITL scan-to-CAD**, not generative. |

### 5.2 Evidence, not vibes

- CAD2Program, 2024: automatic drawing→3D is **still not in commercial CAD** after 50 years of the classic problem.
- Zhang 2023: 99.59% F-score **on clean CAD SVGs**, not patents.
- CAD-Recode / cadrille: SOTA CD/IoU on **DeepCAD-scale sketch-extrude**. CC3D real scans required RL + still a research gap.
- Fusion prismatic convert: official docs are failure-recovery docs; users report high fail rates.
- 37 CFR 1.84(k): you are not allowed to treat the figure as a scale drawing.
- Photogrammetry vs structured light (Nazim 2025): photogrammetry **>10% relative error** in that study; do not use phone photogrammetry as a micrometer.
- X.com 2026 commercial A/Bs: helmets, characters, game assets. Zero patent-figure evaluations from the vendors.

### 5.3 The three inputs, scored

**(a) Prior-art patent figures.**
Usable automatically: panel segmentation, FIG. label OCR, (soon) lead-line boxes, retrieval of similar design figures.
Not usable automatically: dimensioned solid, hidden-feature recovery, claim-element presence.
Human-in-the-loop: illustrator or mechanical designer rebuilds a *didactic* 3D from the figure for a slide. Label it “attorney’s interpretation of Fig. 2, not to scale.”

**(b) Photos of an accused product.**
If you have only one or two marketing photos: generative 3D is a **toy**. Do not put it in a claim chart.
If you can photograph the product in the office with a scale bar, 30+ views, controlled lighting: photogrammetry → mesh → human scan-to-CAD. Usable for “the port is on the left side and is rectangular.”
If you can send it to a scanning shop: this is the **solved** path for accused-product geometry.

**(c) Text description.**
Text-to-CAD (CAD-Recode’s GPT-4o editing demo, cadrille text modality, Text2CAD, Zoo text-to-CAD — see sibling lanes) can draft a **hypothesis solid** from claim language. That solid is the attorney’s *interpretation of the claim*, not evidence about the world. Useful as a checklist (“did we remember the flange?”). Fatal if someone measures it and calls it the accused product.

### 5.4 Plain verdict on “is any of this good enough for a legal comparison?”

**No automated image/drawing → 3D pipeline in 2026 is good enough to be the comparison.** It is good enough to be a **visual exhibit of a human comparison that already happened**, or a **search/triage aid** (especially design-patent retrieval).

Putting a Meshy/TRELLIS/Hunyuan solid of a prior-art figure next to a Meshy/TRELLIS/Hunyuan solid of a product photo and declaring “the claim reads on” would be, in this author’s view, sanctionable sloppiness. Both solids contain invented geometry. Neither is to scale. Neither is tied to numerals.

---

## 6. Verdict: solved / HITL / not viable in 2026

### (a) Solved (ship it)

- Pulling published figures from USPTO bulk / ODP.
- Design-patent **image retrieval** (DeepPatent and follow-ons).
- Compound-figure **segmentation** at ~90–97% on design sheets, with mismatch flags.
- FIG. label OCR on clean design sheets (commercial OCR + rectifier).
- **Metrology scan of a physical accused product** with a competent shop (structured light / laser).
- **Human** scan-to-CAD of a prismatic part in Geomagic Design X / Quicksurface / Fusion prismatic, with a deviation map against the scan.
- Local **illustration-quality** image→mesh on NVIDIA (TRELLIS, Hunyuan3D-2.1, SF3D) and, for TRELLIS-1, on AMD RX 7800-class via TRELLIS-AMD.
- Treating utility figures as **not to scale**, because the CFR already says so.

### (b) Usable with a human in the loop

- Multi-view product photos + scale bar → photogrammetry mesh → operator rebuilds B-rep. Quote the deviation map, not the generator.
- CAD-Recode / cadrille as a **first CadQuery draft** for a simple mechanical housing the human then edits. Best current open technical bet for “text + views → editable solid.”
- Fusion organic/prismatic convert on a *scan* mesh (not a generative mesh), after face-group cleanup.
- Numeral OCR + lead-line proposals (PatentOCR-class) **reviewed against the spec**.
- VLM reading of a figure + spec to propose numeral↔paragraph links (expect errors; attorney signs).
- CAD2Program-style reconstruction if you restrict the primitive catalog and accept a script, not a verdict.
- Classic Markowsky–Wesley / Zhang-2023 reconstruction **after a human has traced three aligned views into clean SVG** and stripped leaders/hatch.
- Design-patent six-view → Hunyuan 3.1 Pro / TRELLIS.2 mesh as a **jury visual**, clearly labeled.
- Local TRELLIS.2 on 24 GB NVIDIA for the same illustration role; ROCm TRELLIS.2 only if you accept community-port risk.

### (c) Not viable in 2026

- Automatic **utility patent figure → dimensioned B-rep** across general mechanical subject matter.
- Automatic **single product photo → claim-comparable solid** (hallucinated backside/interior).
- Any pipeline that **measures** a reconstructed figure-solid and compares the measurement to a claim range.
- Generative mesh (TRELLIS / Hunyuan 3.x / Meshy 6 / Tripo P1 / Rodin 2.5) → automatic Mesh-to-BRep → claim chart.
- Closed-loop **numeral → lead line → feature → claim limitation** without a human.
- Local Hunyuan 3.0 / 3.1 Pro, Meshy 6, Tripo P1, Rodin 2.5, CSM Cube — **no open weights**; not runnable on the firm’s AMD box.
- Official Hunyuan 3.x or TRELLIS.2 **ROCm** as a supported vendor path.
- Treating DeepPatent / PatentNet / DeepPatent2 as if they were utility-mechanism reconstruction datasets. They are design-appearance datasets.
- Exploded views, flowcharts, electrical schematics, GUI figures, and hybrid sheets as inputs to any current solid reconstructor.
- Using text-to-3D output as if it were the accused product or the prior-art embodiment.

### Practical build recommendation for this goal (not a purchase order)

If the firm wants software rather than a research demo:

1. **Do not** productize image-to-3D generators as the comparison engine.
2. **Do** productize figure understanding: segment, OCR, lead-line boxes, numeral↔spec audit. PatentOCR (2026) is the dataset to fine-tune on. Keep a human confirm step. This is adjacent to, not duplicative of, lane x3 (outgoing figure drafting).
3. **Do** support an accused-product path that starts with a **scan or a photogrammetry kit**, not a Midjourney-like 3D button.
4. **Do** keep CadQuery/cadrille as an optional “draft a solid from the claim text” notebook, watermarked as interpretation.
5. **Do** run TRELLIS or Hunyuan3D-2.1 locally (NVIDIA, or TRELLIS-AMD on the 7800 XT) only for **exhibits**.
6. **Do not** send unpublished client figures to Meshy / Tripo / Rodin / Hunyuan Cloud. The open-weight local models exist specifically so that step is avoidable.

---

## Sources

### Image-to-3D models
- TRELLIS.2 project page, Microsoft, checked 2026-08-17: https://microsoft.github.io/TRELLIS.2/
- TRELLIS.2 paper: https://arxiv.org/abs/2512.14692
- TRELLIS.2 weights: https://huggingface.co/microsoft/TRELLIS.2-4B
- TRELLIS (v1) repo: https://github.com/microsoft/TRELLIS
- TRELLIS-AMD (ROCm, status May 2026): https://github.com/CalebisGross/TRELLIS-AMD
- Hunyuan3D-2.1 repo / Models Zoo: https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
- Hunyuan3D 2.1 paper: https://arxiv.org/pdf/2506.15442
- Hunyuan3D-2.0 repo: https://github.com/Tencent-Hunyuan/Hunyuan3D-2
- Hunyuan 3.1 Pro API (Runware, 10 Feb 2026): https://runware.ai/docs/models/tencent-hunyuan-3d-3-1-pro
- Tencent Hunyuan3D 3.0 announcement (X, 16 Sep 2025): https://x.com/TencentHunyuan/status/1967873084960260470
- Stable Fast 3D repo: https://github.com/Stability-AI/stable-fast-3d
- Stability SF3D announcement, 1 Aug 2024: https://stability.ai/news-updates/introducing-stable-fast-3d
- Hyper3D Rodin: https://hyper3d.ai/
- Rodin Gen-2.5 PR, 26 May 2026: https://www.usatoday.com/press-release/story/33429/hyper3d-launches-rodin-gen-2-5-bringing-sculpt-level-detail-and-production-control-to-ai-3d-generation/
- Meshy image-to-3D guide: https://www.meshy.ai/tutorials/image-to-3d-model-complete-guide
- CSM / SAM 2 writeup, 1 May 2025: https://ai.meta.com/blog/segment-anything-common-sense-machines-3d-assets/

### X.com 2026 (primary social)
- @mintdotgg, 13 Aug 2026, 2087923562745151977 — Tripo P1 vs Meshy V6 vs Hunyuan V3.1 Pro vs Rodin 2.5
- @mintdotgg, 14 Aug 2026, 2088363640202162667 — follow-up geometry/materials showdown
- @SyntheticBeef, 16 Aug 2026, 2089066120154427726 — “Image to 3D model is basically solved”
- @mattworkman, 16 Aug 2026, 2088981238652489896 — production-base-of-a-model, not done
- @kuma3ism, 16 Aug 2026, 2089076302393532597 — 4-view → Hunyuan3D-2mv
- @TencentHunyuan, 16 Sep 2025 — Hunyuan3D 3.0, API-only
- @victormustar, 17 Dec 2025, 2001207429237703036 — TRELLIS.2 launch
- Community Note on 2038549375794995614 — TRELLIS.2 released Dec 2025, not Mar 2026

### Mesh → CAD
- CAD-Recode project: https://cad-recode.github.io/ — paper https://arxiv.org/abs/2412.14042 — code https://github.com/filaPro/cad-recode
- cadrille paper (v3, 17 Feb 2026): https://arxiv.org/html/2505.22914v3 — code https://github.com/col14m/cadrille
- Point2CAD: https://arxiv.org/abs/2312.04962
- ComplexGen: https://haopan.github.io/complexgen.html
- Img2CAD: https://arxiv.org/abs/2408.01437
- CAD2Program: https://arxiv.org/html/2412.11892v1
- Fusion mesh convert / face groups, Autodesk, 3 Jun 2026: https://www.autodesk.com/products/fusion-360/blog/generate-face-groups-fusion/
- Fusion prismatic failure article, 10 Jun 2024: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Mesh-to-Brep-failure-in-Fusion.html
- Geomagic Design X: https://hexagon.com/products/geomagic-design-x
- Quicksurface 2026 Parasolid / pricing context: https://gomeasure3d.com/blog/3-affordable-scan-to-cad-tools-not-just-for-cad-specialist/
- Artec accuracy primer, 8 Oct 2024: https://www.artec3d.com/learning-center/accuracy-precision-resolution
- Nazim et al. 2025 photogrammetry vs structured light: https://pmc.ncbi.nlm.nih.gov/articles/PMC12693997/

### Orthographic reconstruction
- Zhang et al. 2023 HAL record: https://pastel.hal.science/G-SCOP_CI_CC/hal-04164264v1
- Zhang et al. 2023 dataset: https://zenodo.org/records/7785223
- Markowsky & Wesley 1980; Wesley & Markowsky 1981; Idesawa 1973; Gong et al. 2006 — cited via CAD2Program related-work
- Feist 2024 SOTA review (buildings, cites Zhang): https://www.mdpi.com/2673-4117/5/2/42

### Patent figures, OCR, datasets
- 37 CFR 1.84: https://www.law.cornell.edu/cfr/text/37/1.84
- MPEP 608.02 (BitLaw mirror): https://www.bitlaw.com/source/mpep/608-02.html
- DeepPatent (WACV 2022 PDF): https://openaccess.thecvf.com/content/WACV2022/papers/Kucer_DeepPatent_Large_Scale_Patent_Drawing_Recognition_and_Retrieval_WACV_2022_paper.pdf
- DeepPatent2: https://pmc.ncbi.nlm.nih.gov/articles/PMC10630310/ — doi:10.1038/s41597-023-02653-7
- PatentNet (design-image DB): https://arxiv.org/pdf/2106.12139
- PatentOCR 2026: https://www.nature.com/articles/s41597-026-07829-5
- PatentLMM: https://arxiv.org/html/2501.15074v1
- IMPACT (NeurIPS 2024): https://neurips.cc/virtual/2024/poster/97529
- Hoque et al. figure segmentation: https://www.cs.odu.edu/~jwu/downloads/pubs/hoque-2022-sdu/hoque-2022-sdu.pdf
- PatentsView → ODP transition, 20 Mar 2026: https://data.uspto.gov/support/transition-guide/patentsview

---

*End of x6 report. Companion lanes: x3 (outgoing figure automation / illustration market), x1 (text-to-CAD market), x5 (LLM→CAD codegen).*
