# Skill Effect Probe Spec

## Objective

Measure whether loading the `schema-first-development` skill changes what
Opus 5.5 produces on the 12 archived SkillOpt tasks, and return a verdict
against a rule fixed before any scored run.

The probe compares three cells per task:

| Cell | Prompt | Skill |
| --- | --- | --- |
| A | task prompt as archived | not loaded |
| B | task prompt plus the Code Laws section of `AGENTS.md` | not loaded |
| C | same as B | loaded |

C minus B is the production question: does the skill add anything beyond the
laws every session already loads? B minus A shows whether the tasks respond to
guidance at all.

Background, evidence and the decisions behind this shape are in the source
exploration: [`BRIEF.md`](../../explorations/skillopt-corpus-headroom/BRIEF.md),
[`RESEARCH.md`](../../explorations/skillopt-corpus-headroom/RESEARCH.md) and
[`DECISIONS.md`](../../explorations/skillopt-corpus-headroom/DECISIONS.md).

## Non-Goals

- No optimizer, trainer or automated skill editing. The disposition recorded
  in
  [`skillopt-retirement-record.md`](../repository-simplification-residue/history/receipts/skillopt-retirement-record.md)
  stands.
- No new corpus and no new tasks.
- No resurrection of the tombstoned candidates `hl-20261014-9e833571` and
  `hl-20261014-69d53a31`.
- No change to the skill under test while the probe runs.
- No models other than Opus 5.5, and no claims about Codex or Grok.
- No judge-model graders on the primary measure.
- No automatic pruning. A null produces a proposal that a human admits or
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

- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`: scoring of
  kept run directories and paired-difference arithmetic, schema-first, with
  tests.
- This packet: the eval suite (cases, scaffold scripts, the plugin wrapper
  for the skill), the analysis rule, run records and findings under
  `history/`.
- `harness-ledger/rows/`: one row for the verdict, and on a null one prune
  proposal row, both through the harness-ledger CLI.
- [`MAP.md`](../../explorations/skillopt-corpus-headroom/MAP.md) of the
  source exploration, if a gate fires.

## Constraints

- **Runner.** `claude plugin eval` with `--model claude-opus-5-5`,
  `--keep-temp`, `--json` and `--max-cost-usd` on every invocation. It has no
  custom-code graders, so `bun run beep agent-effectiveness evals score`
  scores each kept run directory afterwards.
- **Budget.** About 180 scored runs: 12 tasks, 3 cells, 5 runs each. A fourth
  cell (skill without laws) is allowed only if the harness cannot produce
  three cells and the total stays under the ceiling. Runs spend the existing
  Anthropic plan; anything beyond it is a stop.
- **Rule before data.** The analysis rule (measures, interval method,
  exclusion rules, thresholds) is committed before the commit that adds the
  first scored run record. It is not edited afterwards; a change is a new
  dated file that says what changed and why.
- **Analysis as run.** Every completed run counts in its cell whether or not
  the skill fired. Fired-only numbers are secondary. A run that ended on an
  API or rate-limit error is excluded and rerun, never scored as zero.
- **Four families.** The 12 tasks are 4 families of 3. The interval method
  must say how it treats that, and family-level results are reported beside
  task-level ones.
- **Preflight.** Before any scored run, the scorer fails each untouched
  fixture only on its task and passes each known-good solution on every lane.
  A fixture that cannot pass preflight is dropped and named, not repaired
  beyond what the scorer environment needs.
- **Fixtures stay out of `main`.** Fixtures are read from the goals archive
  at commit `94b8d15cd23bd07a95f6f1ab0680d24b94c5103b`
  ([archived corpus](https://github.com/beep-effect/beep-effect-goals-archive/tree/94b8d15cd23bd07a95f6f1ab0680d24b94c5103b/goals/skillopt-training-pilot/corpus)).
  The planted-violation TypeScript
  does not return to this repository's lint surface.
- **Fingerprint.** Each run record carries the model id, the Claude Code
  version, the content hash of the skill and the hash of the laws text.
- **Activation is part of the treatment.** The harness lets the model choose
  the skill. A `tool_used: Skill` grader records whether it fired; a low
  fired rate is a finding, not a failed run.

## Decision Rule

Primary measure: all-lanes pass per run, averaged per task and cell, scored
under the probe's scorer profile (see
[`research/2026-11-13-analysis-rule-amendment.md`](./research/2026-11-13-analysis-rule-amendment.md)).
The outcomes are checked in this order.

- **Insensitive.** Fewer than 4 counted tasks have at least one all-lanes
  pass among their B and C runs. Consequence: no verdict on the trainer
  question and no prune proposal; the findings carry the lane census. A task
  every run passes is not insensitive.
- **Effect.** Cell C beats cell B by at least 0.10 on the primary measure, and
  the interval on the per-task paired differences excludes zero. Consequence:
  the source exploration reopens at `decompose` to size a corpus from the
  measured effect and variance.
- **Null.** Anything else. Consequence: the trainer question closes for
  lint-enforceable skills, the tombstones stay as they are, and the findings
  carry a prune proposal for the skill. When the clustered interval on C
  minus B lies wholly below zero, the Null is reported as harm and the prune
  proposal says so.
- **Fired rate below 0.8 in cell C.** Reported as its own finding; it fires
  the activation-probe gate in the exploration map whichever way the main
  result falls.

Secondary measures, reported without a threshold: lane-fraction score, B
minus A, turns and wall time per run.

## Acceptance Criteria

- [ ] The first vertical slice passes: one task, three cells, two runs each,
      with every score tied to its case, cell and run.
- [ ] Preflight results are recorded for all 12 tasks.
- [ ] The analysis rule is committed before the first scored run record.
- [ ] Run records for every cell are in `history/`, with fingerprints and
      the count of excluded runs.
- [ ] A findings file reports per-task, per-family and overall results for
      the primary and secondary measures, each mean with its interval, and
      states the verdict against the decision rule.
- [ ] The verdict is recorded as a harness-ledger row. On a null, a prune
      proposal row exists and is left for a human to dispose.
- [ ] If a gate fired, the exploration's map and manifest say so.
- [ ] New code passes `bun run beep quality package-verify @beep/repo-cli`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/skill-effect-probe/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/skill-effect-probe/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/skill-effect-probe` | Passes |
| Package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Rule before data | `git log --format=%H --diff-filter=A -- goals/skill-effect-probe/history` against the commit that added the analysis rule | The rule's commit is an ancestor of every run-record commit |
| Budget | Run records | Scored runs within the ceiling; excluded runs counted and explained |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- The harness cannot tie a kept run directory to its case, cell and run, even
  with one case and one arm per invocation. Report that as the finding.
- `claude plugin eval` is switched off server-side or the plan limit blocks
  the scored run. Hold the run and report; do not substitute another runner
  or model.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add skill-effect-probe --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug skill-effect-probe`; add a `kind: decision` file there, never edit this block._

### A null closes law-skill training only, 2026-11-10

Rule: cell C must beat cell B by at least 0.10 on the all-lanes pass rate with an interval on per-task paired differences that excludes zero. Otherwise the trainer question closes for lint-enforceable skills, the tombstones stay, and a prune proposal goes to a human. Procedural skills and activation are untouched by a null.

Reverse: Reopen through the exploration map if a later probe on the same skill class shows an effect.

### Budget of about 180 scored runs on the existing plan, 2026-11-10

12 tasks, 3 cells, 5 runs each, under a cost ceiling passed to the harness. 110 runs was rejected as too noisy and 360 as twice the spend for a first look. No top-ups.

Reverse: Raise or lower runs per cell in a new dated analysis rule before any further scored run.

### First probe measures schema-first-development, 2026-11-10

Tasks, fixtures and the deterministic law scorer already exist for this skill, and the result speaks to the tombstoned candidates. A procedural skill and activation alone were rejected for the first probe and stay gated in the exploration map.

Reverse: Run the same suite shape against another skill as a gated follow-up from the exploration map.

### Fixtures are read from the archive at a pinned commit, 2026-11-10

The fixtures contain planted law violations. Reading them from the goals archive at commit 94b8d15cd23bd07a95f6f1ab0680d24b94c5103b keeps that TypeScript off this repository's lint surface and adds no excludes.

Reverse: Restore the fixtures into this packet with lint excludes if archive access proves unworkable in P0.

### Measure skill effect; build no optimizer, 2026-11-10

The goal measures whether a skill changes model output. The SkillOpt retirement disposition (retire the runner, build no replacement optimizer) stands. Source: explorations/skillopt-corpus-headroom/DECISIONS.md, 2026-11-10, unpark and reshape.

Reverse: Needs a new operator decision lifting the SkillOpt retirement disposition; then reopen the source exploration at decompose.

### Opus 5.5 only, scored after the run by the law scorer, 2026-11-10

Opus 5.5 is the child pin and matches the fingerprint on the tombstoned rows. The native harness has no custom-code graders, so runs are kept and scored afterwards.

Reverse: Add a model as a new cell in a later run; the scorer route changes only if the harness gains custom-code graders.

### Three cells: bare, code laws, code laws plus skill, 2026-11-10

Laws against laws plus skill is the production question because the code laws load in every session. The bare cell tells a redundant skill apart from tasks that respond to no guidance.

Reverse: Drop cell A in a later run if B minus A proves uninformative; the records for B and C stay comparable.

### Add the Insensitive outcome and a harm flag to the decision rule, 2026-11-13

Packet-author review 2026-11-13 (authorised as packet author): fewer than 4 counted tasks with an all-lanes pass in B or C means no verdict and no prune proposal; a C-B interval wholly below zero is a Null reported as harm. SPEC Decision Rule edited with the amendment file.

Reverse: Restore the two-outcome rule in a new dated amendment before any further scored run.

### Cell A from an empty plugin, B and C from one with-without run, 2026-11-13

Cell A runs the archived prompt against a skill-less plugin under --ablation none; B and C are the without and with arms of one laws-prompt invocation. No fourth cell.

Reverse: Add a fourth cell (skill without laws) in a new dated analysis rule if the arms prove unequal.

### Hold the scored run for the plan-limit reset, 2026-11-13

The seven-day limit resets 2026-11-15 23:00 America/Chicago. Per SPEC, no top-up, no runner or model switch: the headroom pilot and P2 resume after the reset.

Reverse: Resume earlier only if the operator assigns plan headroom; that is an operator decision, not an agent one.

### Known-good solutions stay out of the repository, 2026-11-13

Preflight solutions are fixture TypeScript; they live beside the archive checkout and history records their sha256 and score reports only.

Reverse: Commit them under a lint-excluded path if a reviewer needs to reproduce preflight without the cache.

### Probe records are a new schema next to AgentConventionTrial, 2026-11-13

AgentConventionTrial compares one declared pair of receipts with digest controls; a three-cell, five-run, twelve-task probe needs run records and a clustered report. Run records reuse AgentEffectivenessEvalScoreReport.

Reverse: Fold the probe into AgentConventionTrial if a later comparison needs one shape for both.

### Repair three scorer-drift items for this probe only, 2026-11-13

Ignore tsgo missingPipeableSignature (enabled 2026-08-10, stated nowhere), accept S.Opaque where tasks require extends S.Class (skill default since 2026-10-14), and accept S.decodeTo( where tasks require S.decode( (the skill's idiom; an author's call, since it fails the post-corpus test). Implemented as scorer profile skill-probe-scorer/v2 in SkillProbe.ts; the shared evals score command is unchanged.

Reverse: Score with profile v1 (drop repairSkillProbeTask and IGNORED_TSGO_RULES) in a new dated analysis rule.

### Run to kept directory through tracePath, 2026-11-13

Each --json run entry carries tracePath = <kept dir>/out/trace.jsonl, so case, arm and index tie to the kept directory in one invocation (P0 slice).

Reverse: If a later harness drops tracePath, fall back to one case and one arm per invocation.

### Runs get no Bash and a 40-turn, 900-second budget, 2026-11-13

Allowed tools Read, Write, Edit, Glob, Grep, Skill in every cell; the P0 maximum was 12 turns and 55 seconds.

Reverse: Grant Bash in a later run through a new dated analysis rule; records stay comparable only within one rule.

### Void the first P2 attempt, 2026-11-13

178 of 180 runs ended on the seven-day plan limit; the two that completed are not scored because the rule was amended before any scored record and scoring them would expose C-B before the headroom pilot.

Reverse: Score the two kept runs under v1 from the cached result if a reviewer wants them; they stay outside the evidence.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
