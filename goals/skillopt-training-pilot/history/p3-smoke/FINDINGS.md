# P3 Integration Smokes — beeplaw env + real law-scorer reward

2026-07-06. All three P2/P3 lanes (corpus, scorer CLI, beeplaw adapter)
merged and exercised together, live (unsandboxed orchestrator runs).

## Runs

| Run | Reward | Result | Wall |
| --- | --- | --- | --- |
| `run-stub.log`, `out-stub/` | stub (pattern checks) | exit 0; train soft 0.60 → 1 edit (6,356 → 6,814) → val 0.3333 < 0.6667 → **REJECT** | 215s |
| `run-real.attempt1-timeout-bytes.log` | real scorer | crash: train rollout exceeded 120s `exec_timeout`; upstream bytes bug (below) | — |
| `run-real.log`, `out-real/` | **real law-scorer** | exit 0; baseline val 0.4444; train soft 0.4167 → 1 edit (6,356 → 7,216) → val 0.3000 < 0.4444 → **REJECT** | 279s |

Both completed runs adjudicated real candidate edits on real schema-authoring
tasks; in both, the gate correctly refused an edit that regressed validation
— the anti-regression property working under production reward.

## Baseline corpus calibration (P2 exit proof)

`baseline-scores.jsonl` — all 12 tasks scored by
`beep agent-effectiveness evals score` against pristine fixtures:
scores span **0.146–0.25**. None at 1.0 (every task yields gradient),
none at 0 without structural headroom (every task patchable). The
violation lists name exactly the planted naive-form defects.

## Upstream bug #2: TimeoutExpired bytes crash

`skillopt.model.codex_harness._run_codex_cli_exec` catches
`subprocess.TimeoutExpired` and persists `exc.stdout` — which CPython
types as **bytes even under `text=True`** — into a text-mode file:
`TypeError: write() argument must be str, not bytes`, killing the whole
training run on one slow rollout. Fixes shipped in `beep_skillopt`:

1. `train.py::_patch_codex_artifact_bytes()` — decodes bytes defensively
   around `_persist_codex_artifacts` at entry-point time.
2. `configs/beeplaw.template.yaml` `exec_timeout` 120 → 600 (observed
   code-authoring rollouts run 60–160s; 120s was razor-thin).

(Upstream bug #1 — the 0.2.0 wheel shipping zero prompt files — is fixed
durably by `tools/skillopt/vendor/prompts/` + entry-point materialization;
see `../p1-spike/FINDINGS.md`.)

## Reproduce

```sh
env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt \
  beep-skillopt-train --config tools/skillopt/configs/beeplaw.template.yaml \
  --cfg-options env.out_root=goals/skillopt-training-pilot/history/p3-smoke/out-real \
    env.limit=1 env.workers=1 train.train_size=1 train.num_epochs=1 \
    train.batch_size=1 train.accumulation=1 evaluation.sel_env_num=1 \
    evaluation.test_env_num=0 evaluation.eval_test=false
```
