# Lint-command runtime and resource migration

All 65 runPromise boundaries now use public it.effect. The suite retains its
66 registrations, original test options and 198 audited assertion trees,
including custom expectReportedExit calls. There are no assertion exclusions.
The instrumented @beep/test-runner registration import remains intact.

One serial public it.layer fixture owns the existing NodeServices, FsUtils and
TSMorph service layers, with an explicit five-second hook timeout. Each test
acquires the existing temporaryWorkingDirectory resource and supplies a fresh
TestConsole.make. The shared TSMorph service includes the earlier repository-root
cache-isolation repair. No production source changed in this batch.

A temporary probe inside the actual suite observes all 65 console constructors
and requires distinct identities, with one final count witness. All 67 cases
pass on both Node and Bun. The probe is removed afterward. Extracting the actual
working-directory constructor also proves cwd restoration and native directory
removal after success, body failure, interruption and a chdir defect on both
runtimes. These resource controls supplement the actual command integration
suite; they do not claim a Memory filesystem migration.

The final uninstrumented suite passes all 66 tests on both runtimes with zero
failures or skips. Before/after reports have identical full test-name and file
multiplicities, and stable source hashes. Recorded times are 13.540 -> 9.981
seconds on Node and 7.227 -> 6.274 seconds on Bun. Workstation load and pressure
are retained; the earlier baseline overlapped the scheduler package audit, so
these observations do not establish a causal performance improvement.

Actual generated test diagnostics have exit zero and empty output. The root
ratchet passes across 1,217 files with 3,290 live findings, zero introduced and
1,732 resolved. This batch removes 65 live findings without changing the
baseline. Its native-platform judgment remains open.

Fifty-five historical runtime rows map directly through exact line/evidence
and unique test-title lineage. The other two follow explicit test renames in
8c69730bfec (PR #1110), which changed the TaggedError-equivalence policy. Their
renamed registrations match the full pre-batch tests after whitespace
normalization. This migration preserves the current policy assertions; it does
not restore the retired policy. All 57 historical rows are marked fixed by f5e6ab0018, with eight additional
current runtime rows recorded as fixed. One new row shares a location-based
ID with a different historical finding. Its ledger ID uses suffix #2 rather
than #1 solely to disambiguate history; both evidence strings and occurrence
fingerprints remain intact. The public cli-lint-ledger-collision-receipt.json
records the raw detector ID and mapping. No baseline identity was changed.

The CLI ledger contains 3,489 unique schema-valid rows: 1,541 fixed,
12 exceptions and 1,936 open. Full CLI package verification passed for source f5e6ab0018: audit 691.2
seconds and docgen 22.3 seconds. Package source stayed unchanged throughout
the proof; intervening commits changed only goal records.
