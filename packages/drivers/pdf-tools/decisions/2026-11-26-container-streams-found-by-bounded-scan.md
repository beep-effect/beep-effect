---
title: Object and cross-reference streams are found by a bounded scan of the file
date: 2026-11-26
reversal: Drop containerStreamsOf from undecodableStreamsOf in src/internal/structure.ts and check only the objects pdf-lib adds to the document.
governs:
  - src/internal/structure.ts#containerStreamsOf
  - src/internal/structure.ts#lastObjHeaderBefore
  - src/internal/structure.ts#markerOffsets
enforcedBy: []
---

pdf-lib decodes object streams and cross-reference streams itself, with a decoder that ignores the Adler-32 checksum, and never adds them to the document.
The stream check therefore finds them in the file: for each `/ObjStm` or `/XRef` name it parses the object after the last `N G obj` header within 64 KiB before the name and keeps it when it is a stream of that type.
At most 128 names are taken across both families, names inside stream data included, so a crafted file cannot make the scan decode an unbounded number of overlapping windows; past that, `containerDiscovery` reports `limit-reached` and inspection still succeeds.
Each window keeps only its last header match, so dense fake headers do not allocate an array of every match per window.
Rejected: checking only the document's objects, which never judges a broken object or cross-reference stream.
