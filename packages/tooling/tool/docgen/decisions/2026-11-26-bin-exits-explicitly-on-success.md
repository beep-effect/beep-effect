---
title: The docgen bin exits explicitly after a successful run
date: 2026-11-26
reversal: Pass only Runtime.defaultTeardown to BunRuntime.runMain in src/bin.ts.
governs:
  - src/bin.ts#program
enforcedBy: []
---

The bin's teardown calls process.exit(0) once the run succeeds. The platform runner hard-exits only on failure or a signal; a successful run waits for the event loop to drain, so one leaked handle keeps the process alive after docgen reports success.
Rejected: the default teardown alone, which hangs CI jobs after a successful docgen run whenever a handle leaks.
