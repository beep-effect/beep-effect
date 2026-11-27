---
title: Tool discovery caches evidence under a structural (name, probe) key
date: 2026-11-26
reversal: Key the ToolDiscovery cache by an encoded string of the tool name and version probe instead of EvidenceKey.
governs:
  - src/ToolDiscovery.ts#EvidenceKey
enforcedBy: []
---

The discovery cache is keyed by `EvidenceKey`, a schema value holding the tool name and its `VersionProbe`, and nothing else.
Reason: the cache's `MutableHashMap` keys on `Equal`/`Hash`, which Effect implements structurally for plain schema values, nested union members included, so the key carries the probe itself and the lookup needs no side table to recover it. Policy fields (`source`, `onMismatch`) are left out because each call applies them to the cached evidence: two tools differing only in policy share one probe, two asking for a version differently do not.
Rejected: a string key rendered from the name and the encoded probe, which needs an encoding step and a side table to get the probe back.
