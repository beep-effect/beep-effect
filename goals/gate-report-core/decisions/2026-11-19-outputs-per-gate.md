---
title: "Each task declares its own gate directory as output, and its writer is in its hash"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Widen the output globs to the whole gates directory and drop the transit dependencies."
---

The `test` task declares the test gate directory and the `check` task declares the check gate directory, never the whole gates directory, so a check cache hit cannot restore a stale test record. The `test` task depends on the Vitest adapter's transit task and the `check` task on the record library's, so a change to the code or the format that writes a cached record invalidates it. A restored record keeps its run id, and a cache hit prints a console identical to the miss.
