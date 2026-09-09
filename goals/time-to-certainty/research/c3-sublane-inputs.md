# C3 sublane input census

Static archaeology of the current `ttc/c3-package-tasks-grill` worktree, 2026-09-08. Only this report was written; no quality lanes, Git commands, installs, or generators were executed. Citations are repository-relative `path:line` anchors. UNKNOWN denotes a remaining evidence gap, not a safe omission from Turbo inputs. Native-tool defaults are not inferred from custom entry globs.

## Compact summary

| Lane | Established shape / cache caveat | Related workspace manifests |
| --- | --- | ---: |
| `lint:deprecated-apis` | typed; shards; cache | 0 |
| `lint:jsdoc` | syntax; root CLI path | 0 |
| `knowledge:semantic-delta` | GIT + environment; repo | 0 |
| `knowledge:refs-check` | GIT; tracked HEAD | 0 |
| `lint:schema-first` | typed; inventory + tests | 0 |
| `lint:terse-effect` | AST; law-specific scope | 0 |
| `lint:native-runtime` | AST; law-specific scope | 0 |
| `lint:frozen-grant-set` | AST; law-specific scope | 0 |
| `lint:effect-fn` | AST; law-specific scope | 0 |
| `lint:effect-imports` | currently no-op; enabled path maps exports | 0 |
| `lint:effect-imports-markdown` | Markdown + foundation inputs | 0 |
| `lint:identity-registry` | workspace census + src | 0 |
| `lint:circular` | two TS source roots | 0 |
| `lint:package-test-imports` | tests; global owner manifests | 2 |
| `lint:package-test-typecheck` | manifest coverage; separate compiler task | 140 |
| `lint:tsgo-rules` | root config + installed README | 0 |
| `lint:oxlint` | binary-default walk; exclusions | 0 |
| `lint:ecosystem-polarity` | ecosystem members | 0 |
| `lint:allowlist` | entry-target files + snapshot | 0 |
| `lint:jsdoc-module-tags` | GIT tracked files; 4 extensions | 0 |
| `goals:doctor` | GIT + time + packet evidence | 0 |
| `goals:index-check` | goal manifests + projection | 0 |
| `lint:reflection-artifacts` | goal reflections + manifests | 0 |
| `lint:roadmap-refs` | roadmap + dynamic link targets | 0 |
| `lint:judge-rubric` | prompt + lens schema | 0 |
| `lint:typos` | text; binary-default walk | 0 |
| `doctest` | runtime; affected GIT | 0 |
| `knip` | Git info/exclude + graph/plugins | 0 |
| `fallow:audit` | hosted GIT; native graph | 0 |
| `fallow:dead-code` | hosted GIT; native graph | 0 |
| `fallow:health` | hosted GIT; native graph | 0 |
| `fallow:boundaries:check` (root script; hosted task is `//#fallow:boundaries:config-check`, see the section note) | manifest + native source graph | 0 |
| `jsdoc-ratchet` | GIT inventory; baseline compare | 0 |
| `changeset-status` | GIT diff + changesets | 0 |
| `config-sync:check` | workspace config graph | 0 |
| `version-sync` | network by default; fixed files | 0 |
| `topo-sort` | workspace manifests | 0 |
| `docs:aggregate` | generated docs input/output | 1 |
| `repo-sanity` | GIT + network composite | 0 |

## Common input and counting conventions

A scanner's **selected diagnostic corpus is not necessarily its complete read set**: TypeScript configuration discovery, module/export resolution, manifests, directory existence, shared rule code and binary plugin configuration can widen reads. Never use an `entry` list as the whole graph input declaration. These are static findings, not an OS-level file-access trace.

All source-executed CLI lanes require the CLI implementation and transitive workspace runtime helper code to invalidate changes to rules. Conservatively hash `$TURBO_ROOT$/packages/tooling/tool/cli/src/**`, the used repo-utils/repo-configs/schema/utils/identity source and package manifests, root `package.json`, `bun.lock`, `bunfig.toml` and compiler configuration required by execution. Narrow that closure only with additional import-graph proof. Installed dependency content is only represented by the lockfile under a reproducible install; local installed package patches/changes are otherwise an additional input. `BEEP_ESLINT_PROFILE` must be represented in task env. Working directory matters: current CLI laws resolve root-relative globs against process.cwd(); placing the same command in a package does not automatically make it package-scoped.

`findRepoRoot` tests `.git`/`bun.lock` markers rather than running Git (`packages/tooling/library/repo-utils/src/Root.ts:21`). This is distinguished from reading refs, history or index. A YES Git lane is not a pure file-input hash as currently invoked. Network responses, wall time and caches also need separate treatment. `^transit` propagates a dependency graph; it is not itself proof that declarations have been built or every dependency read is hashed.

Workspace script counts below use `rg --files --hidden packages apps infra -g package.json -g '!**/node_modules/**' -g '!**/.git/**'`, retaining `packages/**/package.json`, `apps/**/package.json`, and only `infra/package.json`, then parse `scripts`. Counts are distinct manifest files with a lane-related script key or explicit command token (generic `lint`/`check` wrappers are not automatically counted). Fixtures inside the requested prefixes are included if they define such a script. Root scripts are counted separately. Exact matches are listed per lane for auditability.

## lint:deprecated-apis

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:516`; ESLint `node_modules/.bin/eslint`, `eslint.config.mjs` profile `deprecated-apis`.
- **Source scan roots / tests:** Exactly the hardcoded shard prefixes reproduced in appendix B; within them `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/**/*.ts` from `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:18`. Tests included except generated/declaration/type-test exclusions reproduced in appendix B.
- **Config / policy reads:** `eslint.config.mjs`, `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts`, both imported profile modules and their dependencies; package/root `tsconfig*.json` including extends/references; `package.json` exports/types and dependency declarations. See Q2.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** `node_modules/.cache/eslint-deprecated-apis/.eslintcache-<shard with / replaced by __>`; `--cache --cache-strategy content` in `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:485`.
- **Type-awareness / dependency prerequisite:** **Typed**: `@typescript-eslint/no-deprecated: error`, `parserOptions.projectService` with root default project and allowDefaultProject exceptions. `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:103`. Needs resolved dependency types; use `^transit` if workspace resolution uses built declarations, otherwise hash dependency source/types. Not proven that every package resolves dist.
- **Per-package scoping today:** Repo-only; command has no file/package selector. Hardcoded shards; no include flag on the wrapper.
- **Existing scripts:** root: `lint:deprecated-apis` = `beep-cli lint deprecated-apis` (`package.json:386`). Related workspace manifest count: **0**.

**ESLint default file selection:** in addition to the profile TS globs, ESLint default config selects `**/*.js`, `**/*.mjs`, `**/*.cjs` within the passed shard directories (`node_modules/eslint/lib/config/default-config.js:21`). These can be parsed/read even though the typed policy rules target TS. Include them in a conservative read census.

## lint:jsdoc

- **Entry point:** `bunx eslint . --max-warnings=0`; `eslint.config.mjs:5` selects default `docs`.
- **Source scan roots / tests:** `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/**/*.ts` TSDoc syntax layer; extra JSDoc requirements on `packages/tooling/*/*/src/**/*.ts` and `src/index.ts`. Tests included by broad syntax layer; specialized tooling rule excludes internal/test/spec/declaration files. Labs and global ignores excluded. Exact layers: appendix B.
- **Config / policy reads:** `eslint.config.mjs`, `packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts`, `RequireCategoryTagRule.ts`, `tsdoc.json` (TSDoc plugin config), policy helper transitive imports; Q2.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No `--cache` or `--fix` in this invocation; no explicit report write.
- **Type-awareness / dependency prerequisite:** **Not project-typed**: parser options set tsconfigRootDir and warning suppression only; no `project`/`projectService` and no `no-deprecated` in docs profile. `packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts:65`. No `^transit` for types.
- **Per-package scoping today:** External ESLint positional paths can scope it; current root invocation passes `.`.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

**ESLint default file selection:** the root `.` traversal also includes `**/*.{js,mjs,cjs}` via `node_modules/eslint/lib/config/default-config.js:21`, subject to global ignores. No project-typed rule is attached to those files, but a TS-only hash would omit their parse inputs. `tsdoc.json` is directly loaded by installed eslint-plugin-tsdoc when tsconfigRootDir is configured (`node_modules/eslint-plugin-tsdoc/lib/ConfigCache.js:62`); any tsdoc extends chain is also input.

## knowledge:semantic-delta

- **Entry point:** `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1540`
- **Source scan roots / tests:** Tracked **live `.md` only** under AGENTS.md, CLAUDE.md, goals/, explorations/, docs/, .claude/, .agents/, .codex/, standards/, .github/. `Str.endsWith(".md") && isKnowledgeScopedPath && !isKnowledgeArchivalPath` `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:328`. Excludes docs/generated, docs/_internal and both Impeccable skill mirrors; archival classification excludes history/research/reviews/etc. (appendix A). Paired tree paths still cover the entire repository for existence/rename checks, plus command/index probes read goal/workspace manifests. No general test-body scan.
- **Config / policy reads:** Current CLI command graph and Goals PortfolioIndex code; revision-local goal manifests, root/workspace manifests, `.gitattributes` affecting archives; GitHub event JSON via `GITHUB_EVENT_PATH` and environment select probe policy. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1523`
- **Git dependence:** **YES; not pure**: `for-each-ref --format=%(refname) refs/heads refs/remotes refs/tags` `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1002`; merge-base/base+HEAD resolution, archives, ls-tree and rename diff `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1568`.
- **Writes:** Scoped temporary `beep-knowledge-semantic-delta-*` trees, archives and generated probe scripts/configs (not tracked artifacts). `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1556`
- **Type-awareness / dependency prerequisite:** Runs current Bun command/index probes against revision data; no declaration build shown, but executable module graph is input.
- **Per-package scoping today:** `--base` defaults `origin/main`, `--json`; no package selector. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts:36`
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## knowledge:refs-check

- **Entry point:** `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts:60`; live archived oracle `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1664`
- **Source scan roots / tests:** Tracked `AGENTS.md`, `CLAUDE.md`, and `goals/**`, `explorations/**`, `docs/**`, `.claude/**`, `.agents/**`, `.codex/**`, `standards/**`, `.github/**`; excludes docs/generated, docs/_internal, both Impeccable skill mirrors. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:1157`. Tests are not a general scan root; tracked reference targets may be anywhere in the repo. Elects `.md`, `.json`, `.jsonc`, `.jsonl`, `.toml`, `.yml`, `.yaml` `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:2104`. Symlinks/gitlinks skipped, malformed UTF-8 recorded.
- **Config / policy reads:** Scanner policy encoded in Knowledge.refs.ts; revision-local manifest data and derived-index oracle. Full tracked path set is needed for reference existence.
- **Git dependence:** **YES**: `writeGitArchive(repoRoot, commit, ...)`, `readGitTree(repoRoot, commit, ...)` at `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1664`. Default tree HEAD; dirty text alone is not the census.
- **Writes:** Temporary archive materialization; check prints findings, no committed rewrite.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `--tree` default HEAD; `--surface live|archival|all` only narrows detailed listing, counts stay whole-corpus; `--json`, `--check`. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts:44`
- **Existing scripts:** No root script wraps `knowledge refs --check`; `knowledge:refs-rewrite` (`package.json:384`) is a separate mutation helper, not this check. Related workspace manifest count: **0**.

## lint:schema-first

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts:462`
- **Source scan roots / tests:** `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/{src,test}/**/*.ts`, `!**/docs/**` `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts:53`. Production scan excludes common TypeScript paths and ecosystem members; arbitrary-coverage companion inspects tests (see evidence appendix).
- **Config / policy reads:** `standards/schema-first.inventory.jsonc`, `standards/schema-crispening.policy.jsonc` `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstStore.ts:65`; root tsconfig/extends; workspace manifests for owner lookup.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** Check reads inventory; `--write` refreshes `standards/schema-first.inventory.jsonc` only when selected. `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts:477`
- **Type-awareness / dependency prerequisite:** **Type information used** (`property.getType()`, heritage.getType(), node.getType().getProperties()) `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts:282`. ts-morph root project; dependency resolution read closure may extend beyond nominated files. `^transit` conditional on declaration routing.
- **Per-package scoping today:** Repo-only; command has no file/package selector. Only `--write` defined `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:383`
- **Existing scripts:** root: `beep:preflight` = `bun run beep tsconfig-sync && bun run fallow:boundaries:write && bun run beep quality jsdoc-inventory && bun run beep lint schema-first --write && bun run beep quality test-tsgo && bun run beep ci lane repo-sanity && bun run beep ci lane jsdoc-ratchet && bun run beep ci lane knip && bun run beep lint policy` (`package.json:346`). Related workspace manifest count: **0**.

## lint:terse-effect

- **Entry point:** `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:592`
- **Source scan roots / tests:** `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/**/*.ts`; common TypeScript exclusions in appendix A remove `test/`, `tests/`, `.test.ts[x]`, `.spec.ts[x]`, declarations, generated/docs/build files. Also excludes ecosystem member sources; explicit negative glob `!**/docs/**`.
- **Config / policy reads:** Root `tsconfig.json` and its extends chain (`tsconfig.base.json`); law implementation and common exclusion/scanner sources (appendix A).
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No persisted source writes under `--check --advisory`; `--write` is a separate mutation mode.
- **Type-awareness / dependency prerequisite:** AST inspection through ts-morph root compiler options. No getType/type-check operation found in law visitor; actual ts-morph transitive resolution reads are not proven closed (Q1). No demonstrated dist prerequisite.
- **Per-package scoping today:** `--include` = "Comma-separated repo-relative source files to scan; defaults to the full source scope", default `*`; `--exclude` excludes exact paths. `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:196`. No `--include-prefix` on this subcommand.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

**Read-set correction (important for hashing):** the exclusions above describe diagnostic selection, not early file-discovery pruning. ts-morph receives the broad globs **before** the visitor filter, so `test/**`, `tests/**`, generated/build/declaration files matching those globs can be loaded/read even when excluded from findings. For terse/native only `!**/docs/**` is an explicit negative discovery glob. For effect-fn/frozen-grant-set, docs are also in the positive load set. Do not subtract post-load exclusions from Turbo inputs. Evidence: `TerseEffect.ts:605`, `NoNativeRuntime.ts:587`, `internal/LawScan.ts:184` under `packages/tooling/tool/cli/src/commands/Laws/`, and `packages/tooling/tool/cli/src/internal/tsmorph/ProjectFactory.ts:48`.

## lint:native-runtime

- **Entry point:** `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:571`
- **Source scan roots / tests:** `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/**/*.ts`; common TypeScript exclusions in appendix A remove `test/`, `tests/`, `.test.ts[x]`, `.spec.ts[x]`, declarations, generated/docs/build files. Also excludes ecosystem member sources; explicit negative glob `!**/docs/**`. **Additional root** `scratchpad/effect-ontology/**/*.{ts,tsx}` `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:41`.
- **Config / policy reads:** Root `tsconfig.json` and its extends chain (`tsconfig.base.json`); law implementation and common exclusion/scanner sources (appendix A). `packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts`, `NoNativeRuntimeHotspots.ts`, `src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts` (relative to repo-configs). Runtime uses generated snapshot; the JSONC source is validated by allowlist-check, not directly read by this visitor.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** AST inspection through ts-morph root compiler options. No getType/type-check operation found in law visitor; actual ts-morph transitive resolution reads are not proven closed (Q1). No demonstrated dist prerequisite.
- **Per-package scoping today:** `--include` = "Comma-separated repo-relative source files to scan; defaults to the full source scope", default `*`; `--exclude` excludes exact paths. `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:196`. No `--include-prefix` on this subcommand.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

**Read-set correction (important for hashing):** the exclusions above describe diagnostic selection, not early file-discovery pruning. ts-morph receives the broad globs **before** the visitor filter, so `test/**`, `tests/**`, generated/build/declaration files matching those globs can be loaded/read even when excluded from findings. For terse/native only `!**/docs/**` is an explicit negative discovery glob. For effect-fn/frozen-grant-set, docs are also in the positive load set. Do not subtract post-load exclusions from Turbo inputs. Evidence: `TerseEffect.ts:605`, `NoNativeRuntime.ts:587`, `internal/LawScan.ts:184` under `packages/tooling/tool/cli/src/commands/Laws/`, and `packages/tooling/tool/cli/src/internal/tsmorph/ProjectFactory.ts:48`.

## lint:frozen-grant-set

- **Entry point:** `packages/tooling/tool/cli/src/commands/Laws/FrozenGrantSet.ts:328`
- **Source scan roots / tests:** `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/**/*.ts`; common TypeScript exclusions in appendix A remove `test/`, `tests/`, `.test.ts[x]`, `.spec.ts[x]`, declarations, generated/docs/build files.
- **Config / policy reads:** Root `tsconfig.json` and its extends chain (`tsconfig.base.json`); law implementation and common exclusion/scanner sources (appendix A). `runLawScan` uses TSMorphService with `mode: "syntax"`, `referencePolicy: "workspaceOnly"` `packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:179`.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `--include` = "Comma-separated repo-relative source files to scan; defaults to the full source scope", default `*`; `--exclude` excludes exact paths. `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:196`. No `--include-prefix` on this subcommand.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

**Read-set correction (important for hashing):** the exclusions above describe diagnostic selection, not early file-discovery pruning. ts-morph receives the broad globs **before** the visitor filter, so `test/**`, `tests/**`, generated/build/declaration files matching those globs can be loaded/read even when excluded from findings. For terse/native only `!**/docs/**` is an explicit negative discovery glob. For effect-fn/frozen-grant-set, docs are also in the positive load set. Do not subtract post-load exclusions from Turbo inputs. Evidence: `TerseEffect.ts:605`, `NoNativeRuntime.ts:587`, `internal/LawScan.ts:184` under `packages/tooling/tool/cli/src/commands/Laws/`, and `packages/tooling/tool/cli/src/internal/tsmorph/ProjectFactory.ts:48`.

**Additional tsconfig preload:** `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:484` passes `tsConfigFilePath`, `skipFileDependencyResolution`, and `skipLoadingLibFiles`, but does **not** set `skipAddingFilesFromTsConfig`. The root project include set is therefore also a file-read input before law globs are added (`packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:1233`). Root `tsconfig.json:9` includes repo-wide Vitest configs, apps/packages test TS/TSX/JSON, root TS/JSON and syncpack.config.ts. Syntax mode does not remove these reads.

## lint:effect-fn

- **Entry point:** `packages/tooling/tool/cli/src/commands/Laws/EffectFn.ts:393`
- **Source scan roots / tests:** `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/**/*.ts`; common TypeScript exclusions in appendix A remove `test/`, `tests/`, `.test.ts[x]`, `.spec.ts[x]`, declarations, generated/docs/build files.
- **Config / policy reads:** Root `tsconfig.json` and its extends chain (`tsconfig.base.json`); law implementation and common exclusion/scanner sources (appendix A). `runLawScan` uses TSMorphService with `mode: "syntax"`, `referencePolicy: "workspaceOnly"` `packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:179`.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `--include` = "Comma-separated repo-relative source files to scan; defaults to the full source scope", default `*`; `--exclude` excludes exact paths. `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:196`. No `--include-prefix` on this subcommand.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

**Read-set correction (important for hashing):** the exclusions above describe diagnostic selection, not early file-discovery pruning. ts-morph receives the broad globs **before** the visitor filter, so `test/**`, `tests/**`, generated/build/declaration files matching those globs can be loaded/read even when excluded from findings. For terse/native only `!**/docs/**` is an explicit negative discovery glob. For effect-fn/frozen-grant-set, docs are also in the positive load set. Do not subtract post-load exclusions from Turbo inputs. Evidence: `TerseEffect.ts:605`, `NoNativeRuntime.ts:587`, `internal/LawScan.ts:184` under `packages/tooling/tool/cli/src/commands/Laws/`, and `packages/tooling/tool/cli/src/internal/tsmorph/ProjectFactory.ts:48`.

**Additional tsconfig preload:** `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:484` passes `tsConfigFilePath`, `skipFileDependencyResolution`, and `skipLoadingLibFiles`, but does **not** set `skipAddingFilesFromTsConfig`. The root project include set is therefore also a file-read input before law globs are added (`packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:1233`). Root `tsconfig.json:9` includes repo-wide Vitest configs, apps/packages test TS/TSX/JSON, root TS/JSON and syncpack.config.ts. Syntax mode does not remove these reads.

## lint:effect-imports

- **Entry point:** `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1620`
- **Source scan roots / tests:** **Current default code-mode invocation scans zero files.** `EFFECT_IMPORT_PROMOTED_FAMILY_PREFIXES = A.empty<string>()` (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:43`); `runEffectImportRules` returns before creating Project or reading mappings when mode=code, candidate=false and promoted list empty (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1628`). When candidate/promotion enables scanning, globs are `{apps,packages,infra}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, `!packages/**/docs/**`, plus foundation src TS/TSX for export mapping. Tests are loaded in that enabled path; generated/vendor policy filters run after discovery.
- **Config / policy reads:** Current early return: command/imported runtime code and the embedded promoted-family policy; no scan-time tsconfig, effect manifest or foundation-map reads. Enabled code scanning adds root tsconfig/extends, installed effect/package.json, foundation manifests/source exports (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:457`; `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:588`). Hash those if enabling candidates or maintaining a stable task input declaration across promotions.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No source save under --check; --write saves code/Markdown rewrites.
- **Type-awareness / dependency prerequisite:** Default early return: no type work. Enabled path uses ts-morph getModuleSpecifierSourceFile/getExportedDeclarations to resolve source export graph; published export routes are checked as manifest strings, not proven dist-file existence. No direct compiler diagnostic pass.
- **Per-package scoping today:** `--include` files and `--include-prefix` directory prefixes; prefix becomes recursive eight-extension glob; explicit files and prefixes are unioned, then policy filters apply. `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1589`. `--candidate` required to scan unpromoted code without promoting it.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:effect-imports-markdown

- **Entry point:** `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1678`
- **Source scan roots / tests:** Exactly `.patterns/**/*.{md,mdx}`, `standards/**/*.{md,mdx}`, `.claude/skills/**/*.{md,mdx}`, `docs/**/*.{md,mdx}`, `goals/*/[A-Z]*.md` `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:466`. Not goals/**/*.md. Also always reads foundation source map as above. No standalone test root.
- **Config / policy reads:** Always root tsconfig/extends, installed effect/package.json, foundation package.json exports + publishConfig.exports and foundation source reexports. Unlike current code mode, Markdown mode does not take the empty-promotion early return (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1628`).
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes under --check; --write changes Markdown text.
- **Type-awareness / dependency prerequisite:** Cross-file export-map discovery; no compiler check. Foundation source still required.
- **Per-package scoping today:** `--mode markdown --check`; supports --include and --include-prefix, but prefixes filter the default Markdown census rather than expanding arbitrary Markdown roots. `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1681`
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:identity-registry

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts:376`
- **Source scan roots / tests:** Every declared `@beep/*` workspace directory recursively `**/*.{ts,tsx}`, except the identity workspace itself; **not src-only**. `collectWorkspaceIdentityEntries` returns workspace directory paths (`packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityRegistration.ts:357`), passed directly to collectSourceFiles (`packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts:342`). Excluded directory names: node_modules, dist, dist-test, build, coverage, .turbo, test. `tests/` and *.test.ts outside test/ are not excluded by this local walker. Also reads lab manifest/registry state.
- **Config / policy reads:** Root/workspace package.json; `packages/foundation/modeling/identity/src/packages.ts` registry (resolved via CreatePackage identity helpers); source scan exclusions in IdentityRegistry.ts.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** Default check none; --fix registers/removes identity entries in registry source. Not used by policy lane.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `fix: Flag.boolean("fix")`, default false; no include selector `packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts:428`
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:circular

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:421`
- **Source scan roots / tests:** Only `packages/tooling/tool/cli/src/**/*.ts` and `packages/tooling/library/repo-utils/src/**/*.ts`; `madge` dependency traversal may resolve imports beyond entry directories. No external `test/` roots. `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:423`
- **Config / policy reads:** `tsconfig.json` + extends/path mappings; madge tool/dependencies.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Import graph, not semantic checking; `detectiveOptions: { ts: { skipTypeImports: true } }` `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:442`. No demonstrated dist prerequisite.
- **Per-package scoping today:** Repo-only; command has no file/package selector. `Command.make("circular", {}, runLintCircular)`.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:package-test-imports

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts:357`
- **Source scan roots / tests:** `packages/**/test/**/*.{ts,tsx}` lexical test path classification, excluding /src/ before test. Source-owner lookup separately recursively walks **all packages/** package.json files even for scoped tests. `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts:129`; `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts:177`. Tests are the primary input.
- **Config / policy reads:** `packages/**/package.json` for @beep names/source root ownership; no tsconfig provided to syntax Project.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `include: Flag.string("include")` comma-separated files; `includeRoot: Flag.string("include-root")` "Repo-relative package directory whose test files should be scanned", both default `*`. `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts:364`
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **2**.

| Workspace manifest | Related scripts |
| --- | --- |
| `packages/drivers/box-provisioning/package.json:27` | `beep:policy` = `bun run --cwd ../../../ beep lint package-test-imports --include-root packages/drivers/box-provisioning` |
| `packages/drivers/freshbooks/package.json:27` | `beep:policy` = `bun run --cwd ../../../ beep lint package-test-imports --include-root packages/drivers/freshbooks` |

## lint:package-test-typecheck

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts:881`
- **Source scan roots / tests:** **Current live policy command is a direct blind-spot inventory, not a Turbo-result aggregate.** Recursively discovers package dirs under `apps`, `infra`, `packages`; reads test/ source filenames and package scripts, and resolves tsconfig include/exclude/extends/references to decide check coverage. `packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts:59`; `packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts:892`. Separate quality test-tsgo aggregate described below.
- **Config / policy reads:** `standards/test-typecheck.blindspot-baseline.jsonc`; package.json scripts; local `tsconfig*.json`, test/tsconfig.json and relative extends/reference closure. `packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts:54`
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** Named lint check none; --write-baseline updates committed blindspot baseline. Separate package-test-typecheck Turbo task writes `.turbo/package-test-typecheck-result.json`.
- **Type-awareness / dependency prerequisite:** Named lint command parses configuration and matches file coverage; **does not typecheck**. Separate `beep quality test-tsgo` executes compiler package tasks and needs declaration dependencies.
- **Per-package scoping today:** `--baseline`, `--write-baseline`; no package include on lint command `packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts:981`.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **140**.

| Workspace manifest | Related scripts |
| --- | --- |
| `infra/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/todox/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/storybook/package.json:27` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/workspace/use-cases/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/professional-desktop/package.json:41` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/workspace/tables/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/practice-kg-mcp/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/workspace/server/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/labs/trustgraph-workbench/package.json:29` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/labs/ciops/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/labs/api-docs/package.json:29` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/architecture-lab-proof/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/labs/semantica/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/workspace/domain/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/oip-web/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/epistemic/client/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/epistemic/use-cases/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/epistemic/ui/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/tool/docgen/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `apps/labs/lejeune-bolt-workbench/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/architecture-lab/use-cases/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/ecosystem/effect-drizzle/package.json:39` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/documents/use-cases/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/epistemic/tables/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/architecture-lab/ui/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/documents/tables/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/xai/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/law-practice/use-cases/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/architecture-lab/tables/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/n3/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/architecture-lab/domain/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/agents/use-cases/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/epistemic/server/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/wink/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/m365/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/agents/tables/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/m365-mcp/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/architecture-lab/config/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/documents/server/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/venice-ai/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/architecture-lab/server/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/agents/server/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/libpff/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/uspto/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/documents/domain/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/library/repo-utils/package.json:62` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/ecfr/package.json:41` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/architecture-lab/client/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/hubspot/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/ai-provider-cli/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/box-provisioning/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/uspto-mcp/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/box/package.json:41` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/library/qa-capture/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/duckdb/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/law-practice/tables/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/anthropic/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/agents/domain/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/doc-text/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/graph-3d/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/tika/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/discord/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/cosmos/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/drizzle/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/agents/client/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/library/codegen-kit/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/tailscale/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/acp/package.json:41` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/face-detection/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/freshbooks/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/govinfo/package.json:41` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/firecrawl/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/ffmpeg/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/shacl/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/law-practice/server/package.json:29` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/gov-legal-mcp/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/exiftool/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/_internal/db-admin/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/library/ai-sync/package.json:43` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/epistemic/domain/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/sanity/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/epistemic/config/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/pacer/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/openai-compat/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/oxigraph/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/nlp-mcp/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/onepassword-cli/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/obs/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/phoenix/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/rdf-canonize/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/runpod/package.json:40` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/law-practice/domain/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/pglite/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/library/ai-metrics/package.json:60` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/pretext/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/openclaw/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/openai/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/drivers/postgres/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/shared/use-cases/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/ui-system/dock-react/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/semantic-web/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/utils/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/ui-system/brand/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/chalk/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/shared/tables/package.json:30` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/skill-contract/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/api-transport/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/shared/domain/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/primitive/types/package.json:31` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/langextract/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/observability/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/ontology/domain/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/ontology/config/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/ui-system/ui/package.json:25` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/file-processing/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/primitive/data/package.json:25` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/ontology/client/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/ontology/package.json:34` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/nlp-processing/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/colors/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/ontology/use-cases/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/capability/mcp-kit/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/html/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/ui-system/editor/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/ontology/ui/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/identity/package.json:26` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/nlp/package.json:32` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/ui-system/dock/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/md/package.json:24` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/ontology/server/package.json:33` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/tool/cli/package.json:164` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/lexical/package.json:38` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/schema/package.json:26` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/test-kit/test-utils/package.json:52` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/pandoc-ast/package.json:39` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/rdf/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/policy-pack/repo-configs/package.json:28` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/test-kit/fc-runs/package.json:37` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/foundation/modeling/provenance/package.json:36` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |
| `packages/tooling/policy-pack/lint-rules/package.json:24` | `package-test-typecheck` = `beep-cli quality test-tsgo-package` |

## lint:tsgo-rules

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2341`
- **Source scan roots / tests:** Two walks, in addition to installed rule README: (1) source directives under `{apps,packages,tooling,infra}/**/*.{cts,mts,ts,tsx}`; skip directory names node_modules/dist/coverage/tmp, .storybook and apps/storybook subtree; tests included. (2) root `tsconfig*.json` and recursively `{apps,packages,infra,scratchpad}/**/tsconfig*.json`, filename regex `^tsconfig(?:\..+)?\.json$`; skip node_modules/dist/coverage/tmp. `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:331`; `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2227`; `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2272`. Profile validation exemptions are applied after configs are read, so exempt fixture/example/standalone configs remain read inputs.
- **Config / policy reads:** `node_modules/@effect/tsgo/README.md` (resolved path), `tsconfig.base.json`, `tsconfig.json`, `vitest.aliases.generated.json` `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2350`. Additional validation helpers in same function must be retained as code inputs.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Configuration enforcement, not compiler execution (separate tsgo smoke command exists). No `^transit` for types.
- **Per-package scoping today:** Repo-only; command has no file/package selector. `Command.make("tsgo-rules", {}, ...)`.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

The source directive walk and recursive tsconfigs are actual additional reads; extend the listed root configs accordingly. No tsgo compile is run here. The two standalone-profile exemptions are `infra/ci-runners/sdks/ghaRunners/tsconfig.json` and `infra/lambda/turbo-cache/tsconfig.json`; all /test/fixtures/ and /docs/examples/ configs are also exempt only from profile validation (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2063`).

## lint:oxlint

- **Entry point:** `bunx oxlint --quiet --disable-nested-config`; `.oxlintrc.json:1`.
- **Source scan roots / tests:** Positional path absent: binary default walk from cwd; exact extension/ignore-file traversal defaults **UNKNOWN from repo config alone**. `.oxlintrc.json:23` ignorePatterns reproduced appendix C; tests not excluded globally and a test-specific plugin rule exists.
- **Config / policy reads:** `.oxlintrc.json`; `packages/tooling/policy-pack/lint-rules/src/rules/index.ts` and its transitive rule/helper sources. Nested configs disabled. Root ignores and tool version/lockfile must be included.
- **Git dependence:** No Git subprocess established; binary ignore-file/Git-index dependence UNKNOWN pending installed binary implementation audit.
- **Writes:** No --fix/cache/output flag. Binary implicit caches UNKNOWN.
- **Type-awareness / dependency prerequisite:** No --type-aware flag; custom JS plugin AST/path rules. Type-service/build requirement not established.
- **Per-package scoping today:** Oxlint positional path is external-tool scope; current lane repo-wide. CLI flag schema not vendored here: UNKNOWN.
- **Existing scripts:** root: `lint:oxlint` = `oxlint` (`package.json:388`). Related workspace manifest count: **0**.

**Path-existence dependency:** the mandatory `no-js-extension-imports` rule calls `pathExists(importedModulePath(source.value, context.filename))` before reporting (`packages/tooling/policy-pack/lint-rules/src/rules/no-js-extension-imports.ts:79`). Existence of a referenced .js/.mjs/.cjs file, including generated output, can change findings even if that target is ignored by the scanner. Hash the target-existence surface or remove the ambient build dependence before treating it as pure.

## lint:ecosystem-polarity

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts:384`
- **Source scan roots / tests:** `packages/ecosystem/*/package.json` plus each discovered member `src/**/*.{ts,tsx,mts,cts}`. `--include` chooses affected **members**, then reads whole member src. `packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts:23`; `packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts:406`. Test/ outside src excluded.
- **Config / policy reads:** Member package manifests and command-embedded polarity policy.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `include: Flag.string("include")` default `*` `packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts:460`.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:allowlist

- **Entry point:** `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:294`
- **Source scan roots / tests:** Only files named by entries in `standards/effect-laws.allowlist.jsonc` for existence/current native-runtime violation validation, plus generated snapshot. No whole source-root walk; tests only if named by entries. `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:337`
- **Config / policy reads:** `standards/effect-laws.allowlist.jsonc`; `packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts`; allowlist schema/generator and native-runtime/hotspot policy sources. `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:39`
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** Repo-only; command has no file/package selector. `allowlist-check` has no include selector; cwd root option is not per-package scope.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:jsdoc-module-tags

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2711`
- **Source scan roots / tests:** Tracked files rooted at `.patterns`, `apps`, `packages`, `tooling` with extensions `.hbs`, `.md`, `.ts`, `.tsx`; excludes apps/labs. **Infra is absent**. Tests included. `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:329`
- **Config / policy reads:** Embedded roots/extensions and Labs path predicate; no separate config read.
- **Git dependence:** **YES**: `command: "git", args: ["ls-files"]` `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2716`.
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** Repo-only; command has no file/package selector. Empty command options.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## goals:doctor

- **Entry point:** `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:784`
- **Source scan roots / tests:** `goals/*/ops/manifest.json`, `goals/*/README.md`, `goals/*/GOAL.md` via Inventory.ts; history/reflections entries, and filesystem existence of the manifest `provenance.exploration` backlink (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:443`). No package tests. `packages/tooling/tool/cli/src/commands/Goals/Inventory.ts:135`; `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:309`
- **Config / policy reads:** `goals/goals-doctor.baseline.jsonc`; goal schema/policy source; the dynamic exploration backlink existence cannot be reduced to goal Markdown globs only.
- **Git dependence:** **YES**, always calls gitAdvisories: `rev-parse --is-shallow-repository`; `log --since=${STALE_ACTIVE_DAYS}.days --name-only --format= -- goals/`; `log --format=%s -n 4000`. `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:631`. Time-sensitive.
- **Writes:** Default none; --write-baseline writes goals/goals-doctor.baseline.jsonc.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `--write-baseline` only; no package/path selector `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:828`
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## goals:index-check

- **Entry point:** `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:257`
- **Source scan roots / tests:** Inventory of immediate goal dirs excluding `_template` and dot-prefixed entries (Inventory.ts:159): ops/manifest.json, README.md, GOAL.md; reads optional goals/INDEX.md to compare generated projection. Tests excluded. `packages/tooling/tool/cli/src/commands/Goals/Inventory.ts:135`; `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:265`
- **Config / policy reads:** `goals/INDEX.md` when present; manifests and generation schemas. No goals-doctor baseline here.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** None under --check; --write writes goals/INDEX.md.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `--check`, `--write` only `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:253`.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:reflection-artifacts

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts:272`
- **Source scan roots / tests:** `goals/*/history/reflections/` immediate filenames matching `^\d{4}-\d{2}-\d{2}-.+\.md$` (ReflectionArtifact.ts:37), plus `goals/*/ops/manifest.json`; excludes template slug. Tests excluded. `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts:279`
- **Config / policy reads:** ReflectionFrontmatter and manifest status/schema code; no external baseline established.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** Repo-only; command has no file/package selector.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:roadmap-refs

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts:293`
- **Source scan roots / tests:** `docs/ROADMAP.md`; dynamically resolved link-target **existence** anywhere linked; target packet ops/manifest.json for phase snapshot advisories. Tests only if link target. `packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts:303`.
- **Config / policy reads:** `docs/ROADMAP.md` and linked goal manifests; derived-projection exemptions embedded in code.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** Repo-only; command has no file/package selector.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:judge-rubric

- **Entry point:** `packages/tooling/tool/cli/src/commands/Lint/JudgeRubric.ts:116`
- **Source scan roots / tests:** One file `.claude/skills/browser-qa-loop/resources/judge-prompt.md`, compares lens text to imported QaLens domain; no source/test scan. `packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts:79`
- **Config / policy reads:** Judge prompt and QaLens definition/reexports in commands/Qa (implementation input).
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** Repo-only; command has no file/package selector.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## lint:typos

- **Entry point:** `bunx typos`; `_typos.toml:1`.
- **Source scan roots / tests:** Default binary cwd traversal; exact compiled-in extension, hidden-file and ignore semantics **UNKNOWN**. Root config exclusions copied in appendix C: notably goals/**, research/**, scratchpad/**, explorations/** excluded. Tests not globally excluded.
- **Config / policy reads:** `_typos.toml` word dictionary + files.extend-exclude; potentially ignore files per binary behavior (UNKNOWN). Tool version/runtime dictionary matters.
- **Git dependence:** No repo wrapper Git call; whether installed typos uses Git traversal/index vs ignore files UNKNOWN.
- **Writes:** No --write-changes; no explicit output/cache file. Binary implicit cache UNKNOWN.
- **Type-awareness / dependency prerequisite:** Text spelling; no dependency build.
- **Per-package scoping today:** Binary positional paths; current invocation passes none. Exact installed CLI flag schema UNKNOWN.
- **Existing scripts:** root: none with a lane-specific wrapper; root `beep`/`lint` generic CLI dispatch is available. Related workspace manifest count: **0**.

## doctest

- **Entry point:** `vitest run --config vitest.docs.ts`; `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1730`
- **Source scan roots / tests:** `packages/**/src/**/*.{ts,tsx}`, `apps/**/src/**/*.{ts,tsx}`; exclude **/test/fixtures/** and shared exclusions. isDoctestSourcePath also excludes .d.ts, /node_modules/, /.context/. External test/ not an entry; fences execute arbitrary imported runtime code. `vitest.docs.ts:12`; `packages/tooling/tool/cli/src/internal/jsdoc/DoctestSource.ts:25`
- **Config / policy reads:** `vitest.docs.ts`, `vitest.shared.ts`, its imported configuration/setup/alias files (appendix D); tsconfig resolver config, workspace package manifests and runtime transitive imports; installed @effect/doctest plugin.
- **Git dependence:** **Affected hosted mode YES**: `git diff --name-only ${base}...${head} -- packages apps`, `git ls-files -- ...DOCTEST_WORKSPACE_PATHS`, deleted manifest `git show`; `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1730`. Full Vitest mode has no such selection Git reads.
- **Writes:** Vitest/Vite cache/report artifacts depend on shared config; no tracked source writes. Exact plugin temporary artifacts UNKNOWN.
- **Type-awareness / dependency prerequisite:** **Executes examples**; not blanket tsc checking. Needs runtime dependency graph/aliases; `^transit` when imports route to generated/built modules. Hash source closure if source aliases.
- **Per-package scoping today:** Vitest accepts positional source file filters; hosted `--mode affected|full|none`, base/head control selection. Full lane passes undefined files `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1183`
- **Existing scripts:** root: `doctest` = `vitest run --config vitest.docs.ts` (`package.json:339`). Related workspace manifest count: **0**.

## knip

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/internal/KnipRatchet.ts:523` → `bun run knip --reporter json` → root `knip-bun`.
- **Source scan roots / tests:** Workspace graph from root package.json and `knip.jsonc` workspace/plugin discovery; generic packages/** entries src/*.ts plus explicit ecosystem tests, apps, infra, tooling root entries (appendix C). Tests included except **/test/fixtures/**; ignore is not proof a file is never read for resolution. Exact plugin-expanded scan and config closure **UNKNOWN**; entry globs are not project universe.
- **Config / policy reads:** `knip.jsonc`, root/workspace package.json, tsconfig chains, plugin configs (Vite/Next/Vitest/Storybook etc.), `standards/knip.regression-baseline.jsonc`, dependency/lockfile/tool patches. `packages/tooling/tool/cli/src/commands/Quality/internal/KnipRatchet.ts:27`.
- **Git dependence:** **YES, Git administrative filesystem state (no Git subprocess required):** installed glob-core reads a worktree `.git` pointer and `<gitDir>/info/exclude`, plus ancestor/root/nested `.gitignore` files. `node_modules/knip/dist/util/glob-core.js:39`; `node_modules/knip/dist/util/glob-core.js:158`. Index/merge-base dependence not found here. Local info/exclude outside Turbo input roots makes current default traversal not portable/pure without controlling it.
- **Writes:** Default installed `isCache: args.cache ?? false`, so persistent analysis/glob/gitignore caches are disabled by the current root script. If --cache enabled, default location `node_modules/.cache/knip`. `node_modules/knip/dist/util/create-options.js:110`; `node_modules/knip/dist/util/create-options.js:98`. --write-baseline changes standards/knip.regression-baseline.jsonc.
- **Type-awareness / dependency prerequisite:** Dependency/export analysis; no compiler diagnostic pass requested. Plugin execution and package exports may read built modules; exact dist requirement UNKNOWN.
- **Per-package scoping today:** Quality wrapper --baseline and --write-baseline only; direct knip external binary scoping not exposed here.
- **Existing scripts:** root: `beep:preflight` = `bun run beep tsconfig-sync && bun run fallow:boundaries:write && bun run beep quality jsdoc-inventory && bun run beep lint schema-first --write && bun run beep quality test-tsgo && bun run beep ci lane repo-sanity && bun run beep ci lane jsdoc-ratchet && bun run beep ci lane knip && bun run beep lint policy` (`package.json:346`); `knip` = `knip-bun` (`package.json:383`). Related workspace manifest count: **0**.

**Installed default project scope:** per workspace `**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}!`, with compiler extensions added; default entries `{index,cli,main}.{...}!` and `src/{index,cli,main}.{...}!`. `!` is Knip production-pattern syntax, not a negated Turbo glob. `node_modules/knip/dist/ConfigurationChief.js:24`. Custom config/plugin entries augment the applicable scope. All enabled plugin config expansion remains UNKNOWN without evaluating the installed plugin/workspace activation graph. Direct binary `-W/--workspace` accepts repeated names/directories/globs, `-D/--directory` changes cwd (`node_modules/knip/dist/util/cli-arguments.js:26`); the quality wrapper does not forward these.

## fallow:audit

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:855`; root `fallow audit --config .fallowrc.jsonc` differs from hosted quality envelope.
- **Source scan roots / tests:** Binary source graph rooted at cwd, custom `.fallowrc.jsonc` entry and ignorePatterns arrays (appendix C). Entry roots include packages, apps/labs, infra internal entrypoints, root scripts/config and Impeccable detector; tests explicitly included for ecosystem consumers and CLI setup. **Exact binary default universe/extensions/plugin discovery UNKNOWN**; custom entry is not exhaustive read list.
- **Config / policy reads:** `.fallowrc.jsonc`, root/workspace package manifests, tsconfig/resolution inputs; root audit no baseline arg; hosted audit `--base <ref> --gate new-only`. `standards/fallow.pilot.inventory.jsonc` appears as report sourceRef metadata, not proven read.
- **Git dependence:** **Hosted envelope YES**: all three execute `git status --porcelain` and `git rev-parse --verify <base>`, plus DateTime.now for provenance (`packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:1377`). Audit also uses binary base comparisons / dirty-worktree diff including untracked files. Raw audit Git dependence is documented by installed capabilities; exact bare dead-code/health Git behavior UNKNOWN unless history features are enabled.
- **Writes:** Hosted `.beep/fallow/audit.{check,advisory}.json`, `.beep/fallow/raw/audit.{check,advisory}.combined.txt`, and `.beep/fallow/status.md`; raw naming `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:844`. Installed Fallow extraction cache defaults `.fallow/cache.bin`; additional cache filenames UNKNOWN. Explicit baseline-save scripts write corresponding standards baselines.
- **Type-awareness / dependency prerequisite:** Native static analysis; no tsc/tsgo invoked. Resolution/dependency configs required; dist/d.ts prerequisite UNKNOWN.
- **Per-package scoping today:** Hosted quality wrapper selects feature/base/output/check/advisory, repo-wide. Root binary package/path scoping UNKNOWN.
- **Existing scripts:** root: `fallow:audit` = `fallow audit --config .fallowrc.jsonc --format json --quiet` (`package.json:366`). Related workspace manifest count: **0**.

**Installed tool contract:** `node_modules/fallow/schema.json` documents built-in ignores `**/node_modules/**`, `**/dist/**`, `build/**`, `**/.git/**`, `**/coverage/**`, `**/*.min.js`, `**/*.min.mjs`, `**/*.min.cjs`, `**/*.bundle.js`, unioned with custom ignorePatterns. Workspace discovery also reads package.json workspaces, pnpm-workspace.yaml and tsconfig references. Plugin discovery may read `.fallow/plugins/**` and root `fallow-plugin-*`; presence is input even if absent today. --type-aware is opt-in; `FALLOW_TYPE_AWARE` can also enable semantics, so explicitly control/hash it. `--root/-r` changes project root; `--workspace/-w` scopes **output** to names/globs/negations, not proof of bounded file reads (`node_modules/fallow/capabilities.json:204`). Audit requires Git according to installed manifest; health history flags add Git reads beyond base provenance. Exact native walker extension set remains UNKNOWN.

## fallow:dead-code

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:855`; root `fallow dead-code --config .fallowrc.jsonc` differs from hosted quality envelope.
- **Source scan roots / tests:** Binary source graph rooted at cwd, custom `.fallowrc.jsonc` entry and ignorePatterns arrays (appendix C). Entry roots include packages, apps/labs, infra internal entrypoints, root scripts/config and Impeccable detector; tests explicitly included for ecosystem consumers and CLI setup. **Exact binary default universe/extensions/plugin discovery UNKNOWN**; custom entry is not exhaustive read list.
- **Config / policy reads:** `.fallowrc.jsonc`, root/workspace package manifests, tsconfig/resolution inputs; `standards/fallow.dead-code.regression-baseline.jsonc` for explicit baseline scripts; hosted dead-code does not pass this file in fallowArgs. `standards/fallow.pilot.inventory.jsonc` appears as report sourceRef metadata, not proven read.
- **Git dependence:** **Hosted envelope YES**: all three execute `git status --porcelain` and `git rev-parse --verify <base>`, plus DateTime.now for provenance (`packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:1377`). Audit also uses binary base comparisons / dirty-worktree diff including untracked files. Raw audit Git dependence is documented by installed capabilities; exact bare dead-code/health Git behavior UNKNOWN unless history features are enabled.
- **Writes:** Hosted `.beep/fallow/dead-code.{check,advisory}.json`, `.beep/fallow/raw/dead-code.{check,advisory}.combined.txt`, and `.beep/fallow/status.md`; raw naming `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:844`. Installed Fallow extraction cache defaults `.fallow/cache.bin`; additional cache filenames UNKNOWN. Explicit baseline-save scripts write corresponding standards baselines.
- **Type-awareness / dependency prerequisite:** Native static analysis; no tsc/tsgo invoked. Resolution/dependency configs required; dist/d.ts prerequisite UNKNOWN.
- **Per-package scoping today:** Hosted quality wrapper selects feature/base/output/check/advisory, repo-wide. Root binary package/path scoping UNKNOWN.
- **Existing scripts:** root: `fallow:dead-code` = `fallow dead-code --config .fallowrc.jsonc` (`package.json:370`); `fallow:dead-code:baseline:write` = `fallow dead-code --config .fallowrc.jsonc --format json --quiet --summary --save-regression-baseline standards/fallow.dead-code.regression-baseline.jsonc` (`package.json:371`); `fallow:dead-code:json` = `fallow dead-code --config .fallowrc.jsonc --format json --quiet` (`package.json:372`). Related workspace manifest count: **0**.

**Installed tool contract:** `node_modules/fallow/schema.json` documents built-in ignores `**/node_modules/**`, `**/dist/**`, `build/**`, `**/.git/**`, `**/coverage/**`, `**/*.min.js`, `**/*.min.mjs`, `**/*.min.cjs`, `**/*.bundle.js`, unioned with custom ignorePatterns. Workspace discovery also reads package.json workspaces, pnpm-workspace.yaml and tsconfig references. Plugin discovery may read `.fallow/plugins/**` and root `fallow-plugin-*`; presence is input even if absent today. --type-aware is opt-in; `FALLOW_TYPE_AWARE` can also enable semantics, so explicitly control/hash it. `--root/-r` changes project root; `--workspace/-w` scopes **output** to names/globs/negations, not proof of bounded file reads (`node_modules/fallow/capabilities.json:204`). Audit requires Git according to installed manifest; health history flags add Git reads beyond base provenance. Exact native walker extension set remains UNKNOWN.

## fallow:health

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:855`; root `fallow health --config .fallowrc.jsonc` differs from hosted quality envelope.
- **Source scan roots / tests:** Binary source graph rooted at cwd, custom `.fallowrc.jsonc` entry and ignorePatterns arrays (appendix C). Entry roots include packages, apps/labs, infra internal entrypoints, root scripts/config and Impeccable detector; tests explicitly included for ecosystem consumers and CLI setup. **Exact binary default universe/extensions/plugin discovery UNKNOWN**; custom entry is not exhaustive read list.
- **Config / policy reads:** `.fallowrc.jsonc`, root/workspace package manifests, tsconfig/resolution inputs; `standards/fallow.health.regression-baseline.jsonc` for explicit baseline scripts; hosted health does not pass this file in fallowArgs. `standards/fallow.pilot.inventory.jsonc` appears as report sourceRef metadata, not proven read.
- **Git dependence:** **Hosted envelope YES**: all three execute `git status --porcelain` and `git rev-parse --verify <base>`, plus DateTime.now for provenance (`packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:1377`). Audit also uses binary base comparisons / dirty-worktree diff including untracked files. Raw audit Git dependence is documented by installed capabilities; exact bare dead-code/health Git behavior UNKNOWN unless history features are enabled.
- **Writes:** Hosted `.beep/fallow/health.{check,advisory}.json`, `.beep/fallow/raw/health.{check,advisory}.combined.txt`, and `.beep/fallow/status.md`; raw naming `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:844`. Installed Fallow extraction cache defaults `.fallow/cache.bin`; additional cache filenames UNKNOWN. Explicit baseline-save scripts write corresponding standards baselines.
- **Type-awareness / dependency prerequisite:** Native static analysis; no tsc/tsgo invoked. Resolution/dependency configs required; dist/d.ts prerequisite UNKNOWN.
- **Per-package scoping today:** Hosted quality wrapper selects feature/base/output/check/advisory, repo-wide. Root binary package/path scoping UNKNOWN.
- **Existing scripts:** root: `fallow:health` = `fallow health --config .fallowrc.jsonc` (`package.json:373`); `fallow:health:baseline:check` = `fallow health --config .fallowrc.jsonc --format json --quiet --summary --baseline standards/fallow.health.regression-baseline.jsonc` (`package.json:374`); `fallow:health:baseline:write` = `fallow health --config .fallowrc.jsonc --format json --quiet --summary --save-baseline standards/fallow.health.regression-baseline.jsonc` (`package.json:375`). Related workspace manifest count: **0**.

**Installed tool contract:** `node_modules/fallow/schema.json` documents built-in ignores `**/node_modules/**`, `**/dist/**`, `build/**`, `**/.git/**`, `**/coverage/**`, `**/*.min.js`, `**/*.min.mjs`, `**/*.min.cjs`, `**/*.bundle.js`, unioned with custom ignorePatterns. Workspace discovery also reads package.json workspaces, pnpm-workspace.yaml and tsconfig references. Plugin discovery may read `.fallow/plugins/**` and root `fallow-plugin-*`; presence is input even if absent today. --type-aware is opt-in; `FALLOW_TYPE_AWARE` can also enable semantics, so explicitly control/hash it. `--root/-r` changes project root; `--workspace/-w` scopes **output** to names/globs/negations, not proof of bounded file reads (`node_modules/fallow/capabilities.json:204`). Audit requires Git according to installed manifest; health history flags add Git reads beyond base provenance. Exact native walker extension set remains UNKNOWN.

## fallow:boundaries:check

> Orchestrator note (table revision 4): this section documents the existing root script
> `fallow:boundaries:check` (`bun run beep fallow boundaries --check`). The hosted repo-sanity
> member is a different command, `bun run beep fallow boundaries config-check --check`
> (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:397`), and the C3 task
> for it is `//#fallow:boundaries:config-check` in `c3-lane-task-table.md`; the root script stays a
> plain local script.

- **Entry point:** `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:460`
- **Source scan roots / tests:** Full workspace manifest dependency index → generated zones/rules; then `fallow dead-code --boundary-violations` source analysis. **Not only generated config comparison** `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:495`. Same Fallow graph scope/tests as above.
- **Config / policy reads:** `standards/fallow.boundaries.generated.jsonc` extends `.fallowrc.jsonc`; root/workspace manifests; doctrine rules embedded in Fallow.command.ts, plus binary resolution configs.
- **Git dependence:** No Git subprocess in direct Fallow boundaries helper; nested native binary behavior UNKNOWN. Hosted quality-envelope variant adds Git provenance.
- **Writes:** Check none in wrapper; --write writes selected generated boundary config. Binary implicit caches UNKNOWN.
- **Type-awareness / dependency prerequisite:** Manifest graph plus native import boundaries; no TS typecheck demonstrated.
- **Per-package scoping today:** `--output/-o` config path, `--write`, `--check`; no include/root selector `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:463`.
- **Existing scripts:** root: `fallow:boundaries` = `bun run beep fallow boundaries` (`package.json:367`); `fallow:boundaries:check` = `bun run beep fallow boundaries --check` (`package.json:368`); `fallow:boundaries:write` = `bun run beep fallow boundaries --write` (`package.json:369`). Related workspace manifest count: **0**.

## jsdoc-ratchet

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1555` + Quality.command jsdoc-ratchet.
- **Source scan roots / tests:** Root workspace manifest discovery + topo order. For each workspace reads docgen.json `srcDir` (default src), recursively *.ts/*.tsx excluding .d.ts and node_modules/dist/build/.turbo; docgen.exclude applies. Omits packages/ecosystem/** and apps/labs/**. Git-tracked filter further applies. External test/ only if srcDir configured there; src-local test files not categorically excluded. `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1273`; `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts:534`
- **Config / policy reads:** `tsdoc.json` root policy; workspace package.json/docgen.json; `standards/jsdoc-totals.regression-baseline.jsonc`. Committed inventory `standards/jsdoc-documentation.inventory.jsonc` (+ .md); hosted compares fresh `.beep/ci/jsdoc-documentation.inventory.jsonc`, not the committed inventory. `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts:97`
- **Git dependence:** **YES** inventory `runGitLines(repoRoot, ["ls-files"], ...)` when .git exists `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1580`. Compare alone is filesystem-only.
- **Writes:** Inventory defaults **write tracked** standards/jsdoc-documentation.inventory.{jsonc,md}; hosted overrides to `.beep/ci/` same filenames. Ratchet only writes baseline under --write-baseline. Inventory generatedAt timestamp also varies.
- **Type-awareness / dependency prerequisite:** In-memory AST/export/JSDoc analysis; no compiler check. No demonstrated declaration-build prerequisite.
- **Per-package scoping today:** Inventory --output-json/--output-markdown only; ratchet --inventory/--baseline/--write-baseline. Repo-only discovery.
- **Existing scripts:** root: `beep:preflight` = `bun run beep tsconfig-sync && bun run fallow:boundaries:write && bun run beep quality jsdoc-inventory && bun run beep lint schema-first --write && bun run beep quality test-tsgo && bun run beep ci lane repo-sanity && bun run beep ci lane jsdoc-ratchet && bun run beep ci lane knip && bun run beep lint policy` (`package.json:346`); `jsdoc:inventory` = `bun run beep quality jsdoc-inventory` (`package.json:382`). Related workspace manifest count: **0**.

## changeset-status

- **Entry point:** `packages/tooling/tool/cli/src/commands/Quality/ChangesetStatus.ts:571`
- **Source scan roots / tests:** Root workspace manifest catalog, changed paths since merge-base, .changeset/*.md/config and referenced package manifests; whole-repo changed filenames affect exemption decision, including tests. `packages/tooling/tool/cli/src/commands/Quality/ChangesetStatus.ts:580`
- **Config / policy reads:** `.changeset/config.json`, .changeset/*.md, root/workspace package.json; changeset policy code; Changesets binary configuration on enforced path.
- **Git dependence:** **YES** `git diff ... ${since}...HEAD` `packages/tooling/tool/cli/src/commands/Quality/ChangesetStatus.ts:416`; workspace catalog uses `git ls-files` `packages/tooling/tool/cli/src/commands/Quality/ChangesetGraph.ts:277`.
- **Writes:** No source/manifest writes requested by status invocation; external Changesets incidental writes UNKNOWN.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** `--since` optional, default origin/main; no package include `packages/tooling/tool/cli/src/commands/Quality/ChangesetStatus.ts:620`
- **Existing scripts:** root: `changeset:status` = `bun run beep quality changeset-status` (`package.json:349`); `changeset:status:since-main` = `bun run beep quality changeset-status --since origin/main` (`package.json:350`). Related workspace manifest count: **0**.

## config-sync:check

- **Entry point:** `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.service.ts:79`
- **Source scan roots / tests:** Root workspace patterns → workspace descriptors, dependency index and `tsconfig*.json` per workspace/root; source export targets/existence and source-owner references inform path maps. No test text parse; test config can participate. `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:298`; `packages/tooling/library/repo-utils/src/TsConfig.ts:61`
- **Config / policy reads:** Root and workspace package.json; root/workspace tsconfig*.json and relative reference/extends closure; tsconfig.packages.json; syncpack.config.ts; selected package docgen.json and canonical docgen generator dependencies. `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.service.ts:130`; `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:975`. This command is not merely references sync. Reading vitest.aliases.generated.json itself was not established in this planner (tsgo-rules reads it separately).
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** Under --check no planned files written. Default command (without check/dry-run) writes planned tsconfig/syncpack/docgen changes `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.service.ts:136`.
- **Type-awareness / dependency prerequisite:** Config/dependency graph; no TS semantic check. No `^transit` for types.
- **Per-package scoping today:** `--filter` "Limit package reference sync to a workspace package name or workspace-relative path"; still builds global descriptors/index. `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.command.ts:64`
- **Existing scripts:** root: `beep:preflight` = `bun run beep tsconfig-sync && bun run fallow:boundaries:write && bun run beep quality jsdoc-inventory && bun run beep lint schema-first --write && bun run beep quality test-tsgo && bun run beep ci lane repo-sanity && bun run beep ci lane jsdoc-ratchet && bun run beep ci lane knip && bun run beep lint policy` (`package.json:346`); `config-sync` = `bun run beep tsconfig-sync` (`package.json:354`); `config-sync:check` = `bun run beep tsconfig-sync --check` (`package.json:355`). Related workspace manifest count: **0**.

## version-sync

- **Entry point:** `packages/tooling/tool/cli/src/commands/VersionSync/VersionSync.command.ts:50`
- **Source scan roots / tests:** Fixed files: `.bun-version`, `.bun-linux-x64.sha256`, root package.json, apps/oip-web/vercel.json, `.nvmrc`, `.github/workflows/*.{yml,yaml}`, `docker-compose.yml`, `biome.jsonc`. No general source/test scan. Resolver evidence appendix D.
- **Config / policy reads:** Same fixed files; root catalog is Effect/Biome source of truth. Default network version/checksum/registry responses are **non-file inputs**; hosted repo-sanity passes --skip-network.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs). Default is nevertheless not pure because upstream versions can change.
- **Writes:** Default mode check (no writes); --write applies changes to resolver-owned fixed files/workflows.
- **Type-awareness / dependency prerequisite:** Version/text/config checks only; no dependency type build.
- **Per-package scoping today:** `--skip-network`, --bun-only, --node-only, --docker-only, --biome-only, --effect-only; --write/--dry-run; no per-package scope. `packages/tooling/tool/cli/src/commands/VersionSync/VersionSync.command.ts:63`
- **Existing scripts:** root: `version-sync` = `bun run beep version-sync` (`package.json:408`). Related workspace manifest count: **0**.

## topo-sort

- **Entry point:** `packages/tooling/tool/cli/src/commands/TopoSort/TopoSort.command.ts:35`
- **Source scan roots / tests:** Root package.json workspace patterns and all resolved workspace manifests/dependency names via buildRepoDependencyIndex. No source/test body scan.
- **Config / policy reads:** Root/workspace package.json; workspace discovery/dependency index implementation.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** No writes in the named check invocation; stdout/stderr only.
- **Type-awareness / dependency prerequisite:** Syntax/text/manifest analysis; no compiler check or prerequisite dependency declarations established. No `^transit` needed solely for type checking.
- **Per-package scoping today:** Repo-only; command has no file/package selector. `Command.make("topo-sort", {}, ...)`.
- **Existing scripts:** root: `topo-sort` = `bun run beep topo-sort` (`package.json:406`). Related workspace manifest count: **0**.

## docs:aggregate

- **Entry point:** `packages/tooling/tool/cli/src/commands/Docgen/internal/Aggregate.ts:111`
- **Source scan roots / tests:** Workspace discovery; orphan config scan `apps/**/docgen.json`, `packages/**/docgen.json`, `infra/docgen.json` minus exclusions. Existing generated modules per package `docs/modules/**` or private `.jsdoc-loop/generated-docs/modules/**`; does not recompile source examples/tests. `packages/tooling/tool/cli/src/commands/Docgen/internal/Workspace.ts:31`.
- **Config / policy reads:** Root/workspace package.json; **docgen.json existence and orphan paths**, not established config-body reads on the aggregation path. Generated doc directories are chosen by existence: prefer `.jsdoc-loop/generated-docs/modules` over `docs/modules` (`packages/tooling/tool/cli/src/commands/Docgen/internal/Workspace.ts:169`). docsOutputPath derives from workspace relative path, not a custom outDir in docgen.json. Generated module tree contents are read/copied.
- **Git dependence:** No Git command in the inspected implementation; root discovery may test `.git`/`bun.lock` existence, which is not a history/index read (see common inputs).
- **Writes:** Removes/recreates destination package doc tree; writes copied/rewritten Markdown and index under `docs/generated/<docsOutputPath>/**`. `packages/tooling/tool/cli/src/commands/Docgen/internal/Aggregate.ts:127`.
- **Type-awareness / dependency prerequisite:** No types for aggregation, but **depends on generated documentation artifacts**, not just ^transit.
- **Per-package scoping today:** `package: Flag.string("package")` with alias p, "Target a workspace package by name or repo-relative path"; `--filter` compatibility selector; --clean. `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:81`; `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:495`. Global orphan-config validation still runs.
- **Existing scripts:** root: `docs:aggregate` = `beep-cli docgen aggregate` (`package.json:364`). Related workspace manifest count: **1**.

| Workspace manifest | Related scripts |
| --- | --- |
| `packages/tooling/tool/docgen/package.json:25` | `docs:aggregate` = `bunx --bun --no-install beep-cli docs aggregate --clean` |

## repo-sanity

- **Entry point:** `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1460`; root audit:github → quality github-checks route.
- **Source scan roots / tests:** Composite: changeset graph, tsconfig sync, Fallow boundary config, version consistency, syncpack lint, sherif, bun audit; optionally changeset-status. Union of component file sets above, not just source globs. `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:380`
- **Config / policy reads:** Root/workspace manifests and bun.lock; `.changeset/*.md`; `standards/changesets.retired-packages.json`; tsconfigs/syncpack; Fallow config; version files; OSV ignore policy (appendix D).
- **Git dependence:** **YES**: ChangesetGraph `git ls-files -z -- :(glob).changeset/*.md` `packages/tooling/tool/cli/src/commands/Quality/ChangesetGraph.ts:340`; outer `ensureOriginMain(repoRoot)` `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1183`. Network vulnerability database and tool fetch also make this non-pure.
- **Writes:** Check components no intended tracked edits; quality wrapper diagnostic/report writes and tool caches UNKNOWN unless specified in component sections. ensureOriginMain may fetch refs (do not run during archaeology).
- **Type-awareness / dependency prerequisite:** Composite policy/config/native analysis; no blanket ^transit justification. Retain component-specific prerequisites.
- **Per-package scoping today:** Stage selector repo-sanity; optional hosted --changeset-status. No per-package selector for composite.
- **Existing scripts:** root: `audit:github` = `beep-cli audit github` (`package.json:344`); `beep:preflight` = `bun run beep tsconfig-sync && bun run fallow:boundaries:write && bun run beep quality jsdoc-inventory && bun run beep lint schema-first --write && bun run beep quality test-tsgo && bun run beep ci lane repo-sanity && bun run beep ci lane jsdoc-ratchet && bun run beep ci lane knip && bun run beep lint policy` (`package.json:346`). Related workspace manifest count: **0**.

Bun audit explicitly reads `osv-scanner.toml` and wall time (`DateTime.now`) before filtering ignoreUntil values (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:762`). Its output depends on the online advisory database. This composite cannot be made pure merely by adding more file globs.

## Appendix A — exact law and document discovery evidence

Post-load filters below define diagnostic scope. They must not be mistaken for filesystem traversal pruning. `collectTypeScriptFiles` in Lint.command.ts is a separate `.ts`-only walker, not the one shared discovery function for the law family. `Tasks.ts` `isLawSourcePath` merely decides which changed files to pass to selected policy steps.

`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:2371` (through line 2375):

```text
const isLawSourcePath = (filePath: string): boolean =>
  (Str.startsWith("apps/")(filePath) || Str.startsWith("packages/")(filePath) || Str.startsWith("infra/")(filePath)) &&
  (Str.endsWith(".ts")(filePath) || Str.endsWith(".tsx")(filePath));

const isEcosystemPolarityPath = (filePath: string): boolean => {
```

`packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:27` (through line 27):

```text
export const LAW_SCAN_INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;
```

`packages/tooling/library/repo-utils/src/schemas/TypeScriptSourceExclusions.ts:30` (through line 49):

```text
export const TYPESCRIPT_SOURCE_EXCLUDED_SEGMENTS = [
  "/.repos/",
  "/ci-runners/sdks/",
  "infra/lambda/",
  "/node_modules/",
  "/dist/",
  "/build/",
  "/coverage/",
  "/storybook-static/",
  "/.next/",
  "/.turbo/",
  "/docs/",
  "/_generated/",
  "/generated/",
  "/goals/",
  "/test/",
  "/tests/",
] as const;
```

`packages/tooling/library/repo-utils/src/schemas/TypeScriptSourceExclusions.ts:65` (through line 74):

```text
export const TYPESCRIPT_SOURCE_EXCLUDED_SUFFIXES = [
  ".d.ts",
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
  ".gen.ts",
  ".gen.tsx",
  ".stories.tsx",
] as const;
```

`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:41` (through line 48):

```text
const INCLUDED_GLOBS = [
  "apps/**/*.{ts,tsx}",
  "packages/**/*.{ts,tsx}",
  "infra/**/*.ts",
  "scratchpad/effect-ontology/**/*.{ts,tsx}",
] as const;
const SOURCE_FILE_GLOBS = [...INCLUDED_GLOBS, "!**/docs/**"] as const;
const ALLOWLIST_PATH = "standards/effect-laws.allowlist.jsonc";
```

`packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:127` (through line 128):

```text
const INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;
const SOURCE_FILE_GLOBS = [...INCLUDED_GLOBS, "!**/docs/**"] as const;
```

`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:459` (through line 474):

```text
const CODE_GLOBS = [
  "apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "packages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "infra/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "!packages/**/docs/**",
] as const;

const MARKDOWN_GLOBS = [
  ".patterns/**/*.{md,mdx}",
  "standards/**/*.{md,mdx}",
  ".claude/skills/**/*.{md,mdx}",
  "docs/**/*.{md,mdx}",
  "goals/*/[A-Z]*.md",
] as const;

const NON_SHIPPING_PREFIXES = ["scratchpad/", "explorations/"] as const;
```

`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:196` (through line 206):

```text
const includeFlag = Flag.string("include").pipe(
  Flag.withDescription("Comma-separated repo-relative source files to scan; defaults to the full source scope"),
  Flag.withDefault("*")
);

const includePrefixFlag = Flag.string("include-prefix").pipe(
  Flag.withDescription("Comma-separated repo-relative directory prefixes to scan"),
  Flag.withDefault("")
);

const logTerseEffectFileGroup = Effect.fn("Laws.logTerseEffectFileGroup")(function* (
```

`packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstArbitraryCoverage.ts:54` (through line 70):

```text
const TEST_FILE_PATTERN = /(?:\/test\/|\/tests\/|\.test\.tsx?$|\.spec\.tsx?$)/;
const TEST_FILE_EXCLUDED_SEGMENTS = [
  "/.repos/",
  "/node_modules/",
  "/dist/",
  "/build/",
  "/coverage/",
  "/docs/",
  "/_generated/",
  "/generated/",
] as const;

const isSchemaFirstTestFile = (filePath: string): boolean =>
  TEST_FILE_PATTERN.test(filePath) &&
  !A.some(TEST_FILE_EXCLUDED_SEGMENTS, (segment) => Str.includes(segment)(`/${filePath}`));

const isSchemaCodecHelperName = (name: string): boolean =>
```

`packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:1157` (through line 1178):

```text
export const KNOWLEDGE_SCANNER_SCOPE: ReadonlyArray<string> = [
  "AGENTS.md",
  "CLAUDE.md",
  "goals",
  "explorations",
  "docs",
  ".claude",
  ".agents",
  ".codex",
  "standards",
  ".github",
];

const SCANNER_ROOT_FILES = HashSet.make("AGENTS.md", "CLAUDE.md");
const SCANNER_PREFIXES = A.map(A.drop(KNOWLEDGE_SCANNER_SCOPE, 2), (root) => `${root}/`);
const EXCLUDED_PREFIXES: ReadonlyArray<string> = [
  "docs/generated/",
  "docs/_internal/",
  ".claude/skills/impeccable/",
  ".github/skills/impeccable/",
];
const ARCHIVAL_DIRECTORY_SEGMENTS = HashSet.make(
```

`packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:1178` (through line 1188):

```text
const ARCHIVAL_DIRECTORY_SEGMENTS = HashSet.make(
  "history",
  "research",
  "reviews",
  "synthesis",
  "findings",
  "outputs",
  "reflections",
  "logs",
  ".proofs"
);
```

## Appendix B — ESLint selection, profiles and shard evidence

`LABS_WORKSPACE_ROOT` resolves to `apps/labs`. Source routing of `@beep/repo-configs` is confirmed by that package manifest's `exports`: root and wildcard entries point into `src/*.ts`; these config/rule files execute directly without a repo-configs dist build. Docs does not request a type-aware parser service; deprecated-apis does. The default ESLint JavaScript files are additional to these TS rule-specific layers.

`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:51` (through line 82):

```text
const DEPRECATED_API_LINT_SHARDS = [
  "apps/architecture-lab-proof",
  LABS_WORKSPACE_ROOT,
  "apps/oip-web",
  "apps/professional-desktop",
  "infra",
  "packages/_internal",
  "packages/agents",
  "packages/architecture-lab",
  "packages/drivers",
  "packages/ecosystem",
  "packages/epistemic/client",
  "packages/epistemic/config",
  "packages/epistemic/domain",
  "packages/epistemic/server",
  "packages/epistemic/tables",
  "packages/epistemic/ui",
  "packages/epistemic/use-cases",
  "packages/foundation/capability",
  "packages/foundation/modeling",
  "packages/foundation/primitive",
  "packages/foundation/ui-system",
  "packages/law-practice",
  "packages/shared",
  "packages/tooling/library",
  "packages/tooling/policy-pack",
  "packages/tooling/test-kit",
  "packages/tooling/tool",
  "packages/workspace",
] as const;
```

`eslint.config.mjs:1` (through line 37):

```text
import { DeprecatedApisESLintConfig } from "@beep/repo-configs/eslint/DeprecatedApisESLintConfig";
import { DocsESLintConfig } from "@beep/repo-configs/eslint/DocsESLintConfig";
import { globalIgnores } from "eslint/config";

const eslintProfile = process.env.BEEP_ESLINT_PROFILE ?? "docs";

// The default profile is the docs/jsdoc lane. The deprecated vendor API gate is
// selected by `bun run lint:deprecated-apis`, which sets this profile inside the
// repo CLI before loading the shared config.
const selectedESLintConfig = (() => {
  if (eslintProfile === "deprecated-apis") {
    return DeprecatedApisESLintConfig;
  }

  if (eslintProfile === "docs") {
    return DocsESLintConfig;
  }

  throw new Error(`Unsupported BEEP_ESLINT_PROFILE: ${eslintProfile}`);
})();

// `.claude/worktrees/**` holds session-local linked worktrees (other checkouts'
// files that CI never sees); linting them couples this clone's gate to whatever
// those sessions have checked out. The Impeccable mirrors are vendored agent
// tooling whose upstream UMD bundle is not authored workspace source.
// `infra/lambda/**/build/**` is gitignored esbuild bundle output (vendored shim
// code) that eslint would otherwise scan.
export default [
  globalIgnores([
    "**/src-tauri/target/**",
    ".claude/worktrees/**",
    ".claude/skills/impeccable/**",
    ".github/skills/impeccable/**",
    "infra/lambda/**/build/**",
  ]),
  ...selectedESLintConfig,
];
```

`packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:20` (through line 44):

```text
const generatedAndBuildOutputIgnores = [
  ".next/**",
  "**/.next/**",
  ".repos/**",
  ".sst/**",
  "coverage/**",
  "**/coverage/**",
  "dist/**",
  "**/dist/**",
  "**/docs/**",
  "node_modules/**",
  "**/node_modules/**",
  "apps/*/src/app/sw.ts",
  "**/.turbo/**",
  "**/.cache/**",
  "**/generated/**",
  "**/vendor/**",
  "**/*.gen.*",
  "**/*.d.ts",
  "**/typetests/**/*.tst.ts",
] as const;
```

`packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:90` (through line 135):

```text
export const DeprecatedApisESLintConfig: DeprecatedApisESLintConfigShape = [
  {
    ignores: [...generatedAndBuildOutputIgnores],
  },
  {
    files: [...sourceFileGlobs],
    ignores: [...generatedAndBuildOutputIgnores],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "apps/*/scripts/*.ts",
            "packages/_internal/*/drizzle.config.ts",
            "packages/_internal/*/scripts/*.ts",
            "packages/drivers/*/scripts/*.ts",
            "packages/ecosystem/*/scripts/*.ts",
            "packages/drivers/*/test/fixtures/*.ts",
            "packages/drivers/graph-3d/stories/*.tsx",
            "packages/foundation/*/*/scripts/*.ts",
            "packages/foundation/*/*/test/fixtures/*.ts",
            "packages/foundation/ui-system/ui/.storybook/*.ts",
            "packages/foundation/ui-system/ui/.storybook/*.tsx",
            "packages/tooling/*/*/scripts/*.ts",
            "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/src/extra.ts",
            "packages/tooling/library/repo-utils/test/fixtures/tsmorph-outline-order/source.ts",
            "packages/tooling/tool/docgen/test/fixtures/section-example/src/index.ts",
          ],
          defaultProject: "tsconfig.json",
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 160,
        },
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
    },
  },
];
```

`packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts:65` (through line 109):

```text
export const DocsESLintConfig: DocsESLintConfigShape = [
  {
    ignores: [
      "apps/labs/**",
      ".next/**",
      "**/.next/**",
      ".repos/**",
      ".sst/**",
      "coverage/**",
      "**/coverage/**",
      "dist/**",
      "**/dist/**",
      "**/docs/**",
      "infra/ci-runners/sdks/ghaRunners/**",
      "node_modules/**",
      "**/storybook-static/**",
      "**/.turbo/**",
      "**/src-tauri/target/**",
    ],
  },
  {
    files: ["packages/tooling/*/*/src/**/*.ts"],
    ignores: [
      "packages/tooling/*/*/src/internal/**",
      "packages/tooling/*/*/src/**/*.test.ts",
      "packages/tooling/*/*/src/**/*.spec.ts",
      "**/*.d.ts",
    ],
    plugins: {
      jsdoc,
      "beep-jsdoc": beepJsdoc,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    settings: {
      jsdoc: {
```

`packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts:220` (through line 287):

```text
    files: ["packages/tooling/*/*/src/**/tag-values/**/*.ts"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-description": "off",
      "jsdoc/match-description": "off",
    },
  },
  {
    files: ["packages/tooling/*/*/src/index.ts"],
    plugins: {
      jsdoc,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "jsdoc/require-file-overview": [
        "warn",
        {
          tags: {
            packageDocumentation: {
              initialCommentsOnly: true,
              mustExist: true,
            },
          },
        },
      ],
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"],
    ignores: [
      "**/*.d.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.stories.tsx",
      "**/test/**",
      "**/tests/**",
      "**/.storybook/**",
      "**/dist/**",
      "**/docs/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/vitest.storybook.config.ts",
      "packages/tooling/*/*/scripts/**",
      "packages/tooling/*/*/src/internal/**",
    ],
    plugins: {
      "eslint-plugin-tsdoc": tsdoc,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "eslint-plugin-tsdoc/syntax": "warn",
    },
  },
];
```

## Appendix C — external-tool configuration and default boundaries

The literal configuration arrays below are repo evidence. Installed Knip JavaScript was inspected for default project and Git-ignore/cache behavior; native Fallow capabilities/schema were inspected without launching its wrapper. Native walker internals for Fallow, Oxlint and typos were not present in the inspected sources, so their remaining defaults are UNKNOWN. No binary was run, since even a help/version wrapper can create receipts/caches and this lane permits only the report write.

`.fallowrc.jsonc:7` (through line 104):

```text
  "entry": [
    "packages/**/src/*.ts",
    "packages/**/src/*/index.ts",
    "infra/src/internal/*-entry.ts",
    "apps/*/src/main.tsx",
    "apps/*/src/main.ts",
    "apps/*/src/index.ts",
    "apps/*/next.config.ts",
    "apps/*/vite.config.ts",
    "apps/*/src/app/layout.tsx",
    "apps/*/src/app/page.tsx",
    "apps/*/src/app/**/layout.tsx",
    "apps/*/src/app/**/page.tsx",
    "apps/*/src/app/**/route.ts",
    "apps/*/src/app/**/loading.tsx",
    "apps/*/src/app/**/error.tsx",
    "apps/*/src/app/**/not-found.tsx",
    "apps/*/src/app/**/global-error.tsx",
    "apps/*/src/app/manifest.ts",
    "apps/*/src/app/robots.ts",
    "apps/*/src/app/sitemap.ts",
    "apps/*/src/mdx-components.tsx",
    "apps/*/src/middleware.ts",
    "apps/*/src/proxy.ts",
    "apps/*/src/instrumentation.ts",
    "apps/labs/*/src/main.tsx",
    "apps/labs/*/src/main.ts",
    "apps/labs/*/src/index.ts",
    "apps/labs/*/next.config.ts",
    "apps/labs/*/vite.config.ts",
    "apps/labs/*/src/app/layout.tsx",
    "apps/labs/*/src/app/page.tsx",
    "apps/labs/*/src/app/**/layout.tsx",
    "apps/labs/*/src/app/**/page.tsx",
    "apps/labs/*/src/app/**/route.ts",
    "apps/labs/*/src/app/**/loading.tsx",
    "apps/labs/*/src/app/**/error.tsx",
    "apps/labs/*/src/app/**/not-found.tsx",
    "apps/labs/*/src/app/**/global-error.tsx",
    "apps/labs/*/src/app/manifest.ts",
    "apps/labs/*/src/app/robots.ts",
    "apps/labs/*/src/app/sitemap.ts",
    "apps/labs/*/src/mdx-components.tsx",
    "apps/labs/*/src/middleware.ts",
    "apps/labs/*/src/proxy.ts",
    "apps/labs/*/src/instrumentation.ts",
    "apps/storybook/.storybook/main.ts",
    "apps/storybook/.storybook/manager.ts",
    "apps/storybook/.storybook/preview.tsx",
    "apps/storybook/vitest.storybook.config.ts",
    "apps/storybook/vitest.storybook.setup.ts",
    "packages/foundation/ui-system/*/stories/**/*.stories.tsx",
    "packages/drivers/graph-3d/stories/**/*.stories.tsx",
    "packages/ecosystem/*/typetests/*.tst.ts",
    "packages/ecosystem/effect-drizzle/test/integration/sqlite-drizzle-schema.ts",
    "packages/ecosystem/effect-drizzle/test/perf.consumer.ts",
    "packages/ecosystem/effect-drizzle/test/bundle-pg-integer.consumer.ts",
    "syncpack.config.ts",
    "eslint.config.mjs",
    "scripts/changeset-changelog.cjs",
    "packages/tooling/tool/cli/test/global-cleanup.ts",
    ".claude/skills/impeccable/scripts/detector/cli/main.mjs",
    "packages/foundation/ui-system/ui/src/components/blocks/editor-00/plugins.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.changelog.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.document.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.explorer.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.graph.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.source.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.sparql.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.validation.tsx",
    "packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx"
  ],
```

`.fallowrc.jsonc:106` (through line 164):

```text
  "ignorePatterns": [
    ".github/skills/impeccable/**",
    ".claude/skills/browser-qa-loop/resources/qa-capture-template.mjs",
    "goals/**",
    "scratchpad/**",
    "infra/ci-runners/sdks/**",
    "infra/lambda/**",
    "**/test/fixtures/**",
    "**/examples/**",
    "**/postcss.config.*",
    "tools/tsgo-shim/**",
    "packages/canvas/client/**",
    "packages/canvas/ui/**",
    "**/test/fixtures/mock-monorepo/**",
    "explorations/identity-as-iri/assets/ontology-prototype/**",
    "explorations/lejeune-bolt-agentic-demo/ops/**",
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/**",
    "packages/foundation/modeling/html/src/Html.model.ts",
    "packages/foundation/modeling/html/src/Html.meta.ts",
    "packages/foundation/modeling/html/scripts/**",
    "packages/foundation/modeling/html/data/**",
    "packages/foundation/primitive/data/src/generated/**",
    "packages/drivers/acp/src/_generated/**",
    "packages/drivers/ecfr/src/_generated/**",
    "packages/drivers/govinfo/src/_generated/**",
    "packages/drivers/runpod/src/_generated/**"
  ],
```

`knip.jsonc:1` (through line 26):

```text
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "workspaces": {
    "packages/**": {
      "entry": ["src/*.ts"]
    },
    "packages/ecosystem/effect-drizzle": {
      "entry": [
        "typetests/contracts.tst.ts",
        "test/integration/sqlite-drizzle-schema.ts",
        "test/perf.consumer.ts",
        "test/bundle-pg-integer.consumer.ts"
      ]
    },
    "packages/law-practice/domain": {
      "entry": ["src/internal/generated/free-law-project/*.ts"]
    },
```

`knip.jsonc:120` (through line 142):

```text
  "ignore": [
    ".github/skills/impeccable/**",
    "goals/**",
    "explorations/**",
    "infra/ci-runners/sdks/**",
    "infra/lambda/**",
    "**/test/fixtures/**",
    "**/examples/**",
    "**/postcss.config.*",
    "tools/skillopt/**",
    "tools/skillopt/**"
  ],
```

`knip.jsonc:180` (through line 180):

```text
  "ignoreWorkspaces": ["scratchpad", "**/test/fixtures/mock-monorepo"],
```

`.oxlintrc.json:22` (through line 47):

```text
  "ignorePatterns": [
    "**/dist/**",
    "**/build/**",
    "**/node_modules/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/generated/**",
    "**/*.gen.*",
    ".repos/**",
    ".codex/**",
    ".claude/**",
    "docs/generated/**",
    "**/scripts/**",
    "goals/**",
    "explorations/**"
  ],
  "rules": {
    "beep/no-js-extension-imports": "error",
    "beep/no-opaque-instance-fields": "error",
    "beep/no-manual-effect-runtime-in-tests": "warn",
    "beep/namespace-node-imports": "warn",
    "beep/no-global-process-runtime": "warn",
    "beep/no-inline-schema-compile": "warn"
  }
}
```

`_typos.toml:85` (through line 133):

```text
[files]
extend-exclude = [
  "packages/drivers/*/openapi.json",
  "packages/drivers/*/spec/*.json",
  "infra/ci-runners/sdks/**",
  "explorations/*/CAPTURE.md",
  "apps/labs/semantica/fixtures/gold/**",
  "patches/*.patch",
  "research/**",
  "bun.lock",
  "*.snap",
  ".repos/**",
  "node_modules/**",
  "build/**",
  "tmp/**",
  "dist/**",
  "coverage/**",
  ".next/**",
  "**/storybook-static/**",
  ".beep/**",
  "scratchpad/**",
  "explorations/**",
  "outputs/agent-reliability/**",
  "goals/**",
  "standards/repo-exports.catalog.jsonc",
  "standards/repo-exports.catalog.md",
  "**/internal/data/**",
  "packages/law-practice/domain/src/internal/generated/free-law-project/**",
  "**/src-tauri/gen/**",
  "**/src-tauri/target/**",
  "packages/drivers/venice-ai/swagger.yaml",
  "packages/foundation/modeling/html/data/**",
  "packages/foundation/modeling/html/src/internal/Html.language-tag-registry.generated.ts",
  "patches/**",
]
```

`node_modules/knip/dist/ConfigurationChief.js:24` (through line 31):

```text
const getDefaultWorkspaceConfig = (extensions = []) => {
    const exts = [...DEFAULT_EXTENSIONS, ...extensions].map(ext => ext.slice(1)).join(',');
    return {
        entry: [`${defaultBaseFilenamePattern}.{${exts}}!`, `src/${defaultBaseFilenamePattern}.{${exts}}!`],
        project: [`**/*.{${exts}}!`],
    };
};
const isPluginName = (name) => pluginNames.includes(name);
```

`node_modules/knip/dist/util/glob-core.js:152` (through line 165):

```text
        }
    };
    for (const filePath of findAncestorGitignoreFiles(cwd))
        addFile(filePath);
    const gitDir = getGitDir(cwd);
    if (gitDir) {
        const excludePath = join(gitDir, 'info/exclude');
        if (isFile(excludePath))
            addFile(excludePath, cwd);
    }
    const rootGitignorePath = join(cwd, '.gitignore');
    if (isFile(rootGitignorePath))
        addFile(rootGitignorePath);
    let isRelevantDir;
```

`node_modules/knip/dist/util/create-options.js:98` (through line 111):

```text
        cacheLocation: args['cache-location'] ?? join(cwd, 'node_modules', '.cache', 'knip'),
        catalog: await getCatalogContainer(cwd, manifest, manifestPath, pnpmWorkspacePath, pnpmWorkspace),
        config: args.config,
        configFilePath,
        cwd,
        cycles: args.cycles ?? false,
        dependencies: args.dependencies ?? false,
        exports: args.exports ?? false,
        files: args.files ?? false,
        fixTypes,
        gitignore: args['no-gitignore'] ? false : (options.gitignore ?? true),
        includedIssueTypes,
        isCache: args.cache ?? false,
        isDebug,
```

Installed Fallow declared config defaults:

- `node_modules/fallow/schema.json:370`: **cache** — Overrides the location and size ceiling of fallow's persistent extraction cache (default `.fallow/cache.bin` under the project root). Set to relocate the cache or cap its footprint; the object holds `dir` (cache directory, relative paths resolve from the project root) and `maxSizeMb` (extraction-cache size limit in megabytes). The `FALLOW_CACHE_MAX_SIZE` environment variable overrides `maxSizeMb`.
- `node_modules/fallow/schema.json:30`: **entry** — An array of project-root-relative glob patterns whose matching files are seeded as manual entry points, on top of the framework and package.json entries fallow discovers automatically, so their transitive imports are not reported as unused. Set it (e.g. `["src/main.ts"]`) when a file is a real runtime root that no plugin or manifest declares; patterns are validated at load and matched against discovered files.
- `node_modules/fallow/schema.json:38`: **ignorePatterns** — An array of project-root-relative glob patterns for files to exclude from analysis entirely; entries are unioned with fallow's built-in defaults (**/node_modules/**, **/dist/**, build/**, **/.git/**, **/coverage/**, **/*.min.js, **/*.min.mjs, **/*.min.cjs, **/*.bundle.js), so custom globs add to rather than replace them. Set it (e.g. `["generated/**"]`) to drop generated or vendored trees from every detector; patterns are validated at load.
- `node_modules/fallow/schema.json:61`: **workspaces** — Monorepo workspace configuration whose sole sub-key patterns (array of globs) adds workspace package roots beyond those discovered from package.json workspaces, pnpm-workspace.yaml, and tsconfig references. Optional and absent by default (discovery uses the manifests alone); set it only when workspaces live in directories the standard manifests do not declare.
- `node_modules/fallow/schema.json:188`: **typeAware** — Opts into TypeScript semantic analysis for project-wide symbol use, provenance, API surface, symbol impact, and public-signature coupling. This does not surface compiler diagnostics or typed lint rules.

## Appendix D — hosted companion reads and command distinctions

### The separate compiler aggregate behind package-test-typecheck

`beep lint package-test-typecheck` is the direct blind-spot baseline checker described above. `beep quality test-tsgo` is the aggregate over Turbo task `package-test-typecheck`; the 140 related manifest count in that lane is the number defining the **compiler task**. The distinction matters: giving the lint checker `^transit` would not convert it into compiler proof.

`Quality.command.ts` `runTestTsgoChecks` (line 2497) discovers test files under apps/packages/infra, groups by owning package, invokes Turbo with package filters, reads Turbo's summary plus each `.turbo/package-test-typecheck-result.json`, and folds diagnostics. The task `beep-cli quality test-tsgo-package` runs from a package cwd. It creates synthetic tsconfig input under `node_modules/.tmp/tsgo-test-checks`, invokes tsgo, and writes the package result; aggregate cleans the temporary directory. The synthetic config imports package compiler settings and includes actual discovered tests. Config/type closure includes `test/**/*.{cts,mts,ts,tsx}`, imported src/dependency sources or declarations, package manifests, root/package tsconfig chains and the synthetic-config implementation. Fixtures are excluded by discovery, but dependencies imported by tests are additional reads. No direct aggregate Git invocation was established; Turbo's own SCM hash/discovery is outside that assertion.

`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:328` (through line 329):

```text
const testSearchRoots = ["apps", "packages", "infra"] as const;
const moduleTagScannedRoots = [".patterns", "apps", "packages", "tooling"] as const;
```

`turbo.json:138` (through line 153):

```text
    "package-test-typecheck": {
      "cache": false,
      "dependsOn": ["^transit"],
      "inputs": [
        "package.json",
        "scripts/**",
        "server/**",
        "src/**",
        "src-tauri/**",
        "test/**",
        "tsconfig*.json",
        "$TURBO_ROOT$/tsconfig.base.json",
        "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
        "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoSyntheticConfig.ts"
      ],
      "outputs": [".turbo/package-test-typecheck-result.json"]
```

`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1306` (through line 1325):

```text

    return files;
  });

  return pipe(yield* visit(searchRoot), A.sort(Order.String));
});

const isTestTsgoFile = (normalizedPath: string, name: string): boolean =>
  Str.includes("/test/")(normalizedPath) &&
  !pathContainsSegment(normalizedPath, ignoredTestPathSegments) &&
  /\.(?:cts|mts|ts|tsx)$/u.test(name);

const isIgnoredTestTsgoDirectory = (normalizedPath: string, name: string): boolean =>
  A.contains(ignoredTestDirectoryNames as ReadonlyArray<string>, name) ||
  pathContainsSegment(normalizedPath, ignoredTestPathSegments);

const collectTestTsgoFilesUnder = (searchRoot: string) =>
  collectFiles(searchRoot, isTestTsgoFile, isIgnoredTestTsgoDirectory);

type TestTsgoPackageGroup = {
```

`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1450` (through line 1475):

```text

const runTestTsgoPackageGroup = Effect.fn("QualityScriptCommands.runTestTsgoPackageGroup")(function* (
  repoRoot: string,
  tempDir: string,
  extraArgs: ReadonlyArray<string>,
  group: TestTsgoPackageGroup
): Effect.fn.Return<
  TestTsgoPackageResult,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const groupLabel = tsgoTestPackageLabel(repoRoot, group.packageDir);
  const syntheticConfigPath = path.join(tempDir, `${groupLabel}.tsconfig.json`);
  const syntheticConfig = {
    ...testTsgoSyntheticConfigTemplate,
    extends: group.tsconfigPath,
    include: group.files,
    compilerOptions: {
      ...testTsgoSyntheticConfigTemplate.compilerOptions,
      rootDir: repoRoot,
      tsBuildInfoFile: path.join(tempDir, `${groupLabel}.tsbuildinfo`),
    },
  };
  const configText = yield* jsonStringifyPretty(syntheticConfig).pipe(
```

`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1549` (through line 1563):

```text

const testTsgoTurboArgs = (
  groups: ReadonlyArray<TestTsgoPackageGroup>,
  extraArgs: ReadonlyArray<string>
): ReadonlyArray<string> => [
  "run",
  testTsgoPackageTaskName,
  "--concurrency=1",
  "--continue=always",
  "--output-logs=none",
  "--summarize",
  ...A.map(groups, (group) => `--filter=${group.packageName}`),
  ...(A.isReadonlyArrayNonEmpty(extraArgs) ? ["--", ...extraArgs] : A.empty<string>()),
];

```

### Doctest configuration chain

`vitest.docs.ts:3` imports `vitest.shared.ts`. That imports `vitest.aliases.generated.json` and supplies `vitest.setup.ts`, source aliases, `resolve.tsconfigPaths: true`, and exclusions `.context`/node_modules. These are direct configuration/runtime inputs; source examples may import any further files. CI affected selection widens to dependent workspaces through package manifests, and cannot be modeled as a simple changed-JSDoc hash. Vite/Vitest's complete dependency/runtime/cache read trace remains UNKNOWN.

`vitest.docs.ts:1` (through line 20):

```text
import * as Doctest from "@effect/doctest/Plugin";
import { defineConfig } from "vitest/config";
import shared from "./vitest.shared.ts";

export default defineConfig({
  ...shared,
  plugins: [...(shared.plugins ?? []), Doctest.plugin()],
  test: {
    ...shared.test,
    exclude: [...(shared.test?.exclude ?? []), "**/test/fixtures/**"],
    include: [],
    includeSource: ["packages/**/src/**/*.{ts,tsx}", "apps/**/src/**/*.{ts,tsx}"],
    passWithNoTests: true,
    testTimeout: 30_000,
    sequence: {
      ...shared.test?.sequence,
      concurrent: false,
    },
  },
});
```

`packages/tooling/tool/cli/src/internal/jsdoc/DoctestSource.ts:25` (through line 32):

```text
export const isDoctestSourcePath = (file: string): boolean =>
  (Str.endsWith(".ts")(file) || Str.endsWith(".tsx")(file)) &&
  !Str.endsWith(".d.ts")(file) &&
  (Str.startsWith("packages/")(file) || Str.startsWith("apps/")(file)) &&
  Str.includes("/src/")(file) &&
  !Str.includes("/test/fixtures/")(file) &&
  !Str.includes("/node_modules/")(file) &&
  !Str.includes("/.context/")(file);
```

### Fallow baseline distinctions

Root scripts are not aliases for the hosted quality envelopes. `fallow:audit` has no --base in package.json, while the hosted quality audit does. `fallow:dead-code:baseline:write` saves `standards/fallow.dead-code.regression-baseline.jsonc`; ordinary dead-code does not load that file. `fallow:health:baseline:check` passes `--baseline standards/fallow.health.regression-baseline.jsonc`; ordinary/hosted health does not. Neither baseline file should be claimed as a read of every invocation just because it exists. Boundary check reads `standards/fallow.boundaries.generated.jsonc` and runs the source boundary analyzer; config-only hosted helper is a distinct shape.

`packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:855` (through line 914):

```text
const fallowArgs = (feature: FallowFeature, base: string, quiet: boolean): ReadonlyArray<string> => {
  const quietArgs = quiet ? ["--quiet"] : [];

  return FallowFeatureFamily.$match(feature, {
    audit: () => [
      "run",
      "fallow",
      "--",
      "audit",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--base",
      base,
      "--gate",
      "new-only",
    ],
    "dead-code": () => [
      "run",
      "fallow",
      "--",
      "dead-code",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--summary",
    ],
    health: () => [
      "run",
      "fallow",
      "--",
      "health",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--report-only",
      "--top",
      "50",
    ],
    boundaries: () => [
      "run",
      "fallow",
      "--",
      "dead-code",
      "--boundary-violations",
      "--config",
      "standards/fallow.boundaries.generated.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--summary",
    ],
    flags: () => [
      "run",
```

### Version-sync fixed reads

The resolver implementations establish these inputs (no general source walk):
- `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/BunResolver.ts:372`: `.bun-version`, `package.json`, `apps/oip-web/vercel.json`, `.bun-linux-x64.sha256`; optional upstream release/checksum requests.
- `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/NodeResolver.ts:141`: `.nvmrc` and `.github/workflows/*.{yml,yaml}`.
- `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/DockerResolver.ts:335`: `docker-compose.yml`; optional remote registry/tag requests.
- `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/BiomeResolver.ts:168`: `biome.jsonc` and root package.json catalog.
- `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/EffectResolver.ts:155`: root package.json Effect catalog (no additional installed package metadata read established in EffectResolver).

Repo-sanity vulnerability policy additionally reads `osv-scanner.toml` and wall time at `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:762`.

## Q1 — Is there one shared law discovery helper, and what package inputs are honest?

**No.** `LawScan.runLawScan` is shared by effect-fn and frozen-grant-set; terse-effect owns a direct Project, native-runtime uses ProjectFactory and adds scratchpad/effect-ontology, effect-imports owns a code/Markdown/export-map scanner, and allowlist-check loads explicit entry files. `isLawSourcePath` in Tasks.ts is only a changed-file routing predicate, and does not even cover native-runtime's scratchpad root or effect-imports' JS/MTS/CTS extensions. `collectTypeScriptFiles` in Lint.command.ts is a separate `.ts`-only recursive helper.

There are two distinct input declarations to consider:

1. **The package's own file surface** for the four active TS laws is `**/*.{ts,tsx}`, not just src/** and test/**. Root-level config/source TS and scripts are inside the repo-wide globs. Do not subtract test/generated/dist/declaration exclusions that run *after* Project loading. For infra the actual positive globs of these laws are `**/*.ts` (not TSX). For native/terse, docs is the explicit negative discovery glob. Broad positive package inputs are safe over-inclusion here; importing new code from a previously excluded file must also invalidate the task.
2. **The current implementation's cross-package reads** prevent calling the first list a complete pure per-package hash. effect-fn/frozen-grant-set preload the root tsconfig; native/terse use root compiler options; enabled effect-imports and Markdown mode read all foundation export maps. `--include` scopes diagnostics but does not remove every one of these shared reads. `--include-prefix` exists only for effect-imports, not all laws.

A conservative package-local starting set (explicit over-inclusion, not a claim that every path is read) is:

```json
[
  "**/*.{ts,tsx}",
  "package.json",
  "tsconfig*.json",
  "$TURBO_ROOT$/package.json",
  "$TURBO_ROOT$/bun.lock",
  "$TURBO_ROOT$/bunfig.toml",
  "$TURBO_ROOT$/tsconfig*.json",
  "$TURBO_ROOT$/packages/tooling/tool/cli/src/**",
  "$TURBO_ROOT$/packages/tooling/library/repo-utils/src/**",
  "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/**",
  "$TURBO_ROOT$/packages/foundation/**/package.json",
  "$TURBO_ROOT$/packages/foundation/**/src/**"
]
```

For **effect-fn/frozen-grant-set as implemented today**, additionally declare the root project's preload corpus (root tsconfig include, subject to its excludes). A conservative positive form is:

```json
[
  "$TURBO_ROOT$/**/*.ts",
  "$TURBO_ROOT$/**/*.tsx",
  "$TURBO_ROOT$/**/*.json"
]
```

That deliberately over-includes relative to `tsconfig.json:9`; the exact current preload patterns are `**/vitest.*.ts`, `apps/**/test/**/*.ts`, `apps/**/test/**/*.tsx`, `apps/**/test/**/*.json`, the corresponding packages test patterns, `syncpack.config.ts`, `*.ts`, `*.json`. To narrow to those, carry the root tsconfig exclusion list and updates to the root config in the task hash. A package include scope cannot honestly claim to eliminate this root preload until the scanner is changed. Also retain configuration extends/reference files and runtime helper dependencies outside the foundation subtree (common input convention).

For **native-runtime**, add `$TURBO_ROOT$/standards/effect-laws.allowlist.jsonc` as the generated policy's source-of-truth dependency and keep the **actual runtime input** `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts`, plus EffectLawsAllowlist schemas and NoNativeRuntimeHotspots. The JSONC is directly consumed by allowlist-check; native-runtime consumes the snapshot. A repo-wide native task additionally needs `$TURBO_ROOT$/scratchpad/effect-ontology/**/*.{ts,tsx}`. Explicit package --include omits that scan root, but still uses the shared snapshot.

For **effect-imports**, current default code mode returns early. If enabling a candidate task, use `**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, preserve foundation manifests and source graph above, and hash the installed effect manifest through reproducible dependency inputs. The Markdown mode's exact five root globs are in appendix A. A per-package source glob never captures that root-authored documentation corpus. Complete module-resolution reads for the export graph remain UNKNOWN without an import/read trace; do not certify a narrow hash merely because diagnostic scope is narrow.

For a future truly local syntax scanner, the production diagnostic-only exclusion list from TypeScriptSourceExclusions could be applied *before reading*. That is an implementation change; this census does not assume it has happened and makes no source edits. No TypeScript declaration build is needed for syntax-only visitors once reads are actually bounded; schema-first and deprecated-API ESLint are separate typed lanes.

## Q2 — Which shared ESLint inputs make rule edits rerun every package?

Both root imports execute regardless of which profile is selected (`eslint.config.mjs:1–2`). The source package exports point into src, so hashing only eslint.config.mjs or only the selected top-level profile file would miss rule/helper edits. Use a common shared-rule/config set:

```json
[
  "$TURBO_ROOT$/eslint.config.mjs",
  "$TURBO_ROOT$/tsdoc.json",
  "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/package.json",
  "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/**",
  "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/**",
  "$TURBO_ROOT$/package.json",
  "$TURBO_ROOT$/bun.lock"
]
```

This includes DocsESLintConfig, DeprecatedApisESLintConfig, RequireCategoryTagRule and shared policy helpers/snapshots (safe over-inclusion). Include any further transitive workspace runtime imports as described in the common convention. `BEEP_ESLINT_PROFILE` belongs in Turbo `env`; profile selection is not a file. If retaining the deprecated-API shard wrapper, also hash its Lint.command.ts and Labs constants (covered by the common CLI glob), and preserve the intended root cwd.

For **deprecated-apis**, add all relevant project-service configurations and the resolved declaration/source graph. A safe configuration superset is:

```json
[
  "package.json",
  "**/tsconfig*.json",
  "$TURBO_ROOT$/tsconfig*.json",
  "$TURBO_ROOT$/packages/**/tsconfig*.json",
  "$TURBO_ROOT$/apps/**/tsconfig*.json",
  "$TURBO_ROOT$/infra/**/tsconfig*.json",
  "$TURBO_ROOT$/packages/**/package.json",
  "$TURBO_ROOT$/apps/**/package.json",
  "$TURBO_ROOT$/infra/package.json"
]
```

Add referenced/extended configs outside these families when present. `parserOptions.projectService` may read declaration dependencies, sibling source via paths/references and root default-project include files; the manifests/configs alone do not hash changes to those types. Use dependency task hashes and `^transit` **with a verified source/declaration routing contract**; if building declarations is necessary, ensure the dependency task actually produces them. The repo-configs package itself exposes source and does not need dist just to import the ESLint config.

For **docs**, neither projectService nor project is enabled, and `@typescript-eslint/no-deprecated` is absent. `tsconfigRootDir` is used by eslint-plugin-tsdoc to locate `tsdoc.json`; it does not enable TypeScript semantic checking. Root/package tsconfigs are therefore not established semantic inputs for docs itself. Keeping the typed profile's config superset for both profiles is conservative, but should not justify a `^transit` requirement for docs. Neither `biome.jsonc` nor `.oxlintrc.json` is imported by these two ESLint profiles; hash them only if another wrapper actually reads them. The lint-rules Oxlint plugin is a separate lane, not automatically part of ESLint's rules.

Finally, package source inputs must account for ESLint default JS/MJS/CJS parsing plus the configured TS/TSX layers, tests where included, and global ignore behavior. Root rule globs are repo-relative; running ESLint from a package with the same imported config needs a validated cwd/config-base contract. Config hashing alone does not prove that the package's files are actually matched.
