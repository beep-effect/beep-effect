# Launch the SkillOpt pilot rerun

This runbook launches the `harness-evidence-ledger` rerun of the parked
SkillOpt pilot. It trains `.claude/skills/schema-first-development/SKILL.md`
with the config at `tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml`
(decisions D11 and D14 in the goal packet, plus the 2026-09-29 routine calls).

The first rerun (`beeplaw.rerun-2026-09.yaml`, 2026-09-25) stopped after two
accepted edits that were sandbox repair and task leakage
(`goals/harness-evidence-ledger/history/p2-rerun/FINDINGS.md`). The
2026-09-29 config keeps its parameters and adds loop-side controls:

| Setting | P5 | Rerun 2026-09-25 | Rerun 2026-09-29 |
| --- | --- | --- | --- |
| Edit budget | 1, constant | 4 down to 1, cosine | same |
| Epochs / steps | 2 / 8 | 3 / 12 | same |
| Rollout workers | 1 | 4 | same |
| Analyst workers | 1 | 2 | same |
| Optimizer | `claude_chat` sonnet | `claude_chat` opus (alias) | `claude_chat` `claude-opus-5-5` |
| Rollout target | `codex_exec` | `claude_code_exec`, model `opus`, effort medium (D14 amended 2026-09-25: Codex quota exhausted until Oct 2) | `claude_code_exec`, model `claude-opus-5-5`, effort medium |
| Codex rollout effort (if codex_exec is restored) | `none` | `low` (gpt-6-astra rejects `none`; `medium` timed out all 4 baseline items at 600 s) | same |
| Rollout exec / task timeout | 600 s / 900 s | 1500 s / 1800 s | same |
| Pre-evaluation diff screen | none | none | on (`env.screen_candidates`) |
| Baseline measurements | 1 | 1 | 3 noise-band runs plus the loop's own baseline |
| `env.out_root` | P5 history | `history/p2-rerun/out` | `history/p4-rerun/out` |

The 8 train / 4 validation split, batch and minibatch 2, the soft gate over
the full 4-item selection set, and the scorer
(`bun run beep agent-effectiveness evals score`) are the same as P5. The
rollout target is not: see the table above.

Both Claude backends pass the model string verbatim to `claude --model`, so the
explicit id `claude-opus-5-5` pins the model. The `opus` alias follows
whatever the CLI maps it to.

The cosine schedule gives these edit budgets for steps 1 to 12:
`4 4 4 3 3 2 2 2 1 1 1 1`.

## Loop controls

These live in `tools/skillopt/src/beep_skillopt/` and wrap the adapter's
`rollout`, the only call through which the vendored trainer spends evaluation
quota. No installed SkillOpt code is modified.

- **Pre-evaluation screen** (`screen.py`, `controls.py`). Before a candidate
  skill is evaluated, the screen diffs it against the current skill. Text
  the candidate leaves unchanged is never a reason. It rejects
  evaluation-environment fitting (a rule match that touches an added word and
  names the scorer, its lanes, the fixture layout, or sandbox tool config) and
  task leakage (a 5-word shingle that the candidate has, the current skill
  lacks, and a corpus task prompt contains, or a task's own export name).
  Both checks read the whole candidate, so rewording an existing line into a
  task quote or a scorer term is caught the same way as appending one. A rejected candidate is never rolled out. The
  trainer's strict-greater gate then rejects it and the loop continues with
  the current skill. Every decision goes to `out/screen-log.jsonl` (verdict,
  rule ids, SHA-256 of the unified diff, sizes; no skill or task text). Size
  growth is reported, never a rejection reason.
- **The screen needs the gate.** A screened candidate becomes a rejection only
  because the gate scores its empty result set 0.0. With
  `env.screen_candidates` on, the controls refuse to start (and preflight
  fails) when `evaluation.use_gate` is false, since the trainer would then
  force-accept the screened text, or when `optimizer.use_slow_update` is on,
  since slow-update candidates are never screened.
- **Baseline noise band.** Before the loop's own baseline, the baseline runs
  `env.baseline_repeats` (3) more times on identical inputs in fresh
  `out/baseline-noise/run_NN/` directories, never the cached
  `selection_eval_baseline`. `out/baseline-noise.json` holds each run's
  soft and hard scores, min, max, spread, and wall seconds, plus the loop's
  own baseline. This is rerun analysis only; the gate is unchanged.

## 1. Provision the environment

The repo flake provides `python3` and `uv`. The venv that `uv sync` creates
inside `tools/skillopt` is git-ignored, so each clone or worktree needs its
own:

```sh
cd tools/skillopt
uv sync
cd ../..
```

`uv sync` installs the pinned `skillopt==0.2.0` and the
`beep-skillopt-train` entry point.

Unit tests (stub scorer, skipped execution, fake ledger CLI; no model calls):

```sh
cd tools/skillopt
uv run python -m unittest discover -s tests
uv run python tests/test_adapter_stub.py
cd ../..
```

## 2. Preflight

Run from the repository root. It refuses to launch, with a message, when the
Claude Code CLI is missing or logged out (`claude auth status`, which makes no
model call), when `out_root` already holds a previous run's outputs, when the
screen is on but the gate is off or slow update is on, or when the checkout's
Yeet inbox has unacknowledged P0 rows:

```sh
uv run --project tools/skillopt python -m beep_skillopt.preflight \
  --config tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml
```

- `--resume` continues an interrupted run in the same `out_root` on purpose.
- `--force` moves an old `out_root` aside to `out.prev-<UTC stamp>`, and only
  after every other check has passed, so a refused launch leaves `out_root` in
  place. Nothing is deleted. `.gitignore` covers `p4-rerun/out*/`, so the
  moved run stays out of `git status`. Pointing a config at another directory
  needs a matching ignore rule first.
- Acknowledge inbox P0 rows with `bun run beep yeet inbox ack <id> ...`
  before launching. The SessionStart hook injects them into every rollout.

Quota cannot be checked without spending it. A usage-limit error surfaces on
the first rollout, so watch the log for it.

## 3. Launch detached

The host kills background jobs when the launching session exits, so start the
run as a transient user unit with full log capture. Run from the repository
root in an interactive shell, so `PATH` carries `uv`, `bun`, and `claude`:

```sh
mkdir -p goals/harness-evidence-ledger/history/p4-rerun
uv run --project tools/skillopt python -m beep_skillopt.preflight \
  --config tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml \
&& systemd-run --user --unit=skillopt-rerun-p4 --collect --same-dir \
  --setenv=PATH="$PATH" --setenv=HOME="$HOME" \
  -p StandardOutput=append:"$PWD/goals/harness-evidence-ledger/history/p4-rerun/run.log" \
  -p StandardError=append:"$PWD/goals/harness-evidence-ledger/history/p4-rerun/run.log" \
  "$(command -v uv)" run --project tools/skillopt beep-skillopt-train \
  --config tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml
```

If the user manager is unavailable, `setsid nohup` also survives the session:

```sh
setsid nohup uv run --project tools/skillopt beep-skillopt-train \
  --config tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml \
  > goals/harness-evidence-ledger/history/p4-rerun/run.log 2>&1 < /dev/null &
```

Never pipe the training command through `tail` or `tee`: the log file is the
verdict record. Artifacts go to the git-ignored `out` directory under
`goals/harness-evidence-ledger/history/p4-rerun` (`env.out_root`). The
`run.log` there is git-ignored too.

## 4. Watch progress

```sh
systemctl --user status skillopt-rerun-p4
tail -f goals/harness-evidence-ledger/history/p4-rerun/run.log
grep -E '\[baseline noise\]|\[screen\]|6/6 EVALUATE|\[STEP [0-9]+ done\]' \
  goals/harness-evidence-ledger/history/p4-rerun/run.log
```

The step export can run at any time during the run:

```sh
uv run --project tools/skillopt python -m beep_skillopt.export \
  --out-root goals/harness-evidence-ledger/history/p4-rerun/out
jq -c '{step, screen_verdict, gate_verdict, not_evaluated_reason, selection_soft, previous_best, within_baseline_noise, wall_seconds}' \
  goals/harness-evidence-ledger/history/p4-rerun/out/steps.jsonl
```

## 5. Stop rule

Stop early when the selection score saturates at 1.0 (`current=1.0000` in a
`[STEP N done]` line, or `current_after` 1.0 in `steps.jsonl`). The gate is
strict-greater, so no later candidate can be accepted and the remaining steps
only spend quota. Also stop on a usage-limit error or a systemic rollout
failure.

```sh
systemctl --user stop skillopt-rerun-p4
```

With the `setsid nohup` launch, stop the process group instead
(`pkill -f 'beep-skillopt-train --config tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml'`).
A stopped run keeps every completed step in `out/`.

## 6. After the run

Run these from the repository root, in order:

```sh
# Per-step evidence: steps.jsonl (numbers, verdicts, digests, task ids; no text).
uv run --project tools/skillopt python -m beep_skillopt.export \
  --out-root goals/harness-evidence-ledger/history/p4-rerun/out

# Re-run the CURRENT screen over every step's candidate (analysis only):
# rescreen.jsonl flags candidates the run's own screen let through (changed=true).
uv run --project tools/skillopt python -m beep_skillopt.rescreen \
  --out-root goals/harness-evidence-ledger/history/p4-rerun/out

# Ledger rows, dry run (the default): prints the exact CLI invocations.
uv run --project tools/skillopt python -m beep_skillopt.ledger \
  --out-root goals/harness-evidence-ledger/history/p4-rerun/out

# Ledger rows, written through `bun run beep harness-ledger`.
uv run --project tools/skillopt python -m beep_skillopt.ledger \
  --out-root goals/harness-evidence-ledger/history/p4-rerun/out --write
```

The recorder proposes one `skill` row per screened or gate-evaluated
candidate (`--edit diff:<sha256 of the unified diff>`). A candidate the
screen or the gate rejected also gets a `disposition --to rejected` row with
the screen rules or the gate scores as evidence. Gate rejections carry
`--score` (candidate minus current) and `--cost` (skill characters added). A
candidate that repeats an earlier screened-out one never ran: the trainer's
selection cache records 0.0 for its hash without a rollout. `steps.jsonl`
marks it `not-evaluated` with `not_evaluated_reason: screen-cache-hit`, and
the recorder rejects it with evidence naming the earlier step and no score or
cost. A
gate-accepted candidate stays `proposed`: only a human admits (D2), and the
recorder never writes `accepted`. `out/ledger-rows.json` maps each step to its
row ids. Before writing, `--write` also reads the ledger through
`harness-ledger list --json`, adopts a proposal or rejection already recorded
for a step, and dispositions only a chain whose latest row is still
`proposed`, so a retry after an interruption never records a step twice.

Reading `steps.jsonl` scores:

- `previous_best` is the score the gate compared against: the loop baseline
  for the first step, then the running current score. It and `selection_soft`
  are full precision.
- `within_baseline_noise` is true when `|candidate - previous_best|` is at
  most the spread of the baseline noise runs (plus 1e-6 for the scorer's
  six-decimal rounding). The 2026-09-29 rerun's step 2 won by 2.5e-7, which is
  a rounding gap, and both of its accepts are within noise. The gate itself is
  unchanged (SPEC non-goal); this flag and the recorder's text only report it.

## 7. Expected wall time

P5 took 90 minutes for 8 serial steps, about 11 minutes a step. Gate
evaluation took about 75% of each step: 4 rollouts plus 4 scorer runs of about
2 minutes each, most of it tsgo. The 2026-09-25 rerun's two steps took 180 s
and 233 s with 4 workers.

Rollout count: 4 baseline passes (3 noise runs plus the loop's own) of 4
selection items each, then per step 2 train rollouts plus 4 selection
rollouts when the candidate passes the screen. That is 16 + 12 x 6 = 88
rollouts and 88 scorer runs at most, plus about 4 to 6 optimizer calls a step.
A screened-out step skips its 4 selection rollouts.

Expect about 15 to 25 minutes for the baseline passes and 4 to 7 minutes a
step, so 1.25 to 1.75 hours for 12 steps. Budget 2.5 hours.

## Smoke check without spending quota

This check parses the config, builds the cosine schedule, runs the three
noise-band baselines and the loop baseline with the stub scorer, and lets
every optimizer call fail. `CLAUDE_CLI_BIN=/bin/false` is required: the
optimizer backend reads it, and without it the loop reaches the real `claude`
optimizer once the stub rollouts succeed.

```sh
CLAUDE_CLI_BIN=/bin/false uv run --project tools/skillopt beep-skillopt-train \
  --config tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml \
  --cfg-options env.out_root=<scratch-dir>/out env.stub_scorer=true \
    model.codex_exec_path=/bin/false \
    model.claude_code_exec_path=/bin/false
```

Look for `[config] lr_scheduler=cosine edit_budget=4 min_edit_budget=1`,
`total_steps=12`, three `[baseline noise] run N/3` lines, and
`total tokens: 0` at the end. Every step then skips with no patches.

## Known gotchas

- `codex_exec_reasoning_effort: none` is rejected by `gpt-6-astra`. At
  `medium` all four baseline items timed out at 600 s. Use `low` if the
  `codex_exec` target returns, and run `codex login status` first.
- Unacknowledged Yeet inbox P0 rows are injected into every rollout by the
  SessionStart hook, and the write-blocking hook failed the 2026-09-25 run.
  The preflight refuses on them.
- A relaunch into an existing `out_root` reuses the cached
  `selection_eval_baseline` failure instead of re-executing. The preflight
  refuses a used `out_root` unless `--resume` or `--force` is passed.
- Claude Code 2.1.282 and later print `--output-format json` as one JSON array
  line. `beep-skillopt-train` flattens it before skillopt 0.2.0's parser sees
  it (`_patch_claude_json_envelope` in `train.py`).
- The scorer sandbox set the 2026-09-25 baseline floor (missing lib types, an
  unresolvable tsconfig `extends`, Biome processing zero files). No lift claim
  is valid while that floor stands.
