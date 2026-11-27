---
title: The CLI teardown drains, then forces the process exit on success too
date: 2026-11-26
reversal: Pass Runtime.defaultTeardown's onExit straight through and leave a clean success to event-loop drain.
governs:
  - src/bin-main.ts#runRepoCliMain
enforcedBy: []
---

The runner's `onExit` hard-exits only on a signal or a nonzero code and leaves a clean success to event-loop drain, so a handle a child leaves behind (a turbo daemon socket, a stuck bun wrapper) wedges the process after its work is done: a CI lane prints success and never exits. `Runtime.defaultTeardown` stays the only exit-code authority; the teardown first restores the shared terminal under `Result.try` (a dead terminal must not abort the exit), then drains stdio, then calls `onExit` and `process.exit` with that code. The drain comes before `onExit` because `onExit` hard-exits on a nonzero code.

Rejected: relying on event-loop drain for a clean success (the wedge above); calling `onExit` before the drain (a nonzero exit cuts buffered output).
