# Stream, normalization and synthetic scheduler runtime migration

The stream and normalization tests now return their Effects through the public
instrumented tester. Stream cases use a serial public fixture, per-case cwd
resources and fresh consoles. Eleven native journal-lock cases retain live
clocks; the pure decode case retains the test clock. Six Promise assertion
continuations become Effect mappings, with chained pipes flattened after
checking the actual type diagnostic artifact.

The synthetic scheduler case also returns its Effect through the public
tester with a live clock. Its existing scoped temporary-root helper and
runtime overrides remain intact. The separate PATH wrapper and platform
review obligations remain open. Migrating this remaining runtime boundary
resolves the guard-hoist fingerprint interaction without changing the baseline.

Applied verification:

- Stream/normalization: 36 tests pass on Node and Bun. All 108 assertion trees,
  test title multiplicities and per-test options are preserved.
- Synthetic scheduler: two tests pass on each runtime; all 52 assertion trees
  are preserved, including its existing property test.
- Actual package test-type diagnostic artifact: exit zero, empty output.
- Root Oxlint passes. Root Effect Vitest ratchet passes across 1,217 files:
  2,987 findings, zero introduced, 2,035 resolved against the existing baseline.
- Stream resource failure and interruption injections each produce exactly
  11 intended failures and one passing pure test on both runtimes, with no
  temporary residue. Console and clock probes each pass 13 tests, observing
  12 distinct consoles and 11 advancing clocks.
- Normalization assertion-failure probes each produce exactly six intended
  failures and 18 passes on both runtimes after pipe flattening.
- Synthetic scheduler failure and interruption injections each fail exactly
  the resource-using case while the property passes. Clock controls pass both
  tests on both runtimes. Temporary roots are empty after each run.
- Every mutation harness restores source bytes exactly.

Stream/normalization whole-command observations are Node 6.826 -> 7.027 seconds
and Bun 3.170 -> 3.169 seconds. Source hashes, runtime versions, load and pressure
are retained in private receipts; baseline/proof concurrency prevents causal
performance claims. Synthetic scheduler Vitest report durations are Node
3.840 -> 4.025 seconds and Bun 2.129 -> 2.065 seconds, likewise observational.

Historical line/evidence/title checks match all 23 stream/normalization runtime
rows uniquely. The synthetic runtime row is reconciled separately. No resource
wrapper, platform review or historically absent finding is closed by this work.
Full grouped package verification remains required after the source commit.

Source commit: `bd22fc4a501a921872cffaf650bd79694e0db9ad`. Historical reconciliation
closes exactly 24 runtime rows (12 stream, 11 normalization, one synthetic
scheduler), adds no rows, and preserves all remaining obligations. Strict
validation passes for all 3,495 CLI rows and 687 schema rows. CLI totals are
1,857 fixed, 12 exceptions and 1,626 open. The grouped package proof is active;
these totals describe source remediation, not full goal acceptance.
