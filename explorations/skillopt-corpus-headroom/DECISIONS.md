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
