---
title: Bad block scalar headers enter the block-scalar scanner and recover as error tokens
date: 2026-11-25
reversal: Drop `0` from blockHeaderCharacter and let text after a header fall through to the plain-scalar scanner.
governs:
  - src/internal/lexer.ts#blockHeaderCharacter
  - src/internal/lexer.ts#isBlockScalarHeaderStart
  - src/internal/lexer.ts#createScanner
enforcedBy: []
---

`|` or `>` opens a block scalar only outside flow context and when followed by a separator, EOF, `#`, a chomping indicator or a digit. `0` is admitted so `|0` reaches `scanBlockScalar`, whose header rejects it as an error instead of lexing it as plain text.

After the indicators only blanks, a separated comment or the line end may follow. Other text (`> first line`) is skipped to the line end or a separated `#` outside quotes, emitted as one `error` token, and a comment that ends it is queued behind it.

Rejected: excluding `0` and leaving header junk to the plain scanner, which hides invalid headers as scalar text.
