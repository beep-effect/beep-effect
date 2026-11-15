---
title: "Use incremental Noble hashing only for descriptor candidate selection"
date: 2026-11-14
reversal: "Replace selection with a multi-part Effect Digest API when available, retaining exact preflight allocation ordering and the cross-implementation vectors."
---

Effect v4 Digest accepts one contiguous byte array and provides no streaming or multi-part input. The existing catalog dependency @noble/hashes is declared by the server package to hash the width byte and borrowed bytes incrementally without a pattern-sized concatenation before exact frame preflight. Selection chooses only a candidate; the captured Effect Digest service remains authoritative after preparation. The permanent registry regression compares selection with that service for all three widths, empty storage and 36 SHA-256 boundary vectors. No cache or compiled program is retained. Dependency and cache-policy validation is included in the root beep lint receipt.
