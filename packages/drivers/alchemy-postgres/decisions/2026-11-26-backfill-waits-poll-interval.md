---
title: A waiting backfill key asks again after the host's pollMillis
date: 2026-11-26
reversal: Set the backfill limits' pollMillis to 0 in makeContext, as Domain.InMemory does.
governs:
  - src/internal/host.ts#makeContext
enforcedBy: []
---

The backfill limits take `pollMillis` from `AlchemyPostgresConfig.pollMillis`, so a key that is waiting on history asks again after one poll interval.
Reason: Domain.InMemory sets `pollMillis: 0` because its work queue runs the retry only after other queued work has run. Here a retry is a job row the worker polls from a table, so a zero wait re-claims the same row at once and spins the database.
Rejected: InMemory's `pollMillis: 0`; the upstream `Backfill.defaultLimits` value of 5 seconds, which ignores the host's configured poll interval.
