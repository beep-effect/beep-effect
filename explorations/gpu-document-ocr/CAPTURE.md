# Capture

## 2026-10-06

Operator, verbatim: "start a new agent in a worktree to begin a path to make
use of the GPUs".

Context handed over with it, by the orchestrator session:

- `bun run beep corpus extract` reads documents with Apache Tika and, for
  scanned pages and embedded images, shells out to Tesseract 5.5.3. CPU only.
  A run over 7,640 documents takes hours.
- The workstation has two idle 32 GB GPUs (AMD Radeon AI PRO R9700).
- A large share of the corpus is scans: old filed documents, faxed pages,
  tables, multi-column layouts. Tesseract is weak on those.
- Goal order: better text from scans first, speed second.
- No paid APIs, no hosted OCR. Corpus content never leaves the machine and
  never enters this repo; metrics only.
- First PR: design plus benchmark method and results, and if time allows the
  schema and service contract. No GPU engine wired into `corpus extract`.

Raw thoughts while working:

- "Tesseract via Tika" is not a setting anywhere in the repo. Tika finds
  Tesseract on PATH. The repo cannot currently say which texts are OCR.
- Image files get OCR'd by Tika and the text is thrown away
  (`image-metadata`).
- Half of all PDF pages in the July extract sit on a full-page raster. A
  third of those already have someone else's OCR text layer, which Tika
  trusts.
- The GPU safety note from June lists `iommu=pt` next to the thermal gates.
  It is a two-card P2P prerequisite, and the box now boots with translated,
  strict DMA on purpose. See `research/GPU-STACK.md`.
- The local llama.cpp builds are ROCm/HIP builds now, not Vulkan.
