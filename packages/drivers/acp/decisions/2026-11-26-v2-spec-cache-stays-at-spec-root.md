---
title: The generation-2 spec cache stays at spec/, generation 1 caches under spec/v1/
date: 2026-11-26
reversal: Set V2_CACHE_DIR to "spec/v2", move the cached assets and update every reader of the cache paths.
governs:
  - scripts/generate.ts#V2_CACHE_DIR
enforcedBy: []
---

Generation 2 keeps the historical cache paths (`spec/*.unstable.json`).
Reason: consumers that read the cache by path keep working.
Rejected: a symmetric `spec/v2/` directory.
