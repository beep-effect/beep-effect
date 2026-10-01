# Main integration: 2026-10-01

Base integrated: `4a97d3955f7fa0a5d554efb5869170a50dccacde`.
Package and hosted gates remain outstanding.

Fifteen Git conflicts were resolved. The three test files for retired FileInfo,
JSONSchema and StatusCauseError concepts follow the upstream removals. Removed
SchemaUtils default-helper and TaggedError-equivalence tests follow their
upstream changes. Surviving Effect runner migrations and assertion operands
are retained. The new anchored parity-finding identity test is included.

Four surviving references to retired NonNegativeInt schemas now use S.Natural.
SchemaUtils retains assertNone and assertSome imports required by its surviving
codec tests; focused runtime proof caught their accidental removal during merge.

The inventory uses a three-way merge by historical ID. Forty-six occurrence
fingerprints were reconciled against existing rows in cache-census,
corpus-command, restoration-archive-coverage and worktree-reap. Corresponding
rule/symbol/class groups have equal cardinality across branch, main and merged
source, and each changed occurrence maps uniquely to an existing baseline row.
No finding was closed or added by the fingerprint reconciliation. The resulting
ratchet passes with 1,209 files, 2,851 findings and zero introduced findings.

Both CLI and schema test-type artifacts report exit code zero and no diagnostics.
The three affected schema files pass all 71 tests on Node (3.16 seconds) and Bun
(1.28 seconds). Ten affected CLI files pass 784 tests on Node (86.76 seconds).
The same 784 CLI tests pass on Bun (62.88 seconds). These are focused integration
results, not a full package or hosted readiness claim.
