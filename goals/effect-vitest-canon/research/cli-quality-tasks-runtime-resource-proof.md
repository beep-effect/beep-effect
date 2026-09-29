# Quality-task runtime and resource migration

The follow-up migrates 45 current `Effect.runPromise` boundaries to public
`it.effect` registrations. The actual suite retains all 254 expanded test
registrations and all 894 audited assertion trees, with zero exclusions.
The instrumented test-runner import remains in place.

A serial public `it.layer` fixture owns the existing native platform services,
with a 30-second fixture timeout. All 95 Effect registrations receive a fresh
TestConsole; explicit console subscopes remain where the old provider supplied
one. The previously runtime-bound task programs retain their native clock via
`TestClock.withLive`. Existing deterministic Effect cases retain their clock
mode. This is native integration coverage, not Memory filesystem promotion.

The 24 temporary-repository uses now acquire a scope-owned constructor. The
constructor registers directory cleanup and restoration of the original
`process.cwd` function before creating `.git`. It preserves the old function
override semantics. Actual-constructor controls on Node and Bun prove cleanup
after success, body failure, interruption and injected `.git` setup failure.
The old helper's setup leak was reproduced before repair.

The diff-audit integration case had a separate setup leak: temporary-directory
cleanup was registered only after Git setup completed. Its repaired acquisition
registers cleanup before setup and uses the public test scope. Extracted actual
fixture controls on both runtimes reproduce the old setup leak and prove the
repair after success, setup failure, body failure and interruption. A cleanup
failure control verifies that the old ignore-on-remove behavior remains.
The controls clean their own intentionally leaked fixtures afterward.

All 24 repository wrapper uses were audited against their owning callbacks;
none has an operation after the resource wrapper. An initial private audit
mistakenly walked outside expression-bodied callbacks and counted later test
registrations. The corrected function-body and enclosing-expression audits
supersede that result. No post-cleanup assertions were found for those uses.

Final uninstrumented execution passes 254 tests on each runtime, with no
failures or skips and stable source hashes. Node records 11.837 -> 11.232
seconds; Bun records 8.229 -> 7.476 seconds. Workstation load, pressure and runtime
versions are retained with the private execution receipts. The earlier baseline
overlapped another package audit; these measurements do not establish a causal
performance improvement. Before/after registration parity is checked separately.
Actual generated test type diagnostics have exit zero and empty output.

The root ratchet passes over 1,217 files with 3,211 findings, zero introduced
and 1,811 resolved against the existing baseline. No baseline was changed.
The net reduction of 79 findings is not a claim of 79 completed inventory rows:
an unchanged shorter scope is no longer recognized behind a composed callback.
Its historical judgment remains open, and the detector gap is recorded in
OPPORTUNITIES.md. Environment-wrapper, native-filesystem and retry judgments
also remain open. Historical runtime/provider lineage reconciliation is pending.

The refreshed actual-suite console probe passes 255 tests on both runtimes,
including its distinct-identity witness across 164 constructor sites and at
least 95 constructed services. The uninstrumented source is restored and
byte-checked against its pre-probe backup.
Full CLI package verification for this batch remains pending. This receipt
records focused evidence and does not claim package or goal completion.
