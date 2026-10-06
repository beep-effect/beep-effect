# Practice KG claims coverage repair — 2026-10-06

The #1445 `Heavy / Coverage Regression` job measured
`PracticeKg.claims.ts` at 97.7% statements, 94.28% branches, 93.54%
functions, and 98.43% lines, below its existing 99.06% / 96.29% /
100% / 99.05% floors. A full local V8 run on the merged main plus the
CLI follow-up branch reproduced the hosted row exactly: 87 passing tests,
one skipped, and uncovered lines 276 and 407.

The existing `PracticeKg.projections.test.ts` integration suite now checks
four previously unexercised behaviors. An invalid DuckDB fixture makes the
source-document lookup fail with its typed claims error. A filesystem
service that returns an oversized read after a small-file stat exercises
the second size guard. A failing filesystem existence check verifies the
fallback to no catalogued source digest. A normalized patent input with an
explicit digest verifies that the caller's provenance wins.

The two affected integration tests pass together. Full local V8 coverage
still passes 87 tests with one skipped and measures `PracticeKg.claims.ts`
at 100% on statements, branches, functions, and lines. No coverage floor
was lowered. Full `@beep/law-practice-server` package verification passed
(audit 28.8 seconds, docgen 10.5 seconds). Hosted coverage remains pending.

The added batch calls deliberately retain shorter native PGlite connection
scopes inside the public `it.layer` fixture. The detector added three semantic
EV002 findings and regenerated one existing finding's occurrence identity;
all four current rows are recorded as reviewed exceptions in the server ledger
and baseline, with the historical row retained. The count moved from 1,926 to
1,929 without an unreviewed new finding.
