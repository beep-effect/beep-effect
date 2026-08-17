You are a research lane. Output is a CITED report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: /home/elpresidank/YeeBois/projects/beep-effect2/goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/x13-rtx3070-target.md
- CREATE the file within your FIRST 5 turns with a skeleton, then APPEND. Final chat message = pointer only.
- Inline citations (URL + date). Label `UNVERIFIED`. Be precise about NUMBERS.

CONTEXT CORRECTION that makes this lane necessary: earlier lanes assumed the only
hardware was a Linux dev box with 2x AMD Radeon AI PRO R9700 (ROCm, no CUDA), and
concluded Meshroom was unusable and generative image-to-3D was AMD-flaky.

NEW FACT: the END USER — a solo patent attorney, the person who must actually run the
shipped desktop app — has an **NVIDIA GeForce RTX 3070**. The AMD box belongs to the
developer, not the attorney. These are two different machines with two different roles.

TOPIC: What does an RTX 3070 change for a photo -> starting-CAD / figure pipeline, and
what should run on WHICH machine?

Cover precisely:

1. **RTX 3070 exact specs.** VRAM (desktop 3070, 3070 Ti, and 3070 Laptop — state each),
   CUDA compute capability, and whether any 2026 toolchain has dropped support for that
   compute capability. Note that 8 GB is small by 2026 standards and say so plainly.

2. **What FITS in 8 GB VRAM.** Go model by model with the vendor's own stated requirement,
   and flag where a community/FP16/low-VRAM build changes the answer:
   TRELLIS, TRELLIS.2, Hunyuan3D-2.0 (shape-only vs shape+texture), Hunyuan3D-2.1,
   Stable Fast 3D, TripoSR, CAD-Recode (1.5B), cadrille (2B), Zero-To-CAD-Qwen3-VL-2B.
   Produce a clean FITS / DOESN'T FIT / FITS-WITH-CAVEAT table for 8 GB.

3. **Photogrammetry on a 3070.** Meshroom / AliceVision: the depth-map step is CUDA-gated —
   does a 3070 satisfy it, is there a minimum compute capability, and what is a realistic
   wall-clock for ~60-150 photos of a small part? COLMAP + CUDA on the same card. Any
   VRAM ceiling that bites on high-res photos, and the standard mitigations (downscale,
   image caching, chunking).

4. **Windows vs Linux.** Assume the attorney is on Windows. Which of the above have
   first-class Windows builds vs Linux-only or WSL-only? Call out anything that would
   force WSL2 and what that costs (GPU passthrough, filesystem perf).

5. **THE ARCHITECTURAL FORK — answer this directly.** Given a two-machine world:
   - Machine A: attorney's Windows box, RTX 3070 8 GB, holds the privileged client files.
   - Machine B: developer's Linux box, 2x R9700 64 GB, no client files by default.
   What SHOULD run where? Consider: (a) everything on A, (b) heavy reconstruction batched
   to B, (c) hybrid. Address the confidentiality angle head-on: moving privileged client
   invention data from the attorney's machine to a non-lawyer developer's machine is NOT a
   cloud upload, but it IS a disclosure to a third party — analyse it under ABA Model Rule
   5.3 (nonlawyer assistance) and Rule 1.6, and say what would have to be true for it to be
   proper. Do not give a legal opinion; state the framework and the conditions.

6. **Does the 3070 matter at all for the PRIMARY path?** The ranked-1 path is
   photo -> rectify -> silhouette -> potrace/OpenCV -> DXF -> Fusion sketch. Confirm this is
   CPU-only and state plainly whether the GPU is irrelevant to it. Same question for the
   figure compositor (OCCT hidden-line removal via build123d/FreeCAD TechDraw) — is HLR
   CPU-bound? This determines whether the GPU is core or a nice-to-have.

END WITH: a two-column table "runs on the attorney's 3070 box" vs "needs the developer's
AMD box or does not exist", and a one-paragraph recommendation on machine topology.
