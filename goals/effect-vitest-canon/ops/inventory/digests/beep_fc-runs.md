# @beep/fc-runs — P1 wave000 digest

Source audit complete; P2 remains gated. **Historical schema rejection:** the original public decoder rejected the charter-mandated L-*-NONE rule IDs; coverage rows retained those prescribed IDs pending the schema correction documented below. The actionable numeric-ID row, where present, decodes successfully. Exactly one assigned census file, four lens rows: 1 actionable and 3 coverage-only. All rows are judgment/open; no exception or fix SHA was manufactured. The retained 132-file detector export contains 8,228 rows, matching Root’s inventory-start summary, and zero rows for these three assigned packages. The committed baseline also has zero assigned-package rows. No detector was rerun.

| Lens | Rows | Minor | Info | Actionable |
| --- | ---: | ---: | ---: | ---: |
| resource | 1 | 0 | 1 | 0 |
| flake | 1 | 0 | 1 | 0 |
| property | 1 | 0 | 1 | 0 |
| observability | 1 | 1 | 0 | 1 |

No major or blocker rows. Top 10 files (only one exists in this assignment): `packages/tooling/test-kit/fc-runs/test/FastCheckRuns.test.ts` — 4 rows. Full read and exact source hash: private wave000/read-receipts.json.

## Layer topology and MemoryFileSystem

No it.layer graph or scoped-layer rebuild. One joined native child intentionally reloads boot configuration. Each seed case temporarily replaces the default ConfigProvider load method and restores it in finally, with no suspension inside the critical section. Keep the native process boundary; MemoryFileSystem is not a substitute for process boot. The shared Node setup implements Bun.spawnSync through node:child_process; no missing-Bun runtime claim is made.

## Findings and evidence limits

No change required for resource ownership: the fresh child is the boot-snapshot subject; synchronous spawn joins it, and the ConfigProvider spy restores in finally without an await. MemoryFileSystem would erase the subject.

No source-supported flake repair identified: the child floor is explicit; seed cases install a provider synchronously and restore it before returning, even with concurrent registration. No sleep, retry, random sample or detached work. Hosted history remains pending.

No property migration required by this audit: the file tests the floor/seed configuration helper itself with valid, invalid and absent inputs plus a fresh-process max/floor check; it contains no arbitrary runner or schema round-trip. Do not replace boot isolation with a generated in-process law that merely repeats Number/isInteger/max.

Retain the fresh-process boot probe and exact stdout assertion. Use assertTrue(result.success, a bounded diagnostic containing child exit/signal and stderr); attach the same diagnostic to stdout mismatch. Do not print the inherited environment or add retries. Review Node shim launch errors separately; this is not an Effect conversion.

## History and timings

30-day hosted-history attribution and Node baseline timings are pending Root enrichment. No assertion of zero historical failures is made; a partial 30-failure slice would not establish complete 30-day coverage. No package tests, benchmarks or compiler proofs were run by this lane. Planned timing runtime: Node 22.22.3, Bun 1.4.2, Vitest 4.1.11; rc113 adapter peer compatibility remains the accepted integration disposition, not a newly proved peer guarantee. The normal check has 90 inherited-main findings; this audit does not change the baseline or remediate them.

## Proposed internal P2 order

Scope → assertions → property → flake → observability, after Root authorization. Preserve native subjects and all existing assertion operands. Coverage-only rows require no fabricated migration. Review the actionable diagnostic row, where present, at the observability step; fold in Root's completed history and before/after timings. Compiler evidence remains necessary for type-level assertions.

## Root evidence enrichment — 2026-09-11

The [accepted Node command baseline](../timings/baseline/beep_fc-runs.json) records
8 test registrations across 1 reported files. Reporter duration is
408.315 ms; the separately measured whole command took
0.766 seconds. [Context and slowest files](../timings/context/baseline/beep_fc-runs.json)
retain exact input hashes, assertion statuses, worker settings, limits and load.
This is the frozen starting-main Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort,
without a workstation-load adjustment. It does not replace package or compiler
proof. Census file representation does not establish that skipped/todo
registrations executed.

The [frozen hosted summary](../hosted-history-summary.json) maps
4 observations across 1 jobs to this package;
categories: coverage-ratchet: 4. The window is 2026-08-12T23:06:31Z through
2026-09-11T23:06:31Z. These are historical observations, not a current-source
or flakiness diagnosis. The full collection has 21 inaccessible logs and one
unresolved downloaded-job cause; zero mapped observations would not prove zero
failures. Job links and historical source heads remain in the summary.

The source audit's original schema-rejection receipt remains historical evidence.
The inventory contract correction now passes full strict validation across all
1,122 census files, including the required NONE rows. This supersedes the original
schema-acceptance blocker above. P1 corrections and Benjamin's acknowledgement
remain pending; see the [current review record](../../../research/2026-09-16-p1-independent-review.md).
