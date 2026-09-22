# @beep/repo-utils — combined P1 four-lens inventory

All 31 census files were reviewed in two disjoint sequential chunks: 21 test files and ten support/compiler inputs. The combined inventory has 129 open judgment rows, comprising 23 review items and 106 coverage-only rows. Review items include 15 repair proposals and eight native-boundary constraints; these are not 23 reproduced defects.

| Lens | Rows |
| --- | ---: |
| Resource | 34 |
| Flake | 31 |
| Property | 33 |
| Observability | 31 |

Severity: six major, 17 minor, 106 info. All 177 detector candidates remain open and separate. The sections below preserve the detailed chunk findings and evidence limits; their file counts are disjoint, while timing/history describe the same whole-package baseline.

## Top ten files across both chunks

- `packages/tooling/library/repo-utils/test/FsUtils.test.ts`: 6 rows.
- `packages/tooling/library/repo-utils/test/DependencyIndex.test.ts`: 5 rows.
- `packages/tooling/library/repo-utils/test/Workspaces.test.ts`: 5 rows.
- `packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts`: 5 rows.
- `packages/tooling/library/repo-utils/test/Dependencies.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/Graph.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/JSDoc.model.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/JSDocTagDefinition.golden.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/Root.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/TSMorph.model.test.ts`: 4 rows.

## First 20 files

### Counts

| Lens | Rows | Review items | Coverage-only |
| --- | ---: | ---: | ---: |
| resource | 23 | 10 | 13 |
| flake | 20 | 2 | 18 |
| property | 21 | 5 | 16 |
| observability | 20 | 0 | 20 |

Severity: five major, 12 minor, 67 info. Review items include six native-boundary constraints, not six additional defects. There are 11 repair proposals and 67 coverage-only rows. All 54 mechanical candidates remain open; no syntax finding is waived.

### Top ten files by row count

- `packages/tooling/library/repo-utils/test/FsUtils.test.ts`: 6 rows.
- `packages/tooling/library/repo-utils/test/DependencyIndex.test.ts`: 5 rows.
- `packages/tooling/library/repo-utils/test/Workspaces.test.ts`: 5 rows.
- `packages/tooling/library/repo-utils/test/Dependencies.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/Graph.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/JSDoc.model.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/JSDocTagDefinition.golden.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/Root.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/TSMorph.model.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/TSMorph.package-syntax.test.ts`: 4 rows.

### Layer topology, lifetime and native boundaries

DependencyIndex, FsUtils, TsConfig, UniqueDeps and Workspaces each use one shared FsUtilsLive/platform block. Root uses a shared NodeFileSystem block. Temporary directories and files belong to test scopes, but their explicit tail cleanup misses setup failures and assertion defects. Workspaces also creates a temp root before acquireUseRelease and places several writes in acquisition; failure in those writes occurs before release is installed. Scoped temp allocation fixes that ownership gap without changing assertions.

FsUtilsLive provides SharedGlob internally. The latter uses Bun.Glob.scanSync or Node readdirSync/statSync without consulting the injected Effect FileSystem. Consequently a blanket MemoryFileSystem replacement would split discovery from reads. Preserve host-visible glob, symlink confinement and checkout-root scenarios. Interface-only read/modify/root-marker cases are possible MemoryFileSystem candidates if separated without changing native subjects or fixed error operands. No seed/fault/inspect API expansion is justified here.

TSMorph.test-support defines TSMorphServiceLive over NodeServices. The layer creates scope, project and symbol-index caches once per block. Native Project loads the host tsconfig; explicit-file projects have a separate pool. Tests deliberately exercise late-file indexing and ordinary/explicit project separation. Their in-memory mutation is restored and host bytes are compared afterward. In-memory Project instances in model/shared tests are a different subject and need no filesystem emulation. The local model provideScopedLayer wrapper is already an EV002/EV003 candidate; retain its errors and requirements during migration. No new wrapper is proposed.

Rebuild costs are source-supported allocation facts, not speed estimates: fresh TSMorphService instances lose caches and repeat host Project construction. The retained service file duration is 563.144 ms; its slowest named case is 292.006 ms. Those times do not isolate acquisition cost. Package config disables concurrency and sets 300000 ms; the service block/cases retain 40000 ms. No timeout or concurrency change is proposed.

### Detailed review items

- **L-RES-02 — failure-path-temp-cleanup**, `packages/tooling/library/repo-utils/test/DependencyIndex.test.ts:99-141` (major): makeTempDirectory/makeTempFile is unscoped; explicit remove follows use and assertions. Use the existing subject FileSystem scoped temporary API inside each test scope so setup failures and assertion defects still release resources. Preserve all current assertions and their order. For makeTempFile retain ownership of its parent directory as well as the file. Keep native platform tests native where glob, symlink or checkout behavior is the subject; this is failure-path lifetime residue beyond EV010/EV014.
- **L-RES-02 — failure-path-temp-cleanup**, `packages/tooling/library/repo-utils/test/FsUtils.test.ts:89-441` (major): makeTempDirectory/makeTempFile is unscoped; explicit remove follows use and assertions. Use the existing subject FileSystem scoped temporary API inside each test scope so setup failures and assertion defects still release resources. Preserve all current assertions and their order. For makeTempFile retain ownership of its parent directory as well as the file. Keep native platform tests native where glob, symlink or checkout behavior is the subject; this is failure-path lifetime residue beyond EV010/EV014.
- **L-RES-02 — failure-path-temp-cleanup**, `packages/tooling/library/repo-utils/test/Root.test.ts:56-88` (major): makeTempDirectory/makeTempFile is unscoped; explicit remove follows use and assertions. Use the existing subject FileSystem scoped temporary API inside each test scope so setup failures and assertion defects still release resources. Preserve all current assertions and their order. For makeTempFile retain ownership of its parent directory as well as the file. Keep native platform tests native where glob, symlink or checkout behavior is the subject; this is failure-path lifetime residue beyond EV010/EV014.
- **L-RES-02 — acquisition-before-release-registration**, `packages/tooling/library/repo-utils/test/Workspaces.test.ts:56-236` (major): tmpDir is allocated before acquireUseRelease at 60/92; other cases remove only after assertions. Acquire each temp root with makeTempDirectoryScoped in the test scope before writing fixtures. Current acquireUseRelease protects use only after all acquisition writes succeed, so a failed mkdir/write leaks the already allocated root. Preserve the external symlink root, exact confinement messages and both positive workspace assertions. Do not swallow cleanup errors.
- **L-RES-04 — native-glob-subject-boundary**, `packages/tooling/library/repo-utils/test/DependencyIndex.test.ts:11-17` (minor): FsUtilsLive delegates glob to @beep/utils/Glob, which uses Bun.Glob or layer-free Node filesystem scans. Preserve a host-visible fixture for this native traversal chain. FsUtils.ts:195-225 provides SharedGlob internally; utils/Glob.ts:451-555 selects native Node/Bun scans. MemoryFileSystem alone changes only JSON/read/stat operations and disconnects them from glob. Separate interface-only tests only where the subject is genuinely injected FileSystem behavior. This is a preservation constraint for EV010, not a claim of a leak.
- **L-RES-04 — native-glob-subject-boundary**, `packages/tooling/library/repo-utils/test/FsUtils.test.ts:11-26` (minor): FsUtilsLive delegates glob to @beep/utils/Glob, which uses Bun.Glob or layer-free Node filesystem scans. Preserve a host-visible fixture for this native traversal chain. FsUtils.ts:195-225 provides SharedGlob internally; utils/Glob.ts:451-555 selects native Node/Bun scans. MemoryFileSystem alone changes only JSON/read/stat operations and disconnects them from glob. Separate interface-only tests only where the subject is genuinely injected FileSystem behavior. This is a preservation constraint for EV010, not a claim of a leak.
- **L-RES-04 — native-glob-subject-boundary**, `packages/tooling/library/repo-utils/test/TsConfig.test.ts:11-16` (minor): FsUtilsLive delegates glob to @beep/utils/Glob, which uses Bun.Glob or layer-free Node filesystem scans. Preserve a host-visible fixture for this native traversal chain. FsUtils.ts:195-225 provides SharedGlob internally; utils/Glob.ts:451-555 selects native Node/Bun scans. MemoryFileSystem alone changes only JSON/read/stat operations and disconnects them from glob. Separate interface-only tests only where the subject is genuinely injected FileSystem behavior. This is a preservation constraint for EV010, not a claim of a leak.
- **L-RES-04 — native-glob-subject-boundary**, `packages/tooling/library/repo-utils/test/UniqueDeps.test.ts:10-15` (minor): FsUtilsLive delegates glob to @beep/utils/Glob, which uses Bun.Glob or layer-free Node filesystem scans. Preserve a host-visible fixture for this native traversal chain. FsUtils.ts:195-225 provides SharedGlob internally; utils/Glob.ts:451-555 selects native Node/Bun scans. MemoryFileSystem alone changes only JSON/read/stat operations and disconnects them from glob. Separate interface-only tests only where the subject is genuinely injected FileSystem behavior. This is a preservation constraint for EV010, not a claim of a leak.
- **L-RES-04 — native-glob-subject-boundary**, `packages/tooling/library/repo-utils/test/Workspaces.test.ts:15-21` (minor): FsUtilsLive delegates glob to @beep/utils/Glob, which uses Bun.Glob or layer-free Node filesystem scans. Preserve a host-visible fixture for this native traversal chain. FsUtils.ts:195-225 provides SharedGlob internally; utils/Glob.ts:451-555 selects native Node/Bun scans. MemoryFileSystem alone changes only JSON/read/stat operations and disconnects them from glob. Separate interface-only tests only where the subject is genuinely injected FileSystem behavior. This is a preservation constraint for EV010, not a claim of a leak.
- **L-RES-04 — native-project-cache-boundary**, `packages/tooling/library/repo-utils/test/TSMorph.test-support.ts:1-14` (minor): TestLayer provides TSMorphServiceLive; createProjectPool loads tsConfigFilePath through native ts-morph Project. Keep the existing shared consumer layer and real host compiler project. TSMorph.service.ts:475-507 caches native Projects per service instance, with a separate explicit-file pool; 723-725 creates mutable scope/index caches. MemoryFileSystem injection cannot seed Project host reads. Per-test rebuilding would discard intentional cache scenarios and repeat project load cost; no measured acquisition speedup is claimed.
- **L-PROP-03 — literal-identity-property-options**, `packages/tooling/library/repo-utils/test/TSMorph.model.test.ts:237-275` (major): Both ProjectIdentityParts and SymbolIdentityParts checkEffect calls pass { runs: 20 } rather than fcRuns(20). In P2 migrate the two existing native properties with arbitrary: fcRuns(20), preserving every generated schema, equality, identity assertion and 20-run minimum. Keep the separate fcRuns(50) SymbolId property. The literal options omit BEEP_FC_NUM_RUNS and BEEP_FC_SEED, unlike the public helper; this is semantic floor/seed residue beyond EV007 syntax.
- **L-PROP-04 — masked-peer-contribution**, `packages/tooling/library/repo-utils/test/UniqueDeps.test.ts:88-95` (minor): The peer test checks effect, but pkg-a and pkg-b already declare effect in dependencies. Retain the existing effect assertion and fixtures, then add an isolated peer-only dependency case whose name occurs in no runtime dependency. Removing peer aggregation from UniqueDeps.ts:113-116 still satisfies the current assertion. Preserve optional/development/ordering assertions and use scoped native fixtures for the existing glob chain. This counterexample is source-derived, not executed.
- **L-PROP-04 — incomplete-cycle-witness**, `packages/tooling/library/repo-utils/test/Graph.test.ts:170-184` (minor): The three-node cycle test checks nonempty output, equal endpoints and length >= 3, but not valid input edges. Keep all current assertions, including the existing >=3 operand. Add membership and consecutive-edge validity checks for the returned witness against the independently specified A->B->C->A input. A closed [A,B,A] witness would satisfy the current shape assertions but includes a nonexistent B->A edge. No algorithm bug is claimed without execution.
- **L-PROP-04 — glob-filter-oracle-gap**, `packages/tooling/library/repo-utils/test/FsUtils.test.ts:40-84` (minor): ignore only checks absence; globFiles checks that each path contains a dot rather than checking file type. Keep all existing ignore and nonempty/dot assertions. Add a known included-file control to the ignore result and a subject-local dotted-directory fixture plus file-type assertion to globFiles. An always-empty ignore branch or included dotted directory can pass the current local oracle. Preserve native glob execution; do not substitute an implementation-mirroring helper.
- **L-PROP-04 — no-write-claim-unobserved**, `packages/tooling/library/repo-utils/test/FsUtils.test.ts:175-189` (minor): The unchanged modifyFile case asserts false but does not observe whether writeFileString was invoked. Retain the false result assertion and unchanged transform. Add a public FileSystem service observation of writeFileString calls around the real FsUtils modify operation, with a changed-content positive control proving the observation is connected. Assert zero writes only for the unchanged case; do not mock the subject method or weaken schema/runtime semantics.
- **L-FLAKE-05 — ambient-missing-path**, `packages/tooling/library/repo-utils/test/FsUtils.test.ts:125-134` (minor): A native read assumes the literal /nonexistent path is absent in the host filesystem. Keep the exact existing path and failure operands in an isolated FileSystem-interface scenario where that path is guaranteed absent, with a positive read control. This specific read fails before native glob; retain other native traversal tests. Ambient occupancy is a source-derived risk, not a demonstrated flaky run, and no flakyTest/skip/timeout proposal is made.
- **L-FLAKE-05 — ambient-missing-path**, `packages/tooling/library/repo-utils/test/Workspaces.test.ts:119-127` (minor): A native read assumes the literal /nonexistent path is absent in the host filesystem. Keep the exact existing path and failure operands in an isolated FileSystem-interface scenario where that path is guaranteed absent, with a positive read control. This specific read fails before native glob; retain other native traversal tests. Ambient occupancy is a source-derived risk, not a demonstrated flaky run, and no flakyTest/skip/timeout proposal is made.

### Timing and failure evidence

Retained Node baseline: 226 passing tests across 21 executable files, reporter elapsed 6997.144 ms, command wall 7.471412 s, head 662823dd960367046ba7d73dd8fd25d15782865a, Node22.22.3/Bun1.4.2/Vitest4.1.11. This is historical whole-package timing context, not this chunk's source coverage or a fresh run. The 16 assigned executable files account for 156 registrations; four assigned support files are not independently executed suites. No timing, test, build or coverage command was run by this lane.

Seven retained hosted observations concern coverage ratchets in two jobs, not seven failing tests or flakes. On 2026-09-03, TSMorph.service functions/lines/statements fell below floors (job 100621131987, Node24.20.0). On 2026-09-10, TSMorph.model functions/lines/statements and TSMorph.service branches fell below floors (job 102824638612, Node22.22.3). Exact source heads, links, line excerpts and runtime evidence are in the [hosted history summary](../hosted-history-summary.json). Legacy extracted test_name values such as functions/lines are metric labels, not test names. No comparison of those historical production bytes with current source was made and no introduced/inherited or flaky disposition follows.

The global 30-day history contains 527 failed runs, 21 unavailable relevant logs and one unresolved downloaded cause; absence of a mapped assertion failure is not proof of absence. Timing inventory has 139 attempts: 132 accepted full-file-representation baselines, four configured subsets and three failures. graph-3d's browser file is outside its configured Node cohort, not executed or reporter-skipped. Known failed Node cohorts remain retained and are not substituted here.

### P2 order and limits

After authorization and both chunk audits: first scope temporary resources and preserve native traversal/project ownership; then migrate assertion families without dropping payloads, add connected glob/no-write and peer/cycle controls; preserve native properties and feed the original 20-run identity minima through fcRuns; isolate ambient missing reads; finally adopt the accepted instrumented runner without changing clocks, test names or limits. Existing 50-run SymbolId and 20-run JSDoc floors remain. No flakyTest, retries, skips or schema weakening are proposed.

No runtime defect was reproduced; counterexamples identify inadequate local oracles and failure-path lifetime risks from source. The six boundary constraints prevent an invalid migration rather than demand implementation changes. Observability has no independent residue beyond named cases and existing detector-driven adoption. P2 remains gated.

## Final 11 files

### Counts

| Lens | Rows | Review items | Coverage-only |
| --- | ---: | ---: | ---: |
| resource | 11 | 2 | 9 |
| flake | 11 | 0 | 11 |
| property | 12 | 4 | 8 |
| observability | 11 | 0 | 11 |

Severity: one major, five minor and 39 info. Six review items comprise four repair proposals and two native-boundary constraints. All 123 scanner candidates remain open, independently of the human coverage rows.

### Top ten files

- `packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts`: 5 rows.
- `packages/tooling/library/repo-utils/test/fixtures/tsmorph-declaration/ambient.d.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/fixtures/tsmorph-diagnostics/src/broken.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/fixtures/tsmorph-diagnostics/src/clean.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/src/extra.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/src/included.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/fixtures/tsmorph-outline-order/source.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/integration/monorepo.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/schemas/BiomeJson.test.ts`: 4 rows.
- `packages/tooling/library/repo-utils/test/schemas/DocgenConfig.test.ts`: 4 rows.

### Layer topology and rebuild costs

The real-monorepo integration uses one FsUtilsLive/NodeFileSystem/NodePath block and reads checkout markers, workspace manifests and tsconfigs. No writes or temporary resources occur in its five cases. Its explicit 600000 ms hook/body limits are retained without endorsing them as new defaults. Native SharedGlob uses Bun.Glob or synchronous Node filesystem helpers; MemoryFileSystem alone cannot replace this suite's real-checkout subject.

BiomeJson has three per-test provideScopedLayer uses already captured by EV002. One runs the real Biome executable. Two build controlled ChildProcessSpawner layers; both explicitly capture NodeFileSystem, and the concurrent case allocates a Deferred when the layer builds. Production renderBiomeJson already scopes temp creation, process lifetime and file reads together before returning. Preserve that inner cleanup timing and exact error messages. Any future MemoryFileSystem fixture for controlled spawners must supply the same service to renderer and spawner; an outer-only substitution disconnects writes. The real Biome/config interaction remains native.

The stream control currently imposes one-way readiness: stdout waits for stderr, so stdout-first serialization stalls, but stderr-first serialization completes. Bidirectional readiness would prove overlapping collection without changing payload sizes, timing limits or assertions. Keep the existing two-second bound meaningful when reviewing EV009: it is a live-clock deadlock guard, not an arbitrary sleep. A migration to frozen test time must preserve a controlled negative-case deadline; I/O alone does not justify all live registrations, and no scanner row is waived here.

Other assigned tests are pure schema/config/patch computations. Support files are compiler inputs, not independent test suites. In particular broken.ts must remain an invalid number assignment; ambient.d.ts must remain a declaration; extra.ts stays outside the late-file tsconfig's include; ZebraThing must precede AlphaThing. The native TSMorph consumer and cache semantics were reviewed in chunk 00 and reused by exact hash, not re-audited as chunk 01 coverage.

Per-test platform/Deferred rebuilds are visible in source, but no isolated acquisition cost was measured. Retained BiomeJson duration is 58.344 ms; real-monorepo integration 259.442 ms; TSConfig schema tests 92.756 ms. These are baseline file durations, not predicted savings.

### Findings

- **L-RES-04 real-checkout-native-boundary**, `packages/tooling/library/repo-utils/test/integration/monorepo.test.ts:10-26`: The suite explicitly discovers the real monorepo through FsUtilsLive and NodeFileSystem. Preserve real checkout files and the existing shared layer. FsUtils provides native SharedGlob internally; injected MemoryFileSystem would disconnect discovery from reads. This suite intentionally checks structural workspace invariants, not synthetic volume behavior. Keep all five cases, exact known package keys and 600000ms inputs. This is a preservation constraint for EV010, not a leak finding.
- **L-RES-04 formatter-native-and-mock-boundaries**, `packages/tooling/library/repo-utils/test/schemas/BiomeJson.test.ts:40-124`: The first case uses NodeServices to launch Biome; both mock spawner layers explicitly capture NodeFileSystem. Keep the real Biome integration host-visible, including repository config and scoped temp-file cleanup. The two controlled spawners test public stream/error behavior and could use a coherent FileSystem fixture only if both renderer and captured spawner use the same service. Replacing just the outer Node layer splits those volumes. EV002 already owns effectful per-test rebuild migration; retain a fresh Deferred for each controlled process scenario.
- **L-PROP-04 one-way-drain-control**, `packages/tooling/library/repo-utils/test/schemas/BiomeJson.test.ts:44-68`: stdout waits for stderrStarted; stderr signals immediately and can finish before stdout starts. Preserve all command/stdout result assertions, the 1MiB payloads and two-second bound. Strengthen the controlled spawner with readiness in both directions so each stream signals start before awaiting the other. Serial stderr-then-stdout collection currently satisfies the oracle, although serial stdout-first stalls. Use scoped/event-driven control; no sleeps, larger timeout or real subprocess flood is needed. This is a source-derived counterexample, not an executed failure.
- **L-PROP-03 publish-config-floor-seed-loss**, `packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts:111-131`: The publishConfig native property passes { runs: 20 }; the neighboring properties pass fcRuns(20). Adopt the real property with arbitrary: fcRuns(20), retaining its generator, O.some wrapper, wire round-trip equality and 20-run minimum. Preserve the three neighboring fcRuns(20) checks. Literal runs omit BEEP_FC_NUM_RUNS and BEEP_FC_SEED; this is semantic residue beyond EV007 registration syntax.
- **L-PROP-02 publish-config-generated-subset**, `packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts:39-51`: PublishConfigCoreArbitrary includes only access/tag/registry/provenance, omitting bin, exports and JSON-valued extra keys. Keep the existing core law and concrete exports/bin examples. Add bounded valid production-domain coverage for omitted PublishConfig fields using public native Arbitrary/schema facilities. The rc113 engine documents recursion allowances, but this audit did not execute a full-schema generator and does not establish that the historical recursion comment is false. Do not replace the production schema with a weaker test-only schema or reduce trials to manage recursion.
- **L-PROP-04 conditional-open-extra-assertions**, `packages/tooling/library/repo-utils/test/schemas/TSConfig.test.ts:203-244`: Outer Options are asserted Some, but nested plugins and ts-node.compilerOptions only guard payload assertions. Require each nested Option to be Some before reading its payload, then retain the exact customSetting and customOption expectations. Returning None for either nested value skips the local extra-preservation check today. Keep the separate encoding equality test and all existing Option/Exit operands during D5 migration. This adds missing assertions rather than merely duplicating EV006 syntax.

The publishConfig subset is explicit in source. rc113 documents recursion allowances, but no generator was executed by this read-only audit; the old comment's assertion about generation is not independently established or refuted. The proposed domain expansion must use valid bounded production shapes, preserve the existing concrete recursive examples and never weaken schemas or floors. TSConfig's conditional assertion gap is local to the open-extras decoder case; the separate exact encoder test remains useful and must be preserved.

### Timing and hosted history

Retained package Node baseline: 226 passed registrations across 21 executable files, 6997.144 ms reporter duration, 7.471412 s whole command, source head 662823dd960367046ba7d73dd8fd25d15782865a; Node22.22.3/Bun1.4.2/Vitest4.1.11. The five assigned executable files contribute 70 registrations. Six support modules have no independent timing entries; they are not missing or skipped test executions. Baseline evidence is reused, not rerun, and says nothing about complete compiler/coverage/package acceptance.

Seven hosted observations in two jobs are production coverage-ratchet failures, not seven failed assertions or unique flakes. Job 100621131987 (2026-09-03, head 011c166ba736d8817400bf013b0f5fac598f4d14, Node24.20.0) reports TSMorph.service functions/lines/statements floors. Job 102824638612 (2026-09-10, head 9f5f2186b9b4496a61ee37b048a5537d383b9dbf, Node22.22.3) reports TSMorph.model functions/lines/statements and service branches. Exact links and excerpts remain in the [hosted history summary](../hosted-history-summary.json); metric labels in legacy test_name fields are not test identities. No historical/current production diff was undertaken, so no current defect or flaky classification follows.

Global evidence still covers 139 timing attempts: 132 full-file-representation baselines, four configured subsets, three failures. graph-3d's browser file was absent from its configured Node cohort, not executed or reporter-skipped. The 527 failed-run history retains 21 unavailable logs and one unresolved downloaded cause. These limits are not converted to no-findings or passing proof.

### Proposed P2 order and uncertainty

After Root's combined review and Benjamin's P2 authorization: scope effectful formatter layers while preserving native process/temp boundaries; migrate Option/Exit assertions and add nested presence checks; preserve property floors and extend supported PublishConfig generation; make the stream-order control discriminating while preserving cancellation/deadlock limits; then adopt the instrumented runner with original names and diagnostics. No source changes, new tests, provider calls, skips, retry wrappers or timeouts are authorized by these rows.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
