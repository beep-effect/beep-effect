---
title: The UTF-8 truncation property draws every scalar value as code points, at size 40000 with 50 runs
date: 2026-11-26
reversal: Replace ScalarValue and binaryText in test/resources2.test.ts with the native string arbitrary and drop budgetCrossingRunOptions for the default run options.
governs:
  - test/resources2.test.ts#ScalarValue
  - test/resources2.test.ts#budgetCrossingRunOptions
enforcedBy: []
---

The property draws every Unicode scalar value (the whole plane minus the surrogate block) as code points, so the cut can land inside any multi-byte sequence or pair without the input carrying broken halves. It runs at `size: 40_000`, 50 runs and a 30 s timeout.
Reason: at size 20000 no run crossed the 65535-byte budget (0 of 100 probed); at 40000 about one in five does. 100 runs take about 0.7 s locally, past the 5 s default under coverage on a CI runner.
Rejected: the native string arbitrary, which stays in printable ASCII and never produces a multi-byte cut.
Rejected: a smaller domain or the default 100 runs, which either never crosses the budget or overruns the default timeout.
