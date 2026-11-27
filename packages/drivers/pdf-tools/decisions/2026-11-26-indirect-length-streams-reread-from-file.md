---
title: A stream whose parsed bytes disagree with its declared /Length is re-read from the file
date: 2026-11-26
reversal: Return stream.contents directly from rawBytesOf in src/internal/structure.ts, once pdf-lib keeps a final 0x0D data byte of a stream with an indirect /Length.
governs:
  - src/internal/structure.ts#rawBytesOf
enforcedBy: []
---

pdf-lib ends a stream whose /Length is an indirect object at the first `endstream`, minus the EOL before it, so data that itself ends in 0x0D loses that byte.
When the parsed bytes and the declared length disagree, the stream check re-reads the data from the file: the definition of the object, last one first (the one pdf-lib keeps), whose data starts with pdf-lib's bytes, runs the declared length and is followed by `endstream`.
When no definition in the file fits that length, pdf-lib's bytes are judged.
Reason: a strict inflate of the shortened bytes fails, so the check would report a valid stream as undecodable.
Rejected: judging pdf-lib's parsed bytes as they are, which reports those false failures.
