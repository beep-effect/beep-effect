---
title: The lexer is the pipeline's one mutable module, a closure-held state machine scanned per character
date: 2026-11-25
reversal: Rewrite createScanner as a fold over immutable scanner state (or an Effect Stream of tokens) and let lexAll collect its output.
governs:
  - src/internal/lexer.ts#createScanner
  - src/internal/lexer.ts#lexAll
enforcedBy: []
---

`createScanner` is the state machine: cursor, line, column, line-indent lock, flow depth, block scopes and the pending-token queue live in mutable locals of one closure, advanced one character at a time. `lexAll` only drives it to completion. Every other engine module (CST parser, composer, stringifier) stays pure and reads the token records it returns.

The scanner runs on every parse, every edit and every lint pass, and `setPosition` replays from offset 0, so per-character allocation is the cost that matters.

Rejected: an immutable scanner state copied per character, and an Effect `Stream` of tokens; both allocate per character on the hottest path and buy no purity the token records do not already give the downstream modules.
