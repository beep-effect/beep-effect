# CLI guard runtime migration proof

The validatePathSegment dual-arity test now returns an Effect through the
instrumented it.effect tester. Two success cases yield the validation directly.
Two rejection cases use Effect.flip and compare the exact tagged error and
message. This strengthens the old acceptance of any synchronous runtime throw:
a defect, wrong message, or unexpected success no longer satisfies the test.

The test-local InvalidPathSegment tagged error retains the existing `source: ..`
message. It replaces generic Error only in this executing fixture; the separate
filesystem API-shape construction checks are unchanged. No production code or
filesystem service was changed. These validation calls perform no filesystem
or process work and require no shared resource layer.

## Verification

- Baseline and final runs each pass all 25 tests on Node and Bun with CI enabled.
  Baseline durations: 3.03 and 1.29 seconds. Final durations: 3.28 and 1.28
  seconds. Shared workstation activity prevents causal performance conclusions.
- AST checks preserve all 25 registrations and options, all four validation
  calls with their input expressions, and all other source outside the migrated
  callback and the explicitly added tagged-error fixture/import.
- The initial generic Error fixture triggered globalErrorInEffectFailure
  diagnostics once it ran inside an Effect callback. The tagged error resolves
  them. The final test-type artifact has exitCode zero and empty diagnostics.
- Final package quick verification passes: lint 4.6 seconds, check 8.0 seconds.
  This single pure test callback and local error fixture justify the quick
  subset, with the focused Node/Bun suite and separate test-type artifact.
- The final root ratchet scans 1,217 files: 2,867 findings, zero introduced
  and 2,164 resolved against the existing baseline.
- The targeted detector drops from four findings to zero. Four historical
  inventory identities match exactly by rule and occurrence. All four are fixed
  with the source commit below; no new finding or exception is introduced.

Source commit: `f18ae4a35e19ba67e8a510625962746abe484c8e`.
Signing recovered without configuration changes. The combined ledger now has
3,497 unique schema-valid CLI rows: 1,978 fixed, twelve exceptions and 1,507 open.
This evidence does not establish hosted readiness or goal completion.
