---
title: "The cache path is proved by the walled resolver and a static module-cache guard"
date: 2026-11-24
lane: "p6"
reversal: "Replace CitationCache.scope.test.ts with an end-to-end citation engine run under two matters once the native lanes run in the server test shard."
---

Design path 5 asks that identical bytes under two matters never share a cache entry. The composed citation engine needs native runtimes the server shard does not load, and mention receipts already embed the source identity. The proof is two-part: AuthorizedSourceTextResolver resolves identical bytes under matter A and then matter B for a principal granted both, and each identity keeps its own scopeRef; a static guard scans src/internal/Citation for module-level Map, Set, MutableHashMap, MutableRef, Ref.makeUnsafe or Cache declarations and for Cache.make, ScopedCache, cachedWithTTL, cachedFunction and Effect.cached outside NativeLane.ts. Module-level WeakMaps keyed by request objects are allowed.
