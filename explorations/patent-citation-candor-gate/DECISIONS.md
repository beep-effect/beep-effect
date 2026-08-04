# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.

Pre-seeded 2026-08-04: the packet is still at stage `capture`; these entries
landed early from the phase-2 /grill-with-docs session that opened the wedge
(explorations/README.md sanctions pre-seeding — the manifest stage remains the
authoritative resume point). Campaign-level decisions from the same session
(phase shape, contradiction-triage route) live in
../legal-patent-kg-deepening/DECISIONS.md; links, not copies.
-->

## 2026-08-04 — research depth

**Question:** What research does this wedge run in its research stage?

**Answer:** Two lanes. Lane A: repo composition inventory — a grounded
file:line map of `PatentMetadata`, `PriorArtReference`, `Claim`,
`TextAnchor`/`VerifiedTextAnchor`, `ProfessionalRuntime` contracts
(`RuntimeCandidateDraft`/`RuntimeApprovalGate`), `ExecutionLedger`, plus the
SPEC contracts of `goals/citation-extraction-engine`,
`goals/citation-verified-span-substrate`, and `goals/uspto-prosecution-read`,
reconciled against nuggets `T2-F2`/`T3-F7`/`ADHD-1` →
`research/01-repo-surfaces.md`. Lane B: bounded legal grounding over PUBLIC
primary sources only — 37 CFR 1.56 / 1.97 / 1.98, MPEP 2001 / 609, and the
Therasense but-for materiality standard — to draw the "what the system must
never compute" boundary precisely → `research/02-candor-legal-frame.md`. No
client or pre-publication material touches any cloud model (standing OIP
confidentiality rule).

**Rationale:** The campaign corpus was ontology/KG-focused and never covered
IDS/candor legal practice; the cluster's hardest caution ("the system must not
compute MPEP materiality or infer closure from missing events") is a boundary
that can only be drawn correctly with the primary rules in hand. Rejected:
repo-grounding only (boundary drawn from second-hand corpus mentions) and a
full adversarial deep-research track (the nuggets were already adversarially
verified; a mini-campaign is overweight for one wedge).

## 2026-08-04 — dependency posture

**Question:** How does this wedge relate to the three active-but-unfinished
goals it composes (`citation-verified-span-substrate`,
`citation-extraction-engine`, `uspto-prosecution-read`)?

**Answer:** Live source + SPEC-bound. The first rung composes only live source
(`PatentMetadata`, `PriorArtReference`, `VerifiedTextAnchor`). Anything
touching `CitationMention` or prosecution observations is written against
those goals' SPECs as binding contracts, and the eventual BRIEF marks such
acceptance criteria as gated on those goals landing. The wedge never blocks on
their completion and never forks their contracts.

**Rationale:** The signed-off first rung (a failing `CandorPolicy` test over
`PatentReference` + verified-anchor substrate) needs only what is live today.
Rejected: block-on-prerequisites (stalls the first wedge behind two goals with
no completion date) and own-adapter-seams (creates a second contract surface —
the exact duplication the routing seed warns against).

## 2026-08-04 — orchestration mode

**Question:** What orchestration mode runs this wedge's research and packet
work?

**Answer:** Codex-only continues from the campaign: zero Claude subagents;
`codex exec` (GPT-5.6 Sol) at `model_reasoning_effort=xhigh` for the two
research syntheses, `medium` for mechanical prep; the Fable main thread does
only grill/align/synthesis.

**Rationale:** The "system must never compute" legal boundary is
judgment-quality work — the same justification that held xhigh through the
campaign — and the codex-only engine preserves the Anthropic weekly quota per
standing routing doctrine. Rejected: medium-everywhere (risks a redo cycle on
the legal lane) and mixed Claude+codex (burns scarce quota on work codex
handles).

## 2026-08-04 — PR staging

**Question:** How do this wedge's stages land as PRs?

**Answer:** Two-stage. PR 1 (docs-only): packet open + capture + the phase-2
grill decision record (this file plus the parent packet updates). PR 2 (after
the align session with Benjamin): research artifacts + align outcomes.
BRIEF/shaping waits for align; research artifacts stay uncommitted until PR 2.

**Rationale:** Grill outcomes land as their own docs-only PR before further
work (standing feedback), matching the campaign's seed-then-stop staging.
Rejected: three-stage granular (three full closeout treadmills for one wedge)
and single-PR (mixes the decision record with unreviewed research output —
the pattern that generated the nine-thread closeout on PR #542).
