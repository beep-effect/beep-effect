# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. Shaped 2026-08-06 inside the six align
boundaries in DECISIONS.md; grounded in RESEARCH.md and the two research
lanes; hardened by a three-lens adversarial Opus review (decision fidelity,
research grounding, Shape-Up form — 39 findings folded, see the shape entry
in DECISIONS.md).
-->

## Problem

The contradiction-triage engine went live three days before this wedge
opened (`ContradictionCandidate`/`Receipt`/`Disposition` and a
five-operation repository, merged 2026-08-02 — invalidating the routing
seed's SPEC-only grounding), and it runs with **no caller able to hand it
legally comparable inputs**: T1-F3 requires position, parties, act,
conditions, jurisdiction, and time to align before two legal claims are
treated as comparable, T3-F9 separately requires forum, jurisdiction, proof
standard, time, parties, and institutional viewpoint — and no schema in the
repo can express either alignment. That is because the legal consumer
domain has no structural core at all: zero `Hohfeld` or
`LegalPositionRelator` symbols anywhere in `packages/**/src` (re-confirmed
2026-08-05), no `Party` entity, no norm-prescribed role, and no vocabulary
for authority-gated transitions — while the three foundations such a core
would compose (taxonomy registry, bitemporal edges, human approval) are all
live. The wedge records positions, exercises, and scope alignments; legal
judgment stays human.

Built naively, four traps are structural, not incidental: correlative
pairs stored as two independent facts that drift (T1-F1); a collapsed
Party/Role that cannot represent the same individual holding conflicting
positions through different roles — the exact mechanism of principle
collisions (Lane B §7.3); an eFLINT-style uniform violation rule that
erases the difference between an act done without permission (penalised,
effective) and an act done without power (never constituted — T1-F7); and
an opposite derivation over position-kind alone, which Hohfeld's own
privilege(enter)/duty(enter) example shows manufactures false
contradictions (Lane B §1.2). The sketch and no-gos below exist to make
each trap unrepresentable.

## Appetite

**One goal packet, two rungs, roughly two focused weeks total.** Rung 1 is
the **domain proof** — the closed position domain, both bimaps, the simple
relator, and their laws proven by a failing-then-green test over
in-memory/test-only layers (the same first-proof posture the candor sibling
used). It is deliberately not shippable protection on its own: the live
value lands with rung 2 — transition events, the correction contract, the
`PriorityBasis` input structure, the candidate handoff into the live triage
repository, competency-fixture acceptance tests, and durability. Rung 2's
real cost is the durability lane: append-only storage on the
`ExecutionLedger` precedent plus the migration + `AcceptedProofManifest`
registration, and its price forks on sequencing — if this packet's rung 2
executes before the candor goal's, it establishes the law-practice
migration precedent and pays that lane's first-mover cost (settled at
decompose). Busting the budget means rung 1 not reaching a green
algebra-and-relator test inside its week.

If rung 1 busts its budget, two named degradations apply, in order:
(1) drop `LegalScopeContext` and the scope-overlap check (both return in
rung 2 with the candidate handoff) — this deletes the two scope-dependent
proof assertions below, leaving the reduced proof set the bust definition
already names: bimap exhaustion, relator validation, one-stored-relation;
(2) degrade `Party` linkage to an opaque party reference id, moving typed
linkage into rung 2 — the linkage shape is the rung's largest unknown.
Never cut the `(kind, content)` bimap soundness requirement or the
one-stored-relation/derived-views invariant. Placing `LegalScopeContext` in
rung 1 at all is a shape-stage call this BRIEF makes in a silence the
V1-scope decision left open; the breaker exists so that call cannot sink
the week.

## Solution Sketch

Design order is schema → `Context.Service` contract → implementation
(standing law). All legal vocabulary lands in `packages/law-practice/domain`
beside the patent entities — entity ids in `shared/domain/src/identity/`
per the sibling precedent — with the promotion gate as the only path to a
future legal-core package (per the align decision, extraction waits for a
second legal consumer through the normal promotion-record gate); epistemic
and agents bricks are composed, never widened. Donor split per the research
verdicts: position domain and relator shape from UFO-L;
frame/slot/precondition/source-reference machinery and the validator
severity split from FLINT (papers cited never vendored; `flint-ontology`
Apache-2.0 portions port-with-attribution, anything from `shacl/*.ttl`
clean-room only with the derivation recorded).

**Rung 1 — domain schemas (`packages/law-practice/domain`):**

- `HohfeldPosition` (LiteralKit domain) — the closed eight-position
  vocabulary in its two orbits: `{claim, duty, privilege, noRight}` and
  `{power, liability, immunity, disability}`. Closing at eight is a
  recorded stance: it takes Hohfeld's side against the live FLINT/Kocourek
  reduction that treats liberty–no-right and immunity–disability as
  absences (Lane B §1.4).
- `LegalActContent` (value) — the content identity the bimaps and
  candidate alignment operate over: **required** act/omission polarity as
  a typed field, act description as structured-but-plain text for now,
  equality/digest-capable (the live triage engine seals candidates with a
  digest-based match basis). No typed act-verb vocabulary in this wedge.
- **Correlative and opposite bimaps** — pure, total derivations over
  `(HohfeldPosition, LegalActContent)`. Correlative maps kind through the
  correlative pairs (claim↔duty, privilege↔noRight, power↔liability,
  immunity↔disability) with content unchanged — the cross-party view of
  one relation. Opposite maps kind through the opposite pairs
  (claim↔noRight, privilege↔duty, power↔disability, immunity↔liability)
  **and** negates content polarity in the same step — the same-party
  negation. They are two commuting involutions generating the Klein
  four-group; their composite is not exposed as a view in this wedge.
  Polarity lives *inside* content; a bimap that moves kind without content
  — or content without kind — is the named unsoundness and never ships.
- `Party` and `LegalRole` — split per align. `Party` is persistent generic
  identity that *references* existing identities (shared `Principal` for
  actors, law-practice records for clients/contacts) rather than minting a
  parallel identity system; `LegalRole` is norm-prescribed, scoped to a
  relator, carries its `sourceNorm` reference, and takes a
  role-mixin-style multi-kind player constraint (a natural or juristic
  person can hold the same role). Exact linkage shape is goal-packet
  latitude (and the breaker's second degradation).
- `LegalPositionRelator` (entity, **simple** form) — one correlative pair
  stored once with both views derived. The stored `positionKind` is
  canonicalised to the **advantage side** `{claim, privilege, power,
  immunity}`; burden-side kinds exist in the domain solely as bimap
  outputs — the canonicalisation is what makes the stored form unique and
  is recorded as a modelling decision (Lane B §1.3 rider). Schema-required
  fields follow the corrected T1-F9 mapping: `positionKind`, bearer,
  counterparty, act-or-omission content, source norm (an **opaque
  reference** — see the rabbit hole), grounding events, and the asserting
  interpreter (a shared `Principal` reference — every determination is
  bound to an attributed interpretation) fail validation when absent.
  Grounding events are modelled as a lineage reference, never a scalar —
  a derived relator links both the exercise that produced it and the
  founding event of the relator whose power was exercised (Lane B §5.2).
  `result` does **not** live on the relator (requiring it on a standing
  position forces placeholder values — the false-closure trap); it is a
  required field of the rung-2 exercise event. The relator's
  grounding-event vocabulary carries the two-axis outcome (constitution ×
  permission) from rung 1, per the align decision's "the axes land in the
  relator's event vocabulary now"; `PowerExercise` as an entity is rung 2.
- `LegalScopeContext` (value) — the five alignment axes from the UFO-L
  case-study method: material, temporal, jurisdictional/territorial,
  quantitative, subjective. These five only — forum, proof standard, and
  institutional viewpoint (T3-F9's remainder) arrive with `PriorityBasis`
  in rung 2.

**Rung 1 — use-case contract (`packages/law-practice/use-cases`):**

- A `Context.Service` (fat-marker name: `LegalPositionRelatorPolicy`)
  owning: admission validation of relators; the derived correlative and
  opposite views (never stored); and the **scope-overlap-and-opposition
  check** — given two relators it answers only two set-theoretic facts:
  whether their recorded scopes overlap on every axis, and whether their
  positions are prima facie opposed under the `(kind, content)` opposite
  bimap — emitting typed candidate *inputs*. Legal comparability itself is
  never computed (Lane B §6.2 row 7 splits exactly this: scope overlap is
  derivable; comparability is not), and differently-worded content is
  simply not-equal — semantic act equivalence is never computed.

**First implementation rung (the proof):** a failing test in
`packages/law-practice/use-cases` asserting: both bimap laws by exhaustion
(totality, involutivity, **commutation**, the two orbits); relator
validation rejects each missing required field; one stored advantage-side
relation derives both views without a second persisted fact; and — rung-1
only while `LegalScopeContext` survives the breaker, otherwise rung 2 —
Hohfeld's privilege(enter)/duty(enter) coexistence case yields **no**
candidate (the opposite bimap requires negated content polarity, which
these two share), while a genuine opposite pair under overlapping
`LegalScopeContext` **does** yield a candidate input.

**Rung 2 (`law-practice` domain + use-cases + durability):**

- `PowerExercise`/`ActFrame` transition events: the frame/precondition
  shape from FLINT (its `creates`/`terminates` pair), with a
  `derivationKind` **set** over create/alter/extinguish (UFO-L's
  trichotomy; Hohfeld admits simultaneous create-and-extinguish, so it is
  a set, never a three-way enum), preconditions able to express **negative
  operative facts** ("A had not revoked the offer" — Lane B §1.7), a
  **required** `result`, attempted and ineffective acts on record, and the
  two-axis outcome locked at align: constitution
  (`constituted | not-constituted`) independent of permission
  (`permitted | violative`) — both recorded determinations bound to an
  attributed interpreter (shared `Principal`), never computed in contested
  cases. The agents runtime's `RuntimeApprovalGate` is a single-member
  placeholder this wedge cannot widen and does not consume.
- `CorrectionDelta` (caller-owned, append-only event) in the full align
  shape: two-severity validator report (hard/advisory — the contract
  vocabulary is align-locked at exactly these two members and never adopts
  the three-member `ShaclSeverity` model; whether the implementation
  internally narrows the live `ShaclSeverity` machinery in
  `@beep/semantic-web` to *produce* the two-member field is goal-packet
  latitude; a recorded field, see the no-go on executable shapes), a stage
  tag from the interpretation → qualification →
  assessment triple, per-element source pointers, a reviewer-action
  vocabulary including `undetermined`, and unresolved differences
  defaulting into contradiction candidates through the **live** triage
  repository contract — the generic SPEC is never amended.
- `PriorityBasis` (typed value) accompanying law-side candidate records as
  *input* structure (party, forum, jurisdiction, proof standard, position
  tuple, time, authority, viewpoint, source precedence, specificity — the
  last two are why priority is uncomputable: lex superior and lex
  specialis); the four legal verdict families remain law-practice
  vocabulary on law-side records — the generic disposition vocabulary is
  untouched.
- Durability on the `ExecutionLedger` append-only precedent; the migration
  lane sequences against the candor goal's rung 2 (whichever executes
  first establishes the law-practice migration precedent — settled at
  decompose; this is rung 2's cost driver, priced in the appetite).
- Acceptance fixtures: UFO-L's power-subjection competency-question table
  plus the **in-scope** subset of FLINT's 22 competency queries
  (out-of-scope CQs — immunity–disability, liberty–no-right, omissions,
  duty violations — are excluded by FLINT's own README, and the set is
  flagged outdated upstream; the ported CQs are Apache-2.0 with TNO
  attribution). `SlotCorrespondence` itself is a named follow-on, not a
  rung.

## Rabbit Holes

- **The candidate handoff must take a lawful cross-slice shape.**
  Slice-to-slice direct imports across different slices' packages are
  forbidden doctrine (`standards/ARCHITECTURE.md:632-636`); cross-slice
  integration goes through emitted events or a contract promoted into the
  future `shared/use-cases`. The triage contract lives in
  `packages/epistemic/use-cases`, and `law-practice/use-cases` already
  carries `@beep/epistemic-domain`/`-use-cases` edges — prior drift the
  candor sibling named and refused to compound. Decomposition must pick
  the lawful shape (emitted events, app-level wiring, or promoted
  contract) for both the rung-1 candidate inputs and the rung-2 handoff,
  and this wedge must not add a new `law-practice/*` → `epistemic/*`
  package edge.
- **Content equality is exact, not semantic.** The digest treats
  differently-worded same acts as different content — that under-generates
  candidates by design. Do not build act-equivalence inference, embedding
  similarity, or normalization passes to "fix" it; semantic equivalence is
  attributed human interpretation, recorded not computed.
- **Party linkage is by reference.** No live `Party` entity exists; the
  nearest party-likes (`LegalClient`, `LegalContact`) link by fixture-key
  text today, and PACER's `PartyResult`/`PartySearchDto`
  (`packages/drivers/pacer/src/Pcl.models.ts:71,199`) carry untyped
  `partyType`/`partyRole`/`jurisdictionType` at the decode boundary —
  driver DTOs, not identities to reference; rung 1 does not map them. The
  wedge references existing identities; it does not build an
  identity-resolution or entity-merge machine.
- **`sourceNorm` is an opaque reference only.** Versioned norm/rule
  identity — the LegalRuleML subset, Expression-vs-Work temporal identity
  — is owned by the queued `legal-rule-time-identity` wedge; modelling it
  here pre-empts that wedge's align. The relator requires that the
  reference exist, nothing about its internal shape.
- **Paucital relations only.** Rung 1 models two-party relations.
  Hohfeld's multital/in-rem aggregation (one privilege against the world)
  is contested scholarship and a named follow-on — do not generalize the
  relator to party-sets now.
- **FLINT narrows, UFO-L widens — keep them in their lanes.** FLINT's own
  competency scope excludes liberty–no-right, immunity–disability, and
  omissions; the position domain comes from UFO-L and must not shrink to
  what FLINT's frames cover. Conversely eFLINT's execution semantics
  (uniform violation-with-effects) are excluded by the P100 correction.
- **Triage composition touches only the repository contract.** Candidates
  enter through the live five-operation contract; nothing law-side reaches
  into candidate ownership, duplicate suppression, or disposition flow.
  The temptation to make the generic engine "understand" legal verdict
  families is the named widening trap (`SPEC.md:27`: no IP-law
  vocabulary).
- **MPL-2.0 clean-room is file-scoped, not novelty-scoped.** The
  pre-existing `ShaclSeverity` narrows what rung 2 *wants* from `shacl/`,
  not the obligation: anything taken from either `shacl/*.ttl` file is
  clean-room re-expressed regardless of novelty, and the derivation is
  recorded in the goal packet.
- **The taxonomy's inverse machinery is the wrong temptation.** The fold's
  narrower→broader normalization and `TaxonomyLoader`'s mapping kinds are
  the nearest live inverse-pair precedents, and reaching for them buys
  SKOS semantics the bimaps must not inherit — the bimaps are typed
  Effect Schema derivations in the consuming domain package, full stop.

## No-Gos

- No computed legal judgment, ever: validity of an act, authority of a
  party, priority outcomes between conflicting positions, contradiction
  verdicts, **legal comparability of two positions**, or semantic act
  equivalence. Assessment exists only relative to a named, attributed
  interpretation and is never asserted as legal truth (the 11-row
  records/derives/never-computes table in Lane B §6 is the SPEC's
  inheritance).
- No amendment of `goals/epistemic-contradiction-triage`'s SPEC, no legal
  verdict families or IP-law vocabulary in the generic goal, and no second
  triage engine — candidates compose the live repository contract as-is;
  minimal generic extension slots may be proposed later only with fixture
  evidence (dependency-posture decision, T4-R2 precedent).
- No widening of `EdgeVersion` (binary substrate stays binary; the relator
  is a multi-element law-practice aggregate — still two-party — over it,
  not a schema change to it) and no changes to the agents runtime's
  principal or approval contracts — migrating `RuntimePrincipalId` onto
  the shared `Principal` union is that slice's named follow-on, not this
  wedge.
- No stored correlative/opposite views and no burden-side storage: one
  advantage-side relation stored, all other views derived.
- No kind-only opposite bimap, and no polarity-only opposite bimap either
  — the derivation moves kind and content together, always.
- No executable validation shapes ship from this wedge: validator severity
  is a recorded field on `CorrectionDelta`; registry-carried executable
  shapes stay routed to semantic-foundation's M4 gate (campaign remo1 /
  HANDOFF constraint 2).
- No new packages: everything lands in existing law-practice packages; per
  the align decision, extraction of a legal-core package waits for a
  second legal consumer through the normal promotion-record gate.
- No correlativity encoded in SKOS triples or `TaxonomySeed`.
- No typed act-verb ontology and no function-verb seed scheme — if that
  ever materializes it composes `goals/semantic-foundation`'s scheme
  loading through that goal's own gates.
- No `PowerExercise` entity, no `ActFrame`, no `SlotCorrespondence`, and
  no complex-relator composition in rung 1 (V1 scope decision).
- No vendoring of donor material: UFO-L and FLINT/eFLINT papers are cited,
  never copied (only the CEUR demo paper is CC BY 4.0 — no figures or
  extended passages from the others); `flint-ontology` follows the
  per-portion license discipline recorded in `research/SOURCES.md`.
- No eFLINT uniform violation rule: the two-axis void-vs-penalised
  distinction is load-bearing and never collapses.
