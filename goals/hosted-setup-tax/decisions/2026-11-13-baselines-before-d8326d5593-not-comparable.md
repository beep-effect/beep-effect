---
title: "Baselines before d8326d5593 are not comparable (declaration-only builds)"
date: 2026-11-13
kind: checkpoint
lane: "chore/ci-goals-finish"
reversal: "Delete this checkpoint; it records a fact about main and changes no behaviour."
---

declaration-only-builds PR 2 (#3208) merged at `d8326d55935849b4bf6fd29ec4ef80327efd6af8` (2026-11-13T05:44:35Z). Library builds are now `tsrs -p tsconfig.json --emitDeclarationOnly`: no Babel step, no `babel` script key, no JavaScript in a library dist.

- Every `#build` cache entry (local, remote, CI) misses once from that commit. The first run after merging main rebuilds cold and is not a regression.
- Any wall-time, cache-size or dist-size baseline this packet recorded before that commit is not comparable with a reading after it. Re-take the baseline before reading an after-number.
- Measured by the owning goal (181 packages, serial, fastest of three): build 80.9 s to 32.9 s, dist 232.5 MB to 147.9 MB, compile unchanged (`goals/declaration-only-builds/research/2026-11-13-build-after.md`).
- A lane editing generated files (package.json scripts, the catalog, turbo.json, the policy fingerprint, the cache baseline, the check-census baseline) merges main first and re-runs the generators.
