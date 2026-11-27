---
title: Test execution state is keyed by object identity, not by Effect collections or async context
date: 2026-11-26
reversal: Key per-test state by the async-context current test and hold property runs in an Effect HashMap keyed by registration token.
governs:
  - src/internal/VitestInstrumentation.ts#TestExecutionState
  - src/internal/VitestInstrumentation.ts#testExecutions
enforcedBy: []
---

Per-test state lives in a WeakMap keyed by the public callback TestContext. Native Arbitrary resumes trials inside Effect fibers that may be scheduled from another test's async context, and the callback context keeps its identity across those resumptions; weak keys do not retain tasks.
Property runs live in an insertion-ordered list compared by reference. Registration tokens are plain objects that Effect maps compare structurally, and runs finish in registration order.
Rejected: reading the current test from the async context, which can name another test after a resumption, and an Effect HashMap of runs keyed by registration token, which would merge distinct tokens.
