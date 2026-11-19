---
title: "The generated package check is one slim gate entry"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Point the generated check back at the probe followed by the compiler script and re-record the package cache baselines."
---

A package's generated `check` is `beep-cli gate run check`, a slim entry that loads only the gate and four platform services. It probes for unbuilt references; if any are missing it writes a record that folds to the TS6305 line and exits 1 without starting a compiler. Otherwise it runs the compiler script with output captured to the log, turns the output into events, writes the record, prints the console for the audience and exits with the compiler's code. The infra kind keeps its plain script because its check builds references itself. On a built package the entry costs about 25 to 40 ms more than the probe plus compiler it replaces (about 350 ms against 328, compiler alone 180).
