# X12 — Photo → Fusion starting point (local, AMD, 2026)

**Lane:** x12-photo-to-starting-cad
**Date:** 2026-08-17
**Status:** FINAL
**Question:** What is the best *local, offline* path from photo(s) of a real physical part to something a competent Fusion 360 user can open and keep modeling from?

**Reframe (do not relitigate):** this is **not** "can AI make perfect CAD from a photo." Answer is already **no**. The bottleneck is the blank-sketch problem. Rough is fine. The attorney will fix it. Patent figures do not need to be to scale.

**Constraints:**
- Local-only. No client invention data to a cloud model or a vendor that trains on uploads by default.
- Hardware: 2× AMD Radeon AI PRO R9700 (RDNA4, `gfx1201`, ROCm). **No NVIDIA.** CUDA-only tools are dead ends unless they have a real CPU / OpenCL / HIP fallback that still produces a usable mesh.
- Fusion is the modeling destination. The attorney is already competent in it.

**Confidentiality:** public docs, repos, vendor pages, and practitioner reports only. No client photos, unpublished figures, or pre-publication patent content.

**Method:** Autodesk primary docs, project READMEs / issue trackers for CUDA claims, official licences, and 2025–2026 practitioner reports. Items that could not be independently reproduced on this box, or that rest on marketing copy, are marked **UNVERIFIED**. Dates on citations are publication or last-checked dates.

---

## Verdict (read this first)

**Wire the 2D shortcut first. Pair it with Fusion Canvas. Do not start by building a photogrammetry or generative-mesh pipeline.**

For a competent Fusion user whose job is "get something on the plane so I can start modeling," the highest-hit-rate local path on an AMD box in 2026 is:

1. Shoot 1–3 orthographic photos of the part against a contrasting background, with a ruler or a known feature in frame.
2. Rectify / deskew the principal face (or just accept the photo if it is already square-on).
3. Threshold → silhouette → `potrace -b dxf` (or OpenCV `findContours` + `approxPolyDP` for holes and sharp corners).
4. `Insert > DXF` into a Fusion sketch, scale from the ruler, extrude. Sketch over the photo as a Canvas for the features the silhouette missed.

That path is CPU-only, fully offline, and produces the thing Fusion is actually good at: an editable sketch-extrude history. Photogrammetry and image-to-3D are the *second* lane, for organic / doubly-curved parts where a silhouette is a lie.

The 3D reconstruction ranking on this hardware, for a *usable Fusion starting mesh* (not a pretty GLB):

| Rank | Path | Why it is here |
| --- | --- | --- |
| 1 | **Canvas + DXF silhouette** | Native Fusion. Always produces something to model from. |
| 2 | **COLMAP (CPU SfM + HIP dense, or CPU-only) → PLY/OBJ → Insert Mesh** | Official HIP/ROCm backend. Offline. BSD. The only serious open photogrammetry that is not CUDA-gated. |
| 3 | **Agisoft Metashape** (not on the original shortlist; included because it is the commercial that actually lists AMD) | Official OpenCL. Offline. Paid. Better UX than COLMAP. |
| 4 | **COLMAP sparse + OpenMVS CPU densify** | OpenMVS CUDA is optional; CPU densify works. AGPL. |
| 5 | **TRELLIS-AMD as a "shape sketch"** | Runs on RDNA3 today. RDNA4 (`gfx1201`) is **UNVERIFIED**. Organic props yes; machined holes no. |
| 6 | **RealityScan 2.2** | AMD RDNA3/4 including Radeon AI PRO 9000 — but **Windows GUI only**, Linux CLI "coming later," and the EULA lets Epic train on scans unless you opt out. Confidentiality problem. |
| — | Meshroom full pipeline | **CUDA hard-require** for depth maps. Draft Meshing only without NVIDIA. |
| — | Polycam / ReCap Photo cloud | Not local. |
| — | Hunyuan3D-2.1 official | CUDA-first. Community AMD is flaky. Instinct notebook exists; R9700 **UNVERIFIED**. |

**The one I would wire first:** a local sidecar that takes a photo + a measured length and emits a DXF Fusion can `Insert`. Canvas is already in Fusion; do not rebuild it. What would change my mind is at the end.

---

## 1. Fusion's own on-ramps

Fusion already has five ways to start from something that is not a blank sketch. A competent user uses **Canvas** and **Insert DXF** every week, **Insert Mesh** when they have a scan, **McMaster** for catalog hardware, and **Convert Mesh** almost never on a generative or photogrammetry mesh.

### 1.1 Canvas (insert image on a plane + Calibrate)

Official Insert panel: **Canvas** "places an image on a planar face or sketch plane." Supported types on the help page include PNG, JPG/JPEG, TIF. After insert you can:

- tick **Display Through** so the model shows through the image while you sketch,
- right-click the canvas in the browser → **Calibrate** → pick two points → type the real distance.

That is the entire feature. It is not a tracer. It is not photogrammetry. It is a calibrated underlay. Autodesk's own support article (checked via search snippet, 2026-06-23): Insert → Canvas → pick face/plane → OK → Browser → Calibrate → two points + distance. ([Fusion Insert tools](https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-INSERT-TOOLS), checked 2026-08-17; [How to import/insert an image](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-Import-an-Image-as-an-Attached-Canvas.html), Autodesk Support, updated 2026-06-23)

**What a competent user actually does:** drop the photo of the principal face on XY, Calibrate against a ruler in the photo or a caliper measurement of a known edge, sketch lines/circles/slots over it, extrude. For a second view, insert another canvas on XZ or YZ. This is how people have modeled from photos in Fusion since the feature existed. It is also how people model from a napkin sketch.

**Limits that matter:**

- Calibrate is a **uniform** scale. It does not independently stretch X and Y. A photo that is not square-on will be a distorted underlay (long-standing forum complaint: [Canvas from image with "incorrect" X/Y ratio](https://forums.autodesk.com/t5/fusion-design-validate-document/canvas-from-image-with-quot-incorrect-quot-x-y-ratio/td-p/6015746), 2016; still the right mental model in 2026). Rectify the photo first if you care.
- Canvas is a reference, not geometry. You still draw the sketch. That is the feature, not a bug: the attorney *wants* to own the sketch.
- For patent figures, scale is optional. 37 CFR 1.84(k) is explicit: "Indications such as 'actual size' or 'scale 1/2' on the drawings are not permitted since these lose their meaning with reproduction in a different format." ([37 CFR § 1.84(k)](https://www.law.cornell.edu/cfr/text/37/1.84), LII, checked 2026-08-17). Calibrate is for the attorney's modeling comfort, not for the filed sheet.

**Hit rate as a starting point:** near 100% for "I can start sketching." Zero for "I got a solid for free."

### 1.2 Mesh workspace and Convert Mesh (prismatic / faceted / organic)

Official tool: Design workspace → Mesh tab → **Modify > Convert Mesh**. Three methods ([Fusion Help: Convert a mesh body to a solid body](https://help.autodesk.com/view/fusion360/ENU/?guid=MESH-CONVERT-TO-SOLID), checked 2026-08-17):

| Method | What it does | When Autodesk says to use it | Licence gate |
| --- | --- | --- | --- |
| **Faceted** | One B-rep face per mesh triangle | "generate one face on the solid for each individual face on the mesh" | Base Fusion |
| **Prismatic** | Merges face groups into planar / cylindrical features | "convert geometry originally created using solid or surface modeling tools" | Historically locked on Personal / hobby (forum 2023). Current paid Fusion has it. |
| **Organic** | Tri → quad → T-Spline → B-rep. Resolution by accuracy or face count. Optional "Preprocess Holes." | "convert geometry originally created from scan data or organic modeling tools" | **Design Extension** |

Autodesk's own conversion note, 2026-01-09: "Fusion works best when converting meshes with less than 10,000 facets. If the mesh body contains more than 10,000 facets, the conversion process may fail. Use the tools from the Modify menu to reduce the count of mesh facets." ([How to convert a mesh to a solid or surface body](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-Convert-a-Mesh-to-a-BRep-in-Fusion-360.html), Autodesk Support, 2026-01-09)

A separate support article on post-insert slowness restates the same ceiling: "This mesh has more than 10000 Triangles. Currently, a ceiling of 10,000 elements is the upper limit for successful conversion." ([Slow performance after inserting or converting a mesh](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Fusion-360-performance-slows-after-inserting-mesh.html), 2026-07-15)

Tips from the same Convert Mesh help page that actually matter for this use case:

- Use **Repair**, **Generate Face Groups**, **Combine Face Groups**, and **Direct Edit** *before* Convert. Prismatic is only as good as the face groups.
- Watertight mesh → solid. Non-watertight → surface body; then Stitch / Patch.
- If Organic fails as Parametric, retry as Base Feature.
- Organic is the scan path. Prismatic is the "this used to be CAD" path. Faceted is the "I just need a dumb solid and I will live with 8,000 triangular faces" path.

**What a competent user actually does:** they almost never Convert Mesh a photogrammetry or TRELLIS dump and call it a day. The working pattern, documented by practitioners (Clough42, 2025-05-25, [My 3D Scan to CAD Workflow](https://www.youtube.com/watch?v=pzMZ-sIua44)): import the mesh, align it to origin, and *model over it* — sketch on a plane, project, extrude, cut — using the mesh as a 3D canvas. Convert Mesh is for clean, low-poly, already-prismatic meshes (a McMaster-like STL, a tessellated STEP, a well-grouped scan of a machined block).

**Insert Mesh** itself is first-class: `STL` / `OBJ` / `3MF` become a mesh body. ([Insert tools](https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-INSERT-TOOLS))

### 1.3 Insert McMaster-Carr part

Official: browse McMaster, click **Product Detail CAD**, pick SAT or STEP, Save. The component lands as a new Fusion component. ([Insert tools](https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-INSERT-TOOLS), checked 2026-08-17)

Two gates that kill it for this brief:

1. **"Insert McMaster-Carr Component" is only available in online mode.** Switch Fusion online or the command disappears. ([Autodesk Support, 2026-03-31](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Insert-McMaster-Carr-Component-is-missing-from-the-Insert-menu-in-Fusion-360.html))
2. It is greyed out in a **Part** document. Convert Document Settings to **Hybrid** (or start an Assembly). ([Autodesk Support, 2026-05-15](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Insert-McMaster-Carr-Component-option-greyed-out-in-Fusion-Design-Workspace.html))

**Use it when** the physical part *is* a catalog fastener, bearing, extrusion, or fitting. That is a real fraction of patent-practice hardware. It is not a photo-to-CAD path. It is a "stop photographing the hex bolt" path. And it is **not local**: the browse/download hits McMaster.

### 1.4 Import DXF as a sketch

Official: **Insert > Insert DXF**. Pick a face or plane, pick the file, place it. Two modes:

- **Single Sketch** — all DXF geometry into one sketch.
- **One Sketch per Layer** — one sketch per DXF layer.

Both modes insert **sketch geometry only**. Solids and surfaces in the DXF are ignored. ([Insert tools](https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-INSERT-TOOLS))

If the DXF has no units, use the Insert DXF workflow (not a raw open) and pick units in the dialog. ([The selected DXF file does not contain units information](https://help.autodesk.com/view/fusion360/ENU/?caas=caas/sfdcarticles/sfdcarticles/The-selected-DXF-file-does-not-contain-units-information.html))

There is also a free **DXF Import Utility** add-in (Fusion App Store) with gap-closing and auto-extrude. The built-in Insert DXF is enough for a silhouette.

**This is the highest-leverage Fusion on-ramp for the 2D shortcut in §5.** A closed, reasonably clean DXF becomes an extrudable profile in one command. That is an editable parametric start, not a mesh.

### 1.5 What a competent user actually starts with

In descending order of real use, for "I have a physical part and I need to start modeling":

1. **Canvas + sketch** — every time there is a photo or a printout.
2. **Insert DXF** — when someone already traced a profile, or a laser/waterjet shop sent a flat pattern.
3. **Insert Mesh and model over it** — when there is a scan. Convert Mesh only if the mesh is clean and prismatic.
4. **Insert McMaster / Insert Fastener / TraceParts** — catalog hardware. Online.
5. **Convert Mesh Organic** — Design Extension, organic/scan, and even then people often remodel.

Nobody competent waits for a perfect B-rep from a photo. They get a reference (image, mesh, or DXF) onto a plane and they start cutting features.

---

## 2. Photogrammetry, local and AMD-friendly

The physics does not care about your GPU: photogrammetry needs **texture**, **overlap**, and **a non-specular surface**. Machined metal fails before CUDA vs HIP matters. The GPU question is only "does the dense step run on this box."

### 2.1 Comparison table (licence / offline / CUDA)

| Tool | Licence | Offline? | CUDA hard-require? | AMD story in 2026 | Small-part fit |
| --- | --- | --- | --- | --- | --- |
| **COLMAP** | BSD-3-Clause (library; binaries may pick up GPL deps) | Yes | **No.** SfM runs on CPU. Dense `patch_match_stereo` wants a GPU but official **HIP/ROCm** exists. `--FeatureExtraction.use_gpu 0` / `--FeatureMatching.use_gpu 0` force CPU. | Official CMake `-DHIP_ENABLED=ON`. Listed arches: `gfx90a`, `gfx942`, `gfx1030`, `gfx1100`. **`gfx1201` (R9700) not listed — UNVERIFIED.** Distro packages ship **without** CUDA/HIP. | Best open option on this box. |
| **COLMAP-CL** | Same lineage, OpenCL fork | Yes | No (OpenCL) | 2021 fork ([openphotogrammetry/colmap-cl](https://github.com/openphotogrammetry/colmap-cl)). Benchmarked on Vega 56. **Unmaintained relative to official HIP.** | Legacy AMD path. Prefer official HIP. |
| **AliceVision / Meshroom 2025.1** | MPL-2.0 | Yes (local binaries) | **Yes, for depth maps.** Official 2025.1 note: binaries built with **CUDA-12**, CC ≥ 5.0. Without NVIDIA, **only Draft Meshing**. | No official HIP/OpenCL depth map. AliceVision #439 (2018, still the policy): they will not rewrite CUDA; they will accept a contribution. | Draft mesh is a sparse-cloud hull. Fine for a blob, useless for holes. |
| **OpenMVS** | AGPL-3.0 | Yes | **No.** CUDA accelerates densify / RefineMeshCUDA. CPU densify is the default and works. Prebuilt Windows CUDA binaries have crashed on non-NVIDIA boxes (issue #786, 2022). **Build CPU-only from source.** | No HIP. CPU on this box. | Pair with COLMAP/OpenMVG SfM. |
| **OpenMVG** | MPL-2.0 (typically cited; confirm COPYING) | Yes | No GPU | CPU SfM. Common front-end to OpenMVS. | Alternative to COLMAP sparse. |
| **RealityScan 2.2** (ex-RealityCapture) | Epic EULA. Free if trailing-12-month revenue < $1M; else ~$1,250/seat/year | Desktop processes locally. **EULA grants Epic rights to use scan data to train unless you opt out.** | Was CUDA-only through 2.0 (June 2025). **2.2 (2026-06-24) adds AMD RDNA3 + RDNA4**, including Radeon AI PRO 9000, via HIP. | **Windows GUI only.** Linux CLI "coming later." Mixed AMD+NVIDIA parallel. | Best commercial quality *if* you accept Windows + Epic EULA. **Confidentiality problem for patent work.** |
| **Polycam** | Proprietary SaaS | On-device preview; **quality meshing is cloud** | N/A (their cloud) | Irrelevant | Disqualified. Photos leave the machine. |
| **Autodesk ReCap Photo** | ReCap Pro subscription. Photo integrated into ReCap Pro 2026 (no separate install) | Historically mixed; object-mode photogrammetry has been cloud or NVIDIA-local depending on vintage | System reqs list **NVIDIA** Quadro M6000 / GTX 970+ for ReCap Photo | Not an AMD product | Do not buy this for an R9700 box. |
| **Agisoft Metashape** (add) | Perpetual, node-locked or floating. Standard ~$179 historic; Pro is the one with more formats. Not time-limited. | Yes | **No.** Official: "OpenCL or CUDA compatible" NVIDIA **or AMD**. | Official AMD listing (RX 5600M / 6800 XT examples). Puget still prefers NVIDIA for speed/stability (2026-03-26). | The commercial that actually matches the hardware. |

Sources for the table: [COLMAP install](https://colmap.github.io/install.html) (HIP section, checked 2026-08-17); [COLMAP CLI](https://colmap.github.io/cli.html); [Meshroom 2025.1 download note](https://alicevision.org/view/meshroom.html); [Meshroom CUDA FAQ](https://meshroom-manual.readthedocs.io/en/latest/faq/needs-cuda/needs-cuda.html); [OpenMVS README / AGPL](https://github.com/cdcseacave/openMVS); [RealityScan 2.2, CG Channel 2026-06-25](https://www.cgchannel.com/2026/06/epic-games-releases-realityscan-2-2-with-amd-gpu-support/); [RealityScan licensing](https://www.realityscan.com/license); [ReCap Photo system requirements](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/System-requirements-for-Autodesk-ReCap-Pro-and-ReCap-Photo.html) (2024-11-01, still the cited GPU list); [Agisoft system requirements](https://www.agisoft.com/downloads/system-requirements/) (checked 2026-08-17).

### 2.2 COLMAP

This is the open tool that belongs on the R9700 box.

- **Licence:** new BSD / BSD-3-Clause for the COLMAP library. Distro/binary builds can inherit GPL from some deps; build from source if that matters. ([COLMAP GitHub](https://github.com/colmap/colmap), checked 2026-08-17)
- **Offline:** yes. No account. No upload.
- **CUDA:** not required. Feature extraction and matching default to GPU if CUDA is present; without it, set `--FeatureExtraction.use_gpu 0` and `--FeatureMatching.use_gpu 0`. Sparse mapping (`mapper`) is CPU. ([CLI docs](https://colmap.github.io/cli.html))
- **HIP / ROCm (the 2026 fact that changes the AMD story):** official install docs now document a first-class HIP backend, mutually exclusive with CUDA:

```
cmake .. -GNinja \
    -DCUDA_ENABLED=OFF \
    -DHIP_ENABLED=ON \
    -DCMAKE_HIP_ARCHITECTURES=gfx90a \
    -DCMAKE_HIP_COMPILER=/opt/rocm/llvm/bin/clang++
```

Documented `CMAKE_HIP_ARCHITECTURES` examples: `gfx90a` (MI200), `gfx942` (MI300), `gfx1030` (RDNA2), `gfx1100` (RDNA3). "The HIP backend currently accelerates dense reconstruction (`patch_match_stereo`)." Distro packages "do not come with CUDA or HIP/ROCm support, which requires a manual build from source." ([COLMAP install](https://colmap.github.io/install.html), checked 2026-08-17)

**R9700 / `gfx1201`:** the card is RDNA4, ISA `gfx1201`, and is a first-class ROCm target for PyTorch / vLLM in 2026. COLMAP's HIP docs do **not** list `gfx1201`. Configure with `-DCMAKE_HIP_ARCHITECTURES=gfx1201` and treat dense-step success as **UNVERIFIED** until this box actually builds it. CPU dense (or skip dense and mesh the sparse/fused cloud more coarsely) is the fallback that will definitely run.

Pipeline the attorney actually wants: `automatic_reconstructor` or the long form (`feature_extractor` → `exhaustive_matcher` → `mapper` → `image_undistorter` → `patch_match_stereo` → `stereo_fusion` → `poisson_mesher` / `delaunay_mesher`) → `mesh_simplifier --MeshSimplification.target_face_ratio 0.25` **down to well under 10k faces** → export PLY/OBJ → Fusion Insert Mesh.

### 2.3 AliceVision / Meshroom (depth-map CUDA claim, verified)

**Verified, including the 2025.1 binaries.**

Official Meshroom download page, current 2025.1.0 (Zenodo Windows zip / Linux tar.gz):

> "To fully utilize Meshroom, a NVIDIA CUDA-enabled GPU is recommended. The binaries are built with CUDA-12 and are compatible with compute capability >= 5.0. **Without a supported NVIDIA GPU, only 'Draft Meshing' can be used for 3D reconstruction.**"

([alicevision.org/view/meshroom.html](https://alicevision.org/view/meshroom.html), checked 2026-08-17)

The FAQ is unambiguous: "The depth map computation is implemented with CUDA and requires an NVIDIA GPU." Without NVIDIA: "Yes, but you must use Draft Meshing to complete the reconstruction." The 2018 AliceVision position on a rewrite, still cited by the FAQ: "Currently, we have neither the interest nor the resources to do another implementation of the CUDA code to another GPU framework. If someone is willing to make this contribution, we will support and help for integration." ([Meshroom CUDA FAQ](https://meshroom-manual.readthedocs.io/en/latest/faq/needs-cuda/needs-cuda.html); [alicevision/AliceVision#439](https://github.com/alicevision/AliceVision/issues/439))

**Draft Meshing** skips DepthMap and meshes the SfM sparse cloud. AliceVision's own beginner tutorial: "this technique will only work on highly textured datasets that can produce enough points in the sparse point cloud." ([Sketchfab Meshroom tutorial](https://sketchfab.com/blogs/community/tutorial-meshroom-for-beginners/)) A machined aluminum bracket is the opposite of that dataset.

There was a 2021 **Meshroom CL** OpenCL experiment (Peter Falkingham, 2021-09-26). It is not the 2025.1 product. Do not plan around it.

**Licence:** MPL-2.0. Offline: yes. AMD full pipeline: **no**.

### 2.4 OpenMVS

OpenMVS is the dense / mesh / texture half of a photogrammetry chain. Input is cameras + sparse cloud (from COLMAP or OpenMVG). Output is a textured mesh.

- **Licence:** AGPL-3.0. If you ship a sidecar that links OpenMVS, the AGPL attaches. COLMAP's own mesher avoids that.
- **Offline:** yes.
- **CUDA:** optional accelerator for densify (since ~v2.0, Dec 2021) and `RefineMeshCUDA`. CPU densify works and is what you should build. There is **no automatic CUDA→CPU fallback** in the CUDA build (Google group report). Prebuilt Windows CUDA exes have crashed without NVIDIA ([openMVS#786](https://github.com/cdcseacave/openMVS/issues/786), 2022).
- **AMD:** no HIP. CPU only on this box. Fine for a 40–80 photo turntable of a small part; expect tens of minutes to a few hours, not seconds.

Use OpenMVS if COLMAP's Poisson/Delaunay mesh is too holey and you want a dedicated densify. Otherwise stay inside COLMAP to keep the licence simple.

### 2.5 RealityCapture / RealityScan

RealityCapture was rebranded **RealityScan 2.0** in June 2025. Through 2.0 it remained CUDA-only: align without NVIDIA, but you could not mesh or texture (Peter Falkingham, 2025-06-19).

**RealityScan 2.2 (released 2026-06-24)** is the first version with full AMD GPU support. CG Channel (2026-06-25, updated 2026-07-08 with AMD confirmation that the port is HIP):

- Every NVIDIA-accelerated reconstruction stage is "now equally accelerated" on AMD.
- Supported: RDNA3 and RDNA4 consumer and workstation, **including Radeon AI PRO 9000** (that is this card's family) and RX 9000.
- Mixed AMD+NVIDIA in one machine, work split in parallel.
- **AMD GPUs are currently only supported on Windows.** Linux CLI support "coming later."
- Free under $1M trailing revenue; else ~$1,250/seat/year.

([CG Channel](https://www.cgchannel.com/2026/06/epic-games-releases-realityscan-2-2-with-amd-gpu-support/); [RealityScan 2.2 announcement](https://www.realityscan.com/news/realityscan-2-2-is-here-with-full-amd-gpu-support-download-today); X posts 2026-07-02–07-13 repeating the same facts.)

**Why I still would not wire this first for Oppold work:**

1. This workstation is Linux. AMD acceleration is Windows-only today.
2. The EULA, by default, lets Epic store/reuse photos to train products; you must **opt out** in-app. That is the opposite of "local-only is a hard architectural rule." A past cloud waiver does not cover this. ([CG Channel on the 2.0 EULA](https://www.cgchannel.com/2025/06/epic-games-to-rebrand-realitycapture-as-realityscan-2-0/); [RealityScan EULA](https://www.realityscan.com/eula))
3. Even as a mesh factory it emits a graphics mesh, not Fusion features.

Treat RealityScan 2.2 as "the thing you would use on a Windows box after legal reads the EULA and you flip the training opt-out." Not as the Linux sidecar.

### 2.6 Polycam

Cross-platform capture app (iOS / Android / web). On-device LiDAR/photo preview; **higher-quality photogrammetry is an upload**. Pricing in 2026 is Free / Basic (~$30/mo) / Business. ([poly.cam](https://poly.cam/); [SkyeBrowse 2026 roundup](https://www.skyebrowse.com/news/posts/best-photogrammetry-app), 2026-03-23)

**Disqualified** under the local-only rule. A phone LiDAR preview of a small metal part is also the wrong capture modality (LiDAR is for rooms, not 30 mm brackets).

### 2.7 Autodesk ReCap

ReCap Pro 2026 absorbed ReCap Photo (no separate installer, Autodesk Support 2025-04-08). Object photogrammetry system requirements still specify **NVIDIA** cards (Quadro M6000 or GTX 970+; DirectX 11). ([ReCap Photo system requirements](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/System-requirements-for-Autodesk-ReCap-Pro-and-ReCap-Photo.html), 2024-11-01)

There is no evidence in 2026 that ReCap Photo grew a HIP backend. Offline object-mode photogrammetry from Autodesk is not a reason to be on this box. Fusion already consumes the mesh if you produce it elsewhere.

### 2.8 Capture advice for a small mechanical part

This matters more than the solver. Sources: Peter Falkingham's small-object guide (2019-01-16, still the standard advice), cultural-heritage turntable practice, and the entire "spray the chrome" literature.

**Do this:**

1. **Kill specularity.** Machined metal, polished plastic, and anything chromed will match highlights instead of surface. Coat with vanishing 3D-scan spray, removable chalk spray, or (cheap) talc / developer dye penetrant. Instructables and every scan vendor say the same thing because it is true.
2. **Add texture if the part is feature-poor.** A flat bead-blasted face with no edges in frame will not SfM. A random speckle (washable marker dots, a projected pattern, a loosely draped stretch-wrap with printing) gives the matcher something to lock. Do **not** use a repeating grid.
3. **Turntable, camera fixed, or camera orbits, object fixed — pick one and do not mix in one chunk.** Turntable is easier for a 5–20 cm part. Three rings of height (low / equator / high), 10–15° steps, 60–120 frames. 70%+ overlap.
4. **Lock exposure and focus.** Auto-exposure makes every frame a different world. Manual, or at least exposure-lock. Small aperture for depth of field; add light rather than opening up.
5. **Plain, contrasting background.** Black velvet or a featureless sweep. Mask if the background is busy. Meshroom draft meshing in particular needs the *object* to be the textured thing.
6. **Scale bar in the scene, not a post-hoc guess.** A printed coded scale bar, or a steel rule lying in the first ring of photos. COLMAP / Metashape can set scale from two points. Fusion Canvas Calibrate can do the same if you only keep the photos.
7. **Cross-polarized flash** if you cannot spray a client-owned finish. Overkill for most patent parts; mentioned because it is the other real fix for shine.
8. **Do not expect internals.** Photogrammetry sees the hull. Bores, internal ribs, the back of a snap, the inside of a housing — photograph those as *separate 2D canvases* and model them. No 2026 local pipeline invents a correct cavity from exterior photos.

**Classic failure, said plainly:** uncoated shiny metal on a turntable against a cluttered bench. Sparse match fails or the mesh is a Swiss-cheese hallucination of reflections. This is not an AMD problem.

---

## 3. Single-image generative mesh as a "shape sketch"

These models emit a **looks-right triangle mesh** (GLB/OBJ), sometimes with PBR textures. They do not emit sketches, features, or dimensions. Sibling lane x6 already answered "is this CAD" with no. Here the only question is: can it run on this box, and is the mesh a useful *underlay* while a human models.

### 3.1 What actually runs on RDNA4 / ROCm today

| System | Official GPU | AMD / ROCm as of 2026-08-17 | Honest mechanical quality |
| --- | --- | --- | --- |
| **TRELLIS** (Microsoft, MIT, 1.2B image model) | NVIDIA ≥16 GB, CUDA 11.8/12.2. Linux. | **[CalebisGross/TRELLIS-AMD](https://github.com/CalebisGross/TRELLIS-AMD)** — status **May 2026: fully operational on RX 7800 XT (RDNA3, gfx1101), ROCm 7.2.1, torch 2.10.0+rocm7.0, 16 GB, staged.** Image→asset ~45 s; GLB bake 5–10 min. Known: ~7% silent triangle culls; hole-fill uses 100 views not 1000. **R9700 / gfx1201: UNVERIFIED.** | Organic / consumer props: usable shape sketch. Mechanical flats and through-holes: rounded, filled, or invented. |
| **TRELLIS.2** (4B, Dec 2025, research / "not intended for commercial exploitation") | NVIDIA ≥24 GB official | Community ports: `Lamothe/TRELLIS.2_rocm`, `Mateusz-Dera/TRELLIS.2-ROCm` (issue #74: "texturing currently broken"), `toastmanAu/trellis-2-rocm-comfyui` (tested **RDNA3 7900 XTX**, Apr 2026). Reddit claim of TRELLIS.2 on ROCm 7.11 **GFX1201** exists — **UNVERIFIED** quality. | Same representation gap, higher-res mesh. Still not CAD. |
| **Hunyuan3D-2.1** | Official: CUDA 12.4. 10 GB shape / 21 GB texture / 29 GB full. Tencent Community License (not Apache). | Official install is NVIDIA. Community WinPortable / 2GP. AMD Instinct ComfyUI notebook from AMD themselves runs Hunyuan3D v2.1 → GLB ([ROCm AI hub](https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/notebooks/inference/t2v_comfyui_api_mode_instinct.html)). Consumer RDNA4: r/ROCm threads of 9070 XT / 2.1 "working but glitchy." **R9700 UNVERIFIED.** | Best open textured mesh of the 2.x line. Holes and thin walls still hallucinated. 3.0/3.1 Pro is API-only — disqualified. |
| **Stable Fast 3D** | ~6 GB, feed-forward, ~0.5 s claimed | **HIP kernels for `texture_baker` merged 2025-01-18.** CPU backend if no GPU (`SF3D_USE_CPU=1`). Stability Community License (non-commercial / <$1M). | 2024-class quality. Cheap local preview. Do not treat as 2026 SOTA. |

Official TRELLIS hardware sentence: "An NVIDIA GPU with at least 16GB of memory is necessary." ([microsoft/TRELLIS](https://github.com/microsoft/TRELLIS), checked 2026-08-17). That is the upstream; the AMD fork is a community port with real, documented rasterizer work, not a one-line `device="cuda"` swap.

This box has **32 GB per card / 64 GB total**, so VRAM is not the limiter. The limiter is whether the HIP rasterizer / sparse conv extensions compile for `gfx1201`. TRELLIS-AMD was debugged on `gfx1101`. Budget a porting weekend, not an afternoon, before calling TRELLIS-AMD "runs here."

### 3.2 Honest quality: mechanical part vs organic prop

| Input | What you get | Fusion use |
| --- | --- | --- |
| Photo of a helmet / toy / organics | Plausible hull, decent texture, invented back | Look-at mesh. Organic Convert Mesh maybe. |
| Photo of a bracket with holes, bosses, a pocket | Rounded edges, filled or melted holes, soft "Claymation CAD," wrong back | **Bad Convert Mesh input.** Acceptable as a second Canvas-in-3D while you sketch real features. |
| Multi-view photos (TRELLIS multi-image is tuning-free) | Slightly more consistent hull | Still a mesh, still no holes you can trust. |
| USPTO line drawing | Out of distribution. Hatching and numerals become geometry. | Do not. |

The attorney's own standard — "rough is fine, I will fix it" — is met only if "fix it" means *remodel*, not *tweak a feature tree that does not exist*. A TRELLIS GLB is closer to a 3D napkin than to a starting `.f3d`.

---

## 4. Mesh → editable solid

### 4.1 Fusion Convert Mesh limits (restated as engineering constraints)

- **< 10,000 triangles** is Autodesk's own success ceiling, not a forum myth (Support 2026-01-09 and 2026-07-15).
- A COLMAP Poisson mesh of a small part is typically 100k–2M faces. You **must** decimate (`colmap mesh_simplifier`, Instant Meshes, MeshLab quadric) before Convert. Decimation of a noisy scan destroys the sharp edges Prismatic needed.
- **Prismatic** needs clean face groups that correspond to real planes and cylinders. Photogrammetry noise and generative wobble do not group. Autodesk's 2026 face-group blog is explicit: face groups are "specifically valuable for Prismatic workflows" and do nothing for Faceted / Organic. ([Unlocking the Power of Face Groups](https://www.autodesk.com/products/fusion-360/blog/generate-face-groups-fusion/), 2026-06-03)
- **Organic** is a Design Extension, remeshes to quads, and produces a T-Spline-ish solid that is the wrong topology for a patent figure of a machined part (you wanted planes, you got a potato with 800 faces).
- **Faceted** on a 9,999-triangle mesh gives you a 9,999-face B-rep that Fusion will hate and you cannot edit as features.

### 4.2 Open and commercial scan-to-CAD

| Tool | What it is | Local / AMD | Fit for this practice |
| --- | --- | --- | --- |
| **Fusion Convert Mesh + model-over-mesh** | Already owned | Yes | Default. |
| **QUICKSURFACE** | Dedicated scan-to-CAD. STL/OBJ/PLY in, hybrid parametric + freeform, STEP / Fusion-friendly out. | Desktop, not GPU-bound in the CUDA sense | The mid-market tool people actually buy when Fusion's reverse-engineering feels basic. Compare: [quicksurface.com](https://www.quicksurface.com/). |
| **Geomagic Design X** | Industry RE. History-based CAD from scans, LiveTransfer to SW/etc., STEP/IGES. Subscription from ~$1,900/yr (GoMeasure3D, 2026-01-05). | Desktop | Overkill and the wrong CAD destination (SW-centric). |
| **Plasticity** | Direct modeler, pleasant with scan refs | Desktop | Fine as a mesh-over modeler; still not automatic. |
| **Instant Meshes / MeshLab / FreeCAD** | Decimate, remesh, sometimes surface | CPU | Pre-Fusion cleanup, not a replacement. |

None of these turn a TRELLIS hallucination into a correct feature tree. They turn a *metrology-grade or at least dense, sprayed, well-captured* mesh into surfaces a human can snap to.

### 4.3 Generative mesh vs real scan as Convert Mesh input

**A generative mesh is almost never a good Convert Mesh input.** Convert Mesh (especially Prismatic) assumes the triangles approximate real analytic faces. A TRELLIS/Hunyuan/SF3D mesh approximates a *rendered look*. Flats are not planar. Holes are not cylindrical. Wall thickness is a guess. Face-group generation on that input produces rainbow noise, then Prismatic fails or emits garbage.

A **real scan** (structured light, or photogrammetry of a sprayed, textured part, decimated with edge preservation) can be a good *reference*. It is a good Convert Mesh input only when the part is already prismatic *and* the scan is clean *and* you spent time on face groups *and* you are under 10k faces. That is a narrow band: a sprayed machined block, not a die-cast housing, not a generative pred.

**Position:** treat every 3D reconstruction — photo or generated — as a **3D canvas**. Model real features. Use Convert Mesh only as a last-ditch "I need a dumb solid to boolean against" move, Faceted, after aggressive decimate.

---

## 5. The 2D shortcut (photo → rectify → silhouette → DXF → sketch → extrude)

This is the path the 3D industry does not sell because there is no subscription in it. For prismatic patent parts it is faster and more accurate than any reconstruction in this report.

### 5.1 Local tracing tools

| Tool | Licence | What it is good at | Fusion output |
| --- | --- | --- | --- |
| **Potrace** 1.16 | GPL-2.0 | Binary silhouette → smooth Béziers. Native **`-b dxf`**. `mkbitmap` preprocesses greyscale. `apt install potrace`. | DXF → Insert DXF. Best default. ([potrace.sourceforge.net](https://potrace.sourceforge.net/), checked 2026-08-17) |
| **OpenCV** `findContours` + `approxPolyDP` | Apache-2 | **Holes**, multiple islands, *sharp* corners (epsilon as a fraction of perimeter). You control polygonization. Write DXF with `ezdxf` or dump SVG. | Best for plates with holes, slots, and rectangular bosses. ([OpenCV 4.13 shape docs](https://docs.opencv.org/4.13.0/d3/dc0/group__imgproc__shape.html)) |
| **Autotrace** | GPL | More input formats than Potrace; worse curves. Inkscape still ships it for centerline. | Fallback. |
| **Inkscape Trace Bitmap** | GPL | Excellent interactive (Potrace + Autotrace backends, including centerline). **CLI automation of Trace Bitmap is still not a first-class, reliable action** — community consensus is "call Potrace/Autotrace directly." (`inkscape --actions-list` exists; trace is the missing piece.) | Use the GUI once; do not build the sidecar on Inkscape. |

Recommended sidecar, all local, all CPU:

1. Optional: `convert` / OpenCV warp perspective from four clicked corners of the part or of a printed rectification target.
2. Segment: grabcut, rembg (local), or a hard threshold on a backlit / black-velvet shot.
3. Morphology open/close to drop specks.
4. **If the part is a plate with holes:** OpenCV contours, hierarchy for holes, `approxPolyDP(epsilon=0.005–0.02 * arcLength)`, emit DXF `LWPOLYLINE`s.
5. **If the part is a smooth outline:** `mkbitmap` → `potrace -b dxf -a 1.0` (keep corners; lower alphamax = more corners).
6. Insert DXF in Fusion, pick mm, Calibrate/scale from the ruler, extrude, then sketch the features the silhouette cannot know (fillets, chamfers, the third dimension).

### 5.2 Recovering scale from a ruler or known feature

Three honest methods, in order of preference:

1. **A steel rule in the same plane as the face being traced.** After Insert DXF (or on the Canvas), dimension two ticks that are 50 mm apart and Scale the sketch / Calibrate the canvas to 50 mm. This is the Fusion-native move.
2. **A known feature on the part** (hex AF, shaft diameter, a stamped size). Same operation. Better than a ruler if the ruler is not coplanar (perspective).
3. **Photogrammetry scale bar**, only if you went 3D. Two marked points in COLMAP / Metashape, then the exported mesh is already in mm. Fusion then imports at 1:1.

Do not trust EXIF focal length + assumed subject distance. Do not print "SCALE 1:1" on a patent figure (1.84(k)).

For figures, you can skip scale entirely and just get the *proportions* right enough that the attorney's sketch looks like the part. That is a lower bar and is why Canvas-without-Calibrate still works.

### 5.3 When this beats 3D

**Take this 2D path when any of these is true:**

- The part is mostly an extrusion, a revolution, or a sheet-metal unfold (brackets, plates, housings, covers, gaskets, heat sinks that are a 2.5D profile).
- You can photograph a face square-on, or you can live with a 5-minute 4-point rectify.
- The important information is the **outline and the hole pattern**, not a freeform surface.
- You need something in Fusion *today*, in under 15 minutes, offline, on this box.
- The part is shiny, transparent, tiny, or textureless — i.e., photogrammetry will fail and you already know it.

**Take a 3D path when:**

- The shape is doubly curved (a handle, a fairing, a cast organic housing) and the silhouette of any one view is a lie.
- You need a section through a shape you cannot easily dimension from two photos.
- You have already sprayed the part and you want a 3D canvas to model over.

**Do not take a generative-mesh path when the 2D path is available.** You will spend an hour producing a GLB whose holes you cannot extrude-cut, then you will sketch the profile anyway.

---

## 6. Honest failure list

Where each path breaks on real patent-practice subject matter.

| Subject | Canvas | 2D DXF | Photogrammetry (COLMAP/Metashape) | Generative mesh | Convert Mesh |
| --- | --- | --- | --- | --- | --- |
| **Shiny / machined metal** | Works (it's a photo) | Works if you can still see the outline | **Fails** without spray / texture. Reflections become fake geometry. | Looks chrome; geometry is a smooth blob | Garbage in |
| **Transparent / translucent** | Works as a picture | Outline only; internals invisible | **Fails** (see-through matches background) | Invents a solid interior | n/a |
| **Internal features you cannot photograph** | You photograph a *cut* or a *second part* | Same | **Cannot.** No algorithm sees a blind bore from the outside. | **Hallucinates.** Dangerous if you believe it. | n/a |
| **Thin sheet metal** | Good | **Best path** (flat pattern photo) | Mesh is a 0.5 mm wafer of noise; self-intersects | Paper-thin soup | Organic maybe; Prismatic no |
| **Assemblies** | One photo per view, you explode by hand | One silhouette per part | Fused blob, or you disassemble and shoot each part | Fused blob | No |
| **Tiny parts (&lt; ~10 mm)** | Macro photo + Canvas | Works if you can light it | DOF / pixel-size / turntable vibration. Doable with a real macro rig. | Trains on toys; will invent fillets | Decimate kills the part |
| **Textureless surfaces** (fresh mill, injection-molded ABS, painted white) | Works | Works | **SfM starves.** Speckle or spray required. | Doesn't care (it invents texture) | n/a |
| **Threads, knurls, fine teeth** | You draw the spec, not the photo | You draw a major diameter | Mesh is a wavy cylinder | Decorative bump map, not a helix | No |
| **Patent line art as input** | You can overlay a figure as Canvas | Trace numerals as geometry if you are careless | Not a photo | **Out of distribution** | No |

Additional process failures:

- **Meshroom without NVIDIA:** Draft Meshing only. Feature-poor metal → empty cloud → empty mesh.
- **RealityScan on this Linux box:** AMD path is Windows. EULA training clause.
- **Polycam / Hunyuan 3.x API / ReCap cloud:** invention photos leave the building.
- **Fusion Personal / expired extension:** Organic missing; Prismatic historically missing. Paid Fusion assumed.
- **Fusion offline:** Canvas / DXF / Mesh still work. McMaster does not.

---

## Ranked recommendation (photos → Fusion starting point, local only, AMD box)

Hit rates are **practitioner estimates**, not a measured corpus on Oppold parts. They mean "fraction of typical mechanical patent parts where this produces something the attorney will actually continue from, rather than delete and start over." Label **UNVERIFIED** as a laboratory number.

| Rank | Path | Capture effort | Wall-clock (after photos) | What Fusion receives | Honest hit rate |
| --- | --- | --- | --- | --- | --- |
| **1** | **Rectify → silhouette → Potrace/OpenCV DXF → Insert DXF → extrude**, plus Canvas for the leftover | 1–3 square-on photos, ruler in frame. 2–10 min. | 1–5 min automated + 10–30 min human sketch cleanup | **Editable sketch + extrusion.** The native Fusion start. | **~0.75–0.90** on prismatic / 2.5D parts. **~0.20** on organic. Highest *useful* rate. |
| **2** | **Canvas only** (Insert image, Calibrate, sketch over) | 1–3 photos. 2 min. | 0 min compute. Human models. | Calibrated underlay. No geometry until the human draws. | **~0.95** as a start. **0.00** as a free solid. This is the floor that always works. |
| **3** | **COLMAP CPU SfM + HIP or CPU dense → decimate &lt;10k → Insert Mesh**, then **model over** (do not Convert) | 60–120 sprayed, textured photos. 20–40 min capture. | Build once. Then 10–90 min/part depending on HIP-vs-CPU. | Mesh body as 3D canvas. Optional Faceted brick. | **~0.50–0.70** on sprayed, textured parts as a *reference*. **~0.10–0.25** on raw metal. Convert Mesh Prismatic on that mesh: **~0.05–0.15**. |
| **4** | **Metashape Pro**, same capture as (3) | Same | Faster UX, official OpenCL on AMD. Still minutes–an hour. | Same class of mesh | Similar to (3), maybe +0.05–0.10 on hard sets. **UNVERIFIED** vs COLMAP on R9700. Costs money. |
| **5** | **COLMAP + OpenMVS CPU densify** | Same | Longer than COLMAP mesher | Often a nicer mesh than Poisson | Use when (3) is holey. AGPL. |
| **6** | **TRELLIS-AMD (or SF3D) → Insert Mesh** as a look-at | 1 photo, 30 s | 1–10 min if it runs | GLB/OBJ. Bad Prismatic input. | **~0.40–0.60** as a shape reminder on consumer-looking parts. **~0.10–0.25** on machined parts with holes. **RDNA4 run: UNVERIFIED.** |
| **7** | **Insert McMaster / Fastener** | 0 photos | Online round-trip | Real B-rep of a *catalog* part | **~1.0** when it is a catalog part. **0** otherwise. Not local. |
| **8** | **RealityScan 2.2** | Same as (3) | Fast on Windows+AMD | High-quality mesh | Quality would rank ~3. **Blocked** here by Linux + EULA. |
| **—** | **Meshroom 2025.1 full** | — | — | — | **0** on this box (no CUDA). Draft only: **~0.15–0.30** on highly textured non-metal. |
| **—** | **Polycam / ReCap Photo / Hunyuan 3.x API** | — | — | Cloud mesh | Disqualified. |

### The one I would wire first

**A local photo → DXF sidecar**, and a one-page Fusion playbook that says: *Insert DXF, Insert Canvas of the same photo, Calibrate both from the ruler, extrude, keep modeling.*

Why this one:

- It runs on the CPU next to Fusion. No HIP compile, no 10k-face fight, no CUDA, no EULA.
- It produces the representation Fusion users already think in (sketches).
- It fails *visibly* (a bad outline) rather than *confidently* (a hallucinated back side).
- It matches the corpus: this practice is DWG/SVG-heavy and figure-first. A profile is closer to a figure than a GLB is.
- Patent figures do not need scale (1.84(k)); the same pipeline can emit an unscaled profile for the illustrator lane.

COLMAP-HIP is the **second** thing to stand up, for the minority of parts that are actually organic, and as a 3D canvas — not as an automatic solid.

### What would change my mind

Change the **first wire** (away from 2D DXF) if any of these become true:

1. **A cheap structured-light scanner** (Einstar / Revopoint / Ferret-class) is on the bench and produces sprayed-part meshes that Fusion Prismatic Convert Mesh survives on the actual docket mix. That is a *scan* path, not a photo path. Photogrammetry does not get there.
2. **COLMAP HIP on `gfx1201` is proven on this box** *and* a 20-part bake-off shows model-over-mesh is faster than DXF+Canvas for the attorney's real parts. I would then wire COLMAP as a peer, not a replacement.
3. The docket mix flips to **majority freeform / medical / consumer-organic** parts where a silhouette is structurally wrong.
4. A local model starts emitting **actual sketch-extrude trees** (CadQuery / Fusion API) that survive human edit — not meshes. That is a different lane (x5 / x6). TRELLIS will not grow this.

I would **add** TRELLIS-AMD as a third, optional "napkin 3D" button if (and only if) it compiles on `gfx1201` and is framed in the UI as *not CAD*. I would **not** add Meshroom, Polycam, ReCap Photo, or RealityScan until the EULA and OS problems are gone.

---

## Open questions / UNVERIFIED

- COLMAP HIP `patch_match_stereo` on **Radeon AI PRO R9700 / `gfx1201`**. Docs list through `gfx1100`. Needs a real build on this machine.
- TRELLIS-AMD on `gfx1201` (fork tested `gfx1101`). TRELLIS.2 ROCm texture quality on RDNA4.
- Hunyuan3D-2.1 full shape+PBR on R9700 32 GB. AMD's published notebook is Instinct-class.
- Whether current paid Fusion still gates Prismatic the way Personal did in 2023. Organic is still Design Extension.
- Metashape OpenCL stability on RDNA4 (Puget still warns on AMD, last note 2026-03).
- RealityScan 2.2 Linux CLI date; whether the training opt-out is actually sufficient for privileged matter (legal question, not a benchmark).
- Hit rates above are not measured on the 837-DWG / 201-STEP corpus. A 20-part bake-off (10 prismatic, 5 organic, 5 shiny-metal) would turn those numbers from estimates into evidence.

---

## Sources

- Autodesk Fusion Help, Insert tools (Canvas, Calibrate, DXF, McMaster, Mesh): https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-INSERT-TOOLS — checked 2026-08-17
- Autodesk Fusion Help, Convert Mesh: https://help.autodesk.com/view/fusion360/ENU/?guid=MESH-CONVERT-TO-SOLID — checked 2026-08-17
- Autodesk Support, Convert mesh to solid, 10k facet note: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-Convert-a-Mesh-to-a-BRep-in-Fusion-360.html — 2026-01-09
- Autodesk Support, mesh >10000 triangles conversion ceiling: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Fusion-360-performance-slows-after-inserting-mesh.html — 2026-07-15
- Autodesk Support, insert image as canvas: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-Import-an-Image-as-an-Attached-Canvas.html — 2026-06-23
- Autodesk Support, McMaster online-only: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Insert-McMaster-Carr-Component-is-missing-from-the-Insert-menu-in-Fusion-360.html — 2026-03-31
- Autodesk Support, McMaster greyed out in Part documents: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Insert-McMaster-Carr-Component-option-greyed-out-in-Fusion-Design-Workspace.html — 2026-05-15
- Autodesk, Generate Face Groups / Prismatic: https://www.autodesk.com/products/fusion-360/blog/generate-face-groups-fusion/ — 2026-06-03
- 37 CFR § 1.84(k) Scale: https://www.law.cornell.edu/cfr/text/37/1.84 — checked 2026-08-17
- COLMAP installation (HIP/ROCm): https://colmap.github.io/install.html — checked 2026-08-17
- COLMAP CLI (CPU GPU flags, mesher, simplifier): https://colmap.github.io/cli.html — checked 2026-08-17
- COLMAP licence (BSD-3): https://github.com/colmap/colmap — checked 2026-08-17
- COLMAP-CL (legacy OpenCL): https://github.com/openphotogrammetry/colmap-cl ; Falkingham write-up 2021-02-15 https://peterfalkingham.com/2021/02/15/photogrammetry-testing-colmap-cl-a-game-changer-for-those-without-an-nvidia-card/
- Meshroom 2025.1 CUDA-12 / Draft Meshing only: https://alicevision.org/view/meshroom.html — checked 2026-08-17
- Meshroom CUDA FAQ: https://meshroom-manual.readthedocs.io/en/latest/faq/needs-cuda/needs-cuda.html — checked 2026-08-17
- AliceVision "we will not rewrite CUDA": https://github.com/alicevision/AliceVision/issues/439
- OpenMVS: https://github.com/cdcseacave/openMVS (AGPL-3.0)
- OpenMVS CUDA optional / CPU default: Falkingham 2022-02-05 https://peterfalkingham.com/2022/02/05/photogrammetry-testing-colmap-3-7-and-openmvs-v2-0-now-with-cuda/ ; issue #786
- RealityScan 2.2 AMD: https://www.cgchannel.com/2026/06/epic-games-releases-realityscan-2-2-with-amd-gpu-support/ — 2026-06-25 / updated 2026-07-08
- RealityScan licensing: https://www.realityscan.com/license
- RealityScan EULA / training rights: https://www.realityscan.com/eula ; CG Channel 2025-06-04
- ReCap Photo NVIDIA reqs: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/System-requirements-for-Autodesk-ReCap-Pro-and-ReCap-Photo.html — 2024-11-01
- ReCap Photo merged into ReCap Pro 2026: Autodesk Support 2025-04-08
- Agisoft Metashape GPU (OpenCL or CUDA, NVIDIA or AMD): https://www.agisoft.com/downloads/system-requirements/ — checked 2026-08-17
- Puget Systems Metashape AMD caution: https://www.pugetsystems.com/solutions/photogrammetry-workstations/agisoft-metashape/hardware-recommendations/ — 2026-03-26
- Microsoft TRELLIS (NVIDIA 16 GB): https://github.com/microsoft/TRELLIS — checked 2026-08-17
- TRELLIS-AMD (RX 7800 XT, May 2026): https://github.com/CalebisGross/TRELLIS-AMD — checked 2026-08-17
- TRELLIS.2 ROCm community: https://github.com/microsoft/TRELLIS.2/issues/74 ; https://github.com/Lamothe/TRELLIS.2_rocm ; https://github.com/toastmanAu/trellis-2-rocm-comfyui
- Hunyuan3D-2.1 official CUDA / VRAM: https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
- AMD ROCm notebook, Hunyuan3D v2.1 on Instinct: https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/notebooks/inference/t2v_comfyui_api_mode_instinct.html
- Stable Fast 3D + HIP texture_baker (2025-01-18): https://github.com/Stability-AI/stable-fast-3d
- Potrace (DXF backend, GPL-2): https://potrace.sourceforge.net/ — 1.16, checked 2026-08-17
- OpenCV `approxPolyDP` / `findContours`: https://docs.opencv.org/4.13.0/d3/dc0/group__imgproc__shape.html
- Small-object photogrammetry capture: https://peterfalkingham.com/2019/01/16/small-object-photogrammetry-how-to-take-photos/ — 2019-01-16
- Shiny/transparent coating advice: https://www.instructables.com/Shooting-for-Photogrammetry/
- QUICKSURFACE: https://www.quicksurface.com/
- Geomagic Design X: https://hexagon.com/products/geomagic-design-x
- Clough42, scan as Fusion reference (not auto-convert): https://www.youtube.com/watch?v=pzMZ-sIua44 — 2025-05-25
- R9700 = gfx1201 / RDNA4, ROCm-supported: AMD product page + r/ROCm + ROCm compatibility matrix mentions — checked 2026-08-17
- Sibling lane x6 (image-to-3D is not B-rep): `reports/x6-image-to-3d-priorart.md` — 2026-08-17
- X.com, RealityScan 2.2 AMD: e.g. https://x.com/kotauchisunsun/status/2072622556176433265 (2026-07-02), https://x.com/CGWjp/status/2075507728072745236 (2026-07-10)

## Rerun Inputs

```
workflow: firecrawl-deep-research
topic: local AMD-friendly photo-to-Fusion-starting-point 2026
depth: thorough
output: markdown
note: Firecrawl MCP free-tier exhausted this session; primary pages pulled via WebFetch / Browse / official docs instead.
```
