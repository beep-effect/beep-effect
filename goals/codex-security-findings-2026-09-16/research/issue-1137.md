# Issue 1137: scheduler queue observation

The [failed nightly run](https://github.com/beep-effect/beep-effect/actions/runs/34865105102)
failed one ordinary test in `test/quality-scheduler.test.ts`: `stays queued
while the origin gate is busy and releases it after use`. The logged assertion
expected one queue entry and observed zero, at line 3461 of the captured source.
It ran after a fixed 100 ms sleep. No property seed or counterexample was involved.

The test now completes a Deferred when the gate is first attempted and waits for
that event before inspecting the queue. The busy gate remains held until after
the assertion; the test then releases it, joins the work, and checks one release.
The five-second timeout bounds a broken fixture without assuming startup latency.
The focused scheduler suite passed with the other security regression suites.

Issue #1086 contained only an empty nightly publisher mailbox, with no comments
or defect report. The operator explicitly authorized closing it if meaningless;
it was closed as not planned on September 16.
