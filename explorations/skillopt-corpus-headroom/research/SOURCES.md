# SkillOpt Corpus Headroom — Sources & Provenance

- **Cluster / origin:** the harness-evidence-ledger P4 rerun close, then the
  2026-11-10 operator review that reshaped the packet around measuring skill
  effect.
- **Provenance:** [`RESEARCH.md`](../RESEARCH.md) carries every claim listed
  here.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) | MIT | reference-only | Nothing. The wrapper around it was retired in PR #1898. |

## 3. External research sources

- Claude Code documentation, "Test plugins with evals",
  <https://code.claude.com/docs/en/plugin-evals.md>, read 2026-11-10.
- Evan Miller, "Adding Error Bars to Evals: A Statistical Approach to Language
  Model Evaluations", <https://arxiv.org/abs/2411.00640>, 2024-11-01.

## 4. In-repo capability references

- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/` — the sandboxed
  law scorer (`evals score`) and trial comparison (`evals compare`). Reuse.
- `packages/tooling/library/ai-metrics` — benchmark run storage behind
  `evals score --record`. Reuse.
- `packages/tooling/tool/cli/src/commands/HarnessLedger/` — ledger rows and
  prune proposals. Reuse for recording.
- `.claude/skills/schema-first-development/` — the skill under test. Subject.
- [goals/skillopt-training-pilot/corpus/](https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/skillopt-training-pilot/corpus) —
  12 tasks in 4 families with fixtures and splits. Restore what the probe
  needs.
- `tools/skillopt/` — the SkillOpt adapter and runner. Retired in PR #1898;
  not reusable. Record:
  [`skillopt-retirement-record.md`](../../../goals/repository-simplification-residue/history/receipts/skillopt-retirement-record.md).
- Run-directory-to-scorer glue, interval arithmetic, a plugin wrapper for a
  repo skill — NET-NEW.

## 5. Cross-links & provenance

- Discovered from
  [`goals/harness-evidence-ledger`](../../../goals/harness-evidence-ledger/README.md).
- Evidence:
  [`history/p4-rerun/FINDINGS.md`](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/harness-evidence-ledger/history/p4-rerun/FINDINGS.md)
  and
  [`baseline-noise.json`](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/harness-evidence-ledger/history/p4-rerun/baseline-noise.json).
- This packet's [`RESEARCH.md`](../RESEARCH.md) and
  [`DECISIONS.md`](../DECISIONS.md).
