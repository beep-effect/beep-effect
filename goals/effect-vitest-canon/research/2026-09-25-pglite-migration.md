# PGlite P2 migration proof

All three source test files use the instrumented runner. The lifecycle test has
managed fallback scope cleanup while preserving early close and the failed query
witness. Native persistent storage retains two fully completed database lifetimes
at one temporary dataDir; Drizzle preserves beta:1 before alpha:2. No production
code or timeout inflation is included.

Original Node baseline: eight tests pass. Migrated Node and Bun runs each pass
nine tests, including the additional constrained Some-cause codec property.
All 13 original assertion expressions and eight names match AST parity.
Test typechecking passes. Full package verification passes: audit 28.0 seconds,
docgen 3.0 seconds.

The after timing includes all three files and nine tests: 5.508 seconds whole
command, reporter span 5066.915ms. Maximum sampled load1 was 39.90625; CPU,
memory and I/O avg10 PSI maxima were 9.11, 0.22 and 1.02. Source hashes were
stable across the run. Runtime and test population differ from the baseline;
these measurements are not a causal speedup claim or hosted proof.

Seven current detector exceptions retain three explicit context provisions,
three shorter database lifetimes and the native filesystem. Non-PGlite baseline
findings are unchanged. Cache parity permits only ten PGlite dependency lists.

The cause property covers codec-supported native Error fields, not lossless
round trips of arbitrary opaque values. Fallback cleanup follows scopedWith
semantics; the preserved early-close witness does not inject interruption.
Goal-ledger reconciliation and hosted PR closure remain separate work.

## Review provenance correction

The active detector sidecar now mirrors the seven current source-anchored
exceptions in the standards baseline. The eight original P1 detector rows and
their P2 dispositions are preserved in
`2026-09-25-pglite-original-detector-dispositions.jsonl` beside this receipt.
Together with the twelve unchanged lens rows, that archive preserves all twenty
original inventory decisions without presenting deleted helper names as current
detector identities. The original inventory totals remain historical accounting.

A second timing sample is collected from committed migration head dd15e8c40e.
Its headBefore/headAfter fields are the actual Git heads at collection boundaries.
The first sample ran against uncommitted migration source at the OBS base; its
source manifest was stable, but its Git head alone did not identify those edits.
The first raw sample, context and source manifest remain in private provenance
receipts. The current timing artifacts carry the second sample unchanged.
