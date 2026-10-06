# OCR benchmark: method and results

2026-10-06. Metrics only. Page images, texts, file names and the mapping from
sample ids to documents stay in a private folder outside this repo.

## Status

- CPU half: done. Tika, Tesseract-through-Tika and Tesseract directly.
- GPU half: **not run yet** at the time of writing. See "GPU results" at the
  end; the section says so until numbers exist.

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
One engine was measured, then GPU work stopped on a temperature limit. The
other two candidates were **not run**.

Run: GLM-OCR Q8_0 through `llama-server` (ROCm/HIP build), one card (the
non-display card), one server slot, temperature 0, prompt `Text Recognition:`,
the 300 dpi page PNG sent as is (4,043 image tokens per page), 58 pages.

| Engine | Class | n | Median s/page | Mean chars | Empty pages | Quality |
| --- | --- | --- | --- | --- | --- | --- |
| GLM-OCR Q8_0 | control | 10 | 5.27 | 3,086 | 0 | CER median 0.93%, WER median 1.2%, word F1 mean 0.984 |
| GLM-OCR Q8_0 | scan | 30 | 4.06 | 1,190 | 2 | char similarity to Tesseract: median 0.78; word F1 0.87 |
| GLM-OCR Q8_0 | scan-low | 6 | 3.35 | 160 | 2 | char similarity to Tesseract: median 0.84 |
| GLM-OCR Q8_0 | sparse | 6 | 3.44 | 164 | 1 | char similarity to Tesseract: median 0.73 |

| Resource | Value |
| --- | --- |
| Model load | 1.0 s |
| VRAM, after load / peak | 2,987 MiB / 3,717 MiB of 32 GB |
| Wall time, 58 pages | 430 s, of which 165 s were cool-down pauses |
| Junction temperature, start / median / peak | 50 C / 87 C / **94 C** |
| Post-page samples at or above 90 C | 17 of 58 |
| Fan, peak | 2,339 rpm of a 5,100 rpm maximum |
| Outputs cut at the token limit | 0 of 58 |
| New kernel `amdgpu` / `AMD-Vi` errors | 0 |

Readings:

1. **On clean pages GLM-OCR is worse than Tesseract, and slower.** CER median
   0.93% against 0.09%, at 5.3 s per page against 1.5 s. There is no case for
   sending born-digital or clean scanned prose to it.
2. **On the two degraded bands of the hand check it is clearly better** (a
   judgment, four bands, one reader). Faxed table band: all visible words
   right, including the three column headers Tesseract lost; Tesseract had
   about 12 of 38 wrong or missing. Thermal receipt band: items and prices
   right, including the price Tesseract dropped; Tesseract had about 8 of 22
   wrong or missing. On the two clean bands both engines were right.
3. **Two cautions from the same hand check.** The receipt's time of day is
   smudged in the image; GLM-OCR printed a definite time that the reader could
   not confirm. That is the invented-detail risk in one token. And the faxed
   table came back column by column (all descriptions, then all
   manufacturers, then all uses), so the words are right and the row
   association is gone.
4. **Agreement with Tesseract on scans is 0.78 by characters.** On most pages
   the two engines mostly agree; the disagreement is where one of them is
   wrong, and this benchmark cannot say which without reading the page.
5. **Throughput was not tuned.** One slot, full-resolution images. Smaller
   images and several slots would raise pages per second. It was not explored
   because heat, not compute, is the limit (next point).
6. **The run breached its own temperature rule.** The rule was to stop at 90 C
   junction. The runner checked before each page, not during one, and paused
   whenever a page would have started at 80 C or more. Even so the junction
   was at or above 90 C after 17 pages. The run should have stopped at the
   first such sample (page 17) and did not; that is a fault in the runner.
   GPU work was stopped after this run. A 0.9B model at one page every four
   seconds is enough to take this card from 50 C to over 80 C in 40 seconds,
   with the fan at less than half its maximum speed.

Not run: dots.ocr Q8_0 and PaddleOCR-VL-1.6. Their weights are on disk and
hashed. They wait on a fan curve or power cap for the card.
<!-- /GPU-RESULTS -->

## Limits of this benchmark

- 58 pages from one month's extract of one practice. It ranks engines; it
  does not estimate corpus-wide error rates.
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
