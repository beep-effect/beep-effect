# Effect-drizzle scope preparation

The existing fifteen-file census is unchanged from the reviewed source pin
`d9f74d230a949e37f108a9ad52c0bc16a829d98f`. This wave uses that inventory;
no fresh census or P1 completion is claimed.

The SQLite harness now acquires its concrete Bun Database with acquireRelease.
Close is registered atomically before the foreign-key PRAGMA executes. The
original native handle, PRAGMA, and close-before-directory-removal order remain.
This addresses the observed registration gap; no actual leaked handle was
reproduced and no production code changed.

Untouched baseline evidence:

- Configured Node JSON-reporter run: 101 passed, one pending; suite collection
  fails on the Bun-only SQLite import. Whole command 5.549 seconds, stable source
  hashes, runtime/load/pressure/process limits saved with the private report.
- Configured Bun run: all 113 tests passed, including the native SQLite suite.

After the acquisition repair, full package verification passed: audit 17.6
seconds and docgen 3.6 seconds. This is scoped preparation, not complete wave
proof or a causal performance comparison. Subprocess ownership, oracle/property
findings, instrumentation, final timings, ledger attribution and hosted gates
remain outstanding.

## Subprocess ownership

The bundle-probe child is acquired in the scope supplied by it.effect. Each real
Node drizzle-kit push uses acquireUseRelease, so its lifetime ends before the
outer temporary database directory is removed. Both paths begin stdout/stderr
draining immediately; release kills a still-running child and awaits settlement
of exit and both stream reads, including interruption or a failed read.

The commands, native runtimes, one-byte regression input, nonzero-exit check,
first-line delta and error-text assertions remain. No timeout was increased.
The installed/reference Vitest API confirms it.effect supplies Scope; an initial
it.scoped attempt was corrected before proof. Effect checker async-function
findings were also corrected rather than suppressed.

Full package audit passed in 24.3 seconds and docgen in 5.6 seconds. Focused Bun
execution passed all 18 tests across the bundle and SQLite suites. The ordered
11 and 43 expect-statement start lines are unchanged; this textual comparison
is supporting evidence, not an AST-equivalence or cancellation-path proof.
A deterministic interruption witness is still needed before claiming that
branch of cleanup has been exercised. Remaining lens work is not closed.

## Deterministic probe interruption witness

The bundle probe's acquisition/release path is shared with a new cancellation
case in the same test file. It starts a real idle Bun child, signals acquisition
with Deferred, then interrupts and awaits the child fiber. The assertions require
an interrupted Exit, SIGKILL termination, nonzero child exit and completed stdout
and stderr reads. No sleep or timeout increase controls this test. A separate
outer safety finalizer prevents leaks if the tested release callback regresses.

All eight bundle tests pass. A temporary negative control replaced only the
helper release callback with a no-op: the new test failed with expected SIGKILL
versus actual null. The safety finalizer then cleaned up the child. Source was
restored byte-for-byte before final package proof; audit passed in 14.9 seconds
and docgen in 3.3 seconds. This proves the bundle helper cancellation path, not a
new interruption test of drizzle-kit itself. All prior assertions remain.

## SQLite contention and bundle nonmutation oracles

The existing concurrent SQLite update case still requires exactly one successful
writer. It now also requires a typed failure with no defects or interruptions,
checks VersionConflictError against the actual table, seed ID and original row
version, and checks that the persisted row equals the successful result with
exactly one version increment. Whole-Cause comparison initially detected span
annotations rather than a field mismatch; explicit failure-channel and payload
assertions retain those production annotations without mistaking them for data.

The one-byte bundle regression case now captures committed baseline bytes before
the probe and checks them again in a finalizer. The finalizer runs after child
cleanup, including when the test body fails. The baseline and all original exit,
first-line delta and error-text assertions remain unchanged.

Final full package verification passed: audit 15.2 seconds, docgen 3.6 seconds.
No production code, property floor, timeout or baseline file changed. The other
saved property and instrumentation findings remain open.

## Import-boundary vacuity controls

Every real source scan now requires its known entry: root index.ts, core
model.ts, and each dialect index.ts. The real repository source, runtime
manifest, local import closures and integer consumer build remain the subjects.
A synthetic parser control sends static imports, exports, import-equals,
dynamic imports and require through the same workspace/dialect filters used
by the source checks, with exact expected forbidden edges and an allowed edge.

All seven boundary tests pass. Two temporary negative controls fail as expected:
an empty source enumeration is rejected by its required-entry assertion, and
a workspace filter that drops every edge is rejected by the positive control.
Source was restored after each control before final package proof. Full audit
passed in 14.1 seconds and docgen in 3.2 seconds. No baseline or source-tree
replacement was used. This addresses the saved empty-enumeration finding;
remaining generated codec laws and runtime instrumentation are still pending.

## Native PGlite contention witness

The original sequential stale-snapshot case remains unchanged. A separate row
now receives two optimistic updates with concurrency explicitly bounded to two.
The test requires one success, a typed VersionConflictError without defects or
interruptions for the loser, exact original table/ID/version fields, and a
persisted row equal to the successful result with one version increment.
The row is deleted after reading its persisted value. It uses the existing
native PGlite client and schemas; it does not claim parallel engine execution.

Full package verification passed: audit 14.9 seconds and docgen 3.3 seconds.
The focused Node test also passed (one executed, nine unrelated cases skipped).
This closes the additional contention-witness implementation work, not the
remaining generated codec laws, instrumentation, final ledger or hosted gates.
