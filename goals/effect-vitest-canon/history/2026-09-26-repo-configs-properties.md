# Repository configuration property checkpoint

Sixteen existing generated laws now register individually through native `it.prop`
in the five admitted property-bearing files. The original schema arbitraries,
codec operations and independent assertions remain unchanged. CacheQualificationKey
retains `fcRuns(40)`; the other fifteen domains retain `fcRuns(25)`. RouteHas still
exercises its synchronous decode API and compares the complete decoded predicate.
No domains, filters, production schemas or rejection expectations were added.

Aggregate property cases were split into schema-named registrations. The migration
removes manual runtime/check-result adapters while preserving every original law.
Inverse token comparison, accounting for the mapped wrappers, imports and trailing
comma formatting, passed for all five files.

Full `bun run beep quality package-verify @beep/repo-configs` passed: audit
10.0 seconds and docgen 4.4 seconds. A targeted Node Vitest run with
`BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708` registered and passed all sixteen laws,
with zero failures. Its name filter excluded forty-seven other tests in those
five files; this focused result does not claim that those tests ran.

The next phase is bounded flake review, followed by runner instrumentation.
