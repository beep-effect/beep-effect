---
title: "The gate queries exist and pointers carry their target"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Mark the pointer commands planned and print them without a target."
---

The `gate show` query prints a run's record and `gate item` prints one item in full. They read the package named by `--dir`, else the working directory's package, else the newest root run; `--run` picks an older root run. A console pointer is built from the record it was printed for: a package record prints `--dir` with the repository-relative directory and a root run prints `--run` with its id, so the printed command opens that record from any directory. Law 9 is tested against the real command tree: every pointer of every cell resolves to a leaf command.
