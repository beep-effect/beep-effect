# Decisions

## 2026-10-09 — Ruling: CPU first delivered; GPU second reader NO-SHIP

**Question:** Part 1 (Q1): does page-level Tesseract still come first after
#1481 and the October `--ocr` run?

**Answer:** Confirm CPU first and amend its state from proposed to delivered.
Keep #1481's page-level Tesseract driver and rasterizer; finish the CPU
selection and language follow-ups before reconsidering another engine.

**Rationale:** The recommendation given is CPU first. #1470 (`3778ac719d`)
landed the page OCR contract; #1481 (`2dffb2827c`) landed `@beep/tesseract`,
`@beep/poppler`, and `corpus extract --ocr`. P11's "OCR re-extraction" records
296 sources and 2,034 pages read with zero failed pages, and one docket added
from newly readable OCR text. This closes the PR body's real-binary
execution uncertainty for that recorded run, not for every source class.

Reject GPU first: the crash and timeout sample was readable through CPU
rendering, and the live CPU pass now has downstream utility. Source-level
selection is still an aggregate threshold of 50 bytes times page count,
not `pdf:charsPerPage[i] < 50`; mixed PDFs can escape. Languages are planned
from script detection on the first page and the installed models. The live
inventory remains `afr`, `eng`, `osd`; missing script models can masquerade
as degraded text. Both gaps strengthen the CPU-first order rather than
justify a GPU driver. `--psm`, `tessdata_best`, and a PP-OCRv5 CPU control
remain unmeasured. See `RESEARCH.md`, "2026-10-09 — Desk refresh", and
`research/BENCHMARK.md`, "Revised recommendation" and "Limits".

Reversal: a later dated decision may change CPU-first only on a measured
regression or a demonstrated quality gain over a correctly selected,
correct-language CPU baseline; retain #1481's readings and failure ledger.

## 2026-10-09 — Part 2: GPU second reader NO-SHIP

**Question:** Does a confidence-routed `@beep/llama-server-ocr` second-reader
pass ship before `oppold-corpus-pipeline-v2` is scaffolded, or not ship at all?

**Answer:** **NO-SHIP.** The GPU second reader does not ship at all under this
ruling. Kill the GPU half; keep the CPU half #1481 delivered.

Epitaph: GPU second-reader OCR is killed because its measured gains do not
justify omissions, attended duty-cycled passes, and a maintained driver
before the cheaper CPU gaps are measured.

**Rationale:** Recommend NO-SHIP and reject SHIP on the following evidence.
The October low-text sample has only 4 of 200 pages (2%) with confidence
under 75 and at least 250 characters in both engines. The earlier sample
has 9 of 41 non-empty scan-class pages under 70 (22%) and 14 under 80 (34%).
These populations and conditions differ; neither estimates P11's residual
hard-page share after the CPU pass.

For scale only, applying those shares to P11's 2,034 pages gives about 41,
447, or 692 GPU candidates. At 5.6 pages/minute with 64% idle, those are
about 7.3, 80, or 124 minutes of GPU wall time. Reading all 2,034 would take
about 363 minutes, versus about 25.4 minutes for Tesseract at 80 pages/minute
on one thread. These are illustrative multiplication, not observed run
counts or a forecast: P11's 2 h 36 min covers 7,640 source extractions at
concurrency 8, not just OCR. A small second pass is feasible in time, which
is the strongest argument for SHIP; feasibility alone is insufficient.

GLM-OCR's clean-page median CER is 0.93%, against Tesseract's 0.09% on ten
controls. Small hand checks favored GLM-OCR on the faxed table, thermal
receipt, and wrong-language page, but the receipt timestamp was not
confirmable. It omitted the patent-number/date header on another page,
returned 28% fewer characters on the timeout class, recovered text on 6 of
200 pages, and lost text on 8. Character counts and agreement are not
accuracy; difficult pages lack ground truth. Keeping both readings would
preserve evidence but would not establish which reading a consumer should
trust. See `research/BENCHMARK.md`, "GPU results" and "Limits".

Cheaper levers remain: page-level selection, missing language models,
`--psm`, `tessdata_best`, and an unmeasured PP-OCRv5 CPU control. The
wrong-language win is not evidence against a correct-language baseline.
The workstation GPU notes cited in `research/GPU-STACK.md`, "Temperature",
require long jobs to stay attended; NO-SHIP keeps the OCR path
agent-runnable. SHIP would add that load and a driver to maintain.

The page contract, CPU engine, rasterizer, reading ledger, and
`@beep/openai-compat` are available. SHIP still needs the GPU driver,
confidence-routing pass and acceptance ratio; the class D raster probe and
per-page selection are absent, and languages remain incomplete. The
pipeline-v2 candidate is gated on G1 PASS: salvage-restoration P0 and P4
are complete, P1-P3 pending (`ops/manifest.json`; overhaul `MAP.md`, G2 and
"Sequencing"; `DECISIONS.md`, 2026-08-24). This gives potential construction
time but no dated deadline and no quality proof. The choice is closed here;
it is not deferred to pipeline-v2's matrix.

Reversal: supersede this kill with a later dated entry and restore status
`active` only after page-level selection and missing language models land
and measurements show a material residual share of text-bearing pages below
Tesseract confidence 75, with independently checked GPU recoveries exceeding
losses on that residual set and a measured acceptable attended time budget.
Report the denominator, omission counts, and throughput; confidence alone
is not accuracy. Do not revive it merely because a GPU is idle.

Run-order ruling: retain the delivered CPU-first OCR path; NO-SHIP the GPU
second reader, so it adds no prerequisite before pipeline-v2 scaffolding.

## 2026-10-09 — Q5: selected sources are re-read page by page

**Question:** Split Tika XHTML for page-separated first readings, or re-read
every page of a selected source?

**Answer:** Close Q5: retain #1481's re-read of every page of a selected source.

**Rationale:** Recommend the delivered form and reject adding an XHTML split
for this ruling. `ServicePrograms.ts`, `pagesToRead`, chooses a source;
`readPages` traverses `A.range(1, pages.pageCount)`. Per-page success/failure
rows and text are retained, the original text is copied to
`ocr/first-reading/`, and composed text uses form-feed page separators.
This differs from SEAM-DESIGN section 5's unchanged canonical text and
run-keyed layout; it does not supply per-page selection for mixed PDFs.

Reversal: a later measured CPU selector change can adopt page-separated
first readings, with explicit preservation and composition rules.

## 2026-10-09 — Q6: image text is retained through the OCR pass

**Question:** Should image sources keep OCR text in first extraction instead
of only a re-read pass?

**Answer:** Close Q6 for this packet by retaining #1481's `--ocr` pass for
supported single-frame images with missing or thin first text. Do not claim
that Tika's initial `image-metadata` extraction now retains its OCR text.
Multi-frame TIFFs keep their first outcome pending per-frame rendering.

**Rationale:** Recommend the existing pass rather than change the format
family here. `pagesToRead` routes eligible `image-metadata` sources through
`imagePages`; `ocrImageMediaType` supports PNG, JPEG and TIFF, and TIFF
requires a known frame count of one. Unsupported images, skipped/deferred
sources, and multi-frame TIFFs keep their outcome. Successful page text is
written into the extraction's canonical text with page provenance. This
settles the useful retention behavior while narrowing the original promise.

Reversal: a later CPU image change may preserve first-extraction text or add
per-frame TIFF support; prove frame counts and retain first readings.

## 2026-10-09 — Q2, Q3, Q4 and Q7: moot by NO-SHIP

**Question:** Q2: move the junction kill line to 100 C or cap power at 210 W?
Q3: retry smaller dots.ocr or PaddleOCR-VL through `llama-server`?
Q4: which confidence/class signal routes GPU pages?
Q7: which acceptance rule lets vision text replace the first reading?

**Answer:** Close all four as moot by the GPU kill; none is DEFERRED.
The 98 C stock-settings ruling remains the recorded operator decision.

**Rationale:** Recommend closure and reject new runs or settings decisions
for an engine that will not ship. Q2 remains operator-reserved in
`GPU-STACK.md`, "Temperature"; this entry does not change it. Q3 needs
unperformed quality runs and a PaddleOCR-VL GGUF not present in the recorded
inventory. Q4 has insufficient post-language, post-selection residual
measurements. Q7's proposed warning checks, length-ratio floor, and adjacent
storage in SEAM-DESIGN sections 6 and 7.4 do not prove absence of omissions;
no ratio is selected for a killed pass and no overwrite is authorized.

Reversal: only after Part 2's kill is superseded, reopen Q2-Q4 and Q7 with
their respective owner and evidence requirements; Q2 still needs the
operator's thermal decision, not this lane's authority.
