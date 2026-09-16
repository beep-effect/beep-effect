# Issue 1137: scheduler queue observation

The [failed nightly run](https://github.com/beep-effect/beep-effect/actions/runs/34865105102)
failed one ordinary test in `test/quality-scheduler.test.ts`: `stays queued
while the origin gate is busy and releases it after use`. The logged assertion
expected one queue entry and observed zero, at line 3461 of the captured source.
It ran after a fixed 100 ms sleep. No property seed or counterexample was involved.

This branch first replaced the sleep with a Deferred completed on the gate's
first attempt, bounded by a five-second timeout. While that change queued for
publication, PR #1149 landed a rewrite of the same test on main: it polls the
queue directory under the live clock until an entry appears, with the same
five-second bound, and holds the busy gate until after the assertion. The two
fixes remove the same fixed sleep, so the branch adopted main's version at the
merge and carries no edit of its own to that test. The focused scheduler suite
passes on the merged tree, and this pull request closes the issue on the
strength of that merged state.

Issue #1086 contained only an empty nightly publisher mailbox, with no comments
or defect report. The operator explicitly authorized closing it if meaningless;
it was closed as not planned on September 16.
