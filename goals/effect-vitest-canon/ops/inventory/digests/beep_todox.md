# @beep/todox — P1 wave000 digest

Source audit complete; P2 remains gated. **Historical schema rejection:** the original public decoder rejected the charter-mandated L-*-NONE rule IDs; coverage rows retained those prescribed IDs pending the schema correction documented below. The actionable numeric-ID row, where present, decodes successfully. Exactly one assigned census file, four lens rows: 0 actionable and 4 coverage-only. All rows are judgment/open; no exception or fix SHA was manufactured. The retained 132-file detector export contains 8,228 rows, matching Root’s inventory-start summary, and zero rows for these three assigned packages. The committed baseline also has zero assigned-package rows. No detector was rerun.

| Lens | Rows | Minor | Info | Actionable |
| --- | ---: | ---: | ---: | ---: |
| resource | 1 | 0 | 1 | 0 |
| flake | 1 | 0 | 1 | 0 |
| property | 1 | 0 | 1 | 0 |
| observability | 1 | 0 | 1 | 0 |

No major or blocker rows. Top 10 files (only one exists in this assignment): `apps/todox/test/app.test.tsx` — 4 rows. Full read and exact source hash: private wave000/read-receipts.json.

## Layer topology and MemoryFileSystem

No Effect layers or service rebuilds. One React DOM render exercises a static heading; separate cases inspect metadata and a returned element shell. No filesystem behavior is tested. No new global DOM cleanup guarantee is asserted.

## Findings and evidence limits

No change required for Effect resource ownership: Home is a static heading, metadata is a constant, and RootLayout builds html/body elements. One DOM render exists; other cases do not render or consume its DOM. No service layer or filesystem is the subject; no new cleanup guarantee is claimed.

No change required: all three cases are synchronous static UI/metadata checks without timers, waits, random values or external requests. No observed source-order dependence between the single DOM render and the two object checks; hosted history pending.

No change required: literal app metadata and exact html/body composition have direct example contracts, not a production Schema or arbitrary law. Keep the explicit title, description, language and child propagation assertions.

No change required: accessible-role lookup reports the missing heading and equality matchers retain expected metadata and shell operands. These static synchronous tests have no Effect cause, logger or bounded wait requiring instrumentation.

## History and timings

30-day hosted-history attribution and Node baseline timings are pending Root enrichment. No assertion of zero historical failures is made; a partial 30-failure slice would not establish complete 30-day coverage. No package tests, benchmarks or compiler proofs were run by this lane. Planned timing runtime: Node 22.22.3, Bun 1.4.2, Vitest 4.1.11; rc113 adapter peer compatibility remains the accepted integration disposition, not a newly proved peer guarantee. The normal check has 90 inherited-main findings; this audit does not change the baseline or remediate them.

## Proposed internal P2 order

Scope → assertions → property → flake → observability, after Root authorization. Preserve native subjects and all existing assertion operands. Coverage-only rows require no fabricated migration. Review the actionable diagnostic row, where present, at the observability step; fold in Root's completed history and before/after timings. Compiler evidence remains necessary for type-level assertions.

## Root evidence enrichment — 2026-09-11

The [accepted Node command baseline](../timings/baseline/beep_todox.json) records
3 test registrations across 1 reported files. Reporter duration is
762.499 ms; the separately measured whole command took
1.066 seconds. [Context and slowest files](../timings/context/baseline/beep_todox.json)
retain exact input hashes, assertion statuses, worker settings, limits and load.
This is the frozen starting-main Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort,
without a workstation-load adjustment. It does not replace package or compiler
proof. Census file representation does not establish that skipped/todo
registrations executed.

The [frozen hosted summary](../hosted-history-summary.json) maps
4 observations across 4 jobs to this package;
categories: environment-configuration-rejection: 4. The window is 2026-08-12T23:06:31Z through
2026-09-11T23:06:31Z. These are historical observations, not a current-source
or flakiness diagnosis. The full collection has 21 inaccessible logs and one
unresolved downloaded-job cause; zero mapped observations would not prove zero
failures. Job links and historical source heads remain in the summary.

The source audit's original schema-rejection receipt remains historical evidence.
The inventory contract correction now passes full strict validation across all
1,122 census files, including the required NONE rows. This supersedes the original
schema-acceptance blocker above. P1 corrections and Benjamin's acknowledgement
remain pending; see the [current review record](../../../research/2026-09-16-p1-independent-review.md).
