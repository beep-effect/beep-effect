---
title: forceDefaultStyles renders scalars, keys and document terminators the way libyaml's canonical emitter does
date: 2026-11-26
reversal: Render canonical scalars and keys with the fidelity rules and move each rule below into test/e2e/support/canonical.ts.
governs:
  - src/internal/stringifier.ts#renderSingleLineString
  - src/internal/stringifier.ts#renderPlainMultiline
  - src/internal/stringifier.ts#renderCanonicalMultiline
  - src/internal/stringifier.ts#multilineNeedsDoubleQuote
  - src/internal/stringifier.ts#renderScalarNodeValueLines
  - src/internal/stringifier.ts#canonicalUnquotedKey
  - src/internal/stringifier.ts#needsExplicitNull
  - src/internal/stringifier.ts#canonicalEmptyDocument
  - src/internal/stringifier.ts#needsCanonicalTerminator
  - src/internal/stringifier.ts#isTerminatedRootScalar
  - src/internal/stringifier.ts#endsWithKeepChomp
enforcedBy: []
---
Canonical mode strips comments, normalizes tags and replaces source presentation, but keeps each multi-line string's style (block literal, block folded or double-quoted). A single-line value holding non-ASCII text is double-quoted so `renderDoubleQuoted` escapes it as `\uXXXX`.
A multi-line plain or single-quoted value renders single-quoted with fold encoding, as libyaml does, except a nested value ending in a newline (its closing quote would be invalid inside a block collection) and a value with whitespace after a line break (flow folding drops it), which are double-quoted. A block-style value with an interior line's trailing whitespace or a space-then-tab continuation is double-quoted as well, since a block scalar cannot carry it faithfully. In every mode, a value of only spaces and newlines is double-quoted unless its source style is already a block style: a new block scalar cannot represent it faithfully, while a newline-only body is valid under `|+`.
A quoted identifier key (letters, digits, `_`) from a single-line flow map loses its quotes in the block output (5T43); multi-word keys keep them (9BXH). A value-less pair with a non-empty plain key in a multi-line flow root renders `key: null` (4ABK); nested flow maps (8KB6) and single-line flow roots keep `key:`.
`...` closes the document after a keep-chomped final block scalar, which would otherwise swallow the trailing blank lines, after `---<TAB>scalar` (K54U), and after `---` before a plain root scalar that is anchored and untagged (binding the anchor to one node) or multi-line with a ` %` directive-like run a follow-on parser could misread (XLQ9); other multi-line plain roots (3MYT, EX5H, EXG3) stay unterminated. An empty canonical document renders `---` only for a source start marker, with `...` for an end marker, and a bare `...` renders nothing.
Reason: the yaml-test-suite fixtures are libyaml canonical output, and these rules read node fields (style, sourceMultiline, anchor) that the harness only sees as rendered text.
Rejected: emulating them in the harness beside the framing rules of `canonical-normalizer-emulates-libyaml`.
