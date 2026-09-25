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
