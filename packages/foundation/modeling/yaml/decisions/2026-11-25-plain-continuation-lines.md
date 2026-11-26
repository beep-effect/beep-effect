---
title: A plain scalar's continuation line lexes as plain text, and one starting with a style indicator joins its token
date: 2026-11-25
reversal: Dispatch every continuation line's first character to the indicator scanners and let a line starting with a quote or `|`/`>` lex as its own scalar.
governs:
  - src/internal/lexer.ts#createScanner
  - src/internal/lexer.ts#isStyleIndicator
enforcedBy: []
---

While the last content token was a plain scalar, `plainFloor` holds the indent of its parent collection (`-1` at the root). A later line whose leading spaces reach past it continues the scalar (YAML 1.2 s-ns-plain-next-line) whatever its first ns-plain-char is, so `scanContent` lexes it as plain text before any indicator scanner sees it. A comment, a `: ` value indicator, a flow indicator in flow context and a line-start document marker still end the scalar, and a line whose run ends at `:` is left to the indicator scanners, which keep the multi-line implicit key diagnostic.

The parser reads a scalar's style from its first source character, so a continuation line starting with a quote or block-scalar indicator is not a token of its own: `scanPlainScalar` absorbs it into the open scalar's token.

Rejected: lexing such lines through the indicator scanners, which turns scalar text into quoted or block scalars and structure tokens.
