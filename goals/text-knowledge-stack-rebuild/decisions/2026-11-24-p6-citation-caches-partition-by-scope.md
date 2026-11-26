---
title: "P6 (superseded after review): citation caches partition their keys by source scopeRef; the denied observable is a counted miss and a B-scoped receipt"
date: 2026-11-24
lane: "p6"
reversal: "Remove scopeRef from the citation cache keys in server/src/internal/Citation"
---

The citation session caches (server/src/internal/Citation/Resolve.ts, SessionDocument.ts, RuntimeDictionary.ts, RuntimeSet.ts) key on content, so identical text in two scopes shares an entry and a receipt could carry the first scope. P6 adds the source scopeRef to each key. For a principal staffed on both matters, resolving B after A records a miss and returns a receipt whose source.scopeRef is B; for a principal staffed only on A, B is refused at anchor resolution before any cache read. The caches are in-process session state with no stored reader. Answers A10.

Superseded after independent review by decision `2026-11-24-p6-no-law-practice-cache-outlives-a-request-and-path-5-asserts-receipt-scope`. The tables named above are per-call state (`Resolve.ts:108-130`, `SessionDocument.ts:83-127`) and `RuntimeDictionary.ts` and `RuntimeSet.ts` are the CPython parity port (`RuntimeDictionary.ts:1-5,48-57`), so no key changes and the counted-miss observable is replaced by a cross-request receipt-scope check and a guard on future caches.
