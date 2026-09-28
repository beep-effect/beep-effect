# Canonical absence pipe correction

The previous predicate migrations used public boolean assertions in pipe
syntax. EV006 inspected direct calls but skipped pipes both at dispatch and
inside its Boolean assertion rule. This falsely credited absence checks as
canonical. Source repair `8db646627924b611bd3ae272ff389e5cf17f02cb` recognizes
proven Option `isNone`/`assertTrue` and `isSome`/`assertFalse` stages in method
and functional pipes, including aliases. Shadowed imports, ordinary consumers,
presence checks and existing Result/Exit boolean checks remain excluded.

The added regression failed against the old detector with empty findings. All
212 detector tests now pass on Node and Bun. The real generated TypeScript
result files for both touched packages report exit zero and empty diagnostics.

## Corrected assertions and inventory

The repair replaces 216 CLI and 50 schema-package predicate/assertion pairs
with `assertNone`, retaining the exact Option subject and evaluation count.
Structural comparison allows only planned assertion replacements and import
cleanup. Detector comparison preserves all other groups and reconciles 32
CLI enclosing-statement anchors; schema needs no anchor changes. The root
ratchet reports 3,766 findings, zero introduced and 1,251 resolved. It does
not expand the baseline or treat this correction as a new reduction.

The CLI ledger updates correction provenance on 216 already-fixed records.
The schema ledger updates 51 historical records for 50 live assertions: its
SchemaUtils optional-label check has both the original sync and migrated
Effect historical identities. Both now point to the same corrected current
assertion. No status changes, record deletions, duplicate credit or new
exceptions are introduced.

## Verification

All four CLI before/after Node/Bun runs pass the identical 1,194 test
registrations with no skips and stable source hashes. Node durations are
161.135 and 156.706 seconds; Bun durations are 97.815 and 99.830 seconds.
All four schema runs likewise pass the identical 136 registrations: Node
4.872 and 4.071 seconds, Bun 3.019 and 2.418 seconds. Load, pressure, runtime
versions and limits are recorded; these are observations, not causal
performance claims.

Full schema package verification passes: audit 9.6 seconds and docgen
5.6 seconds. Full CLI package verification passes: audit 666.5 seconds and docgen
19.7 seconds. Source stayed unchanged during the proof; the only intervening
commits reconciled packet evidence and historical inventory records.
Hosted follow-up proof and remaining goal work remain outstanding. PR1323
remains frozen under the operator's instruction.

Private receipts use `cli-option-none-pipe-repair-*`,
`schema-option-none-pipe-repair-*` and
`option-none-pipe-repair-final-ratchet.log`.
