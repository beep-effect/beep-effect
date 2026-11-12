# Research

## 2026-11-10

The question after the review in [`CAPTURE.md`](./CAPTURE.md): can the repo
measure, at affordable cost, whether loading a skill changes what the pinned
model produces? A corpus for a trainer comes second, and only if that
measurement shows an effect.

## External Landscape

### Claude Code plugin evals

Source: <https://code.claude.com/docs/en/plugin-evals.md>, read 2026-11-10,
and `claude plugin eval --help` on Claude Code 2.1.322.

- A case is a directory with a prompt and one or more graders. Each case runs
  three times by default (`--runs`), and the case score is the mean of its
  runs.
- Each case also runs with no plugin loaded. The report gives a with score, a
  without score and their difference per case. `--ablation none` turns the
  second arm off.
- Six grader types: `regex`, `tool_used`, `tool_order`, `file_exists`, `llm`
  and `baseline`. The docs state there are no custom-code graders.
- A `tool_used` grader on `Skill` is reported as an indicator in the with arm
  and is left out of the score, so the report separates "the skill fired" from
  "the output was right".
- Each run gets a temporary home, working directory and configuration. No
  user settings, hooks, `CLAUDE.md`, memory or other skills load, and the
  agent cannot read the eval directory. A `scaffold_script` seeds the
  workspace and runs only with `--scaffold`.
- `--keep-temp` keeps every run's directory and prints its path. `--json`
  carries per-run grader results. `--model` pins the model, `--max-cost-usd`
  caps spend and `--concurrency` runs up to eight at once.
- Runs draw on the caller's own plan limits.

Fit: the runner, the isolation, the repeats and the no-skill arm are all
there. The deterministic law scorer cannot be a grader, so it has to score the
kept run directories afterwards. Whether the JSON result maps each run to its
kept directory is unverified.

### Statistics for evals

Source: Evan Miller, "Adding Error Bars to Evals: A Statistical Approach to
Language Model Evaluations", <https://arxiv.org/abs/2411.00640>, submitted
2024-11-01. The paper treats an eval as an experiment and gives formulas for
analysing eval data, comparing two systems and planning an evaluation. The
sections on paired question-level differences, clustered questions and power
were not read in full for this pass; the goal should read them before fixing
its decision rule.

What this packet takes from it: compare arms on per-task paired differences,
treat a task family as the cluster, and report an interval with every mean.

### SkillOpt upstream

<https://github.com/microsoft/SkillOpt>, MIT, last pushed 2026-11-07. The
retired runner wrapped release 0.2.0. Nothing in this packet depends on it.

## In-Repo Capability Inventory

| Brick | Path | State |
| --- | --- | --- |
| Law scorer: `beep agent-effectiveness evals score --dir --task --json --record --model --reasoning-effort` | `packages/tooling/tool/cli/src/commands/AgentEffectiveness/` (`internal/EvalScorer.ts`, `EvalLawLanes.ts`, `EvalFixture.ts`) | Reuse. Sandboxed, 5 s median per task in the P4 rerun. |
| Trial comparison: `beep agent-effectiveness evals compare --baseline --candidate` with an `Incomparable` refusal | same package, `AgentEffectiveness.schemas.ts` (`AgentConventionTrial`) | Reuse or extend. Compares two declared trial receipts. |
| Benchmark run storage | `packages/tooling/library/ai-metrics`, written by `evals score --record` | Reuse. |
| Harness ledger and prune proposals | `packages/tooling/tool/cli/src/commands/HarnessLedger/` | Reuse for recording. `prune-proposals --window 30` produces rows today but counts touches only. |
| Task corpus: 12 tasks in 4 families, fixtures, splits, `DERIVATION.md` | [archived pilot corpus](https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/skillopt-training-pilot/corpus) | Restore what the probe needs. Not on `main`. |
| P4 rerun evidence: `baseline-noise.json`, `steps.jsonl`, skill versions | [archived P4 rerun](https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/harness-evidence-ledger/history/p4-rerun) | Reference. |
| Skill under test | `.claude/skills/schema-first-development/SKILL.md` (7,947 bytes, 13 commits since the rerun) | Subject. |
| Rollout runner | the SkillOpt runner | Retired in PR #1898. NOT FOUND on `main`. |
| Interval and paired-difference arithmetic for eval scores | NOT FOUND. `rg` for standard-error and confidence-interval helpers under `packages/tooling` finds only unrelated code. | NET-NEW, small. |
| Glue from kept run directories to the scorer | NOT FOUND | NET-NEW. |
| A plugin wrapper for a repo skill | NOT FOUND. No `.claude-plugin/` manifest in the repo. | NET-NEW, small. The docs also accept a skills-directory plugin. |

## Constraints Discovered

- Locked disposition (repository-simplification-confidence, workstream A):
  build no replacement optimizer. A measurement is in scope; a trainer is not.
- Both tombstoned candidates carry
  `resurrectWhen: a corpus with headroom above the 0.0833 baseline spread`.
- Rollouts spend the Anthropic plan, the scarce pool. The probe needs a stated
  run budget and `--max-cost-usd`.
- The native harness runs Claude models only. It says nothing about how Codex
  or Grok respond to the same skill.
- Isolation removes `CLAUDE.md`. In production the always-loaded code laws
  overlap the skill, so a bare without arm overstates what the skill adds
  day to day.
- In the native harness the skill has to be chosen by the model. The retired
  runner injected it. A with arm now measures activation and content together.
- The corpus has four families. An interval computed over twelve tasks as if
  they were independent would be too narrow.
- This repo is public. Fixtures restored from the archive are already public.
