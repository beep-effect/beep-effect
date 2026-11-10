# Skill Effect Probe — Sources & Provenance

- **Source exploration:** `explorations/skillopt-corpus-headroom` — primary ledger:
  `explorations/skillopt-corpus-headroom/research/SOURCES.md`.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) | MIT | reference-only | Nothing. The wrapper around it was retired in PR #1898. |

## 3. External research sources

- Claude Code documentation, "Test plugins with evals",
  <https://code.claude.com/docs/en/plugin-evals.md>, read 2026-11-10. Runner,
  grader types, the no-plugin arm, isolation and the JSON result.
- Evan Miller, "Adding Error Bars to Evals: A Statistical Approach to Language
  Model Evaluations", <https://arxiv.org/abs/2411.00640>, 2024-11-01. Read the
  paired-difference, clustering and power sections in P0 before fixing the
  analysis rule.

## 4. In-repo capability references

- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/` — the sandboxed
  law scorer (`evals score`) and trial comparison (`evals compare`). Reuse and
  extend.
- `packages/tooling/library/ai-metrics` — benchmark run storage behind
  `evals score --record`. Reuse.
- `packages/tooling/tool/cli/src/commands/HarnessLedger/` — ledger rows and
  prune proposals. Reuse for the verdict row and the proposal.
- `.claude/skills/schema-first-development/` — the skill under test. Subject;
  not edited by this goal.
- [goals/skillopt-training-pilot/corpus/](https://github.com/beep-effect/beep-effect-goals-archive/tree/94b8d15cd23bd07a95f6f1ab0680d24b94c5103b/goals/skillopt-training-pilot/corpus) —
  12 tasks in 4 families with fixtures and splits, read at the pinned archive
  commit.
- [P4 rerun evidence](https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/harness-evidence-ledger/history/p4-rerun) —
  `FINDINGS.md` and `baseline-noise.json`. Reference.
- Eval cases and scaffold scripts, a plugin wrapper for the skill,
  kept-directory scoring, paired-difference arithmetic — NET-NEW.

## 5. Cross-links & provenance

- Exploration packet:
  [`BRIEF.md`](../../../explorations/skillopt-corpus-headroom/BRIEF.md),
  [`MAP.md`](../../../explorations/skillopt-corpus-headroom/MAP.md),
  [`DECISIONS.md`](../../../explorations/skillopt-corpus-headroom/DECISIONS.md),
  [`RESEARCH.md`](../../../explorations/skillopt-corpus-headroom/RESEARCH.md).
- Retirement record:
  [`skillopt-retirement-record.md`](../../repository-simplification-residue/history/receipts/skillopt-retirement-record.md).
