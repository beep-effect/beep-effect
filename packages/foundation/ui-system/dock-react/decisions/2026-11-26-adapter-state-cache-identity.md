---
title: Adapter state is cached in a WeakMap by graph, then by a measurement-config value key
date: 2026-11-26
reversal: Key the cache with an effect HashMap on the graph, or key the inner map by the captureLayer reference.
governs:
  - src/internal/AdapterState.ts#states
  - src/internal/AdapterState.ts#stateKey
enforcedBy: []
---

The outer cache is a `WeakMap` keyed by graph identity: graph identity and lifetime belong to the host, and a weak key retains no disposed graph and needs no structural hashing of a live graph.
The inner key is built from the measurement-config values (gap, minGroupExtent) plus the title-minima provider's semantic `captureKey`, because the derived geometry atoms close over those inputs.
Rejected: an effect `HashMap` keyed by the graph, which hashes the graph structurally and keeps every disposed graph alive.
Rejected: keying by the `captureLayer` reference, which mints a fresh retained state on every render when a host builds the layer inline; and leaving the provider out of the key, which shares stale metrics across distinct providers.
