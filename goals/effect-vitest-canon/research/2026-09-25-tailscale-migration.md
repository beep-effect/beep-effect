# Tailscale P2 migration proof

Both source test files use the instrumented runner, retaining every original
assertion and timeout subject. A bounded production-schema address property
checks exact filtering order and duplicates with selected known negatives.
The property uses fcRuns(100), respecting environment-max overrides. Static phase
logs omit process arguments, stderr, tokens and causes.

Baseline Node: 19 tests pass. Migrated Node and Bun: 20 tests pass each.
The explicit 400-run sweep with seed 20260708 passes all 15 cases in the selected
main file; the default runs cover all five equivalence cases separately.
Test typechecking passes. AST parity preserves all 75 original assertions and
19 original names. Full package verification passes: audit 6.6 seconds and
docgen 3.0 seconds. No production defect was observed.

Configured timing passes all 20 tests in two files: 3.254 seconds whole command,
2922.217ms reporter span. Maximum load1 is 13.50049; CPU avg10 PSI maximum
is 0.11 and memory/I/O maxima are zero. Source hashes remain stable. Runtime
and test population differ from baseline; no causal speedup is claimed.

Six EV014 candidates are pure in-memory providers, not native process startup.
EV015 retains a block-owned TestClock and a scoped fiber that is joined before
teardown. These are specific provenance and ownership judgments, not blanket
exceptions for factory calls or single-case blocks. The saved inventory contains
six EV014 rows; the older digest prose incorrectly says five.

Non-Tailscale baseline rows are unchanged. Cache comparison changes only eight
Tailscale dependency lists. No network, daemon, OS process, production source,
retry policy or time budget was added. The property covers schema positives and
selected negatives, not exhaustive address classification.

Ledger reconciliation and hosted PR closure remain separate steps.

## Evidence provenance follow-up

The active detector sidecar now matches current source identities in the
standards baseline. All seven original detector dispositions are preserved in
`2026-09-25-tailscale-original-detector-dispositions.jsonl`; together with the
eight lens rows, these retain the original fifteen-row accounting.

The current after-timing artifacts come from a second run at the committed
migration head after merging PGlite evidence corrections. Collection-boundary
headBefore/headAfter values identify that committed tree. The first sample ran
on stable uncommitted source; its raw data, context and source manifest remain
in private precommit receipts. No prior measured value was relabeled.
