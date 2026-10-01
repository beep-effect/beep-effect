# Repository topology and emit law runtime proof

Source commit: `f524a74ac2ed53ac9c83bc119fbc2b86ee61fd4f`.

The two foundation/tooling topology callbacks now use the instrumented Effect
runner directly. The single-project emit audit uses an instrumented Effect
callback under the public NodeServices layer, with an explicit ten-second hook
budget. The one per-test layer provider is removed. Discovery and assertions
still inspect the actual checkout; fixture data does not replace repository data.

All three registrations and their body options, plus all eighteen assertion
trees, are preserved. The pre-commit check made no further changes after the
explicit format/import pass. No production code or assertion was weakened.

## Verification

- Fresh baselines pass on Node and Bun: topology two tests at 406/254 ms;
  emit one test at 3.93/1.91 seconds. The combined migrated suites pass all
  three tests at 4.83/1.74 seconds with CI enabled. Different grouping and
  shared workstation activity prevent a causal performance comparison.
- The actual package test-type artifact has exitCode zero and empty diagnostics.
- Package quick verification passes: lint 3.6 seconds and check 6.4 seconds.
  This bounded change alters callback ownership and the existing read-only
  platform fixture, with no new production resource or API. Focused runtime
  and assertion parity supplement the lint/check subset.
- The root ratchet scans 1,217 files: 2,860 findings, zero introduced and
  2,171 resolved against the existing baseline.
- Three historical EV001 rows are fixed with the source commit above. The
  existing EV010 row becomes an explicit native-filesystem exception: this
  law test verifies actual package scripts across more than 100 discovered
  checkout manifests. An in-memory manifest fixture would prove different data.
  The exception does not cover unrelated filesystem findings or tests.
- Strict decoding and historical ID preservation are checked for the ledger.
  Totals: 3,497 rows, 1,985 fixed, thirteen exceptions and 1,499 open.

The prior ecosystem resource migration passed full package audit and docgen
before these edits began. This receipt establishes local evidence for this
bounded follow-up, not hosted readiness or completion of the broader goal.
