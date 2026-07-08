# P3B-ADAPTER Lane Summary

Worktree: `<local-worktree>`

## Deliverables

- `tools/skillopt/pyproject.toml` now packages `beep-skillopt-runner` and exposes `beep-skillopt-train = beep_skillopt.train:main`.
- `tools/skillopt/src/beep_skillopt/train.py` materializes vendored SkillOpt prompts into the installed `skillopt` package when missing, injects `scripts.train._ENV_REGISTRY["beeplaw"] = BeepLawAdapter`, then delegates to `scripts.train.main()`.
- `tools/skillopt/src/beep_skillopt/adapter.py` implements `BeepLawAdapter(EnvAdapter)` and `BeepLawDataLoader`.
- `tools/skillopt/vendor/prompts/` vendors all installed SkillOpt 0.2.0 prompt markdown found in the P1 Spike venv:
  - `prompts/*.md`: 21 core prompt files.
  - `envs/searchqa/prompts/*.md`: 3 SearchQA prompt files.
  - `envs/beeplaw/prompts/*.md`: 3 Beeplaw prompt files authored for code-fixture tasks.
- `tools/skillopt/configs/beeplaw.template.yaml` mirrors the P1 gate config with `env.name: beeplaw`, `split_dir: goals/skillopt-training-pilot/corpus/splits`, unchanged `skill_init`, and Beeplaw env keys.
- `tools/skillopt/tests/fixtures/` contains a one-item toy split, manifest, and fixture.
- `tools/skillopt/tests/test_adapter_stub.py` exercises the dataloader and stub scorer without spawning Codex.
- Proof logs are under `.proofs-adapter/`.

## Design Notes

- The adapter resolves `splits/*/items.json` records into task manifests using the P2/P3 contract fields: `id`, `prompt`, `fixture`, `entrypoint`, `completion`, and `weights`.
- Rollout copies the manifest fixture to `out_root/scratch/<item-id>/worktree`, injects the dynamic SkillOpt target skill at `.agents/skills/skillopt-target/SKILL.md`, writes `task.md`, then runs `run_target_exec(..., sandbox="workspace-write", full_auto=False)`.
- The Codex model argument comes from flattened `target_model`; an empty string is passed through so SkillOpt's Codex harness omits `-m`.
- Scoring runs after target execution from the repo root:
  `bun run beep agent-effectiveness evals score --dir <scratch> --task <manifest> --json`.
- Reward maps scorer JSON as contracted: `soft = score`, `hard = 1.0 if score >= 0.999 else 0.0`.
- `env.stub_scorer: true` or `BEEP_SKILLOPT_STUB_SCORER=1` uses deterministic Python scoring over fixture source files for `requiredPatterns` and `forbiddenPatterns`. It excludes `.agents`, `.git`, `node_modules`, and `task.md` so prompts do not satisfy their own completion patterns.

## Reuse vs Mirror

- Reused from SkillOpt/SearchQA:
  - `SplitDataLoader` split planning and train/eval batch semantics.
  - `EnvAdapter` reflection path and prompt lookup contract.
  - `render_skill_md` and `run_target_exec` from `skillopt.model.codex_harness`.
  - SearchQA-style resume behavior via `results.jsonl` and pending-item filtering.
- Mirrored locally:
  - The batch executor structure from SearchQA `run_batch`, adapted for scratch fixture copies, scorer execution, timeout rows, and Beeplaw result fields.
  - Skill injection path from `prepare_workspace`, without calling `prepare_workspace` directly because that helper deletes `work_dir` and would wipe the copied fixture.

## Prompt Materialization

- Vendor layout is package-relative beneath `tools/skillopt/vendor/prompts/`:
  - `prompts/<name>.md` materializes to `skillopt/prompts/<name>.md`.
  - `envs/searchqa/prompts/<name>.md` materializes to `skillopt/envs/searchqa/prompts/<name>.md`.
  - `envs/beeplaw/prompts/<name>.md` materializes to `skillopt/envs/beeplaw/prompts/<name>.md`.
- `beep_skillopt.train.materialize_vendored_prompts()` only copies missing files and clears the SkillOpt prompt cache if available.
- Vendor root discovery first checks the installed/local package layout, then walks from the current repo working directory. This keeps the console script usable even if the package is installed non-editably but launched from this repo.

## Verification Results

- `env UV_CACHE_DIR=<tmp-uv-cache> uv lock --project tools/skillopt --offline`
  - Failed. Log: `.proofs-adapter/uv-lock-offline.log`.
  - Cause: `skillopt==0.2.0` was not present in `<tmp-uv-cache>`, and network is disabled for this lane.
- `env UV_CACHE_DIR=<tmp-uv-cache> uv sync --project tools/skillopt --offline`
  - Failed. Log: `.proofs-adapter/uv-sync-offline.log`.
  - Same missing-cache cause.
- `env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt beep-skillopt-train --help`
  - Failed. Log: `.proofs-adapter/uv-run-help.log`.
  - Cause: this non-offline form attempted PyPI and DNS/network is blocked.
- `env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt --offline beep-skillopt-train --help`
  - Failed. Log: `.proofs-adapter/uv-run-help-offline.log`.
  - Same missing-cache cause as lock/sync.
- Fallback import check against the installed P1 Spike SkillOpt 0.2.0 venv:
  - Command used `PYTHONPATH=tools/skillopt/src` with `<local-worktree>/tools/skillopt/.venv/bin/python`.
  - Passed: `import-ok`.
  - Log: `.proofs-adapter/python-import-fallback.log`.
- Inline stub-scorer dry validation:
  - Instantiated `BeepLawAdapter` on `tools/skillopt/tests/fixtures/splits`.
  - Exercised dataloader plus `rollout(..., skip_exec=True)` with stub scorer.
  - Passed: `stub-ok toy-required-pattern 1.0 1.0`.
  - Log: `.proofs-adapter/python-stub-validation.log`.
- Checked-in stub test:
  - Passed: `stub-ok`.
  - Log: `.proofs-adapter/test-adapter-stub.log`.
- Compile check:
  - `<local-worktree>/tools/skillopt/.venv/bin/python -m compileall -f tools/skillopt/src/beep_skillopt`
  - Passed for `__init__.py`, `adapter.py`, and `train.py`.
  - Log: `.proofs-adapter/compileall.log`.

## Live 1-Item Smoke Command

Run from the worktree root after the orchestrator has network/cache available for `uv sync`:

```sh
env UV_CACHE_DIR=<tmp-uv-cache> \
  uv run --project tools/skillopt \
  beep-skillopt-train \
  --config tools/skillopt/configs/beeplaw.template.yaml \
  --cfg-options \
    env.out_root=goals/skillopt-training-pilot/history/p3b-adapter/out-live-1 \
    env.limit=1 \
    env.workers=1 \
    train.train_size=1 \
    train.num_epochs=1 \
    train.batch_size=1 \
    train.accumulation=1 \
    evaluation.sel_env_num=1 \
    evaluation.test_env_num=0 \
    evaluation.eval_test=false
```

For a pre-scorer smoke that still runs the full SkillOpt loop but avoids the Bun scorer subprocess, add:

```sh
BEEP_SKILLOPT_STUB_SCORER=1
```

## Open Risks

- I could not regenerate `uv.lock` in this lane because the requested offline cache does not contain `skillopt==0.2.0`; the orchestrator should rerun lock/sync with network or a warmed cache.
- I did not run live Codex-in-Codex rollout, per lane constraint. The live smoke command above is the handoff.
- The real scorer CLI is assumed to match the P2/P3 contract exactly: exit 0 for completed scoring and JSON stdout with a numeric `score`.
- `max_turns` is accepted for config compatibility, but Beeplaw rollout currently performs one Codex exec spawn per item as specified by the contract.
