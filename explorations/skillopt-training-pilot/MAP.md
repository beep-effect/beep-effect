# Map

<!-- Stage 4. Candidate goal packets, sequencing, first slice, capability cites. -->

## Candidate Goal Packets

Exactly one:

| Slug | Mission | Dependencies |
| --- | --- | --- |
| `skillopt-training-pilot` | Compose the repo's existing eval bricks into a SkillOpt training loop and run it end-to-end on `schema-first-development`: ≥10 scored schema-authoring tasks, scalar law-scorer, worktree rollout runner, flake+uv-provisioned optimizer; loop-runs = success, lift = evidence, park-with-findings = legitimate. | None open — predecessors #295/#305/#306 merged; Phase-1 Phoenix substrate shipped. |

## Sequencing

1. **P0 Provisioning + skeleton** (small): flake.nix python3+uv; `tools/skillopt/` pyproject + uv.lock pinning skillopt; `beep agent-effectiveness evals` subcommand skeleton.
2. **P1 Corpus (B1)**: mine schema-first inventory history + crispening cards for ≥10 tasks; `BenchmarkCase` rows + prepared-worktree fixtures.
3. **P2 Scorer (B2)**: scalar [0,1] + breakdown over a rollout diff (schema-first lint + tsgo diagnostics + biome); `BenchmarkRun` recording.
4. **P3 Runner (B3)**: generalize QualityWorkerEval — worktree-per-rollout, candidate-SKILL.md injection, workspace-write codex-sdk turn, score, teardown.
5. **P4 Ship the harness**: one gated PR (17-check ruleset).
6. **P5 Training run (B4)**: local; artifacts → goal history/; park-or-proceed verdict.
7. **P6 (stretch) Phoenix (B5)** + close (/reflect).

**First vertical slice**: one task, hand-run end-to-end — a single BenchmarkCase
through worktree→codex-sdk→scorer→BenchmarkRun *before* generalizing anything;
proves the whole pipe at n=1.

## Capability Check

| Component | Capability cite | Status |
| --- | --- | --- |
| Rollout runner | `Docgen/internal/QualityWorkerEval.ts` (codex-sdk, structured output, temp isolation, tests) | generalize |
| Benchmark storage | `@beep/repo-ai-metrics` BenchmarkCase/BenchmarkRun/Scorecard + DuckDB | reuse |
| Scorer lanes | `beep lint schema-first`, tsgo Effect diagnostics, biome | wrap |
| Throwaway checkouts | `beep worktree new/remove/doctor` | reuse |
| Command home | `beep agent-effectiveness` family (`AgentEffectiveness.command.ts`) | extend |
| Phoenix (stretch) | `@beep/phoenix` driver + bundles | reuse |
| Optimizer | microsoft/SkillOpt via pip | **NET-NEW dependency** (tools/skillopt/ uv project) |
| Python provisioning | flake.nix | **NET-NEW additions** (python3, uv) |

Both NET-NEW items are provisioning, not code; every code component composes an existing brick.
