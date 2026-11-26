---
title: The quoted-scalar and flow-end flags roll one token behind and survive flow trivia
date: 2026-11-25
reversal: Require a separator after every `:` value indicator, and clear afterQuotedScalar and afterFlowCollectionEnd on every token.
governs:
  - src/internal/lexer.ts#createScanner
enforcedBy: []
---

`rollTokenFlags` copies `afterQuotedScalar` and `afterFlowCollectionEnd` into `prevWasQuoted` and `prevWasFlowEnd` before each token, and the `:` and `#` scanners read the copies. In flow context YAML 1.2 §7.18 allows a `:` value indicator with no following separator right after a quoted (JSON-like) key or a flow collection used as an implicit key (`[ {JSON: like}:v ]`), and the flags survive whitespace, line breaks and comments so `{ "foo"\n  :bar }` and `{ "foo" # c\n  :bar }` still read `:` as the indicator.

`#` opens a comment only after separation (§6.6); right after a quoted scalar (`"value"# comment`) it is an error token, elsewhere it is plain scalar text.

Rejected: requiring a separator after `:` everywhere, which rejects JSON-style flow mappings; resetting the flags on every token, which loses the indicator across a line break or comment.
