# P1 Gate Proof — accept and reject branches demonstrated

2026-07-06. Follow-up to [`../p1-spike/FINDINGS.md`](../p1-spike/FINDINGS.md),
whose smoke run exited 0 but skipped the optimizer step (perfect baseline
score → no gradient). These two micro-runs close P1's last criterion: the
validation gate adjudicating real candidate edits, in both directions.

## Design

Both runs: 1 train item, 1 validation item, searchqa env, codex_exec target
(codex CLI default model), claude_chat sonnet optimizer, `gate_metric: soft`,
skill_init `.claude/skills/schema-first-development/SKILL.md`. Gold answers
are never rollout-visible (rollout sees skill + context + question only);
the analyst sees predicted-vs-gold, which is the gradient channel.

- **Accept probe** (`dataset-accept/`): train asks for a token stated in
  context, but gold requires an undisclosed `beep: ` answer-prefix
  convention → baseline fails exact match with a clearly *learnable*
  format rule. Validation is the same convention over a different token, so
  only a generalizable rule (not a memorized answer) can pass it.
- **Reject probe** (`dataset-reject/`): train reuses the learnable prefix
  failure (so the analyst reliably emits an edit), but validation gold is an
  unknowable passphrase absent from every rollout-visible surface → no edit
  can improve it, and since accept requires `cand_score > current_score`
  (tie rejects; `skillopt/evaluation/gate.py::evaluate_gate`), reject is
  forced.

## Results

| Run | Analyst | Skill delta | Gate verdict | Wall |
| --- | --- | --- | --- | --- |
| accept (`run-accept.log`, `out-accept/`) | 1 edit | 6,356 → 6,996 chars | `ACCEPT (new best) soft=1.0000 > prev best 0.6667` → `accept_new_best` | 40s |
| reject (`run-reject.log`, `out-reject/`) | 1 edit | 6,356 → 6,640 chars | `REJECT soft=0.0000 <= current=0.0000` → `reject`, best stays step 0 | 48s |

The accepted edit was a genuine generalization: learned from the alpha-token
failure, it transferred to the beta-token validation item (0.6667 → 1.0000).
The rejected edit is recorded with the step's `rejected_edits` in
`out-reject/history.json`.

## Findings

1. **Analyst declines unpatchable failures.** First reject attempt
   (`run-reject.attempt1-analyst-declined.log`) used an unknowable train
   answer: the rollout failed as designed, but the analyst returned 0 edits
   ("edits may be empty if no patch is warranted") → step skipped, gate
   never ran. Corpus consequence for P2: baseline-failing tasks must fail in
   ways a skill rule could plausibly fix, or they generate no gradient.
2. **Tie rejects.** `evaluate_gate` accepts only on strict improvement —
   flat-scoring corpora cannot ratchet the skill upward by luck.
3. **Custom env seam confirmed** (for P3): `scripts/train.py` resolves
   `env.name` through a plain module-level `_ENV_REGISTRY` dict populated by
   `_register_builtins()` at `get_adapter()` time; injected keys survive
   (builtins are added via per-key assignment, no dict clear). A thin
   wrapper entry point can `import scripts.train`, register a custom
   `beeplaw` EnvAdapter, and delegate to `scripts.train.main()` — no fork,
   no vendoring.

## Reproduce

```sh
cd <worktree-root>
env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt --offline \
  skillopt-train --config goals/skillopt-training-pilot/history/p1-gate/config.gate-accept.yaml
env UV_CACHE_DIR=<tmp-uv-cache> uv run --project tools/skillopt --offline \
  skillopt-train --config goals/skillopt-training-pilot/history/p1-gate/config.gate-reject.yaml
```

(Prompt files must be present in the venv — see the p1-spike findings on the
0.2.0 wheel packaging gap; durable fix tracked for P3/P4.)
