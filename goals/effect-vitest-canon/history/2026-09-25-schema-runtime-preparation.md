# Schema runtime wrapper preparation

Fn tests now yield Effect.result directly instead of translating results through
a custom Promise runner and ad-hoc tagged objects. Known failure values use
assertFailure; invalid-input/output/error schema checks retain their variant and
SchemaIssue assertions. Defect checks yield the existing sandbox/flip operation
directly and retain both hasDies and hasFails expectations.

HttpHeaders removes its run/runExit helpers, 46 Effect-to-Promise bridges and
12 synchronous exit calls. Existing effects are yielded directly or through
Effect.exit. Original orDie behavior is retained, including one generator-level
hoist required by the Effect checker. Every header string/object expectation is
preserved; 29 newly exposed Option comparisons use assertSome/assertNone.

Final local proof:

- Full schema package audit and docgen passed.
- Node: 53 affected tests in two files passed.
- Bun: the same 53 tests passed.
- git diff --check passed.

The remaining runSyncWith in TaggedError.equivalence captures a thrown private
unsupported-Float16 error and tests that error constructor's equivalence. It is
under review as a runtime-boundary test; no exception or fixed disposition is
claimed here. Also review its global constructor/module-state ownership against
coverage topology before final schema publication.

This is uncommitted Wave C preparation, not hosted proof or wave completion.

## Diagnostic and private-runtime ownership follow-up

Eight Semver rejection calls now identify their exact decode expression in both
the failure-variant and typed-error assertions. All invalid values remain.
Twenty-three shared tagged-error equivalence calls now supply schema identity to
both positive and negative comparison diagnostics, preserving their operands.
The tagged-error suite is serialized, and the Float16 constructor finalizer
restores both an original descriptor and original absence. Module reset cleanup
and the private thrown-error capture remain intact. Coverage topology still
requires verification; this scoped cleanup alone is not coverage proof.

Full schema package audit/docgen passed; all 16 affected tests in the two files
passed under Node and Bun.

## Exit/Cause and header error-channel follow-up

Converted the remaining 160 Effect.result captures across 28 schema test files
to Effect.exit. Preserved 110 typed-error payload observations through
Cause.findErrorOption and retained success payload checks. Migrated rejection
guards use Exit.hasFails so a defect cannot substitute for the typed failure
previously required by Effect.result. No Effect.result calls remain in schema
tests. Both Node and Bun passed all 725 tests across 78 files after this change;
full package audit and docgen passed after a formatter correction.

Header rejection cases now observe typed errors with Effect.flip before any
orDie conversion. Unexpected success fails the test; defects remain defects.
The three cross-origin families check their own schema-derived error guards.
Expect-CT, HTTPS redirect, frame guard, no-open, no-sniff, permitted cross-domain,
permissions policy and referrer-policy construction check their own error schema.
The permissions-policy and empty-CSP decoding boundaries instead check
Schema.isSchemaError, verified against the local Effect reference. Existing
valid-input and output-payload assertions are retained.

All 34 header tests passed under Node and Bun. The full package test step also
passed all 725 tests after these changes. The detector ratchet reports zero
introduced and 598 resolved findings; this is baseline-delta evidence, not an
empty baseline or final ledger reconciliation. Final full package audit and docgen passed after
the import-order correction. No hosted proof or canonical fix-SHA credit is
claimed for this uncommitted wave.
