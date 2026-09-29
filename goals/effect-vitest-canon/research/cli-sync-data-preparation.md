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
reflection/bootstrap full package proof is running with package source frozen.
