---
title: The Markdown writer escapes only what a parser would read back differently
date: 2026-11-22
reversal: Backslash-escape every ASCII punctuation character in text, titles and alt text, and drop the context-specific `$`, scheme-colon and email `@` escapes.
governs:
  - src/Md.render.ts#escapeMathFreeMarkdownLiteral
  - src/Md.render.ts#escapeMarkdownPhrasingMarkers
enforcedBy: []
---

`Md.render` escapes a character only where a CommonMark, GFM or pandoc-math parser would otherwise read the text back as a different document. `escapeMarkdownText` covers the block and inline markers, and an `&` that opens something shaped like a character reference is escaped so it stays literal.

Strings no math recognizer reads (titles, alt text, admonition titles) take only that literal escape. Phrasing text also passes through the bridge's inline-math recognizer when math parsing is on, and GFM links bare URLs and email literals there, so it additionally escapes every `$` that could open math, every `http(s)` scheme colon and the `@` of an email literal.

Rejected: escaping every punctuation character, which CommonMark permits and which needs no per-construct rule. It makes rendered Markdown unreadable and diverges from the minimal output the writer tests pin; render(parse(render(x))) must still equal render(x).
