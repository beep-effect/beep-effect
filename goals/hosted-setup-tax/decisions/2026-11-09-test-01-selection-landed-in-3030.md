---
title: "TEST-01 is partly landed by #3030; the oracle census comes next, then a file split where it still pays"
date: 2026-11-09
reversal: "Return Property Laws to one slice, or revert the #3030 selection to file-level selection, by a new decision in this goal if the census shows the selection or the two-slice layout unsound."
---

#3030 (f818c6e52bf) made the deep sweep skip provably plain tests at collection time: PropertySelection.ts in packages/tooling/test-kit/fc-runs and vitest.property-runner.ts skip a plain it or it.effect registration in a file whose import graph never runs a property inline. That does the file split's job at test grain, so no single-property file is split unconditionally. TEST-01's remainder, in order: the oracle-checked census as the tripwire (old and new oracle logs identical in file, test, runs and seed on three heads, with per-file collection and hook time recorded; fixtures for module-scope fcRuns, props without fcRuns, renamed tests; a passWithNoTests override), then a file split wherever the census and its per-file collection and hook timings show module-scope or hook cost still dominating a property file. That split slice records its outcome either way (the files split, or a finding that none qualifies) in a decision file. #3030 also runs the hosted lane as two Turbo-filter slices (repo-cli, rest) under one Property Laws aggregate. D26 accepts that layout as landed, ahead of D10's order; this goal owns any decision that returns Property Laws to one slice. No further shard lands unless Property Laws p95 stays over 10 minutes after the census and the split slice, and the HOST-05 gate is read only then.

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D26, D10); this goal's lever check of commit f818c6e52bf.
