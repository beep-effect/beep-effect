# @beep/ontology-config — P1 wave002 digest

Complete source audit of 1 assigned census files; P2 remains gated. 4 judgment/open rows: 1 actionable and 3 coverage-only. No fixSha, reason, exception or waiver was manufactured. All actionable rows decode; coverage NONE IDs remain rejected by the current public schema. Artifact acceptance remains blocked pending Root's schema/contract resolution.

| Lens | Rows | Actionable | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 1 | 1 | 0 | 1 | 0 | 0 |
| flake | 1 | 0 | 1 | 0 | 0 | 1 |
| property | 1 | 0 | 1 | 0 | 0 | 1 |
| observability | 1 | 0 | 1 | 0 | 0 | 1 |

## Top ten files by judgment rows

- `packages/ontology/config/test/Config.test.ts` — 4 rows.

Other files, if any, are retained in the exact private per-file counts and read receipts. Every assigned file has all four lenses. No support/declaration file was omitted (this assignment contains test files only).

## Layer topology, rebuilds and MemoryFileSystem

Live configuration layers read an explicitly supplied ConfigProvider and are built per case. Missing/empty workspace roots and malformed booleans deliberately fail acquisition in the typed channel; an it.layer setup death would violate those assertions. Static TestLayer constructors are pure Layer.succeed stubs. Workspace-root strings are configuration data, not filesystem activity; no MemoryFileSystem demand.

## Actionable residue

**L-RES-05 — Config.test.ts:47.** The missing/empty root and malformed flag are layer acquisition failures under test. A blanket EV002/EV003 move into it.layer setup applies orDie and destroys the asserted hasFails=true/hasDies=false contract. Separate successful configuration fixtures from deliberate acquisition tests; preserve test-owned build scope and complete Cause polarity under Root review. Static test layers are pure stubs; no exception is granted.

## History and timing limits

30-day hosted-history attribution and baseline timing remain pending Root enrichment. No claim of no historical failures is made; a partial 30-failure slice is not complete 30-day evidence. Glob's overlap is a possible unguarded interleaving, not an observed hosted failure; actual scheduling must be verified by Root. No tests, benchmarks, scanner or compiler checks were run. Planned timing is Node22.22.3/Bun1.4.2/Vitest4.1.11 with Effect/@effect/vitest rc113, not newly proved peer compatibility. The 90 inherited-main normal-check findings remain unchanged.

## Internal P2 order

Scope → assertions → property → flake → observability. First preserve acquisition-failure/native subjects and partial-setup cleanup. Then retain all expected operands/polarities during mechanical assertion review. Address the exact missing parity cases without inventing law coverage; SchemaParity already preserves fcRuns(50). Review global-backend ownership without timeout/retry or global-config weakening, then retain normalized property failure/replay evidence. Package/compiler/runtime/history verification belongs to Root after P2 authorization. Coverage-only rows do not waive mechanical candidates.

## Root evidence enrichment — 2026-09-11

The [accepted Node command baseline](../timings/baseline/beep_ontology-config.json) records
6 test registrations across 1 reported files. Reporter duration is
392.859 ms; the separately measured whole command took
0.766 seconds. [Context and slowest files](../timings/context/baseline/beep_ontology-config.json)
retain exact input hashes, assertion statuses, worker settings, limits and load.
This is the frozen starting-main Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort,
without a workstation-load adjustment. It does not replace package or compiler
proof. Census file representation does not establish that skipped/todo
registrations executed.

The [frozen hosted summary](../hosted-history-summary.json) maps
0 observations across 0 jobs to this package;
categories: none mapped. The window is 2026-08-12T23:06:31Z through
2026-09-11T23:06:31Z. These are historical observations, not a current-source
or flakiness diagnosis. The full collection has 21 inaccessible logs and one
unresolved downloaded-job cause; zero mapped observations would not prove zero
failures. Job links and historical source heads remain in the summary.

The source audit's original schema-rejection receipt remains historical evidence.
The inventory contract correction now passes full strict validation across all
1,122 census files, including the required NONE rows. This supersedes the original
schema-acceptance blocker above. P1 corrections and Benjamin's acknowledgement
remain pending; see the [current review record](../../../research/2026-09-16-p1-independent-review.md).
