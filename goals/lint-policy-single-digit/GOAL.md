# GOAL: make the hosted Lint Policy check single-digit minutes at full scope

Repo root: the current working directory — the `beep-effect` checkout you are
running in. All paths below are repo-relative.

Outcome: the required `Lint Policy` CI check completes in single-digit minutes
while remaining a full-scope proof. Current executable phase: **P1** below.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/lint-policy-single-digit/SPEC.md` (normative)
- `goals/lint-policy-single-digit/PLAN.md`
- `goals/lint-policy-single-digit/ops/manifest.json` (locked decisions,
  killed ideas, stop conditions)
- `goals/lint-policy-single-digit/research/` (evidence + implementation
  sketches with file:line citations)

Read those first, then `AGENTS.md` / `CLAUDE.md`. Repo standards outrank
packet prose.

P1 scope (one focused PR, CLI-only):

1. `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts` —
   deprecated-apis shards run via bounded `Effect.forEach(..., { concurrency:
   4 })` instead of the sequential loop; each shard gets a stable per-shard
   cache file under `node_modules/.cache/eslint-deprecated-apis/`; add
   `--cache-strategy content`. Preserve failure propagation and interruption.
   Sketch: `research/02-inplace-optimization.md` §3.
2. `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` — order
   `rootRepoLintPolicySteps` longest-first (static LPT using the measured
   durations in `research/00-evidence-brief.md`; cite them in a comment).
   Keep `LINT_POLICY_STEP_CONCURRENCY = 2`.
3. Same file — a scoped step whose filtered changed set is empty is OMITTED
   from the plan; never construct `--include ""`. Full scope
   (`files === undefined`) still emits every step. Design:
   `research/04-pr-scoping-deferred.md` §3.
4. Focused tests in `packages/tooling/tool/cli/test/`: shard command
   construction (unique cache paths, content strategy, concurrency 4,
   aggregate failure) and empty-set plan (docs-only set emits no scoped
   steps, no empty include values); update the 25-step inventory test only
   where behavior legitimately changed.

Out of scope for P1: outer concurrency raise, oxlint/tsgolint, docgen step
changes, any `.github/workflows/**` edit, PR changed-scope, dependency or
lockfile changes.

Workflow:

1. Inspect referenced files and current repo state before editing.
2. Make the smallest change satisfying SPEC P1; follow Effect v4 repo laws.
3. Preserve unrelated user/worktree changes; never stage or commit.
4. Verify: focused CLI tests green, then `bun run beep lint policy --full`
   exits 0 locally.
5. Write implementation notes (what changed, test evidence, deviations) to
   `goals/lint-policy-single-digit/history/p1-implementation-notes.md`.

Acceptance:

- [ ] SPEC.md P1 acceptance criteria satisfied.
- [ ] No unrelated refactors or formatting churn.
- [ ] Stop conditions in `ops/manifest.json` respected throughout.
