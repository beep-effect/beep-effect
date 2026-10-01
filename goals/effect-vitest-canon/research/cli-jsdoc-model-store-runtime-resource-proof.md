# JSDoc inventory and model-store fixture proof

Source commit 37e76036e5 migrates 26 runtime boundaries and two resource
wrappers across existing inventory files. Instrumented @beep/test-runner
imports remain. Serial public fixtures own native layers, each Effect
callback has a fresh console, and four synchronous JSDoc parser cases remain
plain. Test options are preserved; no Memory promotion is claimed.

Every resource use is terminal in its callback. JSDoc fixture allocation now
registers release before fallible writes. The original helper leaked its
directory on setup failure, reproduced on Node and Bun. Model-store fixture
cleanup now fails visibly instead of silently succeeding through Effect.ignore.
The original ignored-error behavior was also reproduced on both runtimes.
These are test-helper repairs, without production model-store changes.

Extracted applied constructors pass success, body failure, interruption and
cleanup-failure controls on both runtimes; JSDoc also passes setup-failure
cleanup. Cleanup errors become finalizer defects and remain failed Exits.
The harness removes intentionally retained directories in cleanup-error controls.

All 30 original tests pass under Node and Bun before and after, with identical
file/name registration multiplicities, stable source hashes and no temporary
residue. Parsed assertion trees preserve 76 JSDoc and 24 model-store assertions,
100 total with no exclusions. Actual package test-typecheck output is empty,
exit zero.

Applied-suite probes inject failure and interruption after resource acquisition
in all 26 resource-owning callbacks. Each Node/Bun run reports exactly 26
expected failures and four passing parser cases, checks the injected messages,
and leaves no temporary residue. Console probes pass 32 tests on each runtime
and verify 13 distinct service identities in each file. Clock probes pass 18
JSDoc tests on each runtime, observing real clock advancement through a sleep
inside all 13 live-clock callbacks. All probe source edits were restored
byte-for-byte, and the commit hook made no source changes.

JSDoc inventory topology discovery reaches topoSortPackageNames/runCaptured,
whose native-pipe cleanup deadlines use the Effect clock. Those callbacks use
TestClock.withLive. Model-store integrity cases retain the ordinary test clock;
their existing no-download HttpClient dies on an unexpected request, so these
paths do not enter delayed download retries. Passing ordinary cases does not
claim a descendant-process cleanup stress test.

Whole-command observations are Node 10.232 -> 11.335 seconds and Bun
5.423 -> 6.325 seconds. Dedicated temporary roots, runtime versions, source
hashes, load and pressure are retained. The baseline overlapped the previous
package proof, and after runs overlapped focused checks. These slower samples
are not a controlled causal performance comparison.

Root ratchet passes across 1,217 files with 3,011 findings, zero introduced
and 2,011 resolved against the unchanged baseline. Actual before/after detection
removes 26 runtime findings and two wrappers. Two native-platform judgments
remain open. Exact historical source/title lineage and wrapper occurrence/
evidence matches close 28 historical rows with no additions. Strict validation
passes for 3,495 CLI rows and 687 schema rows; CLI totals are 1,833 fixed,
12 exceptions and 1,650 open.

Full grouped CLI package verification passed against source 37e76036e5:
`bun run beep quality package-verify @beep/repo-cli` exited zero, with audit
683.8 seconds and docgen 21.0 seconds.
This focused evidence does not replace that proof or goal-wide acceptance.
