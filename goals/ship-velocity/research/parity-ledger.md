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

New rows must name the failing required context, the exact head/tree or PR, and the owning cause
class before closeout. Repeated cause classes are P0 regressions, not waivable noise.
