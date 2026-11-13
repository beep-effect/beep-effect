---
title: "Baselines before d8326d5593 are not comparable (declaration-only builds)"
date: 2026-11-13
kind: checkpoint
reversal: "Delete this checkpoint; it records a fact about main and changes no behaviour."
---

#3208 merged at d8326d55935849b4bf6fd29ec4ef80327efd6af8 (2026-11-13T05:44:35Z). Library builds are now `tsrs -p tsconfig.json --emitDeclarationOnly` with no Babel step and no JavaScript in a library dist. Every #build cache entry misses once from that commit, and the first cold run is not a regression. Any wall-time, cache-size or dist-size baseline recorded before it is not comparable with a reading after it, and the first certified nightly must be taken after it. Measured by the owning goal over 181 packages: build 80.9 s to 32.9 s, dist 232.5 MB to 147.9 MB (goals/declaration-only-builds/research/2026-11-13-build-after.md).
