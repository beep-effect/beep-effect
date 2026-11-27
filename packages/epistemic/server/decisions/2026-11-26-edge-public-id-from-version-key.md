---
title: An edge version's public id is derived from its logical key and version
date: 2026-11-26
reversal: Mint edge-version public ids with the shared public-id generator and drop the derived format.
governs:
  - src/EdgeAuthority/EdgeAuthority.repo.ts#publicIdFor
enforcedBy: []
---

The public handle of an edge version is `<table>_a<logical key>v<version>`. The `epistemic_edge_logical_version_unique` constraint already allows one row per `(logical_key, version)`, so the derived handle inherits that uniqueness, and its unique index becomes one more conflict backstop for two concurrent writers. The bitemporal edge core reflection (goals/epistemic-bitemporal-edge-core/history/reflections/2026-07-25-claude.md) notes the handle should be revisited if public ids must become opaque.

Rejected: a generated CUID handle, which drags the CUID and crypto services into the repository layer and adds a second uniqueness source.
