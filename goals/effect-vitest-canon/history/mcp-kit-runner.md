# MCP kit runner integration for the inventoried cohort

The six originally inventoried test files now import it from @beep/test-runner.
The support fixture remains unchanged. Five files added since the frozen census
remain explicitly pending reconciliation; this is not complete package coverage.

The dev dependency uses workspace:^, with the Bun-generated lockfile, generated
TypeScript references, Fallow boundaries, and ten cache dependency lists updated.
No cache configuration or qualification state changed.

Full package verification passed: audit 7.7 seconds and docgen 3.6 seconds.
Syncpack, frozen-lockfile validation, and Fallow boundary checks passed.
Cache audit reported zero blocking findings and 1251 unassessed computations.

## Upstream property attribution

Six detector rows and three observability judgments were already addressed by
commit b1aa7e320cde926e7e80a98073ba8b0d517d7c8c (PR #1200). Its diff replaces
the three native property loops with nine it.effect.prop registrations, each
retaining a floor of 50. The ledger preserves the original row identifiers and
evidence and credits that landed commit. These are not new fixes in this wave.
