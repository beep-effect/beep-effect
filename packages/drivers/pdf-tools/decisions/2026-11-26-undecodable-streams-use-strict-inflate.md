---
title: The stream check judges FlateDecode streams with a strict inflate under one byte budget
date: 2026-11-26
reversal: Replace the inflateSync call in inflateFailure in src/internal/structure.ts with a Z_SYNC_FLUSH inflate and drop the budget charge for failures.
governs:
  - src/internal/structure.ts#inflateFailure
enforcedBy: []
---

A strict inflate (the default Z_FINISH flush) fails on a stream that is cut short anywhere, its Adler-32 checksum included, so a truncated stream is reported.
Every byte zlib produces is charged to the `maxInflatedBytes` budget. zlib does not report what a failed inflate produced, so a failure is charged the most its input could have produced: no deflate stream inflates past 1032 times its own size.
One inflate is asked for at most the runtime's buffer limit: Bun refuses a larger `maxOutputLength` (4 GiB there) with ERR_OUT_OF_RANGE, which would read as an undecodable stream. Once the budget is spent, or a stream would inflate past that limit, the stream is not judged and the check stops with `limit-reached`.
Rejected: a lenient inflate like the one pdf-lib uses for object streams, which ignores the Adler-32 checksum and so cannot catch a corrupted or missing checksum.
