---
title: Git.layer is provided once at the repo-cli runtime edge
date: 2026-11-26
reversal: Drop Git.layer from BaseLayers and provide Git.make at each leaf again.
governs:
  - src/bin-main.ts#BaseLayers
enforcedBy: []
---

Anchor for D-06 in the decision log of `goals/repo-cli-gh-git-consolidation/SPEC.md`, which records providing `Git.layer` once at the runtime edge so command paths take `Git` from their requirements.
