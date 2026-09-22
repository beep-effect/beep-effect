# @beep/data — P1 wave003 digest

All five census test files were read completely through four lenses: 464 lines, 17,490 bytes. This assignment contains no support declarations. Twenty judgment/open rows contain two minor actionable findings and eighteen info coverage rows; zero major/blocker findings. P2 remains gated. Public decoding accepted both actionable rows but rejected every prescribed NONE coverage row. Coverage rows remain intact pending Root's schema/contract repair; this is not full artifact validation acceptance.

| Lens | Rows | Actionable | Coverage | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: |
| resource | 5 | 0 | 5 | 0 | 5 |
| flake | 5 | 0 | 5 | 0 | 5 |
| property | 5 | 1 | 4 | 1 | 4 |
| observability | 5 | 1 | 4 | 1 | 4 |

## Top files by row count

All five files tie; no additional files are omitted from a top-ten view.

- `packages/foundation/primitive/data/test/currency-codes.test.ts` — 4 rows (0 actionable, 4 coverage).
- `packages/foundation/primitive/data/test/keyboard-shortcuts.test.ts` — 4 rows (1 actionable, 3 coverage).
- `packages/foundation/primitive/data/test/mime-types.test.ts` — 4 rows (1 actionable, 3 coverage).
- `packages/foundation/primitive/data/test/territories.test.ts` — 4 rows (0 actionable, 4 coverage).
- `packages/foundation/primitive/data/test/timezones.test.ts` — 4 rows (0 actionable, 4 coverage).

## Resource topology and subject boundaries

These tests use synchronous data tables, metadata, lookup strings and local sets. No layer, service acquisition, finalizer or fixture rebuild exists. MIME getTypes/getExtensions intentionally share lazily populated module maps; tests assert repeated-call identity and do not mutate those maps. Population is synchronous. Currency, territory and timezone public facades alias generated data. Keyboard platform names and shortcut chords are literal records, not OS event hooks. MIME path-looking strings are parsed without filesystem IO. There is no demonstrated MemoryFileSystem candidate or reason to introduce TestClock/it.layer. This does not authorize future mutation of shared data.

## Actionable residue

**L-OBS-01, keyboard-shortcuts.test.ts:92.** The duplicate assertion reports only a Boolean at one shared loop line, losing the concrete platform/scope/name/chord key. Retain seen.has(key), false polarity and seen.add ordering; add the existing key as diagnostic context, for example assertFalse(seen.has(key), `Duplicate shortcut: ${key}`). This does not change structural assertion semantics or require Effect logging. No hosted failure is claimed.

**L-PROP-04, mime-types.test.ts:81.** This named iana-over-apache case checks only definedness, and both actual XML candidates have source iana. The production rule compares source priority and then preserves application/* on ties (except application/octet-stream). Keep the exact application/xml assertion already present at line 67; separately exercise a verified different-priority collision with its concrete expected MIME winner. A wrong defined winner would satisfy this case. Other examples may cover precedence indirectly; this is not a claim that the entire branch is uncovered. Do not invent a new expected winner, delete existing assertions or weaken generated tables.

These findings concern exact test claims and diagnostics, not reproduced production failures. The retained 8,228-row mechanical export has zero @beep/data rows. No candidate was resolved, waived, copied or silently removed. Plain payload assertions remain legal under D5; broad generated-data completeness is not inferred from sample assertions.

## Qualified hosted history and timing

The completed hosted summary covers 2026-08-12T23:06:31Z through 2026-09-11T23:06:31Z. It maps zero observation rows and zero distinct failed jobs to @beep/data; private package-field attribution agrees. Runtime headers mentioning @beep/data inside other packages' observations are not data failure attribution. This is not proof of no failures or no flakes. Across the census, metadata for 527 failed runs was collected, but 21 relevant logs were inaccessible, some jobs are metadata-only and causal attribution remains incomplete. No historical current-source equivalence is asserted.

Baseline timing remains pending and Root-owned. Intended timing runtime is Node22.22.3/Bun1.4.2/Vitest4.1.11 with Effect/@effect/vitest rc113; no new peer-compatibility or timing proof is claimed. No package tests, benchmarks or scanner were run. The 90 inherited-main normal-check findings and coverage baselines were not changed.

## Proposed internal P2 order

Scope → assertions → property → flake → observability. No current scope change is justified. Retain all existing expected operands, matcher polarity and cache identity. In the property step, strengthen the named MIME precedence case against an independently verified collision; keep the existing exact XML test. Do not replace exhaustive finite-table checks with weaker random samples or introduce a test-only permissive schema. No flake workaround is proposed. Finally add the precise shortcut key to duplicate diagnostics without changing uniqueness semantics. Root owns P2 authorization, execution and verification.

## Root evidence enrichment — 2026-09-11

The [accepted Node command baseline](../timings/baseline/beep_data.json) records
34 test registrations across 5 reported files. Reporter duration is
702.536 ms; the separately measured whole command took
1.066 seconds. [Context and slowest files](../timings/context/baseline/beep_data.json)
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
