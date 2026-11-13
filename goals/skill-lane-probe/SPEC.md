# Skill Lane Probe Spec

## Objective

Measure whether loading the `schema-first-development` skill changes the
lane-fraction score Opus 5.5 earns on the 12 archived SkillOpt tasks, and
return a verdict against the rule in this file. The rule is on `main` before
any scored run.

The probe compares two cells per task:

| Cell | Prompt | Skill |
| --- | --- | --- |
| B | task prompt plus the Code Laws section of `AGENTS.md` | not loaded |
| C | same as B | loaded |

The cell names match the first probe so run records compare. C minus B is the
production question: does the skill add anything beyond the laws every
session already loads?

Background and the decisions behind this shape are in the source exploration:
the lane-probe addendum in
[`BRIEF.md`](../../explorations/skillopt-corpus-headroom/BRIEF.md), the
2026-11-13 entries in
[`DECISIONS.md`](../../explorations/skillopt-corpus-headroom/DECISIONS.md),
and the first probe's
[findings](../skill-effect-probe/history/FINDINGS.md).

## Non-Goals

- No optimizer, trainer or automated skill editing. The disposition recorded
  in
  [`skillopt-retirement-record.md`](../repository-simplification-residue/history/receipts/skillopt-retirement-record.md)
  stands.
- No new tasks, no new checks and no change to task manifest weights.
- No change to the skill under test or to scorer profile v3 while the probe
  runs.
- No use of the first probe's P0, pilot or voided runs as evidence.
- No models other than Opus 5.5, and no claims about Codex or Grok.
- No claim about tasks, rule families or skills outside the 12 tasks.
- No automatic pruning. A Null produces a proposal that a human admits or
  rejects.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`: lane fraction
  as a selectable primary, the within-task permutation test, the fixed-task
  interval and the three-outcome verdict, schema-first, with tests.
- This packet: run records and findings under `history/`.
- `harness-ledger/rows/`: one row for the verdict, and on a Null one prune
  proposal row, both through the harness-ledger CLI.
- [`MAP.md`](../../explorations/skillopt-corpus-headroom/MAP.md) of the
  source exploration, for the gate the verdict fires.

## Constraints

- **Runner and scoring.** `claude plugin eval` with `--model claude-opus-5-5`,
  `--keep-temp`, `--json` and `--max-cost-usd` on every invocation. Kept run
  directories are scored afterwards by the first probe's commands
  (`bun run beep agent-effectiveness evals probe score`) under scorer profile
  `skill-probe-scorer/v3`, unchanged.
- **Run configuration.** As fixed in the first probe's
  [first amendment](../skill-effect-probe/research/2026-11-13-analysis-rule-amendment.md),
  without cell A: one with-without invocation of the laws prompt against the
  skill plugin; tools Read, Write, Edit, Glob, Grep and Skill; 40 turns and
  900 seconds per run; concurrency 2.
- **Budget.** 120 scored runs: 12 tasks, 2 cells, 5 runs each. An excluded
  run is rerun at most twice, and there are at most 144 scored-run attempts.
  Runs spend the existing Anthropic plan; anything beyond it is a stop.
- **Rule before data.** The Decision Rule below is the analysis rule. It is
  on `main` before the commit that adds the first scored run record and is
  not edited after that. A change is a new dated file in `research/` that
  says what changed and why, committed before the scored run starts.
- **Fresh data.** Every scored run is new. The measure was chosen after the
  first probe's pilot contrast was seen; fresh runs under a rule merged first
  are the defence against that.
- **Analysis as run.** Every counted run counts in its cell whether or not
  the skill fired. The exclusion rules are those of the first probe's
  [analysis rule](../skill-effect-probe/research/2026-11-12-analysis-rule.md)
  (Counting and exclusion): a run that ended on an API or plan-limit error is
  excluded and rerun, never scored as zero.
- **Fixed tasks.** The 12 tasks are the whole population of the analysis.
  Run-to-run noise is the only source of uncertainty the verdict accounts
  for.
- **One treatment.** All scored runs share one skill content hash and one
  laws-text hash. A change to either during the run voids the runs made
  under the earlier hash.
- **Preflight.** Before the scored run, preflight is rerun under profile v3.
  A task that fails it is dropped and named.
- **Fingerprint.** Each run record carries the model id, the Claude Code
  version, the skill hash and the laws hash.
- **Fixtures stay out of `main`.** They are read from the goals archive at
  commit `94b8d15cd23bd07a95f6f1ab0680d24b94c5103b`, as in the first probe.
- **Tests with the code.** New command paths ship with tests that keep the
  package's coverage floors. The first probe's untested command paths turned
  `main` red after PR 3167.

## Decision Rule

Primary measure: lane fraction per run (the scorer's score in `[0, 1]`,
weighted per the task manifest), averaged per task and cell.

For each counted task `t`, `D_t = mean_C(t) - mean_B(t)`. The statistic is
`D`, the mean of `D_t` over counted tasks.

**Test.** If the skill changes nothing, the B and C labels of a task's runs
are interchangeable. The test draws 100,000 random relabelings, each keeping
every task's cell sizes, with seed 20261113, and recomputes `D` for each. The
two-sided p-value is `(1 + count(|D*| >= |D|)) / (1 + 100000)`. A difference
is **detected** when `p < 0.05`.

**Interval, reported and not deciding.** `D ± 1.96 * SE` with
`SE = sqrt(sum_t (var_C(t)/n_C(t) + var_B(t)/n_B(t))) / T`, sample variances
over runs.

Outcomes, checked in this order:

1. **Incomplete** when fewer than 10 tasks have 5 counted runs in both cells
   after reruns. No verdict; the findings say what is missing.
2. **Effect** when a difference is detected and `D >= 0.10`. The source
   exploration reopens at `decompose` to size a corpus from the measured
   effect and variance.
3. **Small effect** when a difference is detected and `0 < D < 0.10`.
   Reported with the per-family table. No trainer work and no prune proposal;
   the tombstones stay.
4. **Null** otherwise. The trainer question closes for lint-enforceable
   skills, the tombstones stay, and the findings carry a prune proposal for
   the skill. A detected difference below zero is reported as **harm**, and
   the proposal says so.

Secondary, reported with no verdict attached:

- `D` per family with its own permutation p-value, Holm-adjusted over the
  four families. On a Null, a family with an adjusted p-value under 0.05 and
  a positive difference is named in the prune proposal as guidance to keep.
- `D_t` per task.
- The family-clustered interval of the first probe's rule, as a
  generalisation line.
- All-lanes pass and law pass.
- Fired rate over counted cell C runs. Below 0.8 confirms the activation gate
  that the first probe fired on pilot evidence; at or above 0.8 the map notes
  that the pilot signal did not reproduce.
- `D` over fired cell C runs only, turns and wall time.

## Acceptance Criteria

- [ ] The first slice passes: the report run on the first probe's committed
      laws-pilot records prints `D`, the p-value and the interval; three
      tasks match a hand calculation; the same seed gives the same p-value
      twice; the output is labelled pilot data and writes no verdict.
- [ ] This file's Decision Rule is on `main` before the first scored run
      record.
- [ ] Preflight results under profile v3 are recorded.
- [ ] Run records for both cells are in `history/`, with fingerprints and the
      count of excluded runs.
- [ ] A findings file reports overall, per-family and per-task results for
      the primary and secondary measures and states the verdict against the
      Decision Rule.
- [ ] The verdict is a harness-ledger row. On a Null, a prune proposal row
      exists and is left for a human to dispose.
- [ ] The exploration's map and manifest record the gate the verdict fires.
- [ ] New code passes `bun run beep quality package-verify @beep/repo-cli`
      and the package's coverage floors hold.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/skill-lane-probe/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/skill-lane-probe/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/skill-lane-probe` | Passes |
| Package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Rule before data | `git log --format=%H --diff-filter=A -- goals/skill-lane-probe/history` against the commit that merged this file | That commit is an ancestor of every run-record commit |
| Budget | Run records | At most 144 attempts; excluded runs counted and explained |
| Reproducible test | The report run twice on the same records | Same p-value |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- `claude plugin eval` is switched off server-side or the plan limit rejects
  runs outright. Hold the run and report; do not substitute another runner
  or model.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add skill-lane-probe --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug skill-lane-probe`; add a `kind: decision` file there, never edit this block._

### Fixed tasks and a within-task permutation test decide the verdict, 2026-11-13

The 12 tasks are treated as the whole population, and labels are shuffled inside each task. An interval clustered over four families is about plus or minus 0.20 on the pilot's family differences however many runs are added, so it cannot detect an effect confined to one or two families. It is still reported, with no verdict attached.

Reverse: Return to the family-clustered interval as the decision in a new dated rule before the scored run starts.

### Fresh runs only, scorer profile v3 frozen, 2026-11-13

The primary was chosen after the first probe's pilot contrast was seen. Every scored run is new, the first probe's P0, pilot and voided runs are never pooled, and the scorer profile is used as merged.

Reverse: None inside this goal: pooling pilot runs or changing the scorer after the rule merges would void the verdict.

### Measure skill effect; build no optimizer, 2026-11-13

Carried from the first probe. The goal measures whether a skill changes model output. The SkillOpt retirement disposition (retire the runner, build no replacement optimizer) stands.

Reverse: Needs a new operator decision lifting the SkillOpt retirement disposition; then reopen the source exploration at decompose.

### Primary measure is lane fraction, 2026-11-13

The scorer's weighted per-run score was defined by the task manifests before any probe data, and it moved in the first probe's pilot where pass-or-fail measures sat at zero. Schema-first lane pass was rejected because a run that writes no schema passes it. New per-task checks were rejected as post hoc and as new corpus work.

Reverse: Pick another primary in a new dated rule before the scored run starts; afterwards only a new goal can.

### Three outcomes, with the 0.10 threshold kept, 2026-11-13

Effect needs a detected difference of at least 0.10; Small effect is a detected difference under 0.10; Null is no detected difference. The 0.10 threshold was fixed on 2026-11-10 before any data. The pilot difference was 0.088, so a threshold chosen near it now would be suspect. A two-outcome rule was rejected because a 0.03 difference would open corpus sizing.

Reverse: Needs a new operator decision; the threshold predates the data and is not retuned from it.

### Two cells and 120 scored runs, 2026-11-13

Laws prompt with and without the skill, 12 tasks, 5 runs each. Pilot noise (standard deviation 0.058 inside a task and cell) projects an overall interval of about plus or minus 0.02. The bare-prompt cell sat at the floor by construction in the first probe and is dropped. 192 runs and a three-cell 180 were rejected.

Reverse: Add runs per cell or restore the bare-prompt cell in a new dated rule before the scored run starts.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
