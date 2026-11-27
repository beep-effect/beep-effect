---
title: A multi-page conversion runs at unversioned pdf and stamps the requested header
date: 2026-11-26
reversal: Pass `pdf${request.pdfVersion}` for every request in rsvgFormatOf and delete stampHeader in src/PdfTools.service.ts.
governs:
  - src/PdfTools.service.ts#rsvgFormatOf
  - src/PdfTools.service.ts#stampHeader
enforcedBy: []
---

rsvg-convert takes several input SVGs, one page each in order, only with the unversioned `pdf` format, which cairo writes as PDF 1.7.
A multi-page conversion therefore runs at `pdf` and the requested version is written over the header line, same length so every offset stays valid; a single SVG converts at its own `pdf1.x`.
Reason: cairo's 1.5, 1.6 and 1.7 output differ only in that header line (checked on rsvg-convert 2.63.2 with cairo 1.18.6). PDF 1.4 output differs in structure, so `SvgToPdfRequest` allows it for a single SVG only.
Rejected: converting page by page and merging with pdf-lib. pdf-lib cuts a stream whose /Length is indirect at the EOL before `endstream`, which drops a final 0x0D data byte and truncates the stream.
