# PR 1323 CI repair after main integration

The branch merges current main without conflicts. The hosted Check and Lint
Policy failures share 35 unique CLI test diagnostics: 32 pipeable forms,
two named Effect function opportunities, and one schema-decoder preference.
The CLI unit shard and coverage run share three exact-console failures caused
by runner lifecycle diagnostics entering application output captures.

This repair brings the relevant changes from the saved follow-up commits
`a72a31ea9b` and `13cad3e1fa` into the PR without importing the later migrations.
Fresh consoles begin inside application effects. Exact stdout and stderr
expectations remain unchanged, and runner diagnostics remain enabled.

Piped assertions remain visible to the outcome detector, with positive and
shadowing regression cases. That correction reveals nine existing native
filesystem outcome assertions in DocumentIntake and PathSafety; their saved
Effect.flip repairs preserve expected failure and filesystem safety checks.

Inventory reconciliation maps 23 existing fingerprints by file, rule, class,
symbol and detector traversal order, preserving group multiplicities. No bulk
baseline refresh is performed. The existing justified short-lived console
exception is restored for the PersonMatch application-output assertion.

Validation against merged dependencies:

- CI-enabled console suites: 38 tests pass.
- Detector suite: 211 tests pass.
- CLI test-typecheck artifact: exit zero, empty diagnostic output.
- Full touched-package verification and hosted checks remain pending.

These are PR repairs, not completion of the migration goal.

## Full-proof knowledge-reference repair

The full branch proof passed build, docgen, integration, doctest, JSDoc ratchet
and lint, then failed knowledge-reference policy. Six observations came from
synthetic home paths copied into source excerpts in the baseline and packet
ledger. Evidence-only redaction was rejected by the ratchet and superseded.

Three diagnostic strings now live in named test fixtures. Their exact runtime
values and all assertions remain unchanged. Four affected provider/scope
findings are reconciled by file, rule, symbol and occurrence, preserving their
statuses and multiplicities. No baseline waiver is added. The focused suite
passes all 64 tests under CI logging on Node.

## Watch coverage regression repair

Hosted coverage on `1d01a323d6` passed tests but found one uncovered branch in
WatchMode and one uncovered line/function in WatchStream. Focused coverage
reproduced the missing required-check skip branch. The timestamp ordering
fallback also lacked a regression for invalid instants.

Added behavior checks for a skipped required check retaining its skip outcome
while allowing readiness, and for an invalid completion sorting after a known
failing instant in either input order. No production code or baseline changed.
CI-enabled Node coverage passes 98 tests across three files. Both WatchMode and
WatchStream now have every statement, function, and branch covered in that
cohort. Package proof, full verification, and hosted checks remain required.
