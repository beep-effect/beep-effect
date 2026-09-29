# Bootstrap plan migration preparation

The existing historical ledger includes ten runtime findings and two other
findings for goals-bootstrap-plan.test.ts. Original line/evidence matching
recognizes all twelve rows. Current-source inspection requires three lineage
adjustments before any reconciliation:

- Two runSync findings in property cases are already absent. The slug property
  now uses it.effect.prop; the plan property returns an Effect directly.
- The former slug checkEffect finding is likewise absent after property-runner
  migration. File history identifies b1aa7e320c as the commit introducing
  it.effect.prop; its diff confirms both runSync removals and the slug
  checkEffect replacement, retaining 32 generated runs.
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

No bootstrap-plan source is changed. This is a targeted inspection of the
existing inventory, not a new repo-wide inventory.

The unchanged baseline passes all 26 expanded cases on Node and Bun, with
stable source hashes and no isolated temporary residue. Whole-command samples
are Node 4.974 seconds and Bun 2.568 seconds, overlapping the prior package
proof. These samples support comparison bookkeeping, not a performance claim.


## Merged-main property reconciliation

The diff of `b1aa7e320cde926e7e80a98073ba8b0d517d7c8c`, verified as an
ancestor of this branch, confirms the three property findings were already
fixed. Reconciliation closes exactly those two EV001 runSync rows and one
EV007 slug-property row against that original fix SHA, preserving all other
rows. The renamed index runtime remains open. See
`cli-bootstrap-property-backfill.json` for exact identities and lineage.
Strict CLI/schema ledger validation passes. CLI totals become 1,899 fixed,
12 exceptions and 1,584 open. The current grouped package proof passed with unchanged package source:
`bun run beep quality package-verify @beep/repo-cli` exited zero, audit 702.1
seconds and docgen 20.0 seconds. This is not goal-wide acceptance.
