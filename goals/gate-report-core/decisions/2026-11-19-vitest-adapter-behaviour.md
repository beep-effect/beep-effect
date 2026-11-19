---
title: "The Vitest adapter synthesizes at run end and writes its own log"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Emit events from the per-test reporter hooks and have the task path write the log."
---

The adapter builds the run from the finished module tree when the run ends, not from per-test hooks, and implements only the start, console-log and end hooks. Its log holds the console lines Vitest hands a reporter and then every failed item in full, because a reporter never sees the process streams. The stray-output recorder and reader are ported; the capture that wraps the logger streams is not, since the adapter patches no stream. A run under an integration test directory records its own gate, so it cannot overwrite the unit record. The registered module loads its implementation when Vitest starts and turns itself off with one stderr line on any failure.
