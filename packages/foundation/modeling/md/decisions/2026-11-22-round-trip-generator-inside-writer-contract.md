---
title: The round-trip generator stays inside the writer contract and names every other exclusion as a gap
date: 2026-11-22
reversal: Generate the round-trip property's documents from the full Md schema arbitrary and skip or allow-list the cases that do not read back.
governs:
  - test/support/bridgeArbitrary.ts#BridgeDocumentArbitrary
  - test/support/bridgeArbitrary.ts#ROUND_TRIP_GAPS
  - test/support/bridgeArbitrary.ts#normalizeBridgeDocument
enforcedBy: []
---

The Md.render to Md.parse property generates only documents the bridge can invert: no RawMarkdown or Embed, no nested links, emphasis-like children with alphanumeric edges (atoms joined by a space or hard break, so no two emphasis-like atoms touch), no CR or NUL, no whitespace at line edges, no newlines in headings, cells or alt text, no list mixing tight and loose items, display math only at the top level (it is recognized only at column 1), and footnote references only to definitions generated with them, each referenced once. Text, code and destinations still carry `$`, `&` and character-reference shapes, math is generated, adjacent lists may share a marker family, and an admonition may open on any block.

Every other exclusion is a named entry in `ROUND_TRIP_GAPS`, which the bridge-corpus ledger prints so the gaps stay visible in review. `normalizeBridgeDocument` erases only writer canonicalization: adjacent Text runs merge (the parser reads one run where the generator joined several), RawHtml becomes Text (the built-in Markdown adapter escapes it), and footnote labels fold to lower case (CommonMark label matching is case-insensitive and the kit keeps the folded identifier).

Rejected: the full schema arbitrary with skipped failures. A skip list hides a writer regression as one more skipped case, where a named gap needs an owner and shows up in the ledger.
