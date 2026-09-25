# Runner context repair after Wave A

PR #1235 merged before optional hosted coverage completed. Job 107991558825
subsequently failed in identity, utils, and wink. This prerequisite addresses
only the reproduced instrumented runner failure; utils and wink attribution
remain outstanding. It is separate from the modeling-only Wave B lane.

Coverage disables file isolation. The cached runner registered its module-level
`aroundEach` only in the first file. Later parameterized tests lacked execution
context. Register the hook when declaring `each` and Effect property tests, once
per current suite or file. Nested hooks reuse their ancestor execution so property
finalization remains owned by one hook.

Two separate regression files exercise concrete cases, generated trials, and
nested cases in the same worker. Before the fix: 4 failures and 4 passes. After
the fix: the full runner suite passes without isolation. The original identity
package coverage reproduction now passes all 115 tests across 12 files with
`CI=true`, `--fileParallelism=true`, and `--maxWorkers=1`.

Full `package-verify @beep/test-runner` passed (audit 8.2s, docgen 1.9s).
The complete shared-worker suite passes under Node and Bun: 35 passed, four
expected failures, two skipped, and four todos. Hosted proof remains required
before merge readiness.
This repair does not complete the migration goal or waive any coverage failure.
