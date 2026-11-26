---
title: The commonmark.js empty-paragraph defect is corrected on the oracle's side
date: 2026-11-26
reversal: When the tripwire's first assertion fails (commonmark.js stopped emitting `<p></p>`), delete correctOracleDefect, renderOracle's replaceAll and the tripwire test.
governs:
  - test/oracle.property.test.ts#correctOracleDefect
  - test/internal/blockParser.property.test.ts#correctOracleDefect
  - test/internal/inlines/inlineRefactor.oracle.test.ts#renderOracle
enforcedBy: []
---

commonmark.js 0.31.2 emits a content-free `<p></p>` for a paragraph that held only link reference definitions and was then interrupted by a thematic break, as in `[a]: /a\n---\n`. In its `lib/blocks.js` the setext-heading start strips the definitions from `_string_content` itself (returning 0 when nothing survives, so `---` falls through to a thematic break), but `processInlines` only unlinks a reference-only paragraph when its own stripping loop set `hasReferenceDefs`; the flag does not cross the two sites, so the emptied node renders.

This is not CommonMark: none of the spec's 652 examples expects `<p></p>`, and an empty paragraph has no source construct. Our tree for that input is `definition` + `thematicBreak`, rendering to `<hr>`. Every differential suite strips `<p></p>` from the oracle's HTML, and the tripwire in `oracle.property.test.ts` pins the oracle's behaviour (the input was found by that suite's generator and minimized).

The correction is narrow by construction: our writer never emits an empty paragraph (a `Paragraph` always has children), so it can only equalize the oracle's spurious ones.

Rejected: skip-listing the disagreeing input, and emitting an empty paragraph ourselves to match the oracle.
