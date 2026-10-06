---
"@beep/tesseract": minor
"@beep/poppler": minor
"@beep/repo-cli": minor
---

Two new drivers behind the `@beep/file-processing/PageOcr` contract: `@beep/poppler` counts and renders PDF pages (`pdfinfo`, `pdftoppm`), and `@beep/tesseract` reads one page image with a per-page timeout, reports the mean word confidence, lists the installed language models, and detects a page's script.

`beep corpus extract --ocr` uses them as a CPU reading path: PDFs and images whose first reading is missing, failed (a Tika crash or timeout) or too thin are rendered and read page by page. Each page gets a row in `ocr/pages/<operationId>.jsonl` keyed by engine, with its confidence and character count, and its text in its own file, so a later second reader adds its readings beside these. Languages come from script detection on the first page, fall back to English, and missing language models are reported in `ocr/languages.json` instead of failing the run. No GPU engine is wired.
