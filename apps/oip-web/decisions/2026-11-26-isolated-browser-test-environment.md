---
title: isolated browser test environment
date: 2026-11-26
reversal: Inherit live provider variables and share the coverage worker module graph.
governs:
  - vitest.config.ts#browserTestEnv
  - vitest.config.ts#isolateBrowserTests
enforcedBy: []
---

Clear provider variables before module loading because Effect ConfigProvider snapshots each worker environment; route runtimes must not inherit live settings.
Keep every file isolated even under coverage because tests mock modules, stub globals and change cwd.
Rejected: ambient provider settings or the shared module graph used by vitest.shared.ts under coverage, which leak credentials or test mutations across file boundaries.
