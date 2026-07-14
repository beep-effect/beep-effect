# Map — Domain-Layer Hardening decomposition

<!-- Stage 4 (decompose). Candidate goal packets: slug, mission, sequencing,
first slice, capability cites. Every major component cites an existing capability
or is marked NET-NEW. -->

## Candidate goal packets (7)

| # | slug | mission (one-liner) | depends on |
|---|---|---|---|
| 1 | **`domain-kernel-hardening`** | Retire `@beep/schema/DomainModel`; add `Principal`-typed soft-delete to `BaseEntity`; establish the `.errors.ts` convention. | — (unblocks all) |
| 2 | **`domain-typed-references`** | Replace `*FixtureKey: S.String` relationships with typed `EntityRef`/`EntityId` repo-wide; move `fixtureKey` to a fixtures/seed layer. | 1 |
| 3 | **`epistemic-claim-body`** | Replace `CandidateClaim`/`Activity` `snapshot: UnknownRecord` with a typed **SPO-capable assertion** VO + confidence/derivation-source; PROV-shaped `Activity`. Introduces the `DomainEvent` envelope VO (first consumer). | 2 |
| 4 | **`workspace-candidate-approval`** | Real `ApprovalDecision` union + `approverPrincipal`/`decidedAt`/`reason`; typed candidate bodies; reconcile candidate lifecycle with `ClaimLifecycle`; `EmailArtifact` VOs. | 2, 3 |
| 5 | **`law-practice-real-domain`** | Real vocabularies, office-action dates/examiner/art-unit, patent identifier VOs, party model, claim/prosecution lineage, `Matter` as aggregate root. Introduces the `TemporalValidity` VO (first consumer: effective-dating). | 2 |
| 6 | **`provenance-attestation`** | Verbatim span verifier (cross-field refinement idiom) + `Attestation`/`SignatureRequest` VO wiring `Sha256`/`Ed25519Signature` + content-addressing + evidence authority grading. | 1, 3 |
| 7 | **`agents-and-narrowing-sweep`** | `Agent`/`Skill` real fields + versioning, `AgentMode` union; fix `AssistantContent` annotation-dup; repo-wide `S.String`→`NonEmptyString`/VO narrowing; finish `ConstraintDecoder` migration. | 2 |

**Lifecycle annotation (2026-07-14):** packet 1,
[`domain-kernel-hardening`](../../goals/domain-kernel-hardening/README.md), is
`paused`; it resumes when KG tables approach scale with the ROADMAP PRD P2
librarian condition. Packets 2–7 remain held behind it through the dependency
graph below.

> **Deferred shared VOs (review finding).** `DomainEvent` and `TemporalValidity`
> are NOT pre-built in packet 1: a shared-kernel export needs >=2 *current*
> consumers (`02-shared-kernel.md`), and they have zero. Each is introduced by its
> first consumer — `DomainEvent` in packet 3 (claim supersession events),
> `TemporalValidity` in packet 5 (effective-dating) — and promoted to shared only
> once a second consumer appears.
>
> **Packet 5 is intentionally large** and must be split when it is shaped: at least
> (5a) vocabularies + patent-identifier VOs, and (5b) party model + `Matter`
> aggregate + claim/prosecution lineage. It also overlaps the completed
> `law-practice-office-action-spike`/`-extraction-rung` packets — reconcile against
> them (do not re-model office actions) before graduating.

> **Packet-5 shaping inputs (2026-07-14).** The bounded goals
> `law-docketing-patent-spine`, `law-time-capture-spine`,
> `citation-verified-span-substrate`, `citation-extraction-engine`,
> `court-reporter-vocabulary`, and `law-doc-structure-oa-slice` inform
> `law-practice-real-domain` shaping only. They do not clear dependency 2, and
> packet 5 must compose their public contracts without duplicating their
> workflows.

## Sequencing / dependency edges

```
1 domain-kernel-hardening  (FIRST SLICE — changes BaseEntity once, unblocks all)
        │
        ▼
2 domain-typed-references   (the biggest structural debt; gates the body work)
        ├───────────────┬───────────────┐
        ▼               ▼               ▼
3 epistemic-        5 law-practice-   7 agents-and-
  claim-body          real-domain       narrowing-sweep
        ├───────┐                        (mostly independent)
        ▼       ▼
4 workspace-   6 provenance-
  candidate-     attestation
  approval       (also needs kernel primitives from 1)
```
After **2**, packets **3 / 5 / 7** proceed in parallel. **4** lands after **3**
(it reuses the unified candidate/`ClaimLifecycle` model). **6** lands after **3**
(it needs the typed claim/evidence) and also depends on the kernel primitives (1).

## Capability citations (compose bricks; do not rebuild)

| Component | Existing capability (reuse) | NET-NEW |
|---|---|---|
| Soft-delete fields | `BaseEntity.fields`/`persisted` (`@beep/shared-domain/entity/BaseEntity`), `Principal`, `EntitySchema.persist.*` | the `deletedAt`/`deletedByPrincipal` field pair + retirement of `DomainModel` |
| Typed errors convention | `TaggedErrorClass` (`@beep/schema`), epistemic `ClaimInvalidTransition` template | per-slice `.errors.ts` files |
| Typed references | `EntityRef`, `EntityId.factory`, `identity/*` registries (`@beep/shared-domain`) | — (pure reuse; remove fixtureKey strings) |
| SPO assertion / claim body | `LiteralKit.toTaggedUnion`, `EvidenceSpan`, `UnitInterval`, `ClaimLifecycle` | the `Assertion` VO (subject-ref+predicate+object) + derivation-source enum — grounded by patent-KG SPO + agentmemory (`synthesis/20`) |
| Approval/lifecycle unions | `LiteralKit.toTaggedUnion`, `Principal`, `DateTimeFromMillis` | real `ApprovalDecision`/lifecycle unions + shared candidate-lifecycle model |
| Email VOs | `Email`, `TextAnchor`, `DateTimeFromMillis` (`@beep/schema`/`@beep/provenance`) | `EmailContact` VO |
| Legal vocabularies / VOs | `LiteralKit`, `toTaggedUnion`, `RejectionGround` (template), `LocalDate` | court/jurisdiction SKOS, CPC/IPC, patent identifier VOs, party model — grounded `synthesis/20` G7/G8 |
| Attestation / integrity | `Sha256`, `Ed25519Signature`, `HybridLogicalClock`, `VectorClock` (`primitives.ts` — unused), `Principal` | `Attestation`/`SignatureRequest` VO + span verifier — grounded `synthesis/21` G11, `synthesis/20` G3 |
| Temporal validity | `LocalDate`, `DateTimeFromMillis` | opt-in `TemporalValidity` VO (open-interval) — grounded `synthesis/20` G9 |
| Narrowing/annotation | `NonEmptyString`, `ConstraintDecoder`, `$I.annoteKey` | — (mechanical sweep) |

## First vertical slice

**`domain-kernel-hardening`** — smallest change with the largest unblock: it
touches `BaseEntity` once, every slice inherits it, and it sets the `.errors.ts`
convention the other six packets reuse. Graduated now; packets 2–7 named here,
graduated later from this exploration (status stays `active`).

## Coordination notes (review findings)
- **Packet 3's SPO-capable assertion must reconcile with `@beep/ontology` /
  `ontology-modeling-foundation` / `ip-law-knowledge-graph` at shaping.** The logical
  typed-body shape does not pre-commit the storage engine, but a subject-predicate-object
  vocabulary overlaps the TBox; source the assertion/triple primitive from
  `@beep/ontology` if one exists rather than minting a parallel one.
- **The decomposition overlaps ~70 existing goal packets.** Cross-links to the
  precedents are in the exploration README "Related Packets"; before graduating
  packets 3/5, explicitly map them onto `epistemic-claim-lifecycle-gate`,
  `provenance-shared-claim-kernel`, and the two `law-practice-office-action-*` packets.

## Deferred (with rationale)
- **Ontology TBox / FalkorDB projection / SPARQL** → `ip-law-knowledge-graph` packet
  (projection/engine, not domain modeling).
- **Bitemporal/matter-wall/reasoner enforcement** → roadmap P4 (model-now/enforce-later).
- **Drivers/ingestion + vendor selection** → driver/capability packets (per the
  `law_stuff/repos/GOLD_SYNTHESIS.md` routing — a same-day, beep-specific synthesis).
