---
title: Inline-pass refactors are pinned by a commonmark.js differential and by GFM digests of a self-contained corpus
date: 2026-11-26
reversal: Replace the digest tests with a GFM-capable oracle differential, or delete them and inlineCorpus once no refactor needs the pin.
governs:
  - test/internal/inlines/inlineCorpus.ts#inlineCorpus
  - test/internal/inlines/inlineRefactor.oracle.test.ts#corpusDigest
  - test/internal/inlines/inlineRefactor.oracle.test.ts#emphasisSources
  - test/internal/inlines/inlineRefactor.oracle.test.ts#linkSources
enforcedBy: []
---

`processEmphasis`, the close-bracket handler, the reference grammar and the GFM autolink-literal scanners were split by their natural seams, and none may change behaviour. Two oracles pin them. For CommonMark, commonmark.js 0.31.2 judges seeded sources dense in the constructs each split touched: delimiter runs beside astral letters (the trigger table reads one UTF-16 unit, half of an astral character), link and image brackets, and reference definitions.

For GFM, which commonmark.js does not implement, the oracle is the engine before the refactors: SHA-256 digests of the materialized phrasing nodes over a 20,000-source corpus seeded at 20,261,022. The GFM digest includes the #2137 corrections to escaped email recognition and URL destinations; the CommonMark digest is unchanged.

`inlineCorpus` is a seeded mulberry32 stream over a token vocabulary chosen to reach every autolink-literal branch (www., schemes, mailto:/xmpp: prefixes, re-anchoring `@`, trailing punctuation and entity trimming), strikethrough, emphasis flanking beside astral punctuation (U+10100), an astral symbol (🎉) and an astral letter (U+1D400), each a surrogate pair whose halves the flanking rules must never classify on their own, and link brackets. It imports nothing but `effect/Array`, so the same sources come out of every engine version, which is what lets a digest recorded before a refactor gate the code after it.

Rejected: a fast-check or engine-derived corpus whose sources could drift between versions, per-source snapshot files, and leaving GFM inline constructs unpinned.
