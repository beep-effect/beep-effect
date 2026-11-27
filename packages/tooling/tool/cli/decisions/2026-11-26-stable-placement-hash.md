---
title: default placement hashes package names with a hand-written FNV-1a
date: 2026-11-26
reversal: Hash with a runtime or library string hash, accepting that placements move when it changes.
governs:
  - src/commands/Ci/CiLanePartitions.ts#stablePackageNameHash
enforcedBy: []
---

A package that no partition names is placed by hashing its name. The hash is FNV-1a over UTF-16 code units, spelled out in the module so a placement never moves when a runtime or library changes its own string hash.

Rejected: `Hash.string` or another runtime hash, whose output is not a stable contract across versions.
