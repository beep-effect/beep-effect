---
title: The test HTML writer departs from commonmark.js only where mdast's shape or cmark-gfm's extensions require it
date: 2026-11-26
reversal: Percent-encode destinations in the parser, store parent pointers, or render definitions in place, and re-run the 652-example corpus against commonmark.js.
governs:
  - test/support/htmlWriter.ts#normalizeUri
  - test/support/htmlWriter.ts#URI_TOKEN
  - test/support/htmlWriter.ts#TAGFILTER_RE
  - test/support/htmlWriter.ts#collectFirstByLabel
  - test/support/htmlWriter.ts#flowStep
  - test/support/htmlWriter.ts#phrasingStep
  - test/support/htmlWriter.ts#HtmlWriter
enforcedBy: []
---

URLs: commonmark.js applies mdurl's `encode` to destinations at parse time; this writer applies it at render time, because mdast defines `url` as the decoded destination (what `mdast-util-to-hast` assumes) and keeping the node faithful to mdast matters more than matching commonmark.js's staging. The parser therefore stores the unescaped, un-percent-encoded destination, and this is the only place encoding happens. `URI_TOKEN` tries mdurl's decisions in mdurl's order (a valid percent escape, a surrogate pair, a lone surrogate, any other UTF-16 unit, with no `u` flag so `[\s\S]` is one unit), and a lone surrogate encodes as U+FFFD instead of throwing.

Tree shape: mdast nodes carry no parent, so the tight-list `<p>` suppression receives tightness from its caller; absent `spread` reads as tight, the default of commonmark.js's `listTight`. A soft break is a raw newline in a text value, which is what commonmark.js's default `softbreak: "\n"` emits. Images have no children, so the parser computes `alt` as commonmark.js does (the plain text of the bracket content); `lang` is already the first word of the info string.

Definitions: the parser keeps definitions and leaves references unresolved, so the writer resolves them, first definition winning, through a hash map because labels are attacker-controlled and `__proto__` must be a key. `Definition` and `FootnoteDefinition` stay in the tree because this package edits markdown and render nothing in place; MDX flow nodes, frontmatter and MDX ESM heads render nothing either, as gray-matter and remark strip frontmatter.

Footnotes mirror cmark-gfm's `process_footnotes` in one pass: a footnote is numbered at its first reference in document order, later references reuse the number with their own `fnref-*` suffix, and the section renders after the body, once every count is known. cmark-gfm instead runs a dedicated pass and relocates the definition nodes. The task-list marker follows cmark-gfm, right after `<li>` whatever the tightness.

Output: `lastOut` is the whole last string written, as in commonmark.js, because `cr()` compares it with `"\n"` by identity, so each footnote-section segment gets its own `lit()` and `cr()`; a `lit()` with an internal newline would make the next `cr()` print a blank line. The tagfilter matches a disallowed tag only before a boundary character, never at `$`, because `tagfilter.c`'s `is_tag` refuses a tag name that runs off the checked span.

Rejected: percent-encoding destinations in the parser, parent pointers on mdast nodes, a dedicated footnote pass that relocates definitions, and a tagfilter boundary that accepts end of input.
