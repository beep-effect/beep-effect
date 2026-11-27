---
title: Generated output is formatted by explicit path without VCS ignore files
date: 2026-11-26
reversal: Drop `--vcs-use-ignore-file=false` from the Biome invocation in src/internal/format.ts and let Biome apply the clone's ignore files.
governs:
  - src/internal/format.ts#makeFormatter
enforcedBy: []
---

Anchor for ruling 83 (C4-8) in `goals/time-to-certainty/research/decisions.md`, which records why a tool given a path the repository owns reads no ambient VCS ignore state, a clone's `.git/info/exclude` included.
