---
title: "Paired real-file evidence isolates ten bytecode differences"
date: 2026-11-06
kind: checkpoint
lane: "codex/cache-import-bytecode-20261106"
reversal: "Remove this checkpoint projection while retaining the immutable paired observation reports and failed comparison."
---

PR #2777 merged as e68e1d1e06 and its lane is retired. Its final coverage comparison passed. Two new real source-only observations, runs 42259397428 and 42260607808, both pass source preservation, matching reads and each declared digest at that accepted source. The bounded diagnostics take 44.928 and 57.017 seconds; each retains 340 node-gyp file hashes inside the unchanged four-MiB aggregate report cap.

The cross-run comparison still fails: only ten bytecode-classified file contents differ. All source fields other than installedDependencies.sha256, every package metadata hash, and all thirteen controls and resource bounds agree. Preserve both real digests and the failed pair; bytecode-generation details remain unproven. Prepare the source-only import-cache prevention experiment and hosted controls, then observe fresh accepted candidate source before claiming repeatability.

Both complete Turbo goals remain active. No producer approval, production trust, task qualification, signing activation, representative window or whole-goal acceptance is granted by these observations.
