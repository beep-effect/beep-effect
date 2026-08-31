# Local-to-hosted parity defect ledger

This ledger records every observed case where the canonical local proof was green but a required
hosted lane was red on the same effective tree. A row remains open until its cause class and fix
are known. Hosted-only dependency review is outside the hard parity metric by design.

| Observed | Lane | Tree / PR | Cause class | Fix | Status |
| --- | --- | --- | --- | --- | --- |
| 2026-08-13 | Coverage Regression | #698 precursor | local coverage scope omitted dependents | B10 transitive dependent scope and weighted selected shards | fixed |
| 2026-08-24 | Coverage Regression | #780 to #783 | branch baseline and dependent row divergence | B9 deterministic environment plus B10 base-pinned dependent scope | fixed |
| 2026-08-25 | Coverage Regression | B11 evidence run | policy-only baseline edits forced a full, self-comparing run | compare the baseline from `origin/main` and scope package-row-only edits | fixed |
| 2026-08-27 | Check | packet baseline | affected hosted Check typechecked tests that local package proof omitted | B6 `quality test-tsgo` cheap preflight and complete package audit template | fixed |
| 2026-08-27 | Docgen | packet baseline | workflow and local replay selected mode with separate predicates | B7 CLI-owned `--mode auto` predicate used by hosted and local dispatch | fixed |
| 2026-08-30 | Test Unit; Coverage Regression | `main@d324544d3a3` run `33288500757`; `main@48358da036` run `33294036758` | the test mutated `Bun.env`, but Effect's ambient config retained `push/main`; the valid main-push path spawned 15 commands while the assertion assumed the 17-command PR path | make event and ref posture explicit in the lane decision, test PR and main-push cases separately, and assert the changeset-status behavior instead of one ambient command count | fixed in #892; PR and first current-main run `33302435645` green |
| 2026-08-30 | Coverage Regression | `main@a82731ac3c1` run `33303853318` after #869 | isolated T7 capacity-preflight fixture I/O: the undersized-capacity case returned `PreservationArchiveIoError` instead of `PreservationCeilingExceededError` | no code change attributed; the PR-head coverage run was green and the next six main-push Check runs were green | classified nonrecurring; retain as a flake candidate and reopen as P0 on recurrence |

New rows must name the failing required context, the exact head/tree or PR, and the owning cause
class before closeout. Repeated cause classes are P0 regressions, not waivable noise.
