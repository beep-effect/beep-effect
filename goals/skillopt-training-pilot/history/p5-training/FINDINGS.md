# P5 Training Run — full corpus, real reward: loop proven, zero lift

2026-07-06/07. First full-scale SkillOpt training run of
`.claude/skills/schema-first-development/SKILL.md` on the shipped harness
(PR #309, merged as `fb7ce421ce`).

## Configuration

12-task corpus (4 SFV4 rule classes), 8 train / 4 validation; 2 epochs,
batch 2, minibatch 2, edit budget 1, patch mode; codex_exec target rollouts
in fixture scratch copies; reward = `beep agent-effectiveness evals score`
(completion × law, real subprocess); claude_chat sonnet optimizer;
gate metric soft over the full 4-item selection set; serial workers,
600s rollout timeout, bytes-shim active.

## Result

```text
steps=8 accept=0 reject=6 skip=2
best_score=0.4714 (step 0 — the unmodified baseline)
wall=5409s (90 min)  tokens=38,109
```

- Baseline validation mean: **0.4714**.
- All 6 candidate edits scored **below** baseline on validation:
  0.3773, 0.4089, 0.3322, 0.2784, 0.2870, 0.3287.
- 2 steps skipped (analyst declined to patch after examining failures).
- `best_skill.md` == `skills/skill_v0000.md` == the committed skill.

## Reading

1. **The loop-runs bar is met at full scale.** Every stage — dataloader,
   fixture scratch rollouts, real law-scorer reward, minibatch reflection,
   patch merge/selection, full-validation gate — executed for 8 consecutive
   steps without operational failure. The SPEC's "gate demonstrably rejected
   ≥1 regressing edit" criterion is met six times over.
2. **No measured lift at this optimizer budget.** Every accepted-candidate
   path was exercised and none improved held-out performance; edits
   (uniformly append-style guidance, +450–900 chars) consistently *degraded*
   validation scores. The gate is the reason the skill did not get worse —
   which is the pilot's core mechanism working, not a failure of it.
3. **Interpretation.** The baseline skill already encodes the laws the
   corpus tests; one-edit-per-step generic guidance mostly adds noise/dilution
   that measurably distracts the rollout agent. Lift, if available, likely
   requires: bigger edit budgets + more analyst rounds, skill-aware
   reflection / rewrite modes (both off in this run), a stronger optimizer
   model, per-rule-class targeting, or a corpus whose failures stem from
   *missing* skill content rather than agent execution variance.
4. **Cost profile.** Gate evaluation dominates wall time (~75% of a step:
   4 rollouts + 4 scorer invocations, each scorer run ~2 min mostly tsgo).
   Any follow-on should parallelize workers and/or cache scorer toolchain
   startup before scaling epochs.

## Verdict — PARK (with findings)

Per the packet contract (loop-runs = success bar; lift = evidence;
park-with-findings = legitimate outcome): the harness is proven and shipped;
training at this configuration yields no lift. **Park further training** until
one of the levers in (3) is worth an experiment; the harness, corpus, and
scorer remain ready to rerun with a one-line config change.

## Artifacts

`out/` (bulky per-step rollout/selection prediction+scratch traces pruned;
scores, records, patches, skills, and baseline selection retained),
`run.log` (full).
