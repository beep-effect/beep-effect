# Sync-data test migration preparation

The next existing inventory target, sync-data-to-ts.test.ts, mixes eight direct
runtime registrations with three runtimes inside HTTP fixture helpers. It also
contains sixteen existing Effect tests, a local provideScopedLayer definition,
seven provider calls, temporary-repository ownership and a mutable target
registry wrapper. A blind direct-test rewrite would miss the helper boundaries.

The temporary-repository helper appears mostly as a pipe argument rather than
a call expression. Its acquisition changes cwd before creating .git, with
cleanup registered only after that entire acquisition succeeds. The next draft
must use incremental scoped acquisition and prove cwd/directory cleanup if .git
creation fails. Registry restoration must be checked separately from filesystem
cleanup; a temporary directory cannot undo a leaked syncDataTargets entry.

The HTTP helpers currently convert Effects to promises, then wrap those promises
back in Effects. Inspect every makeWebHandlerClient caller before changing its
handler contract; some callers may supply native async handlers. Preserve error
mapping, request method/headers and fixture authentication behavior. Per-case
consoles must retain the existing captured-output assertions. The suite uses
synchronous tar construction over a scoped native directory, so native bridge
requirements and clock behavior need explicit review before fixture selection.

No source changes, draft application or ledger closure are claimed here. The
reflection/bootstrap full package proof passed before any sync-data application.


## Prepared draft and controls

The unchanged baseline passes all 30 tests on Node and Bun with zero temporary
residue and stable source hashes (3.719 and 1.767 seconds, respectively).
A private draft preserves all 93 assertion trees and identifies all sixteen
historical runtime/provider rows uniquely, including helper identities where
no test title exists. It removes all nineteen current runtime/provider/wrapper
findings without introducing a fingerprint; native-platform review remains.

The two web-handler callers contain synchronous Response construction only.
The draft makes that contract synchronous and maps request/response construction
failures through Effect.try to HttpClientError/TransportError. It removes the
three unnecessary nested runtimes. Tests of method, headers, status, body and
typed transport failures are prepared for applied-source verification.

A source-extracted constructor probe on both Node and Bun uses simulated cwd
and filesystem services. Ordinary execution restores resources for both old and
new forms. A .git setup failure leaves the old cwd changed with zero removals;
the incremental scoped draft restores cwd and removes its directory. This is a
controlled mechanism reproduction; actual-suite native-filesystem fault probes
remain required after application. Repository, registry, archive and console
controls are separately prepared. No ledger rows are closed by this draft.
