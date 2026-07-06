# SkillOpt Training Pilot

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Compose the repo's existing eval bricks into a SkillOpt training loop and run
it end-to-end on `.claude/skills/schema-first-development`: ≥10 scored
schema-authoring tasks (ai-metrics BenchmarkCase), a scalar law-scorer
(schema-first lint + tsgo + biome), a worktree-per-rollout codex-sdk runner
(QualityWorkerEval generalized), flake+uv-provisioned SkillOpt. Loop-runs is
the success bar; measured lift is evidence; park-with-findings is a
legitimate verdict.

## Launch

```text
/goal follow the instructions in goals/skillopt-training-pilot/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phased execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance (inherits the exploration ledger).
6. Exploration provenance: [`explorations/skillopt-training-pilot/`](../../explorations/skillopt-training-pilot/README.md) — CAPTURE, RESEARCH, DECISIONS (7 locked), BRIEF (signed off), MAP.

## Current Phase

P0 Provisioning + skeleton — flake python3+uv, tools/skillopt/ uv project,
`beep agent-effectiveness evals` subcommand skeleton. First vertical slice:
ONE task hand-run end-to-end (worktree → codex-sdk → scorer → BenchmarkRun)
before generalizing anything.

## Latest Evidence

2026-07-06: **P0 complete, P1 loop-proof achieved** — SkillOpt trained
end-to-end against this repo (exit 0, 27s, 1 step): codex_exec target
rollouts + claude_chat sonnet optimizer, all plan-covered. Four integration
findings + smoke artifacts in
[`history/p1-spike/`](./history/p1-spike/FINDINGS.md). Remaining P1: a
baseline-failing task to exercise the edit+gate path.

## Notes

- Adoption of the trained best_skill.md is OUT of scope (follow-on decision).
- Repo changes = one gated PR (17-check ruleset); training runs are local,
  writing only packet history/ + local .beep/ai-metrics state.
- Codex implements, Claude orchestrates/verifies/gh-writes; worktree-lane
  conventions from quality-gate-ratchets apply (cwd=worktree, no codex
  commits, deliverable-on-disk).
- Revives superseded phoenix-enrichment experiments/evals slices as the B5
  stretch under this packet's provenance.
