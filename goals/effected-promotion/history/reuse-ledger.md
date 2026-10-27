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
| repo-cli `Quality/internal/QualityArtifactSupport.ts` `discoverWorkspacePackages` | #143 | 4-A1 | Discovery onto `WorkspaceDiscovery`, discovery only, with a `resolvePathWithinRoot` post-filter (the kit keeps upstream link-following). Exception Ledger "Duplicate workspace discovery and dependency graph". |
| repo-cli `workspacePatternsFrom` copies (`ChangesetGraph`, `CreatePackage`, `TsconfigSync.plan`, `ConfigUpdater`, `Quality/Tasks.ts`) | #146, #148, #149, #150 | 4-A2 | Through a public `WorkspacePatterns` leaf (`internal/patterns` today). |
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
| repo-cli `bin-main.ts` `renderCliFailure` and `internal/cli/FailureRendering.ts` | #199, #200 | 4-C-A | `CliRuntime.main`, keeping the `Stdout.ts` EPIPE latching (W4 plan correction 8, L1). |
| repo-cli `Skills/SkillsReview.service.ts` raw `Prompt.run` | #209 | 4-C-A | `CliPrompt.gateTerminal` with `CliInteractive` (L2). |
| repo-cli test `Terminal.make` stubs (`session-continuity.test.ts`, `accounts-usage.test.ts`) | #210 | 4-C-A, partial | The one `accounts-usage.test.ts` stub (about line 937) moves to `TestTerminal`; the session-continuity stubs assert that input is never read, which `TestTerminal` would turn into queued input, so they stay with that reason. |
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
| docgen `readTSConfig` and the `@beep/schema/Jsonc` consumers | - | excluded here | `readTSConfig` moves with the `TsconfigValidator` in 3-A6; the `@beep/schema/Jsonc` consumers belong to the jsonc adoption (Exception Ledger "Duplicate JSONC model"). |
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
| repo-cli `Quality/ChangesetGraph.ts` frontmatter fence | #27, #276 (fence part) | adopted (2d-A, D-47) | `FrontmatterSource.split`; the YAML and schema block stays. Parity 912 of 1,044; the other 132 are empty blocks with no references either way. |
| skill-contract `SkillProjection.ts` `---json` splitter | #231 | adopted (2d-A, D-47) | `FrontmatterSource.split` with format `json`, plus an import-closure assertion that the block parser stays out. |
| repo-cli `Goals/Inventory.ts` README regexes | #287 | adopted (2d-A, D-47) | `MarkdownDocument.parseResult` with `firstSection`, `sectionByHeading` and `headingSource` (root-level H1, D-47); pin the `---json`, `<Goal Title>` and list-interrupt shifts. |
| repo-cli DeletePackage `stripPackageFromFrontmatter` | #276 | queued: R5a | Split, `YamlFormat.modifyToString`, join. The substring bug was fixed independently in #2020. |
| ReflectionArtifact and SkillFrontmatterCheck typed frontmatter | #37 | queued: R5a | `MarkdownFrontmatter.schema` with `YamlFrontmatter`; verdict parity over 302 reflections and 44 skills. |
| docgen `@effect/markdown-toc` | #292 | queued: R5b | Needs a GitHub slugger and a TOC renderer; drops the npm dependency. |
| effect-drizzle `scripts/assemble-readme.ts` | - | queued: R5b | After the TOC helper; `@beep/markdown` as a devDependency only (ecosystem polarity). |
| docgen `fencePattern` and its consumers, EffectImports, SchemaTagIdioms | #282 | queued: R6 (or deferred per W4-q) | Needs code-node spans and an unterminated-fence diagnostic; zero JSDoc-ratchet drift. |
| repo-cli Knowledge.refs, KnowledgeDoctor, RoadmapRefs | #232 | excluded (W4-r) | Behind a perf budget: a full parse costs about 400 times the line split. Prefilter fence-bearing files and re-benchmark. |
| repo-cli KnowledgeDoctor `beep-historical` frontmatter | - | queued: R5a | `FrontmatterSource`. |
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
| repo-cli `Quality/CheckCensus.ts` `TsconfigReferences`, `TsconfigOutDir` | #162 | 3-A5 | `TsconfigLoader.compilerOptions(ref)` gives the inherited, absolutized `outDir`; prove census output parity. |
| docgen `Configuration.ts` `readTSConfig`, `CLI.ts`, `Core.ts` | #160 | 3-A6 | `TsconfigLoader.compilerOptions` plus `TsconfigValidator`; after 3-3 and 3-A4 (shared `Configuration.ts`). |
| repo-utils `src/schemas/TSConfig.ts` and its test | #161, #242, #266 | 3-A6 | Deleted once docgen uses the validator; needs the `@beep/tsconfig` closed view and its changeset. |
| repo-cli `TsconfigSync/TsconfigSync.schemas.ts` | #164 | 3-A7 | A pure-model site (`@beep/tsconfig`); needs byte parity of tsconfig-sync output. |
| repo-cli `Quality.command.ts` `resolveTsconfigInheritance` | #163 | excluded | A pure resolver over a pre-read map with branch semantics and exact diagnostics; the map ruled it partial. |
| repo-utils `src/TsConfig.ts` `collectTsConfigPaths` | #245 | excluded | Downward enumeration, a different capability. |
| repo-cli `KnowledgeDoctor.domain.ts` root `paths` projection | - | candidate | Re-check with 3-A5. |

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
| repo-utils `schemas/PackageJson.ts` version fields | #243 | 3-A3 | Re-based on `@beep/package-json`, which already types versions through `@beep/semver`. |
| repo-cli `EffectResolver` `VERSION_SPECIFIER_PATTERN`, `TurboResolver` `STABLE_VERSION_PATTERN` | - | excluded | Shape checks on a specifier or schema URL; neither parses nor orders versions. |

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
| repo-cli Quality/internal/QualityArtifactSupport.ts | #143 | partial | queued: 4-A1 | Workspaces half: QAS discovery onto `WorkspaceDiscovery`, discovery only, `resolvePathWithinRoot` post-filter (the package.json half is 3-A4's row above). |
| repo-cli Quality/Tasks.ts | #146 | partial | queued: 4-A2 | Tasks pattern reader; `coverageGraphClosure` needs a name-keyed adjacency constructor. |
| repo-cli CreatePackage/CreatePackage.command.ts | #148 | partial | queued: 4-A2 | Pattern reader through the public `WorkspacePatterns` leaf. |
| repo-cli TsconfigSync/TsconfigSync.plan.ts | #149 | partial | queued: 4-A2 | Pattern reader through the public `WorkspacePatterns` leaf. |
| repo-cli Quality/ChangesetGraph.ts | #150 | partial | queued: 4-A2 | Pattern reader through the public `WorkspacePatterns` leaf. |
| repo-utils Workspaces.ts | #139 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils DependencyIndex.ts | #142 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils Workspaces.ts | #238 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils Dependencies.ts | #239 | partial | queued: 4-A3 | repo-utils Workspaces/Dependencies/DependencyIndex onto the kit. |
| repo-utils Workspaces.ts, Dependencies.ts, Graph.ts | #268 | partial | queued: 4-A3 | Umbrella of #238, #239 and #240; `Graph.ts` is not retargeted. Counted there. |
| repo-cli Lint/EcosystemPolarity.ts | #154 | partial | queued: 4-A4 | `EcosystemPolarity` onto `SourceBoundary.scan` from `@beep/repo-workspaces/testing`. |
| ai-metrics agent-effectiveness.ts | #197 | partial | queued: 4-C | `Fmt.stripControls` (W4-d) replaces the private sanitizer. |
| repo-cli Accounts/Accounts.view.ts | #205 | partial | queued: 4-C | `fit`/`fitRight` onto `Fmt.truncate`/`Fmt.width`, pinned by a CJK and emoji row (A4). |
| repo-cli bin-main.ts | #199 | partial | queued: 4-C-A | `CliRuntime.main` in `bin-main.ts`/`FailureRendering.ts`, EPIPE latching kept (L1). |
| repo-cli internal/cli/FailureRendering.ts | #200 | partial | queued: 4-C-A | `CliRuntime.main` in `bin-main.ts`/`FailureRendering.ts`, EPIPE latching kept (L1). |
| repo-cli Skills/SkillsReview.service.ts | #209 | partial | queued: 4-C-A | `CliPrompt.gateTerminal` in SkillsReview (L2). |
| repo-cli test session-continuity.test.ts | #210 | partial | queued: 4-C-A | One `TestTerminal` swap in `accounts-usage.test.ts`; the session-continuity stubs stay (they fail on unexpected input as an assertion). |
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
| repo-cli Skills/internal/MergeBase.ts | #103 | partial | queued: R10 | `readAtMergeBase` over `Git.mergeBase` + `Git.show`. |
| repo-cli internal/repo-run/GitWorktree.ts | #104 | partial | queued: R10 | Worktree list and remove onto `@beep/git`; prune stays a single capture call. |
| repo-cli Yeet/internal/ProvenanceFooter.ts | #108 | partial | queued: R10 | Config reads onto `Git.configGet`/`Git.remoteUrl`. |
| repo-cli internal/repo-run/GitExec.ts | #100 | partial | queued: R10; follow-up goal (W4-l) | R10 deletes the dead `GitExec.ts` collectors; the parsers wait for kit gaps (follow-up goal). |
| vitest.setup.ts | #60 | partial | queued: R2a | `GlobShim` matches through `@beep/glob`; the shim class stays (W4-p). |
| root package.json | #234 | partial | queued: R2a | `toml` and its `Bun.TOML` shim leave the root. |
| root package.json | #235 | partial | queued: R2a | `picomatch` and `@types/picomatch` leave the root. |
| repo-cli internal/GlobPattern.ts | #57 | partial | queued: R2b | `internal/GlobPattern.ts` onto `@beep/glob`; TestTypecheckCoverage's tsc matcher stays. |
| repo-cli Laws/EffectImports.ts | #59 | partial | queued: R2b | `tinyglobby` out of `EffectImports.ts` (closes Duplicate glob matching). |
| repo-cli internal/GlobPattern.ts, internal/quality/TestTypecheckCoverage.ts | #263 | partial | queued: R2b | `internal/GlobPattern.ts` onto `@beep/glob`; TestTypecheckCoverage's tsc matcher stays. |
| repo-cli internal/GlobPattern.ts | #305 | partial | queued: R2b | `internal/GlobPattern.ts` onto `@beep/glob`; TestTypecheckCoverage's tsc matcher stays. |
| schema Jsonc.ts | #1 | confirmed | queued: R3a | Importers re-point to `@beep/jsonc`; `schema/src/Jsonc.ts` is deleted (W4-o). |
| schema Jsonc.ts and the repo-cli jsonc facade | #255 | partial | queued: R3a; R3b | Owner switch in R3a, `jsonc-parser` drop in R3b. |
| repo-cli internal/cli/Jsonc.ts | #2 | partial | queued: R3b | `internal/cli/Jsonc.ts` stays a sync facade without the `decodeJsoncTextAs` re-export (W4-o). |
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
| repo-cli VersionSync/internal/updaters/YamlFileUpdater.ts | #24 | partial | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli Quality/FallowQuality.command.ts | #26 | confirmed | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli Models/Models.manifest.service.ts | #28 | partial | queued: R4 | Stringify half; `load` is 3-3's. |
| repo-cli Models/Models.locator.service.ts | #29 | partial | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli Runners/Runners.service.ts | #30 | confirmed | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| ai-metrics compose.ts | #32 | confirmed | queued: R4 | ai-metrics `compose.ts`, its only `yaml` importer. |
| repo-cli package.json | #33 | partial | queued: R4 | The repo-cli `yaml` dependency drops after every src and test site moves. |
| repo-cli test ci-runner-security.test.ts | #34 | partial | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli test ci-lane.test.ts | #35 | partial | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli test ci-rerun-runner-loss.test.ts | #36 | confirmed | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli | #229 | partial | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli Quality/FallowQuality.command.ts, Models and other yaml sites | #256 | partial | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| repo-cli | #285 | partial | queued: R4 | `yaml` out of repo-cli (Runners onto `effect/encoding/Yaml`; Models.locator kept with a reason if the kit lacks a visitor). |
| ai-metrics | #304 | partial | queued: R4; follow-up goal (W4-l) | The yaml half is R4's (#32); the git half goes with the gh/git follow-up goal. |
| effect-drizzle scripts/assemble-readme.ts | #92 | confirmed | queued: R5b | effect-drizzle README script after the TOC helper, `@beep/markdown` as a devDependency only. |
| repo-cli Explore/Atlas.ts | #89 | partial | queued: R8 | Explore Atlas onto `@beep/managed-section` with byte-identical round trips. |
| repo-cli Observability/Observability.render.ts | #90 | partial | queued: R8 | Observability render onto `@beep/managed-section`. |
| repo-cli Models/Models.render.ts, Observability/Observability.render.ts | #260 | partial | queued: R8 | Models.render and Observability splice sites. |
| repo-cli commands | #311 | partial | queued: R8 | Observability half; LabIdentitySegment is excluded (#88). |
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
| repo-utils UniqueDeps.ts | #240 | confirmed | excluded | Dead public export with no consumer: deleted outright, not adopted (3-A3 touches the file for HashMap). |
| repo-cli Models/Models.spans.ts (+ Models.locator) | #257 | partial | excluded | Parse is on `effect/encoding/Toml`; the edits need kit TOML ops (append array-of-tables, insert table, absent-path guard) that no wave plans. |
| apps oip-web content/OipSeo.ts, apps/oip-web/src/app/page.tsx | #272 | partial | excluded | Needs LegalService, WebSite and Place node classes in `@beep/schema-org` (kit gap). |
| libpff Libpff.pffexport.ts | #283 | partial | excluded | One of the 8 partial R9 drivers; each waits for its named kit option (map prerequisite). |
| ai-metrics internal/jsonl-discovery.ts | #293 | partial | excluded | Optional walker shrink not in any wave plan; the walker gate (D-31) was met by the 2b-1 adopters. |
| mcpb-kit internal/steps.ts | #294 | partial | excluded | mcpb-kit is deferred with the npm driver (#136); the switch also needs a platform layer. |
| codegen-kit internal/format.ts | #296 | partial | excluded | Optional; needs a tooling/library to driver edge decision for codegen-kit. |
| ai-provider-cli AiProviderCliSession.profile.service.ts | #302 | partial | excluded | A fixed string template with no TOML dependency; low value. |
