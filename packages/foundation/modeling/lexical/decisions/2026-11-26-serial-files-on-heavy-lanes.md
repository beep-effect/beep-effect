---
title: Lexical test files run one at a time on coverage and deep-sweep lanes, in parallel otherwise
date: 2026-11-26
reversal: Delete serialFilesOnHeavyLanes from vitest.config.ts so the shared config's file parallelism applies on every lane.
governs:
  - vitest.config.ts#serialFilesOnHeavyLanes
enforcedBy: []
---

Deep schema sweeps and coverage instrumentation are CPU-bound enough that running both Lexical test files together starves their 400-run properties, so those lanes run the files one at a time while each suite still serializes its own tests. Every other lane keeps file parallelism.
Rejected: the shared `vitest.shared.ts` default of parallel files on every lane, which starves the properties under coverage or a deep sweep.
Rejected: `fileParallelism: false` on every lane, which gives up parallel files on the lanes where they cost nothing.
