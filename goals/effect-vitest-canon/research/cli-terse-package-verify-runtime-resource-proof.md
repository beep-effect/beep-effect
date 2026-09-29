# Grouped terse-effect and package-verification proof

The applied migration moves 32 whole-callback runtime boundaries to public
Effect tests while preserving both files' instrumented test-runner imports.
Serial public fixtures own NodeTestLayer and PlatformLayer, with explicit
five-second hook timeouts. The 16 terse-effect cwd resources reuse the existing
scoped constructor; all 13 package-verification directories use a scoped
constructor. All 29 resource uses are terminal within their callbacks.
The stable service providers move out of test bodies, and each of the 32
Effect callbacks receives a fresh console.

Package-verification cleanup still removes recursively and fails visibly.
The original acquireUseRelease allowed a typed release error; acquireRelease
requires an infallible finalizer, so its cleanup uses orDie. This deliberate
transition turns cleanup errors into defects at the test-owned scope boundary.
No error is ignored. Actual-constructor controls on Node and Bun verify
success, body failure, interruption and cleanup failure; the latter remains
a failed Exit and its intentional residue is removed by the control harness.

Native subprocess capture includes drain/reap sleeps even without an explicit
command timeout. Nine package-verification callbacks that reach runCaptured
retain live-clock ownership; three also produce native duration reports.
The previously migrated QA helper Git-provenance case receives the same
one-case correction. Other cases retain the standard test clock. Actual-suite
probes insert real sleep and verify clock advancement within all ten selected
callbacks: 61 probe tests pass on each runtime. This proves the clock overrides
are effective; it is not an escaped-descendant process-cleanup stress test.

All 75 uninstrumented tests pass on Node and Bun, before and after, with
identical file/name multiplicities, stable source hashes and zero temporary
residue. Parsed syntax trees preserve 99 terse-effect assertions, 49 package
verification assertions and 106 QA helper assertions: 254 total, zero
exclusions. The actual generated type-result artifact is empty with exit zero.

Failure and interruption probes cover all 29 newly migrated resource-owning
cases. Each of four Node/Bun by failure/interruption runs has exactly 29
expected failures and six passing siblings, expected failure messages and
zero temporary residue. Console probes instrument all 32 constructor sites;
all 37 probe tests pass on each runtime with exact per-file identity counts.
All probe source edits are restored and byte-checked.

Matching 75-case timings are Node 11.985 -> 12.887 seconds and Bun
6.025 -> 6.425 seconds. Load and pressure are retained; baseline overlapped
the preceding package proof, and after runs overlapped typecheck/ratchet work.
These are slightly slower samples, not a controlled causal comparison.
Earlier intermediate timing results preceded finalizer/pipe type repairs and
do not replace this final-source cohort.

The root ratchet passes across 1,217 files with 3,066 findings, zero introduced
and 1,956 resolved against the unchanged baseline. The two newly migrated
files remove 32 runtime findings and one wrapper finding; the native-filesystem
judgment remains. Exact historical source/title matching verifies all 32
runtime rows; the deleted wrapper also matches exact occurrence/evidence.
All 33 historical rows are fixed by source 0509e81669. No new rows were needed.
The CLI ledger contains 3,495 unique rows: 1,776 fixed, 12 exceptions and
1,707 open. Strict validation passes for all CLI rows and all 687 schema rows.
The QA helper clock correction does not re-close its previously fixed rows.
Full grouped CLI package verification is running against source 0509e81669.
