# Effected kit promotion Plan

## Status

Status: `active` — P1 in progress. The state of each wave and PR lives in its row in the tables below: a PR edits only its own row, and this line names no wave or PR, so concurrent lanes never conflict on it (SPEC W4-v).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Map every module to a package home, sweep the repo for reuse sites, design the `@beep/md` merge. | `research/promotion-map-2026-10-20.md`; decisions D-01..D-18 in `SPEC.md`. |
| P1 Implement | in-progress | Promote the waves, then run the adoption PRs (D-04). | Acceptance criteria in `SPEC.md`. |
| P2 Verify | pending | `package-verify` per package, scratchpad check, identity registry, typos. | Verification matrix green. |
| P3 Yeet: PR to mergeable | pending | One PR per wave and per adoption step, each driven to mergeable. | Each PR merge-ready; zero unresolved threads. |
| P4 Close | pending | Closeout reflection and packet flip. | Reflection exists; `proposedCloseout` in the final PR. |

## Waves

The binding plan for wave 3 is `research/wave-3-plan-2026-10-23.md`: its "PR sequence" table sets
the sub-wave order, dependencies and parallel lanes, and its decisions are recorded as W3-a onward
(numbered after merging main).

| Wave | Packages | Notes |
| --- | --- | --- |
| 1a (merged, #1956) | `@beep/spdx`, `@beep/schema-org`, `@beep/github-references`, `@beep/github-commands`, `@beep/commands`, `@beep/jsonl`, `@beep/jsonc`, `@beep/semver` | Low-finding packages first (D-19, D-20, D-21); every gate at zero findings, no inventory growth. |
| 1b (merged, #1981) | `@beep/memfs` (+ D-07 retirement of `@beep/test-utils/MemoryFileSystem`), `@beep/managed-section`, `@beep/toml`, `@beep/git`, `@beep/glob`, `@beep/yaml` | Complexity and duplication refactored to zero against the conformance oracles (yaml-test-suite, toml-test, minimatch, node:fs differential suites); shared helpers in `@beep/utils` (D-23); memfs replaces the test-utils copy in 17 packages (D-25). |
| 2a (merged, #1988) | `@beep/npm-spec`, `@beep/tsconfig` | The pure halves of `npm` and `tsconfig-json` (D-26..D-28); `DEFAULT_REGISTRY` moves into `@beep/npm-spec`. The registry/publish half and the tsconfig loaders stay in the lab. |
| 2b-1 (merged, #1992) | `@beep/walker` | D-31, D-32. Adopters: repo-utils `Root` `findRepoRoot`, `TSMorph` `resolveFileEntrypointTsConfig`, `FsUtils` `findNearestPackageDir`; repo-cli `Drawings.review`, `TestTsgoPrograms` (segment-aware containment). Lab importers retargeted to `@beep/walker` leaves. |
| 2b-2 (merged, #1994) | `@beep/github` | Replaces `@effected/github` in repo-cli (one atomic swap, D-34); closes the `@effected/github` Exception Ledger row. Merges after 2b-1 (shared identity, catalog, `bun.lock` and `PROMOTED`-map files). |
| 2b-3 (merged, #2002) | `@beep/runtime-env` | Lands with the `@beep/chalk` and `@beep/colors` delegation (D-14 as amended by D-33, colour precedence; D-36 conformance shifts). repo-cli EnvConfig is not adopted: its exact `CI === "true"` differs from `RuntimeEnv.ci` (Exception Ledger "Duplicate CI detection", removal with cli-kit in wave 4). Last in 2b: the only PR with intended CI-visible behaviour changes (plain `@beep/colors` output in Actions logs, D-33 option (a)). |
| 2c (merged, #2016) | glob adoption (no new package) | D-37. Needs 2b-1. Retires `@beep/utils/Glob`, `@beep/schema/Glob` and `FsUtils.walkFiles`/`globFiles` onto `@beep/glob` + `@beep/walker`, and repo-cli `Lint/internal/WorkspaceWalk.ts`; records the Bun `node:fs` glob census. Closes the "Duplicate directory traversal" ledger row and narrows "Duplicate glob matching" to repo-cli `internal/GlobPattern.ts` and the `EffectImports` tinyglobby scan (glob reuse phase). |
| 2d-1 (merged, #2102) | `@beep/markdown` | D-38..D-45. Scaffold, rename-only move with the benchmark baseline (D-40), branded `S.Opaque` nodes admitted once per entry point (D-39), conformance lanes to zero findings with string-clean hot loops (D-41, D-42), the core-only codec-free root barrel and M3 MDX leaf (D-43), and the bridge prerequisites `MarkdownNodeKind`, `FrontmatterCodec.decodeResult`, `./conformance/*` and `MarkdownDocument.headingSource` (D-44). Lab importers (github-actions `GitHubMarkdown`, cli tests, reachability and layering maps) retargeted to `@beep/markdown` leaves; the five canon exceptions are cleared (D-45). |
| 2d-2 (merged, #2121) | `@beep/md` `Md.syntax`/`Md.parse` | D-48..D-51 (closes D-44). Subpath-only bridge from the `@beep/markdown` tree to `Md.Document`: losses as data (20 reasons, `frontmatterFormatChanged` included), HTML escaped as text and `math` off by default, one `MdFromSyntax.make` per call, a pre-order source map that returns `None` after a transform, no `Context.Service`. Import-boundary and export-set test, bridge-corpus ledger with the writer differential (measure only), round-trip and safe-profile properties. `cache-baseline-request-w2d2` records the `@beep/md` manifest edge; the turbo coupling is 52 dependents gaining four upstream packages, with the D-02 amendment threshold in D-50. Resolves map sites #237 and #290 (`history/reuse-ledger.md`). |
| 2d-A (merged, #2114) | adoption (no new package) | D-46, D-47. After 2d-1, in parallel with 2d-2: repo-cli `extractFrontmatter` (file deleted), the `ChangesetGraph` fence, skill-contract `SkillProjection` (import-closure pins keep the block parser out), `Goals/Inventory` through `MarkdownDocument` and `headingSource`. Parity over the committed corpus with every intended shift pinned (D-47). Closes the "Duplicate frontmatter splitting and README heading parsing" ledger row. |
| 2d-3 (merged, #2141) | `@beep/md` `Md.render` writer fixes | D-52. The gate held: of the 141 divergent writer-differential rows, 62 were writer gaps (`research/writer-differential-w2d3.md`). `&` and `$` escaping plus loose lists, adjacent-list markers, `***` breaks, task-item indent, block-edge whitespace, title line breaks, table pipes, emphasis delimiters, all-space code spans, `!` before links, bare URLs and the admonition body line; an escape-aware inline-math recognizer. Ledger writer column 1 / 651 / 79 (was 1 / 589 / 141), none newly divergent. `math` is on by default in `Md.parse` (no consumer outside `@beep/md`; ledger byte-identical either way). No changeset: `@beep/md` is private and changesets do not version private packages. |
| 2d-later | adoption, one PR each | D-46 deferred sites, tracked in `history/reuse-ledger.md`. |
| 3-1 (merged, #2122) | `@beep/github-reporting` | W3-b, W3-h, W3-i. The `github-actions` reporting suite (`CheckState`, `ManagedDocument`, `CheckDocument` on the root; `GitHubMarkdown` subpath-only) with branded `S.Opaque` records admitted once per read, managed-section leaf imports, the #1928 optionals restored, `markerLine`, the micromark GFM differential (in package and `ops/github-reporting-gfm-differential.ts`) and the growth guard. Lab retargets only: github-actions `index.ts`, `package.json`, `Exports.test.ts`, `reachability.test.ts`, both PROMOTED maps, README/KNOWLEDGE prose. |
| 3-2 (merged, #2129) | `@beep/repo-tsconfig` | W3-c, W3-h, W3-k..W3-n. The lab `tsconfig-json` folder is fully promoted and gone. Realpathed package targets, `.json` siblings of `.ts`/`.js` export targets, tsc's `exports` fall-through (W3-n), and the three-way differential (`ops/repo-tsconfig-differential.ts`; corpus A 0 adopter-field diffs on 668 configs, corpus B loader == tsc on 714, 45 of them synthetic `exports` cases). Adopters: EffectDiagnostics (2 sites, the check-program test) and TestTypecheckCoverage; get-tsconfig leaves repo-cli and the root catalog. The `TsconfigValidator` and docgen move is 3-A6. |
| 3-Y (merged, #2116) | `@beep/yaml` continuation fix | W3-d. No adopters. From main; parallel with all. Repro tests, an oracle property, yaml-test-suite at zero failures, the lockfiles suite re-run. |
| 3-3 (merged, #2134) | `@beep/config-file` | W3-e, W3-h (3-3). Adopters: docgen `Configuration.ts` `readJsoncFile` (docgen drops `jsonc-parser`), repo-cli `Models.manifest.service.ts` `load`; lab xdg and cli (the lab cli renderer no longer imports the package). Codec-corpus conformance suite and `ops/config-file-codec-differential.ts`; coverage 100/100/100/100. Cut after 3-Y merged; serializes with 3-2 on the repo-cli manifest. |
| 3-4 (merged, #2126) | `@beep/package-json` | W3-f, W3-h (3-4). Lab importers only: the sbom re-export is dropped (type-only `SbomMetadataSource`), workspaces imports the package, both PROMOTED maps list it. `PackageName` follows `validForOldPackages` with a `validate-npm-package-name@7.0.2` differential; live census `ops/package-json-corpus.ts`. Adopters follow in 3-A2 (field growth), 3-A3 (repo-utils re-base) and 3-A4 (repo-cli and docgen readers); Exception Ledger row "Duplicate package.json field models". |
| 3-5 (merged, #2159) | `@beep/lockfiles` | W3-g, W3-h, W3-i. The four lockfile parsers, the `Lockfile` model and integrity checks with branded `S.Opaque` records and one `Lockfile.make` per `parse`/`withImporterNames`; `ResolvedPackage`, `WorkspaceDependency` and `LockfileImporter` stay `S.Class` on the bench fallback (W3-g). The bench (`ops/lockfiles-bench.ts`) and the live oracle (`ops/lockfiles-oracle.ts`, root `bun.lock` against `bun pm ls --all` plus 76 captures) are recorded under `research/`. Lab retargets only: workspaces imports `@beep/lockfiles`, both PROMOTED maps, README/KNOWLEDGE prose, the stale `DIAGNOSTIC_EXCEPTIONS.md` row. 3-4 takes main first on `WorkspacePackage.ts`. |
| 3-A1 (merged, #2187) | lockfiles adoption + `ResolvedPackage.installName` | W3-g (3-A1 part), W4-h (3-A1 part). repo-cli `CatalogUsage.ts` and `RootCatalog.ts` (bun.lock half) read `Lockfile.parse`; the kit gains `ResolvedPackage.alias`/`installName` and `Lockfile#rootPackage` (which adopts `LockfileImporter#dependency`). Live parity over the root `bun.lock` in `research/lockfiles-adoption-parity-w4.json` (`ops/lockfiles-adoption-parity.ts`). Removes the "Duplicate lockfile readers" Exception Ledger row. After 3-5. |
| 3-A2 (merged, #2197) | package-json field growth | W3-f (3-A2 row). The 25 generic npm/Node/TypeScript/bundler/Yarn/Bun fields repo-utils `schemas/PackageJson.ts` modeled and the kit lacked join `Package` (and so `PackageManifest` and every `wireFor` subclass) through the new `ManifestFields` leaf, with a permissive guard each on `LenientManifest`; `DevEngine.onFail` gains `download` (OpenJS devEngines proposal, pnpm). Kit only. Census `--compare` 0 regressions (`research/package-json-corpus-3a2.json`). |
| 3-A3 (merged, #2270) | repo-utils re-base | W3-f (3-A3 part), W3-h (3-A3 part), W4-h (3-A3 part), W4-i (3-A3 part), W4-j (3-A3 part). `PackageJson` extends `PackageManifest` (2,111 → 1,322 lines); dependency maps, `scripts` and `WorkspaceDeps` buckets are `HashMap`; `NpmPackageJson`, `npmPackageJsonJsonSchema` and `UniqueDeps.ts` deleted; repo-cli consumers migrated. Parity: 193 manifests, 801 mutations, 170 intended differences (148 raw-encoder reorders), 0 unclassified. Stacked on 3-A4 (#2246, D-54). |
| 3-A4 (merged, #2246) | package.json readers | W3-f (3-A4 part), W4-h (3-A4 part), W4-i (3-A4 part). repo-cli's projection readers (ChangesetGraph, ChangesetStatus, PackageVerify, QualityArtifactSupport, Tasks, CatalogUsage, BunResolver, `RootCatalog.ts` package.json half, PackageTestTypecheck, EffectSchemaInventoryModules) read through `LenientManifest` via one `internal/ManifestRead.ts` adapter; docgen `Version.ts` and `Configuration.ts` through `PackageJsonFile`; the VersionSync updaters through `PackageJsonFormat.modifyToString`. Old-versus-new parity over 193 manifests (`ops/package-json-readers-parity.ts`); the JSONC, `workspaces` and updater behaviour changes are pinned by tests. Narrows the "Duplicate package.json field models" Exception Ledger row to 3-A3's repo-utils site. |
| 3-A5 (merged, #2294) | CheckCensus onto `TsconfigLoader.compilerOptions` | W3-c (3-A5 part), W4-h (3-A5 part). repo-cli `Quality/CheckCensus.ts` reads the package `references` and the check-overlay `include`/`exclude` through `TsconfigLoader.load`, and each referenced project's `outDir` through `TsconfigLoader.compilerOptions` (inherited through `extends`, `${configDir}` substituted); the three local schemas and the `jsonc-parser` import are gone. Parity: `ops/check-census-adoption-parity.ts` (185 census packages, 1,273 references, 0 overlay or declaration-index differences, `research/check-census-adoption-parity-3-a5.json`) and the real census before/after with timing keys stripped (`research/check-census-parity-3-a5.md`). The inherited-`outDir` shift is pinned by a test. After 3-2. |
| 3-A6 (in review, this PR) | `TsconfigValidator` + docgen `readTSConfig` | W3-c (3-A6 part), D-56, W4-h (3-A6 part), W4-i (3-A6 part). `@beep/tsconfig` gains the closed views `ClosedCompilerOptions` / `ClosedTsconfigJson`; `@beep/repo-tsconfig/TsconfigValidator` layers tsc's uniqueness and cross-field rules over them (`StrictTsconfig`, `StrictCompilerOptions`, `TsconfigValidationError`; `validate`, `validateCompilerOptions`, `load`, `compilerOptions`). docgen `Configuration.readTSConfig` reads a named tsconfig through `TsconfigValidator.compilerOptions` (extends chain merged), `CompilerOptionsShape` is the closed view's encoded side, `encodeExamplesTsconfig` renders the examples tsconfig; `CLI.ts` and `Core.ts` follow. repo-utils `schemas/TSConfig.ts` and its test are deleted (no repo-cli importer existed). Parity: `ops/tsconfig-validator-parity.ts` over 686 tracked `*tsconfig*.json` (683 identical verdicts, 3 classified tsc-7 `allowImportingTsExtensions` flips) and 181 `docgen.json` (170 loaded, resolved options identical; `research/tsconfig-validator-parity-3-a6.md`). The docgen parity is vacuous for a `parseCompilerOptions: "<file>"` string input (no `docgen.json` in the repo names a tsconfig file), so the string-input shift (the `extends` chain merged and path options absolutized where the legacy read took the single named file) is pinned only by the two `test/Configuration.test.ts` cases `merges the extends chain` and `falls back`. Every other shift is an inverted test (D-56). After 3-2, 3-3, 3-A3, 3-A4. |
| 3-A7 (merged, #2311) | `TsconfigSync.schemas` onto `@beep/tsconfig` | W4-h, W4-i (3-A7 part). repo-cli `TsconfigSync.plan.ts` decodes its six tsconfig parse sites through `TsconfigJson` (strict kit: all 666 tracked `tsconfig*.json` files decode); the four partial projections are deleted. A non-string or empty reference `path`, an invalid `compilerOptions` value and a malformed root `paths` value now fail the sync (pinned). Byte parity: `ops/tsconfig-sync-parity.ts`, 13 mutations, 0 differences (`research/tsconfig-sync-parity-3-a7{,-head}.json`). repo-cli gains `@beep/tsconfig` (cache baseline request `research/cache-baseline-request-3-a7.json`). |
| 3-A8 (merged, #2202) | `GitHubMarkdown.table` adoption | repo-cli `Ci/RunnerLossRerun.ts` (fixes the unescaped `\|` cells, pinned red-then-green) and `Ci/CiOperational.service.ts`; repo-cli gains the `@beep/github-reporting` dependency (cache baseline request `research/cache-baseline-request-w3-a8.json`). Parity: every other recorded summary byte-identical (W4-h, 3-A8 part). `LaneTimings` and `Ci.command` tables stay excluded. |
| 3-A9 (merged, #2190) | `ScopedPackageName` | observability `catalog/Catalog.names.ts`: `PackageName` is `ScopedPackageName` re-annotated, and observability depends on `@beep/package-json` (leaf import only). Parity over the 2,407 distinct repo names (196 tracked manifests, 3,348 `bun.lock` packages): 0 disagreements (`ops/observability-package-name-parity.ts`, `research/observability-package-name-parity-3-a9.json`). Intended divergences pinned by inverted tests: a leading `-` in the scope or name is accepted, and names over 214 characters are rejected. Cache review `research/cache-baseline-review-3-a9.md`. |
| 4-X (merged, #2184) | `@beep/xdg` | W4-c, W4-h (4-X part). Root `Xdg`, `AppDirs`, `NativeDirs` and the new `XdgBase` leaf; `./XdgConfig` subpath-only (root-closure test). Absolute values only; HOME-optional `XdgBase`; the platform through `HostProcessPlatform`; branded Opaque records. Adopters: m365-mcp `OutboxConfig` roots, repo-cli `WorkstationState` (env-matrix parity committed against the old bodies). Frozen `systemd-path` goldens (900 cases) and `ops/xdg-systemd-differential.ts` (0 undocumented differences); the lab xdg directories are gone; coverage 100/100/100/100. Cut after 3-3 merged. |
| 4-C (merged, #2200) | `@beep/cli-kit` | W4-d, W4-g (4-C), W4-h (4-C), W4-j (4-C), W4-s (4-C). Root and `@beep/repo-workspaces/testing` of the lab `cli` (`ui/**` stays in the lab until C, W4-m). Named importers migrated in the PR: `@beep/repo-cli` (`MonitorComments` and `Accounts.view`) and `@beep/repo-ai-metrics` (`agent-effectiveness`), all through `Fmt`. New `Fmt.stripControls` (single-line strict) with `ops/cli-kit-sanitize-differential.ts` at 0 differences against both private copies; `CliMessage.status` predicate dispatch; the #1928 option fields keep `S.optionalKey` under EF-40 (#2145) with the explicit-undefined tests inverted to pin rejection; operation-count bench `ops/cli-kit-bench.ts`; a raw-glob boundary test. Lab `./ui` retargeted to the package. |
| 4-W-b (merged, #2241) | `@beep/repo-workspaces/testing` | W4-f, W4-g, W4-h, W4-j, W4-s (4-W-b parts). The lab `workspaces` testing cluster (`SourceBoundary`, `LayerPolicy`, `WorkspaceLayering`, `PackedInstall`, `testing.ts`, `internal/{dependencyFields,packedInstallPlan,sourceText}`) moves into the package as its `@beep/repo-workspaces/testing` subpath; the lab `effected/workspaces` directory is gone and only the lab-wide `layering.int`, `lab-layers.json` and `peerClosure.int` stay until C. The inherited `allowSharedBins` e2e red is fixed at its root (the bun shared-bin winner is keyed by the probed version, provenance is mandatory for flat layouts) and the Bun P3 S1 control accepts Bun's module-not-found spelling; the `LayerPolicy` JSON Schema key re-keys to `@beep/repo-workspaces/LayerPolicy/...`. Lab retargets: `cli/boundary.test.ts`, `engine/purity.test.ts` and `layering.int` import the package leaves; both PROMOTED maps. Zero findings; `S.optionalKey` kept under EF-40. |
| 5 (merged, #2245) | `@beep/github-actions` | W4-g, W4-h, W4-i, W4-j, W4-s (W5 parts). Leaf driver (`packages/drivers/github-actions`, `$GithubActionsId`): the lab `github-actions` module moved whole, `ActionCache.resolvePaths` split first, then the conformance commits to zero findings (Effect diagnostics 0 src and tests, fallow 0, schema-first 0 with every option bag and record a branded `S.Opaque`, effect-vitest 0 introduced). `@azure/storage-blob` is an exact `12.34.0` catalog pin. Runner-file adopters in repo-cli: `CiOperational` (job-env, runner-resources, the `WorkflowCommand.warning` line), `Ci.command`, `CiAdmission`, `CiRerunRunnerLoss` publish through `ActionOutputs` (`CiRunnerOutputsLive`), each with a parity test. 971/971 under Node and Bun. |
| R1 (merged, #2195) | semver owner switch (no new package) | W4-h, W4-i. Deletes `@beep/schema/Semver` (zero importers, no alias). repo-cli VersionSync `BunResolver` and `DockerResolver` (one exported `selectLatestDockerTag`) and `@beep/repo-configs` `CacheClientPin.version` read through `@beep/semver`. Parity: `ops/semver-owner-switch-differential.ts`, recorded before the deletion in `research/semver-owner-switch-differential-r1.json`, 0 unclassified differences. Removes the "Duplicate semver model" Exception Ledger row; reuse-ledger `@beep/semver` section. |
| R9 (merged, #2289) | drivers onto `@beep/commands` (no new package) | W4-l, W4-h, W4-i (R9 parts). `@beep/exiftool`, `@beep/pdf-tools` and `@beep/tailscale` collect through `Run.collect` (pdf-tools with `RunOptions.timeout` and `Run.extendEnv`), `@beep/obs` spawns through `Run.detach`; each keeps its error model behind a local reason map. Parity: every existing suite unchanged and green under Bun and Node, plus a reason-map test per driver that also passes on the old sources for every pre-existing failure class. Retires the `effect-child-process-hardening` row "Driver-local output folds" (D-03); the other 8 partial drivers stay excluded with their kit options. Cache baseline request `research/cache-baseline-request-r9.json`. Zero findings; no changeset (all four drivers are `private`). |
| Deferred | npm registry/publish driver, `@beep/sigstore`, `@beep/ink`, `engine` -> `@beep/mcp-kit` | D-05 as amended by W4-m: deleted from the lab at C and pinned by sha; see "Deferred" below. |
| 4-W-a (merged, #2206) | `@beep/repo-workspaces` (core and config-deps) | W4-f, W4-g, W4-h. Rename-only partial move (W4-t), then the conformance commits to zero findings; the `testing` cluster stays in the lab and imports the leaves (4-W-b moves it). `@beep/commands` and `@beep/git` are operational-adapter driver deps confined by `test/reachability.test.ts`; `@pnpm/catalogs.*` exact catalog pins. The config-dependency ladder reads through `FileSystem`/`Path`/`Config` (correction 4). Oracle: `research/repo-workspaces-differential-w4.json` (186 members, 1,301 edges, `sort()` valid). Exception Ledger "Duplicate workspace discovery and dependency graph" (4-A1..4-A3). |
| 4-S (merged, #2183) | `@beep/sbom` | W4-b, W4-g, W4-j, W4-s (4-S parts). The 8 pure modules of the lab `sbom` (IdentityToken included) as branded `S.Opaque` records admitted once per constructor; `SigstoreSigner` stays in the lab (signer-only `index.ts`, deferred `@beep/sigstore`). Bun-safe raw-glob reachability, `S.optionalKey` kept on the 5 input structs with their explicit-undefined tests inverted to pin rejection (#1928 under EF-40, W4-j), `ajv`/`ajv-formats` exact pins with no new `bun.lock` hash, the full-schema oracle and `ops/sbom-corpus.ts` (192 manifests, 191 generated, 0 schema failures). Lab retargets: the signer, github-actions `ActionsIdentityToken`/`ActionsProvenance`, both PROMOTED maps. |
| DEBT (merged, #2223) | no new package | W4-j (DEBT), W4-u. Closes #2185: the lab `github-actions` suite is 957/957 on Node and Bun (was 12 failing) with the explicit-undefined tests inverted to pin rejection, the `DetachedProcess.reap` ESRCH classification fixed with a red-then-green real-process test, and the Bun `process.exitCode` restore in `Action.test.ts`. Closes #2170: `initiative-manifest/v2` `opsScripts` with the `beep goals doctor` registration check, every `ops/*.ts` registered. Closes #2160: the wave-4 plan snapshot note. |
| 4-X-A (merged, #2242) | XDG adoption (no new package) | W4-c, W4-h, W4-i (4-X-A parts). Nine map sites onto `@beep/xdg` `XdgBase`: ai-metrics `aiMetricsStateHome` and the forwarder hook-evidence root; repo-cli `BeepCacheRoot`, Fleet scanner cache, HarnessLedger hook-pulse directory, ai-metrics command data root and person-match cache; docket-intake `stateDirectory` and the contacts state root. Env-matrix parity committed against the old bodies first (116 rows after review, 34 inverted on purpose); Windows drive and UNC roots keep their old answers in `aiMetricsStateHome` and the person-match cache. `@beep/xdg` closes its two 4-X gaps red-then-green (`research/xdg-gaps-red-run-4-x-a.md`): a relative HOME fails `Xdg.layer`, and a relative `AppDirs` override dies with `AppDirsOverrideError`. Removes the "Duplicate XDG base-directory resolution" Exception Ledger row; `apps/practice-mail-tagging` stays excluded (#183), as do practice-gateway, practice-kg-mcp and repo-workspaces `configDependencyResolution` (reuse-ledger rows). |
| 4-C-A (in review, this PR) | CLI failure rendering and prompt gating (no new package) | W4-d, W4-aa, W4-h, W4-i (4-C-A parts). repo-cli `bin-main.ts` runs every path through `@beep/cli-kit` `CliRuntime.main` with the `renderCliFailure` hook (`internal/cli/FailureRendering.ts`: an already-reported `CliReportedExit` renders no line, a named test pins it) and `usageExitCode: 1`; `streamConsole` wraps the run, so the report keeps the `Stdout.ts` EPIPE latch, and command logs keep Effect's default loggers (W4-aa). SkillsReview's prompt runs behind `CliPrompt.gateTerminal` with `CliInteractive`; `accounts-usage.test.ts` drives the live screen through `TestTerminal`. Oracle: `ops/cli-failure-render-differential.ts`, 28 cases recorded before the switch; after it 24 are identical and 4 are intended shifts (workflow-command neutralization, the dropped interrupt line). Removes the "Duplicate CLI failure rendering and prompt gating" Exception Ledger row; no changeset. |

## Wave 4 and the closing roadmap

The binding plan for everything left is `research/wave-4-plan-2026-10-23.md`. Its "PR sequence"
table is the execution order (W4-a), mirrored here without the parallelism and size columns. Every
merge after the first takes main first and regenerates the shared files. Critical path: 3-5, 3-A1,
3-A4, 3-A6, R3a, R3b, C. Second path: 3-5, 4-W-a, 4-A1, 4-A3, C. The sites each row moves are in
`history/reuse-ledger.md`.

W4-c, W4-d and W4-f are copied into the SPEC Decision Log from the plan table with one spelling
change: the plan's dot-slash subpaths are written as "the `XdgConfig` subpath" and "the `testing`
subpath", because the knowledge doctor reads a dot-slash span as a packet-relative tracked path.

| id | scope | depends on |
| --- | --- | --- |
| 3-3 (#2134, merged) | `@beep/config-file`; docgen `readJsoncFile`, repo-cli Models `load`; lab xdg and cli retargets | 3-Y (merged) |
| 3-5 (#2159, merged) | `@beep/lockfiles`; lab workspaces retargets | main |
| 2d-3 (#2141, merged) | `@beep/md` `Md.render` `&`/`$` escaping, evidence-gated | 2d-2 (merged) |
| R0 (merged, #2156) | docs only: ~195 reuse-ledger rows; drop the stale frontmatter ledger row; SPEC matrix `check:effected`; W4-a..W4-t rows; SPEC duplicate dedupe (first pass) | main |
| 3-A2 (merged, #2197) | package-json field growth (`DevEngine.onFail` gains `download`, verified against npm docs) | 3-4 (merged) |
| 3-A5 (merged, #2294) | CheckCensus onto `TsconfigLoader.compilerOptions` | 3-2 (merged) |
| 3-A7 (merged, #2311) | `TsconfigSync.schemas` onto `@beep/tsconfig`, byte parity | 3-2 (merged) |
| 3-A8 (merged, #2202) | `GitHubMarkdown.table` in `Ci/RunnerLossRerun.ts`, `Ci/CiOperational.service.ts` | 3-1 (merged) |
| 3-A9 (merged, #2190) | `ScopedPackageName` in observability `Catalog.names.ts` | 3-4 (merged) |
| 4-CI (merged, #2179) | one CI rule through `@beep/runtime-env` (W4-e) | main |
| R1 (merged, #2195) | delete `@beep/schema/Semver`; BunResolver and DockerResolver onto `@beep/semver`; `Cache.policy.ts:245` pin | main |
| R2a | `vitest.setup.ts`: `toml` shim out, `GlobShim` matcher on `@beep/glob`; `toml`, `picomatch`, `@types/picomatch` out of the root | main |
| R2b (merged, #2381) | repo-cli `internal/GlobPattern.ts` onto `@beep/glob`; `tinyglobby` out of `EffectImports.ts`; closes "Duplicate glob matching" | main (after 4-CI on `Tasks.ts`) |
| R5b (in review, this PR) | slugger/TOC in `@beep/markdown`; `@effect/markdown-toc` out of docgen, repo-cli and root; effect-drizzle README script | main |
| R9 (merged, #2289) | exiftool, pdf-tools, obs, tailscale onto `@beep/commands` `Run.collect`; retire the D-03 "Driver-local output folds" row | main (after #2145 if it is close to merging) |
| R10 (merged, #2274) | `@beep/git` for `Skills/internal/MergeBase.ts`, `repo-run/GitWorktree.ts`, `Yeet/internal/ProvenanceFooter.ts`, dead `GitExec.ts` collectors | main |
| 4-S (merged, #2183) | `@beep/sbom` (W4-b); lab signer, github-actions, PROMOTED maps | main |
| 4-X (merged, #2184) | `@beep/xdg` (W4-c); m365-mcp `OutboxConfig`, repo-cli `WorkstationState` | 3-3 |
| 4-C (merged, #2200) | `@beep/cli-kit` (W4-d); repo-cli MonitorComments + Accounts.view, ai-metrics agent-effectiveness; lab ui retargets | 3-3 |
| 3-A1 (merged, #2187) | lockfiles adoption + `ResolvedPackage.installName`; `CatalogUsage.ts`, `RootCatalog.ts` (bun.lock half) | 3-5 |
| 3-A3 (merged, #2270) | repo-utils re-base on `@beep/package-json` (`schemas/PackageJson.ts` 2,111 → 1,322, HashMap moves) | 3-A2 |
| 4-W-a (merged, #2206) | `@beep/repo-workspaces` core + config-deps (W4-f) | 3-5 |
| 3-A4 (merged, #2246) | package.json readers in repo-cli and docgen | 3-A1, 3-A2, 3-3, R1, 4-CI |
| 4-W-b (merged, #2241) | `@beep/repo-workspaces/testing` + PackedInstall fix + `LayerPolicy` re-key + lab cli/engine boundary retargets | 4-W-a |
| 4-X-A (merged, #2242) | XDG adoption: ai-metrics forwarder/data-root, `BeepCacheRoot`, `Fleet`, `HarnessLedger`, `AIMetrics/Programs`, `MatchPerson`, apps docket-intake and practice-m365-contacts (#183 excluded) | 4-X |
| 4-C-A (merged, #2309) | `CliRuntime.main` in `bin-main.ts`/`FailureRendering.ts` (EPIPE latching kept); `CliPrompt.gateTerminal` in SkillsReview; one `TestTerminal` swap | 4-C |
| R5a (in review, this PR) | DeletePackage key removal, typed frontmatter (`ReflectionArtifact`, `SkillFrontmatterCheck`), KnowledgeDoctor `beep-historical` | #2143, 4-CI |
| R8 (merged, #2298) | managed-section templates: Observability render, Explore Atlas, Models.render (LabIdentitySegment excluded; GhOps to the follow-up goal) | main |
| 3-A6 (in review, this PR) | `TsconfigValidator` + docgen `readTSConfig`; delete repo-utils `schemas/TSConfig.ts`; `@beep/tsconfig` closed view | 3-2, 3-3, 3-A3, 3-A4 |
| 4-A1 | repo-cli QAS discovery onto `WorkspaceDiscovery` (#143), discovery only, `resolvePathWithinRoot` post-filter | 3-A4, 4-W-a |
| 4-A2 | public `WorkspacePatterns` leaf; CreatePackage, TsconfigSync.plan, ConfigUpdater, ChangesetGraph, Tasks pattern readers (3 fallow suppressions out) | 3-A4, 4-W-a, R2b |
| 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit; `beep topo-sort` onto `DependencyGraph.sort()` with the jsdoc-inventory reorder in the same PR | 3-A3, 4-W-a, 4-A1 |
| 4-A4 (in review, this PR) | `Lint/EcosystemPolarity.ts` onto `SourceBoundary.scan` | 4-W-b |
| R4 | `yaml` out of repo-cli and ai-metrics runtime deps (Runners to `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor) | 3-3, 3-A4, 4-A2 |
| R6 | one fence extractor (docgen `Core.ts`, `EffectImports.ts`, `TypeScriptFences.ts`, `Doctest.ts`) or deferred per W4-q | R2b, R5b, #2144 |
| W5 (merged, #2245) | `@beep/github-actions` (drivers); runner-file adopters (`CiOperational`, `Ci.command`, `CiAdmission`, `CiRerunRunnerLoss`, github-commands #87); `@azure/storage-blob` exact pin; `ActionCache.resolvePaths` split first | 4-S, 3-A8, W4-j resolved |
| R3a | `@beep/schema/Jsonc` owner switch and deletion | 3-A6, R5a |
| R3b | `jsonc-parser` out of repo-cli, repo-configs, root; Skills formatter collapse | R3a, R4, R5a |
| C | close (Closeout definition of done) | every row above |

## Deferred

W4-m: each deferred module leaves the lab in C, pinned by the last sha that holds it. C fills in the
sha column; restore with `git checkout <sha> -- scratchpad/effected/<m> scratchpad/test/<m>`.

| Module | Future package | Trigger consumer | Last sha holding it |
| --- | --- | --- | --- |
| npm registry/publish half | npm driver | mcpb-kit tarball | filled at C |
| `sbom/SigstoreSigner.ts` | `@beep/sigstore` | a release attestation step | filled at C |
| `cli/ui*` | `@beep/ink` | the Accounts TUI | filled at C |
| `engine` | `@beep/mcp-kit` | an MCP server ProcessGuard | filled at C |
| `PORT_LEDGER.json` (W4-n) | none | none; referenced by sha only | filled at C |

## Adoption steps (after the wave that provides the package)

Ordered by verified removable lines (`research/promotion-map-2026-10-20.md`,
"Reuse sites"): `@beep/memfs` replaces `@beep/test-utils/MemoryFileSystem`;
the tsconfig and package.json models replace repo-utils' schemas;
`@beep/glob` + `@beep/walker` replace `@beep/utils/Glob` and
`@beep/schema/Glob`; `@beep/semver` replaces `@beep/schema/Semver` and the
VersionSync resolvers; `@beep/commands` moves drivers and repo-cli tests off
hand-rolled spawners; `@beep/github` and `@beep/git` take over repo-cli's
GitHub and git helpers; `jsonc-parser`, `yaml`, `toml`, `picomatch` and
`get-tsconfig` drop. Each step records its sites in `history/reuse-ledger.md`.

Ledger changes in wave 2d: the `@effected/github` and "Duplicate directory
traversal" Exception Ledger rows are removed (retired by #1994 and #2016);
the "Duplicate frontmatter splitting and README heading parsing" row is added
for the 2d-A sites and removed again by 2d-A (D-47); `history/reuse-ledger.md` starts with the `@beep/markdown`
sites; and `history/canon-exceptions/README.md` records that all five
markdown canon exceptions are resolved (D-45). In 2d-2 the reuse ledger gains a `@beep/md`
bridge section that closes map sites #237 and #290 and the placement half of
#259; the Exception Ledger is unchanged.

## Inherited failures to fix at promotion

PR #1928 changed `S.optional` to `S.optionalKey` across the lab, and the
scratchpad tests are not part of hosted CI, so these failed on `main` before
wave 1 (attributed on a pristine `426d494b34` checkout, 2026-10-21). Each
promotion restores the upstream optional semantics its tests assert, as
`@beep/commands` did in wave 1.

| Module | Failing on main | Wave |
| --- | --- | --- |
| `github` | `CodeScanning.test.ts` explicit-undefined keys | fixed in 2b-2: `CodeScanningSetup`'s five optional keys are `S.optional` again; the Bun `blakejs` interop failure in `crypto.test.ts` went with the dependency (D-34) |
| `engine` | `ProcessGuard.test.ts` explicit-undefined `onRejection` | deferred |
| `github-actions` | Artifact, BlobStore, DetachedProcess, GitHubToken, twirp, PackageManagerInstaller, sigv4, ToolInstaller option schemas (GitHubMarkdown and ManagedDocument fixed in 3-1, W3-b) | 5 |
| `cli` | CliLog/CliTest property tests, round-3 config and key-input schemas, CliMessage and Status hostile-glyph suites | 4 |

## Execution Notes

- Promotion script: moves `scratchpad/effected/<m>` to `src/` and
  `scratchpad/test/<m>` to `test/`, rewrites sibling imports to package
  names, re-keys `$ScratchpadId` to the package identity, derives manifest
  dependencies from real import statements, and repoints the modules still in
  scratchpad. Run `tsconfig-sync` and `bun install` after it, and build the
  dependency closure before `check` (`identity` dist goes stale when
  `create-package` registers composers).
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.

## Verification Commands

```sh
test "$(wc -m < goals/effected-promotion/GOAL.md)" -le 4000
jq . goals/effected-promotion/ops/manifest.json
git diff --check -- goals/effected-promotion
bun run beep quality package-verify @beep/<package>
bun run beep lint identity-registry
```
