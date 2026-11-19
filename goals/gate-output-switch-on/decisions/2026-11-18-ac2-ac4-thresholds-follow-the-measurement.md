---
title: "AC2 and AC4 thresholds follow what the six fixes can reach"
date: 2026-11-18
lane: "fix/gate-output-switch-on"
reversal: "Restore the 600-character targets and add a Turbo log-prefix or task-path banner change to this goal."
---

The spec set under 600 characters for a green test run under Turbo and for a task-path cache hit. With fixes 1 and 2 in place the runs measure 820 and 1,098 (from 14,238 and 15,960). The remainder is Turbo's header, footer and per-line prefix, Bun's command echo and the task path's step banner; none is test output. Removing those lines is the console contract of `goals/gate-report-core`, which renders from a record instead of a stream, so the targets become under 1,000 (AC2) and under 1,200 (AC4), and AC4 keeps its requirement that no test summary is replayed. Numbers: `history/2026-11-18-p1-agent-signal-measurements.md` in this packet.
