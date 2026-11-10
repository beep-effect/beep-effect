# Brief

## Problem

Two SkillOpt runs tried to improve `schema-first-development` and neither
showed lift. The second concluded that the corpus has no headroom at Opus 5.5.
The archived per-item scores say something narrower: two of four validation
items never vary, the gate compared single passes, and nobody measured the
model with no skill loaded. So the repo still cannot answer the question that
comes before any trainer or any corpus: does loading this skill change what
the pinned model produces?

The answer matters in both directions. If the skill has a measurable effect,
there is an effect size to size a corpus from. If it has none beyond the
always-loaded code laws, automated training of lint-enforceable skills is
closed with evidence, and a 7.9 KB skill becomes a candidate for shrinking.

Why now: the trainer is retired, the candidates are tombstoned, and Claude
Code ships an eval harness that runs a no-skill arm with repeats and
isolation. The measurement is cheap for the first time.

## Appetite

One goal, at most two pull requests, about two working sessions.

- About 180 scored runs on Opus 5.5: 12 tasks, 3 cells, 5 runs each.
- A hard cost ceiling passed to the harness on every invocation.
- No new package. Reusable code lands in the existing agent-effectiveness
  command; the eval suite lives in the goal packet. Fixtures are read from
  the goals archive at a pinned commit, so the planted-violation TypeScript
  stays off this repository's lint surface.

If the harness cannot be made to score kept run directories within the first
session, the goal stops and reports that as its finding.

## Solution Sketch

```text
12 archived tasks (4 families x 3)
        |
        v
eval cases, two prompt variants per task
   bare prompt            laws prompt (code laws inlined)
        |                        |
   no skill                no skill | skill loaded
        |                        |         |
      cell A                  cell B     cell C
        \________________________|_________/
                         |
        claude plugin eval --model claude-opus-5-5
          --runs 5 --keep-temp --json --max-cost-usd <ceiling>
                         |
        kept run directories + per-run JSON (skill-fired indicator)
                         |
        beep agent-effectiveness evals score, once per run
                         |
        per-task paired differences: B - A, C - B
                         |
        report + verdict against the agreed rule
```

- **Cases.** Each archived task becomes an eval case whose scaffold script
  seeds the fixture. The task prompt is reused as written. The laws variant
  inlines the Code Laws section of `AGENTS.md`.
- **Skill under test.** A minimal plugin wrapper around the live
  `schema-first-development` skill, so the harness can load it and withhold
  it.
- **Scoring.** The harness has no custom-code graders. Runs are kept with
  `--keep-temp` and scored afterwards by the retained law scorer. A native
  `tool_used: Skill` grader records whether the skill fired.
- **Preflight.** Before any scored run: the scorer fails an untouched fixture
  only on the task, and passes a known-good solution on every lane.
- **Measures.** Primary: all-lanes pass per run. Secondary: lane-fraction
  score, skill-fired rate, turns and wall time per run.
- **Decision rule, written down before the first scored run.** Cell C must
  beat cell B by at least 0.10 on the primary measure, with an interval on
  the per-task paired differences that excludes zero. Otherwise the result is
  a null for law-skill training. B minus A is reported to show whether the
  tasks respond to guidance at all. Results are analysed as run, whether or
  not the skill fired; fired-only numbers are secondary.
- **Outputs.** A findings file with per-task and per-family tables, the raw
  run records, one harness-ledger row for the verdict, and on a null a prune
  proposal for a human to admit or reject.

## Rabbit Holes

- **Run-to-directory mapping is unverified.** The docs say `--keep-temp`
  prints each run's path; whether the JSON ties a path to a case, arm and run
  is unknown. First task of the goal. If there is no mapping, run one case
  and one arm per invocation.
- **Three cells from a two-arm harness.** With and without the skill on both
  prompt variants gives four cells. The unwanted one (skill, no laws) is 60
  runs. Get cell A from an empty plugin with the ablation off, or accept the
  fourth cell only if it fits the ceiling.
- **Four families.** A cluster-aware interval over four families is wide.
  Fix the interval method in writing before the first scored run, report
  family-level results beside the task-level ones, and do not treat twelve
  tasks as twelve independent draws without saying so.
- **Activation is now part of the treatment.** The retired runner injected
  the skill; the harness lets the model choose it. A low fired rate is a
  finding about the description, not a failed run.
- **Fixture drift.** The fixtures were written against July toolchains and
  the P4 rerun met a dangling `tsconfig`. The preflight catches a broken
  scorer environment; do not repair fixtures beyond what the preflight needs.
- **The skill changed.** Thirteen commits since the rerun. The probe measures
  the live skill and records its content hash; it does not reproduce the
  September numbers.
- **Plan limits.** A rate-limited run scores zero in the harness. Exclude and
  rerun such runs; never count them.

## No-Gos

- No optimizer, trainer or automated skill editing. The locked disposition
  from the SkillOpt retirement stands.
- No new corpus and no new tasks in this goal.
- No resurrection of the tombstoned candidates.
- No change to the skill under test during the probe.
- No models other than Opus 5.5, and no claims about Codex or Grok.
- No judge-model graders on the primary measure.
- No automatic pruning. A null produces a proposal, and a human admits it.
