---
title: "P3 and P4 built: test and check print the console contract"
date: 2026-11-19
kind: checkpoint
lane: "feat/gate-report-wiring"
reversal: "Revert the wiring commits and re-record the package cache baselines."
---

A green test run of `@beep/glob` prints one line of 47 characters (`test @beep/glob: PASSED, 273/273 passed`, with its duration), against 13,450 at the exploration baseline and 820 after the switch-on goal. A red test with a diff prints 14 lines and 520 characters. A package with unbuilt references prints 5 lines. Root test and root check runs, a miss then a Turbo cache hit, print identical consoles by `cmp`. Doctest and property-sweep runs leave the test record untouched. The adapter has 75 tests under Node and Bun, the record library 29, the gate-run library 50, and every new source file has full statement, function and line coverage.
