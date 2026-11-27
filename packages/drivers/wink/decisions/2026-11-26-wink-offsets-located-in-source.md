---
title: Wink token and entity offsets are located in the source text, not rebuilt from precedingSpaces
date: 2026-11-26
reversal: Compute offsets as previousEnd + precedingSpaces.length again and delete the forward search in makeToken and tokenCharSpans.
governs:
  - src/WinkTokenization.service.ts#makeToken
  - src/WinkBackend.service.ts#tokenCharSpans
enforcedBy: []
---

wink-nlp 2.4 caps a token's stored preceding spaces at 65,534, so an offset rebuilt as `previousEnd + precedingSpaces.length` drifts after a longer whitespace run. Both sites search each token's text forward from the previous token's end instead. `makeToken` keeps the rebuilt offset only as the fallback for a token whose text is not in the source; `tokenCharSpans` returns `None` when any token is missing.
Rejected: rebuilding offsets from `precedingSpaces`, which reports wrong spans after 65,534 spaces.
