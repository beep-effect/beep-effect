---
title: UTF-8 is validated by the package's own scan, and anything else falls back to Windows-1252
date: 2026-11-22
reversal: "Decode with TextDecoder(\"utf-8\", { fatal: true }) and refuse, or report without an offset, bytes that are not UTF-8."
governs:
  - src/internal/encoding.ts#firstInvalidUtf8
  - src/internal/encoding.ts#detectEncoding
enforcedBy: []
---

A byte-order mark names UTF-8 or UTF-16; otherwise valid UTF-8 is read as UTF-8 and anything else as Windows-1252, the encoding Excel writes "CSV (Comma delimited)" in and the one the app's old reader used.

The scan finds the first invalid byte, refusing overlong forms and surrogates, so `CsvEncodingFallback.firstInvalidByte` and `InvalidUtf8.byteOffset` carry an offset.

Rejected: `TextDecoder` with `fatal: true`, which only throws and gives no offset; refusing non-UTF-8 input, which turns away every file Excel saves by default.
