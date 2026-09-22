# @beep/repo-ai-metrics — P1 source audit

Root reviewed all 27 census files through four lenses. The two sequential audit chunks contribute 109 unchanged rows: 16 review items and 93 coverage-only records. Five review items preserve native migration boundaries; they are not existing runtime defects. All rows remain open judgments. P2 remains gated.

| Lens | Rows |
| --- | ---: |
| resource | 27 |
| flake | 27 |
| property | 28 |
| observability | 27 |

Severity: 3 major, 13 minor, 93 informational.

## Top files by review count

- `packages/tooling/library/ai-metrics/test/ingest.test.ts`: 4 review items.
- `packages/tooling/library/ai-metrics/test/sequence-break.test.ts`: 3 review items.
- `packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts`: 2 review items.
- `packages/tooling/library/ai-metrics/test/config-snapshot-bounds.test.ts`: 1 review items.
- `packages/tooling/library/ai-metrics/test/duckdb.test.ts`: 1 review items.
- `packages/tooling/library/ai-metrics/test/file-inventory.test.ts`: 1 review items.
- `packages/tooling/library/ai-metrics/test/hook-pulse.test.ts`: 1 review items.
- `packages/tooling/library/ai-metrics/test/retention.test.ts`: 1 review items.
- `packages/tooling/library/ai-metrics/test/scorecard.test.ts`: 1 review items.
- `packages/tooling/library/ai-metrics/test/telemetry-v2-store.test.ts`: 1 review items.

## Resource topology and preservation

The source separates pure schema/privacy/rendering work from real shell, filesystem, database and local HTTP subjects. Tagged error equivalence, root resolution, manifest codecs, archive envelopes, OTLP option encodings and install plans allocate no remote resources. Synthetic op-reference strings are renderer input only; no credential was resolved. Pure Phoenix SDK/HTTP stubs record per-case calls and preserve dry-run, blocked and confirmed gates without contacting Phoenix.

The effectful integration fixtures repeatedly build NodeServices and a path-specific DuckDB layer under local provideScopedLayer wrappers. These are scanner candidates, not automatic permission to share every dependency. The native database must remain independent for migration, checkpoint, export, retention and failure tests; the DuckDB wrapper explicitly closes its scope before the surrounding temporary directory is removed. Real DuckDB and Parquet access use host paths, so MemoryFileSystem cannot replace that storage boundary. Stable outer platform services are the potential reuse seam, while mutable database, call recorder, archive and sentinel state remains test-local. No isolated layer-build cost was measured and no claimed millisecond saving follows from source size.

Shell breaker, hook writer and switch tests execute actual local scripts. Their temporary HOME/XDG/evidence roots and explicit stdin handling are part of the subject. Both output streams and child exit are drained/joined; disarmed fast exits ignore stdin. Moving those files into a memory service would disconnect the external process. Circuit-breaker status ordering and shell executable availability remain native prerequisites, not established flakes. The inventory suite deliberately checks host symlink/file-kind and chmod denial; POSIX permission behavior must not be simulated away. Identity fixtures write fake git metadata without invoking Git, then exercise actual lock files and atomic writes. The concurrent-writer burst does not establish a deterministic overlap schedule or every interleaving; this audit establishes neither a race nor absence of races.

Config snapshots seed nested worktrees, bounds and deterministic ordering. A portable in-memory fixture may be plausible for pure traversal logic after its path/permission contract is established, but the native permission and database/process backstops remain. The counting FileSystem is useful instrumentation yet its total bound cannot prove zero forbidden descendant stats. Retention's count-only test similarly cannot prove which snapshots survive. Both proposals retain all current assertions and add concrete observations, with deterministic metadata instead of sleeps.

The ingestion suite actually writes encrypted archive envelopes and native Parquet/SQL, restores and rejects corrupted data, tracks watermarks, preserves migration compatibility and tests loopback OTLP binary transport. The server is scoped and stopped; retry uses a local sender, a child fiber, TestClock advance and join. Preserve the existing 90-second transport case value and all chunk/count/content assertions. No live service, database, process, test or benchmark was executed by this audit. The historical baseline shows these subjects in the configured Node cohort; that does not convert their native semantics to pure stubs.

Property migration must retain schema domains, both equality operands, all codec transformations, seed 804, fcRuns minima including 1000 for FlightRecord, 50 for hook laws and 12/8 for ingestion laws. Direct native check candidates already exist. Additional residue is the sample-only wait-reason law bypassing the floor and the loss of full CheckResult diagnostics. rc113 says false and typed failure are shrinkable, while defects/interruption continue through the Effect; no swallowed error or weakened Passed condition is proposed. The current Option-wrapper privacy assertions are independently vacuous even though nearby schema constraints and other hash tests offer protection. Strengthen the payload observations without claiming the production output leaks raw IDs.

## Findings

- **L-RES-04 native-duckdb-fixture-boundary**, `packages/tooling/library/ai-metrics/test/duckdb.test.ts:31-66`. Both overload cases execute the actual native DuckDB wrapper against temporary database paths. Resolve EV010 and wrapper migration with the native driver boundary intact. Share only stable platform services if appropriate; retain independent per-case database paths and the connection scope ending before root removal. src/duckdb.ts91-102 builds makeNodeLayer inside Effect.scoped: replacing host files with MemoryFileSystem would disconnect the driver. Preserve exact inserted rows, SELECT7 and both public overloads. This is a migration constraint, not an existing leak or measured performance defect.
- **L-RES-04 native-permission-and-link-subject**, `packages/tooling/library/ai-metrics/test/file-inventory.test.ts:14-68`. The inventory suite creates a host symlink and chmod000 directory to observe real file-kind and permission behavior. Keep host filesystem provision for symlink and permission semantics when resolving EV010. MemoryFileSystem is suitable only for separately established portable fixture behavior, not a replacement that invents host denial. Preserve two-file count, File type, missing-root failure, unreadable-root failure and cleanup ownership. Record POSIX and unprivileged-process prerequisites in later implementation evidence; do not skip or weaken the assertions. No current failed run is attributed to permissions here.
- **L-RES-04 native-shell-fixture-boundary**, `packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts:156-275`. runWriter launches the actual shell script with isolated HOME paths, explicit stdin handling and concurrent output drains. Retain the native ChildProcess/FileSystem subject and per-execution scoped temporary store while reviewing EV004/EV010. Do not move mutable sentinel or output directories into a shared layer or substitute MemoryFileSystem beneath an external shell. Preserve stdin ignore for disarmed fast exit, streamed input otherwise, both output drains, exit join, exact rows, synthetic canary negatives and all assertions. Outer stable Node services may remain shared. No cloud or secret operation is authorized.
- **L-RES-06 option-wrapper-privacy-assertion**, `packages/tooling/library/ai-metrics/test/ingest.test.ts:1693-1698`. Three not.toBe(rawString) checks compare Option objects rather than session, parent-thread and role hash payloads. Preserve every original raw operand and negative polarity, but require Some and compare its value against child-session, parent-thread and worker. Add independent expected hashes using the existing test-salt fixture, retaining all SQL attribution and threadSpawn checks. src/privacy.ts210-225 defines Option fields; object-versus-string checks also pass for None and cannot establish retained hashed attribution. Other exact hash cases do not make these three assertions meaningful. This is a test-evidence defect, not proof of an emitted raw identifier.
- **L-PROP-04 nested-stat-observation-gap**, `packages/tooling/library/ai-metrics/test/config-snapshot-bounds.test.ts:437-456`. The never-stats case counts all stat calls and accepts any total below100; it does not inspect the called paths. Retain fileCount and the less-than100 bound. Capture delegated stat paths with the existing Ref/FileSystem seam and assert no descendant of the seeded nested worktree is statted, plus a legitimate-path positive control. A single forbidden stat still passes the current aggregate bound. Preserve legitimate nested-root detection itself; do not forbid the metadata operations needed to detect a boundary. src/config-snapshot.ts656-673 returns before recursive walk for a nested root. No production traversal failure was executed or established.
- **L-PROP-03 sample-loop-floor-and-replay-gap**, `packages/tooling/library/ai-metrics/test/hook-pulse.test.ts:373-392`. The total-wait-reason law samples exactly50 values with seed 804 and bypasses fcRuns and native property shrinking. Register the same HookPulseRawEvent domain as an actual public native property, retaining both waitReason assertions, withSaltEnv isolation, raw encoding, fixed timestamp and seed 804 as the explicit existing seed. Use fcRuns(50) to preserve50 as a minimum and allow the canonical run-count floor to raise it; do not overwrite the explicit seed with ambient defaults. Preserve native falsification/replay semantics and all inputs. EV001 only identifies runSync at375; it does not account for this lost floor and sample-only law.
- **L-PROP-04 shell-quoting-observation-gap**, `packages/tooling/library/ai-metrics/test/ingest.test.ts:1323-1343`. The shell-quoting case checks that the flag and semicolon-bearing argument occur as substrings in the rendered unit. Retain both original substring assertions and their exact operands. Add an independent expected POSIX-token representation through both rendering levels or an approved isolated argv observation in P2. Unquoted text would satisfy the current assertions. src/shell.ts26 and forwarder.ts607,660-670 currently quote arguments; this finding does not allege a production injection bug. Include an embedded single-quote boundary without executing the supplied command or resolving any secret.
- **L-PROP-04 newest-retention-identity-gap**, `packages/tooling/library/ai-metrics/test/ingest.test.ts:3457-3498`. The newest-N case observes counts3 to2 and latest existence, but never identifies the retained forwarder directories. Preserve every dry-run, applied-count and latest assertion. Set distinct fixture directory mtimes using the subject FileSystem and assert exact retained names and contents, including untouched dry-run contents. No sleeps or timing threshold changes. src/retention.ts1138-1160,1187-1205 sorts descending by modification time; deleting the newest item would still pass the present counts. Keep native filesystem metadata semantics and do not infer an actual deletion defect from this missing observation.
- **L-OBS-01 property-result-diagnostic-loss**, `packages/tooling/library/ai-metrics/test/ingest.test.ts:240-262`. The shared round-trip helper reduces CheckResult to _tag before asserting Passed across schema laws. During native property migration preserve Equal.equals(decoded,value) OR law.equivalent(decoded,value), all generated schemas and each fcRuns(12/8) floor. Preserve the complete unsuccessful CheckResult through public runner formatting so falsified input, shrinks and replay or exhausted seed/discards remain visible. rc113 Arbitrary.formatCheckFailure supplies those fields; comparing only _tag loses them. This adds concrete reporting residue to EV007, not a separate generator bridge or a weaker success predicate.
- **L-OBS-01 canonical-row-property-diagnostic-loss**, `packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts:607-625`. The canonical-row law reduces the complete native CheckResult to Passed or another tag. Retain all canonical-key and codec-equivalence assertions, HookPulseV1Arbitrary and fcRuns(50). Preserve public native property failure details instead of only the final tag. Retained jobs 102608445246/102608445481 report Exhausted versus Passed for this named law; those observations motivate visible seed/discards but do not prove the present generator still exhausts or is flaky. Defects and interruption must continue failing, not be converted to success. No old maxDiscards workaround or floor change is proposed.


## Remaining seven-file findings

### retention.test.ts

- **resource / L-RES-04**, lines 163–224, minor: Temporary native DuckDB databases close seed and verification connections around retention; preserve this actual SQL boundary. Retain native DuckDB and independent temporary database paths when resolving wrapper candidates. Seed scope closes before retention, and verification reopens after it; these are purposeful persistence boundaries. MemoryFileSystem cannot stand in for the native SQL driver. Preserve NULL timestamp input, cutoff, delete mode and exact retained count; this is a migration constraint, not a measured leak.
- **flake / L-FLAKE-NONE**, lines 1–226, info: Fixed retention cutoff and isolated temporary database avoid shared state; no timing race is established.
- **property / L-PROP-NONE**, lines 1–226, info: Negative counts, reversed windows, omitted wire fields, fcRuns(12) and legacy NULL preservation remain separate obligations.
- **observability / L-OBS-NONE**, lines 1–226, info: The post-retention reopened SELECT count observes persistence; existing Result guards and count assertion retain failure visibility.

### scorecard.test.ts

- **resource / L-RES-NONE**, lines 1–149, info: All schema and codec cases operate on local values without service acquisition.
- **flake / L-FLAKE-NONE**, lines 1–149, info: Schema samples use random generation but no timer or shared resource; randomness alone is not flake evidence.
- **property / L-PROP-03**, lines 78–148, major: Six codec laws sample twelve values without fcRuns, so the configured CI floor and seed are not honored. Convert all six sample-only codec laws to real schema/native Arbitrary property registrations with explicit arbitrary: fcRuns(12). Preserve each name, schema, encode/decode operation and Schema equivalence assertion. Honor existing CI seed/floor and retain generated failure/replay context. Do not replace rich values with smaller schemas or lower runs. The earlier generation-membership cases already use fcRuns(12).
- **observability / L-OBS-NONE**, lines 1–149, info: Codec equivalence failures remain assertions; no separate logging or watchdog defect is established beyond the property execution gap.

### sequence-break.test.ts

- **resource / L-RES-04**, lines 151–263, minor: Real shell children use isolated HOME, controlled executable shims and concurrent output drains; native process semantics are the subject. Preserve actual shell execution, fake transport executables, stdin lifecycle, both output drains and exit join, with test-local temporary HOME and ledgers. Do not replace filesystem services beneath an external process with MemoryFileSystem or share mutable sentinel/damping state. Preserve foreground and setsid detached modes, exact names, statuses and synthetic canary negatives. No provider or secret operation is needed.
- **flake / L-FLAKE-04**, lines 276–300, minor: Notification rows flatten unsorted dated shard files although assertions require desktop then ntfy ordering. notificationRows flattens FileSystem.readDirectory order, while notifier append_delivery chooses a UTC-date shard separately for each row. A midnight boundary can put desktop and ntfy in separate files without a guaranteed enumeration order. Establish chronological shard traversal in the observation helper, preserving line order inside each shard and every existing ordered assertion; add a two-shard boundary control in P2. This source-derived risk is not the proven cause of any historical failure and does not justify flakyTest.
- **property / L-PROP-NONE**, lines 1–690, info: Fixed ambiguity, damping, disarm, descriptor-token and transport controls complement fcRuns(25) schema equivalence without discarding values.
- **observability / L-OBS-01**, lines 368–394, minor: Manual schema round-trip checks reduce the native result to Passed; historical Exhausted outcomes lack retained check context in this assertion. Preserve both schema equivalence laws and fcRuns(25) using the public property registration so Exhausted/Failed result details and replay context reach the reporter instead of only a Passed tag assertion. Retained history includes Exhausted in this named round-trip case; no claim that current generation reproduces it. Do not change schema, discard difficult inputs or reduce the floor.

### session-lease.test.ts

- **resource / L-RES-NONE**, lines 1–336, info: Lease transitions and reconciliation operate on synthetic records and explicit timestamps without allocating services.
- **flake / L-FLAKE-NONE**, lines 1–336, info: Idle thresholds, source evidence and veto conditions use fixed instants; no live clock or suite-order dependency is present.
- **property / L-PROP-NONE**, lines 1–336, info: Both transition polarities, reason codes, pending waits and fcRuns(25) round trips constrain the domain; preserve all operands.
- **observability / L-OBS-NONE**, lines 1–336, info: Named quarantine and deferral assertions expose reasons; the active-lease guard fails explicitly rather than swallowing a missing value.

### source-discovery.test.ts

- **resource / L-RES-NONE**, lines 1–34, info: Home and repo strings are schema inputs; these tests do not walk paths or acquire files.
- **flake / L-FLAKE-NONE**, lines 1–34, info: Defaults and six invalid numeric boundaries are synchronous and independent of environment or filesystem contents.
- **property / L-PROP-NONE**, lines 1–34, info: Omitted hashSalt, default maxFiles and rejected negative/fractional bounds are explicit; no additional generated law is justified.
- **observability / L-OBS-NONE**, lines 1–34, info: Named input-schema tests distinguish omission and invalid limits; there is no hidden external operation requiring trace context.

### telemetry-v2-store.test.ts

- **resource / L-RES-NONE**, lines 1–269, info: Node services are shared while temporary store roots and layer contexts remain per test; atomic host persistence is retained.
- **flake / L-FLAKE-NONE**, lines 1–269, info: Each store uses an isolated scoped directory; callback ordering is directly observed without arbitrary sleeps.
- **property / L-PROP-04**, lines 213–250, minor: Persisted transition and reconciliation checks assert kinds and statuses but do not compare complete decoded payloads to their inputs. Keep current artifact-kind, status and schema-decode assertions, and compare each complete decoded transition/reconciliation payload with the exact submitted value using the corresponding schema equivalence or explicit field equality. Current checks would accept a schema-valid artifact with altered digest or reason and unchanged status. Preserve genuine filesystem persistence and all inputs; no private-state access or fabricated invalid state is needed.
- **observability / L-OBS-NONE**, lines 1–269, info: Typed root preparation and manifest mismatch failures are checked alongside directory absence; receipt and dedup assertions retain useful context.

### telemetry-v2.test.ts

- **resource / L-RES-NONE**, lines 1–268, info: Repository JSON fixtures are read through shared Node services; no provider or live session is acquired by these tests.
- **flake / L-FLAKE-NONE**, lines 1–268, info: Fixed sanitized fixture content and schema transformations do not depend on current time or shared mutable state.
- **property / L-PROP-NONE**, lines 1–268, info: Exact counts, subject identity sets, invalid statuses, v1 boundaries and fcRuns(50) weakest-tier laws retain meaningful positive and negative controls.
- **observability / L-OBS-NONE**, lines 1–268, info: Round-trip and forbidden-content assertions are explicit; the real-session fixture name denotes retained data, not a live integration run.

## Resource topology, costs and limits

Sequence-break and the two telemetry suites share stable NodeServices blocks while their mutable temporary stores remain per-test scoped. Retention closes the seed SQL connection, runs deletion, and reopens verification before root cleanup. These are purposeful persistence boundaries, not redundant setup to erase. Schema-only scorecard, session-lease and discovery inputs do not acquire services. No numeric rebuild cost is claimed: native process launches and database opens are visible acquisitions, but the retained timing does not isolate layer costs.

Sequence-break uses real shell processes and descriptor/environment behavior with fake curl and desktop commands. It does not authorize network notification or secret access. The detached writer closes inherited streams and uses setsid; the test polls for two completed ledger rows through a bounded live clock. That poll does not prove child exit or cancellation ownership on failure. No leak is established, and it is not safe to replace native polling with TestClock advancement. The independent source-derived ordering risk concerns UTC-dated shards and unspecified directory enumeration, not a demonstrated cause of the historical one-row result.

Telemetry persistence calls canonical-root atomic filesystem writing; retain that boundary during migration. The payload comparison proposal strengthens an incomplete oracle without asserting that production currently corrupts data. Fixture-only JSON reads in telemetry-v2 are separate from native SQL/process behavior; no claim that an absent runner executed or skipped a file is made.

Supplemental inspected production ranges: `src/telemetry-v2-store.ts` 1–50 and 285–410 (under the package); `.claude/hooks/hook-pulse.sh` 355–405; `.claude/hooks/sequence-break-notifier.sh` 1–90, 106–181 and 555–605. Exact hashes/ranges are in supplemental-reads.json. Fixture JSON contents were not independently re-audited here; fixture-derived counts are statements about explicit test assertions, not new fixture provenance certification.


## Retained timing and history

The configured whole-package Node baseline recorded 333 passed registrations across all 27 files: 19,815.080322 ms reporter span and 20.174015 seconds for the command. The two source chunks account for 265 and 68 registrations. Runtime was Node22.22.3/Bun1.4.2/Vitest4.1.11. This is a recorded runtime, not an adapter peer-support claim. Durations overlap and do not isolate rebuild costs or normalize workstation load. No tests or benchmarks were rerun by these audits.

The package has 23 retained historical observations in 13 jobs: 17 coverage-ratchet observations, four generation-exhaustion observations, one assertion failure and one unhandled error. These do not establish 23 unique flakes. Hook-writer and sequence-break exhaustion observations motivate better property diagnostics but do not establish current reproduction. The detached-notifier one-row result is not attributed to the independently identified UTC-shard ordering risk. The EPIPE observation retains its historical professional-desktop path versus Metrics package-label mismatch; it is not silently remapped to current source. Historical source comparisons and causal reproduction remain unproven.

The campaign retains 139 first attempts: 132 full-file baselines, four configured subsets and three failures (CIops, Effect Drizzle, QA Capture). Hosted evidence retains 21 unavailable logs and one unresolved downloaded cause across 527 failed runs. A passing configured run is not compiler, coverage, live provider, browser, rare-race or full package proof.

## P2 order and acceptance

After separate P2 authorization: preserve native lifetimes and ownership; strengthen hash payload, path, retention, shell-quoting and persisted telemetry assertions while retaining original operands and polarity; move sample-only laws to native property registration without reducing their domains or floors; establish chronological shard observation without changing expected order; retain native counterexample, shrink, exhaustion and replay details. Preserve explicit seed804, FlightRecord1000, hook50, ingestion12/8, scorecard12 and sequence-break25 floors. No retries, timeout increases, skips, weaker assertions or baseline exceptions are proposed.

Root reviewed both original and recovery reports, both package digests, exact source/read receipts and sealed artifacts. Both sequential chunks have actual terminal exit0 proof, and the complete 27-file union passes combined strict validation with no input drift. Earlier failed and interrupted attempts remain preserved. The first chunk had no pre-reboot seal; its 39 original artifacts were verified unchanged across recovery, not presented as a fabricated original seal. The original DuckDB supporting range91–104 is clarified to91–102, the actual inspected range; finding JSONL bytes remain unchanged.

Full P1 completeness, Grok review and Benjamin acknowledgement remain required before P2. Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
