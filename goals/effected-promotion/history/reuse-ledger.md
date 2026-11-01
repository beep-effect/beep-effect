# Reuse ledger

Reuse sites from `research/promotion-map-2026-10-20.md` ("Reuse sites") and
the wave plans, with their adoption status. `#n` is the map's site id. A site
leaves the open list in the PR that migrates it, or carries its reason here.

## `@beep/sbom` (wave 4-S, W4-b)

4-S moves only lab importers; `@beep/sbom` has no repo adopter yet (modeling, so no capability gate). Its consumers are
the lab `github-actions` adapters (wave 5 `@beep/github-actions`) and the lab Sigstore signer (deferred
`@beep/sigstore`, W4-m). The live corpus (`research/sbom-corpus-w4.json`) generates an SBOM for 191 of the 192 tracked
manifests with 0 full-schema failures.

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| lab `sbom` `SigstoreSigner.ts`, its tests, `index.ts`, `package.json`, `reachability.test.ts` | - | 4-S (done) | The signer imports `@beep/sbom/IdentityToken`, `/InTotoStatement` (type) and `/SigstoreBundle`; the lab index is signer-only, with no alias of the package; the lab reachability test keeps the signer assertions and pins leaf-only `@beep/sbom` edges. |
| lab `github-actions` `ActionsIdentityToken.ts`, `ActionsProvenance.ts`, their tests, `package.json` | - | 4-S (done) | Retargeted to `@beep/sbom/IdentityToken` and `@beep/sbom/SlsaProvenance`; the manifest names `@beep/sbom` instead of `@effected/sbom`. Suites 24/24 before and after. |
| both PROMOTED maps (`layering.int.test.ts`, github-actions `reachability.test.ts`) | - | 4-S (done) | `"@beep/sbom": "sbom"` (the package folds into the lab `sbom` module, D-29) and `@beep/sbom` in the kit-package set. Layering 26/26. |
| `@beep/github` `Attestation.ts` JSDoc, `KNOWLEDGE.md` | - | 4-S (done) | Prose only: statements are `@beep/sbom`'s, signing is the lab signer's. No code edge. |
| skill-contract `EvidenceReceipt.ts` | #138 | excluded | Stricter than the kit (a typed `{ sha256 }` digest, a literal `predicateType` per schema, a `NonEmptyArray` subject) and already thin; adopting `InTotoStatement` would loosen it. |
| `@beep/github` `Attestation.ts` `predicateType` literal | - | excluded | A string in a JSDoc example and a test; a driver-to-modeling edge for one constant is not worth it. |
| lab `github-actions` `ActionsIdentityToken`, `ActionsProvenance` move | - | W5 (done) | They moved with `@beep/github-actions` (`src/ActionsIdentityToken.ts`, `src/ActionsProvenance.ts`) and import the `@beep/sbom` leaves they already used; their suites pass in the package. |
| lab `sbom` `SigstoreSigner.ts` | - | deferred (D-05, W4-m) | `@beep/sigstore` with its first consumer (a release attestation step), or deleted at C and recoverable by sha. |

## `@beep/xdg` (wave 4, PRs 4-X and 4-X-A, SPEC W4-c)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| m365-mcp `OutboxConfig.ts` `stateRoot` (staging root and audit directory) | #180 | adopted in 4-X | `XdgBase.dir("data")` / `XdgBase.dir("state")`. Parity: the env matrix in `test/OutboxConfig.xdg.test.ts`, committed against the old body first; its divergent rows are inverted on purpose (relative or space-padded values ignored, a value with only trailing whitespace used verbatim instead of trimmed, HOME normalized, the missing-root message names an absolute path). |
| repo-cli `internal/state/WorkstationState.ts` `resolveWorkstationStateDir` | #167 | adopted in 4-X | `XdgBase.require("state")`; the override variable and the five callers are unchanged. Parity: `test/workstation-state-xdg.test.ts`, committed against the old body first, with the same inverted rows. |
| ai-metrics `forwarder.ts` and `data-root.ts` `aiMetricsStateHome` | #176, #288 | adopted in 4-X-A | `aiMetricsStateHome` resolves through `XdgBase.resolve("state")` and keeps its trim and trailing-slash rules. `XdgBase` is POSIX-only and `AiMetricsAbsoluteDataRoot` admits drive and UNC roots, so the Windows rungs stay beside it: a drive or UNC `stateHome` is used as given, and a drive or UNC `homeDir` gets `/.local/state` (rows "a Windows drive HOME", "a UNC HOME", "a Windows drive XDG_STATE_HOME", green against the old body). The forwarder's hook-evidence root reads through `aiMetricsStateHome`, so it agrees with HarnessLedger. `resolveForwarderEvidenceRoot` stays a public root-barrel export on purpose: it is the forwarder's own resolution step (`runAiMetricsForwarder` calls it) and the one named home of the `${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence}` precedence the hook writers mirror, not a test-only seam. Parity: `test/data-root.xdg.test.ts`, committed against the old bodies first; inverted rows: a relative value is ignored, HOME is normalized, the forwarder fails instead of reading a relative hook directory. |
| repo-cli `internal/repo-run/BeepCacheRoot.ts` | #168 | adopted in 4-X-A | Keeps its override and TMPDIR rungs; the XDG rung is `XdgBase.dir("cache")`. Parity: `test/xdg-adoption.test.ts`; inverted rows: a relative `XDG_CACHE_HOME` or `HOME` is ignored instead of resolved against the working directory. |
| repo-cli `Worktree/Fleet.service.ts` cache root | #179 | adopted in 4-X-A | `Worktree/internal/FleetScannerDir.ts`: `fleetScannerCacheRoot` is `XdgBase.resolve("cache")`, and `selectFleetScannerDir` is the scanner-directory selection `scanFleet` calls, reading `XDG_CACHE_HOME` live through `configStringOptionSync`; both reach tests through `@beep/repo-cli/test/Worktree`, not the public barrel. Parity: `test/xdg-adoption.test.ts`, the pure matrix plus a live-environment block over `selectFleetScannerDir`; inverted rows: an empty or relative `XDG_CACHE_HOME` no longer yields a relative scanner path, and HOME is normalized. Fleet has no Windows branch. |
| repo-cli `HarnessLedger/HarnessLedger.command.ts` | #177 | adopted in 4-X-A | `resolveHookPulseDir` moved to `HarnessLedger/internal/HookPulseDir.ts` (tests reach it through `@beep/repo-cli/test/HarnessLedger`) and reads through `aiMetricsStateHome`, which is on `XdgBase` and keeps the Windows rungs. Parity: `test/xdg-adoption.test.ts`; inverted rows: a relative value is ignored. |
| repo-cli `AIMetrics/internal/Programs.ts` | - | adopted in 4-X-A | No local resolution left: `resolveDataRoot` reads the two variables and delegates to `resolveAiMetricsDataRoot`, whose XDG rung is `aiMetricsStateHome`. Parity: `test/xdg-adoption.test.ts`; inverted row: a relative `XDG_STATE_HOME` falls back to HOME instead of failing the absolute-root guard. |
| repo-cli `Files/internal/MatchPerson.ts` `resolveCacheRoot` | #178 | adopted in 4-X-A | The new `selectPersonMatchCacheRoot` takes `XdgBase.resolve("cache")` after `--cache-dir`; the Windows rungs are kept beside it: a drive or UNC `XDG_CACHE_HOME` is still used, a drive or UNC `HOME` still comes before `USERPROFILE`, and the `USERPROFILE` branch now also covers a relative `HOME`. Parity: `test/xdg-adoption.test.ts` (Windows rows green against the old body). |
| apps `docket-intake` `Config.ts` and `practice-m365-contacts` `Contacts.state.ts` | #181, #182 | adopted in 4-X-A | Both read `XdgBase.require("state")`; docket-intake drops the state home's trailing slashes before joining its suffix, as the contacts root (`path.join`) does. `contactsStateDirectory` is a module export of an app with no `exports` map, beside `makeContactsState`, and `ContactsStateLive` composes it. Parity: `test/Config.xdg.test.ts` and `test/Contacts.state.xdg.test.ts`; inverted rows: a relative value is ignored or fails, HOME is normalized, a trailing slash on `XDG_STATE_HOME` no longer doubles the separator (docket-intake), and the contacts root no longer requires HOME when `XDG_STATE_HOME` is set. Neither app has a Windows branch. |
| apps `practice-mail-tagging` `PracticeMailTagging.config.ts` | #183 | excluded | It would start honouring XDG on a deployed practice service (W4-c correction 6). |
| apps `practice-gateway` `GatewaySettings.ts` `resolveDataDir` | - | excluded (4-X-A) | A deployed practice service, the #183 reason: moving it onto `XdgBase` would change where a running gateway keeps its data for any relative or padded `XDG_DATA_HOME`. Its Windows branch reads `LOCALAPPDATA`. |
| apps `practice-kg-mcp` `runtime/TelemetryKey.ts` `resolvePracticeKgTelemetryDir` | - | excluded (4-X-A) | A deployed practice service, the #183 reason: the telemetry key directory would move under a relative `XDG_STATE_HOME`, orphaning the stored key. Its Windows branch reads `LOCALAPPDATA`. |
| repo-workspaces `internal/configDependencyResolution.ts` `environmentStoreRoots` | - | excluded (4-X-A) | Not a beep base directory: it mirrors pnpm's own store lookup (`$PNPM_HOME/store`, `$XDG_DATA_HOME/pnpm/store`, `%LOCALAPPDATA%`), and must read `XDG_DATA_HOME` the way pnpm does, not the way the spec says. |

## `@beep/repo-workspaces` (waves 4-W-a and 4-W-b, W4-f)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| lab `scratchpad/effected/workspaces` testing cluster (`SourceBoundary`, `LayerPolicy`, `WorkspaceLayering`, `PackedInstall`, `testing.ts` and their internals and tests) | - | 4-W-a, 4-W-b | Retargeted to `@beep/repo-workspaces` leaves in 4-W-a; moved into the package as its `./testing` subpath in 4-W-b, with the entrypoint test and the `SourceBoundary` self-scan. The lab `effected/workspaces` directory keeps only its `.canon-exceptions.json`, with the 3 rows of the lab-wide integration suites. |
| lab `scratchpad/test/cli/boundary.test.ts` and `scratchpad/test/engine/purity.test.ts` (`SourceBoundary` scans) | - | 4-W-b | Import `@beep/repo-workspaces/SourceBoundary`; both suites pass unchanged under Node and Bun. |
| lab-wide `layering.int.test.ts` (with `lab-layers.json`), `peerClosure.int.test.ts`, `SourceBoundarySelf.int.test.ts`, and both PROMOTED maps | - | 4-W-a, 4-W-b | `layering.int`, `lab-layers.json` and `peerClosure.int` stay in place (correction 3), read the package leaves and are deleted by C; `layering.int` maps `@beep/repo-workspaces` to the `workspaces` lab module, which has no source left (its directory holds only the 3 canon exceptions of these two suites, live until C). `SourceBoundarySelf.int` moved into the package in 4-W-b. Both PROMOTED map notes record `workspaces` as promoted whole. |
| repo-cli `Quality/internal/QualityArtifactSupport.ts` `discoverWorkspacePackages` | #143 | adopted (4-A1) | Members come from `WorkspaceDiscovery` (discovery only) run with the kit's new opt-in `containWithinRoot` (upstream link-following stays the default), so an escaping link is skipped before its manifest is read; each is guarded again through `resolvePathWithinCanonicalRoot` and its as-read manifest decoded by the unchanged strict `LenientManifest` reader. The hand-rolled `expandWorkspacePattern` (and its `fallow-ignore` complexity suppression) and the module's `workspacePatternsFrom` are deleted. Parity: the discovery, `CoverageScope` and `CoverageRegression` surfaces are identical before and after, thirteen probe shifts are classified (`research/qas-discovery-adoption-parity-4-a1.json`), and the `jsdoc-inventory` output differs only in `generatedAt`. The Exception Ledger row "Duplicate workspace discovery and dependency graph" drops QAS and stays for 4-A2 and 4-A3. |
| repo-cli `workspacePatternsFrom` copies (`ChangesetGraph`, `CreatePackage`, `TsconfigSync.plan`, `ConfigUpdater`, `Quality/Tasks.ts`) | #146, #148, #149, #150 | adopted (4-A2) | `internal/patterns` promoted to the public `WorkspacePatterns` leaf; ChangesetGraph and Tasks read `WorkspacePatterns.read`, TsconfigSync builds its syncpack sources from it, CreatePackage projects its root manifest through `WorkspacePatterns.fromManifest`; the three `fallow-ignore` suppressions (the copied `applyJsoncModification` wrapper, ConfigUpdater included) are gone with the wrapper. Parity: 122 patterns, 189 matched package directories and three CLI check outputs identical (`research/workspace-patterns-adoption-parity-4-a2.json`). |
| repo-utils `Workspaces.ts`, `Dependencies.ts`, `DependencyIndex.ts`; `beep topo-sort` | #139, #142, #238, #239, #268 | 4-A3 | Onto `WorkspaceDiscovery` and `DependencyGraph.sort()`; the differential's 186-member, 1,301-edge parity is the baseline. |

## `@beep/lockfiles` (wave 3-5, W3-g)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| lab `scratchpad/effected/workspaces` (`LockfileReader`, `PeerCheck`, `DuplicateCheck`, `WorkspaceCatalogs`, `WorkspaceSnapshots`, `WorkspacePackage`, internal roots and importer versions, their tests) and both PROMOTED maps | - | 3-5 | Retargeted in the promotion PR to `@beep/lockfiles` leaves; the core and config-dependency half promoted as `@beep/repo-workspaces` in 4-W-a, and the `testing` cluster moved into the package in 4-W-b. |
| repo-cli `Quality/CatalogUsage.ts` `readLockfilePackages` (bun.lock key and specifier splitting) | #233, #129 (lockfile part), #156 | adopted in 3-A1 | `Lockfile.parse({ format: "bun" })` with `[pkg.installName, pkg.name]` per package; `installedNameFromLockKey` and `CatalogUsageLockfile` are deleted. The override-selector `packageNameFromSpecifier` stays (not a lockfile read). Names 2,408/2,408 (`research/lockfiles-adoption-parity-w4.json`). Exception Ledger "Duplicate lockfile readers" removed. |
| repo-cli `VersionSync/internal/resolvers/RootCatalog.ts` `BunLockDocument` and `readLockfileResolvedVersion` | #131, #155, #269, #289 | adopted in 3-A1 (bun.lock half) | `Lockfile#rootPackage` filtered to a non-workspace package of that real name; 3,172/3,356 probes agree, the 184 others are workspace packages whose legacy `workspace:<path>` "version" is now `None`. The package.json half was adopted in 3-A4. |
| mcpb-kit `internal/steps.ts` `ensureWindowsBindings` | #136 | excluded | Needs the npm driver's tarball download and integrity check, deferred with it; the lockfile pin read alone does not justify the edge. |

## `@beep/cli-kit` (wave 4, 4-C, SPEC W4-d)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| repo-cli `Yeet/internal/MonitorComments.ts` `stripTerminalControlSequences` (author, path, url, state and the excerpt of every `[yeet]` comment line) | #196 | adopted in 4-C | `Fmt.stripControls`. Byte parity with the private copy: `ops/cli-kit-sanitize-differential.ts`, 0 differences (`research/cli-kit-sanitize-differential-w4.json`). `Fmt.sanitize` stays as it was: it keeps line breaks for documents, which on these single-line fields would let a comment start a new `[yeet]` line. |
| `@beep/repo-ai-metrics` `src/agent-effectiveness.ts` `stripTerminalControlSequences` (worker-eval policy codes in doctor messages) | #197 | adopted in 4-C | `Fmt.stripControls`; the same differential covers this copy (the two were byte-identical regex chains). |
| repo-cli `Accounts/Accounts.view.ts` `fit` / `fitRight` and the board's width arithmetic | #205 | adopted in 4-C | `Fmt.truncate` and `Fmt.width`, so labels are cut and padded by display width; the `columnsFor` label width, `joinFitted` and the frame padding count the same way. ASCII boards are unchanged (the existing board tests); a CJK and an emoji label are pinned in `accounts-usage.test.ts`, which fails on the old view. The Chalk palette stays. The private `stripAnsi` is gone: `joinFitted` measures each colored part with `Fmt.width`, which counts every CSI and OSC escape as no columns. One shift: `fit` at width 0 now returns `""` where it returned `"…"`, unreachable because `MIN_LABEL_WIDTH` keeps every label column wider. |
| repo-cli `bin-main.ts` `renderCliFailure` and `internal/cli/FailureRendering.ts` | #199, #200 | adopted in 4-C-A | `CliRuntime.main` with `platform: Layer.empty`, `usageExitCode: 1` and a custom `render` (`renderCliFailure` in `FailureRendering.ts`: no line for an already-reported error such as `CliReportedExit`, else the message plus the cause on `--verbose`/`--log-level debug`). `streamConsole` wraps the run, so the report keeps the `Stdout.ts` EPIPE latching; the teardown keeps the terminal restore and the drain. #200 stays as the render hook's verbosity switch (`shouldRenderFailureCause`): the kit has no argv-based switch without `env`. Parity: `ops/cli-failure-render-differential.ts`, 28 cases: 24 identical, 2 `workflow-command-neutralized`, 2 `interrupt-report-dropped`, 0 unclassified (`research/cli-failure-render-differential-4-c-a{,-head}.json`). Command `Effect.log*` lines keep Effect's default loggers (W4-aa). |
| repo-cli `Skills/SkillsReview.service.ts` raw `Prompt.run` | #209 | adopted in 4-C-A | `CliPrompt.gateTerminal` with `CliInteractive.layer`, over `Audience.layer()` and `TerminalEnv.layer()` from `CurrentRuntimeEnv.layer`, built once per session and provided around each prompt. A run that cannot prompt quits without reading a key; a person on a TTY is asked as before. Pinned in `test/skills-review.test.ts` ("skills review prompt gate"). |
| repo-cli test `Terminal.make` stubs (`session-continuity.test.ts`, `accounts-usage.test.ts`) | #210 | adopted in 4-C-A, partial | The `accounts-usage.test.ts` `runScreen` stub is `TestTerminal.make({ columns: 90, rows: 40 })` (`watchAccounts` never calls `readLine`); the session-continuity stubs assert that input is never read, which `TestTerminal` would turn into queued input, so they stay with that reason. |
| docgen `Core.ts` chalk inside log messages | #202 | excluded | L3: dropping chalk changes docgen's output and needs a changeset for a cosmetic swap. |
| repo-cli `Accounts/Accounts.tui.ts` alternate-screen TUI | #206 | excluded | Needs the deferred `./ui` half (W4-m) and its Bun proof; the trigger consumer named in PLAN "Deferred". |
| repo-cli `Files/Files.progress.ts` progress runner | #208 | excluded | Repaints through `CliUi.live` only once repo-cli adopts Ink and React (the deferred `./ui` half). |
| repo-cli `Knowledge/Knowledge.service.ts` probe-diagnostic escape patterns | #198 | excluded | A third copy with different semantics: it also strips `\p{Cf}` and reports the disallowed controls it found, which `Fmt.stripControls` does not. Revisit with an option on `Fmt` if a second caller needs it. |
| lab `cli` `./ui` half (`ui/**`, `ui.ts`, `ui-testing*.ts`) | - | retargeted in 4-C | Imports the root through `@beep/cli-kit` leaves; deleted at C, pinned by sha (W4-m). |

## `@beep/config-file` (wave 3, sub-wave 3-3, SPEC W3-e)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| docgen `Configuration.ts` `readJsoncFile` (package.json and docgen.json) | #166 | adopted in 3-3 | `ConfigFile.read` + `JsoncCodec`; docgen drops `jsonc-parser`. Parity: the 364 tracked package.json and docgen*.json files decode the same through the old reader (`ops/config-file-codec-differential.ts`, docgen-inputs lane). A malformed `docgen.json` now fails typed (test). |
| repo-cli `Models/Models.manifest.service.ts` `load` | #165 | adopted in 3-3 | `ConfigFile.read` + `YamlCodec`; the writers keep the npm `yaml` stringifier and the atomic rename. Parity with the old reader for the five manifest fixtures, a writer round trip for them and the seed, and a typed syntax-error case (`test/models-manifest-config-file.test.ts`). |
| lab `xdg` `XdgConfig` | - | adopted in 3-3; promoted in 4-X | Imports `@beep/config-file` (`ConfigResolver` type); now the `@beep/xdg/XdgConfig` subpath (W4-c). |
| lab `cli` `ConfigIssueRenderer` | - | adopted in 3-3 | Takes the structural `{ readonly issue }` and no longer imports the package (promotion map row "cli-kit -> config-file"). |
| `Struct.deepMerge` and jsonl `internal/merge.ts` | - | excluded | Different merge semantics from config-file's `deepMerge`, which stays in the package. |
| docgen `readTSConfig` and the `@beep/schema/Jsonc` consumers | - | excluded here; `readTSConfig` adopted in 3-A6 | `readTSConfig` moved with the `TsconfigValidator` in 3-A6 (`@beep/repo-tsconfig` section); the `@beep/schema/Jsonc` consumers were adopted in R3a (`@beep/jsonc` section). |
## `@beep/github-reporting` (wave 3-1, W3-b)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| lab `scratchpad/effected/github-actions` (index re-exports, `Exports.test.ts`, reachability and layering maps) | - | 3-1 | Retargeted in the promotion PR; no lab module imports the suite any more. |
| repo-cli `Ci/RunnerLossRerun.ts` markdown table | - | adopted in 3-A8 | `GitHubMarkdown.table`; fixes its unescaped `\|` cells (red-then-green test in `ci-rerun-runner-loss.test.ts`). Pipes are escaped and newlines become `<br>` (both via `GitHubMarkdown.table`; pipe and newline tests in `ci-rerun-runner-loss.test.ts`). Parity: the existing `ci-rerun-runner-loss.test.ts` suite passes unchanged, and in a one-off old-vs-new render of its summaries only the pipe fixture (rendered twice, once per rerun mode) differs. |
| repo-cli `Ci/CiOperational.service.ts` markdown table | - | adopted in 3-A8 | `GitHubMarkdown.table` for the runner-resources table. Parity: old and new tables byte-identical over a one-off 36-case measurement matrix; `ci-runner-security.test.ts` pins the exact table text for both CPU-row branches. |
| repo-cli `LaneTimings` and `Ci.command` tables | - | excluded | Need column alignment, which the writer does not offer. |
| repo-cli Reviewer and CI summary bodies | - | deferred | Named by D-10; adopt with the wave-5 GitHub Actions driver, which composes `CheckDocument` with a real sink. |
| Marker-splice family (Provenance, GhOps, Quality, Findings.refresh, Atlas, Observability, Models) | - | excluded | File-backed managed sections go to `@beep/managed-section` directly, not through `ManagedDocument`'s comment dialect. |
| `@beep/markdown` `YamlFrontmatter` and `JsonFrontmatter` key strictness | - | resolved (#2138, D-53) | The codecs reject complex and `!!set` yaml keys and duplicate json keys with `FrontmatterKeyError`. `@beep/jsonc` has no duplicate-key detection to reuse, so the codec walks `Jsonc.parseTreeResult`. |

## `@beep/runtime-env` CI rule (wave 4, 4-CI, SPEC W4-e)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| repo-cli `internal/cli/EnvConfig.ts` `isCi`, `isCiSync` | - | 4-CI | `isCi` reads `CurrentRuntimeEnv`; `isCiSync` is `RuntimeEnv.fromRecord` over `Bun.env`. Callers: `KnowledgeDoctor.service.ts`, `Knowledge.command.ts`, `Docgen/internal/Local.ts`. |
| repo-cli `EnvConfig.ts` `canUseTurboCacheSecretSession` | - | 4-CI | Was exact `CI === "true"`; the verdict cache is keyed by repo root. |
| repo-cli `Quality/Tasks.ts` (`isCi` alias, 11 uses) | - | 4-CI | Alias removed; calls `isCiSync`. |
| repo-cli `Lint/Lint.command.ts` deprecated-apis and policy | - | 4-CI | Was `Config.String("CI")` compared to `"true"`. |
| repo-cli `DeletePackage/DeletePackage.command.ts` `assembleDeletePolicy` | - | 4-CI | Was `Config.Boolean("CI")`. |
| repo-cli `Ci/CiLane.ts` `directTurboArgs`, `Quality/internal/GithubChecks.ts` `rootTaskLane` | - | 4-CI | Were `Bun.env.CI === "true"`. |
| repo-cli `Quality/Quality.plan.ts` `detectQualityProfile` | - | 4-CI | Was non-empty `CI`, so `CI=false` and `CI=0` no longer select the CI profile. |
| repo-cli `Ci/CiLane.ts` `qualityCheckConcurrencyArg` (`GITHUB_ACTIONS === "true"`) | - | excluded | Hosted 16GB runner sizing, not a CI predicate. |

## `@beep/markdown` (wave 2d, SPEC D-46)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| repo-cli `internal/schema/Frontmatter.ts` `extractFrontmatter` (callers `ReflectionArtifact.ts`, `SkillFrontmatterCheck.ts`) | #37 | adopted (2d-A, D-47) | `FrontmatterSource.split`; delete the file and the `SharedInternals.test-kit.ts` re-export. Parity 509 of 510 (the miss is a `---json` skill the old code read as YAML). |
| repo-cli `Quality/ChangesetGraph.ts` frontmatter fence | #27, #276 (fence part) | adopted (2d-A, D-47) | `FrontmatterSource.split`; the schema block stays. The YAML half moved to `effect/encoding/Yaml` in R4 (see the R4 section). Parity 912 of 1,044; the other 132 are empty blocks with no references either way. |
| skill-contract `SkillProjection.ts` `---json` splitter | #231 | adopted (2d-A, D-47) | `FrontmatterSource.split` with format `json`, plus an import-closure assertion that the block parser stays out. |
| repo-cli `Goals/Inventory.ts` README regexes | #287 | adopted (2d-A, D-47) | `MarkdownDocument.parseResult` with `firstSection`, `sectionByHeading` and `headingSource` (root-level H1, D-47); pin the `---json`, `<Goal Title>` and list-interrupt shifts. |
| repo-cli DeletePackage `stripPackageFromFrontmatter` | #276 | adopted in R5a | `FrontmatterSource.split`, `YamlFormat.modifyToString(value, [name], undefined)`, `FrontmatterSource.join`; repo-cli gains the `@beep/yaml` dependency. A removal re-serializes the whole block (sibling spacing normalized, trailing blank lines dropped, a comment above the removed key lost with it); a CRLF block (by its recorded `newline`) gets its CRLFs back. 293 historical multi-package changesets prune byte-identically; an escaped key is now removed (bug fix). The substring bug was fixed independently in #2020. |
| ReflectionArtifact and SkillFrontmatterCheck typed frontmatter | #37 | adopted in R5a | `YamlFrontmatter.decode` over the `FrontmatterSource` block, then the consumer schema (not `MarkdownFrontmatter.schema`: no mdast parse per W4-r, and the skill check needs strict parse options). Verdict parity over 312 reflections and 48 `SKILL.md` files (`research/frontmatter-adoption-parity-r5a.json`). |
| docgen `@effect/markdown-toc` | #292 | adopted in R5b | `MarkdownSlug` (the `markdown-toc` 0.1.0 slug, title and anchor rule) and `MarkdownToc` (`entries`, `renderEntries`, `render`) in `@beep/markdown`; `Core.getModuleMarkdownFiles` renders through `MarkdownToc.render(moduleContent, { bullet: "-" })`. The npm package, its `markdown-toc.d.ts` shim, the repo-cli non-lockstep row and the root catalog entry are gone. Oracle: every docgen page's embedded TOC byte-identical to `markdown-toc`'s rendering (`research/markdown-toc-differential-r5b.json`); the tracked-Markdown slugger differential is classified there. |
| effect-drizzle `scripts/assemble-readme.ts` | - | adopted in R5b | `FrontmatterSource.split(content).body` replaces the local `stripFrontmatter`; `@beep/markdown` is a devDependency only (ecosystem polarity). `bun run readme` over the regenerated docs leaves `README.md` byte-identical. |
| docgen `fencePattern` and its consumers, EffectImports, SchemaTagIdioms | #282 | queued: R6 (or deferred per W4-q) | Needs code-node spans and an unterminated-fence diagnostic; zero JSDoc-ratchet drift. |
| repo-cli Knowledge.refs, KnowledgeDoctor, RoadmapRefs | #232 | excluded (W4-r) | Behind a perf budget: a full parse costs about 400 times the line split. Prefilter fence-bearing files and re-benchmark. |
| repo-cli KnowledgeDoctor `beep-historical` frontmatter | - | adopted in R5a | `FrontmatterSource.split`, yaml blocks only; the key line keeps its document line number. The corpus surface is vacuous (0 of 8,674 tracked Markdown files carry a document marker); parity rests on the 13 probes in `ops/frontmatter-adoption-parity.ts` and the `knowledge-doctor` test. An unclosed block no longer counts (D-47 grammar). |
| runpod `RunpodDocs.service.ts` | #301 | excluded | Needs a fixture first. |
| micromark oracle | #236 | excluded | A circular check. |
| `@beep/schema` Markdown | #227, #258 | excluded | MQ7 cycle; deleting `MarkdownTextToHtml` is a separate cleanup. |
| OnboardingSkill | #286 | excluded | Four lines in an app; not worth the dependency. |
| Research Vault `renderCard` | #31 | excluded | Write-only. |
| LLM JSON-fence extractors, Lexical code fence, rdf MdSections | - | excluded | Excluded by the wave 2d adopter census. |
| Marker-splice family (Provenance, GhOps, Quality, Findings.refresh, Atlas, Observability, Models) | - | excluded | Goes to `@beep/managed-section`, not a second owner in `@beep/markdown`. |

## `@beep/package-json` (wave 3-4, plan decision W3-f)

3-4 moves only the lab importers (sbom, workspaces). Every repo adopter waits for its adoption PR, in the order of the
wave-3 file-contention table. Writes to repo manifests go only through `PackageJsonFile.modify` /
`PackageJsonFormat.modifyToString`: the census (`research/package-json-corpus-baseline-w3.json`) shows the sorted
formatter rewrites 185 of the 186 repo manifests, while a same-value `modifyToString` is byte-identical for all 186.

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| lab `sbom` `index.ts` re-export of `Package`, `Person`, `Repository` | - | 3-4 (done) | Dropped; `SbomMetadataSource` imports the types from `@beep/package-json`, and the sbom reachability test pins no runtime edge. |
| lab `workspaces` `WorkspacePackage.ts`, `PackageManagerName.ts` | - | 3-4 (done) | Import `@beep/package-json`. |
| `DevEngine.onFail` `download`, plus the generic npm/bun fields repo-utils models today | #243 | 3-A2 (done) | 25 fields join `Package` through `ManifestFields` and `LenientManifest` (W3-f 3-A2 row). npm documents `onFail` as `warn`/`error`/`ignore`; `download` is the OpenJS devEngines proposal value pnpm implements. Repo refinements (repo-name keys, closed `rest`, the strict `exports`/`imports` grammar, the typed `publishConfig` base, `beep`, `resolutions#`) stay for 3-A3. Census `--compare`: 0 regressions over 189 manifests; all 189 round-trip through `PackageManifest.schema` with the new fields typed. |
| `@beep/lockfiles` `BunExtension.ts` private `OverrideValue` (bun.lock `overrides`) | - | excluded | Same recursive shape as `ManifestFields.OverrideValue` (3-A2), kept independent: lockfiles has no `@beep/package-json` edge and one five-line schema does not justify one (SPEC W3-f 3-A2 (i)). Reverse by importing `OverrideValue` from `@beep/package-json/ManifestFields`. |
| repo-utils `schemas/PackageJson.ts` (2,111 lines), `DocgenConfig.ts`, `WorkspaceDeps.ts` | #127, #243, #267, #47 | adopted in 3-A3 | `PackageJson` extends `PackageManifest` (1,322 lines). Kept: repo package-name keys, non-empty records, exports/imports grammar, typed `publishConfig`, `beep`, `resolutions#`, a closed `rest` (`optionalKey(Never)`), repo key order and JSON Schema emission. Deleted: `NpmPackageJson`, `npmPackageJsonJsonSchema` and every generic field schema. Shape change: optional fields instead of `Option`, `HashMap` dependency maps and scripts. `DocgenConfig.ts` unchanged (`RepoPackageName` kept); `WorkspaceDeps` buckets are `HashMap`. Parity (`ops/repo-utils-package-json-parity.ts`): 193 manifests, 801 mutations, 170 intended differences (148 raw-encoder reorders), 0 unclassified (W3-f 3-A3 row). |
| repo-utils `schemas/PackageJsonTools.ts` canonical order | #128 | adopted in 3-A3 | Keeps its own repo key order (beep after repository, publishConfig sub-order); the kit's `KEY_ORDER` has no override hook and is never the adopter path. Now also orders a `repository` object `type`, `url`, `directory` and sorts a `bin` map, because the kit fields no longer impose an order; canonical bytes are unchanged on 192 of 193 manifests (the other is the sorted `practice-kg-mcp` bin). |
| repo-utils `schemas/PackageJson.ts` (2,111 lines), `DocgenConfig.ts`, `WorkspaceDeps.ts` | #127, #243, #267, #47 | 3-A3 | Re-based on `PackageManifest.extend`; repo-utils keeps the beep metadata, the closed `rest` refinement and JSON Schema emission (D-08 by field ownership). 184-manifest verdict parity. |
| repo-utils `schemas/PackageJsonTools.ts` canonical order | #128 | 3-A3 | Keeps its own repo key order (beep after repository, publishConfig sub-order); the kit's `KEY_ORDER` has no override hook and is never the adopter path. |
| repo-cli Quality readers: ChangesetGraph, ChangesetStatus, PackageVerify, QualityArtifactSupport, Quality.schemas, Tasks, CatalogUsage.schemas, PackageTestTypecheck, EffectSchemaInventoryModules | #134, #135, #130, #143, #277 | adopted in 3-A4 | Every reader parses through `LenientManifest` via the one repo-cli `internal/ManifestRead.ts` `manifestParser(fields)`, which fails when a field the site reads degraded (the old projections' verdict) and leaves unread fields as `issues`. Object-form `workspaces` decode through the kit's `WorkspacesField`. Deleted: `ChangesetGraphPackageJson`, `ChangesetStatusPackageJson`, `PackageVerifyPackageJson`, the exported QAS `PackageJson` (`WorkspacePackageInfo.packageJson` is a `LenientManifest`), `PackageJsonDocument`/`PackageJsonWorkspacesDocument`/`decodePackageJsonDocument`, `CatalogUsageManifestDependencies`, `PackageManifestDocument` and the `RootManifest` struct. Kept with a reason: `CatalogUsageRootManifest` is the snapshot record; its root read is `LenientManifest` (`catalog`, `overrides`) plus Bun's `catalogs` from `rest`, which the kit does not model. `EffectSchemaInventoryModules` keeps two nested repo-specific schemas (`workspaces.catalog.effect`, `config.effectSource`). The pattern readers themselves (the `workspacePatternsFrom` copies) stay for 4-A1 (QAS) and 4-A2 (ChangesetGraph, Tasks). Parity: `ops/package-json-readers-parity.ts`, 193/193 per site (`research/package-json-readers-parity-3a4.json`). |
| repo-cli VersionSync `BunResolver`, `RootCatalog` (package.json half), `PackageJsonUpdater` | #132, #131, #133 | adopted in 3-A4 | `BunResolver` and `RootCatalog` read through `manifestParser`; `RootPackageJsonDocument` and `BunPackageJsonDocument` are deleted. `BunResolver` keeps the raw `packageManager` string rather than `PackageManager.FromString`: the drift report compares and rewrites that exact text, and a typed parse would newly fail on a non-Bun or malformed pin. The updaters edit through `PackageJsonFormat.modifyToString` (one read, write only when the bytes change), not `PackageJsonFile.modify`, which returns only the final text and would need a second read to report `changed`. Byte parity 193/193 on a `packageManager` edit except the one tab-indented manifest (the kit keeps tabs) and on a catalog-entry edit of every manifest with a `catalog`. `RootCatalog`'s bun.lock half is 3-A1's. |
| docgen `Version.ts`, `Configuration.ts:393` `PackageJsonSchema` | #307 | adopted in 3-A4 | Both read through `PackageJsonFile`'s presence-lenient `PackageManifest` tier: `Version.ts` (`readManifestVersion`) with `version` required on top (`version.toString()`), `Configuration.ts` with `name` and `homepage` required on top. 193/193 verdict parity. |
| observability `catalog/Catalog.names.ts` `PackageName` | #137 | adopted in 3-A9 | `ScopedPackageName`, re-annotated as the catalog owner name; the hand-rolled pattern and brand are gone. Parity: the old pattern and the new schema agree on all 2,407 distinct names in the tracked manifests and the root `bun.lock` (`ops/observability-package-name-parity.ts`, `research/observability-package-name-parity-3-a9.json`). npm-rule divergences (leading `-` in scope or name accepted, over 214 characters rejected) are pinned by inverted tests in `observability/test/Catalog.test.ts`. |
| mcpb-kit manifests and `ensureWindowsBindings` | #136 | excluded | Deferred to the npm driver. |
| m365-mcp and github test-only readers | - | excluded | Test fixtures; not worth the edge. |

## `@beep/repo-tsconfig` (wave 3-2, SPEC W3-c)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| repo-cli `Quality/EffectDiagnostics.ts` `buildProjects` and `effectDiagnosticsProjectConfig` (get-tsconfig `parseTsconfig`) | #158 | adopted (3-2) | `TsconfigLoader.resolve` / `.compilerOptions`; the local `EffectiveProjectConfig` schema is deleted. Inventory and every lspconfig string identical before and after. |
| repo-cli `test/test-tsgo-turbo-inputs.test.ts` build-reference walk | #158 | adopted (3-2) | `TsconfigLoader.resolve`. |
| repo-cli `internal/quality/TestTypecheckCoverage.ts` hand-rolled extends walk | #159 | adopted (3-2) | One tolerant `TsconfigLoader.resolve` per visited config (W3-m). Every package's uncovered set identical before and after. |
| repo-cli `Quality/CheckCensus.ts` `TsconfigReferences`, `TsconfigOutDir` (and the check-overlay `TsconfigSelection`) | #162 | adopted (3-A5) | `TsconfigLoader.load` for `references` and `include`/`exclude`, `TsconfigLoader.compilerOptions(ref)` for the inherited, absolutized `outDir`; the local schemas and the `jsonc-parser` import are deleted. Parity: 0 overlay and 0 declaration-index differences over 185 census packages and 1,273 references (`ops/check-census-adoption-parity.ts`), and the real census output before/after (`research/check-census-parity-3-a5.md`). |
| docgen `Configuration.ts` `readTSConfig`, `CLI.ts`, `Core.ts` | #160 | adopted (3-A6) | `readTSConfig` reads through `TsconfigValidator.compilerOptions` (the named file strict, the `extends` chain merged); `CompilerOptionsShape` is `S.toEncoded(ClosedCompilerOptions)`; `encodeExamplesTsconfig` (`TsconfigValidator.validate` + `StrictTsconfig` encode) replaces `encodeTSConfigPrettyEffect` in `Core.ts`. Resolved options identical for all 170 loaded `docgen.json`; 3 corpus verdict flips classified (D-56). |
| repo-utils `src/schemas/TSConfig.ts` and its test | #161, #242, #266 | deleted (3-A6) | 2,092 source and 473 test lines removed with the `src/index.ts` and `src/schemas/index.ts` exports; the strict semantics live in `TsconfigValidator` over the `@beep/tsconfig` closed views (no changeset: W4-i). No repo-cli file imported the module. |
| repo-cli `TsconfigSync/TsconfigSync.schemas.ts` | #164 | adopted in 3-A7 | `TsconfigSync.plan.ts` decodes all six tsconfig parse sites through `@beep/tsconfig/TsconfigJson` on the existing `decodeJsoncTextAs` path (not `TsconfigJsonFromString`, which would also swap the JSONC parser; that facade is R3a's). `TsconfigReferenceEntry`, `TsconfigCompilerOptionsPaths`, `TsconfigWithReferences` and `TsconfigWithPaths` are deleted; `JsonObject` stays for the docgen and Vitest-alias JSON reads. The strict kit is used whole: every tracked file whose basename matches `tsconfig*.json` decodes (666/666), so the kit-derived pick of wave-4 ruling 4 was not needed. Shifts, pinned in `tsconfig-sync.test.ts`: a non-string reference `path` and an invalid known `compilerOptions` value fail the file's parse instead of being skipped, an empty reference `path` fails it where `--write` used to repair it (root rewrite; package self-reference pruned), and a malformed root `compilerOptions.paths` value fails it instead of being repaired (canonical alias) or ignored. A tsconfig that adopts a TypeScript option value the kit's closed vocabularies lack fails the sync, so the kit is extended first (SPEC 3-A7 row). Byte parity: `ops/tsconfig-sync-parity.ts`, 13 mutations, `--dry-run --verbose` and `--write`, 0 differences (`research/tsconfig-sync-parity-3-a7.json` before, `-head.json` after). |
| repo-cli `Quality.command.ts` `resolveTsconfigInheritance` | #163 | excluded | A pure resolver over a pre-read map with branch semantics and exact diagnostics; the map ruled it partial. |
| repo-utils `src/TsConfig.ts` `collectTsConfigPaths` | #245 | excluded | Downward enumeration, a different capability. |
| repo-cli `KnowledgeDoctor.domain.ts` root `paths` projection | - | excluded (re-checked in 3-A5) | It decodes the root `tsconfig.json` from git tree bytes through `KnowledgeTreeOracle`, not from disk, and needs `paths` as written; `TsconfigLoader` reads the filesystem and absolutizes `paths`. |

## `@beep/md` syntax bridge (wave 2d-2, SPEC D-48 to D-51)

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| `@beep/md` `Md.model.ts`: no Markdown source parser | #237 | resolved in 2d-2 | `@beep/md/Md.syntax` `fromMarkdownDocument` folds the `@beep/markdown` tree into `Md.Document`; the unsupported-node policy is the `MdLossReason` taxonomy (D-48). `@beep/markdown` has no `@beep/md` import. |
| `@beep/md` `Md.ts`: write-side DSL with no parser | #290 | resolved in 2d-2 | Merged into #237: `@beep/md/Md.parse` parses text. `@beep/schema`'s Markdown-to-HTML path stays (excluded with #227 and #258, MQ7 cycle). |
| `@beep/md` merge design and hand-rolled frontmatter splitting | #259 | partly resolved in 2d-2 | Placement decided (D-02: parser in `@beep/markdown`, bridge in `@beep/md`) and the unsupported-node policy written (D-48). The frontmatter splitters are the 2d-A sites #37, #27, #276 and #231 above. |


## `@beep/semver` (roadmap R1, SPEC W4-h)

R1 is the owner switch. Parity is recorded in `research/semver-owner-switch-differential-r1.json`
(`ops/semver-owner-switch-differential.ts`, run on a clean tree at 41a03502f3 with the deleted module restored
from 6c0bb54d55 through `--old-module`): 0 unclassified differences in every section. That JSON is the only
record of the old-module section; a run without `--old-module` reports it `skipped` and proves nothing for it.
Docker differences are classified causally: the old strategy, re-run without the non-SemVer-core tags, must
pick what the kit picks.

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| `@beep/schema/Semver` (`Semver`, `SemverFromString`) | #41 | retired (R1) | Zero importers. Deleted with its test, both export entries, the root re-export and the generated aliases, catalog and inventory rows. 2,264 versions parse alike with the same format; 5,125,696 ordered pairs agree except 14 probe pairs where the old `localeCompare` disagrees with ASCII order (§11.4.2). The old loose normalization (`v1.2.3`, `1.2`) had no caller. |
| repo-cli VersionSync `BunResolver` `BunSemver` pattern and comparator | #42, #308 | adopted (R1) | One `SemVer.parseResult` after an optional leading `v` (no surrounding whitespace, no build metadata), then `SemVer.gte`; a property pins the `SemVer.gte` winner. 600,683 of 604,506 pairs pick the same pin; 3,436 involve a pin the kit rejects (leading zero, unsafe integer) and 387 differ only by the dropped leading `v` (the canonical pin written since c3260f33). `BunSemver` export removed (no importer). |
| repo-cli VersionSync `DockerResolver` triple parser, comparator and the duplicated latest-tag loops | #43, #308 | adopted (R1) | One exported `selectLatestDockerTag` over `SemVer`: stable, pinnable, first-listed wins among equal versions; a property pins the first tag holding the `SemVer.compare` maximum. 8,842 of 9,000 seeded tag lists agree; each of the other 158 goes away once its non-SemVer-core tags are removed. |
| `@beep/repo-configs` `CacheClientPin.version` inline regex | #46 | adopted (R1) | `SemVer.PinnableVersionString`. All 5 committed pins pass both; the 6 old-only accepts are leading zeros, an empty identifier and an unsafe integer. |
| repo-cli VersionSync `RootCatalog` bun.lock versions | #269 | 3-A1 | The lockfile half rides the lockfiles adoption; its Docker semver half is #43 above. |
| repo-utils `schemas/PackageJson.ts` version fields | #243 | adopted in 3-A3 | `version` is the kit `SemVer.FromString` and `packageManager` the kit `PackageManagerRange`; no tracked manifest changes verdict. |
| repo-cli `EffectResolver` `VERSION_SPECIFIER_PATTERN`, `TurboResolver` `STABLE_VERSION_PATTERN` | - | excluded | Shape checks on a specifier or schema URL; neither parses nor orders versions. |

## `@beep/jsonc` (roadmap R3a, SPEC W4-o)

R3a is the owner switch: every `@beep/schema/Jsonc` importer decodes through `Jsonc.bind(schema).decode`,
the facade is deleted and `@beep/schema` drops `jsonc-parser`. Parity is recorded in
`research/jsonc-owner-switch-differential-r3a-before.json` (the pre-switch code) and
`research/jsonc-owner-switch-differential-r3a.json` (`--compare`, `ops/jsonc-owner-switch-differential.ts`):
1,438 tracked JSONC and facade-consumed JSON documents decode equal under both parsers with 0 unclassified
differences and 1,438 kit encode round trips, and twelve generator check or dry runs against one fixed input
tree are byte-identical before and after. A fixed 42-case negative and edge corpus classifies every case
(`equal`, `both-reject`, `legacy-reject-kit-accept`, `legacy-accept-kit-reject`, `value-differs`) and
allowlists exactly three intended divergences by case id: BOM tolerance (the kit scanner treats U+FEFF as
whitespace), the 256-deep nesting cap (`NestingDepthExceeded` from `internal/limits.ts`) and JSON.parse
`__proto__` semantics (an own data property instead of a prototype assignment that dropped the key; no
adopted site merges a decoded object through `Object.assign`). The rejection message text changes from
`Invalid JSONC input (...)` to `JSONC parse failed with N error(s): ...`. The `jsonc-parser` editing facade
and its users leave in R3b.

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| `@beep/schema/Jsonc` (`JsoncTextToUnknown`, `decodeJsoncTextAs`, `JsoncParseDiagnostic`) | #1 | retired (R3a) | Deleted with its test, both export entries, the root barrel line, the generated aliases and the catalog, inventory and span rows. `decodeJsoncTextAs(X)` is `Jsonc.bind(X).decode`; `JsoncTextToUnknown` is `Jsonc.JsoncFromString`; `JsoncParseDiagnostic` is `JsoncParseErrorDetail` (neither had an importer outside the facade). |
| repo-cli `@beep/schema/Jsonc` importers (20 source files, 3 tests) and the root-barrel import in `KnowledgeDoctor.baseline.ts` | #255 | adopted (R3a) | `Jsonc.bind(schema).decode` at every site; `readArtifact`, `TsconfigSync.plan` `parseJsonc` and `readSealFile` keep their schema-generic signatures. `jsonc-parser` stays for the editing facade until R3b. |
| repo-cli `internal/cli/Jsonc.ts` `decodeJsoncTextAs` re-export (`ConfigUpdater`, `CreatePackage.command`, `TsconfigSync.plan`, `Quality/Tasks`) | #2 (decode half) | re-export removed (R3a) | The four callers import `@beep/jsonc` directly; the editing facade (`JsoncModification`, `applyJsoncModification`, `jsonText`) is R3b's. |
| `@beep/lint-rules` `test/registry.test.ts` Biome plugin config decode | - | adopted (R3a) | `Jsonc.bind(BiomePluginConfig).decode`; `@beep/jsonc` is a devDependency. |
| packet ops scripts `tsconfig-sync-parity.ts`, `lockfiles-adoption-parity.ts`, `package-json-readers-parity.ts` | - | adopted (R3a) | Same owner switch; their recorded reports are unchanged. |
| `@beep/utils/Schema` `TextDecodeTo` and `Jsonc.bind` `Codec`-view generics | - | kit extended (R3a) | Both are generic over the target schema (`Target extends S.Top`), so an `S.Opaque` class keeps its branded type; pinned in `jsonc/test/Jsonc.test.ts`. |
| `@beep/repo-configs` `AllowlistJsoncTextToUnknown` | #10 | queued: R3b | A copy of the facade's decode with its own error prefix; goes with the repo-configs `jsonc-parser` drop. |

## `@beep/commands` drivers (roadmap R9, SPEC W4-l)

R9 moves four drivers' hand-rolled child-process folds onto `@beep/commands`, each with the kit option the map
names, and retires the `effect-child-process-hardening` Exception Ledger row "Driver-local output folds" (D-03).
Parity: each driver's existing suite is unchanged and passes under Bun and Node, plus one reason-map test per
driver (`test/*.reason-map.test.ts`). Every reason-map case for a failure class the old fold could report also
passes against the old sources (the driver `src` restored from main); the only case that fails there is the
capture bound, which the old fold did not have.

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| exiftool `runProcess`, `collectText`, `ProcessResult` | #114 | adopted (R9) | `Run.collect`. A spawn or stream failure keeps the platform failure as the `ExiftoolError` cause (the kit's `CommandFailedError` is unwrapped); a non-zero exit keeps its message, exit code and trimmed streams. |
| pdf-tools `run`, `collectText` | #116 | adopted (R9) | `Run.collect` with `RunOptions.timeout` and `Run.extendEnv`; `forceKillAfter` stays on the command. Spawn and stream failures map to `tool-unavailable` with the platform message, a timeout to `tool-failed` with the old message and no cause, a non-zero exit to `tool-failed` with the trimmed stderr. |
| tailscale `readTailscaleStatus`, `runTailscaleCommand`, `collectStdout`/`collectStderr` | #298 | adopted (R9) | `Run.collect`; the outer `Effect.timeout` stays so the timeout cause is still a `TimeoutError`. The kit folds spawn and read failures into one `CommandFailedError` kind, so the driver splits them by the platform failure's `method`: a stream read or write, the exit wait or a kill (only possible once the handle exists) is an output error, and any other method (`spawn`, or the spawner's working-directory `access` check) a spawn error, as under the old fold. The exit error keeps the `stdoutLength`/`stderrLength` privacy projection. |
| obs `spawnObsDetached` | #299 | adopted (R9) | `Run.detach`, which unrefs before its scope closes; a spawn or unref failure keeps its platform failure as the `ObsError` cause. |
| Capture bound (all three `Run.collect` drivers) | - | new behaviour (R9) | Captured output is now bounded per stream, chosen per driver: exiftool passes `maxOutputBytes` 128 MiB (`-j` readTags batches), pdf-tools 256 MiB (`pdftotext -bbox-layout` XHTML on long PDFs), and tailscale keeps the kit's 16 MiB default (`DEFAULT_MAX_OUTPUT_BYTES`), since its status JSON and serve stderr are kilobytes. Each reason map reports the new `CommandOutputError` kind `tooLarge`: exiftool as its run failure, pdf-tools as `tool-failed`, tailscale as an output error. |

## `@beep/managed-section` templates (roadmap R8, SPEC W4-h)

R8 reads repo-cli's three marker-delimited generated regions through `@beep/managed-section`. Their markers predate
the package (`<!-- BEGIN GENERATED: ... -->`, `<!-- beep-models:begin <id> -->`), so the kit gains
`LiteralMarkerDialect` and `SectionMarkers` (fixed per-key spellings) instead of a one-time marker migration, and every
generated surface renders byte for byte as before. Parity: `ops/managed-section-adoption-parity.ts` fingerprinted the
surfaces on main (`research/managed-section-adoption-parity-r8-before.json`) and after the switch
(`research/managed-section-adoption-parity-r8.json`): the Observability standard, the Atlas plus 92 README
projections and 7 Models blocks are identical, and the 8 probe shifts are each classified.

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| repo-cli `Observability/Observability.render.ts` `spliceStandardSection` and the marker constants | #90, #260, #311 | adopted (R8) | The standard is a `LiteralMarkerDialect` document; the splice is `parseResult` + `reconcile`, the markers are `beginMarker`/`endMarker`. Shifts: a duplicated or mid-line marker is `None`, a CRLF standard stays CRLF, trailing blanks after a marker are dropped on rewrite. |
| repo-cli `Explore/Atlas.ts` README status marker counting and splicing | #89, #311 | adopted (R8) | The Status section is scanned as a `LiteralMarkerDialect` document; `generatedMarkerCountsAreValid` and the in-loop marker tracking are deleted, and so is the function's `fallow-ignore` complexity suppression. Shift: a marker line with trailing blanks or a doubled inner space is read as a marker and rewritten canonically (witnessed by the parity report's `atlas` probes and `test/managed-section-adoption.test.ts`). |
| repo-cli `Models/Models.render.ts` `extractGeneratedBlock`, `generatedBlockBegin`, `generatedBlockEnd` | #260 | adopted (R8) | One `LiteralMarkerDialect` per block id; the markers render through `CommentStyle.comment`. Shifts: a duplicated block, a mid-line marker and an id outside the section-key grammar read as no block; a CRLF body reads with LF line endings. The manifest's `blockId` is a `SectionKey`, so a malformed id fails at decode rather than as `missing-locator`. |
| stale second copies of three generated blocks: `.claude/skills/browser-qa-loop/SKILL.md` and `resources/judge-prompt.md` (`qa-judge`), `docs/runbooks/graft-local-recovery.md` (`graft-deep`) | - | fixed (R8) | Each file carried an identical second block that `models check` never read (the old `indexOf` read the first). The switch reads a duplicate as no block, so the copies are deleted; the judge prompt's copy sat after its own "nothing after that line" rule. `skills-lock.json` takes the new browser-qa-loop tree hash. |
| `@beep/managed-section` `SectionDialect` | - | extended (R8) | `SectionMarkers`, `LiteralMarkerDialect`, `CommentStyle.comment` and the internal `spellings`/`literalMatchers` hooks. The ruled dialect's wire form and behaviour are unchanged (its existing tests pass untouched). |
| repo-cli `CreatePackage/internal/LabIdentitySegment.ts` | #88 | excluded | Unchanged by R8; see the excluded row below. |
| repo-cli `Yeet/internal/GhOps.ts` | #281 | follow-up goal (W4-l) | Unchanged by R8. |

## Root test shim onto `@beep/glob` (roadmap R2a, SPEC W4-p)

R2a is a matcher swap and a dependency drop in the root `vitest.setup.ts` Bun shim. Parity is recorded in
`research/glob-shim-census-r2a.json` (the census: 16 patterns over 66,959 tracked paths and directories at
f77a32de6d, picomatch 4.0.7 beside `@beep/glob` `GlobPattern` with `dot: true, nocomment: true`, each side a
count and sha256) and explained in `research/glob-shim-census-r2a.md`; `ops/glob-shim-census.ts` rebuilds the
universe from that tree and recomputes the kit side, 16/16 identical to the record from any head. The five `new Bun.Glob` literals and every vitest glob match the same
set under both engines; the three trailing-`/**` probes differ, and real `Bun.Glob.match` agrees with the kit
on every witness. `packages/tooling/tool/cli/test/vitest-bun-glob-shim.test.ts` pins `match` and `scanSync`
on Bun (native) and Node (shim).

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| `vitest.setup.ts` `GlobShim.match` (picomatch) | #60 | adopted (R2a) | `GlobPattern.compileResult` once per shim instance under `GlobPatternOptions.make({ dot: true, nocomment: true })` (Bun reads a leading `#` literally); a guard trip throws from the constructor with the `GlobPatternError` message and cause. The walker and the shim class stay. Found and fixed alongside: `scanSync` listed directories by default, Bun defaults `onlyFiles` to `true`. |
| root `package.json` `toml` devDependency and catalog entry, `Bun.TOML` shim | #234 | dropped (R2a) | No reader of `Bun.TOML` in the repo (`@beep/ai-sync` and repo-cli parse TOML with `effect/encoding/Toml`; `@beep/toml` is the kit). `toml@5.0.1` leaves `bun.lock`. |
| root `package.json` `picomatch` and `@types/picomatch` devDependencies and catalog entries | #235 | dropped (R2a) | `picomatch@4.0.7` stays in `bun.lock` only as a `vite`, `tinyglobby` and `fdir` transitive; `@types/picomatch@4.0.3` leaves it. |
| The six `new Bun.Glob(...)` callers (`Cache.command.ts`, `MatchPerson.ts`, three repo-cli tests, effect-drizzle `import-boundary.test.ts`) | - | out of scope (W4-p) | They keep calling `Bun.Glob`; the shim serves them on Node. |

## `yaml` out of repo-cli and repo-ai-metrics (roadmap R4, SPEC W4-h)

The map rows flip in the roadmap table below (#24, #26, #28-#30, #32-#36, #229, #256, #285, #304). Sites the map did not list:

| Site | Map id | Status | Notes |
| --- | --- | --- | --- |
| repo-cli `Research/internal/Vault.ts` `renderCard` | - | adopted (R4) | Renders card frontmatter through `@beep/yaml` `Yaml.stringify` (`indentSequences: true, quoteStyle: "auto"`) and returns an `Effect` (the kit stringifier has a typed error channel; `CatalogOps.persistCards` yields it). Byte parity over the operator vault's 4,159 decodable cards and the 24-case edge corpus: all identical, 0 unclassified (`research/yaml-drop-parity-r4.json`). `auto` is the new `@beep/yaml` quote style below. |
| repo-cli `Quality/ChangesetGraph.ts` `changesetPackageReferencesFromText` (the YAML half of #27) | #27 | adopted (R4) | The changeset frontmatter parses with `effect/encoding/Yaml` `parse` instead of `yaml` `parseDocument(...).toJSON()`; a parse failure is a `ChangesetGraphError` with the file and the message "Invalid changeset frontmatter in <file>: <cause>" (`test/changeset-graph.test.ts` pins both). Parity over the 9-shape frontmatter corpus: 8 identical, 1 `both-reject`; the per-file reference fingerprints and the `beep quality changeset-graph` output match the baseline (`research/yaml-drop-parity-r4.json`). |
| `@beep/yaml` `QuoteStyle` `"auto"` | - | new (R4) | The plain-scalar fallback picks the quote per value like the `yaml` npm package's default (`singleQuote: null`): single quotes for a value holding `"` and no `'`, double otherwise, and an interior tab stays plain (or literal inside single quotes). `fallbackQuoteStyle` in `internal/stringifier.ts` is the one rule; `YamlFormat` `requoteScalars` uses it per scalar. Expected strings in `test/Yaml.test.ts` were authored offline against `yaml@2.9.1`; an offline 40,000-value fuzz against that package found 0 differences. It is what makes the three R4 writers byte-identical. |
| repo-cli `test/models-manifest-config-file.test.ts` | - | adopted (R4) | The W3-e parity oracle reads through `effect/encoding/Yaml` (an independent reader) instead of `yaml` `parseDocument(...).toJS()`; the retired-role fixtures are written with `@beep/yaml` `Yaml.stringify` in the `yaml` npm layout (`indentSequences: true, quoteStyle: "auto"`), the shape a manifest already on disk has. |
| repo-cli `test/support/WorkflowYaml.ts` | - | new (R4) | `parseWorkflowYaml` (`effect/encoding/Yaml`) and `yamlAt` (a `getIn`-shaped path read), shared by the three CI policy suites. |
| `goals/effected-promotion/ops/yaml-drop-parity.ts` | - | new (R4) | The R4 oracle; it keeps `yaml` for its frozen legacy copies (goals/ is outside the drop proof). |

## Backfill of the remaining map sites (R0, W4-k)

Every confirmed and partial site of the map that had no row above (the earlier `2d-later` rows now carry their plan PR or exclusion too), so each one is migrated, queued under a
PR id of the wave-4 plan's PR sequence (`research/wave-4-plan-2026-10-23.md`), or excluded with a reason. Each
PR flips its own rows. Rows whose status the plan does not name were assigned from the map's prerequisite column.
200 rows: 30 migrated, 89 queued on a plan PR,
33 handed to the W4-l follow-up goal, 4 deferred with their module (W4-m) and 44 excluded.
A row naming two PRs is split between them; #143 also appears above for its package.json half.

### Migrated in waves 1b to 2c

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| test-utils `MemoryFileSystem` engine | #214 | partial | migrated (1b, D-07, D-25) | `@beep/test-utils/MemoryFileSystem` is retired; the engine is `@beep/memfs`. |
| test-utils test MemoryFileSystem | #215 | partial | migrated (1b, D-07, D-25) | The vendored engine suites left with the engine; memfs carries the conformance suites. |
| repo-cli test | #216 | partial | migrated (1b, D-25) | Imports `@beep/memfs` (one of the 17 packages D-25 moved). |
| repo-utils test | #217 | partial | migrated (1b, D-25) | Imports `@beep/memfs` (one of the 17 packages D-25 moved). |
| repo-utils | #309 | partial | migrated (2b-1); 4-A3 | Walker half done (`findRepoRoot`); the workspaces half is 4-A3's. |
| repo-utils FsUtils.ts | #54 | partial | migrated (2b-1, D-31) | `findNearestPackageDir` on `@beep/walker`; `walkFiles`/`globFiles` retired in 2c (D-37). |
| repo-utils Root.ts | #55 | confirmed | migrated (2b-1, D-31) | `findRepoRoot` on `Walker.ascend`/`findUpward`, signature and `NoSuchFileError` kept. |
| repo-utils TSMorph/TSMorph.service.ts | #56 | confirmed | migrated (2b-1, D-31) | `resolveFileEntrypointTsConfig` on `Walker.ascend`. |
| repo-cli Quality/internal/TestTsgoPrograms.ts | #63 | partial | migrated (2b-1, D-31) | Segment-aware containment on `Walker.findUpward`. |
| repo-cli Drawings/Drawings.review.ts | #64 | confirmed | migrated (2b-1, D-31) | `Drawings.review` on `@beep/walker`. |
| repo-utils Root.ts, FsUtils.ts (findNearestPackageDir) | #265 | partial | migrated (2b-1, D-31) | `findRepoRoot` on `Walker.ascend`/`findUpward`, signature and `NoSuchFileError` kept. |
| repo-cli package.json | #72 | partial | migrated (2b-2, D-34) | `@beep/github` replaced `@effected/github` in one atomic swap. |
| repo-cli internal/github | #73 | confirmed | migrated (2b-2, D-34) | `@beep/github` replaced `@effected/github` in one atomic swap. |
| root package.json | #225 | confirmed | migrated (2b-2, D-34) | `@effected/github` left the root catalog and `bun.lock`. |
| repo-cli internal/github/GithubRest.ts, GithubGraphql.ts and siblings | #246 | confirmed | migrated (2b-2, D-34) | `@beep/github` replaced `@effected/github` in one atomic swap. |
| chalk internal/SupportsColor.ts | #190 | partial | migrated (2b-3, D-33) | chalk `SupportsColor` reads `@beep/runtime-env/ColorLevel`; colour precedence per D-33. |
| chalk internal/SupportsColor.ts, colors support | #273 | partial | migrated (2b-3, D-33) | chalk `SupportsColor` reads `@beep/runtime-env/ColorLevel`; colour precedence per D-33. |
| utils Glob.ts | #52 | partial | migrated (2c, D-37) | `@beep/utils/Glob` retired onto `@beep/glob` + `@beep/walker`. |
| utils package.json | #53 | confirmed | migrated (2c, D-37) | The utils glob dependency left with `Glob.ts`. |
| schema Glob/Glob.schema.ts | #58 | partial | migrated (2c, D-37) | `@beep/schema/Glob` retired. |
| utils Glob.ts | #228 | partial | migrated (2c, D-37) | `@beep/utils/Glob` retired onto `@beep/glob` + `@beep/walker`. |
| utils Glob.ts | #241 | partial | migrated (2c, D-37) | `@beep/utils/Glob` retired onto `@beep/glob` + `@beep/walker`. |
| utils Glob.ts, schema Glob | #264 | partial | migrated (2c, D-37) | `@beep/utils/Glob` retired onto `@beep/glob` + `@beep/walker`. |
| utils Glob.ts | #280 | partial | migrated (2c, D-37) | `@beep/utils/Glob` retired onto `@beep/glob` + `@beep/walker`. |

### Wave 3 adoptions (3-3, 3-A1)

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| docgen Configuration.ts | #11 | confirmed | migrated (3-3, W3-e) | docgen `readJsoncFile` onto `ConfigFile.read`. |
| repo-cli Quality/CatalogUsage.ts | #129 | partial | queued: 3-A1 | `CatalogUsage` onto `@beep/lockfiles` with `ResolvedPackage.installName`. |
| repo-cli VersionSync/internal/resolvers/RootCatalog.ts | #155 | partial | queued: 3-A1 | `RootCatalog` bun.lock half onto `Lockfile.parse`; no `CatalogSet` for one catalog. |
| repo-cli Quality/CatalogUsage.ts | #156 | partial | queued: 3-A1 | `CatalogUsage` onto `@beep/lockfiles` with `ResolvedPackage.installName`. |
| repo-cli Quality/CatalogUsage.ts | #233 | partial | queued: 3-A1 | `CatalogUsage` onto `@beep/lockfiles` with `ResolvedPackage.installName`. |
| repo-cli VersionSync/internal/resolvers/RootCatalog.ts | #289 | partial | queued: 3-A1 | `RootCatalog` bun.lock half onto `Lockfile.parse`; no `CatalogSet` for one catalog. |
| repo-cli VersionSync/internal/resolvers/RootCatalog.ts | #269 | partial | queued: 3-A1 | Lockfile half with 3-A1; the Docker semver half is #43, migrated in R1. |

### Wave 4 promotions and adoptions (4-X, 4-X-A, 4-C, 4-C-A, 4-A1 to 4-A4)

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| repo-cli Quality/internal/QualityArtifactSupport.ts | #143 | partial | adopted (4-A1) | Workspaces half: QAS discovery onto `WorkspaceDiscovery`, discovery only, kit `containWithinRoot` plus a `resolvePathWithinCanonicalRoot` guard (the `@beep/repo-workspaces` row above has the parity; the package.json half is 3-A4's row above). |
| repo-cli Quality/Tasks.ts | #146 | partial | adopted (4-A2) | `workspaceTaskOwners` reads `WorkspacePatterns.read(repoRoot)`; `coverageGraphClosure` still needs a name-keyed adjacency constructor (excluded below). |
| repo-cli CreatePackage/CreatePackage.command.ts | #148 | partial | adopted (4-A2) | `WorkspacePatterns.fromManifest` over the root manifest it edits; the copied `applyJsoncModification` wrapper and its suppression are gone. |
| repo-cli TsconfigSync/TsconfigSync.plan.ts | #149 | partial | adopted (4-A2) | Canonical syncpack sources from `WorkspacePatterns.read(rootDir)`; `readRootPackageJson` and the copied wrapper are gone. |
| repo-cli Quality/ChangesetGraph.ts | #150 | partial | adopted (4-A2) | `collectWorkspacePackageJsonFiles` reads `WorkspacePatterns.read(repoRoot)`; `readChangesetGraphRootPatterns` is gone. |
| repo-utils Workspaces.ts | #139 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils DependencyIndex.ts | #142 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils Workspaces.ts | #238 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils Dependencies.ts | #239 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils Workspaces.ts, Dependencies.ts, Graph.ts | #268 | partial | queued: 4-A3 | Umbrella of #238, #239 and #240; `Graph.ts` is not retargeted. Counted there. Since 3-A3 the inputs are `HashMap` (`WorkspaceDeps` buckets, manifest maps) and #240 is deleted. |
| repo-cli Lint/EcosystemPolarity.ts | #154 | partial | adopted (4-A4) | `sourceViolations` scans each member `src` through `SourceBoundary.scan` from `@beep/repo-workspaces/SourceBoundary` (`forbidImports: ["@beep/*"]`, the lint's extensions); `Offence` converts to `EcosystemPolarityViolation` at the boundary. The ts-morph walk (`isSourceFile`, `collectSourceFiles`, `literalSpecifier`, `collectSourceViolations`, the `Project`) is deleted; ts-morph stays for its other repo-cli importers. Parity: `ops/ecosystem-polarity-differential.ts` over the live repo and a synthetic ecosystem (16 scenarios), baseline `research/ecosystem-polarity-differential-4-a4.json`, head `...-4-a4-head.json`: 102 differences, all in the five intended classes, 0 unclassified. Inverted tests in `test/ecosystem-polarity.test.ts`: position order, declaration files skipped, literal line for a multi-line call, template heads not read (accepted in SPEC 2026-10-28 W4-f, 4-A4 part, with a guard over every live member `src`), declaration files skipped (same row, same guard shape), `node_modules` and symlink cycles skipped. |
| ai-metrics agent-effectiveness.ts | #197 | partial | queued: 4-C | `Fmt.stripControls` (W4-d) replaces the private sanitizer. |
| repo-cli Accounts/Accounts.view.ts | #205 | partial | queued: 4-C | `fit`/`fitRight` onto `Fmt.truncate`/`Fmt.width`, pinned by a CJK and emoji row (A4). |
| repo-cli bin-main.ts | #199 | partial | migrated (4-C-A) | `CliRuntime.main` in `bin-main.ts`/`FailureRendering.ts`, EPIPE latching kept (L1). |
| repo-cli internal/cli/FailureRendering.ts | #200 | partial | migrated (4-C-A) | The `render` hook for `CliRuntime.main`; `shouldRenderFailureCause` stays as its verbosity switch (L1). |
| repo-cli Skills/SkillsReview.service.ts | #209 | partial | migrated (4-C-A) | `CliPrompt.gateTerminal` in SkillsReview (L2). |
| repo-cli test session-continuity.test.ts | #210 | partial | migrated (4-C-A, partial) | One `TestTerminal` swap in `accounts-usage.test.ts`; the session-continuity stubs stay (they fail on unexpected input as an assertion). |
| repo-cli internal/state/WorkstationState.ts | #167 | partial | queued: 4-X | `resolveWorkstationStateDir` onto `@beep/xdg` (W4-c named importer). |
| m365-mcp OutboxConfig.ts | #180 | partial | queued: 4-X | `OutboxConfig` `stateRoot` onto `@beep/xdg` (W4-c named importer). |
| ai-metrics forwarder.ts | #176 | partial | migrated (4-X-A) | ai-metrics `forwarder.ts`/`data-root.ts` onto `@beep/xdg`. |
| repo-cli Files/internal/MatchPerson.ts | #178 | partial | migrated (4-X-A) | `MatchPerson` cache root after the `--cache-dir` branch; Windows branch kept. |
| apps | #310 | partial | migrated (4-X-A) | apps docket-intake and practice-m365-contacts; practice-mail-tagging excluded (#183). |
| repo-cli internal/state/WorkstationState.ts, BeepCacheRoot | #261 | partial | migrated (4-X; 4-X-A) | `WorkstationState` in 4-X; `BeepCacheRoot` and the Config-combinator sites in 4-X-A. |

### Roadmap PRs (R1 to R10)

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| schema Semver.ts | #41 | confirmed | migrated (R1, W4-h) | `@beep/schema/Semver` deleted; the Duplicate semver model row is closed. Migrated in R1; see the `@beep/semver` section above. |
| repo-cli VersionSync/internal/resolvers/BunResolver.ts | #42 | confirmed | migrated (R1, W4-h) | BunResolver `BunSemver` onto `@beep/semver` (a leading `v` stripped first). Migrated in R1; see the `@beep/semver` section above. |
| repo-cli VersionSync/internal/resolvers/DockerResolver.ts | #43 | partial | migrated (R1, W4-h) | DockerResolver `semverCompare` onto `@beep/semver` (`selectLatestDockerTag`). Migrated in R1; see the `@beep/semver` section above. |
| repo-configs cache/Cache.policy.ts | #46 | confirmed | migrated (R1, W4-h) | `Cache.policy.ts` version pin onto `SemVer.PinnableVersionString`. Migrated in R1; see the `@beep/semver` section above. |
| repo-cli VersionSync/internal/resolvers | #308 | partial | migrated (R1, W4-h) | BunResolver `BunSemver` onto `@beep/semver` (a leading `v` stripped first). Migrated in R1; see the `@beep/semver` section above. |
| repo-cli Skills/internal/MergeBase.ts | #103 | partial | migrated (R10, W4-l) | `readAtMergeBase` over `Git.mergeBase` + `Git.show`; a failed read other than "absent at the merge-base" is now a typed `SkillsCommandError`, never `None`. Parity: `research/git-adoption-differential-r10.json`. |
| repo-cli internal/repo-run/GitWorktree.ts | #104 | partial | migrated (R10, W4-l) | `isRegisteredWorktree` onto `Git.worktreeList`, `removeGitWorktree` onto `Git.worktreeRemove` (option-like paths refused); prune stays a single capture call (no kit prune member). Parity: `research/git-adoption-differential-r10.json`. |
| repo-cli Yeet/internal/ProvenanceFooter.ts | #108 | partial | migrated (R10, W4-l) | Both config reads onto `Git.configGet`. Not `Git.remoteUrl`: `git remote get-url` applies `url.*.insteadOf` rewrites, the old `config --get` read did not. The `rev-parse HEAD` read stays on the Yeet git layer (#101, follow-up goal). Parity: `research/git-adoption-differential-r10.json`. |
| repo-cli internal/repo-run/GitExec.ts | #100 | partial | dead collectors deleted (R10); follow-up goal (W4-l) | R10 deleted `collectDirtyPaths` and `collectChangedPathsSinceBase` (no importer: `git grep -w` outside `goals/` hit only their definitions and the generated instrumentation catalog). The parsers wait for kit gaps (follow-up goal). |
| vitest.setup.ts | #60 | partial | adopted (R2a, W4-p) | `GlobShim.match` compiles through `@beep/glob` `GlobPattern` (`dot: true`); the shim class and walker stay for Node runs of Bun-targeted suites. See the root test shim section above. |
| root package.json | #234 | partial | dropped (R2a) | `toml` and its `Bun.TOML` shim left the root manifest and catalog; nothing in the repo read `Bun.TOML`. |
| root package.json | #235 | partial | dropped (R2a) | `picomatch` and `@types/picomatch` left the root manifest and catalog; `picomatch@4.0.7` stays in `bun.lock` as a vite, tinyglobby and fdir transitive. |
| repo-cli internal/GlobPattern.ts | #57 | partial | adopted in R2b | `internal/GlobPattern.ts` is deleted; its six callers (`Docgen/internal/JsDocAnalysis.ts`, `Docgen/internal/quality/Quality.subjects.ts`, `Quality/internal/JSDocDocumentationInventory.ts`, `Quality/internal/CoverageScope.ts`, `Quality/Tasks.ts`, `Cache/Cache.census.ts`) match through `@beep/glob` `GlobPattern` compiled with `dot: true, nonegate: true, nocomment: true`, the dialect the old `*`/`**` compiler had. Config and static patterns compile with `Result.getOrThrow` (a guard trip is a wiring defect); a coverage selector the compiler rejects resolves to `None`, and a Turbo env entry it rejects is a `CacheCommandError`. `escapeRegexChar` is gone: `Quality.subjects.ts` and `Quality.rubric.ts` escape through `effect/RegExp` `escape`. Parity: `ops/glob-adoption-parity.ts`, `research/glob-adoption-parity-r2b.json`: 1,449,249 live (pattern, candidate) pairs on the merged tree (284,086 + 696,672 + 467,686 + 805, the glob-bearing coverage selectors included once the oracle's Option-returning `A.filterMap` was corrected) plus 40 synthetic `!`/`#` prefix pairs, 0 disagreements; the `dialectMagic` section pins the characters that were literal to the old compiler and are magic to minimatch (`?`, `[..]`, `{a,b}`, `+(..)`, `\`, in-segment `**`), none of which a live pattern uses. TestTypecheckCoverage's tsc matcher stays (it translates tsconfig `include` entries, not globs). |
| repo-cli Laws/EffectImports.ts | #59 | partial | adopted in R2b | Discovery is two exported steps (`discoverEffectImportSourceFiles`, `discoverEffectImportMarkdownFiles`) on `@beep/walker` `compileAndExpand` per include pattern (name-shaped exclusions pruned, path-shaped ones matched through `@beep/glob` under the mode's dot dialect, symbolic links dropped as tinyglobby dropped them). `tinyglobby` leaves the repo-cli manifest and the root catalog. Parity: `research/glob-adoption-parity-r2b-before.json` (with the three full lists under `research/glob-adoption-parity-r2b-before-lists/`) and `research/glob-adoption-parity-r2b.json`: the markdown-mode source set (1,272) is byte-identical; the Markdown (8,538 to 8,591) and code (8,657 to 8,686) sets differ only by paths the repository gained or lost between `ed0c4ec45e` and HEAD (classified through `--baseline-tree`) plus exactly one walker shift, a PNG under a Playwright `__screenshots__/<name>.test.ts/` folder that tinyglobby matched by its parent directory's name; 0 unclassified. Closes the Exception Ledger row "Duplicate glob matching". |
| repo-cli internal/GlobPattern.ts, internal/quality/TestTypecheckCoverage.ts | #263 | partial | adopted in R2b | `internal/GlobPattern.ts` is deleted (see #57). TestTypecheckCoverage's tsc matcher stays: it mirrors tsgo's `include` semantics (a bare directory is a recursive subtree), which no glob dialect expresses. |
| repo-cli internal/GlobPattern.ts | #305 | partial | adopted in R2b | `internal/GlobPattern.ts` is deleted (see #57). |
| repo-cli Knowledge/KnowledgeDoctor.leases.ts, Skills/Skills.patches.ts CODEOWNERS compilers | (none) | partial | excluded (R2b) | Not a map site; found by the R2b `git grep '[^/]*'` owner census. `globTokens`/`globSource`/`codeownersPattern` implement the gitignore/CODEOWNERS dialect: a slash anywhere anchors the pattern to the root, a trailing slash matches only below a directory, and a matched directory owns everything under it. `@beep/glob` has no spelling for directory ownership or slash-anchoring, the same reason #263 keeps the tsc `include` matcher. The two copies are identical; their deduplication into one repo-cli internal module is a defect outside R2b's files (KnowledgeDoctor is R5a's). |
| schema Jsonc.ts | #1 | confirmed | migrated (R3a, W4-o) | `@beep/schema/Jsonc` deleted; every importer decodes through `Jsonc.bind`. See the `@beep/jsonc` section above. |
| schema Jsonc.ts and the repo-cli jsonc facade | #255 | partial | owner switch migrated (R3a, W4-o); `jsonc-parser` drop queued: R3b | The decode owner is `@beep/jsonc` (see the section above); the editing facade's `jsonc-parser` leaves in R3b. |
| repo-cli internal/cli/Jsonc.ts | #2 | partial | re-export removed (R3a); editing facade queued: R3b | R3a removed the `decodeJsoncTextAs` re-export (W4-o); the sync editing facade moves onto `JsoncModifier`/`JsoncFormatter` in R3b. |
| repo-cli internal/cli/Json.ts | #3 | partial | queued: R3b | The five Skills `format`+`applyEdits` copies collapse onto `JsoncFormatter` behind `Json.ts`. |
| repo-cli Skills/Skills.render.ts | #4 | partial | queued: R3b | The five Skills `format`+`applyEdits` copies collapse onto `JsoncFormatter` behind `Json.ts`. |
| repo-cli Models | #5 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-cli Knowledge/Knowledge.refs.ts | #6 | confirmed | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-cli Lint/Lint.command.ts | #7 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-cli Quality | #8 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-cli Laws/AllowlistCheck.ts | #9 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-configs internal/laws/EffectLawsAllowlist | #10 | confirmed | queued: R3b | repo-configs `EffectLawsAllowlist` onto `Jsonc.JsoncFromString`. |
| repo-cli test | #12 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| root package.json | #13 | partial | queued: R3b | Root catalog entry and devDependency removed last. |
| repo-cli | #226 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-cli | #274 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-cli Skills/ | #284 | partial | queued: R3b | The five Skills `format`+`applyEdits` copies collapse onto `JsoncFormatter` behind `Json.ts`. |
| repo-cli src | #306 | partial | queued: R3b | Part of the repo-cli-wide `jsonc-parser` removal. |
| repo-cli VersionSync/internal/updaters/YamlFileUpdater.ts | #24 | partial | adopted in R4 | `updateYamlValue` reads the current value through `@beep/yaml` `YamlDocument.parse` and writes with `YamlFormat.modifyToString`, which splices only the target scalar (the old `parseDocument` + `setIn` + `toString` re-rendered the whole file: flow collections respaced, long scalars folded at 80 columns). When the kit cannot splice (an insertion of a missing key, or a block, multi-line, tagged or anchored target) the updater re-serializes with `indentSequences: true, quoteStyle: "auto"`, the `yaml` npm layout; `test/version-sync-yaml-updater.test.ts` pins an insertion beside an indented `ports` list. `replaceNodeVersionWithFile` removes and inserts a key, which re-serializes the document under both writers, with the same options. A parse failure is now a `VersionSyncError` instead of an edit on an error-bearing document. Parity: `research/yaml-drop-parity-r4.json` (20 `updateYamlValue` cases, 14 `byte-minimal` and 6 identical; 2 `replaceNodeVersionWithFile` cases, 1 `byte-minimal`, 1 `document-rerender` with every comment kept) and `test/version-sync-yaml-updater.test.ts`. |
| repo-cli Quality/FallowQuality.command.ts | #26 | confirmed | adopted in R4 | `yamlDocumentValue` parses workflow YAML with `effect/encoding/Yaml` `parse`; a parse failure keeps the "Invalid workflow YAML <file>: <cause>" message (exit code 1). Parity: every tracked `.github/**` workflow and action file parses to the same value (`research/yaml-drop-parity-r4.json`, 18/18). |
| repo-cli Models/Models.manifest.service.ts | #28 | partial | adopted in R4 | The writer renders through `@beep/yaml` `Yaml.stringify` with `indentSequences: true, quoteStyle: "auto"` (the `yaml` npm layout); `load` was 3-3's. Byte parity over the operator manifest and `seedModelsManifest`: both identical (`research/yaml-drop-parity-r4.json`). |
| repo-cli Models/Models.locator.service.ts | #29 | partial | adopted in R4 | Not kept: the kit's composed AST carries the node styles and spans it needs. `readYamlPath` reads `YamlDocument.parseAll` (one document only), walks the composed AST with a short-circuiting check (block maps with plain keys, non-block scalars, no anchor, tag, sequence or alias, no diagnostics; it stops at the first unsupported node) and takes the key ranges from the nodes' `offset`/`length` in one descent along the path. `@beep/yaml/YamlVisitor` is not used: it re-composes the text into a `Stream` of events, while `parseAll` has already composed the document, so a recursive predicate over those nodes is the direct check. Parity: 429/429 identical against a frozen copy of the old reader (the unsupported-form corpus, the fixture and every leaf path of the repository YAML inputs, `research/yaml-drop-parity-r4.json`). |
| repo-cli Runners/Runners.service.ts | #30 | confirmed | adopted in R4 | `checkBakeManifest` parses `infra/ci-runners/Pulumi.production.yaml` with `effect/encoding/Yaml` `parse`; both Pulumi stack files parse to the same value (`research/yaml-drop-parity-r4.json`). |
| ai-metrics compose.ts | #32 | confirmed | adopted in R4 | `renderAiMetricsLocalPhoenixCompose` renders through `@beep/yaml` `Yaml.stringify` (`indentSequences: true, quoteStyle: "auto"`), a serialization failure mapped to `AiMetricsInstallConfigurationError`; byte-identical for the default local spec (`research/yaml-drop-parity-r4.json`). `@beep/repo-ai-metrics` gains `@beep/yaml` as a workspace dependency. |
| repo-cli package.json | #33 | partial | dropped in R4 | `yaml` leaves the repo-cli dependencies after every src and test site moved; `@beep/repo-ai-metrics` drops it too. It stays only as an oracle devDependency of `@beep/yaml` and `@beep/config-file`, with its root catalog entry. |
| repo-cli test ci-runner-security.test.ts | #34 | partial | adopted in R4 | Workflow and action files parse through `test/support/WorkflowYaml.ts` (`effect/encoding/Yaml` `parse`, `yamlAt` path reads in place of `getIn`/`toJS`); matrix lanes and trigger maps decode through `S.decodeUnknownEffect`. |
| repo-cli test ci-lane.test.ts | #35 | partial | adopted in R4 | `parseWorkflowYaml` and `yamlAt` from `test/support/WorkflowYaml.ts` replace `parseDocument(...).getIn`. |
| repo-cli test ci-rerun-runner-loss.test.ts | #36 | confirmed | adopted in R4 | `parseWorkflowYaml` and `yamlAt` replace `parseDocument(...).toJS()` property chains. |
| repo-cli | #229 | partial | adopted in R4 | Every repo-cli `yaml` importer moved (#24, #26, #28, #29, #30, #34, #35, #36, plus `Quality/ChangesetGraph.ts`, `Research/internal/Vault.ts` and `test/models-manifest-config-file.test.ts`, see the R4 section); `git grep` finds no `yaml` import or dependency left in repo-cli. |
| repo-cli Quality/FallowQuality.command.ts, Models and other yaml sites | #256 | partial | adopted in R4 | Same switch as #26, #28 and #29; the other yaml site, `Research/internal/Vault.ts` `renderCard`, is in the R4 section. |
| repo-cli | #285 | partial | adopted in R4 | Same switch as #229. |
| ai-metrics | #304 | partial | adopted in R4 (yaml half); follow-up goal (W4-l) | The yaml half moved in R4 (#32); the git half goes with the gh/git follow-up goal. |
| effect-drizzle scripts/assemble-readme.ts | #92 | confirmed | migrated (R5b, W4-h) | `FrontmatterSource.split` replaces the local frontmatter stripper; `@beep/markdown` as a devDependency only. Migrated in R5b; see the `@beep/markdown` section above. |
| repo-cli Explore/Atlas.ts | #89 | partial | migrated (R8, W4-h) | Explore Atlas onto `@beep/managed-section` with byte-identical round trips. Migrated in R8; see the `@beep/managed-section` section above. |
| repo-cli Observability/Observability.render.ts | #90 | partial | migrated (R8, W4-h) | Observability render onto `@beep/managed-section`. Migrated in R8; see the `@beep/managed-section` section above. |
| repo-cli Models/Models.render.ts, Observability/Observability.render.ts | #260 | partial | migrated (R8, W4-h) | Models.render and Observability splice sites. Migrated in R8; see the `@beep/managed-section` section above. |
| repo-cli commands | #311 | partial | migrated (R8, W4-h) | Observability and Atlas halves; LabIdentitySegment is excluded (#88). Migrated in R8; see the `@beep/managed-section` section above. |
| exiftool Exiftool.service.ts | #114 | confirmed | migrated (R9, W4-l) | `Run.collect`; `ProcessResult`, `collectText` and the scoped spawn block deleted, `ProcessExitCode` kept. Migrated in R9; see the `@beep/commands` drivers section above. |
| pdf-tools PdfTools.service.ts | #116 | confirmed | migrated (R9, W4-l) | `Run.collect` with `RunOptions.timeout` and `Run.extendEnv`; `collectText` and the hand-rolled timeout deleted. Migrated in R9; see the `@beep/commands` drivers section above. |
| drivers tesseract, poppler, exiftool, pdf-tools, onepassword-cli, tailscale, ffmpeg, openclaw | #253 | partial | migrated (R9, W4-l); excluded | Umbrella, split: the R9 part (exiftool, pdf-tools, obs, tailscale) is migrated; the remainder stays excluded below (#115, #117 to #122, #283), each waiting for its named kit option, so this row is not done as a whole. |
| drivers | #278 | partial | migrated (R9, W4-l); excluded | Umbrella, split: the R9 part (exiftool, pdf-tools, obs, tailscale) is migrated; the remainder stays excluded below (#115, #117 to #122, #283), each waiting for its named kit option, so this row is not done as a whole. |
| tailscale Tailscale.service.ts | #298 | partial | migrated (R9, W4-l) | `Run.collect` for both runners; `collectStdout`/`collectStderr` and both spawn blocks deleted, the `stdoutLength` privacy projection kept. Migrated in R9; see the `@beep/commands` drivers section above. |
| obs Obs.service.ts | #299 | confirmed | migrated (R9, W4-l) | `Run.detach` (the map's named option); the scoped spawn-then-unref block deleted. Migrated in R9; see the `@beep/commands` drivers section above. |

### Wave 5 (`@beep/github-actions`)

W5 moves the whole lab module into `packages/drivers/github-actions` and adopts it in repo-cli: the `ci` commands
publish their runner files through `ActionOutputs` over `CiRunnerOutputsLive` (`Ci/CiRunnerOutputs.ts`, an
`ActionEnvironment` seeded from the current `ConfigProvider`). Parity: `test/ci-runner-outputs.test.ts`,
`test/ci-heavy-admission.test.ts`, `test/ci-rerun-runner-loss.test.ts` and `test/ci-command.test.ts`; the `ci job-env`
end-to-end suite in `test/ci-runner-security.test.ts` reads the new blocks unchanged.

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| repo-cli Ci/CiOperational.service.ts | #87 | confirmed | adopted in W5 | The runner-resources warning is `WorkflowCommand.warning` (`@beep/github-commands`); bytes pinned identical. |
| repo-cli Ci/CiOperational.service.ts | #93 | partial | adopted in W5 | `ci job-env` writes `GITHUB_ENV` through `ActionOutputs.exportVariable` (derived heredoc delimiter instead of a random `beep_ci_env_<uuid>`; the entries the runner reads are pinned equal, adversarial values included; one deviation: the old command appended every block in one write, the new one appends one block per entry in order, so an I/O failure partway leaves the earlier entries in `GITHUB_ENV`. Every name is a fixed constant that passes the name check, so only a runner-file write can fail there, and that fails the step, so no later step reads the partial file; the single append was not atomic against a short write either) and `ci runner-resources` appends its summary through `ActionOutputs.summary`. Excluded: `ci change-profile` keeps its two `key=value` `GITHUB_OUTPUT` lines, which its end-to-end tests and `check.yml` pin byte for byte. |
| repo-cli Ci/Ci.command.ts | #94 | partial | adopted in W5 | `ci append-turbo-summary` appends through `ActionOutputs.summary` and prints to stdout off a runner; the append is pinned byte-identical to the old read-then-write (`${previous}${rendered}`). |
| repo-cli Ci/CiAdmission.ts | #95 | partial | adopted in W5 | `ci admission --github-output` publishes `verdict`, `admitted`, `docs_only`, `sources` with `ActionOutputs.set`; `heavyAdmissionGithubOutputs` is the pure projection that replaces the `key=value` renderer, and the entries the runner reads are pinned equal to the old lines. `CiAdmissionInput.githubOutputPath` becomes `githubOutput`. |
| repo-cli Ci/CiRerunRunnerLoss.ts | #96 | partial | adopted in W5 | The decision summary appends through `ActionOutputs.summary`; the tests use the `ActionOutputs.recording()` double and pin the summary bytes to the printed report. `CiRerunRunnerLossInput.stepSummaryPath` becomes `stepSummary`. |
| repo-cli Ci/CiOperational.service.ts, Ci/HeavyAdmission (runner files) | #271 | partial | adopted in W5 | Covered by #93 and #95 above; the `change-profile` `key=value` lines are the recorded exclusion. |
| repo-cli Ci | #312 | partial | adopted in W5 | Umbrella for #87 and #93..#96, all adopted; `reportCiCommandError` is now one shared reporter for the `ci` subcommands. |
| `@beep/github` `makeTest` doubles (18 resource modules) | - | confirmed | consolidated in W5 (W4-w) | The driver's own unstubbed helper (`UnstubbedError`, target, access and member kinds, shape builder) is folded into `@beep/utils/TestDouble`, which becomes the one owner of the concept: one `UnstubbedMemberError` raised both by `unstubbed` (an `Effect` that dies) and by `unstubbedFor` (a synchronous throw), with `unstubbedShapeFor` building a whole double. Messages are unchanged; the defect tag in five coverage suites reads `UnstubbedMemberError`. The github-only `scopedStoreMembers` record stays in `@beep/github/internal/scopedStoreMembers`. |

### Follow-up goal: repo-cli gh/git consolidation (W4-l)

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| repo-cli Reviewer/GitHubAppAuth.ts | #74 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Reviewer/ReviewerService.ts | #75 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Reviewer/ReviewerRuleset.ts | #76 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/github/GithubGraphql.ts | #77 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/Status.ts | #78 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/WatchMode.ts | #79 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/MergeGate.ts | #80 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/closeout/GhCollect.ts | #81 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/Reply.ts | #82 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/github/GhCommand.ts | #83 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/github/GithubRest.ts | #84 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Skills/Skills.command.ts | #85 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/GitExec.ts | #101 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/repo-run/ChangedFiles.ts | #102 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Worktree/Worktree.schemas.ts | #105 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Worktree/Fleet.service.ts | #106 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| ai-metrics config-snapshot.ts | #107 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Knowledge/KnowledgeDoctor.grouping.ts | #110 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Knowledge/KnowledgeDoctor.service.ts | #111 | partial | follow-up goal (W4-l) | Needs `Git.isAncestor` in the kit (W4-l; the plan's R10 deferral). |
| repo-cli commands (per-group git wrappers) | #112 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Reviewer/GitHubAppAuth.ts | #124 | partial | follow-up goal (W4-l) | Reviewer App-auth spawns; travels with #74 in the gh/git consolidation goal. |
| repo-cli test  (and driver/app tests) | #125 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |
| repo-cli Reviewer/ReviewerRuleset.ts, ReviewerService.ts | #247 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Ci/LaneTimings.ts | #248 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Ci/CiGovernance.ts, Ci/CiRerunRunnerLoss.ts (GitHub reads) | #249 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet gh-CLI surface (PullRequest, Planner, MergeGate and others) | #250 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli `GitExec.ts` and the Yeet git helper layer | #251 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli typed git wrappers (Codex Security, Session and others) | #252 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli test | #279 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |
| repo-cli Yeet/internal/GhOps.ts | #281 | partial | follow-up goal (W4-l) | GhOps splicer; R8 hands it to the follow-up goal. |
| test-utils | #291 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |
| tailscale test tailscale.test.ts | #300 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |
| repo-cli Reviewer | #303 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |

### Deferred modules (W4-m)

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| nlp-mcp bin.ts | #195 | partial | deferred (W4-m) | `engine` ProcessGuard; trigger consumer: an MCP server ProcessGuard. |
| repo-cli Accounts/Accounts.tui.ts | #206 | partial | deferred (W4-m) | `cli/ui*` stays in the lab until C; trigger consumer: the Accounts TUI. |
| repo-cli Files/Files.progress.ts | #208 | partial | deferred (W4-m) | `cli/ui*` stays in the lab until C; trigger consumer: the Accounts TUI. |
| mcpb-kit internal/steps.ts | #295 | partial | deferred (W4-m) | npm registry/publish half; trigger consumer: the mcpb-kit tarball. |

### Excluded, with reasons

| Site | Map id | Verdict | Status | Notes |
| --- | --- | --- | --- | --- |
| repo-cli internal/schema/TextCodec.ts | #14 | partial | excluded | Already on `effect/encoding/Toml` and `effect/encoding/Yaml` (D-12 upstream-first); no npm dependency to drop. |
| ai-sync validation.ts | #15 | confirmed | excluded | Already on `effect/encoding/Toml` (D-12); no npm dependency to drop. |
| repo-cli Skills/Skills.command.ts | #16 | partial | excluded | Parse is on `effect/encoding/Toml`; the edits need kit TOML ops (append array-of-tables, insert table, absent-path guard) that no wave plans. |
| law-practice-server internal/Jsonl.ts | #18 | partial | excluded | Needs a schema-typed JSONL row reader/appender in `@beep/jsonl` (kit gap). |
| repo-cli internal/repo-run/AttemptTerminationJournal.ts | #20 | partial | excluded | Needs a schema-typed JSONL row reader/appender in `@beep/jsonl` (kit gap). |
| repo-cli HarnessLedger/internal/LedgerFiles.ts | #21 | partial | excluded | Needs a schema-typed JSONL row reader/appender in `@beep/jsonl` (kit gap). |
| repo-cli internal/schema/TextCodec.ts | #25 | partial | excluded | Already on `effect/encoding/Toml` and `effect/encoding/Yaml` (D-12 upstream-first); no npm dependency to drop. |
| docgen Core.ts | #38 | partial | excluded | docgen writes two `_config.yml` scalars with no YAML dependency; outside R4's repo-cli and ai-metrics scope. |
| repo-cli Skills/Skills.schemas.ts | #48 | partial | excluded | Optional tightening; needs a string-preserving SPDX schema in `@beep/spdx` (kit gap). |
| mcpb-kit McpbKit.models.ts | #49 | partial | excluded | Optional tightening; needs a string-preserving SPDX schema in `@beep/spdx` (kit gap). |
| apps oip-web content/OipSeo.ts | #50 | partial | excluded | Needs LegalService, WebSite and Place node classes in `@beep/schema-org` (kit gap). |
| apps oip-web app/page.tsx | #51 | partial | excluded | Needs LegalService, WebSite and Place node classes in `@beep/schema-org` (kit gap). |
| repo-cli Quality/Tasks.ts | #62 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| ai-metrics config-snapshot.ts | #66 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| repo-cli Purge/Purge.command.ts | #67 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| box scripts/generate.ts | #68 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| apps practice-identify runtime/Layer.ts | #69 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| repo-cli Cache/Cache.command.ts | #71 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| repo-cli CreatePackage/internal/LabIdentitySegment.ts | #88 | partial | excluded | LabIdentitySegment (R8 excludes it): needs a one-time `packages.ts` marker migration and identity-registry changes. |
| ffmpeg FFmpeg.service.ts | #115 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| onepassword-cli OnePasswordCli.service.ts | #117 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| openclaw internal/spawn.ts | #118 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| ai-provider-cli AiProviderCli.service.ts | #119 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| tesseract Tesseract.service.ts | #120 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| poppler Poppler.service.ts | #121 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| tika Tika.tikaapp.ts | #122 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| repo-utils schemas/BiomeJson.ts | #123 | partial | excluded | repo-utils would take a `@beep/commands` driver edge for one Biome probe. |
| repo-cli Quality/internal/CoverageScope.ts | #145 | partial | excluded | Needs `DependencyGraph.fromAdjacency` and an origin-tracking reverse closure (kit gap); 4-A1 only changes its discovery input. |
| repo-cli internal/tsmorph/OwnerResolver.ts | #151 | partial | excluded | Needs a pure synchronous owner index from `@beep/repo-workspaces` (kit gap). |
| apps practice-mail-tagging PracticeMailTagging.config.ts | #183 | partial | excluded | Would make a deployed practice service start honouring XDG (4-X correction 6). |
| repo-cli internal/cli/Progress.ts | #192 | partial | excluded | The sync callers would have to become effectful first. |
| repo-cli Knowledge/Knowledge.service.ts | #198 | partial | excluded | Uses `@beep/observability` `sanitizeSensitiveText` plus local patterns; not a W4-d adopter. |
| docgen Core.ts | #202 | partial | excluded | cli-kit L3: a docgen output change and a changeset for a cosmetic swap. |
| law-practice-server test DocumentIdentification/Identification.adapters.test.ts | #222 | confirmed | excluded | Test-only hand-built FileSystem double; not in any wave plan (low value). |
| docgen test Configuration.test.ts | #224 | confirmed | excluded | Test-only hand-built FileSystem double; not in any wave plan (low value). |
| repo-cli Models/Models.spans.ts | #230 | partial | excluded | Parse is on `effect/encoding/Toml`; the edits need kit TOML ops (append array-of-tables, insert table, absent-path guard) that no wave plans. |
| repo-utils UniqueDeps.ts | #240 | confirmed | deleted in 3-A3 | Dead public export with no consumer: deleted outright with its test, barrel lines, integration case and lint-rules allowlist row, not adopted. |
| repo-cli Models/Models.spans.ts (+ Models.locator) | #257 | partial | excluded | Parse is on `effect/encoding/Toml`; the edits need kit TOML ops (append array-of-tables, insert table, absent-path guard) that no wave plans. |
| apps oip-web content/OipSeo.ts, apps/oip-web/src/app/page.tsx | #272 | partial | excluded | Needs LegalService, WebSite and Place node classes in `@beep/schema-org` (kit gap). |
| libpff Libpff.pffexport.ts | #283 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| ai-metrics internal/jsonl-discovery.ts | #293 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| mcpb-kit internal/steps.ts | #294 | partial | excluded | mcpb-kit is deferred with the npm driver (#136); the switch also needs a platform layer. |
| codegen-kit internal/format.ts | #296 | partial | excluded | Optional; needs a tooling/library to driver edge decision for codegen-kit. |
| ai-provider-cli AiProviderCliSession.profile.service.ts | #302 | partial | excluded | A fixed string template with no TOML dependency; low value. |
