# OCR benchmark: method and results

2026-10-06. Metrics only. Page images, texts, file names and the mapping from
sample ids to documents stay in a private folder outside this repo.

## Status

- CPU half: done. Tika, Tesseract-through-Tika and Tesseract directly.
- GPU half: done as far as the hardware allowed. One engine has full
  numbers, two were attempted and could not be run usefully; see "GPU
  results". A second, 200-page set from the October run compares the one
  working engine with Tesseract.

## Census: how much of the corpus is scanned

Source: the July extract output (7,330 source rows). Read from
`sources.jsonl` and the per-source Tika metadata; page images from
`pdfimages -list`. Counts only.

| Measure | Count |
| --- | --- |
| PDF sources with extracted text | 337 |
| PDF pages | 2,845 |
| Pages with fewer than 50 embedded characters (Tika OCR territory) | 1,052 (37%) |
| Pages Tika reports it sent to Tesseract (`pdf:ocrPageCount`) | 957 |
| Pages carrying a full-page raster (width and height >= 1000 px) | 1,439 (51%) |
| ... of those, pages that also have a text layer of 50+ characters | 517 (18% of all pages) |
| PDFs where every page is low-text | 91 |
| PDFs with a mix of low-text and text pages | 39 |
| Image sources (`png`, `jpg`, `webp`, ...): OCR text discarded today | 252 |

Two readings:

- A chars-per-page rule finds 1,052 pages. It misses 517 scanned pages whose
  text layer came from an earlier OCR pass by some other tool. Tika trusts
  that layer.
- PDFs are 5% of July's source rows. The share in the October run was not
  measured: that run was in progress and off limits.

## Sample

58 pages, one page per document, drawn with a fixed seed from the census:

| Class | Pages | Definition |
| --- | --- | --- |
| scan | 30 | 0 embedded characters |
| scan-low | 6 | 1 to 49 embedded characters |
| sparse | 6 | 50 to 399 embedded characters |
| control | 10 | 1,500+ embedded characters and no raster image on the page (born digital) |
| scan-layered | 6 | 1,500+ embedded characters on top of a full-page raster |

Layout mix of the 48 non-control pages, labelled by eye from thumbnails
(labels overlap, this is a judgment): dense single-column prose 11, tables or
forms 10, signature or handwriting blocks 8, patent drawings 7, receipts or
invoices 5, pages with a fax transmission header 4, screenshots or photos 4,
two-column patent text 3.

Each page was split out (`pdfseparate`), rendered at 300 dpi grayscale PNG
(`pdftoppm -r 300 -gray`), and its embedded text saved (`pdftotext`).

A first draft of the control class used "many embedded characters" alone.
Three of four spot-checked "controls" turned out to be scans with an OCR text
layer, which is not ground truth. Controls now also require that the page
carries no raster image. That mistake is how the scan-layered class was found.

## Engines measured on CPU

| Label | Command | What it stands for |
| --- | --- | --- |
| `tika-pdf` | `java -jar tika-app-3.3.1.jar -J -t page.pdf`, first JSON row | The production path, as `@beep/tika` runs it |
| `tika-png` | the same on `page.png` | Tesseract through Tika, forced |
| `tesseract` | `tesseract page.png - -l eng tsv` | Tesseract 5.5.3 directly, with word confidences |

`tika-png` and `tesseract` produce identical text on every page (character
similarity 1.0 on all 41 non-empty scan pages), so Tika adds nothing to the
recognition, only process cost.

## Scoring

- Text is NFKC-normalized, typographic quotes and dashes folded, markdown
  markup stripped, whitespace collapsed.
- **Controls:** character error rate (CER) and word error rate (WER) against
  the embedded text, by Levenshtein distance, and an order-insensitive word
  F1 (bag of words). The last one separates reading-order differences from
  recognition errors.
- **Scans:** no ground truth exists. Reported: characters produced, empty
  pages, Tesseract's mean word confidence, and pairwise agreement between
  engines. Agreement is not accuracy.
- **Hand check:** a band of four scan pages was read against Tesseract's
  output by the agent that ran the benchmark. Four pages, one reader: a
  judgment, not a measurement.

## Results: CPU

Timings were taken while a 6-way extraction used about half the cores, so
they are upper bounds for an idle machine. One page at a time, no batching.

| Engine | Class | n | Median s/page | Mean chars | Empty pages | Quality |
| --- | --- | --- | --- | --- | --- | --- |
| `tesseract` | control | 10 | 1.45 | 3,170 | 0 | CER median 0.09%, WER median 0.6%, word F1 mean 0.993 |
| `tika-pdf` | control | 10 | 0.85 | 3,175 | 0 | reads the text layer, no OCR |
| `tesseract` | scan | 30 | 0.78 | 1,267 | 2 | mean word confidence 76.9 |
| `tika-pdf` | scan | 30 | 3.53 (mean 4.38) | 1,184 | 2 | char similarity to direct Tesseract: median 0.95 |
| `tesseract` | scan-low | 6 | 0.38 | 153 | 2 | mean word confidence 87.2 |
| `tika-pdf` | scan-low | 6 | 1.98 | 132 | 1 | char similarity to direct Tesseract: median 0.14 |
| `tesseract` | sparse | 6 | 0.28 | 210 | 0 | mean word confidence 86.4 |
| `tika-pdf` | sparse | 6 | 1.01 | 251 | 0 | char similarity to direct Tesseract: median 0.52 |
| `tesseract` | scan-layered | 6 | 1.41 | 3,085 | 0 | vs existing text layer: char similarity median 0.84 (min 0.29), word F1 median 0.96 |

What the numbers say:

1. **Tesseract is not weak on clean pages.** On born-digital pages rendered at
   300 dpi, 9 of 10 pages have CER at or below 1.6% and 6 of 10 at or below
   0.1%. The tenth has CER 66% with word F1 0.99: every word is right and the
   order is wrong. That is a two-column reading-order failure, not a
   recognition failure.
2. **The trouble is concentrated.** Across the 41 scan-class pages that have
   any text, Tesseract's mean word confidence has median 88 but 9 pages (22%)
   are below 70 and 14 (34%) below 80. The minimum is 14.5.
3. **Hand check (4 page bands, a judgment).** A clean scanned patent
   specification band and a clean government form band: no wrong words on the
   fully visible lines. A faxed table band: about 12 of 38 words wrong or
   missing, including all three underlined column headers. A thermal receipt
   band: about 8 of 22 tokens wrong or missing, including a dropped price and
   an unreadable date.
4. **The production path costs 3.5 s per scanned page**, against 0.8 s for
   Tesseract alone on the same render. The difference is one JVM start and
   one render per source. For a multi-page document the JVM start is paid
   once, so this per-page figure overstates the cost for long documents.
5. **Scan-low and sparse pages disagree with themselves.** When a page has a
   little embedded text, Tika returns that text and may skip OCR, so
   `tika-pdf` and direct Tesseract share only 14% to 52% of characters. Those
   pages are stamps, headers and form labels over an image: the embedded text
   is not the page's text.
6. **Existing OCR layers differ from Tesseract by 16% of characters at the
   median**, and by 71% on the worst page. Neither is ground truth. This is
   the class a better engine could settle.

## What a GPU engine has to beat

- Speed: under 0.8 s per page on scans to match Tesseract alone, under 3.5 s
  to match the production path.
- Quality: nothing on clean prose, where Tesseract is already near the
  ceiling. The gain has to come from the low-confidence quarter (fax,
  receipts, stamps), from tables, and from reading order on multi-column
  pages. A sample of 58 pages holds about 14 such pages; any claim about them
  needs the hand check, with its sample size stated.
- Safety: a vision model that writes fluent text for an unreadable page is
  worse than Tesseract's visible garbage. Truncated or looping outputs must
  be counted, not averaged away.

## GPU results

<!-- GPU-RESULTS -->
Three engines were attempted on one card (the non-display card). One
produced a full result. All runs used a 1 Hz background sampler that kills
the engine at 98 C junction or 100 C memory; the thermal traces are in
`GPU-STACK.md`.

### Three engines, 58-page sample

| Engine | Path | Pages done | s/page | Clean pages: CER median (n=10) | Scans: char similarity to Tesseract | VRAM peak | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tesseract 5.5.3 | CPU | 58 | 0.78 (scans), 1.45 (clean) | 0.09% | n/a | n/a | baseline |
| GLM-OCR Q8_0 (0.9B) | `llama-server`, HIP | 58 | 4.06 (scans), 5.27 (clean) | 0.93% | 0.78 | 3.7 GB | complete |
| dots.ocr Q8_0 (3B) | `llama-server`, HIP | 1 | 41.9 | not measured | not measured | 6.8 GB | killed at 98 C during page 2 |
| PaddleOCR-VL-1.6 (0.9B) | PyTorch ROCm, `transformers` | 0 complete | 3.6 tokens/s | not measured | not measured | 2.9 GB | unusably slow |

- **dots.ocr** encodes a 300 dpi page as 10,751 image tokens and takes 42 s
  per page at 300 W. One page from a cool card reached 97 C; the second hit
  the 98 C line. `--image-max-tokens` did not reduce the token count. At this
  input size it cannot be run under the stop line and would be ten times
  slower than GLM-OCR if it could. Not measured for quality.
- **PaddleOCR-VL-1.6** loads and generates on ROCm PyTorch, at 3.6 tokens per
  second (128 tokens in 35.8 s; 1,253 prompt tokens). A first attempt at a
  full page ran 412 s without finishing and was stopped by hand with memory
  temperature at 91 C. A page of 500 tokens would take over two minutes. The
  PyTorch path works but is not usable for this model as installed. Not
  measured for quality.
- **GLM-OCR** numbers are from the first full run (unchanged): it loses to
  Tesseract on clean pages (CER 0.93% against 0.09%) and is five times
  slower. The hand check of four page bands from that run (a judgment, one
  reader): both engines right on two clean bands; on a faxed table band
  Tesseract had about 12 of 38 words wrong or missing and GLM-OCR none,
  though it returned the table column by column; on a thermal receipt band
  Tesseract had about 8 of 22 tokens wrong or missing and GLM-OCR had items
  and prices right, and printed a definite time for a smudged timestamp the
  reader could not confirm.

### GLM-OCR and Tesseract on 200 low-text pages from the October run

A second set: 200 pages, one per source, drawn with a fixed seed from the
October extraction's low-text list (1,090 sources): 60 from the window in
which Tesseract crashed, 70 with few characters per page, 30 image files, 30
PDFs that hit the Tika timeout, 10 other low-text sources. Rendered the same
way (300 dpi grayscale PNG). No ground truth; these are counts.

| Class | n | Tesseract: empty pages | GLM-OCR: empty pages | Tesseract empty, GLM has text | GLM empty, Tesseract has text | Tesseract mean chars | GLM mean chars | Tesseract conf < 70 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| crash window | 60 | 0 | 6 | 0 | 3 | 1,846 | 1,695 | 3 |
| few chars per page | 70 | 38 | 40 | 2 | 4 | 51 | 52 | 22 |
| image files | 30 | 21 | 21 | 3 | 1 | 20 | 48 | 9 |
| Tika timeout | 30 | 2 | 2 | 0 | 0 | 1,554 | 1,121 | 2 |
| other low text | 10 | 3 | 4 | 1 | 0 | 664 | 590 | 4 |

("Empty" is under 20 characters; "has text" is 100 or more.) Median seconds
per page: Tesseract 0.11 to 0.69 by class, GLM-OCR 1.9 to 4.6. GLM-OCR: 200
of 200 pages returned, none cut at the token limit, no errors.

Readings:

1. **Most low-text pages have little or no text to find.** On 64 of 200
   pages Tesseract returns under 20 characters, and GLM-OCR on 73: drawings,
   photos, blank and near-blank pages. The vision model recovered text
   Tesseract missed on 6 pages and lost text Tesseract had on 8. "Low text"
   is mostly not an OCR failure.
2. **The crash and timeout classes are a pipeline problem, and the CPU fixes
   them.** On pages rendered to PNG first, Tesseract read all 60 crash-window
   pages (mean confidence 86, no crash: the JPEG 2000 decode never runs) and
   28 of 30 timeout pages, at 0.6 to 0.7 s per page. Those sources lost or
   risked their text to how the page reaches Tesseract, not to Tesseract's
   reading. One page per source was sampled, so this shows the route works,
   not that every page of those sources reads.
3. **Low confidence with real text is rare.** Tesseract's mean word
   confidence is under 70 on 40 of 200 pages, but only 4 pages with
   confidence under 75 carry 250 or more characters in both engines. The
   rest are sparse pages.
4. **Hand check of two of those four (a judgment, two page bands, one
   reader).** One is an official notice in Chinese: Tesseract, run with the
   English model only, wrote noise at confidence 28; GLM-OCR read the Chinese
   text, the numbers and the date correctly as far as the band shows. The
   other is a two-column patent front page: Tesseract kept every field but
   interleaved the columns; GLM-OCR put the fields in reading order and
   **left out the header line with the patent number and date**. Its output
   for that page is 36% shorter than Tesseract's.
5. **GLM-OCR drops content.** Across the timeout class it returned 28% fewer
   characters than Tesseract, and it returned nothing on 3 crash-window pages
   Tesseract read. Fewer characters is not fewer errors. An omission is
   silent: nothing in the output marks it.

### Cost of running under the temperature line

| Run | Pages | Wall | GPU-on | Idle fraction | Effective pages/min | Junction peak / median | Ended |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GLM-OCR, 90 s trial, continuous | 21 | 90 s | 90 s | 0% | 14.0 | 95 / 82 C | time budget |
| GLM-OCR, 58 pages, continuous | 31 | 138 s | 138 s | 0% | 13.5 | 98 / 90 C | **killed at 98 C** |
| GLM-OCR, 200 pages, gate on junction < 80 C only | 14 | 70 s | 68 s | 3% | 12.0 | 98 / 88 C | **killed at 98 C** |
| GLM-OCR, 200 pages, gate on junction < 80 C and edge < 58 C | 200 | 2,135 s | 762 s | 64% | 5.6 | 96 / 62 C | complete |
| dots.ocr, 2 pages | 1 | 60 s | 58 s | 3% | 1.0 | 98 / 95 C | **killed at 98 C** |
| PaddleOCR-VL, 1 page, 128 tokens | 1 | 42 s | 42 s | 0% | 1.4 | 80 / 75 C | complete |

- Run continuously, the card settles at 95 to 97 C within a minute and
  crosses 98 C inside two and a half minutes. A continuous pass is not
  possible under a 98 C line.
- A gate on the junction sensor alone does nothing: that sensor falls under
  80 C within a second of idle while the heatsink is still hot. The gate
  that works waits for the edge sensor.
- With that gate a pass is thermally stable for 35 minutes (peak 96 C, no
  kill, no kernel errors) and costs 64% idle time: 5.6 pages per minute,
  where Tesseract on one CPU thread does about 80. The fan falls back to idle
  speed during each pause, so the heatsink cools slowly.

### Revised recommendation

1. **Fix the CPU path first.** Render each PDF page to an image and call
   Tesseract directly, page by page with a per-page timeout, instead of one
   Tika call per source. On this evidence that reads the crash and timeout
   sources, exposes word confidence, and costs under a second per page. Keep
   image files' text. This is most of the available gain and needs no GPU.
2. **Give Tesseract the right language.** One of the two hand-checked
   low-confidence pages was a wrong-language page, not a degraded one. Script
   detection (`osd` is installed) and more language models come before any
   vision model.
3. **Use the GPU as a second reader, not a replacement.** Send GLM-OCR only
   pages with real text and low Tesseract confidence, plus pages flagged as
   multi-column or tabular. On both samples that is a small share of pages
   (4 of 200 here; about a fifth of the scan pages in the first sample), a
   volume the duty-cycled card can serve. Keep both readings and never let
   the vision reading silently replace the first: it omits content.
4. **Engine: GLM-OCR through `llama-server`.** It is the only candidate that
   ran to completion. dots.ocr is too slow and too hot at full resolution;
   PaddleOCR-VL is too slow on ROCm PyTorch as installed.
<!-- /GPU-RESULTS -->

## Limits of this benchmark

- 58 pages from one month's extract and 200 from another, one practice. They
  rank engines; they do not estimate corpus-wide error rates.
- Only one vision engine was measured for quality. Nothing here says the
  other two read worse.
- Ground truth exists only for 10 born-digital pages, and those are the easy
  case. The hard cases are scored by agreement and a small hand check.
- Standalone image sources (252) are not in the sample.
- Seen in passing, not measured: during the live extraction on the same night the system journal
  recorded three Tesseract crashes inside the JPEG 2000 decoder (`libopenjp2`, reached through
  Leptonica). Scanned PDFs often embed JPEG 2000 page images. Tika swallows the crash and the page
  comes back empty; nothing in the extract output marks it.
- Tesseract was run with defaults (`eng`, automatic page segmentation). No
  preprocessing, no `--psm` tuning, no `tessdata_best` models. A tuned
  Tesseract is a legitimate competitor that was not measured.
