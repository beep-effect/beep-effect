# PR changed-scope design for the hosted Lint Policy lane

## 1. TL;DR

Recommend making `lint-policy` explicitly affected on pull requests and explicitly full on `main` pushes:

1. Pass the workflow's existing `--affected --base origin/<base>` shape to `ci lane lint-policy`.
2. Forward that shape through `CiLane.ts` to new `beep lint policy --affected --base ...` flags; remove the current rule that `CI=true` always means full.
3. Build the 25-step plan from changed files: retain the 7 naturally scoped checks, conditionally run the 17 logged full-state checks only when their input surface changed, and retain/condition the branch-delta check.
4. For `deprecated-apis`, scan changed TypeScript files in one ESLint invocation, but escalate to the existing 24-shard full scan when the diff adds/removes `@deprecated`, changes dependencies/type resolution, or changes the rule/config. Do **not** rely on the post-merge `main` run as the only reverse-impact detector.
5. Omit the in-policy `lint:docgen` step on PRs once parity with the separate required affected `Docgen` lane is asserted; keep it in full/main policy runs.

Projected typical 10-file TypeScript PR: **2.2-4.1 minutes job wall**, versus the measured **19.8 minutes** (`66s` setup + `1,124s` policy), saving **15.7-17.6 minutes (79-89%)**. Conservative additive model: `66s setup + 20-45s scoped laws/structural checks + 20-90s one-shot typed deprecated scan + 25-45s triggered small full-state checks`; concurrency 2 may overlap some of that work. A PR that changes a deprecation/type-resolution trigger intentionally falls back to roughly today's 19.8-minute proof.

## 2. Evidence

### Shape and plumbing

- The workflow runs on PRs and pushes to `main` (`.github/workflows/check.yml:3-7`). It creates `shape_args`, adds `--affected --base origin/${GITHUB_BASE_REF:-main}` only for PRs, and adds `--summarize` (`.github/workflows/check.yml:217-223`). Today only `lint|check|test-unit|test-integration|coverage` receive those args; `lint-policy` is grouped with unshaped lanes (`.github/workflows/check.yml:225-231`).
- `CiLaneRunOptions` already carries `affected` and `base` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:563-581`); `ci lane` already parses both flags (`CiLane.ts:1101-1110`) and constructs the options (`CiLane.ts:1142-1171`). Turbo lanes turn `affected` into `--affected` plus `TURBO_SCM_BASE=base` (`CiLane.ts:590-593,655-668`).
- `lint-policy` discards the shape and always emits `beep lint policy` (`CiLane.ts:885-887`). Its descriptor advertises no flags (`CiLane.ts:349-355`), and local CI replay also suppresses affected flags for it (`CiLane.ts:1289-1306`). These three surfaces and their tests must change together.
- `beep lint policy` currently exposes only `--full` (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:552-558`). The task computes `runFull = full || isCi()`, hard-codes `origin/main...HEAD` only when not full, then forwards the resulting files (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1556-1577`). `collectChangedFiles` already implements the desired three-dot range plus dirty files and returns sorted repo-relative paths (`packages/tooling/tool/cli/src/internal/repo-run/ChangedFiles.ts:148-162`).

### All 25 steps and safe PR triggers

The plan contains exactly 25 steps (`Tasks.ts:1470-1512`); its focused test asserts the same inventory (`packages/tooling/tool/cli/test/quality-tasks.test.ts:1103-1132`). “Trigger” below is in addition to a shared escape hatch: changes to the step's implementation, CLI wiring, relevant policy config, or dependency/lock inputs must run that step full.

| # | Step | Class | PR behavior / trigger |
|---:|---|---|---|
| 1 | `lint:effect-imports` | natural file | Run only changed `apps|packages|infra/**/*.{ts,tsx}`. |
| 2 | `lint:terse-effect` | natural file | Same; preserve `--advisory`. |
| 3 | `lint:effect-fn` | natural file | Same. |
| 4 | `lint:frozen-grant-set` | natural file | Same. |
| 5 | `lint:native-runtime` | natural file | Same. The shared filter is explicit at `Tasks.ts:1455-1467`. |
| 6 | `lint:allowlist` | full-state | Skip unless the allowlist, generated snapshot, or a file named by an allowlist entry changed. The checker reads/validates precisely those surfaces (`Laws/AllowlistCheck.ts:38-41,176-195,260-279,294-344`). |
| 7 | `lint:tsgo-rules` | full-state | Run on `tsconfig.base.json`, any `packages/**/tsconfig*.json`, relevant package/lock changes, or changed `apps|packages|tooling|infra/**/*.{ts,tsx,mts,cts}` (suppression scan). Its inputs/scans are explicit (`Quality/Quality.command.ts:287-290,1581-1587,1654-1704`). |
| 8 | `lint:ecosystem-polarity` | natural member | If a changed path maps to an ecosystem member, check that member's whole manifest+`src`; otherwise skip. That expansion is already implemented (`Lint/EcosystemPolarity.ts:392-415,457-471`). |
| 9 | `lint:identity-registry` | full-state | Run on workspace/package manifest topology, the identity registry, or package source TS/TSX. Current implementation discovers all workspace identities then scans every package source (`Lint/IdentityRegistry.ts:175-229`); a follow-up split could file-scope only the local-composer half. |
| 10 | `lint:judge-rubric` | full-state | Skip unless the judge prompt or `QaLens` schema changed. The two bound surfaces are `.claude/skills/browser-qa-loop/resources/judge-prompt.md` (`Qa/JudgePack.ts:71-79`) and `QaLens` (`Qa/Inventory.schemas.ts:87-108`), consumed together at `Lint/JudgeRubric.ts:116-146`. |
| 11 | `lint:package-test-imports` | natural file | Run only changed package test TS/TSX files; it already filters provided includes and reads only those files (`Lint/PackageTestImports.ts:283-314,344-352`). |
| 12 | `lint:package-test-typecheck` | full-state | Run on `apps|infra|packages/**/package.json`, `**/tsconfig*.json`, non-fixture `**/test/**/*.{ts,tsx,mts,cts}`, or its baseline. Those roots/types and baseline are explicit (`Lint/PackageTestTypecheck.ts:54-64,593-655,658-714,881-919`). |
| 13 | `lint:reflection-artifacts` | full-state | Skip unless `goals/*/ops/manifest.json` or `goals/*/history/reflections/*.md` changed; those are the only packet data read (`Lint/ReflectionArtifact.ts:31-38,268-339`). |
| 14 | `lint:roadmap-refs` | full-state | Run on `docs/ROADMAP.md`, a linked goal/exploration target add/delete/rename, or a referenced goal manifest phase change (`Lint/RoadmapRefs.ts:29-31,132-159,210-237`). |
| 15 | `knowledge:semantic-delta` | branch-delta | Already compares merge-base and HEAD, not individual files (`Tasks.ts:1497-1499`; `Knowledge/Knowledge.service.ts:1092-1135`). Skip only if no path under its ten scanner roots changed (`Knowledge/Knowledge.refs.ts:1157-1168`) and no scanner/probe producer changed; otherwise run unchanged. |
| 16 | `goals:doctor` | full-state | Skip unless `goals/**` changed. Inventory reads each packet's manifest, README, and `GOAL.md` (`Goals/Inventory.ts:129-165`); doctor also reads reflections and its baseline (`Goals/Doctor.ts:299-316,774-815`). |
| 17 | `goals:index-check` | full-state | Run on `goals/INDEX.md`, `goals/*/ops/manifest.json`, or packet README fallback metadata; generation uses the shared inventory (`Goals/PortfolioIndex.ts:193-228,274-286`). |
| 18 | `lint:schema-first` | full-state | Skip unless `packages/tooling/tool/cli/src/**/*.ts` changed. The present checker scopes itself to that root and named focus files within it (`Lint/Lint.command.ts:36-44,232-256`). |
| 19 | `lint:deprecated-apis` | full-state with scoped fast path | Ordinary PR: one ESLint call over changed existing in-scope TS/TSX. Full trigger: deprecation annotation delta, `bun.lock`/dependency manifest, tsconfig/type-resolution, ESLint profile/rule/config, or scanner implementation. Current full runner is 24 sequential shard calls (`Lint/Lint.command.ts:46-74,461-505`); the typed rule/profile covers apps/packages/infra (`policy-pack/.../DeprecatedApisESLintConfig.ts:18-44,90-132`). |
| 20 | `lint:jsdoc` | full-state, safely file-scopeable | Skip if no lintable TS/TSX changed; preferably invoke ESLint once with changed files. The docs profile's tooling and general source globs/ignores are explicit (`policy-pack/.../DocsESLintConfig.ts:65-92,248-280`). Config/plugin/dependency changes force full. |
| 21 | `lint:jsdoc-module-tags` | full-state, safely file-scopeable | Skip if no changed `.hbs|.md|.ts|.tsx` under `.patterns|apps|packages|tooling`; otherwise scan changed files. Current full corpus is exactly those roots/extensions (`Quality/Quality.command.ts:287-288,1944-1993`). |
| 22 | `lint:docgen` | full-state/redundant on PR | Omit from PR policy if the separate required `Docgen` check remains. Otherwise reuse docgen-local selection: package `src|docs`, `docgen.json`, package/README/tsconfigs; global inputs force full (`Docgen/internal/Local.ts:40-61,406-439`). Keep in full/main policy. |
| 23 | `lint:circular` | full-state | Run on either analyzed root, `tsconfig.json`/path-resolution/dependency changes, or changes in their resolved import closure; it invokes madge on only the CLI and repo-utils roots (`Lint/Lint.command.ts:411-458`). A prefix-only trigger is not formally safe if madge follows an external workspace import; compute/over-approximate the closure. |
| 24 | `lint:typos` | full-state, safely file-scopeable | Skip if no changed existing non-excluded text file; otherwise pass changed paths to `typos`. `_typos.toml` changes force full; its exclusion surface begins at `_typos.toml:85-126`. |
| 25 | `lint:oxlint` | full-state, safely file-scopeable | Skip if no changed lintable file; otherwise pass changed paths. `.oxlintrc.json`, its JS plugin (`packages/tooling/policy-pack/lint-rules/**`), or dependency changes force full (`.oxlintrc.json:1-44`). |

The task's own log names the 17 full-state checks (`Tasks.ts:1573-1576`). The seven natural checks are the five law checks plus ecosystem polarity and package-test-imports; semantic-delta is the remaining branch-delta check.

### Deprecated-API correctness quantification

- Reproducible live census: `git ls-files` over the 24 shard roots filtered to `.(ts|tsx|mts|cts)` returns **3,568** files. A 10-file scan covers **0.28%** and leaves **3,558 files / 99.72%** unexamined. The shard roots are source-controlled at `Lint/Lint.command.ts:49-74`; ESLint actually targets TS/TSX in apps/packages/infra and ignores generated/output surfaces (`DeprecatedApisESLintConfig.ts:18-44`).
- If a PR adds `@deprecated` to an exported symbol, every caller may be unchanged. A changed-files-only scan can therefore miss **100% of the newly invalid callers**; the missed count is the symbol's unchanged reverse-reference fan-out (bounded only by the 3,558 unscanned files in this 10-file example). The current rule is `@typescript-eslint/no-deprecated: error` with typed project service (`DeprecatedApisESLintConfig.ts:95-132`).
- A full `main` push run would catch that only after merge. Because the same workflow runs after pushes to `main` (`check.yml:3-7`), it is a useful defense-in-depth signal but an unacceptable sole backstop under a main-must-stay-green policy. The PR escalation trigger prevents the known reverse-impact class before merge.

## 3. Implementation sketch

1. Workflow: move `lint-policy` into a case that calls `bun run beep ci lane lint-policy "${shape_args[@]}"` on PRs; on push it receives only `--summarize` or no shaping flags. `summarize` can remain accepted/no-op, or pass only affected/base.
2. `CiLane.ts`: advertise `--affected`/`--base` for the descriptor; make the lint-policy step append `--affected --base <base>` to `beep lint policy` when `options.affected`; make `ciLocalLaneFlags` forward the same shape. Add step-plan tests for affected and full.
3. `Lint.command.ts`: add `affected` and `base` flags to `policy`; reject/define precedence for `--full && --affected` (prefer a typed configuration error). Change `runRootLintPolicyTask` to accept a schema-backed options object `{ mode: full|affected|local-default, base, head }`; preserve local changed default, but let explicit affected override `CI=true`.
4. `Tasks.ts`: collect changed files with the supplied base/head, derive typed scope facts once (law TS files, test files, ecosystem members, full-state trigger booleans), then build the step array with `optionalQualityTaskStep`. Log every skipped step and its reason so hosted evidence shows what was proved.
5. Deprecated fast path: add `lint deprecated-apis --include <comma-list>` (or repeated file args); filter to existing config-covered TS/TSX and make **one** ESLint process, not one process per file. If the escalation predicate fires, use the existing shard runner unchanged.
6. Add planner tests for: ordinary 10-file scope; each full-state trigger family; deleted paths; config/dependency escalation; deprecation-annotation escalation; workflow/CI affected override; push/full parity; and zero relevant files.

### Empty-set bug: confirmed fix

`scopedLawArgs` always emits `--include <joined-filter>`, so a Markdown-only change becomes `--include ""` (`Tasks.ts:1455-1467`). Ecosystem polarity does the same with the unfiltered list (`Tasks.ts:1478-1484`), and package-test-imports has the same construction (`Tasks.ts:1487-1493`). The existing test proves non-empty forwarding but has no empty case (`quality-tasks.test.ts:1137-1168`).

Fix at plan construction, not in each downstream parser: compute each relevant subset first and append **no step** when it is empty. Sketch: `scopedStep(label, relevantFiles, makeArgs) => A.match(relevantFiles, { onEmpty: A.empty, onNonEmpty: files => [repoCliStep(...makeArgs(files))] })`. Full scope (`files === undefined`) still emits the original step. Add a test asserting a docs-only changed set contains none of the seven natural steps and never contains an empty `--include` value.

## 4. Risks / correctness tradeoffs

- Trigger drift is the main risk. Centralize declarative input predicates beside the plan, test every step, and force full on unknown/global tooling changes rather than silently skipping.
- Changed-file ESLint is unsafe for reverse impacts unless the deprecation escalation is present. Dependency, lockfile, tsconfig/path-alias, ambient declaration, and added/changed `@deprecated` surfaces must force full.
- Git name-only scope includes deletions. File scanners should filter to existing files, while structural/full-state predicates must still observe deleted paths.
- `lint:circular` needs a conservative import-closure trigger; simple directory prefixes may under-approximate madge's graph.
- Removing PR `lint:docgen` duplication is safe only while the separate required Docgen lane has equal-or-stronger affected selection and remains a merge gate (`check.yml:105-109,239-244`). Assert this invariant in the CI lane inventory/tests.
- More concurrency is not required for the projected win. Keep concurrency 2 initially (`Tasks.ts:119-124`) and remeasure after scoping; raising it before measuring could recreate memory contention.

## 5. Open questions

1. Should a deprecation-annotation diff use a conservative textual `git diff -G '@deprecated'` trigger, or a TypeScript/JSDoc declaration-aware detector? Textual is cheap and safely over-triggers.
2. Can the affected Docgen lane be made the single owner and `lint:docgen` removed from PR policy permanently, with an automated parity assertion?
3. Should `tsgo-rules`, identity-registry, JSDoc, module-tags, typos, and oxlint be split into global-integrity plus changed-file subchecks? That would reduce ordinary PR time further and make their triggers easier to reason about.
4. What p50/p95 does the one-process 10-file deprecated scan achieve on `beep-ec2-heavy`? The first implementation PR should emit per-step timing and compare at least 20 PR runs before tightening the estimate.
