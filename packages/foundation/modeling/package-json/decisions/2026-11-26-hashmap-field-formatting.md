---
title: The formatter alphabetizes scripts, engines and bin, and strips an empty scripts map
date: 2026-11-26
reversal: Drop scripts, engines and bin from SORTED_MAP_KEYS and scripts from STRIP_EMPTY_KEYS.
governs:
  - src/internal/format.ts#SORTED_MAP_KEYS
  - src/internal/format.ts#STRIP_EMPTY_KEYS
enforcedBy: []
---

Besides the dependency maps, `sortKeys` alphabetizes `scripts`, `engines` and `bin`, and `stripEmptyDependencyMaps` removes an empty `scripts`.
Reason: the `Package` model holds these as `HashMap`s, whose encode order is hash order, so source order is already gone and a code-unit order is the only deterministic one. `sort-package-json` sorts `engines` and `bin` the same way; its grouped `scripts` sort agrees with code-unit order except for `pre*`/`post*` pairing.
The model decodes `scripts` with the same empty-map default as the dependency maps, so an absent key would otherwise encode as `"scripts": {}`.
Rejected: `sort-package-json`'s grouped `scripts` order; leaving `scripts` unsorted, which emits hash order; keeping an empty `scripts`.
