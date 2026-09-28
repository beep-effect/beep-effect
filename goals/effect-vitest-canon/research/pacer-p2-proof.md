# Pacer canonical test migration

Source commit: `5ba90014c8c9cb06d2d0f48f1d125d7775ee89b9`, pushed in PR #1307.

The operator approved a narrow production cleanup repair for PR #1307 after a
controlled cancellation reproduced an allocated report remaining undeleted.
`downloadCases` now brackets report creation, use and best-effort deletion with
`Effect.acquireUseRelease`. Acquisition and release are protected from external
interruption; polling and result retrieval remain interruptible. Cleanup errors
remain logged and ignored. Existing successful, typed-failure and malformed-ID
cleanup behavior is retained. This is a local mocked-HTTP proof, not a claim of
live PACER account operation.

Three regressions cover interruption with successful deletion, interruption with
failed deletion, and a polling defect. Each fails against the original source
because no deletion is attempted and passes after the repair. The cancellation
barrier observes the first status request after report creation; it does not use
sleeps. Tests verify the interrupted outcome or exact original defect as well as
one deletion of the expected report. The original session-finalizer test still
closes its inner scope before asserting one logout with the rotated token.

All 51 original assertions and 23 registration titles remain. Four separate
24-value sample sets retain seeds 1001–1004. Their schema operations now yield
Effects. The generated round-trip law uses native `it.effect.prop`; both error
mapping laws retain their exact seven-status and five-code domains and use
`fcRuns(100)`. Independent assertion inversions fail all three laws and report
seed 20260708, replay and shrinking. No property domain or assertion was relaxed.

Fourteen public layer groups retain distinct deterministic scenarios. Their
explicit ten-second acquisition/release budgets match the normal existing hook
budget; body deadlines are unchanged. The scoped session performs real mock
login and logout effects, so its composition is not a pure stub. Three inner
provider calls retain test-local barriers/Refs or the close-before-assert logout
boundary, using the canonical helper instead of a private wrapper.

Both files use the instrumented runner. Page collection and cancellation/cleanup
barriers have phase spans; existing session acquisition/release logs remain.
A controlled failing probe is quiet with tracing disabled and reports its name,
failure outcome and duration with tracing enabled. Probe files are removed.

Full package verification passes with BEEP_FC_NUM_RUNS=400 and seed 20260708:
audit 8.1 seconds and docgen 3.0 seconds. Six root policies also pass: oxlint,
Sherif, Fallow health/audit, cache policy and schema-first. Test-only dependencies,
generated TypeScript/Fallow edges and the narrow cache dependency review are
included. All23saved actions are adjudicated; three current detector exceptions
retain the documented inner providers. The root baseline drops18old Pacer rows
and adds3current exceptions, preserving all683unrelated ledger hashes and raw
unrelated root/census objects. The remaining saved queue has11packages/626actions.

Normal Node and Bun runs each pass26tests with zero skips and stable sources.
Whole-command before/after seconds are Node4.119375/4.019568 and
Bun2.166813/1.515942. Both observations retain load, pressure and source hashes;
these are not causal performance comparisons. The before23/after26test counts
reflect the three added resource regressions.

The consolidated goal and PR still require the remaining package inventory,
final root/hosted proof and review closure before merge.
