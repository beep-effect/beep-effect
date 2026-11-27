---
title: Corpus extract OCR records its reading beside the first reading instead of replacing it
date: 2026-11-26
reversal: Replace the first reading's text with the OCR text and drop the per-engine page rows.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#makeExtractOcr
enforcedBy: []
---

OCR is a second reader, not a replacement. Every page gets a row in
`ocr/pages/<operationId>.jsonl` keyed by engine, with its text in its own file, so a later reader
adds its rows and texts beside these instead of over them. The first reading is evidence too: it
is kept beside the OCR text, and a source that had no first reading gets a metadata file so
resume finds every artifact its marker implies.

Rejected: overwriting the first reading with the OCR text (loses evidence and leaves no room for
a second OCR engine).
