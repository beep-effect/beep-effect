---
title: Serialize plugin writes across dispatches and log calls
date: 2026-11-26
reversal: Remove the shared dispatch permits or the per-log write permits.
governs:
  - src/PracticeMod.hooks.ts#verdictWrites
  - src/PracticeMod.hooks.ts#timerWrites
  - src/PracticeMod.timers.ts#makeTimerLog
  - src/PracticeMod.verdicts.ts#makeVerdictLog
enforcedBy: []
---

Band and slash-command dispatches share one verdict permit because each dispatch builds a log over the same plugin store. Timer start and stop share their own permit; re-read running state under it so overlapping starts install one ticker and overlapping stops write one interval.
Within each timer or verdict log, serialize the read-append-write operation so overlapping records cannot append to the same old snapshot.
Rejected: per-dispatch protection alone, which cannot coordinate separately built logs, or unguarded read-modify-write, which loses an overlapping update.
