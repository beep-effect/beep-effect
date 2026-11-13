# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-01 — park until a corpus with headroom is wanted

**Question:** After the P4 rerun found no headroom, what should happen next
for SkillOpt skill training?

**Answer:** Park this exploration with the prerequisites written down. No
spend until the operator picks it up.

**Rationale:** The rerun could not test whether an annealed edit budget helps,
because the corpus saturates at Opus 5.5. Recommended and chosen over three
alternatives: a new goal packet now (real work and quota with no current
demand), a cheap probe with a weaker rollout model (it would tune the skill
for a model the operator does not run day to day), and dropping skill
training (the question is untested, not refuted).

## 2026-11-10 — unpark and reshape around measuring skill effect

**Question:** The packet was parked to wait for a corpus with headroom. After
the 2026-11-10 review, what should it become?

**Answer:** Unpark it. The packet now asks whether a skill changes what the
pinned model produces, and graduates one small probe goal with a kill
criterion agreed before any run. The slug stays, because the retirement record
and the P4 findings link to it.

**Rationale:** The trainer was retired in PR #1898 and the deferred candidates
were tombstoned, so a corpus built for the trainer has no consumer. The
archived per-item scores show that the baseline level was never the problem:
the hard score sits at 0.625 and still measures nothing. Rejected: killing the
packet (the no-skill baseline was never measured, so the question is still
open), and leaving it parked with corrected facts (it would wait on triggers
that cannot fire).

## 2026-11-10 — first probe measures schema-first-development

**Question:** Which skill does the first probe measure?

**Answer:** `schema-first-development`, on the 12 archived tasks.

**Rationale:** Tasks, fixtures and the deterministic law scorer already exist,
and the result speaks directly to the tombstoned candidates. Rejected for the
first probe: a procedural skill such as yeet (needs new tasks and judge-model
graders), and activation alone (says nothing about content). Both stay in the
map as gated follow-ups.

## 2026-11-10 — three conditions: bare, code laws, code laws plus skill

**Question:** The native harness strips `CLAUDE.md`, while in production the
always-loaded code laws overlap the skill. Which conditions does the probe
compare?

**Answer:** Three cells per task: the bare model, the code laws in the prompt,
and the code laws plus the skill.

**Rationale:** Laws against laws plus skill is the production question. The
bare cell tells a redundant skill apart from tasks that respond to no
guidance at all. Rejected: two production-faithful cells (a null would be
ambiguous) and the harness default of bare against skill (it overstates what
the skill adds day to day).

## 2026-11-10 — budget of about 180 scored runs

**Question:** Rollouts spend the Anthropic plan on Opus 5.5. How many runs is
the probe worth?

**Answer:** About 180: 12 tasks, 3 cells, 5 runs each, under a hard cost
ceiling.

**Rationale:** Enough to see a difference of roughly one task in twelve
between cells. Rejected: 110 runs (only a large effect clears the noise) and
360 runs (twice the spend for a first look).

## 2026-11-10 — a null result closes law-skill training only

**Question:** If code laws plus skill does not beat code laws alone by at
least 0.10 on the all-lanes pass rate, with an interval that excludes zero,
what does that close?

**Answer:** The trainer question for lint-enforceable skills. The tombstones
stay as they are. Procedural skills and activation remain gated follow-ups.

**Rationale:** The probe measures one skill class, so it can close one skill
class. Rejected: closing all skill training on this result (procedural skills
were never measured), and agreeing no consequence in advance (the probe could
then never end the question).

## 2026-11-10 — agent-decided details

**Question:** Which model, which scoring route, and which goal slug?

**Answer:** Opus 5.5 only, pinned by `--model`. The retained law scorer runs
over kept run directories after the fact. The goal is `skill-effect-probe`.

**Rationale:** Opus 5.5 is the child pin, where skill-guided volume work runs,
and it matches the fingerprint on the tombstoned rows. The native harness has
no custom-code graders, so the scorer cannot run inside it. Reversal: add a
model as a new cell in a later run; rename the goal before its first PR
merges.

## 2026-11-10 — DEFERRED: what corpus gives a measurable gap

**Question:** What corpus gives a measurable gap at the current target model:
more validation items, harder tasks, or both?

**Answer:** DEFERRED until the probe reports. If the skill shows an effect,
the packet reopens at `decompose` to size a corpus from the measured effect
and variance. If it does not, the question is closed for law skills.

**Rationale:** Corpus size follows from an effect size and a noise estimate.
Neither exists yet.

## 2026-11-10 — brief confirmed, graduate one goal

**Question:** Does [`BRIEF.md`](./BRIEF.md) match the operator's picture, and
which candidates graduate now?

**Answer:** It matches as drafted. `skill-effect-probe` graduates now. Corpus
sizing, a procedural-skill probe and an activation probe stay gated in
[`MAP.md`](./MAP.md).

**Rationale:** Rejected at the review: dropping the prune proposal from a null
result, and promising the activation probe alongside the first goal.

## 2026-11-13 — which fired gate is worked first

**Question:** `skill-effect-probe` returned Insensitive, and its pilot fired
rate (17 of 24) fired the activation gate. Which candidate is worked now: the
activation probe or the lane probe?

**Answer:** The lane probe graduates now as `goals/skill-lane-probe`.
DEFERRED: decomposing `skill-activation-probe` waits for the lane probe's
fired rate.

**Rationale:** The lane probe reuses the first probe's tooling and answers
the question the first one could not reach. It also yields a fired rate from
60 scored runs, a better basis for an activation probe than 24 pilot runs.
Rejected: working the activation probe first, and stopping with both gated.

## 2026-11-13 — lane probe: primary measure

**Question:** The pass-or-fail measures sat at zero because the completion
contract is unreachable without tools. Which measure is fixed in advance as
the primary?

**Answer:** Lane fraction: the scorer's per-run score in `[0, 1]`, weighted
per the task manifest, under scorer profile v3.

**Rationale:** The task manifests defined it before any of this data, and it
is the soft score the September runs used. In the laws-prompt pilot it moved
(0.490 without the skill, 0.578 with) and the run-to-run standard deviation
inside a task and cell was 0.058. Rejected: schema-first lane pass, because a
run that writes no schema passes it (bare-prompt pilot runs scored 1 on
fn-schema while laws-prompt runs scored 0); and new per-task checks written
from the skill text, because they would be authored after the contrast was
seen and are new corpus work.

## 2026-11-13 — lane probe: inference

**Question:** The first rule required an interval clustered over the four
task families to exclude zero. What decides the verdict now?

**Answer:** The 12 tasks are treated as a fixed set. A permutation test
shuffles the with-skill and without-skill labels inside each task. The
family-clustered interval is still reported and carries no verdict.

**Rationale:** The pilot's family differences were +0.25, +0.10, -0.04 and
+0.04. Clustered over four families that gives about ±0.20 however many runs
are added, so an effect confined to one or two families can never clear it.
The clustered interval answers whether an effect would hold for a new rule
family; four families cannot settle that. The fixed-task test answers whether
the skill changes output on these tasks, which is the question. Rejected:
keeping the clustered interval as the decision.

## 2026-11-13 — lane probe: cells and budget

**Question:** How many cells and runs?

**Answer:** Two cells, the laws prompt with and without the skill, 12 tasks,
5 runs each: 120 scored runs on the existing plan.

**Rationale:** Pilot noise projects an overall interval of about ±0.02 and a
per-family one of about ±0.04 at that size. The bare-prompt cell is dropped:
it sat at the floor by construction, and the first probe's decision file
named this as its reversal. Rejected: 8 runs per cell (192 runs) and keeping
three cells (180 runs).

## 2026-11-13 — lane probe: verdicts

**Question:** Which outcomes does the rule have, and does the 0.10 size
threshold stay?

**Answer:** Three outcomes, with 0.10 kept. Effect: the test rejects no
difference and the difference is at least 0.10; corpus sizing opens. Small
effect: the test rejects no difference and the difference is under 0.10;
reported by family, no trainer work and no prune proposal. Null: the test
does not reject; the trainer question closes for lint-enforceable skills and
a prune proposal goes to a human.

**Rationale:** The 0.10 threshold was fixed on 2026-11-10, before any data.
The pilot difference was 0.088, so a new threshold chosen near that value now
would be suspect. Rejected: two outcomes where any detected difference counts
as an effect, because a 0.03 difference would then open corpus sizing.

## 2026-11-13 — lane probe: agent-decided details

**Question:** What else is fixed before the first scored run?

**Answer:** The 72 pilot runs and the six P0 runs are not evidence; every
scored run is fresh. Scorer profile v3 is frozen as merged. Opus 5.5 only.
The test is two-sided at 0.05 with a recorded seed. A detected negative
difference is reported as harm inside the Null outcome. Family-level tests
are secondary, adjusted for four comparisons, and shape what a prune proposal
says without changing the verdict.

**Rationale:** The primary was chosen after the pilot contrast was seen. The
only defence is fresh data and a rule merged to `main` before the first
scored run. Reversal: any of these changes through a new dated analysis rule
before the scored run starts.
