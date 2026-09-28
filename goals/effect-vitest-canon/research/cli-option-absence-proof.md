# CLI Option absence predicate migration

> Correction: the EV006 reduction below was caused by a detector gap for
> piped boolean assertions. It does not prove canonical absence migration.
> A follow-up now tests method and functional pipes, repairs detection, and
> replaces those predicates with `assertNone`. The historical test parity
> remains valid, but canonicalization credit requires the corrective proof.

## Scope and preservation

This batch selects 26 files from the existing open CLI EV006 inventory. It
replaces 215 `expect(O.isNone(subject)).toBe(true)` assertions with
`subject.pipe(O.isNone, assertTrue)`, preserving the subject, predicate and
truth polarity. Subjects are evaluated once. Namespace provenance, shadowing,
parse validity and unique imports are checked before application. A structural
comparison verifies that non-import statements contain only the planned
replacements, allowing redundant parentheses removed by formatting.

The direct piped form complies with the Effect test diagnostics repaired in
the preceding batch. The actual package-test-typecheck artifact reports exit
code zero with empty diagnostics.

## Inventory reconciliation

Actual before/after detector output removes exactly 215 EV006 findings while
preserving every other finding group's multiplicity and order. Thirty-two
changed enclosing-statement hashes and their evidence snippets are narrowly
reconciled; the baseline is not expanded and no old status is waived. The
ratchet passes with 4,176 findings, zero introduced and 841 resolved baseline
findings. This does not constitute goal completion.

Of the removals, 213 match existing open rows by file, rule, occurrence and
duplicate ordinal. Two newer assertions were absent from the historical
inventory: quality-tasks global exclusion and a fourth remediation-wave
absence check. All three historical copies of the latter expression already
map uniquely to other current occurrences. These two captured findings now have their own fixed records, preserving
existing identities. All 215 records reference source commit
`038fe84ce41e31e59b61f10e6eda184ade7b4478`; ledger reconciliation is saved in
`bf7d16642909cc4988899b31cb8c6b1713e97c86`.

## Proof status

After the preceding policy repairs, a refreshed before cohort passes all 1,194
tests on Node (159.818289159 seconds) and Bun (106.915642951 seconds), with
stable source hashes and zero failures or skips. The older pre-policy
comparison is retained as historical evidence rather than substituted for
this baseline. The after Node cohort passes the same 1,194 tests in
212.852870993 seconds; Bun after-proof passes all 1,194 tests in
156.009124865 seconds. Both preserve stable source hashes. All four runs have
identical file/title registration multiplicities with zero skips/failures. Full
CLI package verification passes: audit in 776.8 seconds and docgen in 21.3
seconds. The source remained unchanged throughout that proof; only packet
evidence and inventory records were committed during the run.

Load averages, CPU/memory/I/O pressure, runtime versions and process limits
are captured per run. Parallel proof activity means these durations do not
establish a causal speedup or slowdown.

Private receipts use `cli-option-none-batch-*`, including the current-before
comparison, source proposal, statement comparison, actual detector control,
ledger plan, test-typecheck artifact and reconciled ratchet log.
