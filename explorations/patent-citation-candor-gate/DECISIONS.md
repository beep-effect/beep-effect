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
never compute" boundary precisely → `research/02-candor-legal-frame.md`. On
top of both lanes, `RESEARCH.md` is authored as the canonical stage-1
synthesis and index (`explorations/README.md` stage contract) before the
packet advances to align; all three land together in PR 2. No client or
pre-publication material touches any cloud model (standing OIP
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

## 2026-08-04 — align: PatentFragmentLocator home

**Question:** Where does the tagged `PatentFragmentLocator` (claim |
paragraph | figure | document fragment identity that survives text reflow)
live?

**Answer:** A law-practice value object
(`packages/law-practice/domain/src/values/PatentFragmentLocator/`), beside
`Claim`, `PatentDocumentTriplet`, and `DurableLocator`. It composes
`TextAnchor`/`VerifiedTextAnchor` for optional exact-span deepening and never
replaces them (T3-F7). No generic locator abstraction is created now;
shared-kernel promotion happens only if `goals/citation-extraction-engine`
later needs the contract, through the normal promotion-record gate.

**Rationale:** `foundation/modeling/provenance` is explicitly domain-agnostic
(exact offsets/quotes), while every adjacent fragment-identity surface is
law-owned; Lane A confirmed `DurableLocator` is quote/context-based and does
not close the structured-fragment gap. Rejected: a provenance-neighbor
generic locator family (patent vocabulary in a domain-agnostic package,
generality without a second consumer) and extending `DurableLocator` (mixes
structured identity into a quote-based surface).

## 2026-08-04 — align: fact/judgment split

**Question:** How do procedural IDS facts and attorney candor judgment relate
in the schema — what does `CandorDisposition` itself hold?

**Answer:** Hard split. Immutable, append-only fact records own the
1.97/1.98/supplemental mechanics (filing acts, dates, window facts,
fee/statement presence, content presence, office treatment) on the
`ExecutionLedger` precedent. `CandorDisposition` holds ONLY the attorney
judgment: dated, scoped, referencing the exact facts and observation version
it disposes. Window arithmetic is derivable fact; materiality,
cumulativeness, and satisfaction stay human.

**Rationale:** Lane B's never-compute boundary defines the disposition as a
dated judgment record, and the T2-F2 caution requires the fact families to
stay separate claims. Rejected: a fat disposition embedding fact snapshots
(duplicates fact state, blurs the axis, invites the named false-closure
ambiguity) and deferring the split to shaping (it is the packet's central
structural decision).

## 2026-08-04 — align: closure shape

**Question:** What blocks or releases filing promotion — how is candor
"closure" represented?

**Answer:** Derived gate, no stored closure. No "duty satisfied" status
exists anywhere. Promotion blocks on a derived predicate: zero current
AI-discovered citation events lacking an attorney disposition bound to that
event's EXACT observation version. Stale, quarantined, and duplicate events
count as undisposed (fail closed). Dispositions bind one event each in this
wedge; grouped/manifest dispositions are deferred to a later align if
practice demands them.

**Rationale:** Under 1.56(a) satisfaction depends on all known material
information, so an unscoped terminal boolean is legally incoherent (Lane B
Q9), and the ADHD-1 first-step test already asserts exact
observation-version coverage. Rejected: grouped dispositions in V1 (the
grouping rule becomes a false-closure surface the first rung must then
prove safe) and a stored satisfaction opinion (stores the incoherent
terminal state plus staleness machinery the derived gate gets for free).

## 2026-08-04 — align: wedge scope and rung order

**Question:** What IDS-mechanics scope does this wedge take on, and in what
order?

**Answer:** Core-first. Rung 1: `PatentCitationEvent` + `CandorDisposition` +
the derived gate (the failing CandorPolicy test). Rung 2, same packet: the
immutable IDS-submission / office-treatment fact records from the hard split,
with supplemental IDSs as append-only submissions each independently tested
(MPEP 609.05(a): a correction gets its own operative filing date). Explicitly
OUT as BRIEF no-gos: the continuing-application matrix (MPEP 609.02) and
1.97(e) certification predicates — each returns via its own align question
when practice demands it.

**Rationale:** The signed-off first rung needs only event + disposition +
gate; the hard split needs an owning home for the fact records, which rung 2
provides without fattening rung 1. Rejected: full mechanics in rung 1
(fattens past the signed-off failing-test shape) and a gate-only packet
(orphans the fact records; the routing seed queues no other IDS wedge).

## 2026-08-04 — align: deferrals (with owners)

**Question:** What happens to Lane B's remaining align questions?

**Answer:** DEFERRED into locked boundaries: disposition vocabulary (Lane B
Q3) and the concrete supplemental-relation record shape (Q7) are BRIEF/shaping
detail inside the hard-split and rung-2 decisions; dual cumulativeness
judgments (Q5) and 1.97(e) statement facts (Q6) ride with rung 2's shaping;
the continuing-application matrix (Q8) is a named no-go pending its own
align; the CFR-vs-MPEP source-version precedence caveat (Q10) lands as a
BRIEF constraint. Grouped dispositions (Q4's remainder) wait for practice
evidence.

**Rationale:** Align closes branches that change the BRIEF's shape; these
remaining items are detail within already-closed branches or future branches
with named triggers.

## 2026-08-04 — orchestration supersession (codex → Opus 5)

**Question:** Does the locked codex-only orchestration mode still govern this
packet's sub-agent work?

**Answer:** Superseded. Approaching the weekly codex limit, Benjamin directed
(2026-08-04): "From here on use Opus 5 sub-agents instead." All campaign
sub-agent work routes to Claude Opus 5 subagents until the codex window
resets; the BRIEF's three-lens adversarial review already ran on Opus 5.

**Rationale:** The original decision's quota arbitrage inverted — the codex
window became the scarce pool. The Fable main thread's role (grill, align,
synthesis) is unchanged.

## 2026-08-04 — shape: BRIEF approved

**Question:** Does the BRIEF match the picture in Benjamin's head (the
stage-3 exit signal)?

**Answer:** Yes — approved 2026-08-04, after a three-lens adversarial Opus 5
review whose 24 verified findings were folded in first. Load-bearing
corrections: quarantine and staleness split into separately-triggered states
(quarantine from raw-preserving unknown codes, staleness from source-version
mismatch); evidence grounding upgraded to the live
`TextAnchorVerificationReceipt`; citing-application identity bound to the
live `ApplicationNumber` (ST.13) value; `RuntimeApprovalGate` composition
made explicitly read-only (single-member decision vocabulary; the new
cross-slice edge is a named inherited risk); rung 2 re-costed around the
slice's first db-admin migration lane; 1.97 window arithmetic bounded to
candidate-window-never-compliance; two never-compute no-gos added (examiner
reliance from IDS markings; computed excusal under 1.98(c)/(d));
`PatentFragmentLocator` demoted to rung-1-optional/later-rung child. Stage
align → shape.

**Rationale:** Exit signal per `explorations/README.md` stage 3: the human
says the brief matches. Next stage: decompose (`MAP.md`).
