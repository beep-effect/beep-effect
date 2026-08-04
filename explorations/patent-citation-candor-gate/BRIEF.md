# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. Shaped 2026-08-04 inside the five align
boundaries in DECISIONS.md (four shape decisions plus the deferrals entry);
grounded in RESEARCH.md and the two research lanes; hardened by a three-lens
adversarial review (decision fidelity, research grounding, Shape-Up form).
-->

## Problem

The duty of candor (37 CFR 1.56) is an ambient, manual exposure. AI-assisted
prosecution multiplies patent-reference discoveries — extraction-engine
mentions, model-suggested prior art, examiner citations, IDS face lists — but
the system keeps no record of which discoveries an attorney has actually seen
and dispositioned, against which exact observation of which source version.
The live runtime gate (`RuntimeApprovalGate`) can hold a filing candidate
pending, yet it has no candor or observation-version field; the only live
occurrence record (`PriorArtReference`) covers examiner citations alone; and
nothing stops a filing package from advancing while an AI-discovered
reference sits undispositioned. The failure mode that matters is **false
closure**: a workflow that looks complete while silently omitting a
duplicate, stale, quarantined, or newly discovered reference — the fact
pattern a later inequitable-conduct defense would be litigated over, where
Therasense requires but-for materiality and separately proved specific
intent to deceive (Lane B §2); the system records the events, it never
asserts the conclusion. Wave-2 research verified the reification need
(T2-F2 survived 3/3) and four independent /adhd frames converged on this
gate as the first risk-retiring wedge.

## Appetite

**One goal packet, two phases, roughly two focused weeks total.** Rung 1 is
the **domain proof** — schemas, the `CandorPolicy` contract, and the
predicate's semantics proven by the failing-then-green test over
in-memory/test-only storage (the same first-proof posture
`goals/agentic-professional-runtime` used). It is deliberately not
shippable protection on its own: risk retirement lands with rung 2, which
delivers durability (the migration lane) and the live promotion-path
invocation. Busting the budget means rung 1 not reaching a green
`CandorPolicy` test inside its week.

If rung 1 busts its budget, drop `PatentFragmentLocator` from rung 1
entirely (events ground on the anchor receipt plus document identity; the
locator returns as a rung-2/child value object) — never cut the
observation-version binding or the fail-closed predicate.

## Solution Sketch

Design order is schema → `Context.Service` contract → implementation
(standing law). All product language lives in the law-practice slice;
epistemic and agents bricks are composed, never widened.

**Rung 1 — domain schemas (`packages/law-practice/domain`):**

- `PatentCitationEvent` (entity) — a source-versioned, evidence-grounded
  occurrence relating an existing `PatentReference` to a citing application
  identified by a **law-owned application-identity union**: it must accept
  the USPTO eight-digit normalized form (the live driver boundary's
  `UsptoApplicationNumber` shape, mirrored in law-practice — domain never
  imports drivers) and the WIPO ST.13 form (live `ApplicationNumber`
  value), with explicit conversion between them; never `OfficeAction`'s
  free-text number or a `PatentAsset` fixture key, and never ST.13-only.
  The union's exact shape is goal-packet design latitude. Fat-marker
  fields: citation actor
  (`applicant | examiner | both | unknown` as a LiteralKit domain), a tagged
  discovery-provenance union (engine mention, model suggestion, examiner
  document, manual entry), optional office-action linkage, submission and
  observation times, method/model metadata, source-version identity
  (compose live `SourceTextIdentity`; bind the USPTO observation identity —
  parser/vocabulary versions, artifact checksums, retrieval-time/freshness/
  cursor-upstream identity per the `uspto-prosecution-read` SPEC objectives —
  as a gated criterion), grounding by a persisted
  `TextAnchorVerificationReceipt` (`{ anchor, source }` — the live receipt
  form of `VerifiedTextAnchor`, from foundation/provenance; re-verification
  required before any "current" claim — epistemic's `EvidenceSpan` is NOT
  embedded: that would be a new law-practice/domain → epistemic/domain
  edge, and slice-to-slice imports are forbidden doctrine; an extraction-
  evidence span joins the event only if that shape is promoted to a
  shared/foundation home through the normal promotion gate), and two
  separately-triggered states that never rewrite evidence:
  **explicit staleness** derived from source-version mismatch, and
  **explicit quarantine** carried from raw-preserving unknown or
  undecodable source codes (the `uspto-prosecution-read` fail-explicit
  contract — a gated input; rung 1 makes the state representable and
  closure-relevant). The event records examiner occurrences alongside
  `PriorArtReference`; superseding that entity's `officeActionFixtureKey`
  occurrence semantics is a later rung.
- `CandorDisposition` (entity) — the attorney judgment record ONLY: dated,
  scoped, referencing the exact `PatentCitationEvent` and its exact
  observation version, with a minimal LiteralKit judgment vocabulary
  (extensible later; no judgment is ever computed). Keeps two distinct
  judgment slots (Rule 56 vs litigation-frame) representable without
  deriving either.
- `PatentFragmentLocator` (value) — home already decided (law-practice value
  object beside `Claim`, `PatentDocumentTriplet`, `DurableLocator`,
  composing — never replacing — verified anchors). **Rung-1 optional /
  later-rung child**: rung 1 ships at most the optional slot on the event,
  and rung 1's proof does not depend on it (the deepened play files it as a
  child).

**Rung 1 — use-case contract (`packages/law-practice/use-cases`):**

- `CandorPolicy` (`Context.Service`) — owns the derived gate predicate,
  quantified over **every AI-discovered citation event** for the filing's
  references (examiner-observed events are recorded but do not gate in this
  wedge; widening the quantified set is a later align question). An event is
  *covered* only by a disposition bound to its exact observation version,
  and only while that observation remains current for its source. Staleness
  therefore re-blocks: when a newer observation of a source arrives, a
  disposition bound to the superseded version never covers the new event,
  and a superseded event stops blocking only once the newer event is itself
  dispositioned. Quarantined events and possible duplicates are never
  covered (fail closed). No stored closure state exists anywhere; the
  predicate is recomputed from events + dispositions. Reads
  `RuntimeApprovalGate` state only through a lawful cross-slice shape — see
  the gate rabbit hole.

**Rung 2 (`law-practice/domain` + `tables` + `server`, plus a db-admin
migration):**

- Durable storage for `PatentCitationEvent` and `CandorDisposition` plus the
  append-only IDS fact records, following the `ExecutionLedger` precedent
  end to end — ports, repo/layer, and the law-practice slice's **first**
  db-admin migration with its PGlite migration test, both registered in
  `AcceptedProofManifest`. That migration lane, not the schema, is rung 2's
  real cost.
- The live invocation boundary: the filing-promotion path actually consults
  `CandorPolicy` (through the lawful cross-slice shape chosen at
  decomposition), so a blocked predicate blocks a real filing candidate —
  this is where the primary risk is retired.
- Fact families (presence only, never sufficiency or truth): submission acts
  with dates and 1.97-window facts (window arithmetic derives a *candidate*
  window only — it must surface the controlling dates and Lane B's edge
  cases: certificate of mailing / Priority Mail Express, weekend-or-DC-
  holiday shift, withdrawn closing action, same-day-as-closing filing — and
  is never labeled timing compliance); 1.17(p)/1.17(v) fee-payment facts;
  1.97(e)-statement presence and type plus the 1.98(a)(4) written
  assertion; 1.98 content-presence facts (list, copies, concise
  explanation, translation presence); office-treatment states recorded
  exactly as observed; and supplemental submissions as independent
  append-only records, each independently tested against its own filing
  date (MPEP 609), with a correction or resubmission of a non-complying IDS
  taking that later date as its operative IDS date (37 CFR 1.97(i); MPEP
  609.05(a)). `CandorDisposition` references these facts; it never embeds
  them.

**First implementation rung (the proof):** a failing `CandorPolicy.test.ts`
in `packages/law-practice/use-cases` with an examiner-observed and an
AI-discovered event for one `PatentReference`; assert promotion stays
blocked until an attorney disposition covers the AI event's exact
observation version, and flips blocked again when a newer observation
version of the same source arrives.

## Rabbit Holes

- **Gate composition is read-only and must take a lawful cross-slice
  shape.** `RuntimeApprovalDecision` has exactly one member (`pending`) and
  `RuntimeCandidateLifecycle` one (`candidate`), so the gate carries no
  blocked-vs-released signal; law-practice owns blocked/released entirely.
  A gate that can express release is a gated criterion on
  `goals/agentic-professional-runtime` landing further decision members —
  this wedge must not widen the agents vocabulary. Doctrine forbids a
  direct `law-practice/use-cases` → `agents/use-cases` dependency
  (slice-to-slice imports are forbidden; `standards/ARCHITECTURE.md`), so
  decomposition must pick from the lawful shapes: emitted events, app-local
  runtime coordination, or a promoted shared contract. Note the existing
  `law-practice/use-cases` → `@beep/epistemic-domain`/`-use-cases`
  dependencies are prior drift from that doctrine — this wedge must not
  compound it with a new edge.
- **Quarantine has no live producer at rung 1.** Real quarantined events
  arrive only when `uspto-prosecution-read` lands its raw-preserving
  unknown-code failures; rung 1 proves the predicate's quarantine branch
  against a hand-constructed fixture, not a derived state.
- **Reference reconciliation.** Merging OA/IDS/engine/model occurrences
  around one normalized reference is its own machine (a deepen-play child).
  Rung 1 scopes identity to the individual event; the predicate treats
  possible duplicates as undisposed rather than resolving them. Do not
  build the reconciliation inbox here.
- **"Current" evidence.** A persisted `TextAnchorVerificationReceipt` is not
  live proof — re-verification via `verifyTextAnchor` against canonical
  source text is required for current use. The predicate's notion of
  "current" is defined against source-version identity, never against
  receipt existence.
- **`CitationMention` handoff.** Spec-only today and its semantic union has
  no patent-reference member yet. No adapter now; the handoff is a gated
  criterion on what that goal actually lands.
- **Disposition vocabulary.** Keep the LiteralKit judgment set minimal at
  rung 1; the full judgment vocabulary (including the dual Rule 56 /
  1.98(c) cumulativeness judgments) is rung-2 shaping detail per the align
  deferrals. 1.97(e) statement facts are rung-2 fact records, not
  disposition vocabulary.
- **CFR-vs-MPEP source-version precedence.** The captured CFR text postdates
  the visible MPEP revision (e.g. the 1.98(a)(4) size-fee assertion).
  Constraint: cite which source version a fact state was modeled from; do
  not build version-resolution machinery.

## No-Gos

- No computed legal judgment, ever: Rule 56 materiality, Therasense but-for
  materiality or its egregious-misconduct exception, cumulativeness, intent,
  whether a 1.98(d) earlier-application copy exception or 1.98(c)
  cumulative-copy exception applies, whether a cancelled or withdrawn claim
  excuses an item, or duty satisfaction inferred from the absence of
  recorded events. The ground for any omission stays an attorney assertion.
- No inference of examiner reliance, approval, or materiality from an IDS
  marking: `considered` / not-considered / partially-considered states,
  initials, stamps, dates, and stated reasons are recorded exactly as
  observed; filing is not an admission of materiality and consideration is
  not reliance (Lane B §4; 37 CFR 1.97(g)-(h)).
- No stored "duty satisfied" state in any form.
- No grouped/manifest dispositions in this wedge (single-event binding only;
  returns via its own align question with practice evidence).
- No continuing-application matrix (MPEP 609.02) and no 1.97(e)
  certification predicates in this wedge; each returns only through its own
  align question when practice demands it.
- No migration, rewrite, or deprecation of `PriorArtReference` in this
  wedge; no generalizing its `officeActionFixtureKey` into face-list
  presence, applicant-submission, or model-relevance claims; and no reuse
  of donor-shaped `CitationBase` — actor, face-list presence, office-action
  reliance, and model similarity stay separate fields (T2-F2).
- No reference-reconciliation engine, no as-of citation timeline projection,
  no practice-kg-mcp surface changes (deepen-play children, later).
- No forking or pre-implementing the three active goal SPECs
  (`citation-extraction-engine`, `citation-verified-span-substrate`,
  `uspto-prosecution-read`); anything touching them is a gated criterion.
- No changes to the `RuntimeApprovalGate` contract or the agents slice's
  decision/lifecycle vocabularies; the candor predicate composes the gate
  read-only from law-practice.
- No new packages: everything lands in existing law-practice packages.
