# Lint-rules instrumented runner migration

All four existing suites now import `it` from `@beep/test-runner`. The remaining
five admitted files are helpers or fixtures. Token-level comparison with
`2ef97c2ca4` proves every test body is unchanged by this runner step; isolated
`it.layer` receivers and native subprocess subjects remain intact.

The package declares its runner development dependency. The lockfile, two
TypeScript references, and two Fallow boundary entries were generated. The
schema dependency added during the property phase is also accounted for in the
cache review: thirteen owned computations reviewed, eight dependency lists
changed, each adding exactly one schema and one runner edge. Commands, task
configuration, all unrelated nodes, and qualification state remain unchanged.
Cache audit reports zero blocking findings; inherited source-drift review
notices and the 1251 unassessed computations were not silently rebaselined.

Evidence:

- Full package audit: 15.5 seconds; docgen: 2.4 seconds, both passed.
- All 78 cases passed on Node and Bun with stable source hashes. Whole-command
  timings: Node 14.440512848 seconds; Bun 8.078954240 seconds. Private receipts
  include workstation load, pressure, versions, and limits.
- All four inherited properties passed a 400-run floor with seed 20260708.
- The temporary deliberate-failure probe stayed quiet with tracing disabled;
  with tracing enabled it recorded case name, failure outcome, and duration.
  The probe was removed before the final detector scan.

Final ledger reconciliation and hosted publication remain outstanding.
