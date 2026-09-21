# @beep/effect-drizzle — P1 four-lens digest

This source audit covers 15 census files: eight tests and seven support files, 4,325 lines / 172,114 bytes. All 60 file/lens pairs are covered by 63 rows: 15 review items, 48 no-findings rows. Review items include two informational native-boundary constraints, not just defects. Severity totals: three major, ten minor, 50 info. All judgments remain open; no exceptions or P2 approval are supplied.

| Lens | Rows | Review | NONE |
|---|---:|---:|---:|
| resource | 18 | 6 | 12 |
| flake | 15 | 0 | 15 |
| property | 15 | 5 | 10 |
| observability | 15 | 4 | 11 |

Top ten files by row count (ties lexical; counts include coverage):

- `packages/ecosystem/effect-drizzle/test/integration/sqlite-live.test.ts`: 7.
- `packages/ecosystem/effect-drizzle/test/TaggedErrors.equivalence.test.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/bundle-build.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/bundle-pg-integer.consumer.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/bundle-size.probe.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/bundle-size.test.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/bundle-size.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/fixtures.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/import-boundary.test.ts`: 4.
- `packages/ecosystem/effect-drizzle/test/integration/live.test.ts`: 4.

## Resource topology and native boundaries

Pure fixtures build descriptors, tables, assemblies and repository Effect values; they do not execute SQL. Compile-time negative declarations and deferred runtime mirrors are indispensable proof inputs. The one-line integer consumer and four-model performance fixture are different subjects; neither is an excuse to execute a benchmark in P1.

The PostgreSQL gauntlet uses one PgliteTestLayer shared by the named layer with an explicit 90000ms hook budget. PgliteHarnessState generates/applies DDL then regenerates to no-op. RepositoryClientLayer passes the same liveClient to the installed SQL adapter; its documented ownership leaves close with the original owner (installed PgliteClient.ts:136–142,165–184). No second database is justified merely to adapt snake/camel naming. This is in-process native SQL, not a container or external PostgreSQL service.

The SQLite gauntlet creates a unique real directory, runs two real Node drizzle-kit pushes through a process-local CJS compatibility preload, opens a direct Bun Database, then provisions the Effect SQLite adapter against that same path. Five additional synchronous cases create fresh in-memory Databases and close them in finally blocks, proving native numeric/NaN/Date/expression/cardinality behavior. These are source construction sites, not measured acquisitions. Native-file sharing across Node and Bun cannot be replaced by an Effect MemoryFileSystem. Preserve finalization order: repository connection/direct handle before directory deletion. The shared handle's PRAGMA currently precedes finalizer registration; register release immediately after construction to cover that failure path.

The existing makeSqlTestLayer seam was reviewed (SqlTest.ts:785–811). It builds a fresh concrete driver and runs migrate/seed hooks, but moving these harnesses requires preserving direct native-client access, same-file cross-process pushes, parser overrides, relations, no-op evidence and named outer scope. Do not introduce a new fixture framework or blindly swap drivers. The existing layer sharing is largely correct; no measured per-layer speedup is claimed.

Bundle tests build the real public integer consumer with esbuild, peer externals and write:false. Structural build sites include the bytes test, import-isolation test, and conditional parent/child probe. The probe child's interruption release is absent. SQLite's migration child likewise ignores the tryPromise AbortSignal and can outlive a timed-out hook while directory finalizers run. Pinned Effect.ts:917–919 explicitly says underlying work stops only if it observes that signal. These are static lifecycle findings; no process was interrupted or leak reproduced here.

## Assertion and property judgments

Keep all existing exact SQL values, nullable/Option operands, error types/messages, scalar bounds, precision endpoints and negative fixtures. SQLite's concurrent-writer test only counts one successful Exit. Its other Exit could be a defect or unrelated SQL error and still satisfy that count. Require a typed VersionConflictError for the actual concurrentSeed id/version and check persisted winner data, preserving both writer requests and every existing assertion. The production optimistic update at core/repository.ts:398–435 uses id plus expected version and maps no returned row to that exact typed conflict.

The PostgreSQL stale-writer case executes its two updates sequentially; it is useful stale-snapshot proof, but a separate bounded overlap witness is needed before claiming true contention coverage. Preserve the original sequential case. Generated opportunities are production-schema array/variant codec laws, retaining ragged-array and SQLite literal negatives. Use native schema/arbitrary inputs and explicit fcRuns; do not filter hard valid values or weaken schemas.

The bundle child test promises baseline nonmutation but never compares baseline bytes. Add the before/after witness without changing its one-byte regression or output checks. Source-tree forbidden-edge tests can pass when full-tree enumeration yields no files; add required-entry/nonempty witnesses and controlled forbidden-edge positives. Selected entrypoint import closures do not independently prove every full-tree glob succeeded. These are proof gaps, not claims the current source is malformed.

No independent flake is established. Shared native databases are scoped per named block and repository scenarios use inserted IDs/distinct fixture names; no clock adjustment or sleep is present. Concurrent SQLite updates are the subject. The runtime collection failure below is deterministic and must not be relabeled flaky or hidden by a skip.

## Diagnostics and retained failure evidence

Four observability rows identify missing stages in actual waits: bundler build/child drain, source traversal/manifest/build, PGlite generate/apply/regenerate, SQLite first/second push/open/cleanup. Adopt only public @beep/test-utils/Vitest during P2, with safe relative paths/phase names and preserved tester modes/TestEnv. Do not dump environment, raw private paths or increase timeouts. Existing body and hook limits remain; package hookTimeout is 30000ms, named native layers specify 90000ms.

The original Node22.22.3/Bun1.4.2 attempt exited 1 after 8.734228858s. Public failure record reports 101 registered tests and zero failed test bodies, but Node could not collect the suite importing bun:sqlite. Those cases are absent from that count, not passed or skipped. This is not an accepted timing baseline; no successful public package baseline/context file exists to provide honest slowest-file timings. No replacement runtime, substituted database or fabricated timing is offered. Raw reporter hash e325aa2900e343f3f7783bb95730d5145b12890e03d3f79683d93f42756ae5e9 and log hash dd7eec21d6d618cf54e7a69df082e4ff3cf4510aa68a2fce20becd7b0adc824a are Root's retained identifiers, not newly reproduced observations.

Worker settings are forks, file parallelism, capacity63, maxConcurrency5, concurrent default, isolation and --js-float16array. They are configuration, not proof of actual overlap. Installed Vitest4.1.11 remains outside rc113's declared >=5 <6 peer range. The 139-attempt campaign retains 132 full-file baselines, four configured subsets and three failures. Graph-3d's browser file is outside its configured Node cohort, not executed/skipped by this audit.

Hosted history maps 39 coverage-ratchet observations across three jobs to effect-drizzle; these are not unique flakes or test failures. The complete 527 failed-run collection retains 21 unavailable logs and one unresolved cause. Production coverage paths are not failing test paths. Job URLs and historical heads are retained in the [hosted history summary](../hosted-history-summary.json). No history or timing collection was repeated.

## Proposed P2 order and limits

1. Scope: own the two child process paths; register SQLite release before initialization; preserve shared native layers and all short local native probes.
2. Assertions: retain all current assertions and strengthen the concurrent loser's typed cause/persisted winner; resolve supplied None predicates with matching helpers. Root should assess the unreported functional-pipe runSync at unit.test.ts:699 without treating this audit as detector repair.
3. Property: add baseline-byte and nonempty enumeration witnesses, generated production codec laws, and the bounded PostgreSQL contention case.
4. Flake: investigate only demonstrated causes. The Bun-only collection boundary needs Root runtime/proof disposition, not retry, skip, driver substitution or a false baseline.
5. Observability: adopt accepted instrumentation and safe phase labels after resource/assertion behavior is stable.

The eight scanner candidates remain unchanged/open: three EV001, four EV006, one EV010; support files emit no candidates. All 63 authored rows passed strict public decoding, complete owner/census/line/primitive/ID checks and exact JSONL/public re-encoding. Input snapshots and ranges are retained. This is static P1 source inventory, not runtime, package, race-freedom, timing acceptance or authorization for P2.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
