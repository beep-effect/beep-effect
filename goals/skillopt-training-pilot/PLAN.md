# SkillOpt Training Pilot Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Provisioning + skeleton | pending | flake python3+uv; tools/skillopt/ uv project pinning skillopt; `beep agent-effectiveness evals` skeleton. | `uv run --project tools/skillopt skillopt-train --help` green from clean checkout; skeleton command registered with tests. |
| P1 Vertical slice (n=1) | pending | ONE hand-authored task through worktree → codex-sdk rollout → scorer → BenchmarkRun. | Transcript in history/; every pipe segment proven once. |
| P2 Corpus (B1) | pending | ≥10 tasks from schema-first inventory history + crispening cards; fixtures + completion criteria; BenchmarkCase rows. | Corpus committed + derivation documented. |
| P3 Scorer + runner hardening (B2/B3) | pending | Deterministic scalar scorer; generalized runner (serial), teardown-safe. | Scorer determinism proof; runner survives a full corpus sweep. |
| P4 Ship harness | pending | Single gated PR (flake, tools/, CLI, corpus). | PR merged through the 17-check ruleset. |
| P5 Training run (B4) | pending | SkillOpt run on schema-first-development, validation split, overnight-at-most. | Artifacts in history/; ≥1 rejected regressing edit in logs; verdict recorded. |
| P6 Stretch + close | pending | Optional Phoenix experiments (B5); /reflect; manifest sync. | Reflection lint green; park-or-proceed verdict final. |

## Execution Notes

- Codex sub-agents implement lanes; Claude orchestrates/reviews/commits/gh.
  Worktree-lane conventions from quality-gate-ratchets apply verbatim
  (cwd=worktree preflight, no codex commits, deliverable-on-disk +
  .lane-summary.md, fresh relaunch over resume).
- P1 before P2/P3 is load-bearing: the n=1 slice de-risks every integration
  seam (worktree bootstrap cost, codex-sdk sandbox behavior, scorer runtime
  path) before any volume work.
- Lane split when parallelizing: corpus (P2) is data + ai-metrics rows;
  scorer (P3a) lives mostly in @beep/repo-ai-metrics; runner (P3b) in
  repo-cli AgentEffectiveness internals — mostly disjoint, but P3a/P3b
  sequence if they share command wiring files.
- Training runs (P5) never run inside codex sandboxes — local, Claude- or
  user-launched, backgrounded with full-log capture (no `| tail` pipes on
  verdict-bearing commands).

## Verification Commands

```sh
test "$(wc -m < goals/skillopt-training-pilot/GOAL.md)" -le 4000
jq . goals/skillopt-training-pilot/ops/manifest.json
git diff --check -- goals/skillopt-training-pilot
uv run --project tools/skillopt skillopt-train --help
bun run beep yeet verify
bun run beep lint reflection-artifacts
```

## P0 Findings (2026-07-06)

- skillopt==0.2.0 resolves via uv (35 packages); console scripts are
  `skillopt-train`, `skillopt-eval`, `skillopt-sleep` (no bare `skillopt`).
- **Load-bearing**: `skillopt-train --backend` natively supports
  `claude_code_exec` and `codex_exec` (plus chat backends) — SkillOpt can
  drive our harnesses itself. P1/P3 design must FIRST evaluate configuring
  SkillOpt's native codex_exec backend against a prepared worktree + our
  scorer as the reward, before building any bespoke runner wrapper; the
  QualityWorkerEval generalization may reduce to worktree lifecycle + scorer
  invocation glue.
