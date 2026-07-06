# SkillOpt Training Pilot Spec

## Objective

A SkillOpt training loop runs end-to-end against this repo: (1) `tools/skillopt/`
uv project (pyproject + uv.lock pinning skillopt) provisioned via flake.nix
python3+uv; (2) ≥10 schema-authoring eval tasks derived from repo law/history,
stored as ai-metrics `BenchmarkCase` rows with prepared-worktree fixtures and
completion criteria; (3) a `beep agent-effectiveness evals` command family:
scorer (scalar [0,1] + violation breakdown from schema-first lint + tsgo
Effect diagnostics + biome over a rollout diff, recorded as `BenchmarkRun`)
and runner (worktree-per-rollout, candidate-SKILL.md injection, codex-sdk
`workspace-write` turn, score, teardown — QualityWorkerEval generalized);
(4) a training run of `.claude/skills/schema-first-development/SKILL.md`
with a held-out validation split whose artifacts (best_skill.md, per-epoch
scores, rejected-edit log, run report) land in this packet's `history/`;
(5) a recorded park-or-proceed verdict.

## Non-Goals

- Adopting/shipping the trained skill (follow-on decision with lift data).
- SkillOpt code vendoring (pip dependency only) or raw-transcript access
  (sealed ai-metrics archive stays sealed).
- SkillOpt-Sleep automation, multi-skill training, CI-hosted training runs.
- Any always-loaded-context growth; any skill-body change beyond the
  training target during runs.
- Weakening any gate to make rollouts pass.

## Source Hierarchy

1. Exploration DECISIONS.md (7 locked) + signed-off BRIEF.md.
2. `AGENTS.md`, `CLAUDE.md`, required skills (`effect-first-development`, `schema-first-development`, `effect-services`, `yeet`).
3. `standards/ARCHITECTURE.md`; ai-metrics privacy contract (`packages/tooling/library/ai-metrics/src/archive.ts` design).
4. This SPEC. 5. PLAN. 6. GOAL. 7. research/, ops/, history/.

## Target Surfaces

- `flake.nix` (python3, uv); NEW `tools/skillopt/{pyproject.toml,uv.lock}`.
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/` — `evals` subcommands + internals (+ tests in `packages/tooling/tool/cli/test/`).
- `packages/tooling/library/ai-metrics/src/` — eval-task/scorer schemas if BenchmarkCase needs extension (extend, don't fork).
- Eval corpus data (BenchmarkCase rows + fixtures; location per ai-metrics conventions, prompt-by-hash).
- This packet's `history/` (run artifacts, verdict).

## Constraints

- First vertical slice FIRST: one task end-to-end at n=1 before any generalization.
- Scorer must combine law compliance AND task-completion criteria (anti-gaming).
- Rollout scorer invocations use the node vitest path or run outside the codex sandbox (bun-vitest workers fail in-sandbox).
- Serial rollouts first; parallelism only if appetite demands.
- First training run bounded overnight-at-most (mini-batch settings chosen accordingly).
- Codex lanes: cwd=worktree, no commits from codex, no GitHub API from codex, deliverable-on-disk + .lane-summary.md.
- Conventional commits; single gated PR for repo changes.

## Acceptance Criteria

- [ ] `nix develop` (or direnv) provides python3+uv; `uv run --project tools/skillopt skillopt --help` works from a clean checkout.
- [ ] ≥10 BenchmarkCase tasks committed with fixtures + completion criteria; corpus derivation documented (which historical violations/cards).
- [ ] n=1 vertical slice transcript in history/ (one task: worktree → rollout → score → BenchmarkRun row).
- [ ] `beep agent-effectiveness evals score|run` (naming per family conventions) implemented with tests; scorer deterministic on a fixed diff.
- [ ] Training run completes: validation gate demonstrably rejected ≥1 regressing edit (SkillOpt logs); best_skill.md + per-epoch scores + run report in history/.
- [ ] Park-or-proceed verdict recorded with evidence.
- [ ] Repo changes merged via one gated PR; `bun run beep yeet verify` green.
- [ ] Reflection written; `bun run beep lint reflection-artifacts` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/skillopt-training-pilot/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/skillopt-training-pilot/ops/manifest.json` | Passes |
| Provisioning | `uv run --project tools/skillopt skillopt --help` | Exits 0 |
| Scorer determinism | same fixed diff scored twice → identical output | Passes |
| n=1 slice | transcript in history/ | Present |
| Training artifacts | best_skill.md + epoch scores + rejected-edit evidence | Present |
| Full proof | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Harness integration infeasible within appetite → PARK with findings (legitimate outcome, not failure).
- A change would weaken any gate, unseal raw transcripts, or grow always-loaded context.
- BenchmarkCase extension would fork rather than extend ai-metrics schemas.
- Verification requires unnamed credentials, cost, destructive side effects, or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
