---
title: Corpus extract OCR re-reads failed or thin first readings and records beside them
date: 2026-11-26
reversal: OCR every PDF and image, and replace the first reading's text with the OCR text.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#makeExtractOcr
enforcedBy: []
---

OCR is a second reader, not a replacement. Only PDFs and images whose first reading failed in a driver, or produced under 50 bytes of text per page (a scan or a stub text layer), are read again; deferred and unrouted sources keep their outcome. Every page gets a row in `ocr/pages/<operationId>.jsonl` keyed by engine, with its text in its own file, so a later reader adds rows beside these. The first reading is kept beside the OCR text, and a source with none gets a metadata file so resume finds every artifact its marker implies.

Rejected: OCR on every source (CPU-heavy, and redundant where a usable text layer exists); overwriting the first reading with OCR text (loses evidence and blocks a second OCR engine).
