# P1 implementation notes

Date: 2026-08-13

## Changes

- `lint deprecated-apis` now runs its 24 existing shards with bounded inner
  concurrency 4. Every shard receives a stable cache file derived from its
  shard path under `node_modules/.cache/eslint-deprecated-apis/`, plus
  `--cache-strategy content`. The runner remains an `Effect.forEach` workflow,
  so a nonzero child exit fails the aggregate and interrupts sibling work.
- `rootRepoLintPolicySteps` is statically ordered longest-first using the
  measured durations from `research/00-evidence-brief.md`. The outer
  `LINT_POLICY_STEP_CONCURRENCY` remains 2.
- Changed-scope planning now filters each naturally scoped step before
  constructing it. Empty law, ecosystem-polarity, and package-test-import
  subsets emit no step, so the planner cannot construct `--include ""`.
  Full scope still emits all 25 policy steps.

## Test and check evidence

- `node node_modules/vitest/vitest.mjs run packages/tooling/tool/cli/test/lint-command.test.ts packages/tooling/tool/cli/test/quality-tasks.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism`
  - Exit 0; 2 files passed, 120 tests passed in 12.16s.
  - Covers 24 unique cache locations, content strategy, concurrency 4, aggregate
    failure on a shard exit 7, LPT inventory, changed-scope filtering, and no
    empty include values.
- `zsh -ic 'bun run --cwd packages/tooling/tool/cli check'`
  - Exit 0; the CLI `tsgo -b tsconfig.json` check passed in 7.31s.
- Focused Biome check of the four touched CLI source/test files
  - Exit 0; no diagnostics.
- Focused `effect-fn`, `native-runtime`, and advisory `terse-effect` law checks
  on the touched files
  - Exit 0; no violations or blocking findings.
- `zsh -ic 'bun run beep lint schema-first'`
  - Exit 0 in about 30.4s; 83 live/tracked entries, zero missing, stale, or
    advisory findings.
- `zsh -ic 'bun run beep lint policy --full'`
  - Exit 0; all 25 full-scope steps passed at outer concurrency 2 in
    approximately 179s observed wall time.
  - `lint:deprecated-apis` completed in 172562.91ms and was the long pole. Its
    captured output showed all 24 unique cache locations, content strategy, and
    the declared inner concurrency 4.

## Timing observations

- The focused Vitest suite itself completed in 12.16s under Node.
- The final local full-scope lane completed in approximately 2m59s;
  deprecated-apis accounted for approximately 2m53s of that critical path.
- Bun-backed Vitest worker startup was unhealthy in this shell: fork workers
  timed out before test collection at 120s, and the threads pool failed during
  worker initialization. The same configured Vitest suite passed under the
  direct Node launcher, so these attempts are recorded as environment-only
  runner startup failures rather than test failures.
- No hosted P1 wall-time observation is available in this no-commit/no-push
  phase. The packet's hosted `<= 9 min` acceptance remains a PR-stage proof.

## Deviations from sketches

- The P1 contract and locked decisions explicitly kill persistent cross-run
  ESLint caching, so only unique per-shard local cache files were implemented;
  no workflow or cache-action changes were made.
- The empty-set sketch was generalized to one scoped CLI-step helper so all
  seven existing naturally scoped steps share the omission invariant. The two
  non-law predicates mirror their command handlers' existing input scopes.
- Focused tests use the real CLI command with temporary shard directories and a
  fake local ESLint executable instead of exporting production internals solely
  for tests. This proves the rendered child commands and aggregate exit behavior
  at the runtime boundary without widening the public API.
