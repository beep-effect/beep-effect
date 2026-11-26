---
title: One module defines re-quotability, with a byte-exact lint mode and a value-escaping format mode
date: 2026-11-26
reversal: Inline requoteConservative into the quoted-strings fix and requoteEscaping into YamlFormat, or run both callers through one mode.
governs:
  - src/internal/requote.ts#requoteScalarText
  - src/internal/requote.ts#requoteConservative
  - src/internal/requote.ts#requoteEscaping
  - src/internal/requote.ts#isSingleQuotable
  - src/internal/rules/quoted-strings.ts#safeQuoteFix
enforcedBy: []
---
`requoteScalarText` is the one answer to "can this scalar take that quote, and with what text", shared by the `quoted-strings` lint fix and `YamlFormat`'s `requoteScalars`, so the two cannot drift into two dialects. Only untagged, unanchored, single-line string scalars are candidates; a source span holding a line break (LF, or a bare CR, YAML 1.2 b-carriage-return) folds breaks into its value and is skipped whole, since re-quoting the value would collapse the layout.
`"conservative"` is the lint fix's byte-exact mode: a swap or wrap happens only when the raw inner text is the parsed value (no escapes, no doubled quotes) and never holds the target quote. `"escaping"` is the format path's value-preserving mode: only an opposite-quoted source converts (plain and block scalars stay as they are), rendered through the stringifier's own `renderDoubleQuoted` / `renderSingleQuoted`, so flipping a node's `style` and re-stringifying gives the same text. Double to single returns `None` for a value holding tab, LF, CR, another C0 control, DEL or a C1 character, since `''` is single-quoted style's only escape (§7.3.2).
Reason: skipping is always correct and corrupting never is; the lint fix must not rewrite escapes, while formatting may.
Rejected: one escaping mode for both callers, which lets the lint fix re-encode escapes; each caller re-deriving its own rule.
