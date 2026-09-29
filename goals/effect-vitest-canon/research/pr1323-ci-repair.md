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
