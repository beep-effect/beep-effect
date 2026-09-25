# Launch the SkillOpt pilot rerun

This runbook launches the `harness-evidence-ledger` P2 rerun of the parked
SkillOpt pilot. It trains `.claude/skills/schema-first-development/SKILL.md`
with the config at `tools/skillopt/configs/beeplaw.rerun-2026-09.yaml`
(decisions D11 and D14 in the goal packet).

What changed from the P5 run
(`goals/skillopt-training-pilot/history/p5-training/FINDINGS.md`):

| Setting | P5 | Rerun |
| --- | --- | --- |
| Edit budget | 1, constant | 4 down to 1, cosine |
| Epochs / steps | 2 / 8 | 3 / 12 |
| Rollout workers | 1 | 4 |
| Analyst workers | 1 | 2 |
| Optimizer | `claude_chat` sonnet | `claude_chat` opus |
| Codex rollout effort | `none` | `medium` (gpt-6-astra rejects `none`; AGENTS.md Codex default) |

The target (`codex_exec`), the 8 train / 4 validation split, batch and
minibatch 2, the soft gate over the full 4-item selection set, and the scorer
(`bun run beep agent-effectiveness evals score`) are the same as P5.

The cosine schedule gives these edit budgets for steps 1 to 12:
`4 4 4 3 3 2 2 2 1 1 1 1`.

## 1. Provision the environment

The repo flake provides `python3` and `uv`. The venv at `tools/skillopt/.venv`
is git-ignored, so each clone or worktree needs its own:

```sh
cd tools/skillopt
uv sync
cd ../..
```

`uv sync` installs the pinned `skillopt==0.2.0` and the
`beep-skillopt-train` entry point.

## 2. Check the logins

Rollouts run `codex exec` and the optimizer runs `claude -p --model opus`.
Both CLIs must already be logged in; a detached run cannot prompt.

```sh
codex login status
claude --version
```

`codex login status` must report a logged-in account. If it does not, stop
and log in before launching.

## 3. Launch detached

The run outlives an agent or terminal session, so start it with `setsid nohup`
from the repository root:

```sh
mkdir -p goals/harness-evidence-ledger/history/p2-rerun
setsid nohup uv run --project tools/skillopt beep-skillopt-train \
  --config tools/skillopt/configs/beeplaw.rerun-2026-09.yaml \
  > goals/harness-evidence-ledger/history/p2-rerun/run.log 2>&1 &
```

Artifacts go to `goals/harness-evidence-ledger/history/p2-rerun/out`
(`env.out_root`). Follow progress with
`tail -f goals/harness-evidence-ledger/history/p2-rerun/run.log`.

## 4. Expected wall time

P5 took 90 minutes for 8 serial steps, about 11 minutes a step. Gate
evaluation took about 75% of each step: 4 rollouts plus 4 scorer runs of about
2 minutes each, most of it tsgo.

With 4 workers the rollouts and scorer runs in a phase overlap, so a step
should take roughly 4 to 7 minutes. Four concurrent tsgo runs compete for CPU
and the Opus optimizer is slower than Sonnet. For 12 steps plus the baseline,
expect 1 to 1.5 hours and budget 2 hours.

## Smoke check without spending quota

This check parses the config, builds the cosine schedule, and exits at the
first rollout. It needs no Codex or Claude calls:

```sh
uv run --project tools/skillopt beep-skillopt-train \
  --config tools/skillopt/configs/beeplaw.rerun-2026-09.yaml \
  --cfg-options env.out_root=<scratch-dir>/out env.stub_scorer=true \
    model.codex_exec_path=/bin/false
```

Look for `[config] lr_scheduler=cosine edit_budget=4 min_edit_budget=1` and
`total_steps=12` in the output. The run then stops with a systemic rollout
failure, which is expected here.
