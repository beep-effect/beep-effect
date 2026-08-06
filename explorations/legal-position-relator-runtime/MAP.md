# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW. Decomposed 2026-08-06 from the APPROVED BRIEF (one
goal packet, two strict rungs) inside the ten DECISIONS.md boundaries — four
wedge-scoped, six align — none of which this file reopens.

Every capability anchor below was re-verified against `main` on 2026-08-06 by a
four-lane Opus 5 panel (Workflow `wf_2900c494-4f9`: law-practice precedent,
cross-slice doctrine, live triage surface, domain bricks), AFTER the candor
sibling's implementation merged as PR #575. Corrections to the 2026-08-05
research record are marked **DRIFT** inline.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `legal-position-relator-runtime` | Give the legal consumer domain its structural core: a closed eight-member `HohfeldPosition` domain with correlative and opposite derivations over `(kind, content)`, a simple `LegalPositionRelator` storing one advantage-side relation and deriving every other view, and authority-gated transition events that keep attempted and ineffective acts on record — recording positions, exercises, and scope alignments while legal judgment stays human. | None blocking. Gated acceptance criteria bind to the SPECs of `goals/epistemic-contradiction-triage` (candidate handoff into the live five-operation repository contract — compose-only, never amended, and **landed-but-unverified**: P0/P1 complete, P2 Verify in-progress, acceptance criteria still unchecked at `goals/epistemic-contradiction-triage/SPEC.md:114-120`), `goals/semantic-foundation` (a typed act-verb scheme, if one ever materializes, and the M4 executable-shapes gate), and `goals/agentic-professional-runtime` (a decision vocabulary richer than the single-member `pending` placeholder). The queued `legal-rule-time-identity` wedge owns everything behind `sourceNorm`'s opaque reference. `goals/patent-citation-candor-gate` is a stable precedent reference, never a dependency and never reopened. | Reuse `@beep/schema` (`LiteralKit`), `@beep/shared-domain` (`Principal`, `BaseEntity` actor provenance, `identity/LawPractice` id factory), `@beep/law-practice-domain` (`LegalClient`/`LegalContact`/`Matter` as the party-likes referenced, never re-minted), the in-slice candor precedent trio (append-only ports → drizzle repo/layer → registered migration), the `EdgeVersion.supersedesId` lineage posture and `SymmetricEdgeRelation`/`orderEndpoints` canonicalisation as *patterns*, and the live `ContradictionTriageRepository` contract as-is; **NET-NEW:** `HohfeldPosition`, `LegalActContent`, the correlative and opposite derivations, `Party`, `LegalRole`, `LegalPositionRelator`, `LegalScopeContext`, the `LegalPositionRelatorPolicy` service, and rung-2's `PowerExercise`/`ActFrame`, `CorrectionDelta`, `PriorityBasis`. Full table below. |

One packet only — the BRIEF's appetite is explicit (one goal packet, two rungs,
roughly two focused weeks). Everything the BRIEF names as deferred stays named,
triggered, and NOT graduated (see Follow-Ons).

## Sequencing

Two rungs inside the single packet, strictly ordered; the packet's `PLAN.md`
phases map onto them. Rung 2 never starts before rung 1's test is green, and
nothing is sequenced between them.

1. **Rung 1 — domain proof** (`law-practice/domain` + `law-practice/use-cases`,
   in-memory/test-only layers, the first-proof posture both siblings used).
   Design order is standing law: schemas first (`HohfeldPosition`,
   `LegalActContent`, the two derivations, `Party`, `LegalRole`,
   `LegalPositionRelator`, `LegalScopeContext`), then the
   `LegalPositionRelatorPolicy` `Context.Service` contract, then the
   failing-then-green proof. Deliberately not shippable protection on its own.
   Budget circuit-breaker from the BRIEF, in order: (1) drop
   `LegalScopeContext` and the scope-overlap-and-opposition check — both return
   in rung 2 with the candidate handoff; (2) degrade `Party` linkage to an
   opaque party reference id. Never the `(kind, content)` derivation soundness
   requirement, never the one-stored-relation/derived-views invariant.
2. **Rung 2 — transitions, correction contract, handoff, durability**
   (`law-practice/domain` + `use-cases` + `tables` + `server`, plus db-admin).
   `PowerExercise`/`ActFrame` with the two-axis outcome and negative operative
   facts, the full-shape `CorrectionDelta`, `PriorityBasis` as input structure,
   the candidate handoff into the live triage repository, the competency-question
   acceptance fixtures, and durable append-only storage with its migration.
   Risk retirement lands here.

### The migration-lane fork the BRIEF left to decompose — SETTLED

The BRIEF priced rung 2's cost driver conditionally: "if this packet's rung 2
executes before the candor goal's, it establishes the law-practice migration
precedent and pays that lane's first-mover cost (settled at decompose)."

**It does not.** The candor goal's rung 2 shipped to `main` as PR #575 on
2026-08-06, so the ordering is already satisfied and the first-mover cost is
already paid by another packet. All four links of the lane exist and are
clonable:

- Tables tier — `packages/law-practice/tables/src/entities/index.ts:12`, `:17`,
  `:37` export three candor tables, each with `.table.ts` + `.converters.ts`.
- Migration — `packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/`
  (`migration.sql` + `snapshot.json`), still the **only** drizzle migration
  naming `law_practice`, so the slice's schema is now in the baseline snapshot
  and a second goal generates a delta migration rather than a bootstrap.
- Proof-oracle registration — three `AcceptedProofManifest.ts` entries already
  exist for that lane (`:808`, `:814`, `:874` — entry-open lines; the migration
  *target module* at `:724` is a separate artifact class), so registering a second
  migration is a copy-the-stanza edit, not a discovery cost.
- An executable append-only proof to clone —
  `packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts`,
  including the structural gotcha that the UPDATE-denial and DELETE-denial
  assertions each need their own `layer(...)` block (`:208`, `:226`) because
  each denial aborts its transaction.

Consequence for the appetite: rung 2's stated cost driver re-prices downward.
That does not make rung 2 cheap — it still owns the transition events, the
correction contract, `PriorityBasis`, the handoff, and the CQ fixtures — but the
durability lane is now a second instance of an in-slice pattern rather than a
lane-opening. The BRIEF's bust definition is unchanged: rung 1 not reaching a
green algebra-and-relator test inside its week.

### The candidate-handoff shape the BRIEF left to decompose — NARROWED, NOT DECIDED

The BRIEF's heaviest rabbit hole requires decomposition to "pick the lawful
shape (emitted events, app-level wiring, or promoted contract) for both the
rung-1 candidate inputs and the rung-2 handoff." Decompose splits that into two
questions with different answers.

**Rung 1 crosses no boundary at all.** The
scope-overlap-and-opposition check answers two set-theoretic facts and emits
typed candidate *inputs* as ordinary return values of a law-practice service to
its law-practice caller. No epistemic type appears in its signature or its
requirement channel, so the rabbit hole has no rung-1 bite and rung 1's
capability check is unaffected by it. This is a real narrowing: the BRIEF's
wording implied both rungs needed the shape decided up front.

**Rung 2's handoff is the real crossing, and decompose narrows the option set
against evidence rather than restating the BRIEF's three names.** Four
candidate shapes exist; exactly one is settled, and none is picked here:

- **Emitted events — UNAVAILABLE.** Zero slice `*.events.ts`,
  `*.event-handlers.ts`, or `*.processes.ts` anywhere in `packages/**/src`
  (the sole `*.events.ts` hit is `packages/foundation/ui-system/dock/src/Dock.events.ts`,
  a foundation UI module, not a slice contract). The cross-slice event contract
  would additionally have to live in the non-existent `shared/use-cases`
  (`standards/architecture/10-cross-slice-coordination.md:24-30`), making this a
  strict superset of the next option's cost.
- **Promoted `shared/use-cases` contract — UNAVAILABLE without waiving its own
  bar.** `packages/shared/` holds only `domain/` and `tables/`, and
  `standards/architecture/02-shared-kernel.md:189` requires ≥2 packages
  *currently* importing the export by name.
- **Foundation-mediated port inversion — AVAILABLE but not automatically
  admissible.** Ratified 2026-07-25
  (`standards/architecture/10-cross-slice-coordination.md:36-51`;
  `standards/architecture/DECISIONS.md:1095-1148`) with two landed precedents —
  `TierGate` (`packages/foundation/capability/mcp-kit/src/TierGate.ts:359`,
  implemented by `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.layer.ts:51`,
  consumed by `packages/ontology/server/src/tools/OntologyToolHandlers.ts:10`)
  and `SourceTextResolver`
  (`packages/foundation/capability/file-processing/src/SourceText/index.ts:374`),
  the latter already consumed by law-practice at
  `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.ports.ts:14`.
  Two admission problems must be answered before it can be picked: the ratifying
  decision's rationale is a *synchronous fail-closed gate* — "an emitted event
  cannot express 'and do not proceed'" (`DECISIONS.md:1142-1148`) — whereas a
  candidate handoff is an asynchronous data submission, so the rationale does
  not transfer; and admission condition 1 requires the port carry **no product
  semantics**, which contradiction-triage candidate vocabulary arguably does.
  It also carries a mandatory README promotion-style record in both packages
  (`DECISIONS.md:1117-1120`).
- **Extending the slice's existing documented bounded exception — the option the
  BRIEF did not name, and the one decompose must surface honestly.**
  `packages/law-practice/use-cases/README.md:18-22` and
  `packages/law-practice/server/README.md:15-21` record importing
  `@beep/epistemic-*` as "the slice's documented cross-slice bounded exception",
  and `@beep/epistemic-domain` / `@beep/epistemic-use-cases` are already declared
  at `packages/law-practice/use-cases/package.json:52-53`. So consuming the
  triage repository would add **no new package edge**. But the exception's own
  ledger row is scoped to the *gate/projection* composition
  (`goals/law-practice-office-action-spike/SPEC.md:258`), and its removal
  condition reads: "Extract a `shared/use-cases` contract (or emitted event)
  when a third consumer of the epistemic boundary appears." A triage handoff is
  a new consumer — this wedge is closer to the event that *trips* the removal
  condition than to something the exception already covers.

**What decompose fixes now, regardless of the pick:**

- The pick lands at goal **P0**, with an `architecture-guardian` check and a
  read of the spike SPEC's Exception Ledger row to establish whether its scope
  covers a new consumer or whether extending it needs its own ledger entry.
- This wedge adds **no new `law-practice/*` → `epistemic/*` package edge**.
- Rung 1's schemas land in `packages/law-practice/domain`, whose `package.json`
  declares no epistemic dependency at all — the domain tier is clean and both
  the spike SPEC (`goals/law-practice-office-action-spike/SPEC.md:207`) and both
  package READMEs commit to keeping it clean. Rung 1 therefore does not touch
  the breach surface.
- The goal never claims a live handoff it cannot prove. The sibling's owner
  ruling is the governing precedent: durability now, cross-slice consultation
  deferred with standing evidence and the Exception Ledger entry left PENDING
  and unexercised — its decision-log entries opening "Owner ruling on decision 9
  (2026-08-05): durability now, gate shape deferred" and "Owner ruling on the
  live-gate criterion (2026-08-05): rescope to the predicate boundary"
  (`goals/patent-citation-candor-gate/SPEC.md:114-128`; quote-anchored because
  that SPEC's line numbers shift whenever it gains a decision).

**DRIFT the BRIEF's citation carries.** `standards/ARCHITECTURE.md:632-636` is
line-accurate — it still says cross-slice integration "goes through emitted
events or, if a real contract has been promoted, the future `shared/use-cases`
package" — but it is doctrinally stale: nothing in its neighbourhood
cross-references the third mechanism ratified 2026-07-25. Cite it only as the
two-mechanism baseline, always paired with
`standards/architecture/10-cross-slice-coordination.md:36-51` and
`standards/architecture/DECISIONS.md:1095-1148`. The desync between those two
standards files is itself a named follow-on, not this wedge's work.

**DRIFT on the breach's size.** The BRIEF describes existing
`law-practice/use-cases` → epistemic edges. The real surface is wider: 13 import
sites across 4 files, and `packages/law-practice/server/package.json:47-50`
declares four epistemic packages including `@beep/epistemic-tables` — cross-slice
table reads, separately banned at
`standards/architecture/10-cross-slice-coordination.md:57` and flagged as
temporary in `packages/law-practice/server/README.md:23-25`. Cleaning that up is
a named follow-on; compounding it is forbidden.

## First Vertical Slice

The failing `LegalPositionRelatorPolicy.test.ts` in
`packages/law-practice/use-cases/test/` — the BRIEF's proof list, written
failing first:

1. **Both derivations proven by exhaustion** over all eight positions —
   totality, involutivity, commutation, and exactly two four-element orbits,
   `{claim, duty, privilege, noRight}` and
   `{power, liability, immunity, disability}`
   ([`research/02-position-relator-legal-frame.md`](./research/02-position-relator-legal-frame.md) §1.3).
   Correlative maps kind through the correlative pairs with content unchanged;
   opposite maps kind through the opposite pairs **and** negates content
   polarity in the same step. A derivation that moves kind without content — or
   content without kind — is the named unsoundness and must fail the test.
2. **Relator admission validation rejects each required field's absence**, one
   at a time: `positionKind`, bearer, counterparty, act-or-omission content,
   source-norm reference, grounding-event lineage, and the asserting interpreter.
3. **One stored advantage-side relation derives both views** with no second
   persisted fact; the stored `positionKind` is canonicalised to
   `{claim, privilege, power, immunity}` and burden-side kinds appear only as
   derivation outputs.
4. **Hohfeld's privilege(enter)/duty(enter) coexistence yields no candidate
   input** — built as a stored `privilege(X→Y, enter+)` plus a stored
   `claim(Y→X, enter+)` whose derived correlative view is X's `duty(enter+)`,
   since `duty` is never a stored `positionKind`. The two share content
   polarity, so the opposite derivation does not relate them. A genuine opposite
   pair — stored `privilege(X→Y, enter+)` against stored `claim(Y→X, enter−)` —
   whose `LegalScopeContext` values overlap on all five axes does yield one.

   The advantage-side canonicalisation forces the check's shape: every
   advantage-side kind's opposite is burden-side, so comparing two *stored*
   kinds is vacuously false. Opposition must compose both derivations — the
   opposite view of one relator against the correlative view of the other.

Assertions 1–3 are the reduced proof set that survives the BRIEF's first
circuit-breaker degradation; assertion 4 is the pair that degradation deletes
(returning in rung 2 with the candidate handoff).

Harness, matching the landed in-slice precedent
`packages/law-practice/use-cases/test/CandorPolicy.test.ts` (22 `it.effect`
scenarios across 8 describes as of PR #589; the count grows, the shape does
not): `@effect/vitest` `layer(...)((it) => it.effect(...))`
(`:28`, first block at `:408-410`), every package source imported through
`@beep/*` aliases per repo test law, capability ports satisfied by hand-built
fixture `Layer`s, slice-isolated — no other slice booted, no app runtime `Layer`,
no dependency added to the package.

## Capability Check

| Component | Live capability or gap |
| --- | --- |
| Closed literal vocabularies (`HohfeldPosition`, polarity, role kinds, derivation kinds, severity, stage tags, reviewer actions) | **REUSE:** `LiteralKit` from `@beep/schema` (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:747`, barrel `src/index.ts:285`), standing law for every string-literal domain. In-slice usage precedent: `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:14`. |
| Deriving a closed subdomain + its guard (the advantage-side canonicalisation) | **REUSE (pattern):** `SymmetricEdgeRelation` derives a subset with `EdgeRelationBase.pickOptions([...])` and its guard with `S.is(...)` rather than a hand-rolled predicate (`packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:54`, `:74`, `:127-128`) — exactly the shape the advantage-side subdomain `{claim, privilege, power, immunity}` takes. Pattern only; never imported (slice-to-slice imports stay forbidden). |
| `HohfeldPosition` domain | **NET-NEW:** re-confirmed zero occurrences in `packages/**/src` on 2026-08-06 (`Hohfeld`, `noRight`, `correlativ`, `immunity`, `no-right` all zero; the only `disability` hits are institution names in two generated free-law-project data files). Closing at eight members is a recorded stance against the FLINT/Kocourek reduction (Lane B §1.4). |
| Correlative and opposite derivations | **NET-NEW, but only after an adversarial pass narrowed the claim.** No symbol *named* for the concept exists — `involut*`, `correlativ*`, `inversePair`, and `converseOf` are zero-hit across `packages/**/src` — and `owl:inverseOf` exists only as decoded vocabulary **data** with no runtime acting on it (`packages/foundation/modeling/ontology/src/Ontology.models.ts:531-538`). **DRIFT (two corrections to the research record, the second found by refuting the first):** (1) a `bimap` *does* exist at `packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:302`, a dual-arity functor over an in-memory `DirectedGraph`; (2) live combinators implementing involution and converse semantics exist under other names — see the row below. What is genuinely absent is a **schema-level derivation over a closed position domain**: nothing pairs two differently-named positions, and nothing moves a kind and its content together. |
| Why every live analogue is rejected | **REUSE-REJECTED (five named, each with the reason it is the wrong shape):** (1) `invertChangeOperation` (`packages/ontology/domain/src/aggregates/Session/Session.model.ts:861`) is a real involution — `ChangeOperation.match` swapping `addQuad`↔`removeQuad` — but over a two-member RDF mutation union, with no content to negate and no correlative axis; it is the closest *structural* precedent for writing an involution with `.match`, and worth copying as style, not as substance. (2) `expandPredicate` (`packages/foundation/modeling/identity/src/Curie.ts:290`, impl `:302-311`) parses SPARQL inverse-path `^` into `{ iri, inverse }` — direction on one predicate, not a pair of named positions — and the fold threads that flag through assembly (`Fold.assembly.ts:277-291`) and emits `@reverse` in projection (`Fold.projections.ts:175-178`, endpoint swap `:525-527`). (3) `orderEndpoints` (`packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:330-336`) canonicalises two *presentations* of one symmetric relation by sorting escaped endpoints — symmetry, not correlativity, which names two *differently-named* positions held by two parties. (4) The fold's `skos:narrower` → broader normalization swaps endpoints into one canonical direction before a cycle check (`packages/foundation/modeling/ontology/src/Fold.assembly.ts:732-737`, `:745`) — and reaching for it buys SKOS semantics the derivations must not inherit (BRIEF rabbit hole). (5) The graph `bimap` above operates on a different data structure entirely. |
| `LegalActContent` (equality/digest-capable content with required polarity) | **NET-NEW.** Digest-sealed comparable content has a live precedent to follow, not import: `ContradictionMatchBasis` and the candidate digest functions (`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:648`, `:1252`, `:1520`). Equality is exact, never semantic (BRIEF rabbit hole). |
| `Party` / `LegalRole` | **NET-NEW, referencing live identities.** No `Party` entity exists (re-confirmed 2026-08-06). The party-likes it references are thinner than the research implied — **DRIFT:** `LegalClient` has three domain fields (`packages/law-practice/domain/src/entities/LegalClient/LegalClient.model.ts:51-57`), `LegalContact` and `Matter` four (`.../LegalContact/LegalContact.model.ts:52-61`, `.../Matter/Matter.model.ts:52-61`), their literal domains are single-member (`LegalClientStatus` `["active_client"]`, `LegalContactRole` `["founder"]`, `MatterType` `["patent_application"]`), and **linkage between them is by `legalClientFixtureKey` text, not an EntityId foreign key**. Any relator design assuming existing entity-ref edges between law parties is wrong — those edges do not exist. PACER's `partyType`/`partyRole` are driver DTOs at a decode boundary, not identities to reference (`packages/drivers/pacer/src/Pcl.models.ts:71`, `:199`). |
| Actor identity behind `Party` and the asserting interpreter | **REUSE:** the shared `Principal` five-member tagged union (`packages/shared/domain/src/entity/Principal.ts:75`, `:104`, `:143`, `:180`, `:215`; union `:244`, `S.toTaggedUnion("kind")` `:254`), with `SystemComponent` as a `LiteralKit` inside it (`:14`). Actor provenance arrives free on every entity: `createdByPrincipal`/`updatedByPrincipal` on `BaseEntity.fields` (`packages/shared/domain/src/entity/BaseEntity.ts:82`, `:88`), persisted jsonb with `valueStrategy: "providedByContext"` (`:108-110`, `:128-130`). Consumed exactly as epistemic's `ContradictionReviewer` does (`packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:64-66`). The agents runtime is NOT widened — `RuntimePrincipalId` stays agents-private. |
| Entity identity | **NET-NEW (required registration), mechanical:** new ids in `packages/shared/domain/src/identity/LawPractice.ts`, which builds every id from `EntityId.factory("law_practice", $I)` (`:12`); four candor-era registrations set the stanza shape (`:217` `PriorArtReferenceId`, `:304` `PatentCitationEventId`, `:338` `CandorDispositionId`, `:371` `IdsSubmissionFactId`), each a JSDoc block + `export const X = make("snake_case", {...})` + `export type X = typeof X.Type`. Every law-practice entity takes its id from here. |
| Domain-tier file roles | **REUSE (precedent):** `<Name>.model.ts` + `<Name>.values.ts` + `index.ts` where a literal/value domain exists (`packages/law-practice/domain/src/entities/PatentCitationEvent/`, `.../CandorDisposition/`, `.../IdsSubmissionFact/`); `.values.ts` is conditional, not mandatory — `PriorArtReference/` has only `.model.ts` + `index.ts`. |
| `LegalScopeContext` (five alignment axes) | **NET-NEW.** The live alignment surface has no counterpart: `ContradictionReviewScope` carries `{ orgId, sourceScopeRef }` only (`packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:87-93`) — no party, forum, jurisdiction, proof standard, position tuple, authority, or viewpoint anywhere. Primary-source grounding is Griffo's five case-study axes (Lane B §5.1 `scope` row). |
| `LegalPositionRelator` (simple form) | **NET-NEW.** `EdgeVersion` is strictly binary with no widening seam — two endpoint slots, four endpoint kinds, untyped qualifiers, `fact: UnknownRecord` (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:106-164`) — so the relator is a law-practice aggregate *over* that substrate's posture, never a change to it (No-Go). Grounding-event lineage follows the `supersedesId` self-reference posture (`.../EdgeVersion.model.ts:141-143`, persisted `:205-207`) — pattern only, never imported. |
| `LegalPositionRelatorPolicy` service | **NET-NEW:** a `Context.Service` in `packages/law-practice/use-cases`. In-slice precedent for where the tag lives — **DRIFT:** the `Context.Service` declaration belongs in `*.ports.ts`, not `*.service.ts` (`packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.ports.ts:243`; `CandorPolicy.service.ts` is implementation only). Requirement-channel precedent: `CandorRecordReader \| SourceTextResolver \| Crypto.Crypto` satisfied by the caller (`.../CandorPolicy.ports.ts:185`). |
| Rung-2 append-only durability | **REUSE (in-slice precedent, not the cross-slice one):** `packages/law-practice/use-cases/src/CandorRecord/CandorRecord.ports.ts` — a six-member `LiteralKit` operation vocabulary with no update and no delete member (`:20-27`), the shape at `:190`, the `Context.Service` at `:282`, a use-cases-tier reader layer at `CandorRecord.reader.ts:73`, and drizzle repo + layers in `packages/law-practice/server/src/CandorRecord/` (`CandorRecord.repo.ts:241`, `CandorRecord.layer.ts:62`). The `ExecutionLedger` ports the BRIEF names remain the originating precedent (`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:61`, `:108`); the candor trio is that precedent already translated into this slice. |
| Rung-2 migration lane | **NET-NEW artifact, EXISTING lane** (see Sequencing): a second law-practice migration + PGlite proof + `AcceptedProofManifest` entries, cloning `20260806031625_law_practice_candor_gate` — including its shared `law_practice_candor_block_mutation()` trigger function fanned out to a `BEFORE UPDATE OR DELETE` and a `BEFORE TRUNCATE` pair per table (`migration.sql:96`, `:103-124`). |
| `PowerExercise` / `ActFrame` (rung 2) | **NET-NEW.** Attempted-vs-ineffective is representable *technically* today — `ExecutionVerdict` allowed/denied, `ExecutionSettlement` completed/failed/interrupted, `ExecutionLedger`'s write-ahead decision/outcome split — but nothing maps it onto legal effectiveness, and the live authority substrate governs technical sinks (`network-egress`, `mcp-write`), never legal competence (Lane A §5). The two-axis constitution × permission outcome is align-locked and never collapses into eFLINT's uniform violation rule. |
| `CorrectionDelta` (rung 2) | **NET-NEW contract; severity vocabulary align-locked at two members.** `ShaclSeverity` is live with three (`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:49`, service at `:384`); whether the implementation internally narrows that machinery to *produce* the two-member hard/advisory field is goal-packet latitude, but the contract vocabulary never adopts the three-member model. No executable validation shapes ship (No-Go; M4/remo1 boundary). |
| `PriorityBasis` and the legal verdict families (rung 2) | **NET-NEW, law-side only.** The generic vocabularies are closed and stay closed: `ContradictionMatchBasisKind` is `["same-source-overlap", "independent-evidence"]` (`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:435`) and `ContradictionDispositionStatus` is `["rejected", "superseded"]` (`:927`). `goals/epistemic-contradiction-triage/SPEC.md:27` forbids IP-law vocabulary there and `:76-78` forbids one family doubling as another. |
| Candidate handoff into triage (rung 2) | **REUSE the contract as-is, but the shape is a P0 decision.** `ContradictionTriageRepositoryShape` is five operations — `get`, `getExpanded`, `list`, `review`, `submit` (`packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:374-395`), service at `:410-413`. **DRIFT that changes the work:** `submit` exists *only* on the repository port — there is no `submit` RPC (`ContradictionTriage.rpc.ts` exposes list/get/review/getEvidenceSourcePage) and no `submit` on the service facade (`ContradictionTriage.service.ts:40-56`), so any submitting caller is an in-process server-tier caller by construction; a network-boundary submit path would be a new surface and a widening. `SubmitContradictionCandidate` (`ContradictionTriage.commands.ts:125`, struct `:34-75`) requires ten fields typed from `@beep/epistemic-domain/values/Contradiction`, so submission cannot be done without the epistemic types. Also: `@beep/epistemic-use-cases` has no `./ContradictionTriage` subpath export (`packages/epistemic/use-cases/package.json:32-44` — `ClaimGate`, `EdgeAuthority`, and `ExecutionLedger` each have one, so the asymmetry is easy to cite wrong); reach it through `./server`, `./public`, or the root `.`. The `./ContradictionTriage` subpath that *does* exist belongs to a different package, `@beep/epistemic-server` (`packages/epistemic/server/package.json:38`). |
| Rung-1 candidate inputs | **NET-NEW, no crossing.** Typed law-practice values returned by the policy service to its caller; no epistemic type in the signature or requirement channel. |
| Human approval composition | **READ-ONLY, and explicitly unconsumable in this wedge:** `RuntimeApprovalGate` remains a single-member placeholder (`RuntimeApprovalDecision` = `["pending"]`) with zero consumers outside its own directory (Lane A §4); this wedge neither widens nor consumes it, and a release-capable vocabulary is a gated criterion on `goals/agentic-professional-runtime`. |
| Practitioner authority | **GAP (not this goal):** no attorney/practitioner-authority substrate exists — `Role` is `["owner", "member"]` (`packages/shared/domain/src/entities/Membership/Membership.values.ts:13`) — and epistemic's `FrozenGrantSet` governs agent execution grants over technical sinks, not human legal standing. Authority is a recorded, cited basis bound to an attributed interpreter; it is never asserted (never-compute row 4). |

No NET-NEW component above duplicates an existing brick. The position domain,
the two derivations, and the relator are exactly the vocabulary Lane A verified
has no live owner anywhere in `packages/**/src`, re-confirmed on 2026-08-06. The
derivations were the one NET-NEW that smelled like an existing brick, so they
were challenged adversarially: five live analogues surfaced, all five are named
REUSE-REJECTED above with the reason each is the wrong shape, and one of them
(`invertChangeOperation`) is close enough structurally that the goal should copy
its `.match`-based involution style even though its substance does not transfer.

## Follow-Ons (named, triggered, NOT graduating)

- **Multital / in-rem aggregation** — generalizing the relator beyond two-party
  paucital relations is contested scholarship (Lane B §1.5); returns through its
  own align question.
- **`SlotCorrespondence`** — FLINT's slot-binding machinery, needed only when a
  relator is bound to an exercise event as a first-class artifact; Apache-2.0
  port-with-attribution if adopted.
- **Agents-runtime `Principal` migration** — moving `RuntimePrincipalId` (a
  module-private bare `S.NonEmptyString`) onto the shared `Principal` union is
  owned by the agents slice, not this wedge (align decision).
- **Complex-relator composition** — UFO-L's molecular relators; deferred by the
  V1-scope decision.
- **Legal-core package extraction** — only when a second legal consumer needs
  the contract, through the normal promotion-record gate (align decision).
- **Typed act-verb vocabulary / function-verb scheme** — composes
  `goals/semantic-foundation`'s scheme loading through that goal's own gates,
  never a new registry.
- **Versioned norm/rule identity** — the LegalRuleML subset and
  Expression-vs-Work temporal identity behind `sourceNorm` are owned by the
  queued `legal-rule-time-identity` wedge.
- **Executable validation shapes** — registry-carried shapes stay routed to
  semantic-foundation's M4 gate (campaign remo1 / HANDOFF constraint 2).
- **The law-practice → epistemic breach cleanup** — 13 import sites in 4 files
  plus four epistemic dependencies in `packages/law-practice/server/package.json:47-50`,
  including the `@beep/epistemic-tables` read the slice's own README marks
  temporary. Owned by whoever trips the spike exception's removal condition.
- **The `standards/ARCHITECTURE.md:632-636` ↔ `10-cross-slice-coordination.md`
  §2a desync** — a standards-consistency fix so the two-mechanism bullet
  cross-references the third ratified mechanism.

## Open Risks Inherited From The Brief

- **The rung-2 handoff shape is a P0 output, not a pre-authorized edit.** Three
  of four candidate shapes have disqualifying evidence and the fourth (extending
  the slice's bounded exception) is closer to tripping that exception's removal
  condition than to being covered by it. The goal must name the shape *and* its
  exact consumer/binding files, with an `architecture-guardian` check, and must
  not claim a live handoff it cannot prove — the sibling's owner ruling is the
  precedent.
- **`goals/epistemic-contradiction-triage` is landed-but-unverified.** Lifecycle
  `active`, P0/P1 complete, P2 Verify in-progress, acceptance criteria still
  unchecked. Compose against the shipped contract, but do not describe it as a
  finished dependency.
- **Content equality is exact, not semantic.** Differently-worded same acts are
  different content, which under-generates candidates by design. No
  act-equivalence inference, embedding similarity, or normalization passes.
- **Party linkage is by reference, and the referents are fixture-thin.** Rung 1
  references existing identities; it builds no identity-resolution or
  entity-merge machine, and it cannot assume entity-ref edges that do not exist
  between the current law party-likes.
- **`sourceNorm` is an opaque reference only.** The relator requires the
  reference to exist and nothing about its internal shape.
- **`result` never lands on the relator.** It is a required field of the rung-2
  exercise event; requiring it on a standing position forces placeholder values
  — the false-closure trap.
- **MPL-2.0 clean-room is file-scoped, not novelty-scoped.** The pre-existing
  `ShaclSeverity` narrows what rung 2 *wants* from `shacl/`, not the obligation:
  anything taken from either `shacl/*.ttl` file is clean-room re-expressed
  regardless of novelty, and the derivation is recorded in the goal packet.
- **FLINT narrows, UFO-L widens.** The position domain comes from UFO-L and must
  not shrink to FLINT's competency scope; eFLINT's execution semantics stay
  excluded by the P100 correction.
- **Rung 1's largest unknown is the `Party`/`LegalRole` linkage shape** — which
  is why it is the circuit-breaker's second degradation.
