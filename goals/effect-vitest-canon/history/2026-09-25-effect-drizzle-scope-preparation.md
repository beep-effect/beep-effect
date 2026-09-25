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

## SQLite schema-derived variant laws

Added native `it.effect.prop` laws using `SqliteUser.insert` and
`SqliteUser.update` directly, with `fcRuns(100)`. Insert encoding preserves
Option-to-NULL nicknames; update encoding preserves row versions. Both assert
decoded equality, encoded stability and membership in the existing variant.
All original dialect, mode, negative and INTEGER PRIMARY KEY examples remain.
The fc-runs dependency is development-only; generated TypeScript references
were synchronized with the package-filtered command.

Focused Node verification passed both properties (15 unrelated cases skipped).
Full package verification passed: audit 16.7s and docgen 3.2s. The first audit
reported import ordering; the corrected source passed the subsequent full run.
This is intermediate proof, not completion of the Effect Drizzle wave: array
codec generation, runner adoption and final ledger/timing closeout remain.

## PostgreSQL schema-derived array law

Added an `it.effect.prop` using `ArrayRecord.insert` directly and `fcRuns(100)`.
It verifies decoded equality, encoded stability, schema membership and omission
of the database-defaulted matrix field when constructing a labels-only insert.
No test-only schema, filter or weakened array domain is introduced. The exact
ragged-array rejection, SQL default projection and native matrix round-trip
remain unchanged.

An intermediate assertion incorrectly expected `pg.default` to populate a
constructor value. The shrunk counterexample was `{ labels: [] }`; the field
correctly remains omitted for the database to supply its default. The final
property asserts preservation of that omission. Full package verification
passed (audit 16.0s, docgen 3.2s), and the focused Node property passed with 54
unrelated cases skipped. The initial failure log remains in private proof
artifacts. Runner adoption, final ledger reconciliation and timings remain.

## Public runner adoption

All seven runtime suites now import `it` from `@beep/test-runner`; both native
integration suites use its `it.layer` with the existing 90000ms hook budget.
The dependency is development-only and generated TypeScript references were
synchronized. Existing test modes, assertions and native clients are retained.

PGlite setup errors identify generate/apply/regenerate phases and carry named
spans. SQLite first/no-op pushes, direct open/close and directory cleanup have
named spans. Bundle build/drain and boundary source reads/builds are named;
source-read attributes contain only the relative file name.

Full package verification passed (audit 15.9s, docgen 3.2s). The focused Node
PGlite contention test passed (one case, nine skipped, 5.35s) with
`BEEP_TEST_TRACE=1`, but no trace lines appeared in the captured output. This
proves runner execution, not diagnostic-output completeness. Retain the open
observability dispositions until phase and failure-output checks are complete.

## Trace capture and phase failure diagnostics

The absent stdout lifecycle lines were investigated against the installed
Effect runner: ordinary Effect tests receive TestConsole, and consolePretty
writes through that console reference. A temporary assertion in the existing
PGlite contention test found the lifecycle start message in TestConsole.logLines
with BEEP_TEST_TRACE=1. The same assertion failed with BEEP_TEST_TRACE=0 and
CI=false. Both diagnostic edits were removed, restoring the committed test
byte-for-byte. This establishes capture behavior; it does not promise live
stdout emission from TestConsole tests.

A second temporary probe rejected the regenerate operation with a controlled
error. The focused run failed during setup and reported
`PGlite harness regenerate failed` with the controlled cause. The native
migration/client path and existing tests were restored byte-for-byte afterward.
Probe logs are retained privately as effect-drizzle-trace-capture-probe.log,
effect-drizzle-trace-capture-negative.log and
effect-drizzle-phase-failure-probe.log. These intentional failures are diagnostic
controls, not green package executions or final observability-lens closure.
