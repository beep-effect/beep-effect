# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.

Pre-seeded 2026-08-05: the packet is still at stage `capture`; these entries
land early from the packet-open session (explorations/README.md sanctions
pre-seeding — the manifest stage remains the authoritative resume point) and
mirror the candor wedge's opening posture with wedge-specific deltas.
Campaign-level decisions (phase shape, contradiction-cluster re-route,
unblock milestone) live in ../legal-patent-kg-deepening/DECISIONS.md; links,
not copies.
-->

## 2026-08-05 — research depth

**Question:** What research does this wedge run in its research stage?

**Answer:** Two lanes. Lane A: repo composition inventory — a grounded
file:line map of `@beep/ontology` (`LiteralKit` domains, SKOS mapping kinds,
`TaxonomySeed`, `TaxonomyLoader` registry), the `EdgeVersion` bitemporal
substrate, `EdgeAuthority` record/supersede ports, the `ProfessionalRuntime`
contracts (`RuntimeApprovalGate` plus every live Party/Role/principal
surface), the `ExecutionLedger` append-only precedent, and the SPEC contract
of `goals/epistemic-contradiction-triage` (candidate ownership, disposition
flow, stop conditions) — reconciled against all ten nuggets and against the
graduated sibling `goals/patent-citation-candor-gate/SPEC.md` boundaries →
`research/01-repo-surfaces.md`. Lane B: bounded legal-theory grounding over
PUBLIC sources only — Hohfeld's two Yale Law Journal articles (1913/1917,
public domain), the published FLINT papers (van Doesburg & van Engers), the
`flint-ontology` repo strictly under its license split (Apache-2.0 portions
port-with-attribution; MPL-2.0 SHACL behavior clean-room only), and the
published UFO-L papers (Griffo et al.) — to draw (a) the correlativity
invariant precisely (one stored directed relation, derived opposite view),
(b) the relator identity fields competency questions demand (bearer,
counterparty, act/omission, result, grounding event, source rule — T1-F9),
(c) power/act transition semantics including attempted and ineffective acts,
and (d) the never-compute boundary: the system records positions, exercises,
and scope alignments; it never computes legal validity, authority, or
priority outcomes (T4-F6/T1-F3/T3-F9 cautions). `P100`/`R25` verification
happens in this lane — both stay `study` unless source-fidelity, beep-fit,
novelty, and license handling all pass →
`research/02-position-relator-legal-frame.md`. On top of both lanes,
`RESEARCH.md` is authored as the canonical stage-1 synthesis before the
packet advances to align; all three land together in PR 2. No client or
pre-publication material touches any cloud model (standing OIP
confidentiality rule).

**Rationale:** The campaign corpus verified the ten nuggets but the wedge's
hardest boundaries — correlativity as schema invariant, relator identity,
never-compute authority — can only be drawn correctly from the primary
theory sources, and the P100/R25 adoption gate explicitly requires
verification the campaign never ran. Rejected: repo-grounding only (draws
the Hohfeld boundary from second-hand distillates) and a full adversarial
deep-research track (eight of ten nuggets were already adversarially
verified; a mini-campaign is overweight for one wedge).

## 2026-08-05 — dependency posture

**Question:** How does this wedge relate to the live substrate it composes
and to `goals/epistemic-contradiction-triage`, whose SPEC the carried
cluster touches?

**Answer:** Live source + SPEC-bound, inheriting the candor wedge's posture.
The first rung composes only live source (`@beep/ontology`, `EdgeVersion`,
`EdgeAuthority`, `RuntimeApprovalGate`). All carried contradiction
vocabulary is written against `goals/epistemic-contradiction-triage`'s SPEC
as a binding contract per the 2026-08-04 compose-don't-widen decision: the
generic triage SPEC is never amended from this wedge, and minimal generic
extension slots may be proposed later only with fixture evidence (the T4-R2
precedent). The wedge never blocks on sibling goals and never forks their
contracts; the graduated candor goal's SPEC boundaries are stable reference
points, not dependencies.

**Rationale:** Every substrate surface the primary cluster composes is live
today, so no rung needs to wait; the carried cluster's route decision is
already locked at campaign level and this posture is its wedge-side
enforcement. Rejected: block-on-prerequisites (nothing in the first rung
needs an unfinished goal) and own-adapter-seams (a second contract surface —
the exact duplication the routing seed warns against).

## 2026-08-05 — orchestration mode

**Question:** What orchestration mode runs this wedge's research and packet
work?

**Answer:** Opus 5 subagents, carrying the 2026-08-04 supersession forward:
Workflow-orchestrated Claude Opus 5 agents for the two research lanes and
any adversarial review passes; the Fable main thread does only
grill/align/synthesis. If the codex weekly window resets mid-wedge, revert
to codex-first per standing routing doctrine and record the reversion here.

**Rationale:** The candor wedge's codex-only decision was superseded
2026-08-04 when the codex weekly window exhausted mid-campaign; opening a
new wedge under a known-dead engine would just force the same supersession
again. The judgment-quality bar that justified xhigh (the never-compute
boundary) is carried by Opus 5 review panels instead. Rejected: codex-only
as written in the candor packet (window exhausted; the decision's own
engine is unavailable) and unreviewed single-pass research (the legal-theory
lane sets schema-invariant boundaries that deserve adversarial checking).

## 2026-08-05 — PR staging

**Question:** How do this wedge's stages land as PRs?

**Answer:** Two-stage, same as the candor wedge. PR 1 (docs-only): packet
open + capture + this decision record plus the parent packet amendments
(routing-seed flips, HANDOFF/README/ATLAS sync). PR 2 (after the align
session with Benjamin): research artifacts + align outcomes. BRIEF/shaping
waits for align; research artifacts stay uncommitted until PR 2.

**Rationale:** Grill outcomes land as their own docs-only PR before further
work (standing feedback), and the candor wedge proved the cadence end to
end — open PR #550, research+align PR #552, BRIEF PR #557, graduation
PR #560 — with clean review treadmills at each step. Rejected: three-stage
granular (an extra closeout treadmill with no review benefit) and single-PR
(mixes the decision record with unreviewed research output — the pattern
that generated the nine-thread closeout on PR #542).

## 2026-08-06 — align: V1 scope

**Question:** What ships in the first rung — scheme-first, full relator
runtime, or scheme plus simple relator?

**Answer:** Scheme + simple relator (Lane B §7.1's recommendation accepted).
Rung 1 ships the closed `HohfeldPosition` LiteralKit domain, both bimaps
(correlative and opposite) defined over `(kind, content)` with act/omission
polarity, and the *simple* legal relator — one correlative pair + roles +
source norm + grounding event. Complex-relator composition,
`SlotCorrespondence`, and `PowerExercise`/`ActFrame` transitions defer to
rung 2.

**Rationale:** The bimaps are provably total and involutive over a closed
eight-element domain — testable to exhaustion in rung 1 — but the opposite
bimap is unsound without act/omission polarity (Lane B §1.2's
content-negation trap), and polarity lives in the relator's content field;
UFO-L's "essential and inseparable parts" makes the correlative pair the
simple relator. Rejected: scheme-first only (ships a scheme that cannot
express its own soundness invariant) and full relator runtime (pulls the
unresolved void-vs-penalised branch into rung 1 and risks the one-packet
appetite).

## 2026-08-06 — align: package home

**Question:** Where does the Hohfeld position/relator vocabulary live —
`packages/law-practice/domain`, a new legal-core package, or inside
`@beep/ontology`?

**Answer:** `packages/law-practice/domain` beside the patent entities, with
a named promotion gate: extract a legal-core package only when a second
legal consumer needs the contract, through the normal promotion-record gate.
Entity ids follow the sibling precedent (`shared/domain/src/identity/`).

**Rationale:** Repo consistency wins over donor topology today: the same-day
candor precedent fixes legal vocabulary in `law-practice/domain` with "No
new packages" as a Non-Goal, a new package trips the four first-CI
governance gates, and generality-without-a-second-consumer is exactly the
pattern the candor `PatentFragmentLocator` decision rejected — the promotion
gate preserves UFO-L's core-vs-domain layering as a future move rather than
an up-front package. Rejected: a new legal-core package now (departs from
precedent for a layering benefit no second consumer yet needs) and folding
into `@beep/ontology` (the carried caution keeps correlativity outside plain
SKOS triples; bimaps are typed invariants, not mappings).

## 2026-08-06 — align: Party–Role/principal split

**Question:** How do Party, LegalRole, and the runtime principal relate —
split or collapsed, and does the agents runtime's principal surface change?

**Answer:** Split, composing the shared `Principal`. Persistent generic
Party identity stays separate from `LegalRole`, which is norm-prescribed,
scoped to a relator, carries its `sourceNorm`, and takes a
role-mixin-style multi-kind player constraint (natural or juristic person).
The agents runtime is NOT widened: the legal layer consumes the shared
`Principal` union exactly as epistemic's `ContradictionReviewer` does;
`RuntimePrincipalId` stays agents-private. Migrating the agents runtime onto
the shared `Principal` union is a named follow-on owned by that slice, not
this wedge.

**Rationale:** Lane B §7.3's fourth point makes the split near-mandatory:
role multiplicity is the mechanism by which principle collisions arise, so
a collapsed model cannot represent the collisions the carried contradiction
vocabulary exists to record; T4-F6 asks for the same split from the campaign
side. Rejected: collapse (structurally unrepresentable collisions) and
widening the agents runtime in-wedge (a real wart, but fixing another
slice's contract mid-wedge is the exact move compose-don't-widen forbids).

## 2026-08-06 — align: CorrectionDelta shape

**Question:** What shape does the caller-owned `CorrectionDelta` emission
contract take?

**Answer:** The full Lane B §7.4 shape: an append-only event carrying a
two-severity `validatorReport` (hard/advisory, never a boolean), a stage tag
from the interpretation → qualification → assessment triple, per-element
source pointers (which slot the correction touched, not one document pointer
per record), a `reviewerAction` vocabulary that includes `undetermined`, and
unresolved differences defaulting into contradiction candidates. Emission
stays caller-owned; the generic triage goal's SPEC is untouched.

**Rationale:** Each element is evidence-backed: FLINT ships exactly the
hard/advisory validator split; only assessment is machine-checkable, so the
delta must name the stage it touches; UFO-L's incompleteness argument makes
`undetermined` a legitimate reviewer outcome (its absence pushes toward
false closure); FLINT registers sources per element; eFLINT's own authors
decline to resolve conflicts in-language, independently supporting the
unresolved-to-candidate default. Rejected: minimal T4-F8 literal (boolean
validator forces advisory findings into silence-or-block) and
defer-to-BRIEF (the correction contract informs the appetite the BRIEF must
state).

## 2026-08-06 — align: void vs penalised

**Question:** How does the model represent an act performed without power
versus an act performed without permission?

**Answer:** Two independent recorded axes, never one field: a constitution
outcome (`constituted` / `not-constituted`) and a permission status
(`permitted` / `violative`). A void act (no power) stays on the record as an
attempted exercise with zero position effect; a violative-but-constituted
act (no permission) changes positions AND records the violation. Both are
recorded determinations bound to an attributed interpretation — in a
contested case the system never computes which applies (never-compute
boundary, Lane B §6). The axes land in the relator's event vocabulary now;
`PowerExercise` itself remains rung 2 per the V1-scope decision.

**Rationale:** The theory split is explicit (Goossens: without permission we
expect a penalty; without power the act was never constituted), and eFLINT's
uniform violation rule is the named donor trap — copying it collapses
exactly the distinction T1-F7 preserves. Rejected: the eFLINT uniform rule
(one axis, distinction lost) and a void-only model (erases the
attempted/ineffective record T1-F7 requires and mis-models permission
violations, which do take legal effect).

## 2026-08-06 — align: opposite-bimap content model

**Question:** What carries the content identity the opposite bimap and
contradiction alignment operate over?

**Answer:** A named law-practice value object (working name
`LegalActContent`): required act/omission polarity as a typed field, act
description as structured-but-plain text for now, equality/digest-capable so
relator content can be compared for contradiction candidate alignment. The
opposite bimap negates polarity and preserves the rest. A typed act-verb
vocabulary is deferred — if it ever materializes it composes
semantic-foundation's scheme loading, never a new registry.

**Rationale:** Kind-only derivation is unsound (Hohfeld's own
privilege(enter)/duty(enter) example demands content "of precisely opposite
tenor"), and the live triage code seals candidates with a digest-based match
basis — so content must be a comparable schema value, with polarity inside
it. Rejected: opaque string + polarity flag (no stable equality for the
match basis; polarity outside content re-opens the unsoundness) and a full
act ontology in V1 (pulls the function-verb-scheme question owned by
`goals/semantic-foundation` into this wedge — a scope departure needing its
own routing approval).

## 2026-08-06 — shape: BRIEF drafted and hardened

**Question:** Does the drafted `BRIEF.md` faithfully carry the six align
decisions, the research record, and Shape-Up form?

**Answer:** After one adversarial pass, yes. The draft was reviewed by a
three-lens Opus panel (decision fidelity / research grounding / Shape-Up
form; Workflow `wf_cc695f5f-ca6`) — all three lenses returned
PASS-WITH-FIXES with 39 findings (5 P1), every one folded. The P1s:
(1) the rung-1 service was named "comparability check" — the exact cell
Lane B §6.2's never-compute column forbids proxying; renamed to the
scope-overlap-and-opposition check answering two set-theoretic facts, and
"legal comparability of two positions" added to the never-compute No-Go;
(2) the opposite bimap was stated as polarity-negation only — it maps kind
through the opposite pairs AND negates polarity in one step, with a new
No-Go banning polarity-only derivations; (3) the stored relator lacked
`positionKind` and the advantage-side canonicalisation that makes
one-stored-relation unique — both added, canonicalisation recorded as a
modelling decision; (4) the sibling's heaviest rabbit hole (lawful
cross-slice shape, `standards/ARCHITECTURE.md:632-636`) had no counterpart
despite the candidate handoff crossing the same class of boundary — added,
naming the three lawful shapes and forbidding a new
`law-practice/*` → `epistemic/*` edge; (5) the circuit-breaker silently
deleted two of five proof assertions — the breaker now names what drops
and the surviving reduced proof set, and gained a second degradation
(opaque party reference id) so it cuts the rung's largest unknown. Notable
P2 folds: the two-axis outcome lands in the relator's rung-1 event
vocabulary (the align "now" reading made explicit); `result` moves off the
relator to the required rung-2 exercise-event field; `derivationKind` is a
set, never a three-way enum; preconditions must express negative operative
facts; commutation joins the exhaustion proof; forum/proof-standard/
viewpoint are explicitly rung-2 (`PriorityBasis`, plus sourcePrecedence
and specificity); the CQ acceptance set is UFO-L's table plus FLINT's
in-scope subset only; `RuntimeApprovalGate` is named unconsumable
(single-member placeholder); the M4/remo1 boundary gets its own No-Go;
closing the position domain at eight is recorded as a stance against the
FLINT/Kocourek reduction.

**Rationale:** The candor sibling's cadence (draft → three-lens adversarial
review → fold → Benjamin approval) produced a BRIEF that survived two
further review panels downstream; the same gate applied here caught two
soundness defects (P1s 1–2) that would have graduated into an unsound
SPEC. Benjamin's approval is the exit condition for the shape stage —
APPROVED by Benjamin 2026-08-06 (same session, over the folded draft).
Stage align → shape.
