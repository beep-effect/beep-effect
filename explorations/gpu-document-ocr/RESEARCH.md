# Research

2026-10-06. Detail lives in `research/`:
[`GPU-STACK.md`](./research/GPU-STACK.md) (what is installed, the safety
gates), [`BENCHMARK.md`](./research/BENCHMARK.md) (method and results),
[`SEAM-DESIGN.md`](./research/SEAM-DESIGN.md) (schema, service, drivers,
storage), [`SOURCES.md`](./research/SOURCES.md) (provenance).

## External Landscape

Checked on the web on 2026-10-06. Benchmark scores are the publishers' or
third-party round-ups, not reproduced here.

The field moved to small vision-language models (about 1B parameters) that
read a page image and emit text or markdown. On OmniDocBench v1.6 the top
entries are all in that size class
([Roboflow round-up, 2026-08-03](https://roboflow.com/blog/best-open-source-ocr-models),
[Docsumo round-up](https://www.docsumo.com/blog/best-ocr-models)).
llama.cpp gained first-class support for a set of them in 2026
([ggml-org: Using OCR models with llama.cpp, 2026-04-10](https://huggingface.co/blog/ggml-org/using-ocr-models-with-llama-cpp)):
LightOnOCR, Qianfan-OCR, PaddleOCR-VL (with a note that quality may be
degraded), GLM-OCR, DeepSeek-OCR, dots.ocr, HunyuanOCR.

### Candidates chosen

| Engine | Size | License | Path on this hardware | Why |
| --- | --- | --- | --- | --- |
| [GLM-OCR](https://huggingface.co/zai-org/GLM-OCR) ([GGUF](https://huggingface.co/ggml-org/GLM-OCR-GGUF)) | 0.9B; Q8_0 950 MB + projector 484 MB | MIT (base repo) | `llama-server` (the local ROCm/HIP build) | Lowest setup risk: official GGUF from the llama.cpp maintainers, the one model their guide uses as its example, 95.2 on OmniDocBench v1.6 per the Roboflow round-up. Small enough to run several slots on one 32 GB card. |
| [dots.ocr](https://huggingface.co/ggml-org/dots.ocr-GGUF) | 3B; Q8_0 1.9 GB + projector 1.3 GB | MIT as declared on the GGUF repo; base repo license not confirmed in this pass | `llama-server` | A larger single model that does layout, reading order and tables in one pass. The benchmark's open problems are tables and reading order, not clean prose. |
| [PaddleOCR-VL-1.6](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6) | 0.9B; 1.9 GB safetensors | Apache-2.0 | PyTorch ROCm + `transformers` (>= 5.0; 5.18 is installed) | Top published score of the permissive-license group (96.3). Tests the PyTorch/ROCm path. Caveat: its published pipeline runs a layout detector (PP-DocLayout) first, which needs PaddlePaddle, and PaddlePaddle has no ROCm build. Here it can only be run as a whole-page recognizer, which is not what the score measures. |

### Rejected

| Engine | Reason |
| --- | --- |
| Full PaddleOCR-VL pipeline (with PP-DocLayout) | Needs PaddlePaddle on the GPU; CUDA only. |
| [Chandra](https://huggingface.co/datalab-to/chandra) | OpenRAIL license with use restrictions; strong on handwriting, so worth a second look only if the license is acceptable. |
| MinerU 2.5 | License carries commercial-use thresholds (per the Roboflow round-up). |
| [DeepSeek-OCR](https://huggingface.co/deepseek-ai/DeepSeek-OCR) | MIT, and supported by llama.cpp, but the reference runtime targets CUDA and its published score is below the three chosen. Kept as a fallback, not rejected on principle. |
| [olmOCR 2](https://huggingface.co/allenai/olmOCR-2-7B-1025) | Apache-2.0, 7B. No official GGUF; a 15 GB conversion step and several times the cost per page of a 1B model. Revisit if the small models fail on faxed pages. |
| TeleOCR, OvisOCR2 | Top of the leaderboard as of September 2026, but only community GGUF conversions and no track record. Revisit in a month. |
| General chat VLMs (a 27B model is on disk) | No vision projector on disk; highest risk of fluent invented text; slowest. |
| Any hosted OCR API | Costs money and sends client pages off the machine. |

### A CPU option the survey surfaced

The benchmark shows Tesseract is near its ceiling on clean pages and fails on
a minority (fax, receipts, tables, reading order). A classical detector plus
recognizer (the PP-OCRv5 models through ONNX Runtime) runs on CPU, reports
confidences, and cannot invent text. It was not measured. It is the natural
control for "is the gain from the GPU, or from any OCR newer than Tesseract?"

## In-Repo Capability Inventory

| Brick | Where | Use |
| --- | --- | --- |
| `FileProcessingService`, `FileProcessingEngineShape` | `packages/foundation/capability/file-processing/src/Service` | The existing source-level seam. Reuse as is; page OCR sits beside it. |
| `ArtifactId`, `OperationId`, `ContentDigest` | `.../file-processing/src/Artifact` | Reused by the new page OCR schemas. |
| `FileFormatFamily` (`pdf-text-layer`, `image-metadata`) | `.../file-processing/src/Strategy` | Names the gap: there is no scanned-PDF or image-text family. |
| `FileProcessingSkipReason.ocr-disabled` | same | Declared, unused. |
| `SourceProcessingRecord` (`engine`, `textPath`) | `.../file-processing/src/Extraction/Extraction.manifest.ts` | One engine string and one text path per source; extend through a sidecar ledger, not in place. |
| `SourceTextExtractor`, `SourceTextIdentity` | `packages/foundation/modeling/provenance` | Existing extractor identity for canonical text; the mapping target for an OCR engine identity. |
| `makeTikaAppFileProcessingEngine` | `packages/drivers/tika/src/Tika.tikaapp.ts` | The only place Tesseract is reached, implicitly. |
| `OpenAiCompatClient` | `packages/drivers/openai-compat` | `llama-server` speaks this protocol; the GPU driver composes on it. |
| `extractCorpusImpl` | `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts` | Writes `text/`, `metadata/`, `sources.jsonl`; the re-read pass reads these. |
| Page OCR request/result/service | `.../file-processing/src/PageOcr` | **NEW in this packet's first PR.** |
| Tesseract driver | NOT FOUND | Proposed `@beep/tesseract`. |
| PDF page rasterizer | NOT FOUND | Proposed `@beep/poppler`. |
| Text-reading ledger (which engine produced a text) | NOT FOUND | Proposed `text-readings.jsonl`, see the design. |

## Constraints Discovered

- **Hardware safety.** Single card only, short runs, temperatures watched.
  The kernel runs translated, strict DMA on purpose; two-card peer-to-peer
  work is out. See `research/GPU-STACK.md`.
- **Heat.** One measured run took the card to 94 C junction with the fan
  below half speed. No sustained GPU pass until the card has a fan curve or
  a power cap.
- **One engine measured.** GLM-OCR has numbers in `research/BENCHMARK.md`.
  Statements about dots.ocr and PaddleOCR-VL are still from publishers and
  round-ups.
- **Ground truth is scarce.** Only born-digital pages have it, and they are
  the easy case.
- **Vision models can invent text.** For legal documents an invented word is
  worse than a garbled one. The result schema carries warnings, and the
  design keeps the first reading instead of overwriting it.
- **The corpus is private and this repo is public.** Only counts, rates and
  timings may be recorded here.
- **Money.** Local, open-weight engines only.
