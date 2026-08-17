# LLM → CAD generation: state of the art (2026-08-17)

**Lane:** x5-llm-to-cad-codegen
**Bias:** what is reproducible *locally* (open kernels, open weights, inspectable code).
**Access date for all live URLs:** 2026-08-17 unless a paper date is given.

## How to read this

- Every factual claim is cited with URL + date. arXiv ids are preferred.
- `UNVERIFIED` means the claim is in circulation but I could not pin a primary source in this pass.
- Local-repro notes sit next to each system: kernel, license, weights, VRAM, dual R9700 / ROCm feasibility.
- Two papers share the name **CAD-Coder**. They are different. I keep them distinct throughout:
  - **CAD-Coder (Guan et al., NeurIPS 2025)** — text → CadQuery, Qwen2.5-7B + GRPO. [arXiv:2505.19713](https://arxiv.org/abs/2505.19713)
  - **CAD-Coder (Doris / Ahmed, MIT, 2025)** — image → CadQuery VLM, GenCAD-Code 163k. [arXiv:2505.14646](https://arxiv.org/abs/2505.14646)

---

## Executive snapshot

1. **Code-as-CAD is the 2025–2026 winner for LLM *generation***. CadQuery Python is the default output of CAD-Recode, cadrille, CAD-Coder (both), Text-to-CadQuery, Zero-to-CAD, CADSmith, CADCodeVerify, and Autodesk’s 1M synthetic pipeline. Command-sequence tokens (DeepCAD / Text2CAD / CAD-Llama) still own *reconstruction papers* and *editing papers*, but every 2026 “can an agent ship a part” system emits executable Python.
2. **On DeepCAD/Fusion360 reconstruction, cadrille (ICLR 2026) is the current leaderboard**: DeepCAD images IoU **92.2 / IR 0.0**, Fusion360 IoU **84.6 / IR 0.0**, after Dr.CPPO on a Qwen2-VL-2B. CAD-Recode (ICCV 2025) is the code-output ancestor. [arXiv:2505.22914](https://arxiv.org/abs/2505.22914)
3. **On *human-curated* text-to-CadQuery (Text2CAD-Bench, May 2026), frontier models beat every published specialist.** GPT-5.2 has the best L1 geometric CD; all models collapse on L3 (IR 68–92%). Fine-tunes trained on DeepCAD-style sketch-extrude (Text2CAD, Text2CADQuery) are near-useless on this bench. [arXiv:2605.18430](https://arxiv.org/html/2605.18430v1)
4. **The engineering pattern that actually moves numbers is execute → validate → repair.** Zero-to-CAD’s agentic loop (gpt-oss-120b + CadQuery tools) has **22.3% first-attempt success** and needs a median **3 attempts**. CADSmith’s kernel+VLM loop cuts mean Chamfer from **28.37 → 0.74**. Query2CAD’s visual loop lifts GPT-4 Turbo **53.6% → 76.7%**.
5. **Editing is not solved.** CAD-Editor (ICML 2025) is the first dedicated text-edit system, but it edits DeepCAD *command sequences*, not CadQuery, and is limited to ≤3 sketch-extrude pairs. CAD-Llama has add/delete on SPCC. CadQuery agents “edit” by rewriting the script. Nobody has a published, locally reproducible solver for “change this hole pattern on an existing Fusion/SW history.”
6. **Local on 2× Radeon AI PRO R9700 (32 GB each, 64 GB total) is not hypothetical.** Every published CAD specialist (1.5B–8B) fits on *one* card in BF16. The dual-card box is the right size for 32B Q4, 70B Q4 with layer-split, and gpt-oss-120b quantized. ROCm 7.2 + llama.cpp Vulkan is the 2026 practitioner stack on this exact SKU.

---

## 1. Representation wars

There is no single winner. There are two games, and they picked different representations.

### 1.1 The two games

| Game | Typical input | Typical output | Who is winning | Why |
|---|---|---|---|---|
| **Reconstruction / reverse-eng** | point cloud, multi-view, scan | sketch+extrude *or* CadQuery | cadrille / CAD-Recode (CadQuery) over DeepCAD tokens | executable code + IoU reward; 10× CD drop vs token models |
| **Agent / product CAD** | text, image, conversation | CadQuery, build123d, OpenSCAD, or KCL | CadQuery in papers; OpenSCAD + build123d in practitioner agents; KCL only at Zoo | compile+execute is a cheap verifier; Python rides LLM pretrain |

Evidence, not vibes:

- CAD-Recode (ICCV 2025) is explicit: “the first model to translate 3D point clouds into executable Python CAD scripts” and reports **10× lower Chamfer** and **>20% higher IoU** vs prior command-token methods on DeepCAD and Fusion360. Project page: [cad-recode.github.io](https://cad-recode.github.io/) (accessed 2026-08-17). Paper: [arXiv:2412.14042](https://arxiv.org/abs/2412.14042) (v2 2025-03-11).
- cadrille (ICLR 2026) adopts the same CadQuery target and states: “state-of-the-art results are obtained via mapping CAD sequences to casual Python code.” [arXiv:2505.22914v3](https://arxiv.org/html/2505.22914v3)
- CAD-Coder / Guan (NeurIPS 2025) lists four reasons to abandon command tokens: no geometric validation, sketch-extrude-only vocabulary, unreadable sequences, no reuse of pretrained Python LLMs. [arXiv:2505.19713](https://arxiv.org/html/2505.19713)
- Text2CAD-Bench (2026-05-18) adopts CadQuery because it “directly leverages LLMs’ code generation capabilities,” the chaining API “aligns with natural language,” it supports chamfer/fillet/sweep/loft, and “generated code is immediately executable.” [arXiv:2605.18430](https://arxiv.org/html/2605.18430v1)
- Zoo independently walked the same path: they started with direct text-to-B-rep, then switched to generating **KCL** because “LLMs were beginning to show accuracy in writing code.” Zookeeper (shipped Jan 2026) is an agent that writes/executes/debugs KCL against Zoo’s kernel. [zoo.dev/research/zookeeper](https://zoo.dev/research/zookeeper) (2026-02-05)
- Practitioner 2026: Brian Ratliff’s “Claude CAD” post (2026-05-17, 44k views) argues **build123d + CadQuery** beat packaged parametric CAD for agents because Claude reasons over code, diffs live in git, and collision checks are just more code. [x.com/BrierRat/status/2056116592938037398](https://x.com/BrierRat/status/2056116592938037398)
- Jake Fitzgerald’s `earthtojake/text-to-cad` (3k stars by May 2026; still growing) is a **skill harness**, not a new IR: Claude/Codex write CadQuery-class Python, execute, export STEP/STL/URDF. [github.com/earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad)

### 1.2 Scorecard by representation

**CadQuery (Python, OCCT).** Winning academic *and* open-agent target. Executable without a GUI (`pip install cadquery`). Fluent API. Full B-rep via Open CASCADE. Weakness: API surface is large and version-fragile (`.cone()` does not exist; fillet-before-solid is a classic crash). Text2CAD-Bench’s system prompt is mostly a list of those landmines. Local-repro: **yes**, LGPL kernel, no license server.

**build123d.** Same kernel as CadQuery, more “modern Python” (builder/context-manager style). Almost no published benchmark uses it. Practitioners (Ratliff, 2026-05) prefer it for agent editing. Local-repro: **yes**. Treat as CadQuery-adjacent, not a separate research line.

**OpenSCAD (CSG DSL).** Still the fastest *printable-solid* loop. Mitch (2026-08-10) restates the old truth: “The benefit of using OpenSCAD versus other 3D software like Blender is that it always makes a printable part.” OpenSCAD Studio (2026-08-11) ships Monaco + compiler diagnostics + Claude/GPT/local copilot + MCP. Local-repro: **yes**, including `openscad-wasm`. Weakness: CSG, not B-rep; fillets/lofts/shells are painful; no real construction history. GrandpaCAD (2026 blog, accessed 2026-08-17) argues they are *switching to* OpenSCAD for LLM generation because Blender/JSON IRs were worse. Treat as the 3D-print / hobby lane, not the mechanical-design lane.

**KCL (Zoo).** First-class design language with a modern kernel, conversational agent (Zookeeper, 2026-01), and explicit *edit* endpoints. Not independently benchmarked. Closed engine. Local-repro: **partial** — KCL is documented and the agent can be used in Zoo Design Studio, but you cannot run the kernel offline the way you run CadQuery. Do not bet a local patent-tooling stack on it unless Zoo is an accepted vendor.

**DeepCAD-style command tokens / sketch+extrude JSON.** Still the substrate of Text2CAD, CAD-Llama, CAD-Editor, FlexCAD, SkexGen, HNC-CAD. DeepCAD = 178,238 Onshape parts as quantized Line/Arc/Circle/Extrude tokens ([Wu, Xiao, Zheng, ICCV 2021](https://arxiv.org/abs/2105.09492)). Fusion 360 Gallery = 8,625 human sequences, same vocabulary ([Willis et al., TOG 2021](https://dl.acm.org/doi/10.1145/3450626.3459818)). These tokens are *easy to train on* and *hard to execute/validate*. CAD-Recode’s authors and CAD-Coder/Guan both treat this as a legacy IR. Use it when you need to train against DeepCAD numbers. Do not use it as the product IR.

**B-rep directly (SolidGen, BRepGen, HoLa, AutoBrep, BrepGPT, BrepCoder).** Research-live in 2026 (BrepCoder [arXiv:2602.22284](https://arxiv.org/pdf/2602.22284), BrepGPT cited in Zero-to-CAD). Outputs lack construction history. Zero-to-CAD: “While direct B-Rep methods produce valid geometry, their outputs lack construction histories, limiting downstream editability.” Local-repro: papers + some code; not an agent target.

**Sketch+extrude JSON (Text2CAD minimal JSON).** The annotation intermediate Xie & Ju used to *translate* DeepCAD → CadQuery with Gemini 2.0 Flash. Not a generation target. [arXiv:2505.06507](https://arxiv.org/html/2505.06507v1)

**Blender `bpy` / BlendNet.** BlendNet = 12k `<instruction, bpy>` pairs; BlenderLLM = Qwen2.5-Coder-7B SFT; CADBench = 500 sim + 200 real. [github.com/FreedomIntelligence/BlenderLLM](https://github.com/FreedomIntelligence/BlenderLLM) (dataset drop 2024-12-17). This is *mesh modeling*, not parametric CAD. Useful as a cautionary adjacent benchmark, not a mechanical IR.

### 1.3 Verdict

For a **2026 local build**: emit **CadQuery (or build123d) Python**, keep OpenSCAD as a *print-path fallback*, treat DeepCAD tokens as a *dataset*, treat B-rep as an *export*, treat KCL as a *vendor option*. That is what the last 18 months of papers and the 2026 practitioner posts independently converged on.

---

## 2. Benchmarks and leaderboards

Numbers below are copied from the cited papers. CD is almost always **×10³, median unless noted**. IoU is %. IR is invalidity %. **Do not compare CD across papers** — sampling, normalization, and invalid-sample handling differ.

### 2.1 Dataset map

| Dataset | Year | Size | Representation | Notes |
|---|---|---|---|---|
| ABC | 2019 | 1M+ | B-rep only | no history |
| SketchGraphs | 2020 | 15M+ | 2D sketch graphs | not 3D |
| DeepCAD | 2021 | 178,238 (≈115k after dedup) | sketch+extrude tokens | Onshape; still the default train set |
| Fusion 360 Gallery | 2021 | 8,625 | sketch+extrude | human, small |
| CC3D / CC3D-Ops | 2022 | 37k+ | B-rep + op labels | real scans exist |
| Text2CAD | 2024 | ~170k models, ~660k prompts L0–L3 | tokens + text | DeepCAD + Mistral/LLaVA captions |
| CAD-Recode synthetic | 2025 | 1M | CadQuery (sketch-extrude) | procedural; “readable: no” per Zero-to-CAD |
| GenCAD-Code | 2025 | 163k | image ↔ CadQuery | CAD-Coder/Doris |
| Zero-to-CAD 1M | 2026-04 | 999,633 | readable CadQuery | gpt-oss-120b agent; Apache-2.0 |
| Text2CAD-Bench | 2026-05 | 600 human | CadQuery | L1–L4; *not* DeepCAD |
| BenchCAD | 2026-05 | 17,900 | CadQuery | 106 industrial families; [arXiv:2605.10865](https://arxiv.org/html/2605.10865v1) |
| CadBench | 2026-05 | multimodal | programs | [arXiv:2605.10873](https://arxiv.org/html/2605.10873v1) |
| BlendNet / CADBench | 2024-12 | 12k / 700 | Blender `bpy` | not B-rep |

### 2.2 Reconstruction leaderboard (DeepCAD / Fusion360 / CC3D)

Source: cadrille Tables 1–3 and 6, [arXiv:2505.22914v3](https://arxiv.org/html/2505.22914v3) (revised 2026-02-17). Median CD ×10³.

**Multi-view images (cadrille Table 2):**

| Method | RL | DeepCAD CD / IoU / IR | Fusion360 CD / IoU / IR | CC3D CD / IoU / IR |
|---|---|---|---|---|
| CADCrafter | DPO | 0.26 / — / 3.6 | — | — |
| cadrille SFT | — | 0.18 / 86.1 / 1.5 | 0.20 / 77.6 / 3.2 | 0.81 / 56.1 / 7.7 |
| **cadrille Dr.CPPO** | **Dr.CPPO** | **0.17 / 92.2 / 0.0** | **0.17 / 84.6 / 0.0** | **0.57 / 65.0 / 0.1** |

**Point clouds (cadrille Table 3):**

| Method | DeepCAD CD / IoU / IR | Fusion360 CD / IoU / IR | CC3D CD / IoU / IR |
|---|---|---|---|
| CAD-SIGNet | 0.29 / 77.3 / 5.0 | 0.70 / 58.4 / 9.3 | 4.42 / 39.1 / 15.5 |
| CAD-Recode | 0.18 / 87.1 / 3.1 | 0.19 / 79.1 / 5.0 | 0.54 / 60.5 / 9.8 |
| cadrille SFT | 0.18 / 87.1 / 2.1 | 0.19 / 79.8 / 2.8 | 0.54 / 61.8 / 5.9 |
| **cadrille Dr.CPPO** | **0.17 / 90.2 / 0.0** | **0.17 / 85.0 / 0.2** | **0.47 / 67.9 / 0.2** |

**Text on DeepCAD (cadrille Table 1, no RL):**

| Method | median CD | IoU | IR |
|---|---|---|---|
| Text2CAD | 0.37 | 71.5 | 3.7 |
| CAD-Coder (Guan) | 0.33 | — | 5.3 |
| Text-to-CadQuery | 0.22 | — | 1.3 |
| cadrille (Dpit) | **0.21** | **81.1** | 1.4 |

**Mean CD on DeepCAD text (cadrille Table 6)** — this is where Guan’s GRPO number lives:

| Method | Mean CD ×10³ |
|---|---|
| BERT→DeepCAD | 97.9 |
| CAD-Coder SFT | 74.6 |
| Text2CAD | 26.4 |
| Text-to-CadQuery | 11.8 |
| CADFusion DPO | 19.9 |
| **CAD-Coder GRPO** | **6.54** |
| cadrille Dr.CPPO (images, not text) | 0.43 |

CAD-Recode project page (v1.5, 2025-03; [cad-recode.github.io](https://cad-recode.github.io/)): trained on 1M procedural CadQuery, **10× CD**, **+20 IoU** vs prior SOTA; Qwen2-1.5B + one linear point-cloud layer. GitHub: [filaPro/cad-recode](https://github.com/filaPro/cad-recode) (ICCV 2025).

CADEvolve (2026-02, [arXiv:2602.16317](https://arxiv.org/html/2602.16317v1)): evolutionary expansion to ~1.3M scripts covering loft/sweep/fillet/chamfer/shell/Boolean/patterns. Claims lower CD / higher IoU than cadrille when trained on the same RL set, at higher IR. **Gotcha:** HF release is embeddings only; public GitHub has 46 seed programs (BenchCAD’s audit). Treat numbers as paper-only until code is auditable.

### 2.3 Text-to-CAD (old DeepCAD-caption test)

**CAD-Coder / Guan Table 1** ([arXiv:2505.19713](https://arxiv.org/html/2505.19713), v3 2025-10-21). CD ×10³. Same Text2CAD test set. Zero-shot frontier models are *terrible* here because they are asked to emit CadQuery without the DeepCAD dialect:

| Method | Mean CD | Median CD | IR % |
|---|---|---|---|
| Claude-3.7-sonnet | 186.53 | 134.16 | 47.03 |
| GPT-4o | 133.52 | 45.91 | 93.00 |
| DeepSeek-V3 | 186.69 | 107.57 | 51.96 |
| Qwen2.5-72B | 209.41 | 153.81 | 82.64 |
| Qwen2.5-7B | 202.35 | 169.86 | 98.83 |
| Text2CAD | 29.29 | 0.37 | 3.75 |
| **CAD-Coder (SFT+CoT+GRPO)** | **6.54** | **0.17** | **1.45** |

Ablation on Qwen2.5-7B: SFT 74.55 / 0.33 / 5.33 → no-CoT GRPO 17.34 / 0.20 / 4.95 → full 6.54 / 0.17 / 1.45. 8k high-quality SFT beats 70k noisier SFT (6.54 vs 9.89).

**Text-to-CadQuery** ([arXiv:2505.06507](https://arxiv.org/html/2505.06507v1), 2025-05-10), 170k CadQuery annotations of Text2CAD, Gemini 2.0 Flash as JSON→code annotator (GPT-4o “>90% first-attempt executable” but 20× cost). Fine-tunes:

| Model | Params | Med CD ×10³ | Mean CD | IR | Gemini-2.0 “exact” |
|---|---|---|---|---|---|
| Text2CAD Transformer | 363M | 0.370 | 26.417 | 3.5 | 58.80% |
| CodeGPT-small SFT | 124M | 0.234 | 13.520 | 9.4 | 60.28% |
| Gemma-3-1B SFT | 1B | 0.204 | 11.609 | 8.4 | 66.86% |
| **Qwen2.5-3B SFT** | **3B** | **0.191** | **10.229** | 6.5 | **69.30%** |
| Mistral-7B LoRA | 7B | 0.219 | 11.835 | **1.32** | 65.38% |

They also fine-tuned GPT-4.1 mini on 10k and got **0% IR** with 7B-level accuracy. Scaling holds 124M→3B, then 7B under-trains.

**CAD-Llama-INS** (CVPR 2025, [arXiv:2505.04481](https://arxiv.org/html/2505.04481v2), LLaMA3-8B, SPCC code-like *command* IR): text-to-CAD ACC_T **84.72**, MCD 10.53 vs CAD-Translator 70.36 / 21.29 and GPT-4 20.39 / 32.56. Unconditional SR **99.90**. This is a different IR (SPCC, not CadQuery) and a different metric family. Do not stack it against Guan’s 6.54.

**Text2CAD original (NeurIPS 2024 Spotlight)** L3 expert: Line F1 81.1, Arc F1 36.0, Circle F1 74.3, Extrusion F1 93.3, median CD 0.37e-3, IR 0.9% ([Khan et al.](https://sadilkhan.github.io/text2cad-project/), [arXiv:2409.17106](https://arxiv.org/abs/2409.17106)). Arc F1 is the tell: even the paper that defined the task cannot draw arcs.

### 2.4 Text2CAD-Bench (the 2026 bench that actually hurts)

[arXiv:2605.18430](https://arxiv.org/html/2605.18430v1), 2026-05-18. **600 human-curated CadQuery** programs, L1 200 / L2 200 / L3 100 / L4 100. Dual prompts (geometric vs sequence). Up to **3 execute-and-retry** with compiler errors. CadQuery 2.4. This is the first bench that includes sweeps, lofts, freeform, and non-mechanical L4.

Columns below are **geometric-style prompts**: CD ×10³ / IR / IoU.

| Model | L1 CD / IR / IoU | L2 CD / IR / IoU | L3 CD / IR / IoU |
|---|---|---|---|
| **GPT-5.2** | **44.31 / 11.1% / 0.59** | **60.38 / 20.0% / 0.50** | 93.46 / 68.0% / 0.23 |
| Claude-4.5-Sonnet | 52.62 / 20.3% / 0.54 | 71.66 / 43.7% / 0.48 | **70.13 / 70.0% / 0.25** |
| DeepSeek-V3.2 | 53.15 / 13.3% / 0.54 | 79.03 / 22.3% / 0.42 | 101.23 / 69.0% / 0.17 |
| MiniMax M2.1 | 65.92 / 24.8% / 0.45 | 83.06 / 33.4% / 0.40 | 114.33 / 91.0% / 0.26 |
| GLM 4.7 | 67.50 / 13.7% / 0.44 | 88.57 / 26.3% / 0.35 | 92.70 / 83.0% / 0.25 |
| Gemini3-Flash | 66.82 / 17.7% / 0.44 | 88.57 / 12.8% / 0.35 | 91.61 / **12.8%** / 0.20 |
| Qwen3-max | 84.54 / 21.4% / 0.40 | 107.40 / 33.4% / 0.29 | 148.58 / 92.0% / 0.07 |
| Text2CAD | 219.57 / 11.0% / 0.08 | 260.92 / 6.0% / 0.04 | 234.00 / 2.0% / 0.04 |
| Text2CADQuery | 227.46 / 44.0% / 0.07 | 269.11 / 67.0% / 0.04 | 255.42 / 80.0% / 0.02 |

L4 (real-world apps, VLM judge 0–10, GLM-4.6V, 8 views): GPT-5.2 IR **61%**, overall ~8.17; Claude-4.5-Sonnet IR **54%**, overall ~8.23; Gemini3-Flash IR **17%** (executes) but quality scores ~3.5. Geometric prompts beat sequence prompts on L1–L2; the advantage flips on L3 for GPT-5.2 (seq CD 82.94 vs geo 93.46).

**Read this correctly:** specialist models trained on DeepCAD *fail this bench*. Frontier models *compile* simple parts and *fall apart* on topology. IR 70% on L3 with 3 retries is the 2026 reality, not a bug in the bench.

### 2.5 Other 2026 benches

**Zero-to-CAD image→CadQuery** ([arXiv:2604.24479](https://arxiv.org/abs/2604.24479), HF model card accessed 2026-08-17):

| Model | Z2C success / mean IoU | ABC (OOD) success / mean IoU |
|---|---|---|
| **Qwen3-VL-2B FT** | **82.1% / 0.747** | 61.0% / **0.377** |
| GPT-5.2 High | 72.2% / 0.485 | **66.2% / 0.344** |
| GPT-5.2 Medium | 71.1% / 0.495 | 62.6% / 0.346 |
| Qwen3-VL-2B base | 6.6% / 0.184 | 5.4% / 0.131 |

In-distribution, a 2B fine-tune beats GPT-5.2. OOD on ABC, GPT-5.2 executes more often; the 2B still wins IoU.

**CADSmith** 100-prompt hand-written CadQuery bench, Claude Sonnet + Opus judge, absolute-mm metrics ([arXiv:2603.26512](https://arxiv.org/html/2603.26512v1), 2026-03-27):

| Config | Exec | CDmed | CDmean | F1med | IoUmed |
|---|---|---|---|---|---|
| Zero-shot Sonnet | 95% | 0.55 | 28.37 | 0.9707 | 0.8085 |
| Full pipeline (kernel + 3-view VLM) | **100%** | 0.48 | **0.74** | **0.9846** | **0.9629** |

88/100 pass on iteration 0; mean 0.13 refine iterations. T3 F1med 0.886. Removing vision blows T3 mean CD from 1.42 → 49.68.

**CADCodeVerify / CADPrompt** (200 DeepCAD objects, CadQuery; [arXiv:2410.05340v2](https://arxiv.org/html/2410.05340v2), 2025-02-28). GPT-4 few-shot compile **96.0%**; CADCodeVerify: **−7.30% point-cloud distance, +5.5% compile** vs prior. Gemini 1.5 compile 85%. CodeLlama much weaker; they had to use GPT-4 as the visual critic.

**Query2CAD** 57 FreeCAD-macro prompts ([arXiv:2406.00144](https://arxiv.org/abs/2406.00144)): GPT-4 Turbo **53.6% → 73.2% → 76.7%** across 0/1/2 refine steps (3rd step is flat). Easy 95.23%, medium 70%, hard 41%. GPT-3.5: 32.7% → 53.4%. Failures: ~69% never got executable code.

**CAD-Editor** (ICML 2025, [arXiv:2502.03997](https://arxiv.org/abs/2502.03997)): first text-edit bench on DeepCAD SE sequences. CAD-Editor valid ratio **95.6%** vs GPT-4o-IC 84.5 / GPT-4o-basic 63.2 / FlexCAD 84.8 / Text2CAD 82.1 (generation-only baselines). CD 1.18, D-CLIP 0.11 (×10²). Limited to ≤3 SE pairs.

**CadBench** ([arXiv:2605.10873](https://arxiv.org/html/2605.10873v1)): under clean image inputs, Claude Opus 4.7 highest aggregate IoU, Gemini 3.1 Pro lowest CD, CAD-Coder (Doris) highest surface-IoU and valid-shape rate among image-conditioned methods. Qwen models often fail to emit valid CAD. Kimi K2.6 beats GPT 5.4 on two geometric metrics. Mesh-conditioned CADFit is a different task (near-perfect VSR).

**BenchCAD** ([arXiv:2605.10865](https://arxiv.org/html/2605.10865v1)): 17,900 executable CadQuery across 106 industrial families; includes a **Code Edit** track. Best survey of *operation coverage* of public corpora. CAD-Recode/cadrille ops saturate after ~200 files (narrow sketch-extrude). Zero-to-CAD / BenchCAD itself are the first broad-op public sets.

**BlendNet / BlenderLLM CADBench:** 500 sim + 200 real `bpy` tasks. Adjacent, not CAD.

**OpenSCAD Pantheon** (ModelRift, 2026-05-21): informal 6-tool bake-off. Cursor Composer fastest and *worst* (1.4/5). Not a scientific bench. [modelrift.com/blog/openscad-llm-benchmark](https://modelrift.com/blog/openscad-llm-benchmark/)

**P3D-Bench** [arXiv:2606.11152](https://arxiv.org/html/2606.11152v2), **Op-CAD** (ICML 2026 poster), **CodeGen-3D** (100 prompts, 8 LLMs + self-correcting agent) exist; I did not extract full tables in this pass. `UNVERIFIED` pending a dedicated scrape.

**Grok:** no published CadQuery/OpenSCAD numbered eval as of 2026-08-17. A Grok reply (2026-08-14) claims Claude can generate OpenSCAD/CadQuery; that is not an eval. [x.com/grok/status/2088405474349580663](https://x.com/grok/status/2088405474349580663)

### 2.6 Who “tops” what (one-liners)

| Bench | Current top (as of sources above) |
|---|---|
| DeepCAD / Fusion360 / CC3D reconstruction | **cadrille Dr.CPPO** (Qwen2-VL-2B) |
| Text2CAD official test, CadQuery CD | **CAD-Coder Guan GRPO** (Qwen2.5-7B) |
| Text2CAD official test, command ACC | **CAD-Llama-INS** (LLaMA3-8B, different IR) |
| Text2CAD-Bench L1–L2 (2026, human) | **GPT-5.2** (Claude-4.5 close; Gemini-Flash lowest IR) |
| Text2CAD-Bench L3 | nobody — IR 68–92% |
| Image→CadQuery in-dist (Zero-to-CAD) | **Qwen3-VL-2B FT** > GPT-5.2 |
| Image→CadQuery OOD ABC | GPT-5.2 executes more; 2B wins IoU |
| Agentic CadQuery (CADSmith 100) | Claude Sonnet + Opus judge loop |
| Text edit of SE sequences | **CAD-Editor** (LLaMA3-8B) |
| Image→CadQuery syntax | **CAD-Coder Doris** (100% valid syntax vs GPT-4.5 / Qwen2.5-VL-72B) |

---

## 3. Frontier models on CAD code

Published, numbered evals only.

### 3.1 What the papers actually measured

**GPT-5.2** is the 2026 default “strongest generalist on CadQuery”:
- Text2CAD-Bench L1 geo: CD 44.31, IR 11.1%, IoU 0.59. Best overall on L1–L2.
- Zero-to-CAD image→code: 72.2% success, mean IoU 0.485 (loses to a 2B specialist in-dist).
- CadBench image-conditioned: not uniformly dominant (Kimi K2.6 / Gemini 3.1 Pro / Claude Opus 4.7 split metrics).

**Claude-4.5-Sonnet** (Text2CAD-Bench): slightly worse CD than GPT-5.2 on L1–L2, *better* L3 geo CD (70.13 vs 93.46), worse IR (70%). L4 judge overall 8.23 vs GPT-5.2 8.17. CADSmith’s *generator* is Claude Sonnet; the *judge* is Claude Opus — that split is the paper’s point (avoid self-confirmation).

**Claude-3.7-sonnet** (Guan 2025, DeepCAD-style test, no loop): mean CD 186.53, IR 47%. Worthless one-shot on that distribution.

**GPT-4o** (Guan 2025): mean CD 133.52, **IR 93%** — it talks CadQuery and does not compile. cadrille Table 7: single-image DeepCAD, GPT-4o CD 62.6, IR **64.4%**. CAD-Editor: GPT-4o-basic VR 63.2%, GPT-4o-IC 84.5% vs CAD-Editor 95.6%.

**GPT-4 / GPT-4 Turbo** (CADCodeVerify, Query2CAD, 2024–25): best *then*. CADPrompt few-shot compile 96%. Query2CAD 53.6%→76.7% with visual refine. Still the paper that established “GPT-4 is the CAD VLM.”

**GPT-o4-mini** (cadrille Table 8, 4 orthogonal views + ICP): DeepCAD CD 2.37, IoU 60.4, IR 15.9 vs cadrille 0.17 / 92.2 / 0.0.

**Gemini 1.5** (CADCodeVerify): compile 85%, worse geometry than GPT-4.

**Gemini 2.0 Flash** (Text-to-CadQuery annotator): chosen for JSON→CadQuery at scale; GPT-4o more accurate, 20× cost. Not a generation leaderboard entry.

**Gemini 3 Flash / 3.1 Pro:** Text2CAD-Bench Gemini3-Flash has the **lowest L2–L3 IR** among frontier (12.8% on L3 geo — so low I flag a possible table-alignment issue in the HTML extract; treat as `UNVERIFIED` until the PDF is re-read). CadBench: Gemini 3.1 Pro lowest CD among image-conditioned.

**DeepSeek-V3 / V3.2:** Guan 2025 IR 52%; Text2CAD-Bench 2026 sits just behind GPT-5.2/Claude on L1.

**Qwen3-max:** Text2CAD-Bench L3 IR 92%. Not a CAD model.

**Grok:** no numbered public CadQuery/OpenSCAD eval found. `UNVERIFIED` / absent.

### 3.2 The honest frontier ranking for a *local-adjacent* 2026 build

If you are calling an API as the *coder* in a loop (CadQuery + execute + screenshot):

1. **GPT-5.2 or Claude 4.5 Sonnet** — pick GPT-5.2 for L1–L2 fidelity, Claude if you already have an Anthropic harness (CADSmith, earthtojake, Ratliff).
2. **Use a stronger, different model as the vision judge** (CADSmith: Opus judges Sonnet). Same-model self-critique is the known failure mode (Pan et al. survey; CADSmith cites it).
3. **Do not use a specialist DeepCAD fine-tune as the coder on real prompts.** Text2CAD-Bench killed that idea.
4. **Do use a 2B–7B specialist as the *reconstructor*** (image/point → code) and keep the frontier model for language, planning, and repair.

---

## 4. Local / open-weight CAD models

### 4.1 Inventory (weights you can actually download)

| Model | Base | Task | Size on disk / VRAM (BF16) | License | Where |
|---|---|---|---|---|---|
| **CAD-Recode** | Qwen2-1.5B + 1 linear | point cloud → CadQuery | ~3 GB / ~4 GB | research code | [filaPro/cad-recode](https://github.com/filaPro/cad-recode) |
| **cadrille** | Qwen2-VL-2B | pc / images / text → CadQuery | ~4 GB / ~6 GB | code public | [col14m/cadrille](https://github.com/col14m/cadrille) (ICLR 2026) |
| **Zero-To-CAD-Qwen3-VL-2B** | Qwen3-VL-2B-Instruct | 8-view image → CadQuery | 2B BF16 ~4 GB | Apache-2.0 | [ADSKAILab/Zero-To-CAD-Qwen3-VL-2B](https://huggingface.co/ADSKAILab/Zero-To-CAD-Qwen3-VL-2B) |
| **CAD-Coder (Guan)** | Qwen2.5-7B-Instruct | text → CadQuery + CoT | HF “8B params” BF16 ~16 GB | Apache-2.0 | [gudo7208/CAD-Coder](https://huggingface.co/gudo7208/CAD-Coder) |
| **Text-to-CadQuery suite** | 124M–7B | text → CadQuery | 0.3–14 GB | research | [Text-to-CadQuery/Text-to-CadQuery](https://github.com/Text-to-CadQuery/Text-to-CadQuery) |
| **CAD-Llama / CAD-Llama-INS** | LLaMA3-8B | SPCC tokens, + edit tasks | ~16 GB | research | CVPR 2025; weights `UNVERIFIED` on HF in this pass |
| **CAD-Editor** | LLaMA3-8B-Instruct LoRA | text edit of SE sequences | 16 GB + LoRA | [microsoft/CAD-Editor](https://github.com/microsoft/CAD-Editor) | |
| **CAD-Coder (Doris/MIT)** | VLM (Qwen-VL / LLaVA family) | image → CadQuery | 7B-class ~16–24 GB (if 7B); 72B does not fit | [anniedoris/CAD-Coder](https://github.com/anniedoris/CAD-Coder) | 100% syntax on their subset |
| **BlenderLLM** | Qwen2.5-Coder-7B | instruction → `bpy` | ~16 GB | research | [FreedomIntelligence/BlenderLLM](https://github.com/FreedomIntelligence/BlenderLLM) |
| **gpt-oss-120b** | OpenAI OSS MoE | used *as the synthesizer* in Zero-to-CAD, not a CAD FT | Q4 ~60–70 GB `UNVERIFIED` exact | Apache-2.0 | ran locally at Autodesk to make the 1M set |

Datasets (not models, but local-repro gold):
- [ADSKAILab/Zero-To-CAD-1m](https://huggingface.co/datasets/ADSKAILab/Zero-To-CAD-1m) and 100k subset, Apache-2.0, arXiv:2604.24479.
- Text2CAD annotations + 170k CadQuery (Xie & Ju).
- GenCAD-Code 163k (Doris).

### 4.2 Dual Radeon AI PRO R9700 (32+32 = 64 GB) under ROCm — concrete

Hardware is real and already used for local LLMs in 2026: dual R9700 writeups (llama.cpp Vulkan + vLLM/ROCm 7 Docker) exist as of Dec 2025–Jun 2026. RDNA4 / gfx1201. ROCm 7.2 is the first line with official RDNA4 + “Ollama / LM Studio / llama.cpp / vLLM parity” ([localaimaster.com, 2026-05-01, updated 2026-06](https://localaimaster.com/blog/amd-rocm-local-llm-setup)). Practitioner consensus on this exact SKU: **llama.cpp Vulkan layer-split is faster and less cursed than vLLM tensor-parallel on dual R9700**; vLLM TP on non-CUDA is still rough ([Level1Techs, 2026-05-12](https://forum.level1techs.com/t/dual-r9700s-amd-vllm-container-woes/250053); [llama.cpp #19890](https://github.com/ggml-org/llama.cpp/discussions/19890)).

| Workload | Fits? | How |
|---|---|---|
| CAD-Recode 1.5B, cadrille 2B, Zero-to-CAD 2B, Text-to-CadQuery ≤3B | **Yes, one card, BF16, lots of headroom** | Leave the other card for CadQuery/OCCT meshing + VTK renders |
| CAD-Coder Guan 7B, CAD-Llama 8B, CAD-Editor 8B, BlenderLLM 7B | **Yes, one card BF16** (~14–18 GB + KV). Comfortable. | Same split: GPU0 model, GPU1 unused or render |
| Qwen2.5-VL-7B / Qwen3-VL-8B as a local VLM judge | **Yes, one card** | 16–24 GB typical |
| Qwen2.5-Coder-32B / Qwen3-32B coder | **Yes, Q4 or Q5 on one 32 GB card; Q8 or BF16 needs both** | Prefer llama.cpp Vulkan `-ngl` + layer split |
| LLaMA-3.1/3.3 70B Q4 | **Yes, both cards, tight** | ~38–40 GB weights + KV. Layer-split, not TP |
| gpt-oss-120b Q4 (Zero-to-CAD’s synthesizer) | **Maybe** | MoE Q4 often quoted ~60–70 GB. Dual 64 GB is the cutoff. Expect to drop context or quant. `UNVERIFIED` exact GGUF size |
| Qwen2.5-VL-72B judge (Doris’s baseline) | **No in BF16; Q3/Q4 maybe with pain** | Don’t. Call a frontier VLM or use a 7B/32B judge |
| Train cadrille-style GRPO | **No** | Papers used 8×A800 80 GB (Guan) or 16×H100 (Zero-to-CAD). Infer only. |

**CadQuery / OCCT itself is CPU.** The 64 GB VRAM is for the LLM/VLM. Budget RAM for OCCT tessellation on L3 parts separately.

**Feasible local stack on this box, today:**

1. GPU0: Qwen3-VL-2B Zero-to-CAD (image→code) *or* cadrille 2B (pc/image/text→code).
2. GPU0 or GPU1: Qwen2.5-7B CAD-Coder Guan (text→code) if you want a specialist coder; otherwise skip it and use a 32B general coder.
3. GPU1: 32B Q4 general coder (Qwen3-Coder / gpt-oss-20b / similar) as the *repair* model, **or** a 7B VLM judge.
4. CPU: CadQuery 2.4/2.5 sandbox, OCCT validity, bbox/volume, VTK three-view PNG.
5. Optional API: Claude/GPT-5.2 as planner + judge only (keeps pre-publication geometry on-box if you render locally and send *metrics*, not STEP). For Oppold-class material, stay fully local.

---

## 5. The self-correction loop (the actual product)

This is the only pattern that has been shown, repeatedly, to turn “LLM wrote CadQuery” into “a solid came out.”

### 5.1 Anatomy — four layers, not one

Almost every working system is the same state machine. Papers rename the boxes.

```
prompt → plan? → emit code → EXECUTE
                      ↑           │
                      │     compile / OCCT error? ── inner loop (3 tries)
                      │           │
                      │     valid solid?
                      │           │
                      │     KERNEL METRICS (bbox, volume, faces, watertight)
                      │           │
                      │     RENDER 3–8 views
                      │           │
                      │     VLM / Q-A critique ── outer loop (2–5 tries)
                      │           │
                      └── refine code ← structured diff (not “try again”)
```

**Layer A — compiler / interpreter.** Cheap, exact, local. CadQuery exceptions, missing methods, non-closed wires, fillet-radius > feature. CADCodeVerify Eq. 2; Query2CAD “error refinement”; CADSmith inner loop (3×); Text2CAD-Bench 3 retries; Zero-to-CAD `execute_and_validate` (3.80M calls to make 1M accepts).

**Layer B — kernel geometry.** Not an image. OCCT: `isValid`, bbox mm, volume, COM, face/edge/vertex counts, watertight. CADSmith’s entire point. Zero-to-CAD “multi-stage geometric validation.” cadrille / Guan *training* reward is the offline cousin (IoU / CD / invalidity). Query2CAD did **not** have this layer and could not fix millimeters.

**Layer C — visual critique.** Screenshots from several calibrated views. Implementations:
- CADCodeVerify: VLM *writes 2–5 yes/no questions from the spec*, then *answers them from 0/90/180/270° renders*, then writes a repair brief. +5.5% compile, −7.3% PC distance on GPT-4.
- Query2CAD: BLIP-2 caption + VQAScore threshold 0.9; human override because BLIP-2 is a weak critic. First refine is the only one that matters (+19.6 pp).
- CADSmith: independent stronger VLM (Opus) sees three Phong views *plus* kernel numbers. Vision ablation destroys T3 (CD 1.42 → 49.68).
- Zero-to-CAD: docs lookup (`lookup_documentation` 375k, `grep_documentation` 133k) as a *textual* critic when compile fails — no VLM in the synthesizer loop.

**Layer D — retrieval / API grounding.** CADSmith KB1 = 155 CadQuery methods + pitfalls; KB2 = 25 error→fix patterns. Zero-to-CAD documentation tools. earthtojake skills = the same idea as markdown the agent must read. This is how you avoid fine-tuning every time CadQuery ships a breaking change.

### 5.2 What the numbers say about loops

| System | Loop | Measured lift |
|---|---|---|
| Query2CAD GPT-4 Turbo | error + BLIP-2 caption, 3× | 53.6 → 76.7% success; Δ mostly on step 1 |
| CADCodeVerify GPT-4 | compiler + Q/A visual | −7.3% PC dist, +5.5% compile |
| CADSmith Claude | compiler 3× + kernel + 3-view Opus, 5× | exec 95→100%; mean CD 28.37→0.74 (38×) |
| Zero-to-CAD gpt-oss-120b | execute + docs, unbounded-ish | first-try **22.3%**; median 3 attempts; 4.34 tool calls/convo |
| cadrille Dr.CPPO | *train-time* IoU+invalid reward | IR 1.5→**0.0**, IoU 86.1→**92.2** (images, DeepCAD) |
| CAD-Coder Guan GRPO | *train-time* CD + format | mean CD 74.55→**6.54** |
| Text2CAD-Bench | 3 compiler retries only | still L3 IR 68–92% — **retries do not invent topology** |

Zero-to-CAD is the cleanest “loops are not optional” result: an Apache-2.0 120B, given tools, still fails **77.7%** of first attempts and burns **60.2B tokens processed** to accept 999,633 programs (5.59B generated). They converted compute into a dataset so a 2B model can be one-shot later.

### 5.3 Design rules that papers agree on

1. **Separate the judge from the coder.** CADSmith (Opus ≠ Sonnet). CADCodeVerify’s Q/A is a structured judge even when the same GPT-4 plays both roles — the *questions* are the separation. Single-model “does this look right?” is the failure mode Query2CAD documented with BLIP-2.
2. **First repair is most of the gain.** Query2CAD Figure 4; CADSmith 88/100 pass at iter 0 and only 12 need 1–2 more. Budget 1–2 outer loops, not 10.
3. **Kernel numbers first, pictures second.** Vision without millimeters cannot place a 6.5 mm hole. Millimeters without vision accept the CADSmith quadcopter-frame (F1 0.963, gaps at the hubs).
4. **Train-time RL and test-time loops are complements.** cadrille IR 0.0 is a *policy* that stopped emitting unparseable Python. It does not know your 80×50×30 enclosure. You still need the test-time loop for the user’s part.
5. **Docs-as-a-tool beats freezing an API in weights.** Zero-to-CAD and CADSmith both retrieve CadQuery docs at repair time. Guan’s 7B will drift when CadQuery 2.6/2.8 changes selectors.
6. **Escalation after repeated failure.** CADSmith iter≥3: “try a different construction, not another 0.1 mm tweak.”

### 5.4 What a local implementation looks like (no new research)

Sandbox: subprocess, 30–60 s, no network, CadQuery 2.4/2.5 pinned.
On success: STEP + STL + OCCT report JSON.
On exception: traceback → error-refiner with KB2.
On valid-but-wrong: three VTK views (iso / high-rear / front) + bbox deltas → VLM judge → refiner with history.
Stop: judge pass **or** 2 outer iters **or** solid invalid after 3 inner.
Log every (code, traceback, metrics, views) — that log is the next SFT set (Zero-to-CAD’s actual contribution).

earthtojake/text-to-cad (2026-05-20 release: mechanism validation, STEP animations, SDF/SRDF/URDF) is this harness as a Claude/Codex skill, not a paper. [x.com/earthtojake/status/2057203608207466982](https://x.com/earthtojake/status/2057203608207466982)

---

## 6. Parametric editing vs generate-from-scratch

**Nobody has solved industrial editing.** Several groups have solved *a* narrower edit problem.

### 6.1 What exists

| System | Edits what | How | Evidence it works | Local? |
|---|---|---|---|---|
| **CAD-Editor** (Microsoft, ICML 2025) | DeepCAD SE token string | locate `<mask>` then infill; LLaMA3-8B LoRA | VR 95.6%; beats GPT-4o-IC; iterative multi-turn in fig. 10 | yes, GitHub |
| **CAD-Llama-INS** | SPCC / CAD code | instruction-tuned add / delete / complete / caption | deletion\* EM jumps +24 pp after SPCC captioning; GPT-4 wins delete-with-SPCC, loses add | research |
| **FlexCAD / HNC / SkexGen** | SE tokens | random variation, not text-conditioned | baselines in CAD-Editor; no instruction following | yes |
| **CAD-Coder Guan app. E** | CadQuery | qualitative “simple edits” | figures only, no edit bench | 7B weights yes |
| **Zoo Text-to-CAD + Zookeeper** | KCL | dedicated iterate endpoints + agent tools (snapshots, mass, volume) | product, no public numbers | vendor |
| **earthtojake / Claude CAD / OpenSCAD Studio** | the `.py` / `.scad` file | agent edits source; git is the history | practitioner, 2026 | yes |
| **CADSmith / Query2CAD** | start over each refine | rewrite whole script from feedback | not “edit an existing model” | yes |

CAD-Editor is the only paper that *formulates* text-based CAD editing, synthesizes (orig, instruction, edited) triplets (HNC-CAD variations + GPT-4o/LLaMA-3-70B captions), and decomposes locate vs infill. Limits they state: DeepCAD long-tail forced them to **≤3 sketch-extrude pairs**; LVLMs are expensive; long contexts break on real parts. Fusion 360 transfer is better than GPT-4o but still a toy relative to a SW feature tree.

CAD-Llama’s addition/deletion is the other academic edit surface. It needs SPCC (hierarchical captions). Raw command strings do not edit well; that is the ablation.

### 6.2 The product problem vs the paper problem

Papers edit **the representation they generate**. If you generated CadQuery, “edit” = change the Python and re-run. That is *easy* for agents (Ratliff 2026-05; earthtojake) and *unsolved* as a *learned, constrained* edit that preserves design intent on someone else’s history.

Hard problems that remain open (and will bite a patent-figure / docket tool):

1. **Foreign history.** STEP-in, no sketches. Zoo’s 2026 roadmap literally lists “reverse engineer STEP/STL into KCL.” Zero-to-CAD / cadrille are the open analog (image/pc → new CadQuery), not an edit of the source feature tree.
2. **Constraint preservation.** “Move this hole, keep the pattern, keep the mate.” No published CadQuery system does mates. Text2CAD-Bench future-work says this out loud.
3. **Long histories.** CAD-Editor’s ≤3 SE cap is not a footnote; DeepCAD is 91% ≤3 SE.
4. **Intent vs geometry.** BenchCAD’s 2026 paper title-adjacent claim: “Wrong Design Intent Is Worse Than None” ([arXiv:2607.23191](https://arxiv.org/pdf/2607.23191)). A successful Chamfer edit can still be the wrong feature.

### 6.3 Who has “solved” editing?

- **Solved for greenfield code CAD:** any competent agent + git + CadQuery. This is 2026 practice, not a paper.
- **Solved for short DeepCAD sequences + text:** CAD-Editor, with the caveats above.
- **Solved for KCL inside Zoo:** Zookeeper, closed, no numbers.
- **Unsolved for Onshape/SW/Fusion histories, assemblies, drawings.**

If the build is “agent writes and revises *our* CadQuery,” you do not need CAD-Editor. If the build is “edit the client’s existing parametric model,” you need reverse-eng (cadrille / Zero-to-CAD) *then* code-level edit, and you should not claim the original history is preserved.

---

## 7. Practitioner signal (X / labs, 2026)

| Date | Who | Signal |
|---|---|---|
| 2026-02-09 | Marco Franzon [@mfranz_on](https://x.com/mfranz_on/status/2020988721940640214) | CadQuery as “Time to make AgenticPyCAD” |
| 2026-04-24 | 許文彥 | Codex + [earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad) from a YouTube thumbnail; “not perfect… <30 min, almost no intervention” |
| 2026-04-27 / 05-02 | Mehdi Ataei [@AtaeiMe](https://x.com/AtaeiMe/status/2050686754542284930) (ex-Autodesk Research, now NVIDIA) | **Zero-To-CAD live on HF**: gpt-oss-120b agentic CadQuery loop, 1M/100k, readable history |
| 2026-05-17 | Brian Ratliff [@BrierRat](https://x.com/BrierRat/status/2056116592938037398) | Claude + MCP CAD viewer + build123d/CadQuery; “scripted parametric CAD is fundamentally different”; 44k views |
| 2026-05-20 | Jake Fitzgerald [@earthtojake](https://x.com/earthtojake/status/2057203608207466982) | text-to-cad 3k★: mechanism validation, STEP params/animations, SDF/SRDF/URDF |
| 2026-08-10 | Mitch [@mitchellhynes](https://x.com/mitchellhynes/status/2086743998476001641) | 2023 OpenSCAD vibecoding; “OpenCode+OpenSCAD REPL would go so hard with today’s vision” |
| 2026-08-11 | Dan Kornas | OpenSCAD Studio: compiler diagnostics + Claude/GPT/local + MCP |
| 2026-08-14 | File Format | 2026 open CAD API list (OCCT, FreeCAD, CadQuery, build123d, OpenSCAD, CGAL) |
| 2026-08-16 | Maki / Sunwood | **Qwen3.8-27B** (free HF endpoint) → CadQuery → STEP read-back, 3/3 VALID solids |
| 2026-08-16 | techMellouk | “cadrille … ICLR 2026. code is up” + “CadQuery is still the fastest way to get a parametric solid” |
| 2026-01 / 02 | Zoo [@zoodotdev](https://zoo.dev/research/zookeeper) | Zookeeper GA in Design Studio v1.1; KCL agent with engine tools; roadmap: images, STEP reverse-eng, agent fleets |

Labs are announcing **datasets and harnesses** on X (Zero-to-CAD, earthtojake), not new IRs. The street consensus in Aug 2026 is: *frontier or 27B coder + CadQuery + execute + look at it*. Mesh generators are dismissed as “SD 1.4-ish” for hard-surface parts (Orwelian84, 2026-08-17).

---

## 8. Bet: representation + loop architecture for a 2026 local build

**Representation.** CadQuery Python (pin 2.4 or 2.5), OCCT kernel, STEP as interchange, STL only for preview/print. Offer build123d as a thin alternative style, same kernel. Keep OpenSCAD as a *print-only* backend. Do not emit DeepCAD tokens except as a translator target. Do not depend on KCL unless Zoo is in the vendor stack.

Why: every 2025–2026 system that reports both *executability* and *editability* landed here (CAD-Recode, cadrille, both CAD-Coders, Text-to-CadQuery, Zero-to-CAD, CADSmith, CADCodeVerify, earthtojake, Ratliff). Command tokens win reconstruction *training* but lose the agent loop. B-rep generation still has no history.

**Models on 2×R9700.**

- **Reconstructor (optional):** `ADSKAILab/Zero-To-CAD-Qwen3-VL-2B` or cadrille 2B on GPU0. Use when the input is a figure, photo, or scan.
- **Coder:** do *not* ship Guan 7B as the only coder — Text2CAD-Bench showed DeepCAD specialists die on real geometry. Use a general 32B Q4 (or gpt-oss if it fits) locally, and/or a frontier API if the session is not client-confidential.
- **Judge:** different, preferably stronger, VLM. Local: Qwen2.5-VL-7B / Qwen3-VL-8B. Confidential-off: Claude Opus / GPT-5.2 vision on *renders + metrics only*.
- **Do not fine-tune first.** CADSmith’s RAG-over-docs result is the 2026 lesson: the API moves; weights don’t.

**Loop (this is the product).**

1. Planner → structured spec (bbox mm, feature list, datums). CADSmith JSON plan.
2. Coder + CadQuery docs RAG (CADSmith KB1 / Zero-to-CAD lookup).
3. Inner: execute in a sandbox, 3× traceback repair (KB2).
4. Kernel report: valid / watertight / bbox / volume / counts.
5. Three-view render (iso, high-rear, front). CADCodeVerify-style *generated questions* from the spec, answered from the views, plus kernel deltas.
6. Outer: at most 2 refines; iter 2 escalates construction strategy.
7. Persist `(prompt, spec, code, metrics, views, verdict)` as the next SFT/GRPO set — Zero-to-CAD’s move.

**Edit policy.** Greenfield: rewrite CadQuery, git is history. Incoming STEP/drawing: reconstruct with Zero-to-CAD/cadrille, *then* edit the new script. Do not promise feature-tree fidelity. If you need locate-then-infill later, start from CAD-Editor’s decomposition but retarget it at CadQuery ASTs, not SE tokens.

**Evidence this is the right bet:** CADSmith’s 38× mean-CD drop; Zero-to-CAD’s 22%→accept-via-loop then 2B > GPT-5.2 in-dist; cadrille IR 0.0 from an IoU+invalid reward; Text2CAD-Bench proving frontier+retries still cannot do L3 *without* better tools; Zoo independently reinventing the same agent (write KCL, execute, snapshot, measure).

---

## 9. Honest failure-mode list

Where LLM→CAD reliably breaks, with citations.

1. **It compiles and is the wrong part.** Query2CAD: 31% of GPT-4 failures were wrong structure, not exceptions. CADSmith T3_019: F1 0.963, IoU 0.985, *gaps at the joints*, judge said pass. Kernel+3 views are not a CMM.

2. **Topology, not primitives.** Text2CAD-Bench L1 IoU ~0.55–0.59 → L3 IoU ~0.23 and IR 68–92% *with 3 retries*. Sweeps, lofts, shells, workplane changes are the cliff. DeepCAD-trained models never saw them (BenchCAD op-saturation after 200 files).

3. **Arcs and fillets.** Text2CAD L3 Arc F1 **36%**. CADSmith KB2 exists because fillet-radius > adjacent feature is the #1 OCCT crash. CadQuery `.fillet()` before a solid is a rite of passage (Text2CAD-Bench system prompt).

4. **Selectors / workplanes.** BenchCAD F05: `.faces(">Y")` on a Z-up part; OR-selectors returning the wrong subset. This is the CadQuery-specific analog of “off-by-one.” Agents guess a selector, the boolean silently eats the wrong face.

5. **API hallucination.** No `.cone()`, no `.array()` (it’s `.rarray` / `.polarArray`). Guan’s zero-shot GPT-4o IR 93% on CadQuery is this. Docs RAG exists because of this.

6. **First-attempt success is ~20–50%, not 90%.** Zero-to-CAD 22.3% even with tools. Query2CAD GPT-4 53.6%. CADSmith zero-shot 95% *executes* but mean CD 28.37 — execute ≠ correct.

7. **Retries do not create missing features.** Query2CAD: step 2–3 are flat. Text2CAD-Bench 3 retries still L3 IR ~70%. The model that omitted a bolt circle will polish the hub.

8. **Same-model visual self-check lies.** Query2CAD BLIP-2 needed humans. CADSmith required a *stronger independent* judge and *still* missed T3_019. CADCodeVerify’s structured Q/A is the minimum viable critic.

9. **Normalized metrics hide dimensional error.** CADSmith’s whole methodology section. A 10 mm box and a 100 mm box can share IoU after unit-cube normalize. Patent figures care about millimeters.

10. **Distribution lock-in.** Text2CAD / Text2CADQuery crater on Text2CAD-Bench (CD 220–270). Guan’s 6.54 is on *the same family they trained on*. Zero-to-CAD 2B beats GPT-5.2 in-dist and loses ABC success rate. Fine-tunes memorize a dialect.

11. **Unreadable synthetic code is not editable.** Zero-to-CAD’s critique of CAD-Recode: procedural CadQuery with generic ids and magic numbers. You can execute it; a human cannot maintain it. If the product is a docket artifact, require named parameters in the coder prompt (Zero-to-CAD’s “19 design principles”).

12. **Long / multi-body / assemblies.** CAD-Editor ≤3 SE. Zero-to-CAD 4k context, “complex multi-part assemblies may exceed.” Text2CAD-Bench L4 IR 54–62% on *single* real-world parts. Mates, BOM, drawings: future work in every 2026 paper.

13. **B-rep without history is a dead end for iteration.** Stated by Zoo and Zero-to-CAD. Generating a pretty STEP you cannot parametrically edit is image-to-3D with extra steps.

14. **Foreign CAD in.** ABC OOD already drops Zero-to-CAD 82%→61% success. A scanned invention disclosure or a client STEP is worse. Reverse-eng ≠ edit.

15. **VLM judges are view-starved.** Three fixed cameras miss joint gaps (CADSmith). Four yaw angles (CADCodeVerify) miss underside pockets. Need adaptive cameras or section views.

16. **Non-manifold / open shells that still tessellate.** STL can look fine; STEP import fails downstream. CADSmith hard-fails `isValid`; many loops only check “did Python raise.”

17. **Units and frames.** Implicit mm vs inch; XY vs XZ sketch planes; Euler angles in Text2CAD-style prompts. ICP in eval hides this; manufacturing does not.

18. **No Grok (or most open generalists) have a real CAD number.** Do not pick a frontier model from vibes. Text2CAD-Bench is the first public apples-to-apples 2026 table; use it.

19. **Confidentiality vs cloud loops.** A screenshot sent to GPT-5.2 *is* the invention. Local judge + local coder is the only Oppold-safe default. The R9700 box is sized for that.

20. **Drawings.** Ratliff (2026-05) said it: “Moving from CAD models to drawings is still an issue.” No paper in this pass has a drawing leaderboard. If the customer is a patent figure, the CAD loop is necessary and not sufficient.

---

## Sources log

| Date accessed | URL | Used for |
|---|---|---|
| 2026-08-17 | https://arxiv.org/abs/2412.14042 / https://cad-recode.github.io/ / https://github.com/filaPro/cad-recode | CAD-Recode |
| 2026-08-17 | https://arxiv.org/html/2505.22914v3 / https://github.com/col14m/cadrille | cadrille numbers |
| 2026-08-17 | https://arxiv.org/html/2505.19713 / https://huggingface.co/gudo7208/CAD-Coder | CAD-Coder Guan |
| 2026-08-17 | https://arxiv.org/abs/2505.14646 / https://github.com/anniedoris/CAD-Coder | CAD-Coder Doris |
| 2026-08-17 | https://arxiv.org/html/2505.06507v1 | Text-to-CadQuery |
| 2026-08-17 | https://arxiv.org/html/2505.04481v2 | CAD-Llama |
| 2026-08-17 | https://arxiv.org/html/2410.05340v2 | CADCodeVerify / CADPrompt |
| 2026-08-17 | https://arxiv.org/html/2406.00144 | Query2CAD |
| 2026-08-17 | https://arxiv.org/html/2502.03997 | CAD-Editor |
| 2026-08-17 | https://arxiv.org/html/2604.24479v1 / https://huggingface.co/ADSKAILab/Zero-To-CAD-Qwen3-VL-2B | Zero-to-CAD |
| 2026-08-17 | https://arxiv.org/html/2605.18430v1 | Text2CAD-Bench |
| 2026-08-17 | https://arxiv.org/html/2603.26512v1 | CADSmith |
| 2026-08-17 | https://arxiv.org/html/2605.10865v1 | BenchCAD |
| 2026-08-17 | https://arxiv.org/html/2605.10873v1 | CadBench |
| 2026-08-17 | https://arxiv.org/html/2602.16317v1 | CADEvolve (partial) |
| 2026-08-17 | https://sadilkhan.github.io/text2cad-project/ | Text2CAD original |
| 2026-08-17 | https://zoo.dev/research/zookeeper | KCL / Zookeeper |
| 2026-08-17 | https://github.com/earthtojake/text-to-cad | agent harness |
| 2026-08-17 | https://github.com/FreedomIntelligence/BlenderLLM | BlendNet / CADBench |
| 2026-08-17 | https://x.com/AtaeiMe/status/2050686754542284930 | Zero-to-CAD announce |
| 2026-08-17 | https://x.com/BrierRat/status/2056116592938037398 | Claude CAD / build123d |
| 2026-08-17 | https://x.com/earthtojake/status/2057203608207466982 | text-to-cad 3k★ |
| 2026-08-17 | https://forum.level1techs.com/t/dual-r9700s-amd-vllm-container-woes/250053 | dual R9700 stack |
| 2026-08-17 | https://localaimaster.com/blog/amd-rocm-local-llm-setup | ROCm 7.2 RDNA4 |
| 2026-08-17 | https://arxiv.org/pdf/2602.03045 | Proactive Agents (listed, not fully tabled) |
| 2026-08-17 | https://arxiv.org/pdf/2602.22284 | BrepCoder (listed) |

**Not fully extracted (flagged, not used as leaderboard):** P3D-Bench (2606.11152), Op-CAD (ICML 2026), CodeGen-3D, Foundation Models for Automatic CAD (2607.05573), Proactive Agents tables, BrepCoder tables, Drawing-Recode (2607.27558). Treat any claim from those as `UNVERIFIED` until read.
