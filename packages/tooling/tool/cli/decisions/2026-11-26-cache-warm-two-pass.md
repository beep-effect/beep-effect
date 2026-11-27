---
title: cache warm runs the static tasks first and the tests in a second, bounded pass
date: 2026-11-26
reversal: Run build, check, lint and test in one Turbo pass at default concurrency.
governs:
  - src/commands/Cache/Cache.command.ts#turboWarmStaticTasks
  - src/commands/Cache/Cache.command.ts#turboWarmTestTasks
enforcedBy: []
---

Timing-sensitive suites (glob, jsonc, repo-docgen) starved when tests shared one Turbo pass with every lint, check and build task at default concurrency, a shape hosted CI never runs because it shards the test lanes. The warm runs the CPU-heavy static tasks first and the tests second at `--concurrency=4`. `test` depends only on the `transit` topology task, so the split re-executes nothing twice.

Rejected: one Turbo pass over all four tasks (the starved test suites above).
