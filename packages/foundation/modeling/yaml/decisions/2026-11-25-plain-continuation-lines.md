---
title: A plain scalar's continuation line lexes as plain text, and one starting with a style indicator joins its token
date: 2026-11-25
reversal: Dispatch every continuation line's first character to the indicator scanners and let a line starting with a quote or `|`/`>` lex as its own scalar.
governs:
  - src/internal/lexer.ts#createScanner
  - src/internal/lexer.ts#isStyleIndicator
  - src/internal/composer/scalars.ts#collectMultilineKey
  - src/internal/composer/scalars.ts#absorbMistokenizedLine
enforcedBy: []
---

While the last content token was a plain scalar, `plainFloor` holds the indent of its parent collection (`-1` at the root). A later line whose leading spaces reach past it continues the scalar (YAML 1.2 s-ns-plain-next-line) whatever its first ns-plain-char is, so `scanContent` lexes it as plain text before any indicator scanner sees it. A comment, a `: ` value indicator, a flow indicator in flow context and a line-start document marker still end the scalar, and a line whose run ends at `:` is left to the indicator scanners, which keep the multi-line implicit key diagnostic.

The parser reads a scalar's style from its first source character, so a continuation line starting with a quote or block-scalar indicator is not a token of its own: `scanPlainScalar` absorbs it into the open scalar's token.

The composer folds such a token like the parts after it (`collectMultilineKey`), and after a line break it absorbs what the lexer still splits off a continuation line: any node but a flow or block scalar (an anchor, tag, alias, directive or block sequence) may be mis-tokenized plain text (3MYT, FBC9, XLQ9, AB8U), so `absorbMistokenizedLine` merges its raw source line, ending at the line's last non-blank character, and skips every child on it. A directive inside document content is always a continuation, since a real one appears only before `---` (XLQ9); any other node must sit past column 0 and at or beyond the caller's minimum continuation column (ZVH3).

Rejected: lexing such lines through the indicator scanners, which turns scalar text into quoted or block scalars and structure tokens.
