---
title: Corpus extract OCR reads again only sources whose first reading is failed or thin
date: 2026-11-26
reversal: OCR every PDF and image regardless of its first reading.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#usableTextBytesPerPage
  - src/commands/Corpus/internal/ServicePrograms.ts#makeExtractOcr
enforcedBy: []
---

Only PDFs and images whose first reading failed in a driver, or produced fewer than
`usableTextBytesPerPage` bytes of text per page (a scan, or a stub text layer), are rendered page
by page and read by Tesseract with a per-page timeout. Deferred sources and sources no engine
routes keep their outcome.

Rejected: OCR on every PDF and image (CPU-heavy, and redundant where a usable text layer exists).
