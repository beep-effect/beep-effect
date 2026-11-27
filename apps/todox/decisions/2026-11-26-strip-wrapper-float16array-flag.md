---
title: next.config strips --js-float16array from process.execArgv before Next spawns workers
date: 2026-11-26
reversal: Delete execArgvWithoutFloat16Array and its assignment once no CI wrapper injects --js-float16array into node.
governs:
  - next.config.ts#execArgvWithoutFloat16Array
enforcedBy: []
---

A job-wide node wrapper in the coverage lane injected --js-float16array into every node process. Next copies process.execArgv into its build workers' NODE_OPTIONS, where V8 rejects feature flags, so the config drops the flag before any worker spawns. PR runs resolved heavy.yml from main, so the guard had to outlive the branch that removed the wrapper.

Rejected: removing the wrapper from heavy.yml alone, which left PR runs on the old main workflow failing.

Accepted limit: transitional. Delete the filter once nothing that loads next.config.ts (next build, next dev, or a test importing it) runs under a node whose execArgv carries --js-float16array. The only grant left is vitest.shared.ts's forked-worker execArgv below Node 24, and no todox test imports next.config.ts.
