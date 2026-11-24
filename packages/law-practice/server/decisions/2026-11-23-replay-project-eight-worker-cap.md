---
title: The replay Vitest project runs at most eight workers
date: 2026-11-23
reversal: Remove maxWorkers from the replay project in vitest.config.ts so Vitest's default width applies; delete this file and its pointer.
governs:
  - vitest.config.ts#replayMaxWorkers
enforcedBy: []
---
Cap the `replay` project at one worker per available core minus one, clamped to between one and eight.
Reason: Vitest's default of one worker per core minus one is 63 on a 64-core workstation, where this package alone then peaked at 92.8 GB resident, load 91 and 123 Bun processes (2026-11-17), and a concurrent `turbo test` swapped and stalled native children past the 29.75 s watchdog on tests that take 47 ms alone. Eight workers peaked at 53 GB, load 24 and 32 processes for 7% more wall time.
Accepted limit: 8-vCPU hosted runners keep their default of seven.
Rejected: Vitest's default width; the native-wallclock project's two-worker cap for every file.
