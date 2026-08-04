# PR-A part 1 implementation report

Date: 2026-08-04
Worktree: `/home/elpresidank/YeeBois/projects/beep-effect3-pra`
Branch: `feat/pipeline-speed`

## Outcome

| Item | Status | Result |
| --- | --- | --- |
| 1. terse-effect advisory + rewrite | Done | The policy battery invokes `laws terse-effect --check --advisory`; advisory mode always exits successfully and labels its output. Direct `--check` remains strict. Yeet repair now explicitly retains `laws terse-effect --write`. |
| 2. dual-arity deletion | Done | The command, implementation, inventory, repair step, classifier routing, test kit exposure, tests, active documentation, and generated active inventories were removed. Protected history under `goals/**`, `explorations/**`, and `standards/architecture/DECISIONS.md` was not edited. |
| 3. cspell + markdownlint deletion | Done | Policy steps, configuration, dictionaries, dependencies/catalog entries, Fallow ignores, active documentation/generated comments, and related classifier tests were removed. `bun.lock` and the Lefthook `typos` hook were untouched. |
| 4. changed-scope lever | Done | Local `lint policy` uses `origin/main...HEAD` plus unstaged, staged, and untracked files. CI and local `lint policy --full` use full scope. File-local Effect laws and package-test-import checks receive the selected paths; whole-state checks remain full and are explicitly reported. |

## Files by item

### 1. terse-effect

- `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts`
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `packages/tooling/tool/cli/test/yeet.test.ts`
- `.claude/skills/yeet/SKILL.md`

### 2. dual-arity

- Deleted:
  - `packages/tooling/tool/cli/src/commands/Laws/DualArity.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/Laws.schemas.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/internal/DualArity.analysis.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/internal/DualArity.inventory.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/internal/DualArity.render.ts`
  - `packages/tooling/tool/cli/test/dual-arity.test.ts`
  - `standards/dual-arity.inventory.jsonc`
- Updated command/wiring/support:
  - `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/Laws.errors.ts`
  - `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
  - `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueClassification.ts`
  - `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts`
  - `packages/tooling/tool/cli/src/test/Laws.test-kit.ts`
  - `packages/tooling/tool/cli/test/quality-tasks.test.ts`
  - `packages/tooling/tool/cli/test/yeet.test.ts`
  - `standards/effect-laws-v1.md`
  - `standards/fallow.health.regression-baseline.jsonc`
  - `standards/schema-catalog.generated.jsonc`
  - `.claude/skills/crispen/SKILL.md`
  - `.claude/skills/yeet/SKILL.md`

### 3. cspell and markdownlint

- Deleted:
  - `cspell.json`
  - `.cspell/alt-languages.txt`
  - `.cspell/company-names.txt`
  - `.cspell/custom-words.txt`
  - `.cspell/effect-terms.txt`
  - `.cspell/misspelled.txt`
  - `.cspell/names.txt`
  - `.cspell/tech-terms.txt`
  - `.cspell/third-party.txt`
  - `.markdownlint-cli2.jsonc`
- Dependency/config/wiring:
  - `package.json`
  - `.fallowrc.jsonc`
  - `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
  - `packages/tooling/tool/cli/src/commands/Quality/Quality.errors.ts`
  - `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueClassification.ts`
  - `packages/tooling/tool/cli/test/quality-tasks.test.ts`
  - `packages/tooling/tool/cli/test/yeet.test.ts`
- Active/generated-reference cleanup:
  - `apps/professional-desktop/README.md`
  - `apps/professional-desktop/scripts/sync-migration-bundle.ts`
  - `apps/professional-desktop/src/runtime/Migrations.gen.ts`
  - `packages/drivers/runpod/scripts/generate.ts`
  - `packages/drivers/runpod/src/_generated/Runpod.generated.ts`
  - `packages/foundation/capability/nlp-processing/src/Graph/TypeClass.ts`
  - `packages/foundation/modeling/html/scripts/generate.ts`
  - `packages/foundation/modeling/html/src/Html.meta.ts`
  - `packages/foundation/modeling/html/src/Html.model.ts`
  - `packages/foundation/modeling/html/src/Html.source-size.ts`
  - `packages/foundation/modeling/html/src/internal/Html.language-tag-registry.generated.ts`
  - `packages/foundation/ui-system/editor/README.md`
  - `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts`
  - `packages/tooling/library/repo-utils/README.md`
  - `packages/tooling/tool/cli/src/internal/ratchet/RatchetDiff.ts`
  - `packages/tooling/tool/cli/src/internal/ratchet/RatchetLifecycle.ts`

`_typos.toml` and `.gitleaks.toml` were inspected. Neither contained cspell-dictionary wording requiring an edit; terms owned by `_typos.toml` remain intact.

### 4. changed scope

- New shared selector: `packages/tooling/tool/cli/src/internal/repo-run/ChangedFiles.ts`
- Reused by docgen: `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts`
- Battery and `--full`: `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`, `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`
- Law CLI/scanners:
  - `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/EffectFn.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/FrozenGrantSet.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts`
  - `packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts`
- Additional natural file filter: `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts`
- Tests: `packages/tooling/tool/cli/test/quality-tasks.test.ts`

The following stay full because their contracts reconcile repository-wide state, validate configuration or ledgers, or currently expose no sound file-only contract: allowlist, tsgo-rules, identity-registry, package-test-typecheck, reflection/roadmap/goals checks, schema-first, deprecated-apis, JSDoc/module tags, circular, typos, and Oxlint. Docgen is invoked as a whole-state step but its local implementation already uses the shared changed-file selector.

## Verification

- Repo-cli overlay tsgo (`extends ./tsconfig.json`, `include: ["src"]`, `composite: false`, `incremental: false`, `noEmit: true`): **0 errors**. The temporary overlay was removed.
- Required targeted Vitest plus touched law coverage:
  - `zsh -ic 'npx vitest run test/quality-tasks.test.ts test/ci-lane.test.ts test/lint-command.test.ts test/terse-effect.test.ts'`
  - **4 files, 140 tests passed**.
- Additional Yeet planner/classifier coverage:
  - `npx vitest run test/yeet.test.ts`
  - **1 file, 78 tests passed**.
- Scoped law executions all passed:
  - effect-imports, effect-fn, frozen-grant-set, native-runtime with `--include`
  - terse-effect with `--include --advisory`
- Effective full law executions all passed:
  - effect-imports, effect-fn, frozen-grant-set, native-runtime, and terse-effect with the include filter omitted
  - allowlist-check remained a full-state pass
  - The individual law commands use presence/absence of `--include`; `--full` belongs to the battery. Battery `--full` argument planning and CI-full behavior are covered by the targeted tests.
- `bunx eslint . --max-warnings=0`: **green** after attributing and fixing six introduced JSDoc warnings.
- `git diff --check`: **green**.
- Active-surface sweep for dual-arity/cspell/markdownlint references: **no matches** in `AGENTS.md`, `.claude/skills/**`, or package/app README surfaces.
- `bun.lock`: **no diff**.

No install, Turbo, full verify, Yeet, commit, or push was run.

## Battery timing

Required final single sample:

```text
/usr/bin/time -p bun run beep lint policy
scope=changed (540 files)
22 policy steps
real 569.44
user 1123.99
sys 51.45
```

The sample exited 1 solely on `lint:jsdoc`. Direct attribution found six warnings introduced by this patch (five missing blank separators before JSDoc tags and one missing `@param files`). They were fixed, and the exact direct lane `bunx eslint . --max-warnings=0` then exited 0. The full battery was not timed a second time because the request specified one end sample.

There is no honest same-worktree pre-mutation battery measurement: implementation began before a baseline timing was captured. The supplied audit's closest historical reference is a different branch/full-policy run: 25 policy steps, root lint task 122.7s, and the whole quality-lint lane failed after 286.0s. It is not an apples-to-apples “before” and is therefore not used to claim a speedup. The changed-scope sample was dominated by the still-full deprecated-apis step (539.91s), and this branch's `origin/main...HEAD` range already contains 540 changed files.

## Deviations and discoveries

- **Timing deviation:** no measured same-worktree before sample exists. Historical audit numbers are reported only as context.
- **Timed-sample terminal state:** the one permitted end sample was red on an introduced JSDoc formatting issue that was subsequently fixed and directly reverified; the full battery was not rerun.
- **Scope effectiveness:** this branch has a broad 540-file base diff, so changed scope is much larger than a typical focused PR. The remaining full deprecated-apis scan dominated wall time. Extending that command with a sound changed-file/affected-package contract is outside locked decisions 2–5 and was not improvised.
- **Repair-path discovery:** the pre-change Yeet planner explicitly skipped terse-effect. Locked decision 2 requires the safe rewriter to keep running in repair, so `prepare:laws:terse-effect --write` was added rather than merely left absent.
- **Generated active inventories:** dual-arity and removed-tool entries were mechanically removed from active generated catalogs/baselines without invoking their heavyweight generators.

Overall diff at report time: 58 tracked files changed, 232 insertions, 4,552 deletions, plus the new shared changed-file selector.
