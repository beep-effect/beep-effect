# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-22 — purpose

**Question:** What should the comment ban cover?

**Answer:** The operator reframed the packet instead of choosing a scope: "I'm not sure the idea here is to
figure out what is stale. I think my jsdoc system is good but I'm challenging my assumptions. Many say code
comments especially with agents are bad. Essentially I want to see how many of my code comments are useless,
stale, or being used to cope for bad decisions." The packet's first deliverable is that assessment, with the
JSDoc system tested as a hypothesis rather than exempted. Ban scope is reopened as a question that follows
from the assessment.

**Rationale:** Recommended was prose plus non-exported JSDoc. The reframe makes scope a consequence of the
evidence, so it is not decided here.

## 2026-11-22 — hazards and narration

**Question:** What happens to the 71% of comments the four categories do not name?

**Answer:** Absorb and keep under the ratchet. New ones are banned. Existing ones shrink as the code takes them
into a test title, name, type or assertion. A hazard with no better home keeps one allow-listed form.

**Rationale:** Recommended. Rejected: delete all (discards about 13,000 reasons no check carries), ban only the
four categories (not mechanically knowable), ADR every hazard (about 135,000 lines of ADRs).

## 2026-11-22 — ADR home

**Question:** Where do package decision records go?

**Answer:** `<package>/decisions/<YYYY-MM-DD>-<slug>.md`, one file each, reusing the goal-decision parser with
`governs` anchors a check resolves, plus a `beep decisions for <path>` lookup. `ADR-FORMAT.md` and two lines of
`grill-with-docs/SKILL.md` are amended in the goal.

**Rationale:** Recommended. Rejected: README tables (one-tail conflicts), a central decisions directory under standards
(left behind when a package moves), enforce-only (loses about 115 whys).

## 2026-11-22 — excuses

**Question:** How do excuses become issues?

**Answer:** One issue per root-cause family, opened only for families the sweep cannot fix; cheap fixes land in
the sweep. A comment is deleted only with its fix or its family issue. This is the operator's authorised
deferral under the AGENTS.md fix-where-found law.

**Rationale:** Recommended. Rejected: one issue per excuse (about 175, mostly duplicate causes), fix all with no
issues, file all and fix none.

## 2026-11-22 — exported JSDoc

**Question:** 60% of sampled exported blocks carry prose that only restates the code or its `$I.annote*`
description. What should the JSDoc law do?

**Answer:** Single-source the lead. Keep Examples, `@category`, `@since` and real Details or Gotchas. Stop
requiring a lead on type-level companions, barrels and schemas whose annotation already describes them;
docgen derives that text from the annotation. A lint flags a lead that restates its annotation.

**Rationale:** Recommended. Rejected: keep the law and lint tautology (keeps two copies of one sentence),
leave JSDoc alone (ignores where the useless comments are), drop all prose (loses the Details and Gotchas
in about 15% of blocks).

## 2026-11-22 — ban scope

**Question:** What may agents no longer add?

**Answer:** Free prose and truly local JSDoc, repo-wide in src, tests and tooling, through a growth check
against the merge base. Existing hazards and narration stay under the ratchet. A hazard with no better home
keeps one allow-listed form. Directives, licences and generated, vendored and fixture files are exempt by
an exact-token grammar.

**Rationale:** Recommended. Rejected: review-only enforcement (inflow is 91% of commits), a repo-cli pilot
first (the growth check is cheap enough to apply everywhere at once).

## 2026-11-22 — slicing

**Question:** How does the packet graduate?

**Answer:** Four goals. The growth check and the census defects start in parallel; the sweep and the JSDoc
lead change follow the growth check.

**Rationale:** Recommended. Rejected: one phased goal (the three-open-PR cap would serialise unrelated
work), defects and growth check only (leaves the assessment unacted on).
