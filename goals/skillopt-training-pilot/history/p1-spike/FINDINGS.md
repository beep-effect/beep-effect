# SkillOpt P1 Spike Findings

## Scope

Worktree preflight passed:

```text
<local-worktree>
writable
```

No training run, commit, push, or GitHub API call was performed. Help output was inspected with:

```sh
env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt --offline skillopt-train --help
env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt --offline skillopt-eval --help
```

The installed package did not ship example YAML configs or example data files under `skillopt/`, `skillopt_sleep/`, or `scripts/`.

## 1. Config Schema

`skillopt-train --config CONFIG` expects a YAML file. The CLI labels `--config` as "Path to YAML config file" and requires it before running `load_config` (`tools/skillopt/.venv/lib/python3.12/site-packages/scripts/train.py:132`, `tools/skillopt/.venv/lib/python3.12/site-packages/scripts/train.py:380`). The config loader parses YAML with `yaml.safe_load`, supports optional `_base_` inheritance, applies CLI overrides, and returns a merged dict (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/config.py:152`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/config.py:261`).

The modern structured form has top-level sections `model`, `train`, `gradient`, `optimizer`, `evaluation`, and `env` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/config.py:1`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/config.py:25`). The loader flattens these into trainer keys through `_FLATTEN_MAP`, including:

- `model.backend`, `model.optimizer_backend`, `model.target_backend`, `model.optimizer`, `model.target`, and `model.codex_exec_*`.
- `train.num_epochs`, `train.train_size`, `train.batch_size`, `train.accumulation`, and `train.seed`.
- `gradient.minibatch_size`, `gradient.merge_batch_size`, `gradient.analyst_workers`, and related reflection controls.
- `optimizer.learning_rate`, `optimizer.skill_update_mode`, and slow/meta/skill-aware update toggles.
- `evaluation.use_gate`, `evaluation.gate_metric`, `evaluation.sel_env_num`, `evaluation.test_env_num`, and `evaluation.eval_test`.
- `env.name`, `env.skill_init`, `env.out_root`, `env.data_path`, `env.split_mode`, `env.split_dir`, and `env.split_ratio`.

Evidence: `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/config.py:31`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/config.py:185`.

The trainer reads the target skill from `skill_init`, normalizes it to an absolute path when present, and writes the initial skill into the output skill history (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:768`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:919`). It requires run-budget fields including `batch_size`, `num_epochs`, `accumulation`, `merge_batch_size`, and `seed`; it derives `steps_per_epoch = ceil(train_size / (batch_size * accumulation))` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:779`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:801`). `scripts/train.py` selects backend defaults and forces `target_backend=codex_exec` for the `codex_exec` backend (`tools/skillopt/.venv/lib/python3.12/site-packages/scripts/train.py:423`).

The authored smoke config is `goals/skillopt-training-pilot/history/p1-spike/config.smoke.yaml`.

## 2. Task And Dataset Format

The generic split loader supports either a single JSON/JSONL dataset or a pre-split directory. In `split_dir` mode it expects split subdirectories named `train`, `val`, and `test`, and each split can contain JSON or JSONL records (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/datasets/base.py:13`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/datasets/base.py:164`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/datasets/base.py:375`). It aliases SkillOpt split names `valid_seen` and `valid_unseen` to `val` and `test` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/datasets/base.py:423`).

For the closest built-in smoke path, `searchqa` items need at least:

- `id`
- `question`
- optional `context`
- `answers`

The SearchQA rollout reads these fields directly (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/searchqa/rollout.py:153`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/searchqa/rollout.py:181`). Evaluation extracts an `<answer>...</answer>` span when present, then computes exact match and token F1 against `answers` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/searchqa/evaluator.py:28`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/searchqa/evaluator.py:88`). The environment returns result dicts with `hard` and `soft` scores (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/searchqa/rollout.py:242`), and SkillOpt aggregates only those two metrics (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/utils/scoring.py:7`).

External command scoring is not supported by `skillopt-train` config alone. The base environment contract is a Python `rollout` method returning result dicts with `hard` and `soft` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/base.py:216`), and the config flatten map has no `scorer_command`, `reward_hook`, or equivalent field (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/config.py:31`). A repo law scorer such as `bun run beep lint schema-first` would require a custom `EnvAdapter` or rollout implementation, not just YAML.

`skillopt_sleep` has a separate task schema and backend reward interface, but it is not consumed by `skillopt-train`. Its config is JSON-first (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt_sleep/config.py:1`), its task records are structured separately (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt_sleep/types.py:45`), and its backend protocol owns `attempt`, `judge`, and `reflect` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt_sleep/backend.py:1`).

## 3. codex_exec Backend

There are two Codex paths in the package. The target execution path used by env rollouts is `skillopt/model/codex_harness.py`; the model-call helper in `skillopt/model/codex_backend.py` also shells out to `codex exec` for chat-like calls.

The target harness injects skill text by rendering it as `.agents/skills/skillopt-target/SKILL.md` in a per-task workspace (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_harness.py:38`). `prepare_workspace` recreates the task work directory, writes that skill file, writes `task.md`, and may copy/link additional files (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_harness.py:67`). SearchQA builds the injected skill, prepares a workspace at `pred_dir/codex_exec`, and then calls `run_target_exec` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/searchqa/rollout.py:89`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/envs/searchqa/rollout.py:130`).

The prompt tells Codex to read `task.md` and `.agents/skills/skillopt-target/SKILL.md`, not to call a Skill tool, and not to ask permission. With the default `allow_file_edits=False`, it also says not to modify files (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_harness.py:469`).

For SDK execution, the harness creates `Codex` with `working_directory=work_dir`, `skip_git_repo_check=True`, `sandbox_mode`, `network_access_enabled`, `web_search_enabled`, and `approval_policy` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_harness.py:799`). For CLI execution, it spawns:

```text
codex exec --skip-git-repo-check --color never -C <work_dir> [...]
```

with optional profile, reasoning effort, `--full-auto` or `--sandbox`, model, image flags, and `--output-last-message`, and runs the subprocess with `cwd=work_dir` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_harness.py:869`). `run_codex_exec` selects SDK/CLI based on `codex_exec_use_sdk`, retries empty outputs, and falls back from SDK to CLI unless mode is forced (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_harness.py:950`). `run_target_exec` dispatches `target_backend == "codex_exec"` to that harness (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_harness.py:1019`).

The config surface is installed through `configure_codex_exec`, with fields for path, sandbox, profile, full-auto, reasoning effort, SDK mode, network, web search, and approval policy (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/backend_config.py:91`). The trainer populates those values from config and defaults sandbox to `workspace-write`, network/web-search to false, and approval policy to `never` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:694`).

The model-call helper `skillopt/model/codex_backend.py` separately spawns `codex exec --json --ephemeral --profile ... --sandbox ... --skip-git-repo-check --cd ...` and defaults its working directory from `CODEX_WORKING_DIRECTORY` or `os.getcwd()` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_backend.py:23`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/model/codex_backend.py:280`).

## 4. Validation Gate And Artifacts

The trainer evaluates a baseline skill on `valid_seen` before the optimization loop and records a current/best selection score (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:991`). Candidate skills are evaluated into each step's `selection_eval` directory, then passed into `evaluate_gate` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:1418`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:1441`).

The gate compares candidate score against current and best. It accepts a new best only when `cand_score > best_score`, accepts a non-best improvement when `cand_score > current_score`, and otherwise rejects (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/evaluation/gate.py:76`). Accepted or rejected step state is persisted into the current/best skill state, history, and runtime records (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:1478`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:1532`).

Expected run artifacts include:

- `out/config.json`, written near trainer startup (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:816`).
- `out/history.json` and `out/runtime_state.json`, maintained through training (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:349`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:392`).
- `out/skills/skill_v0000.md` and later skill versions (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:363`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:1592`).
- `out/best_skill.md`, written during accepted steps and again at finalization (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:1593`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:2047`).
- `out/steps/step_0001/...` with rollout, patch, candidate, validation, and step-record files (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:1532`).
- `out/summary.json`, written by `_write_summary` (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:2301`).

## 5. Cost Knobs

The run budget is bounded primarily by:

- `num_epochs`, `train_size`, `batch_size`, and `accumulation`. The trainer derives steps from these values (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:779`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:801`).
- `sel_env_num`, `test_env_num`, and `eval_test`, which control selection and final evaluation sizes (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:991`, `tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:2066`).
- `minibatch_size`, `merge_batch_size`, `analyst_workers`, `max_analyst_rounds`, `edit_budget`, and update-mode flags, which bound reflection/edit work (`tools/skillopt/.venv/lib/python3.12/site-packages/skillopt/engine/trainer.py:838`).
- Env-specific `workers`, `max_turns`, and `exec_timeout`, which bound rollout concurrency and per-task target execution.

The smoke config sets all count knobs to one where accepted by the package: `num_epochs=1`, `train_size=1`, `batch_size=1`, `accumulation=1`, `sel_env_num=1`, `test_env_num=0`, `eval_test=false`, `max_turns=1`, `workers=1`, `analyst_workers=1`, `minibatch_size=1`, `merge_batch_size=1`, and `max_analyst_rounds=1`.

Important nuance: even with a one-task smoke, the trainer still performs a baseline validation rollout and a candidate validation rollout if a candidate patch is produced. So a true end-to-end run is likely more than one target call. This lane does not run it.

## Authored Smoke Config

Config:

```text
goals/skillopt-training-pilot/history/p1-spike/config.smoke.yaml
```

Fixture:

```text
goals/skillopt-training-pilot/history/p1-spike/fixture/Status.ts
```

Dataset:

```text
goals/skillopt-training-pilot/history/p1-spike/dataset/searchqa/train/items.json
goals/skillopt-training-pilot/history/p1-spike/dataset/searchqa/val/items.json
goals/skillopt-training-pilot/history/p1-spike/dataset/searchqa/test/items.json
```

External-command scoring is not wired because `skillopt-train` does not expose a YAML/config hook for it. The config uses SearchQA exact/F1 over a completion marker as the closest built-in metric.

## Static Validation

No `--dry-run` or `--validate` flag exists in `skillopt-train --help` or `skillopt-eval --help`. Best-effort validation used the package loader plus adapter setup:

```sh
env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt --offline python -c '...'
```

The loader flattened the structured YAML, resolved `out_root` and `skill_init`, and `SearchQAAdapter.setup` loaded `train=1`, `val=1`, `test=0` items without starting training.

## Orchestrator Launch Command

Do not run this inside a Codex investigation lane. The orchestrator can launch the smoke with:

```sh
env UV_CACHE_DIR=<tmp-uv-cache> \
  uv run --project tools/skillopt --offline skillopt-train \
  --config goals/skillopt-training-pilot/history/p1-spike/config.smoke.yaml
```

Expected output directory:

```text
goals/skillopt-training-pilot/history/p1-spike/out/
```

Expected artifacts include `config.json`, `history.json`, `runtime_state.json`, `best_skill.md`, `summary.json`, baseline validation results, and per-step directories under `steps/`.

## Open Risks

- The real repo law scorer cannot be expressed in the current `skillopt-train` YAML schema. It needs a custom environment/rollout adapter that can apply target edits to a scratch checkout and run `bun run beep lint schema-first` plus task-specific assertions.
- The built-in Codex harness writes a per-task workspace and, by default, prompts Codex not to modify files. The authored task names the prepared fixture, but the SearchQA harness is not a file-edit harness.
- Running the smoke requires Codex/OpenAI auth appropriate to the selected target and optimizer backends. In this sandboxed lane, no auth or end-to-end target call was attempted.
- Nested sandbox behavior may differ between SDK and CLI execution. The config leaves `codex_exec_use_sdk: auto`, `approval_policy: never`, network off, and sandbox `workspace-write`.
- The one validation item duplicates the smoke task because the trainer always needs a validation split for gate comparison.

## Smoke Run Result (orchestrator, 2026-07-06)

**LOOP RAN END-TO-END: exit 0, wall 27s, steps=1, best=1.0 (initial skill).**
Failure ladder to get there (each a durable integration finding):

1. `optimizer_backend: codex` invalid — optimizer accepts only
   `openai_chat|claude_chat|qwen_chat|minimax_chat` (backend_config.py:53).
   Resolution: `claude_chat` + `optimizer: sonnet` — shells the claude CLI
   (Max-plan OAuth, no API key).
2. `target: gpt-5-codex` → codex 400 "not supported when using Codex with a
   ChatGPT account". Resolution: empty target → harness omits the model flag
   → codex config default (gpt-5.5).
3. **skillopt 0.2.0 wheel packaging bug**: skillopt/prompts/*.md (21 files)
   and skillopt/envs/searchqa/prompts/*.md (3 files) are NOT shipped —
   FileNotFoundError('analyst_success') mid-gradient. load_prompt has no
   user-override path. Resolution (spike-grade): fetched all 24 .md from the
   GitHub v0.2.0 tag into the venv. Durable fix needed for P4: vendor the
   prompt set under tools/skillopt/ with a sync script, or pin a fixed wheel
   / upstream issue.
4. Perfect-score rollout ⇒ step SKIPPED (accept=0 reject=0 skip=1): with
   hard=1.0 and failure_only-irrelevant success analysis, no candidate patch
   was produced, so the gate never adjudicated. Corpus design consequence:
   tasks must be hard enough that the baseline skill FAILS some — gradient
   requires failure signal. The gate-rejection acceptance criterion needs a
   failing-task config (next P1 micro-iteration).

Token/cost reality: analyst (claude sonnet) 1,071 tokens; codex rollouts
report no token counts; 27s wall for a 1-task epoch. A 10-task × few-epoch
run extrapolates to minutes, not hours, at zero marginal cost on both plans.
