# Lint Policy CI speedup — shared evidence brief

Goal: get the hosted `Lint Policy` check (PR-blocking, required) from ~19-31 min to single-digit
minutes. CI-infra changes are already underway elsewhere; prefer levers OUTSIDE direct CI
infrastructure changes (i.e., changes to the lane's own commands, scoping, engines, caching,
orchestration inside the beep CLI).

## Measured ground truth (run 31683014887, job 94392586624, PR #673, 2026-08-13)

Job wall: 08:41:43 -> 09:01:38 (~20 min). Setup ~66s. Everything else is one step:
`bun run beep lint policy` = 1124s (18m44s). It runs 25 subprocess steps with concurrency 2
(`LINT_POLICY_STEP_CONCURRENCY = 2`, packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:124).

Per-step wall times (concurrency 2, full scope):

| step | ms |
|---|---|
| lint:deprecated-apis | 975199 (16m15s — THE long pole; lane ends when it ends) |
| lint:docgen (`docgen check --reuse-proof-manifest`) | 197298 |
| knowledge:semantic-delta | 78127 |
| lint:schema-first | 51162 |
| lint:terse-effect | 33275 |
| lint:jsdoc (`bunx eslint . --max-warnings=0`, docs profile) | 28860 |
| lint:native-runtime | 27395 |
| lint:identity-registry | 22499 |
| lint:frozen-grant-set | 18910 |
| lint:circular (madge, 2 dirs) | 18305 |
| lint:effect-fn | 15631 |
| lint:package-test-imports | 13639 |
| lint:effect-imports | 12250 |
| lint:package-test-typecheck | 5726 |
| lint:tsgo-rules | 5310 |
| lint:oxlint (`bunx oxlint --quiet`) | 4543 |
| lint:allowlist | 4176 |
| lint:ecosystem-polarity | 4199 |
| goals:doctor | 3809 |
| lint:jsdoc-module-tags | 3917 |
| lint:reflection-artifacts | 3632 |
| goals:index-check | 3636 |
| lint:roadmap-refs | 3535 |
| lint:judge-rubric | 3439 |
| lint:typos | 998 |

Sum of everything except deprecated-apis ≈ 564s; at concurrency 2 the lane time ≈
deprecated-apis (975s) + ramp. Fix deprecated-apis and the lane becomes docgen-bound (~197s),
then concurrency becomes the next lever.

## Key facts

- Workflow: .github/workflows/check.yml, matrix id `lint-policy`, runner `beep-ec2-heavy`,
  timeout 50, uses_turbo "false". Runs `bun run beep ci lane lint-policy` with NO shape args —
  hosted is always `scope=full` (unlike lint/check/test-unit/test-integration/coverage lanes,
  which get `--affected --base origin/main` on PRs).
- Lane body: CiLane.ts:887 -> `beep lint policy` -> Quality/Tasks.ts ~1460-1512
  (`rootRepoLintPolicySteps`), runStepGroup at Tasks.ts:1577 with LINT_POLICY_STEP_CONCURRENCY=2.
  The comment justifying 2 predates the move to the heavy EC2 runner.
- deprecated-apis implementation: packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts
  (~lines 46-540): sequential for-loop over ~30 DEPRECATED_API_LINT_SHARDS, each
  `node_modules/.bin/eslint --cache --cache-location node_modules/.cache/eslint-deprecated-apis/.eslintcache
  --config eslint.config.mjs <shard>` with BEEP_ESLINT_PROFILE=deprecated-apis,
  NODE_OPTIONS=--max-old-space-size=8192.
- ESLint profile: packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts —
  single rule `@typescript-eslint/no-deprecated: error`, typescript-eslint projectService,
  defaultProject tsconfig.json, allowDefaultProject list,
  maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 160.
- CI caches ONLY `~/.bun/install/cache` and `.turbo/cache`
  (.github/actions/setup-monorepo-ci/action.yml). node_modules/.cache/** — including the
  deprecated-apis .eslintcache — is cold every run.
- Runner hardware: fleet instance types r7a.2xlarge / r7i.2xlarge / r6i.2xlarge (8 vCPU, 64 GiB)
  or m7a.4xlarge (16 vCPU, 64 GiB) — infra/src/CiFleetController.ts:35, infra/src/CiRunners.ts:72.
- Toolchain already in repo: typescript 6.0.3, tsgo (@typescript/native-preview) used by `check`,
  oxlint 1.78.0, eslint 10.8.1, typescript-eslint 8.67.
- Recent prior art: PR #668 made CI typecheck cheap via FLAT source-mode tsconfig
  (tsconfig.check.json pattern) instead of d.ts/project-reference mode — d.ts mode measured ~6x
  cost. The same trick may apply to the ESLint projectService.
- Known bug (separate but related): on changed-scope local runs, law steps get `--include ""`
  when the filtered changed set is empty and exit 1 printing help (Tasks.ts ~1467). Any
  changed-scope work must fix this (skip step when empty).
- Separate `Docgen` matrix lane already exists in check.yml (affected mode on PRs) — the
  in-lane `lint:docgen` step may be partially redundant with it.

## Report contract

Write your report to the absolute path given in your prompt. Markdown. Structure:
1. TL;DR — recommended action(s) + projected time saved (be numeric; show your model).
2. Evidence — file:line citations from the live checkout for every claim.
3. Implementation sketch — concrete enough to hand to an implementer.
4. Risks / correctness tradeoffs.
5. Open questions.
Be skeptical: verify claims against the actual checkout (rg/ls/read files). Do not modify the
repo. Keep the report under ~200 lines.
