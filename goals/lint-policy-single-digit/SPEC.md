# Lint Policy Single Digit Spec

## Objective

The hosted `Lint Policy` required check completes in single-digit minutes on every event
(pull request, escalated run, push to `main`, rerun) while remaining a FULL-SCOPE proof.
Measured baseline (2026-08-13, run 31683014887): ~20 min job wall, of which
`lint:deprecated-apis` is 975s (87% of the 1124s lane).

## Non-Goals

- PR changed-scope execution of the lane (deferred by decision
  `pr-changed-scope-deferred`; design preserved in `research/04-pr-scoping-deferred.md`).
- The docgen ownership move (backlogged by decision `docgen-ownership-move-backlogged`).
- Any edit to `.github/workflows/check.yml` (the temporary standalone shadow workflow is a
  separate new file).
- Changing which checks are required in the `main` ruleset.
- Raising outer step concurrency in P1 (rises to 4 only in the P3 cutover PR).

## Source Hierarchy

1. The 2026-08-13 grill-session decisions recorded in `ops/manifest.json` `keyDecisions`.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `goals/one-round-loop/history/p0-parity-evidence.md` (parity invariant).
4. This `SPEC.md`.
5. `PLAN.md`, `GOAL.md`.
6. `research/` reports (evidence, file:line citations, implementation sketches).

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts` (deprecated-apis runner).
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (step plan, ordering,
  empty-set omission).
- `packages/tooling/tool/cli/test/**` (focused tests).
- P2/P3 only: `packages/tooling/policy-pack/repo-configs/**` (new oxlint profile), root
  `package.json`/`bun.lock` (oxlint-tsgolint dep, cutover PR only), one temporary
  standalone workflow file.

## Constraints

- Lane bodies stay in the beep CLI; hosted and local `beep ci lane lint-policy` must run
  command-identical bodies (parity invariant, decision `parity-invariant-binding`).
- Memory discipline on the 64 GiB runner: outer concurrency 2 + inner shard concurrency 4
  in P1; never overlap two typed-heavy processes by construction (LPT ordering keeps
  deprecated-apis and docgen from co-starting late; see `research/03`).
- Effect v4 repo laws apply (effect helper modules, `Effect.fn`/`fnUntraced`, no native
  Set/Map, tersest helper forms).
- Killed ideas in `ops/manifest.json` `killedIdeas` must not be re-attempted.

## Acceptance Criteria

- [ ] P1: `lint:deprecated-apis` shards execute with bounded concurrency 4, each shard
      writing its own cache file under `node_modules/.cache/eslint-deprecated-apis/`,
      with `--cache-strategy content`; failure propagation and child interruption
      preserved.
- [ ] P1: `rootRepoLintPolicySteps` launches steps longest-first (static LPT order using
      the measured durations from `research/00-evidence-brief.md` as weights, recorded in
      a comment).
- [ ] P1: a scoped step whose filtered changed set is empty is omitted from the plan
      (no `--include ""` invocation is ever constructed); full scope
      (`files === undefined`) still emits every step.
- [ ] P1: focused tests assert shard command construction (unique cache paths, content
      strategy, concurrency 4, aggregate failure on nonzero exit) and the empty-set plan
      (docs-only changed set emits no law/scoped steps and no empty include values).
- [ ] P1: hosted `Lint Policy` job wall <= 9 min observed on the phase-1 PR.
- [ ] P2: go/no-go verdict for all three gates recorded in `history/` with wall/RSS
      evidence and the parity-corpus result.
- [ ] P3 (conditional): hosted lane <= 5 min observed after cutover, or phase flipped to
      `superseded` with the failing gate named.
- [ ] No unrelated refactors or formatting churn; user worktree changes preserved.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Local full-scope lane runs | `bun run beep lint policy --full` | exit 0 |
| Focused CLI tests | `bun run test --cwd packages/tooling/tool/cli` (or repo-standard invocation) | green, includes new shard + empty-set tests |
| Repo proof | `bun run beep yeet verify` | green |
| Hosted P1 evidence | `gh run view <run-id> --json jobs` on the phase-1 PR | Lint Policy job wall <= 9 min |
| Parity invariant | hosted log echoes `bun run beep lint policy`; local `beep ci lane lint-policy` echoes same body | identical command |
| P2 timing gate | `/usr/bin/time -v` cold oxlint full scan on heavy runner | wall <= 150s, RSS recorded |
| P2 parity gate | normalized `(file,line,symbol)` diff, both engines, parity corpus + full repo | empty diff or reviewed-only differences |
