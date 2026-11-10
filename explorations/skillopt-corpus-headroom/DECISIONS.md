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
