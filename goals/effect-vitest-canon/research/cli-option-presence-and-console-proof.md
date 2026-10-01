# CLI Option presence assertions and CI console isolation

## Scope and preserved behavior

This follow-up selects 31 files from the existing open CLI EV006 inventory.
It replaces 102 `expect(O.isSome(subject)).toBe(true)` assertions with
`assertTrue(O.isSome(subject))`, preserving each predicate and subject exactly.
Namespace provenance and shadowing checks precede the edits; parsed drafts have
unique imports. No property run counts, seeds, runtime budgets, or test
registrations are intentionally changed.

The actual syntax-only detector removes 100 EV006 findings. Its before/after
comparison preserves every other finding group's multiplicity and order, and
identifies 64 enclosing-statement hashes affected by assertion text. Only those
existing baseline anchors and evidence snippets are reconciled; no existing
status is waived. Of the 100 removed findings, 99 match existing open ledger
rows by file, rule, occurrence and duplicate ordinal. Two repeated identical
assertions require the ordinal to disambiguate them. One newer watermark
assertion is absent from the historical ledger; its captured before finding
will be added with the verified fix instead of marking another row fixed.

## CI console repair

PR #1323's second CLI shard failed two tagged-printer assertions and the
PersonMatch fallback stderr-only assertion. Both files reproduce the same three
failures under `CI=1` on unchanged source: 35 pass, three fail, zero skipped.
Runner start diagnostics were included in the TestConsole output those tests
expected to contain only application messages.

The printer capture helper now builds a fresh TestConsole. The PersonMatch
assertion provides a fresh console inside the test body, after lifecycle start.
The original stdout/stderr expectations remain exact. CI tracing and runner
production behavior remain unchanged. All 38 tests pass under `CI=1` on both
Node and Bun after the repair. A reasoned EV002 resource exception documents
why this cheap console must have a shorter lifetime than the instrumented test.

## Comparison and proof status

The before cohort passed all 1,315 tests on Node (171.240449459 seconds) and
Bun (108.110158514 seconds), with no skips and identical file/title registration
multiplicities. Source hashes remained stable in both runs. Host load, CPU,
memory and I/O pressure, runtime versions, and process limits are recorded.
Concurrent proof work means these are observed durations, not causal speedup
evidence.

The after cohort passed all 1,315 tests on Node (175.681474765 seconds) and
Bun (104.795435871 seconds), with stable source hashes, zero failures/skips and
identical file/title multiplicities across all four runs. Parsed non-import
statements match exactly the 102 planned edits. Full CLI package verification
passes: audit 676.7 seconds and docgen 20.4 seconds. The separate Effect
test-typecheck artifact reports style diagnostics, including pipeable
assertions and the short console provider. Those require follow-up repair
before full repository readiness; the package proof does not cover that lane. The reconciled lint ratchet passes with 4,391 findings,
zero introduced findings and 626 resolved baseline findings; the goal is not
complete and the baseline is not empty.

Private receipts use the prefixes `cli-option-some-batch-*`,
`console-followup-ci-*`, and `console-followup-ratchet-*`. The hosted failure
and original CI control use `pr1323-cli2-job` and `pr1323-ci-console-control`.
