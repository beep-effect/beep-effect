---
title: DOCX input is re-packed from validated, Mammoth-read parts before Mammoth parses it
date: 2026-11-26
reversal: Pass the source bytes straight to mammoth.extractRawText with a declared-size cap.
governs:
  - src/DocText.service.ts#boundedDocx
enforcedBy: []
---

`boundedDocx` streams the archive through fflate, charging actual inflated output before a chunk is retained, so forged ZIP size declarations cannot bypass the byte budget. Deferred UnzipInflate replays the same 1 KiB compressed chunks, so only parts that are read are inflated.
Every entry name, ignored media included, is checked for duplicates, absolute paths and backslashes first: JSZip normalizes such aliases and may let one overwrite another part.
Only the parts Mammoth's docx-reader reads before raw-text conversion are inflated and validated, then re-packed into a stored archive, so JSZip cannot later select a different, unvalidated entry from an inconsistent central directory.
Part selection copies Mammoth's reader: its literal joinPath (one leading slash stripped, no dot or slash normalization), the first existing target per relationship type, and namespace resolution used only for element selection, where an unbound prefix resolves to no namespace instead of failing the part. Well-formedness errors still reject the part.
Rejected: handing Mammoth the original archive under a declared-size cap, which trusts the sizes and central directory an attacker controls.
Rejected: spec-normalized OPC part resolution, which would validate different parts than the ones Mammoth then reads.
