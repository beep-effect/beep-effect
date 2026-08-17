# X13 — RTX 3070 as the attorney's target GPU (what fits, what runs where)

**Lane:** x13-rtx3070-target
**Date:** 2026-08-17
**Status:** FINAL
**Question:** The end user (solo patent attorney) has an NVIDIA GeForce RTX 3070. The developer's Linux box is 2× AMD Radeon AI PRO R9700. What does the 3070 change for a photo → starting-CAD / figure pipeline, and what should run on which machine?

**Context correction:** Earlier lanes (x6, x12) treated the R9700 pair as the only hardware and concluded Meshroom was unusable and generative image-to-3D was AMD-flaky. Those conclusions apply to **Machine B (developer)**. They do not automatically apply to **Machine A (attorney)**.

**Two machines:**

| Role | Owner | OS (assumed) | GPU | Client files |
| --- | --- | --- | --- | --- |
| Machine A | Attorney (end user of the shipped desktop app) | Windows | NVIDIA GeForce RTX 3070, **8 GB** | Yes — privileged |
| Machine B | Developer | Linux | 2× AMD Radeon AI PRO R9700, **32 GB each / 64 GB total** | No, by default |

**Confidentiality:** public hardware specs, vendor READMEs, CUDA / AliceVision / COLMAP docs, ABA Model Rules text, Formal Opinion 512, and practitioner reports only. No client photos, unpublished figures, or pre-publication patent content.

**Method:** NVIDIA product pages and the CUDA compute-capability table first; vendor READMEs / model cards for VRAM; AliceVision / COLMAP official docs for photogrammetry; ABA Model Rules 1.6 and 5.3 plus Formal Opinion 512 for the disclosure framework. Items that could not be independently confirmed against a primary page are labeled `UNVERIFIED`. Dates on citations are publication or last-checked dates.

**Non-goals:** Legal opinion for a particular matter. Product purchase advice. Benchmarks run on a 3070 in this session (we do not have one).

**This is not a legal opinion.** Section 5 states the ABA framework and the conditions that would have to be true for a disclosure to Machine B to be proper. It does not apply those rules to a named lawyer, client, or jurisdiction.

---

## Executive snapshot

**The 3070 is a real CUDA card and it unlocks Meshroom's full depth-map path. It does not change the ranked-1 product.** The primary photo → rectify → silhouette → potrace/OpenCV → DXF → Fusion sketch path is CPU-only. OpenCASCADE hidden-line removal (FreeCAD TechDraw / build123d) is also CPU-bound. For the thing the attorney actually needs every week, the GPU is a **nice-to-have**, not core.

**8 GB is small by 2026 standards.** Say that plainly. Desktop 3070, desktop 3070 Ti, 3070 Laptop, and 3070 Ti Laptop are all **8 GB** (the Laptop 3080 is the SKU that sometimes shipped 8 or 16). Compute capability is **8.6** on the whole family. CUDA 13 dropped Maxwell / Pascal / Volta (CC < 7.5). Ampere 8.6 is still a first-class target on CUDA 13.3.1 (June 2026) and on current PyTorch wheels. No 2026 toolchain of interest has dropped sm_86.

**What 8 GB actually buys on Machine A:**

- **Fits as stated by the vendor:** Hunyuan3D-2.0 **shape-only** (6 GB), Stable Fast 3D (~6 GB), TripoSR (~6 GB).
- **Fits with a community/FP16/offload caveat:** TRELLIS (official 16 GB; community FP16 ~8 GB), Hunyuan3D-2.0 shape via Hunyuan3D-2GP (`--profile 4`, ≥6 GB), CAD-Recode 1.5B / cadrille 2B / Zero-To-CAD-Qwen3-VL-2B (no vendor VRAM number; 1.5–2B FP16 inference is in the 4–7 GB band).
- **Does not fit as stated by the vendor:** TRELLIS.2 (24 GB, Linux-tested on A100/H100), Hunyuan3D-2.0 **shape+texture** (16 GB), Hunyuan3D-2.1 shape (10 GB) / texture (21 GB) / full (29 GB).

**Photogrammetry on a 3070 is the actual hardware correction.** AliceVision's 2025.1 binaries are CUDA-12, compute capability **≥ 5.0**. A 3070 at 8.6 satisfies that. Without NVIDIA, Meshroom is Draft Meshing only — that was the x12 AMD conclusion, and it is still true on Machine B. On Machine A the full depth-map pipeline runs. Realistic wall-clock for 60–150 well-shot photos of a small part is **~20–90 minutes** at moderate resolution on a desktop 3070, stretching to **1–4 hours** at default high-res / geometric-consistency settings. Those times are inferred from published Meshroom runs on other Ampere/Turing cards, not timed on a 3070 — labeled `UNVERIFIED` as a 3070-specific number.

**Topology: run the shipped app entirely on Machine A. Do not send client invention data to Machine B by default.** Moving privileged photos or unpublished figures from the attorney's box to the developer's box is not a cloud upload, but it **is** a disclosure to a third-party nonlawyer. Under ABA Model Rule 1.6 that needs informed consent (or a real implied-authorization argument, which is weak for unpublished invention geometry). Under Rule 5.3 the lawyer must supervise the nonlawyer and put confidentiality measures in place. Formal Opinion 512 adds a further consent duty if a self-learning GAI tool on B would ingest that content. The conditions that would have to be true are listed in §5. None of them are the default.

---

## 1. RTX 3070 exact specs

### 1.1 The family, side by side

NVIDIA's own desktop spec table lists CUDA capability **8.6** for both desktop cards ([GeForce RTX 3070 Family](https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3070-3070ti/), retrieved 2026-08-17). The official CUDA GPU list puts every GeForce RTX 3070 / 3070 Ti (and the rest of GA10x GeForce) in the **8.6** row ([CUDA GPU Compute Capability](https://developer.nvidia.com/cuda/gpus), retrieved 2026-08-17). Laptop SKUs are the same Ampere generation; they are not given a separate compute-capability row, and no source lists them as anything other than 8.6.

| SKU | VRAM | Memory type | CUDA cores | Boost clock | TGP / power (Founders / typical) | CUDA CC |
| --- | --- | --- | --- | --- | --- | --- |
| **Desktop RTX 3070** | **8 GB** | GDDR6, 256-bit | 5888 | 1.73 GHz | 220 W card; 650 W recommended PSU | **8.6** |
| **Desktop RTX 3070 Ti** | **8 GB** | GDDR6X, 256-bit | 6144 | 1.77 GHz | 290 W card; 750 W recommended PSU | **8.6** |
| **Laptop RTX 3070** | **8 GB** | GDDR6 | 5120 | 1290–1620 MHz (TGP-dependent) | typically 80–125 W `UNVERIFIED` as a single official TGP (Max-Q range) | **8.6** |
| **Laptop RTX 3070 Ti** | **8 GB** | GDDR6 | 5888 | 1035–1485 MHz | TGP-dependent | **8.6** |

Desktop numbers: NVIDIA full spec table on the 3070 family page (retrieved 2026-08-17). Desktop 3070 peak bandwidth is **448 GB/s** (14 Gbps GDDR6 × 256-bit), widely restated in reviews contemporaneous with launch ([TechSpot RTX 3070 review](https://www.techspot.com/review/2124-geforce-rtx-3070/), 2020-10-27; [TechPowerUp RTX 3070](https://www.techpowerup.com/gpu-specs/geforce-rtx-3070.c3674), retrieved 2026-08-17). Laptop numbers: NVIDIA 30-series laptop spec table ([GeForce RTX 30-Series Laptops](https://www.nvidia.com/en-us/geforce/laptops/30-series/), retrieved 2026-08-17). That table is unambiguous: **3070 Laptop = 8 GB**, **3070 Ti Laptop = 8 GB**. The "8 GB or 16 GB" row is the **3080 Laptop**, not the 3070.

This report assumes the attorney has a **desktop 3070 8 GB** unless stated otherwise. A 3070 Laptop is the same 8 GB and the same 8.6, with fewer cores (5120 vs 5888) and a much lower TGP. Photogrammetry and image-to-3D will be slower, not differently capable, on the laptop SKU. There is **no official 16 GB 3070**.

### 1.2 8 GB is small in 2026

State this without hedging. In 2026:

- The current GeForce generation's midrange starts at 8 GB only on the low SKUs; 12 GB / 16 GB / 32 GB are the cards the 2026 image-to-3D READMEs are written against (Hunyuan3D-2.1 official 10 / 21 / 29 GB; TRELLIS.2 official **24 GB**; TRELLIS official **16 GB**).
- AMD's own workstation card on Machine B is **32 GB GDDR6 each** ([AMD Radeon AI PRO](https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro.html), retrieved 2026-08-17). Two of them is 64 GB of VRAM the attorney does not have.
- A 2B vision-language model in BF16 is a comfortable 8 GB citizen. A 4B 3D generator with a 24 GB floor is not. An 8 GB card in 2026 is a **small-model and classical-vision card**, not a "run whatever landed on GitHub this month" card.

The 3070 is not obsolete as a CUDA device. It is obsolete as a VRAM device for 2025–2026 generative 3D.

### 1.3 Has any 2026 toolchain dropped compute capability 8.6?

**No.** The drop that happened in 2026 is **pre-Turing**.

CUDA Toolkit 13.0 removed offline compilation and library support for Maxwell, Pascal, and Volta — "compute capabilities earlier than Turing" (CC < 7.5). Ampere is not in that list. The same deprecation is restated in the live 13.3 Update 1 notes for cuFFT ([CUDA Toolkit 13.3 Update 1 Release Notes](https://docs.nvidia.com/cuda/cuda-toolkit-release-notes/index.html), retrieved 2026-08-17; archived 13.0.3 notes, [docs.nvidia.com/cuda/archive/13.0.3](https://docs.nvidia.com/cuda/archive/13.0.3/cuda-toolkit-release-notes/index.html)). Latest toolkit as of this retrieval: **CUDA Toolkit 13.3.1, June 2026** ([CUDA Toolkit Archive](https://developer.nvidia.com/cuda-toolkit-archive), retrieved 2026-08-17).

PyTorch 2.7+ wheels still ship Ampere (8.0, 8.6). The drop that bit people in 2025–2026 is Pascal (6.x), not Ampere. A PyTorch 2.7.x `cu128` install that refuses a GTX 1080 Ti still lists `sm_86` as supported ([PyTorch 2.7 release](https://pytorch.org/blog/pytorch-2-7/), 2025-04-23; community confirmation that 2.7.x minimum is 7.5, [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/comments/1lrerwe/pytorch_27x_no_longer_supports_pascal_architecture/), 2025-07-04).

Meshroom 2025.1 binaries are CUDA-12, CC **≥ 5.0** — two generations below Ampere ([alicevision.org Meshroom](https://alicevision.org/view/meshroom.html), retrieved 2026-08-17). COLMAP recommends CUDA ≥ 11.X ([colmap.github.io/install.html](https://colmap.github.io/install.html), retrieved 2026-08-17). Flash-Attention, used by TRELLIS / TRELLIS.2, targets Ampere and newer; the TRELLIS.2 README only calls out V100 (Volta, 7.0) as the GPU that should switch to xformers ([microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2), retrieved 2026-08-17).

**Bottom line:** nothing in the 2026 CUDA / PyTorch / Meshroom / COLMAP / TRELLIS stack has dropped sm_86. The 3070 is compute-capable. It is memory-poor.

---

## 2. What fits in 8 GB VRAM

Vendor-stated numbers first. Community / FP16 / offload second. "Fits" means the **vendor's own stated requirement is ≤ 8 GB** for that mode. "Fits-with-caveat" means the official number is higher (or missing) and a documented community build or a parameter-count estimate changes the answer. "Doesn't fit" means the vendor's stated floor is > 8 GB.

| Model | Vendor-stated VRAM | 8 GB verdict | Caveat |
| --- | --- | --- | --- |
| **TRELLIS** (image-large, 1.2B) | **≥ 16 GB.** Verified on A100 / A6000. Linux-tested. ([microsoft/TRELLIS](https://github.com/microsoft/TRELLIS), retrieved 2026-08-17; maintainer: "Currently at least 16GB VRAM is required," [issue #5](https://github.com/microsoft/TRELLIS/issues/5), 2024-12-06; HF Space maintainer, 16 GB, [discussion #8](https://huggingface.co/spaces/microsoft/TRELLIS/discussions/8), 2024-12-10) | **FITS-WITH-CAVEAT** | Community FP16 / Docker builds claim **8 GB** ([off-by-some/TRELLIS-BOX](https://github.com/off-by-some/TRELLIS-BOX): "at least 8GB VRAM (recommended: 16GB+)"; Windows Gradio `run-gradio-fp16.bat` advertised as 8 GB). Quality vs official FP32/bf16 is `UNVERIFIED` on a 3070. Official path does **not** fit. |
| **TRELLIS.2** (4B) | **≥ 24 GB.** Verified on A100 / H100. **Linux only.** CUDA 12.4 recommended. ([microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2); HF `microsoft/TRELLIS.2-4B`, retrieved 2026-08-17) | **DOESN'T FIT** | Reddit/ComfyUI "low VRAM / 8 GB" claims exist (Dec 2025–2026). A maintainer-adjacent comment called 24 GB "conservative" and invited 16 GB trials ([r/StableDiffusion](https://www.reddit.com/r/StableDiffusion/comments/1podq9a/trellis_2_just_dropped/)). **No vendor 8 GB path.** Treat 8 GB TRELLIS.2 as `UNVERIFIED` and out of scope for a shipped attorney app. |
| **Hunyuan3D-2.0 shape-only** | **6 GB** shape. ([Tencent-Hunyuan/Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) Models Zoo: "It takes 6 GB VRAM for shape generation and 16 GB for shape and texture generation in total.") | **FITS** | Official also ships Hunyuan3D-2mini (0.6B) and turbo/FlashVDM variants that are smaller still. `--low_vram_mode` is a first-class Gradio flag. |
| **Hunyuan3D-2.0 shape + texture** | **16 GB** combined. Same README. | **DOESN'T FIT** | Hunyuan3D-2GP (community, mmgp offload) restates **6 GB shape / 24.5 GB shape+texture** and offers `--profile 4` for "less but at least 6 GB" ([deepbeepmeep/Hunyuan3D-2GP](https://github.com/deepbeepmeep/Hunyuan3D-2GP), retrieved 2026-08-17). Shape-only on 8 GB via 2GP is **FITS-WITH-CAVEAT**. Official textured 2.0 on 8 GB is no. |
| **Hunyuan3D-2.1 shape-only** | **10 GB** shape. 3.3B shape model. ([Tencent-Hunyuan/Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1): "10 GB VRAM for shape generation, 21GB for texture generation and 29GB for shape and texture generation in total.") | **DOESN'T FIT** | Official Gradio exposes `--low_vram_mode`. Community reports of 6 GB laptop shape runs exist ([The Local Lab, 2025-07-09](https://www.patreon.com/TheLocalLab/posts/free-open-source-133710331)) and are **not** the vendor number. Do not ship 2.1 shape as an 8 GB feature. |
| **Hunyuan3D-2.1 shape + texture** | **21 GB** texture / **29 GB** full. Same README. | **DOESN'T FIT** | No honest 8 GB textured 2.1 path. |
| **Stable Fast 3D** | **~6 GB** default, single image. ([Stability-AI/stable-fast-3d](https://github.com/Stability-AI/stable-fast-3d), retrieved 2026-08-17) | **FITS** | Windows support is **experimental** (VS 2022). CPU fallback exists (`SF3D_USE_CPU=1`). |
| **TripoSR** | **~6 GB** default, single image. ([VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR), retrieved 2026-08-17) | **FITS** | `--chunk-size` can trade VRAM for time. CPU Marching Cubes fallback exists if `torchmcubes` is not CUDA-built. MIT licence. |
| **CAD-Recode v1.5** (Qwen2-1.5B + 1 linear) | **Not stated.** Repo describes the architecture only ([filaPro/cad-recode](https://github.com/filaPro/cad-recode), retrieved 2026-08-17). Demo is a Jupyter notebook / Docker. | **FITS-WITH-CAVEAT** | 1.5B FP16 weights are ~3 GB. Inference with a point-cloud encoder and short CadQuery decode is typically 4–6 GB. **Vendor did not publish a VRAM floor.** Estimate, not a measurement on a 3070. |
| **cadrille** (Qwen2-VL-2B) | **Not stated.** Training was on H100s; inference script has no VRAM note ([col14m/cadrille](https://github.com/col14m/cadrille); paper arXiv:2505.22914). | **FITS-WITH-CAVEAT** | 2B VL FP16 is ~4–5 GB weights plus vision activations. Image / multi-view mode will sit higher than point-cloud mode. Same caveat: no vendor number. |
| **Zero-To-CAD-Qwen3-VL-2B** | **Not stated** on the model card. Trained BF16 on 16× H100 80 GB; inference snippet is `device_map="auto"` ([ADSKAILab/Zero-To-CAD-Qwen3-VL-2B](https://huggingface.co/ADSKAILab/Zero-To-CAD-Qwen3-VL-2B), retrieved 2026-08-17). Expects **8 views at 256×256**, `max_new_tokens=4096`. | **FITS-WITH-CAVEAT** | Third-party VRAM estimator for the **base** Qwen3-VL-2B quotes ~4.6 GB FP16 ([Spheron GPU recommender](https://www.spheron.network/tools/gpu-recommender/Qwen/Qwen3-VL-2B-Instruct/), retrieved 2026-08-17). Eight images + a 4 096-token CadQuery decode will consume more. 8 GB is plausible and unproven. Model card limitation: "Expects 8 clean rendered views… photorealistic or noisy inputs" are out of distribution — a phone photo of a machined part is not the training distribution. |

### 2.1 How to read that table for product decisions

- **Ship-on-3070 generative 3D, if you ship any:** TripoSR and Stable Fast 3D. Vendor numbers land under 8 GB. Both are 2024-class feed-forward meshes. They are illustration / "shape sketch" tools, not CAD (see x6).
- **Ship-on-3070 with an installer asterisk:** Hunyuan3D-2.0 **shape-only**, optionally via the official `--low_vram_mode` or the 2GP profile-4 fork. Do not advertise textured 2.0 or any 2.1.
- **Do not ship on 3070:** TRELLIS.2, Hunyuan3D-2.1 full, official TRELLIS 16 GB path. These are Machine-B research toys on **public / synthetic** images, or they do not run.
- **CAD-Recode / cadrille / Zero-To-CAD:** parameter count says they fit. None of the three vendors published an 8 GB claim. If you wire one, budget an on-box smoke test and a graceful OOM, and remember Zero-To-CAD wants **eight rendered views**, not a phone photo (so it sits *after* a reconstruction step, not instead of one).

---

## 3. Photogrammetry on a 3070

This is the section that actually changes because of the hardware correction.

### 3.1 Meshroom / AliceVision — the 3070 satisfies the CUDA gate

Official Meshroom 2025.1.0 note, retrieved 2026-08-17 from [alicevision.org/view/meshroom.html](https://alicevision.org/view/meshroom.html):

> To fully utilize Meshroom, a NVIDIA CUDA-enabled GPU is recommended. The binaries are built with **CUDA-12** and are compatible with **compute capability ≥ 5.0**. Without a supported NVIDIA GPU, only "Draft Meshing" can be used for 3D reconstruction.

A desktop or laptop 3070 is CC **8.6**. It is three generations above the floor. The depth-map node will run. The x12 conclusion ("Meshroom full pipeline is a CUDA hard-require; Draft Meshing only on AMD") remains correct **for Machine B** and is inverted **for Machine A**.

First-class binaries exist for both Windows and Linux from the same Zenodo record cited on that page (`Meshroom-2025.1.0-Windows.zip` and `Meshroom-2025.1.0-Linux.tar.gz`). There is no official macOS build.

Older manuals said CC ≥ 2.0 (Meshroom 19.x). That is historical. Ship against the 2025.1 note: **CC ≥ 5.0, CUDA 12 binaries**.

### 3.2 Realistic wall-clock for ~60–150 photos of a small part

AliceVision does not publish a "N photos on a 3070" number. Published practitioner times, none of them on a confirmed 3070:

| Source | Photos / subject | Hardware (as stated) | Wall-clock | Date |
| --- | --- | --- | --- | --- |
| Gamefromscratch Meshroom demo | ~50 photos of a rock | Unspecified desktop | **~20 minutes** | YouTube, retrieved 2026-08-17 |
| ExplainingComputers | 118 photos of a lion statue | Unspecified | **~7 hours** (overnight) | YouTube, retrieved 2026-08-17 |
| Peter Falkingham, Meshroom 2021.1 CUDA | his standard test set | home CUDA box | **1 h 05 min** full pipeline | [peterfalkingham.com, 2021-03 / 2021-09-26](https://peterfalkingham.com/2021/09/26/meshroom-cl/) |
| Same author, Meshroom-CL (no NVIDIA) | same set | iMac Boot Camp | **~1 h 30 min** (MVS 1 h 20 min) | same post |
| Gleb Alexandrov pipeline talk | depth-map chunking example | Unspecified | ~19 s/chunk × 35 chunks ≈ **11 minutes** for that depth-map stage alone | YouTube, retrieved 2026-08-17 |

For a **small part, 60–150 well-lit, high-overlap stills, downscaled to ~2–4 MP**, a desktop 3070 should land nearer the Falkingham / 50-photo end than the 118-photo statue end: **about 20–90 minutes** for a complete textured mesh. Leave the default geometric-consistency depth maps and full-resolution 24 MP phone JPEGs in place and the same job is **1–4 hours**, dominated by `DepthMap`. Those ranges are **inferred, not timed on a 3070** — `UNVERIFIED` as a 3070-specific benchmark. A 3070 Laptop at 80–100 W will be slower still.

The physics caveat from x12 still applies: machined metal with no texture fails before CUDA vs HIP matters. A 3070 does not fix a specular part. Dust, developer spray, or a patterned sock still come first.

### 3.3 COLMAP + CUDA on the same card

COLMAP's dense step (`patch_match_stereo`) is CUDA (or official HIP on AMD). SfM (feature extract / match / mapper) can use the GPU but does not require it (`--FeatureExtraction.use_gpu 0` / `--FeatureMatching.use_gpu 0`). Official docs, retrieved 2026-08-17:

- Pre-built **Windows** binaries with GUI + CLI: [colmap.github.io/install.html](https://colmap.github.io/install.html), also [demuc.de/colmap](https://demuc.de/colmap/).
- Windows-from-source: `vcpkg install colmap[cuda,tests]:x64-windows`. Recommended CUDA ≥ 11.X, VS 2019+.
- Distro Linux packages **ship without CUDA/HIP**. CUDA COLMAP on Linux is a source or Docker build. Official CUDA Docker image exists.
- Dense VRAM ceiling and the standard mitigations, from the official FAQ ([colmap.github.io/faq.html](https://colmap.github.io/faq.html), retrieved 2026-08-17):

  1. `--PatchMatchStereo.max_image_size` / `--StereoFusion.max_image_size` — **downscale**. This is the first lever on an 8 GB card.
  2. Reduce source images per reference in `stereo/patch-match.cfg` (`__auto__, 30` → `__auto__, 10`).
  3. `--PatchMatchStereo.cache_size` / `--StereoFusion.cache_size` (GiB) — lower if **system RAM** is the limit; raise if you have RAM and a fast disk.
  4. Disable geometric consistency (`--PatchMatchStereo.geom_consistency false`) to cut GPU memory and time, at a quality cost.
  5. Feature matching OOM: lower `--FeatureMatching.max_num_matches`. FAQ gives the estimate `4 * num_matches² + 4 * num_matches * 256` bytes for SIFT; 10 000 matches ≈ 400 MB.
  6. Windows display-driver timeouts under heavy stereo: raise TDR (`TdrDelay`) as documented in the same FAQ, or run the stereo step from the CLI.

On 8 GB, treat **~2000 px long edge** as the default dense size for phone photos, and only raise it if stereo does not OOM. 24 MP JPEGs at full resolution with `geom_consistency` on will bite. That is a settings problem, not a "COLMAP does not run on a 3070" problem.

COLMAP wall-clock for 60–150 small-part photos with CUDA features + CUDA dense, downscaled: typically **tens of minutes to ~2 hours** on a 3070-class card. `UNVERIFIED` as a 3070-specific number. Hierarchical / global mappers exist for large sets; they are unnecessary at 150 frames.

### 3.4 What the 3070 changes vs the R9700 box

| Step | Machine A (3070, CUDA) | Machine B (2× R9700, HIP / no CUDA) |
| --- | --- | --- |
| Meshroom depth maps | **Yes.** CC 8.6 ≥ 5.0. | **No.** Draft Meshing only. |
| COLMAP dense | Official CUDA. | Official HIP, arches listed `gfx90a/942/1030/1100`. **`gfx1201` (R9700) not listed — UNVERIFIED** (x12). |
| Agisoft Metashape | CUDA. | Official OpenCL (x12). |
| RealityScan | CUDA, Windows. | AMD RDNA3/4 listed, **Windows GUI only**, EULA training issue (x12). |

The photogrammetry story on the attorney's box is the ordinary CUDA story. The photogrammetry story on the developer's box is still the AMD-awkward story from x12.

---

## 4. Windows vs Linux

Assume the attorney is on **Windows**. "First-class" means the project itself ships a Windows binary or documents Windows as a supported OS, not a gist.

| Tool | Windows | Linux | Forces WSL2? |
| --- | --- | --- | --- |
| **Ranked-1 2D path** (OpenCV + potrace + DXF) | Yes. Native wheels / `potrace.exe`. | Yes. | No. |
| **Fusion 360** (Canvas, Insert DXF, Insert Mesh) | First-class. This is where the attorney already works. | Fusion exists on Linux as a thin unofficial story; do not depend on it. | No. |
| **Meshroom 2025.1** | Official `.zip`. | Official `.tar.gz`. | No. |
| **COLMAP** | Official pre-built GUI/CLI; vcpkg CUDA. | Source / Docker for CUDA. Apt/dnf packages **lack** CUDA. | No for the pre-built. |
| **TripoSR** | Python + PyTorch. Works. `torchmcubes` CUDA build is the usual foot-gun. | Same. | No. |
| **Stable Fast 3D** | **Experimental.** Needs VS 2022 to compile CUDA/Metal-class extensions. | First-class. | Not required; WSL is the less-painful compile path if VS is absent. |
| **Hunyuan3D-2.0 / 2.1** | Official: "supports Macos, Windows, Linux." Custom CUDA rasterizer needs a MSVC toolchain. WinPortable community bundle exists ([YanWenKun/Hunyuan3D-2-WinPortable](https://github.com/YanWenKun/Hunyuan3D-2-WinPortable)). | Official. | No, but many attorneys will have a better time with WinPortable than compiling `custom_rasterizer`. |
| **Hunyuan3D-2GP** | Documented (VS 2022 + `VsDevCmd`). | Yes. | No. |
| **TRELLIS** | Official: "currently tested only on **Linux**. For windows setup, you may refer to #3 (not fully tested)." | Official. | **Practically yes** for anything close to the official path. |
| **TRELLIS.2** | Not a supported OS. "tested only on **Linux**." | Official, 24 GB. | **Yes, if you insist on trying.** Still doesn't fit 8 GB. |
| **CAD-Recode / cadrille** | Dockerfiles. Python, so native Windows is possible and undocumented. | Docker / Python. | WSL2 + Docker is the path of least resistance. |
| **Zero-To-CAD-Qwen3-VL-2B** | `transformers` — Windows PyTorch works. | Same. | No. |
| **FreeCAD TechDraw / build123d HLR** | First-class Windows builds. | First-class. | No. |
| **OpenCV** | Official Windows wheels. CUDA contrib is optional and unused by the ranked-1 path. | Same. | No. |

### 4.1 What WSL2 actually costs if something forces it

WSL2 GPU access is **GPU-PV (paravirtualization)**, not PCIe passthrough ([Microsoft GPU-PV](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/gpu-paravirtualization); [NVIDIA CUDA on WSL](https://docs.nvidia.com/cuda/wsl-user-guide/index.html), retrieved 2026-08-17). Rules that bite:

1. Install the **Windows** NVIDIA driver. Do **not** install a Linux NVIDIA driver inside the distro. The Linux-side `libcuda` is a stub that talks to the Windows driver.
2. CUDA toolkits older than 11 do not support WSL2.
3. Filesystem: `/mnt/c` is a 9P (historically) / virtiofs bridge. Microsoft's own comparison page has long recommended keeping performance-sensitive work on the **Linux ext4 VHD**, not under `/mnt/c`. Cross-OS I/O has been measured at small-file rates an order of magnitude below native ext4 ([WSL issue #4197](https://github.com/microsoft/WSL/issues/4197), 2019, still the canonical report; 2026 virtiofs SWIOTLB work improves the bridge but does not make `/mnt/c` equal to ext4 — [boxofcables.dev, 2026-05-31](https://www.boxofcables.dev/wsl2-per-device-swiotlb-pools-for-virtiofs-and-virtioproxy/)).
4. Photogrammetry is a worst case for that bridge: hundreds of multi-megabyte JPEGs, plus COLMAP/Meshroom's cache of undistorted images and depth maps. **If Meshroom or COLMAP is run under WSL, the workspace must live on ext4 (`~/…`), not on `C:\Users\…` via `/mnt/c`.** Otherwise the GPU is idle while 9P copies frames.
5. Compiling CUDA extensions (TRELLIS submodules, Hunyuan rasterizer, `torchmcubes`, SF3D texture baker) inside WSL is the usual "it works if you pin CUDA_HOME" story. It is not an attorney-facing install.

**Product implication:** do not design the shipped Windows app to require WSL2. Meshroom and COLMAP have native Windows builds. The ranked-1 path is native Windows. WSL2 is a developer convenience for Linux-only research models (TRELLIS official, TRELLIS.2), not a runtime we ask a solo attorney to operate.

---

## 5. Architectural fork — what runs where

### 5.1 The three options

**(a) Everything on A.** The shipped desktop app, the ranked-1 2D path, Fusion, Meshroom, COLMAP, TripoSR/SF3D, Hunyuan-2.0 shape, CAD-Recode-class 1.5–2B models, and the figure compositor all run on the attorney's Windows box. Client files never leave it. Machine B never sees invention data.

**(b) Heavy reconstruction batched to B.** Photos / meshes / unpublished figures are copied to the developer's Linux box so the 2×32 GB R9700s can run TRELLIS.2-class or Hunyuan-2.1-full jobs that do not fit in 8 GB.

**(c) Hybrid.** A does the default path. B is used only for an explicit, rare, consented overflow (a large photogrammetry job, a 2.1 texture, a TRELLIS.2 experiment) under the conditions in §5.3.

**The answer is (a), with (c) as a gated exception, never (b) as a default.**

Reasons that are not ethics: the ranked-1 path does not need B's VRAM; Meshroom and COLMAP now run on A; the models that *only* fit on B are the ones x6 already disqualified as CAD (TRELLIS.2, Hunyuan 2.1 full). Reasons that are ethics: §5.2–5.3.

### 5.2 This is a disclosure, not a cloud upload — and that still matters

Copying a client's part photos from Machine A to Machine B is **not** an upload to a hosted model vendor. It is still a disclosure of "information relating to the representation" to a **human third party who is not the lawyer and is not in the lawyer's firm**.

ABA Model Rule **1.6(a)** (retrieved 2026-08-17, [americanbar.org Rule 1.6](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/)):

> A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent, the disclosure is impliedly authorized in order to carry out the representation or the disclosure is permitted by paragraph (b).

Comment [3] is broader than the privilege: the duty covers "all information relating to the representation, whatever its source," not only client-labeled confidential communications. Unpublished invention photos, even without a file number on them, are information relating to the representation. Comment [4] also bars disclosures that "could reasonably lead to the discovery of such information by a third person."

**Implied authorization** (cmt. [5]) covers disclosures "appropriate in carrying out the representation." Sending a draft to a co-counsel or a printer can qualify. Sending unpublished invention geometry to the software developer who built the local tool, so the developer can run a bigger GPU job, is a much weaker implied-authorization story. Do not rest a product architecture on it.

**Rule 1.6(c)** requires "reasonable efforts to prevent the inadvertent or unauthorized disclosure of, or unauthorized access to," that information. Comment [18] (retrieved 2026-08-17, [comment on Rule 1.6](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/comment_on_rule_1_6/)) lists reasonableness factors: sensitivity of the information, likelihood of disclosure without extra safeguards, cost and difficulty of those safeguards, and whether they make the software unusable. It expressly cross-references **Rule 5.3 comments [3]–[4]** for sharing with nonlawyers outside the firm. Comment [19] adds that transmitting a communication requires reasonable precautions against unintended recipients; "special security measures are not required if the method affords a reasonable expectation of privacy," but sensitivity plus the absence of a confidentiality agreement can require more.

**None of 1.6(b)'s exceptions** (death/harm, client crime/fraud, legal advice about the lawyer's own compliance, fee/defense, court order, conflicts checks) is "my contractor has more VRAM."

### 5.3 Rule 5.3 — nonlawyer assistance, including a developer outside the firm

ABA Model Rule **5.3** (retrieved 2026-08-17, [americanbar.org Rule 5.3](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_3_responsibilities_regarding_nonlawyer_assistant/)) makes the lawyer responsible for a nonlawyer "employed or retained by or associated with" the lawyer: managerial measures (a), direct supervision (b), and vicarious responsibility if the lawyer orders, ratifies, or fails to mitigate known misconduct (c).

Comment [3], **Nonlawyers Outside the Firm** (retrieved 2026-08-17, [comment on Rule 5.3](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_3_responsibilities_regarding_nonlawyer_assistant/comment_on_rule_5_3/)):

> A lawyer may use nonlawyers outside the firm to assist the lawyer in rendering legal services to the client. Examples include the retention of an investigative or paraprofessional service, hiring a document management company to create and maintain a database for complex litigation, sending client documents to a third party for printing or scanning, and using an Internet-based service to store client information. When using such services outside the firm, a lawyer must make reasonable efforts to ensure that the services are provided in a manner that is compatible with the lawyer's professional obligations. The extent of this obligation will depend upon the circumstances, including the education, experience and reputation of the nonlawyer; the nature of the services involved; the terms of any arrangements concerning the protection of client information; and the legal and ethical environments of the jurisdictions in which the services will be performed, particularly with regard to confidentiality. … When retaining or directing a nonlawyer outside the firm, a lawyer should communicate directions appropriate under the circumstances to give reasonable assurance that the nonlawyer's conduct is compatible with the professional obligations of the lawyer.

A developer who receives client part photos to run photogrammetry or Hunyuan on Machine B is squarely in that paragraph — closer to "document management / scanning" than to "inside-the-firm paralegal." It is allowed in principle. It is allowed **only** if the supervision and confidentiality arrangements are real.

Comment [2] (inside the firm, but the instruction duty is the same idea): the lawyer must give assistants "appropriate instruction and supervision concerning the ethical aspects of their employment, particularly regarding the obligation not to disclose information relating to representation of the client."

### 5.4 Formal Opinion 512, if B also runs a GAI model

ABA Formal Opinion **512** (29 July 2024), retrieved 2026-08-17 as PDF from [americanbar.org](https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf) (no replacing successor found through 2026-08-17; see x8):

- Before inputting information relating to the representation, the lawyer **must evaluate** the risk it will be disclosed to or accessed by others **outside the firm** (Op. 512 at 6–7).
- If the tool is **self-learning** such that input from Client A could later appear in output for someone else, **informed consent is required**, and boilerplate engagement language is not enough (Op. 512 at 7).
- Using a tool for idea generation **without** inputting representation-related information does not require that consent (Op. 512 at 7).
- Supervision duties under 5.1 / 5.3 extend to "nonlawyer assistants (including GAI vendors)" (Op. 512 at 2 n.15 and later).

A local TRELLIS/Hunyuan job on Machine B that does **not** train, does **not** retain prompts, and is not reachable by anyone but the instructed developer is not the "self-learning hosted GAI" fact pattern that triggered 512's hard consent rule. It is still a 1.6 disclosure of the input images to that developer, and 512 still requires the lawyer to understand the tool (Rule 1.1) and to evaluate access risk. If the developer would use those images to fine-tune, to debug a shared demo, or to populate a dataset, 512's informed-consent holding applies on its own terms.

### 5.5 What would have to be true for Machine B to be a proper overflow

Not a legal opinion. The framework above is satisfied only if **all** of the following are actually true, not hoped:

1. **Informed consent** under Rule 1.6(a) / 1.0(e), specific to *this* disclosure: which files, to whom (named developer, not "the vendor"), for what purpose, for how long, and what could go wrong if those images leak or become prior art through mishandling. Not a boilerplate "we use contractors" clause (Op. 512 at 7 is the closest formal statement of that standard in the GAI setting; 1.6 cmt. [18] allows a client to consent to forgo safeguards the Rule would otherwise require).
2. **A written confidentiality arrangement** with the developer (NDA or contractor agreement) that covers unpublished invention information, forbids further disclosure, forbids use for any other client or for model training, and requires return or certified destruction after the job. Rule 5.3 cmt. [3] lists "the terms of any arrangements concerning the protection of client information" as a reasonableness factor.
3. **Need-to-know and minimization.** Send the smallest set that the job requires (masked backgrounds, no docket numbers, no inventor names on the scale card if they are not needed). 1.6(a) is a reveal rule; revealing less is always more defensible.
4. **No further processors.** Machine B does not sync those files to a personal cloud, a CI cache, a Hugging Face Space, or a second GPU box. 1.6(c) + 1.6 cmt. [19].
5. **Access control on B.** Full-disk encryption, a separate login, no shared family account, no leftover Gradio server bound to `0.0.0.0`. 1.6(c) reasonableness factors.
6. **Supervisory directions** under 5.3(b) and cmt. [3], in writing: do not train, do not screenshot into chat, do not keep copies, do not use the part as a demo.
7. **The developer is competent to follow those directions** (5.3 cmt. [3]: education, experience, reputation). A friend with a fast GPU and no practice handling privileged files is a worse 5.3 candidate than a contracted engineer who already lives under an NDA.
8. **If a GAI model on B will ingest the files,** run the Op. 512 evaluation (who can access inputs; does the tool learn; is consent required) *before* the copy, not after.
9. **Patentability hygiene, separate from the Model Rules.** A disclosure to a developer under NDA is generally not a 35 U.S.C. 102 public disclosure, but sloppy handling (a public GitHub issue with a screenshot, a demo reel, a Discord help thread) can become one. That is a patent-law fact pattern, not an ethics opinion, and it is a reason to keep the default on A.

If those conditions are not in place — and for a solo attorney shipping a desktop app whose developer is a friend with a dual-R9700 box, they are **not** in place by default — option (b) is the wrong architecture.

### 5.6 What Machine B is for

Machine B is the **development and evaluation** box:

- Build and test the AMD/ROCm fallback (COLMAP HIP, TRELLIS-AMD, anything x12 still cares about).
- Run TRELLIS.2 / Hunyuan-2.1 / large-VRAM experiments on **public, synthetic, or the developer's own** objects.
- Profile, compile CUDA-alternative kernels, keep the Linux CI honest.

It is not a batch queue for client parts.

---

## 6. Does the 3070 matter for the primary path?

### 6.1 Ranked-1: photo → rectify → silhouette → potrace / OpenCV → DXF → Fusion sketch

**No. This path is CPU-only. The GPU is irrelevant to it.**

| Stage | What actually runs | GPU? |
| --- | --- | --- |
| Capture | Phone / camera JPEG | No |
| Rectify / deskew | Homography (OpenCV `findHomography` + `warpPerspective`, or a manual crop) | Default OpenCV is **CPU**. The `opencv_contrib` CUDA module exists and is not what this pipeline uses. |
| Threshold / silhouette | `cv2.threshold` / `adaptiveThreshold`, possibly GrabCut | CPU |
| Contours / holes / sharp corners | `findContours` + `approxPolyDP` | CPU |
| Trace | `potrace -b dxf` (or the OpenCV polygon itself dumped to DXF) | **potrace is a CPU tracer.** There is no CUDA potrace. |
| Insert | Fusion **Insert > DXF** onto a sketch plane; Calibrate / scale from a ruler | Fusion application code on CPU; the 3070 may help Fusion's viewport, not the DXF ingest |
| Model | Attorney sketches / extrudes | Human + Fusion. GPU optional for the viewport. |

x12 already called this "CPU-only, fully offline." The 3070 does not make it faster in any way that matters, and the R9700's absence of CUDA does not make it slower. **Ship this path as the default on any Windows box, GPU or not.**

Optional OpenCV CUDA would accelerate a few filters on a 3070 and would help nobody enough to take a CUDA dependency for the default install.

### 6.2 Figure compositor: OCCT hidden-line via build123d / FreeCAD TechDraw

**Also CPU-bound. The GPU is irrelevant to HLR.**

FreeCAD's own feature request ([FreeCAD #19442](https://github.com/FreeCAD/FreeCAD/issues/19442), opened 2025-02-06, still open as retrieved 2026-08-17):

> FreeCAD's Technical Drawing module (TechDraw) relies heavily on the OpenCascade Hidden Line Removal algorithms. These algorithms can be very slow, do not provide progress reporting and do not provide any linkage between the input shape and the output.

The same text is the long-standing GSoC brief ([opencax/GSoC#69](https://github.com/opencax/GSoC/issues/69)). The work proposed is new CPU projection code or a modification of the OCC algorithm — not a CUDA port. OCC's HLR (`HLRBRep`, `HLRAlgo`, `HLRBRep_Algo`) is classical computational geometry: project edges, compute hidden segments, emit 2D. It runs on the CPU. build123d talks to the same kernel through OCP. There is no GPU HLR in that stack.

A 3070 will make Fusion and FreeCAD viewports smoother. It will not move TechDraw HLR off the CPU. For a solo-attorney figure compositor, HLR time is a **model-complexity** problem (defeaturing, sectioning, not tracing every fillet), not a GPU problem.

### 6.3 So is the GPU core or nice-to-have?

| Job | GPU role on the 3070 |
| --- | --- |
| Ranked-1 2D starting sketch | **None.** Core path is CPU. |
| Figure compositor / HLR | **None.** OCC HLR is CPU. |
| Fusion modeling | Viewport nicety. |
| Meshroom / COLMAP of a real part | **Nice-to-have second lane.** Newly viable on A because of CUDA. Still loses to a silhouette for prismatic parts (x12). |
| TripoSR / SF3D / Hunyuan-2.0 shape | **Nice-to-have illustration / organic blob.** Not CAD (x6). Fits in 8 GB. |
| TRELLIS.2 / Hunyuan-2.1 full | **Does not run on A.** Not a reason to send client files to B. |

**The 3070 is a nice-to-have for the product that should be shipped. It is core only for an optional photogrammetry sidecar.** Do not structure the architecture, the installer, or the confidentiality story around it.

---

## Runs-where table

| Runs on the attorney's 3070 box (Machine A) | Needs the developer's AMD box, or does not exist on 8 GB |
| --- | --- |
| Ranked-1 path: rectify → silhouette → potrace/OpenCV → DXF → Fusion sketch (CPU) | TRELLIS.2 official (24 GB, Linux, A100/H100) |
| Fusion Canvas / Insert DXF / Insert Mesh / modeling | Hunyuan3D-2.1 official shape (10 GB) / texture (21 GB) / full (29 GB) |
| Figure compositor: FreeCAD TechDraw or build123d OCC HLR (CPU) | Hunyuan3D-2.0 official **shape+texture** (16 GB) |
| Meshroom 2025.1 **full** pipeline (CUDA-12, CC 8.6 ≥ 5.0), Windows zip | Official TRELLIS at the stated 16 GB floor (community FP16 is an A-side caveat, not a vendor path) |
| COLMAP Windows CUDA: SfM + dense, with `max_image_size` / cache / source-image mitigations | COLMAP HIP on `gfx1201` (R9700) — exists as official HIP, **arch support UNVERIFIED** (x12). Not needed on A. |
| TripoSR (~6 GB) | Any cloud Meshy / Rodin / Tripo / Hunyuan 3.x API (confidentiality: do not) |
| Stable Fast 3D (~6 GB; Windows experimental) | RealityScan Linux CLI ("coming later" as of x12) |
| Hunyuan3D-2.0 **shape-only** (6 GB official; 2GP `--profile 4` ≥ 6 GB) | Hunyuan3D-2.1 PBR paint at vendor settings |
| Hunyuan3D-2mini / turbo / FlashVDM shape (smaller than 6 GB) | Multi-GPU 64 GB experiments, training, fine-tunes |
| CAD-Recode 1.5B / cadrille 2B / Zero-To-CAD-2B inference (**caveat:** no vendor VRAM number; size says yes) | Zero-To-CAD used as a one-photo button (it wants 8 rendered views; that is a pipeline gap, not a GPU gap) |
| Agisoft Metashape CUDA (paid, if licensed on A) | "Batch the client's part to the developer's box" as a default |
| Local non-training 1.5–2B VLM / LLM helpers that actually fit in 8 GB | |

---

## Recommendation (machine topology)

Ship one Windows desktop app that runs entirely on Machine A. The default path is the CPU 2D shortcut into Fusion; it does not care that the attorney owns a 3070, and it does not care that the developer owns 64 GB of AMD VRAM. Use the 3070, when it is present, as an **optional sidecar** for Meshroom/COLMAP and for the small feed-forward meshes that officially fit in 6–8 GB. Do not send client photos, unpublished figures, or invention-identifying files to Machine B unless every condition in §5.5 is actually in place — informed consent, a written confidentiality arrangement, minimization, no further processors, access control, written 5.3 directions, and a fresh Formal Opinion 512 evaluation if a GAI model will ingest the files. Machine B exists to build the product and to run large models on public or synthetic data, not to be a privileged reconstruction cluster. The earlier AMD-only conclusions still describe the developer box. They do not describe the user.

---

## Sources

| Source | Why it is here | Retrieved |
| --- | --- | --- |
| [NVIDIA GeForce RTX 3070 Family](https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3070-3070ti/) | Desktop 3070 / 3070 Ti VRAM, cores, clocks, TGP, **CUDA capability 8.6** | 2026-08-17 |
| [NVIDIA GeForce RTX 30-Series Laptops](https://www.nvidia.com/en-us/geforce/laptops/30-series/) | 3070 Laptop 8 GB / 5120 cores; 3070 Ti Laptop 8 GB / 5888 cores | 2026-08-17 |
| [NVIDIA CUDA GPU Compute Capability](https://developer.nvidia.com/cuda/gpus) | 3070 / 3070 Ti in the 8.6 row | 2026-08-17 |
| [CUDA Toolkit 13.3 Update 1 Release Notes](https://docs.nvidia.com/cuda/cuda-toolkit-release-notes/index.html) | Live 13.3.1 notes; cuFFT still records the 13.0 pre-Turing drop | 2026-08-17 |
| [CUDA Toolkit 13.0.3 Release Notes (archive)](https://docs.nvidia.com/cuda/archive/13.0.3/cuda-toolkit-release-notes/index.html) | "Removed support for Maxwell, Pascal, and Volta… earlier than Turing" | 2026-08-17 |
| [CUDA Toolkit Archive](https://developer.nvidia.com/cuda-toolkit-archive) | Latest = 13.3.1, June 2026 | 2026-08-17 |
| [microsoft/TRELLIS](https://github.com/microsoft/TRELLIS) | Official ≥16 GB, Linux-tested, Windows = issue #3 | 2026-08-17 |
| [microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | Official ≥24 GB, Linux, A100/H100, CUDA 12.4 | 2026-08-17 |
| [Tencent-Hunyuan/Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) | 6 GB shape / 16 GB shape+texture; Win/Mac/Linux | 2026-08-17 |
| [Tencent-Hunyuan/Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) | 10 / 21 / 29 GB | 2026-08-17 |
| [deepbeepmeep/Hunyuan3D-2GP](https://github.com/deepbeepmeep/Hunyuan3D-2GP) | Community ≥6 GB shape via `--profile 4`; 24.5 GB textured | 2026-08-17 |
| [Stability-AI/stable-fast-3d](https://github.com/Stability-AI/stable-fast-3d) | ~6 GB; Windows experimental | 2026-08-17 |
| [VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR) | ~6 GB | 2026-08-17 |
| [filaPro/cad-recode](https://github.com/filaPro/cad-recode) | Qwen2-1.5B + linear; no VRAM claim | 2026-08-17 |
| [col14m/cadrille](https://github.com/col14m/cadrille) | Qwen2-VL-2B; no VRAM claim | 2026-08-17 |
| [ADSKAILab/Zero-To-CAD-Qwen3-VL-2B](https://huggingface.co/ADSKAILab/Zero-To-CAD-Qwen3-VL-2B) | 2B VL, 8×256 views, no VRAM claim | 2026-08-17 |
| [AliceVision Meshroom](https://alicevision.org/view/meshroom.html) | CUDA-12, CC ≥ 5.0; Windows + Linux binaries; Draft Meshing otherwise | 2026-08-17 |
| [COLMAP install](https://colmap.github.io/install.html) | Windows pre-built; vcpkg CUDA; Linux distro pkgs lack CUDA | 2026-08-17 |
| [COLMAP FAQ](https://colmap.github.io/faq.html) | Dense VRAM mitigations; TDR; cache_size; max_image_size | 2026-08-17 |
| [NVIDIA CUDA on WSL User Guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html) | GPU-PV; Windows driver only | 2026-08-17 |
| [AMD Radeon AI PRO](https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro.html) | R9700 32 GB | 2026-08-17 |
| [ABA Model Rule 1.6](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/) + [comment](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/comment_on_rule_1_6/) | Confidentiality; 1.6(c); cmts. [18]–[19] | 2026-08-17 |
| [ABA Model Rule 5.3](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_3_responsibilities_regarding_nonlawyer_assistant/) + [comment](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_3_responsibilities_regarding_nonlawyer_assistant/comment_on_rule_5_3/) | Nonlawyer assistance, including outside the firm, cmt. [3] | 2026-08-17 |
| [ABA Formal Opinion 512 (PDF)](https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf) | GAI confidentiality / consent / 5.3 vendors | 2026-08-17 |
| [FreeCAD #19442](https://github.com/FreeCAD/FreeCAD/issues/19442) | TechDraw HLR is OCC, slow, CPU, no progress | 2026-08-17 |
| x6, x8, x12 (this packet) | Prior-art / ethics / AMD-only photo-to-CAD context this lane corrects | 2026-08-17 |

---

## Open / UNVERIFIED

- **No 3070 was timed in this session.** Meshroom 20–90 min / 1–4 h and COLMAP "tens of minutes to ~2 h" are inferences from other cards and other years.
- **TRELLIS official-vs-FP16 quality on 8 GB** is a community claim, not a Microsoft number.
- **TRELLIS.2 on 8 GB or 16 GB** is `UNVERIFIED` and should be treated as no.
- **Hunyuan3D-2.1 shape on 6–8 GB** via `--low_vram_mode` is a community report, not the 10 GB vendor floor.
- **CAD-Recode / cadrille / Zero-To-CAD VRAM** is estimated from parameter count. Smoke-test on a real 3070 before advertising.
- **COLMAP HIP `gfx1201`** remains `UNVERIFIED` (x12). Irrelevant on A.
- **3070 Laptop TGP band (80–125 W)** is the well-known Max-Q range, not a single number on the NVIDIA laptop table.
- **Jurisdictional variance.** ABA Model Rules are a model. A named attorney is bound by the adopting jurisdiction's rules and any stricter opinion. This report does not apply them.
- Firecrawl's anonymous daily cap was exhausted mid-lane; remaining pages were retrieved with `web_fetch` / `web_search` against the same primary URLs.
