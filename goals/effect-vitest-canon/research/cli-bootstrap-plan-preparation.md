# Bootstrap plan migration preparation

The existing historical ledger includes ten runtime findings and two other
findings for goals-bootstrap-plan.test.ts. Original line/evidence matching
recognizes all twelve rows. Current-source inspection requires three lineage
adjustments before any reconciliation:

- Two runSync findings in property cases are already absent. The slug property
  now uses it.effect.prop; the plan property returns an Effect directly.
- The former slug checkEffect finding is likewise absent after property-runner
  migration. File history identifies b1aa7e320c as the commit introducing
  it.effect.prop; inspect its full diff before attributing ledger closure.
- The old index-case title says it rejects drift. The current case instead
  refreshes the stale local projection and asserts its new output. File history
  identifies integration commit c574e2a45f for that transition. A title-only
  search reports this row absent even though a runtime remains in the renamed
  case; do not close it as removed or restore the outdated behavior.

A shared run helper still provides NodeServices and opens a runtime for eleven
callers. Seven other direct runtime calls remain, including a parameterized
slug-rejection registration. Existing Effect properties and command tests must
retain their semantics and options. Seven cwd wrappers include the already
Effect-based default-date command test. A future draft must cover all helper
callers, preserve the per-case console assertions, and audit the native packet
and date paths before choosing clocks.

No bootstrap-plan source is changed and no ledger rows are closed by this
preparation. It is a targeted inspection of the existing inventory, not a new
repo-wide inventory.
