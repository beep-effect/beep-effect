# @beep/utils — P1 wave002 digest

Complete source audit of 15 assigned census files; P2 remains gated. 63 judgment/open rows: 9 actionable and 54 coverage-only. No fixSha, reason, exception or waiver was manufactured. All actionable rows decode; coverage NONE IDs remain rejected by the current public schema. Artifact acceptance remains blocked pending Root's schema/contract resolution.

| Lens | Rows | Actionable | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 16 | 3 | 13 | 3 | 0 | 13 |
| flake | 15 | 1 | 14 | 1 | 0 | 14 |
| property | 17 | 4 | 13 | 2 | 2 | 13 |
| observability | 15 | 1 | 14 | 1 | 0 | 14 |

## Top ten files by judgment rows

- `packages/foundation/modeling/utils/test/Glob.test.ts` — 5 rows.
- `packages/foundation/modeling/utils/test/Str.test.ts` — 5 rows.
- `packages/foundation/modeling/utils/test/Struct.test.ts` — 5 rows.
- `packages/foundation/modeling/utils/test/Array.test.ts` — 4 rows.
- `packages/foundation/modeling/utils/test/DrainableWorker.test.ts` — 4 rows.
- `packages/foundation/modeling/utils/test/Errors.test.ts` — 4 rows.
- `packages/foundation/modeling/utils/test/FileSystem.test.ts` — 4 rows.
- `packages/foundation/modeling/utils/test/Function.test.ts` — 4 rows.
- `packages/foundation/modeling/utils/test/Number.test.ts` — 4 rows.
- `packages/foundation/modeling/utils/test/Option.test.ts` — 4 rows.

Other files, if any, are retained in the exact private per-file counts and read receipts. Every assigned file has all four lenses. No support/declaration file was omitted (this assignment contains test files only).

## Layer topology, rebuilds and MemoryFileSystem

GlobLayer is a pure Layer.succeed service, but its method chooses Bun.Glob or direct Node filesystem scanning at execution. NodeServices is separately rebuilt by fixture filesystem operations. Keep native backend/symlink/permission conformance; MemoryFileSystem does not redirect those direct calls. FileSystem wrappers likewise call cached node:fs directly. Glob directory population needs cleanup registered before partial setup can fail. DrainableWorker owns its queue and forked fiber in the test scope; preserve Deferred gates and test-local processed state. Other fixtures are local records, schemas, predicates and native-handle error simulations.

## Actionable residue

**L-RES-04 — FileSystem.test.ts:8.** These wrappers resolve node:fs directly via cached getBuiltinModule; there is no injected FileSystem dependency. Preserve real append/stat/Dirent/rename/ENOENT behavior and finally cleanup while reviewing EV001/EV010. Replacing fixture IO with MemoryFileSystem would not exercise the subject. Any scoped fixture rewrite must keep native wrapper conformance; no waiver authorized.

**L-RES-02 — Glob.test.ts:50.** The temp directory is created before nested mkdir/write setup, but fixture.cleanup is returned only after setup completes. If a later mkdir/write fails, outer acquireUseRelease never obtains the fixture and cannot release its directory. Register cleanup immediately after allocation in a test-owned scope before population; retain native backend/symlink/permission behavior and all assertions.

**L-RES-04 — Glob.test.ts:28.** GlobLayer is Layer.succeed but its method selects Bun.Glob or direct Node filesystem helpers at call time. MemoryFileSystem provision would not redirect this implementation. Preserve backend, literal-path, symlink and permission subjects; share appropriate native fixture services while keeping per-test directories isolated. Do not turn a native conformance test into an unrelated memory test.

**L-FLAKE-01 — Glob.test.ts:83.** withBunGlobDisabled changes a process-wide property across asynchronous effects under concurrent registration. A saves G; B saves undefined; A restores G; B restores undefined. This can select the wrong backend and leave it disabled. Use proven exclusive ownership covering every backend consumer or isolated runtime execution; restoring in finally alone is insufficient. No timeout/retry/global-config change is authorized.

**L-OBS-01 — SchemaParity.test.ts:24.** The shared helper runs six production schemas but passes throwing assertions directly to checkEffect and checks only result._tag. Direct runner defects bypass the adapter shrinkable assertion normalization; exhausted/replay outcomes lose diagnostics. Migrate through six clearly named it.prop registrations using the same production schemas and { arbitrary: fcRuns(50) }, preserving equivalence and all encoded examples.

**L-PROP-04 — Str.test.ts:49.** The mapPrefix data-last contract is explicitly omitted. Retain the data-first examples and add reviewed data-first/data-last agreement coverage over valid nonempty string arrays, using the existing API and native it.prop with fcRuns when generated. The comment is not a waiver; actual production repair needs separately authorized evidence. No runtime failure was reproduced.

**L-PROP-04 — Str.test.ts:57.** The mapPostfix data-last contract is explicitly omitted. Retain the data-first examples and add reviewed data-first/data-last agreement coverage over valid nonempty string arrays, using the existing API and native it.prop with fcRuns when generated. The comment is not a waiver; actual production repair needs separately authorized evidence. No runtime failure was reproduced.

**L-PROP-04 — Struct.test.ts:102.** The value named dataLast calls mapPath with three arguments, so this case never exercises the public curried form. The cast also bypasses the public options.path signature (legacy raw-path runtime compatibility exists). Preserve expected values and add actual typed data-last/options-bag parity, plus lazy timing where applicable; do not claim the raw-path calls necessarily fail.

**L-PROP-04 — Struct.test.ts:146.** The value named dataLast calls mapPathLazy with three arguments, so this case never exercises the public curried form. The cast also bypasses the public options.path signature (legacy raw-path runtime compatibility exists). Preserve expected values and add actual typed data-last/options-bag parity, plus lazy timing where applicable; do not claim the raw-path calls necessarily fail.

## History and timing limits

30-day hosted-history attribution and baseline timing remain pending Root enrichment. No claim of no historical failures is made; a partial 30-failure slice is not complete 30-day evidence. Glob's overlap is a possible unguarded interleaving, not an observed hosted failure; actual scheduling must be verified by Root. No tests, benchmarks, scanner or compiler checks were run. Planned timing is Node22.22.3/Bun1.4.2/Vitest4.1.11 with Effect/@effect/vitest rc113, not newly proved peer compatibility. The 90 inherited-main normal-check findings remain unchanged.

## Internal P2 order

Scope → assertions → property → flake → observability. First preserve acquisition-failure/native subjects and partial-setup cleanup. Then retain all expected operands/polarities during mechanical assertion review. Address the exact missing parity cases without inventing law coverage; SchemaParity already preserves fcRuns(50). Review global-backend ownership without timeout/retry or global-config weakening, then retain normalized property failure/replay evidence. Package/compiler/runtime/history verification belongs to Root after P2 authorization. Coverage-only rows do not waive mechanical candidates.

## Root evidence enrichment — 2026-09-11

The [accepted Node command baseline](../timings/baseline/beep_utils.json) records
178 test registrations across 15 reported files. Reporter duration is
1710.847 ms; the separately measured whole command took
2.320 seconds. [Context and slowest files](../timings/context/baseline/beep_utils.json)
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
