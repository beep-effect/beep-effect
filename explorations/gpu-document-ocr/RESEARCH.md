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
- **Heat.** Continuous OCR puts the card on a 95 to 98 C plateau within a
  minute. Under the 98 C kill line a pass needs a duty cycle that idles 64%
  of the time (5.6 pages per minute).
- **One engine usable.** GLM-OCR has full numbers. dots.ocr (42 s per page,
  killed on temperature) and PaddleOCR-VL on ROCm PyTorch (3.6 tokens per
  second) ran but are not usable as configured; their quality is unmeasured.
- **Vision models omit content as well as invent it.** GLM-OCR left out a
  header line in the hand check and returned fewer characters than Tesseract
  on text-heavy pages.
- **Ground truth is scarce.** Only born-digital pages have it, and they are
  the easy case.
- **Vision models can invent text.** For legal documents an invented word is
  worse than a garbled one. The result schema carries warnings, and the
  design keeps the first reading instead of overwriting it.
- **The corpus is private and this repo is public.** Only counts, rates and
  timings may be recorded here.
- **Money.** Local, open-weight engines only.


## 2026-10-09 — Desk refresh: delivered CPU OCR and remaining GPU gaps

Read-only refresh after merging main at `36027982f2`; no new benchmark,
corpus run, download or GPU operation. The earlier measured sections remain
historical. This section corrects the inventory and proposal against shipped
code and recorded runs, then feeds the align ruling in `DECISIONS.md`.

### What landed and what the ledger now means

#1470 (`3778ac719d`) delivered the schema and `PageOcrService` under
`packages/foundation/capability/file-processing/src/PageOcr/`. #1481
(`2dffb2827c`) delivered `@beep/tesseract`, `@beep/poppler` and the
`corpus extract --ocr` path. Tesseract returns mean word confidence, detects
script, and plans installed languages while reporting missing models.
Poppler counts through `pdfinfo` and renders individual grayscale PNG pages
through `pdftoppm`.

The as-built ledger is `CorpusPageReadRecord` / `CorpusPageFailedRecord` in
`packages/tooling/tool/cli/src/commands/Corpus/internal/Ocr.schemas.ts`.
`ServicePrograms.ts`, `makeExtractOcr`, writes
`ocr/pages/<operationId>.jsonl` and
`ocr/text/<operationId>/<page>.<engineId>.txt`. Success records carry engine,
image digest, text digest, confidence, warnings and timing; failures have a
page reason. Existing first text is preserved in `ocr/first-reading/` and
composed OCR replaces `text/<operationId>.txt`, using form-feed separators.
A future engine can add readings beside these, but is not implemented.
SEAM-DESIGN section 5 instead proposed an `ocr/<ocrRunId>/` namespace,
`text-readings.jsonl`, and an unchanged `text/` first reading. Do not mistake
that proposal for the shipped layout.

### Selection and image retention

`usableTextBytesPerPage` is 50. `pagesToRead` checks a whole source's first
text bytes against 50 times its page count; `readPages` then reads every
page of a selected source. This is not class A's per-page
`pdf:charsPerPage[i] < 50` selector. A mixed PDF can exceed the aggregate
threshold despite scanned pages; the July census counted 39 mixed PDFs.
Skipped/deferred and unrouted sources keep their outcome.

Eligible single-frame PNG/JPEG/TIFF `image-metadata` sources with missing
or thin first text can acquire canonical text through `--ocr`; the initial
Tika image extraction still does not retain OCR text. Multi-frame or
unrecognized TIFF frame counts keep their first outcome. Script detection
on the first page selects languages for the entire source, not each page.

### Recorded P9 to P11 evidence (counts, rates and timings only)

- `goals/practice-kg-mcp/history/p9/2026-10-06-working-files-bundle.md`,
  "Extraction failures" and "Fill-in bundle": 94 PDF timeouts and 3
  Tesseract JPEG 2000 crashes; fill-in reduced timeouts to 8.
- `goals/practice-kg-mcp/history/p10/2026-10-07-anchor-dominance-and-correspondents.md`,
  "Still out": those 8 timeouts and crash-hit pages remained unresolved.
- `goals/practice-kg-mcp/history/p11/2026-10-07-mail-archive-correspondents.md`,
  "OCR re-extraction": 7,640 sources in 2 h 36 min at concurrency 8;
  296 sources, 2,034 pages read page by page, 0 failed. Succeeded sources
  increased from 6,380 to 6,385; 1,248 remained without an engine.
  The bundle comparison records one docket added from newly readable OCR
  text. `PLAN.md`, row P11, marks the phase complete.
- `goals/practice-kg-mcp/history/reflections/2026-10-06-claude.md`,
  "Implementation improvement opportunities", recommended re-reading
  crash pages through the CPU per-page path. P11 is later execution
  evidence, not an inference from the benchmark.

### Inventory corrections and remaining proof boundaries

The page contract/service, Tesseract engine, page rasterizer, reading ledger,
and `@beep/openai-compat` are present on refreshed main. Tesseract and
Poppler are **reuse**, replacing this file's earlier NOT FOUND entries.
`@beep/llama-server-ocr` remains **NOT FOUND**. The class D full-page raster
probe remains **NOT FOUND** in Poppler: no `pdfimages` call exists.
Per-page low-text selection remains unbuilt as designed. The language
inventory still reports only `afr`, `eng`, `osd`. P11 lists Arabic, Greek,
Hebrew, Hindi, Japanese, Korean and Russian as missing; the schema also
plans Chinese models for Han, which this inventory lacks. No models were
installed. Missing languages are an orchestrator follow-up.

#1481's "Not in this PR" excludes email attachment export and every GPU
engine. Its "Unproven" lists real scans through the actual drivers, hosted
Heavy lanes, and the untuned 50-bytes-per-page threshold. P11 supplies a
real-run result for the CPU path only; it does not tune selection, measure
accuracy, prove every format, or establish historical hosted Heavy status.
The benchmark's PP-OCRv5 CPU control, `--psm` tuning and `tessdata_best`
remain unmeasured. No new external claim is introduced by this refresh.
