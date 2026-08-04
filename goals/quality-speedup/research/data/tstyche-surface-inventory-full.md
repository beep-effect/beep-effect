# Tstyche removal: complete surface inventory

Static, read-only inventory for branch `chore/improve-speed-of-things`, captured 2026-08-03. No install, build, test, Turbo, or quality command was run. Bulk lists use `path:1` as the file locator; for empty `.gitkeep` files, `:1` is an explicit existence locator for a zero-line tracked file.

## Executive result

The removal is larger than deleting the known 142 `*.tst.ts` files. The live surface also contains 101 tracked `dtslint/.gitkeep` sentinels, one `Path.test-d.ts`, two configs inside `dtslint/`, two standalone `tsconfig.dtslint.json` files, 57 package `tsconfig.test.json` includes, 22 package manifests with `dtslint`/`type-test` scripts, a root Turbo `type-test` task, root-check and Test Unit lane wiring, two generators, lint/docgen exclusions, and active docs. The bulk file lists are exhaustive below.

The known statement that there are per-package `dtslint/tsconfig.json` files is not true on this branch: only `infra/dtslint/tsconfig.json:1` has that exact name. The other config inside a `dtslint` directory is `packages/foundation/modeling/md/dtslint/tsconfig.exports.json:1`; standalone configs are `tsconfig.dtslint.json:1` and `scratchpad/codemode/tsconfig.dtslint.json:1`.

## 1. Complete file/config inventory table

| Path | Kind | Exact keys or symbols | Action |
|---|---|---|---|
| `tstyche.json:2-103` | root config | `$schema`, 98 `testFileMatch` entries, `tsconfig` | Delete after removing both config writers. |
| `tsconfig.dtslint.json:6-9` | root config | app/package `dtslint/**/*.{ts,tsx}` includes | Delete. |
| `tsconfig.json:18-19` | root config | package `dtslint` includes | Remove both. This is the only root `tsconfig*.json` hit besides `tsconfig.dtslint.json`. |
| `package.json:263,323` | dependency/catalog | catalog version and root `devDependencies.tstyche` | Remove both keys. |
| `package.json:371` | script/lane | `beep:preflight` runs `quality dtslint-tsgo` | Remove that command. |
| `bun.lock:47,2971,7752` | dependency lock | root edge, catalog resolution, package record | Regenerate after manifest edits. |
| `turbo.json:141-145` | Turbo task | complete `type-test` task and `tstyche.json` input | Delete task. |
| `turbo.json:167-178,197-218` | Turbo config | audit input `tstyche.json`; audit/docgen outputs `dtslint/**` | Remove entries. |
| `knip.jsonc:54-57,106-109` | dead-code config | type-test comment, dtslint ignore/rationale | Remove/update; reassess dependency ignores at `knip.jsonc:136-141`. |
| `renovate.json:35-44` | dependency automation | `tstyche` group member | Remove. |
| `_typos.toml:42,45` | dictionary | `tstyche`, `dtslint` | Retain while immutable changelog/decision prose remains (`packages/foundation/capability/colors/CHANGELOG.md:15`, `standards/architecture/DECISIONS.md:940`), unless spelling proof shows safe removal. |
| `.cspell/third-party.txt:87`; `.cspell/tech-terms.txt:80` | dictionaries | `tstyche`, `dtslint` | Same retention caveat; not executable surface. |
| `cspell.json:97` | exclusion | `**/dtslint/**` | Remove after directory deletion. |
| `.fallowrc.jsonc:64,149-170` | exclusion/dependency rationale | dtslint ignore; Lexical/M365 comments | Remove/rewrite selectively. |
| `vitest.shared.ts:184-190` | coverage config | `**/dtslint/**` | Remove. |
| `AGENTS.md:26-28` (`CLAUDE.md` symlink) | agent law | test/dtslint alias rule | Rewrite for tests only. |
| `standards/ARCHITECTURE.md:60-66` | current standard | no dtslint/type-test app surface | Rewrite remaining prohibition. |
| `standards/architecture/08-testing.md:9-12` | current standard | architecture proof promises focused type tests | Edit to match the post-removal runtime-only proof surface. |
| `standards/architecture/DECISIONS.md:311-315,937-943` | decision history | past unit/type and tests/dtslint evidence | Historical-do-not-touch. |
| `.changeset/jsonschema-node-model.md:9`; `.changeset/safe-objects-travel.md:6` | pending release notes | promise runtime and type tests | Edit if changesets are still pending: remove the now-false type-test claim. |
| `standards/jsdoc-documentation.inventory.jsonc:49342-49350,52717-52725` | generated inventory | `runDtslintTsgoChecks`, `ROOT_TSTYCHE_TSCONFIG` | Regenerate after export deletion; this explains the mentions. |
| `infra/package.json:30-31` | scripts | Biome paths include dtslint | Remove path. |
| `infra/dtslint/.gitkeep:1`; `infra/dtslint/tsconfig.json:1-4` | sentinel/config | empty dir and `*.tst.*` include | Delete. |
| `scratchpad/codemode/tstyche.json:2-4`; `scratchpad/codemode/tsconfig.dtslint.json:1-10` | experiment configs | local tstyche/dtslint configs | Delete. |
| `scratchpad/codemode/dtslint/Codemode.tst.ts:1-4` | experiment test | imports tstyche | Delete. |
| `packages/foundation/modeling/md/dtslint/tsconfig.exports.json:1-3` | special config | `exports.tst.ts` include | Delete. |
| `packages/foundation/ui-system/form/dtslint/Path.test-d.ts:1-2` | non-tstyche dtslint test | path type assertions | Delete; outside the 142-file count. |
| `packages/tooling/library/repo-utils/src/schemas/TypeScriptSourceExclusions.ts:38-42` | source exclusion | `/dtslint/` | Remove. |
| `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:93-100` | ESLint config | app dtslint globs | Remove two globs. |
| `packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts:251-255` | ESLint config | dtslint ignore | Remove. |
| `packages/tooling/tool/docgen/src/ProofManifest.ts:287-293` | docgen input | dtslint glob | Remove. |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:37-43` | docgen selection | `dtslint/` prefix | Remove. |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:48-52` | docgen exclusion | `/dtslint/` | Remove. |
| `packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts:33-44` | lint exclusion | dtslint directory | Remove text/entry. |
| `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts:66-72,305-333` | lint command | regexes/messages cover dtslint | Narrow to test files. |
| `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstArbitraryCoverage.ts:61-65` | lint exclusion | `/dtslint/` | Remove. |
| `packages/tooling/tool/cli/test/lint-command.test.ts:1210-1345` | CLI tests | dtslint fixture/messages | Delete dtslint case and update messages. |
| `.claude/agents/modularization-analyst.md:35`; `.claude/skills/quality-review-fix-loop/references/reviewer-roles.md:51` | active agent/skill docs | dtslint coverage | Update. |
| current README set (listed below) | docs | dtslint/type-test guidance | Edit all listed hits. |
| `packages/drivers/box/scripts/box.surface.ts:59` | comment | test/dtslint surface | Rewrite. |
| `packages/foundation/modeling/lexical/src/Lexical.model.ts:11-12` | JSDoc | dtslint-only dependency claim | Rewrite; unit tests use lexical at `packages/foundation/modeling/lexical/test/Lexical.model.test.ts:34`. |
| all 142 `*.tst.ts` files (bulk A) | tests | 141 import tstyche; RDF is a plain probe at `packages/foundation/modeling/rdf/dtslint/Rdf.tst.ts:1-5` | Delete all; zero `*.tst.tsx`. |
| all 101 `dtslint/.gitkeep` files (bulk B) | sentinels | tracked empty directories | Delete all. |
| all 57 `tsconfig.test.json` files (bulk C) | package configs | line 4 includes dtslint | Remove include and fix generators. |
| all 22 package manifests (bulk D) | scripts | `dtslint`, `dtslint:exports`, and/or `type-test` | Remove; none declares a tstyche dependency. |

## 2. Lane wiring map

### `dtslint-tsgo` definition and actual command

`dtslintSearchRoots` is `apps`, `packages`, and `tooling` (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:249`). `runDtslintTsgoChecks` recursively selects paths containing `/dtslint/` whose basename matches `/\.tst\.[^.]+$/` (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1600-1614`). It excludes `scratchpad/codemode` and `Path.test-d.ts`.

The runner creates `node_modules/.tmp/check:dtslint:tsgo/dtslint.tsconfig.json`, extending root `tsconfig.json`, with empty references, exact includes, empty excludes, `composite:false`, `incremental:false`, `noEmit:true`, and root `rootDir`; it executes `node_modules/.bin/tsgo -p <synthetic-config> [...extraArgs]` and removes the config (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1538-1584,1621-1630`). The command is registered at `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2064-2070,2325`.

### Root quality and hosted CI

Root `bun run check` is `beep-cli check` (`package.json:377`). At root, `rootCheckSteps` runs Turbo `check`, then repo-wide `quality dtslint-tsgo`, `test-tsgo`, and `tsgo-smoke` when unscoped (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1245-1258`). Remove the dtslint step and expectation at `packages/tooling/tool/cli/test/quality-tasks.test.ts:772-774`.

No workflow invokes the literal `dtslint-tsgo` command. Hosted `Check` is matrix id `check` (`.github/workflows/check.yml:46-77`) and dispatches `bun run beep ci lane check` (`.github/workflows/check.yml:195-215`); that lane is only Turbo root `check` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:726-731`), bypassing root `beep-cli check`'s repo-wide extras.

Hosted CI still runs tstyche through `Test Unit` (`.github/workflows/check.yml:78-83`). `ci lane test-unit` passes `--unit --types` to root `test` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:848`); the parser maps `--types` to Turbo `type-test` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:207-220,1536-1550`). Turbo defines it at `turbo.json:141-145`; 22 workspace scripts invoke tstyche. Remove `--types`, the type-selection branches, and expectations at `packages/tooling/tool/cli/test/ci-lane.test.ts:111` and `packages/tooling/tool/cli/test/quality-tasks.test.ts:375,1214-1226,1592-1608`.

Root `beep:preflight` explicitly invokes `quality dtslint-tsgo` (`package.json:371`) and must be shortened.

### Yeet verify/repair

Yeet full verify selects `pre-push` (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:345-349`), executing `bun run beep quality github-checks pre-push` (`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:137-143`). Pre-push includes `githubCheckQualityLanes` (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:612-626`), which run root `bun run check` and `bun run test` (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:191-211`). Thus Yeet verify includes both dtslint-tsgo nested in check and tstyche type-test nested in test.

Yeet repair feedback adds `--types` for test (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:284-288`), with an expectation at `packages/tooling/tool/cli/test/yeet.test.ts:786`. Dev/review-fix does likewise at `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:687,762`. Remove these. The scoped Turbo proof domain/defaults contain `type-test` (`packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts:21-23`) and help names it (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2181`); remove both.

## 3. Codegen map

### `beep create-package`

Package-like/runtime-proof scaffolds create `dtslint/.gitkeep` (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:395-409,470-506`). Remove it from `PACKAGE_FILES`, `PACKAGE_DIRECTORIES`, and `gitkeepFilesFor`. The test-config template emits dtslint (`packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.test.json.hbs:4`); the README and real-app AGENTS templates mention it (`packages/tooling/tool/cli/src/commands/CreatePackage/templates/README.md.hbs:36`, `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:13`). Edit all three.

Create-package calls shared `syncTsconfigAtRoot` after scaffolding (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1148-1157`), while dry-run text promises tstyche updates (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1052-1064`); remove that text and strip the shared planner.

`ConfigUpdater.ts` is a second, source-only updater exposed through `packages/tooling/tool/cli/src/test/CreatePackage.test-kit.ts:8`. Strip `tstycheConfig`, patterns, `updateTstycheConfig`, and orchestration at `packages/tooling/tool/cli/src/commands/CreatePackage/ConfigUpdater.ts:46-55,128-179,228-243,420-535,579-584,627-632`. Update `packages/tooling/tool/cli/test/create-package-security.test.ts:69-72,118` and `packages/tooling/tool/cli/test/create-package.test.ts:66-102,299,349-389,505-511,570-582,595-596,633-645,664-665,704-714,768-769,880-981,1072-1073`.

### `beep tsconfig-sync`

Workspace discovery records dtslint-directory existence (`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:387-392,439-444`; schema `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts:878-886`). Delete the field and discovery.

Delete tstyche readers/builders and planner at `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:218-290,741-784,1146-1147`. Remove the constant/tagged cases at `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts:31-42,525-584,634-648,691-701,758-772`, service planning at `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.service.ts:22-34,110-119`, and command description at `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.command.ts:93-96`. Rewrite `packages/tooling/tool/cli/test/tsconfig-sync.test.ts:34-41,142-144,158,189-190,237-321,389,426-489,607,746`.

Post-removal invariant: `tsconfig-sync --check` must not read deleted `tstyche.json` and must have no `root-tstyche` variant. Today the planner unconditionally reads it (`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:755-765`); deleting only the file would make check fail, not return 0.

### `beep architecture`

Package-shell generation emits dtslint in `tsconfig.test.json` and writes a sentinel (`packages/tooling/tool/cli/src/commands/Architecture/internal/PackageShell.ts:259-275,498-505`). Accepted proof manifests include every sentinel and 14 concrete architecture `.tst.ts` templates (`packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts:103-108,179,221,257,337,397,447,507,575,613,643,675,707,727,951`); remove them before deleting source templates. Retargeting classifies the sentinel as scaffold (`packages/tooling/tool/cli/src/commands/Architecture/internal/TemplateRetarget.ts:34-48`); remove it.

Update `packages/tooling/tool/cli/test/architecture-operation-plan.test.ts:75-79,155-158` and `packages/tooling/tool/cli/test/fixtures/architecture-operation-plan/accepted-work-item-manifest.json:12-16`. Otherwise plans request deleted templates or regenerate the directory.
## 4. Dependency map

Tstyche has exactly one declared dependency edge: root `devDependencies.tstyche = "catalog:"` (`package.json:323`), backed by catalog version `^7.2.2` (`package.json:263`). The lock mirrors the edge, catalog value, and `tstyche@7.2.2` record (`bun.lock:47,2971,7752`). No per-package dependency section contains tstyche; package occurrences are scripts only (bulk D).

Removing root dependency/catalog entries and scripts permits lock regeneration to remove the edge and package record. Remove it from Renovate grouping (`renovate.json:35-44`).

Secondary dependency cleanup discovered from deleted tests:

- `packages/drivers/m365/package.json:77` declares `@microsoft/microsoft-graph-types`, whose only source import is `packages/drivers/m365/dtslint/M365.tst.ts:31`; remove that dependency and its exceptions (`.fallowrc.jsonc:168-170`, `knip.jsonc:136`).
- `packages/foundation/modeling/lexical/package.json:81-88` declares conformance dependencies. Do not remove all: `@lexical/list`, `@lexical/table`, and `lexical` remain in unit tests (`packages/foundation/modeling/lexical/test/Lexical.model.test.ts:27,34-35`). `@lexical/code`, `@lexical/link`, and `@lexical/rich-text` are imported by the deleted test (`packages/foundation/modeling/lexical/dtslint/Lexical.tst.ts:44-52`) but nowhere else in that package; remove those three package-local edges, then adjust `.fallowrc.jsonc:149-156` and `knip.jsonc:137-141`. Root catalog versions remain needed by editor/UI workspaces.
- Other external imports in deleted tests—`@effect/ai-anthropic`, `@lexical/table`, `next`—retain live consumers (`packages/drivers/anthropic/src/Anthropic.service.ts:8`, `packages/foundation/modeling/lexical/test/Lexical.model.test.ts:35`, `packages/tooling/policy-pack/repo-configs/src/next/NextConfig.model.ts:18`) and are not removal candidates solely from this task.

## 5. Removal order plan

1. Strip tstyche/dtslint generation from create-package, tsconfig-sync, and architecture, including schemas, templates, fixtures, and descriptions (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:395-506`, `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.service.ts:110-119`, `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts:103-108`).
2. Remove runtime lane wiring: dtslint-tsgo, root-check adapter, Test Unit `--types`, dev/review/Yeet flags, Turbo proof domain, CLI help/README, preflight, and tests (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1600-1630,2064-2070`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1245-1272`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:848`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:284-288`).
3. Delete `tstyche.json:1`, `tsconfig.dtslint.json:1`, `scratchpad/codemode/tstyche.json:1`, and `scratchpad/codemode/tsconfig.dtslint.json:1`; edit `tsconfig.json:18-19`.
4. Delete all 142 `.tst.ts`, `Path.test-d.ts`, two configs inside dtslint directories, and 101 sentinels (bulk A/B). Remove empty directories.
5. Remove dtslint from all 57 test tsconfigs and both generators (`packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.test.json.hbs:4`, `packages/tooling/tool/cli/src/commands/Architecture/internal/PackageShell.ts:262`).
6. Remove all 22 package scripts and root Turbo task (`turbo.json:141-145`).
7. Remove root tstyche dependency/catalog and proven package-local orphans; regenerate `bun.lock` (`package.json:263,323`, `packages/drivers/m365/package.json:77`, `packages/foundation/modeling/lexical/package.json:81-88`).
8. Clean Turbo/Knip/Fallow/CSpell/Vitest/ESLint/repo-utils/docgen/lint inputs and exclusions (`turbo.json:167-218`, `knip.jsonc:54-109`, `.fallowrc.jsonc:64,149-170`).
9. Update active docs, skills, templates, and READMEs. Preserve goal/exploration history, decision history, and changelog history (`standards/architecture/DECISIONS.md:940`, `packages/foundation/capability/colors/CHANGELOG.md:15`).
10. Regenerate JSDoc inventory after exported symbols disappear (`standards/jsdoc-documentation.inventory.jsonc:49342-49350,52717-52725`).
11. Static residue gate: search tracked source for `tstyche|dtslint|\.tst\.|type-test|--types`, classifying only retained history/dictionaries.
12. In the later uncontaminated pass, refresh lockfile, run `bun run beep tsconfig-sync --check` and require 0, then the authorized quality/Yeet ladder. This inventory ran none.

## 6. Surprises / stop-condition hazards

- Hosted `check.yml` has no literal dtslint-tsgo job. Tstyche is hidden under Test Unit `--types`; tsgo dtslint is hidden under root check and Yeet pre-push (`.github/workflows/check.yml:78-83,195-215`; `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:848`; `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1245-1250`).
- `packages/tooling/tool/cli/package.json:130` runs `cd ../../../.. && bunx tstyche`, so one workspace task re-runs the root config rather than a local file, potentially duplicating other workspace scripts.
- 57 package test tsconfigs include dtslint though only one exact `dtslint/tsconfig.json` exists. Both generators emit the include (`packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.test.json.hbs:4`, `packages/tooling/tool/cli/src/commands/Architecture/internal/PackageShell.ts:262`).
- 101 sentinels matter semantically: tsconfig-sync uses directory existence, not test existence, as coverage signal (`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:256-289,390-392`). Deleting only tests would preserve/rebuild empty matches.
- `packages/foundation/ui-system/form/dtslint/Path.test-d.ts:1` is outside the 142 count and unselected by dtslint-tsgo.
- `packages/foundation/modeling/rdf/dtslint/Rdf.tst.ts:1-5` is the sole `.tst.ts` without a tstyche import, but remains configured.
- `scratchpad/codemode` is invisible to root tstyche and dtslint-tsgo (`tstyche.json:4-101`, `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:249,1605-1611`) and needs explicit deletion.
- Architecture codegen names 14 concrete test templates (`packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts:179,221,257,337,397,447,507,575,613,643,675,707,727,951`).
- JSDoc inventory snapshots two exported symbols; it is generated fallout, not config (`standards/jsdoc-documentation.inventory.jsonc:49342-49350,52717-52725`).
- M365 Graph types become statically orphaned (`packages/drivers/m365/package.json:77`, `packages/drivers/m365/dtslint/M365.tst.ts:31`). Lexical cleanup is selective because unit tests retain several packages (`packages/foundation/modeling/lexical/test/Lexical.model.test.ts:27,34-35`).
- No `.claude/dtslint/**` or `.codex/dtslint/**` exists. Active Claude hits are `.claude/agents/modularization-analyst.md:35` and `.claude/skills/quality-review-fix-loop/references/reviewer-roles.md:51`; there are no active Codex hits.
- Dictionary terms are retention dependencies for immutable prose, not executable surface. Blind deletion may break spelling lanes (`_typos.toml:42,45`, `standards/architecture/DECISIONS.md:940`, `packages/foundation/capability/colors/CHANGELOG.md:15`).
- A broad case-insensitive `type test` residue search has six lexical false positives that must not be edited: four `type TestRespond` aliases (`packages/drivers/hubspot/test/HubSpot.service.test.ts:29`, `packages/drivers/m365/test/M365.service.test.ts:51`, `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts:106`, `packages/drivers/sanity/test/Sanity.service.test.ts:32`), `type TestEffect` (`packages/foundation/modeling/utils/test/Glob.test.ts:13`), and `TestTypecheckBlindSpotKind` (`packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts:118`).

## Bulk inventory A: all 142 `.tst.ts` files

| Path | Kind | Exact surface | Action |
|---|---|---|---|
| `apps/architecture-lab-proof/dtslint/ArchitectureLabProof.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/_internal/db-admin/dtslint/ArchitectureLabMigrationTarget.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/agents/client/dtslint/Chat.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/agents/domain/dtslint/AgentsDomain.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/agents/server/dtslint/AgentsServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/agents/use-cases/dtslint/ProfessionalRuntime.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/client/dtslint/WorkItemClient.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/config/dtslint/WorkItemConfig.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/domain/dtslint/WorkItem.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/domain/dtslint/WorkPriority.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/domain/dtslint/Worker.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/server/dtslint/WorkItemServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/server/dtslint/WorkerServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/tables/dtslint/WorkItemTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/tables/dtslint/WorkerTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/ui/dtslint/WorkItemViewModel.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/use-cases/dtslint/WorkItem.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/architecture-lab/use-cases/dtslint/Worker.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/domain/dtslint/SyncConflict.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/domain/dtslint/SyncCursor.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/domain/dtslint/SyncItem.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/domain/dtslint/SyncOperation.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/server/dtslint/SyncConflictServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/server/dtslint/SyncCursorServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/server/dtslint/SyncItemServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/server/dtslint/SyncOperationServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/server/dtslint/VaultSyncEngineServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/tables/dtslint/SyncConflictTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/tables/dtslint/SyncCursorTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/tables/dtslint/SyncItemTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/tables/dtslint/SyncOperationTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/use-cases/dtslint/Sync.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/use-cases/dtslint/SyncConflict.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/use-cases/dtslint/SyncCursor.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/use-cases/dtslint/SyncItem.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/documents/use-cases/dtslint/SyncOperation.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/acp/dtslint/Acp.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/anthropic/dtslint/Anthropic.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/box/dtslint/Box.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/drizzle/dtslint/Drizzle.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/drizzle/dtslint/EntityTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/face-detection/dtslint/FaceDetection.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/ffmpeg/dtslint/FFmpeg.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/firecrawl/dtslint/Firecrawl.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/hubspot/dtslint/HubSpot.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/libpff/dtslint/Libpff.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/m365/dtslint/M365.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/openai-compat/dtslint/OpenAiCompat.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/pacer/dtslint/Pacer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/phoenix/dtslint/Phoenix.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/postgres/dtslint/Postgres.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/runpod/dtslint/Runpod.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/sanity/dtslint/Sanity.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/tika/dtslint/Tika.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/venice-ai/dtslint/VeniceAI.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/drivers/xai/dtslint/XAi.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/epistemic/config/dtslint/EpistemicConfig.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/epistemic/domain/dtslint/EpistemicDomain.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/epistemic/domain/dtslint/ExecutionAuthority.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/epistemic/tables/dtslint/EpistemicTables.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/epistemic/use-cases/dtslint/ContradictionTriageBoundaries.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/capability/chalk/dtslint/Chalk.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/capability/colors/dtslint/Colors.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/capability/file-processing/dtslint/FileProcessing.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/html/dtslint/Html.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/identity/dtslint/Identity.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/lexical/dtslint/Lexical.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/md/dtslint/Md.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/md/dtslint/exports.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/pandoc-ast/dtslint/PandocAst.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/rdf/dtslint/Rdf.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/AtURI.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/CauseTaggedError.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/DateTimeUtcFromValid.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Duration.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/EntitySchema.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/FileName.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/FilePath.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Fn.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Glob.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Graph.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Int.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/JSONSchema.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Json.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/LiteralKit.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/MappedLiteralKit.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Markdown.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/MutableHashMap.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/MutableHashSet.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Number.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Port.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/PromiseSchema.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/ProtobufScalars.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/SafeObject.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/SchemaUtils.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Semver.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Sha256.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/StatusCauseTaggedErrorClass.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/String.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/TaggedErrorClass.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Topology.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/Transformations.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/TypedArrays.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/schema/dtslint/VariantSchema.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/utils/dtslint/Array.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/utils/dtslint/Errors.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/utils/dtslint/Option.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/utils/dtslint/Predicate.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/utils/dtslint/Str.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/modeling/utils/dtslint/Struct.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/primitive/data/dtslint/keyboard-shortcuts.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/primitive/data/dtslint/mime-types.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/foundation/ui-system/editor/dtslint/Editor.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/law-practice/domain/dtslint/LawPracticeDomain.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/ontology/domain/dtslint/Session.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/ontology/server/dtslint/SessionServer.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/ontology/use-cases/dtslint/Session.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/domain/dtslint/EntityKernel.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/domain/dtslint/IdentityNamespaces.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/domain/dtslint/LocalDate.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/domain/dtslint/OnePasswordReference.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/domain/dtslint/Organization.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/domain/dtslint/RootBarrel.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/domain/dtslint/UserMembership.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/shared/tables/dtslint/OrganizationTable.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/BiomeJson.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/DependencyIndex.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/Errors.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/FsUtils.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/Graph.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/PackageJson.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/Root.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/TsConfig.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/UniqueDeps.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/library/repo-utils/dtslint/Workspaces.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/policy-pack/repo-configs/dtslint/NextConfig.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/tooling/tool/cli/dtslint/Files.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/workspace/domain/dtslint/WorkspaceDomain.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/workspace/server/dtslint/ThreadStore.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/workspace/tables/dtslint/WorkspaceTables.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `packages/workspace/use-cases/dtslint/Thread.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |
| `scratchpad/codemode/dtslint/Codemode.tst.ts:1` | test file | `*.tst.ts` type-test surface | Delete file. |

## Bulk inventory B: all 101 tracked `dtslint/.gitkeep` files

| Path | Kind | Exact surface | Action |
|---|---|---|---|
| `apps/architecture-lab-proof/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `infra/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/_internal/db-admin/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/agents/client/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/agents/server/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/agents/tables/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/architecture-lab/client/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/architecture-lab/config/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/architecture-lab/domain/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/architecture-lab/server/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/architecture-lab/tables/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/architecture-lab/ui/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/architecture-lab/use-cases/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/documents/domain/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/documents/server/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/documents/tables/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/documents/use-cases/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/acp/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/ai-provider-cli/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/box/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/courtlistener/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/discord/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/dol/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/drizzle/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/ecfr/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/exiftool/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/federal-register/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/firecrawl/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/gov-legal-mcp/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/govinfo/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/hubspot/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/libpff/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/m365-mcp/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/m365/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/nlp-mcp/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/obs/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/onepassword-cli/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/openai-compat/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/openclaw/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/pacer/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/pglite/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/phoenix/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/postgres/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/pretext/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/protobuf/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/rdf-canonize/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/runpod/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/sanity/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/tailscale/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/tika/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/uspto-mcp/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/uspto/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/venice-ai/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/wink/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/drivers/xai/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/epistemic/client/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/epistemic/config/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/epistemic/ui/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/api-transport/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/chalk/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/colors/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/file-processing/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/langextract/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/mcp-kit/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/nlp-processing/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/observability/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/capability/semantic-web/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/html/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/identity/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/lexical/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/md/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/nlp/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/ontology/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/pandoc-ast/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/rdf/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/schema/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/modeling/utils/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/primitive/data/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/primitive/types/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/ui-system/dock-react/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/ui-system/dock/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/ui-system/editor/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/ui-system/form/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/foundation/ui-system/ui/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/law-practice/tables/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/ontology/client/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/ontology/config/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/ontology/domain/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/ontology/server/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/ontology/ui/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/ontology/use-cases/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/shared/domain/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/shared/tables/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/tooling/library/ai-sync/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/tooling/library/qa-capture/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/tooling/policy-pack/repo-configs/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/tooling/test-kit/fc-runs/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/tooling/test-kit/test-utils/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/tooling/tool/docgen/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/workspace/server/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |
| `packages/workspace/use-cases/dtslint/.gitkeep:1` | empty sentinel | tracked `dtslint/` directory | Delete file/directory. |

## Bulk inventory C: all 57 `tsconfig.test.json` files containing dtslint

| Path | Kind | Exact surface | Action |
|---|---|---|---|
| `packages/_internal/db-admin/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/agents/tables/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/documents/domain/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/documents/server/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/documents/use-cases/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/box/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/courtlistener/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/doc-text/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/dol/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/ecfr/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/exiftool/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/federal-register/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/firecrawl/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/gov-legal-mcp/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/govinfo/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/libpff/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/m365-mcp/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/m365/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/nlp-mcp/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/obs/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/openclaw/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/pacer/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/pglite/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/pretext/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/protobuf/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/tailscale/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/tika/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/uspto-mcp/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/uspto/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/venice-ai/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/wink/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/drivers/xai/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/epistemic/client/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/epistemic/config/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/epistemic/tables/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/epistemic/ui/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/capability/api-transport/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/capability/file-processing/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/capability/langextract/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/capability/mcp-kit/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/modeling/html/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/modeling/lexical/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/modeling/ontology/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/modeling/pandoc-ast/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/modeling/provenance/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/modeling/rdf/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/ui-system/dock-react/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/ui-system/dock/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/ui-system/editor/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/foundation/ui-system/form/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/law-practice/tables/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/ontology/client/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/ontology/config/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/ontology/ui/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/tooling/library/ai-sync/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/tooling/library/qa-capture/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |
| `packages/tooling/test-kit/fc-runs/tsconfig.test.json:4` | package test config | `include` contains `dtslint` | Edit line 4 to remove `dtslint`. |

## Bulk inventory D: all 22 package manifests with type-test scripts

| Path | Kind | Exact surface | Action |
|---|---|---|---|
| `packages/drivers/acp/package.json:20,33,40` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/anthropic/package.json:20,30,35` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/box/package.json:20,34,40` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/drizzle/package.json:20,31,37` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/firecrawl/package.json:20,32,38` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/hubspot/package.json:31,36` | package manifest | `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/m365/package.json:31,38` | package manifest | `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/openai-compat/package.json:20,31,37` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/pacer/package.json:20,32,38` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/phoenix/package.json:20,31,37` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/postgres/package.json:20,31,37` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/runpod/package.json:20,32,38` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/sanity/package.json:31,36` | package manifest | `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/venice-ai/package.json:20,28,38` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/drivers/xai/package.json:20,32,38` | package manifest | `beep:audit`, `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/foundation/modeling/html/package.json:31` | package manifest | `dtslint` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/foundation/modeling/lexical/package.json:35,39` | package manifest | `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/foundation/modeling/md/package.json:19,20,26` | package manifest | `dtslint`, `dtslint:exports`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/foundation/modeling/pandoc-ast/package.json:33,39` | package manifest | `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/foundation/ui-system/editor/package.json:33,39` | package manifest | `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/tooling/policy-pack/repo-configs/package.json:18,19` | package manifest | `dtslint`, `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |
| `packages/tooling/tool/cli/package.json:130` | package manifest | `type-test` scripts invoke tstyche/dtslint/type-test | Edit cited lines: delete the dedicated scripts and remove `type-test` from any aggregate `beep:audit` command. |

## Active README/doc hit list

These are current operational docs/templates, not goal/exploration history. Edit cited lines except the historical changelog/decision records classified above.

| Path | Kind | Exact surface | Action |
|---|---|---|---|
| `apps/architecture-lab-proof/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/agents/server/README.md:46` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/architecture-lab/client/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/architecture-lab/config/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/architecture-lab/domain/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/architecture-lab/server/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/architecture-lab/tables/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/architecture-lab/ui/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/architecture-lab/use-cases/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/documents/tables/README.md:38` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/acp/README.md:77` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/ai-provider-cli/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/box/README.md:89` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/courtlistener/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/discord/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/dol/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/drizzle/README.md:94` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/ecfr/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/exiftool/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/federal-register/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/firecrawl/README.md:50` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/gov-legal-mcp/README.md:70` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/govinfo/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/hubspot/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/libpff/README.md:89` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/m365-mcp/README.md:39` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/m365/README.md:45` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/nlp-mcp/README.md:65` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/obs/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/onepassword-cli/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/openai-compat/README.md:123,132` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/openclaw/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/pacer/README.md:80` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/pglite/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/phoenix/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/postgres/README.md:33` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/pretext/README.md:79` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/protobuf/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/runpod/README.md:55` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/sanity/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/tailscale/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/tika/README.md:73` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/uspto-mcp/README.md:63` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/uspto/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/venice-ai/README.md:61` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/wink/README.md:86` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/drivers/xai/README.md:70` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/epistemic/tables/README.md:45` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/capability/api-transport/README.md:88` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/capability/file-processing/README.md:68` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/capability/mcp-kit/README.md:107` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/modeling/lexical/README.md:149,153,8` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/modeling/md/README.md:117,120` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/modeling/ontology/README.md:49` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/modeling/pandoc-ast/README.md:127,132` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/ui-system/dock/README.md:41` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/foundation/ui-system/form/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/ontology/domain/README.md:50` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/ontology/server/README.md:41` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/ontology/use-cases/README.md:37` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/tooling/library/qa-capture/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/tooling/test-kit/fc-runs/README.md:39` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/tooling/tool/cli/README.md:118,448,471` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/workspace/server/README.md:47` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/workspace/tables/README.md:41` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |
| `packages/workspace/use-cases/README.md:36` | current README | dtslint/tstyche/type-test guidance | Edit cited lines. |

## Historical records: do NOT edit

Every `goals/**` and `explorations/**` hit is historical/packet evidence. The exhaustive locators below are preserved; multiple locators on a path mean multiple matching lines.

| Path | Kind | Exact surface | Action |
|---|---|---|---|
| `explorations/_gold-intake/HANDOFF-PROMPTS.md:142` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/agent-chat-interface/BRIEF.md:44` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/agent-chat-interface/MAP.md:26` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/agent-pipeline-velocity/research/baseline-pipeline.md:14,16` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/atlas-synthesis/synthesis/23-external-codebase-lineage.md:140` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/domain-layer-hardening/RESEARCH.md:102` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/domain-layer-hardening/synthesis/10-shared-kernel-audit.md:30` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/identity-as-iri/research/11-audit-identity-coupling.md:128,131,132,135,136,137,219,230` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/mcp-auth-gated-registration/research/conditional-credential-keyed-toolkit-composition.md:86` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/mcp-auth-gated-registration/reviews/2026-07-01-codex-verification.md:71` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/multi-provider-llm-dispatch-fallback/DECISIONS.md:109,293,302,98` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/multi-provider-llm-dispatch-fallback/MAP.md:32` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/multi-provider-llm-dispatch-fallback/RESEARCH.md:264,471` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/multi-provider-llm-dispatch-fallback/reviews/2026-06-29-codex-research.md:7` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/uspto-patent-driver-depth/RESEARCH.md:226` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `explorations/uspto-patent-driver-depth/reviews/2026-06-29-codex-research.md:7` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/INDEX.md:37` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/agent-execution-authority/PLAN.md:99` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/beep-schema-topology/PLAN.md:122,58,65,87,99` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/beep-schema-topology/SPEC.md:150` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/beep-schema-topology/ops/manifest.json:164` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-driver/GOAL.md:64,68` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-driver/PLAN.md:228,238,243,265` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-driver/README.md:99` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-driver/SPEC.md:290,305` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-driver/history/2026-07-14-closure-reconciliation.md:19` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-driver/ops/manifest.json:265` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-typecheck-cost/SPEC.md:212,63` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/box-typecheck-cost/ops/manifest.json:83` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/canonical-slice-factory/ops/codex-handoff-prompt.md:82` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/canvas/PLAN.md:77` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/canvas/history/outputs/pr-quality-review-loop.md:106,150,176` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/citation-extraction-engine/SPEC.md:176,293,501,512,527,531` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/citation-extraction-engine/research/PARITY_METHOD.md:163,302` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/citation-extraction-engine/research/SCHEMA_DISPOSITION.md:16,229,239,26,30` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/desktop-chat-surface/history/2026-06-14-implementation-progress.md:168` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/desktop-chat-surface/history/reflections/2026-06-14-claude.md:145,16,203,256,26,32,96` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/desktop-chat-surface/research/2026-07-31-usage-record-capture-design.md:50` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/dock-substrate-landing/SPEC.md:51` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/effect-child-process-hardening/research/2026-07-29-inventory.md:22,30,6` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/effect-child-process-hardening/research/2026-07-30-verification.md:106,141,152,163,56` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/epistemic-bitemporal-edge-core/history/2026-07-25-p0-verdict.md:69` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md:149,150,15` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/epistemic-bitemporal-edge-core/ops/handoffs/p0-to-p1-handoff.md:113` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/fallow-quality-enforcement/research/knip-parity.jsonc:54` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/file-processing-capability/PLAN.md:99` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/file-processing-capability/research/p3-libpff-design.md:185,247` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/firecrawl-driver/GOAL.md:63,73` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/firecrawl-driver/PLAN.md:112,259,274,279,302` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/firecrawl-driver/README.md:15,91` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/firecrawl-driver/SPEC.md:360,379` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/firecrawl-driver/history/reflections/2026-07-11-claude.md:39` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/firecrawl-driver/ops/manifest.json:257,277` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/form/README.md:83` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/form/research/2026-06-18-codebase-grounding.md:36,43` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/identity-iri-core/history/p0-harness-evidence.md:31` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/identity-iri-fold/PLAN.md:12` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/identity-iri-fold/SPEC.md:62` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/identity-iri-fold/history/p0-p2-evidence.md:103,105,33` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/identity-iri-fold/history/reflections/2026-08-01-claude.md:50,60` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/langextract-capability/PLAN.md:31` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/langextract-capability/SPEC.md:48` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/langextract-capability/research/README.md:26` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/langextract-capability/research/reports/testing-quality.md:14` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/law-practice-office-action-spike/README.md:81` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/legal-document-intake/README.md:90` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/lint-toolchain-modernization/history/reflections/2026-06-21-claude.md:26,27,37,68,69` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/m365-driver/README.md:41,49,50` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/m365-driver/history/reflections/2026-06-18-codex.md:30,42,80` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/m365-driver/ops/manifest.json:73` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/mcp-kit/history/2026-07-01-p0-verification.md:109,158,160,161` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-launch/PLAN.md:46,70,77` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-launch/README.md:13` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-launch/SPEC.md:92` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-launch/history/outputs/2026-07-14-proof-lane.md:100,21,34,84,87,90` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-launch/history/reflections/2026-07-14-codex.md:15,31,39` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-launch/ops/manifest.json:34,84` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-production-hardening/PLAN.md:50` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-production-hardening/history/outputs/local-closure-evidence.md:17` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/oip-web-production-hardening/ops/manifest.json:97` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/one-round-loop/SPEC.md:132` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/one-round-loop/tasks/tasks.jsonc:100` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/ontology-agent-surface/history/2026-07-11-p1-toolkit.md:128` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/ontology-agent-surface/history/2026-07-11-p2-transport.md:181,197` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/ontology-agent-surface/history/2026-07-11-p3-harden-close.md:194` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/ontology-interop-roadmap/PLAN.md:27,63` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/ontology-interop-roadmap/research/roadmap-synthesis.md:77` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/ontology-workbench/history/2026-07-09-p2-explorer-editor.md:62` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/ontology-workbench/history/2026-07-09-p5-validation-provenance.md:159` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/pandoc-ast-foundation/GOAL.md:42` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/pandoc-ast-foundation/PLAN.md:13,41` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/pandoc-ast-foundation/README.md:59` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/pandoc-ast-foundation/SPEC.md:58,68` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/pandoc-ast-foundation/history/reflections/2026-07-11-claude.md:48` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/pandoc-ast-foundation/ops/manifest.json:68` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/provenance-shared-claim-kernel/README.md:42,47` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/provenance-shared-claim-kernel/history/reflections/2026-06-18-claude.md:10,11,25,53,60,77,84,93,94` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/quality-speedup/GOAL.md:1,26,27,36,60,7` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/quality-speedup/PLAN.md:11,12` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/quality-speedup/README.md:12,37,48` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/quality-speedup/SPEC.md:10,112,116,118,42,43,73,74,77,80,81,8,9` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/quality-speedup/ops/manifest.json:13,34,55,57,83,84` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:10385,10386,10387,10388,10389,10390,10391,10392,10393,10394,10395,10396,10397,10398,10399,10400,10401,10402,10403,10404,10405,10930,10931,10932,10933,10934,10935,10936,10937,10938,10939,10940,10941,10942,10943,10944,10945,10946,10947,10948,10949,10950,10,11475,11476,11477,11478,11479,11480,11481,11482,11483,11484,11485,11486,11487,11488,11489,11490,11491,11492,11493,11494,11,12019,12020,12021,12022,12023,12024,12025,12026,12027,12028,12029,12030,12031,12032,12033,12034,12035,12036,12037,12038,1238,1239,1240,1241,1242,1243,1244,1245,1246,1247,1248,1249,1250,1251,1252,1253,1254,1255,12563,12564,12565,12566,12567,12568,12569,1256,12570,12571,12572,12573,12574,12575,12576,12577,12578,12579,1257,12580,12581,12582,12845,12846,12847,12848,12849,12850,12851,12852,12853,12854,12855,12856,12857,12858,12859,12860,12861,12862,12863,12864,12865,12,13382,13383,13384,13385,13386,13387,13388,13389,13390,13391,13392,13393,13394,13395,13396,13397,13398,13399,13400,13401,9176,9177,9178,9179,9180,9181,9182,9183,9184,9185,9186,9711,9712,9713,9714,9715,9716,9717,9718,9719,9720,9721,9722,9723,9724,9725,9726,9727,9728,9729,9730,9731,9` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/quality-spe…12696 tokens truncated…-01T23:41` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/PLAN.md:103` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/history/reflections/2026-07-08-codex.md:39` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/audits.json:208` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/files/Architecture.json:173` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/files/Corpus.json:257` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/files/Files.json:245,468,648` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/files/Lint.json:208` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/files/Quality.json:183,251,4,85,89` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/files/TsconfigSync.json:122,127,196,46,47,49,4,51,60,64` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/synthesis.json:539,678` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/discovery/tests.json:202,79,80` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-cli-modularization/ops/manifest.json:115` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S1/RULE-CARD-NOTES.md:130` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S2/beep__colors.json:23,38,8` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S3/RULE-CARD-NOTES.md:69` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S3/beep__shared-domain.json:28` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S4/beep__ontology.json:13` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S5/beep__architecture-lab-proof.json:14` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S5/beep__chalk.json:13,43` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S5/beep__hubspot.json:22,28` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S5/beep__m365.json:13` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/inventory/S5/beep__repo-configs.json:13,34,43` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-crispening-orchestration/ops/progress.json:1504,1506` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/PLAN.md:62` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/README.md:65` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/SPEC.md:185,77,78` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/history/outputs/before-after-matrix.md:17,19,20,29,30` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/history/outputs/external-tooling-prototype-gates.md:13,14` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/history/outputs/implementation-closeout.md:23,35,38` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/history/outputs/process-snapshots.md:100,119,120,99` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/history/outputs/quality-review-inventory.md:36,40` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/history/outputs/research-synthesis.md:141,54,73` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/ops/prompts/batch-02-hotspots.md:30` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-01-config-inventory.md:18,6` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-01-docgen-cost-model.md:48` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-01-timing-baseline.md:9` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-01-turbo-dag-cache.md:21,39,51,8` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-02-check-test-coverage.md:33,34,36,40,56` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-03-docgen-selectivity-shadow.md:82` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-03-scoped-config-design.md:19,57,58` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-03-synthesis.md:31,69` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/batch-03-tooling-candidates.md:63,64` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/research/known-findings.md:31` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/repo-quality-throughput/tasks/tasks.jsonc:122,126,131,136,139,156,162,167,189,192,196,205,206,334,351,385,386,387,394` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/rich-text-foundation/GOAL.md:37` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/rich-text-foundation/README.md:54` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/rich-text-foundation/SPEC.md:117,59` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/rich-text-foundation/history/2026-06-12-implementation-evidence.md:112,113,22,50` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/rich-text-foundation/history/2026-06-13-verification-closeout.md:46` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/rich-text-foundation/history/reflections/2026-06-12-claude.md:23,26,35,44,54` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/schema-first-v4-capabilities/reviews/p2-arbitrary-tests-schema-codec-advisory.md:12` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/schema-first-v4-capabilities/reviews/p4-hubspot-email-precision-pilot.md:36` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/schema-first-v4-capabilities/reviews/p4-runpod-boundary-codec-pilot.md:40` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/schema-first-v4-capabilities/reviews/p4-wave3-arbitrary-exceptions.md:24,27` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/SPEC.md:84` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/prompts/fixer.dual-arity.md:25` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/DA-1/da-1-batch.md:88` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/DA-1/da-1-nlp.md:54` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/DA-1/da-1-utils.md:126,15,16,83,85` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/DA-2/da-2-repocli.md:151,152,153` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/DA-2/da-2-ripples.md:17,41` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/FINAL/final-b.md:32` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/KN-1/kn-1a.md:33,34,35` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/P2-audits/p2-d5d8.md:287,313,406,421` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/SF-2/sf-2-repocli.md:124` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/reports/SF-2/sf-2-taila.md:58` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/slices/P2-D5D8.json:145` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/slices/P2-D8.json:24` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/ops/slices/P3/packages_agents_server_src.json:10` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/standards-remediation/research/decisions.md:409` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/storybook-app/GOAL.md:28` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/storybook-app/SPEC.md:14,48` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/storybook-app/history/reflections/2026-06-12-codex.md:15` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/storybook-app/research/grill-with-docs-findings.md:14` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/workspace-thread-domain/history/2026-06-13-agents-rename.md:33,38,43,48,53` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/workspace-thread-domain/history/2026-06-13-anthropic-driver.md:19,27` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/workspace-thread-domain/history/2026-06-13-usage-record.md:31` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/workspace-thread-domain/history/2026-06-13-verification-closeout.md:28,38` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/workspace-thread-domain/history/2026-06-13-workspace-thread-entities.md:31,36,41` | historical record | legacy dtslint/tstyche/type-test reference | Historical-do-not-touch. |
| `goals/codex-security-findings-2026-06-17/history/reflections/2026-06-18-closeout.md:67` | historical record | legacy `--types` reference | Historical-do-not-touch. |
| `goals/one-round-loop/history/p0-parity-evidence.md:29` | historical record | legacy `--types` reference | Historical-do-not-touch. |
| `goals/one-round-loop/research/ci-lane-parity.md:30,72` | historical record | legacy `--types` references | Historical-do-not-touch. |
| `explorations/identity-as-iri/research/20-repo-mining-synthesis.md:97` | historical record | legacy type-test design | Historical-do-not-touch. |
| `explorations/identity-as-iri/research/repos/n3-types.md:51` | historical record | external type-test research | Historical-do-not-touch. |
| `goals/canonical-slice-factory/PLAN.md:98` | historical record | legacy proof type-test plan | Historical-do-not-touch. |
| `goals/canonical-slice-factory/SPEC.md:222` | historical record | legacy proof type-test specification | Historical-do-not-touch. |
| `goals/canonical-slice-factory/ops/manifest.json:94` | historical record | legacy proof type-test manifest | Historical-do-not-touch. |
| `goals/repo-cli-modularization/README.md:41` | historical record | legacy quality type-test scope | Historical-do-not-touch. |
