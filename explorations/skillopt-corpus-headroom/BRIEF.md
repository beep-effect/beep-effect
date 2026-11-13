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

## Addendum, 2026-11-13: the lane probe

The pitch above graduated as `goals/skill-effect-probe`, which returned
Insensitive. This addendum shapes the second goal,
`goals/skill-lane-probe`. Decisions behind it are in
[`DECISIONS.md`](./DECISIONS.md) under 2026-11-13.

### Problem

The first probe could not answer its question. The completion contract needs
`@beep/*` imports that a standalone, tool-less run does not write, so every
pass-or-fail measure sat at zero in every cell
([findings](../../goals/skill-effect-probe/history/FINDINGS.md)). The
corpus's own continuous score did move in the pilot: 0.490 without the skill
and 0.578 with it, with a run-to-run standard deviation of 0.058. That
contrast came from 48 unscored runs and was seen before any rule covered it,
so it is a reason to measure, not a result.

### Appetite

One goal, one working session, at most two pull requests plus the
packet-state one. 120 scored runs on Opus 5.5 on the existing plan, with a
cost ceiling on every invocation. No new package: the code is a small
addition to the probe commands the first goal shipped.

### Solution Sketch

```text
12 archived tasks, laws prompt, scorer profile v3 (all on main)
        |
        v
one with-without invocation, 5 runs per task and arm
   without skill = cell B        with skill = cell C
        |                              |
        +---------- 120 kept run directories ----------+
                         |
        probe score  ->  lane fraction per run
                         |
        difference D = mean over tasks of (mean C - mean B)
        permutation test: shuffle B and C labels inside each task
        fixed-task interval, per-family table
                         |
        verdict: Effect | Small effect | Null (harm flagged)
```

- **Rule first.** The primary, the test, the thresholds and the outcomes are
  in the goal's `SPEC.md`, which merges before any scored run.
- **Fresh data.** No pilot or P0 run is evidence.
- **Reuse.** Staging, preflight, scoring, exclusion and run records are the
  first probe's, unchanged.
- **Outputs.** A findings file with overall, per-family and per-task
  results, the run records, one harness-ledger row for the verdict, on a Null
  a prune proposal for a human, and the fired rate from 60 scored runs.

### Rabbit Holes

- **Post-hoc primary.** The measure was picked after the pilot. Nothing is
  tuned once the rule is merged; a change is a new dated rule before the
  scored run.
- **Unreachable patterns inside the score.** They are a constant in both
  cells. Do not re-weight the manifests to remove them.
- **Monte Carlo test.** Full enumeration is out of reach (252 label splits
  per task, 12 tasks). Fix the number of shuffles and the seed in the rule so
  the p-value is reproducible.
- **Activation.** A low fired rate dilutes the difference. Analyse as run;
  fired-only numbers are secondary.
- **Plan limits.** The first probe lost 178 runs to a weekly limit. Check
  the account before the run and exclude rejected runs.
- **Early merges.** Ready pull requests have been merged by hand within
  minutes. Say in the final pull request's title that it waits for
  `merge-ready: yes`.

### No-Gos

- No optimizer, trainer or automated skill editing.
- No new tasks, no new checks and no change to manifest weights.
- No change to the skill or to scorer profile v3 during the probe.
- No use of pilot or P0 runs as evidence.
- No models other than Opus 5.5.
- No automatic pruning.
