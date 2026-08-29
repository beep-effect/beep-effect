# Research

<!--
Stage 1. Cite every external claim. In-repo inventory via
standards/repo-exports.catalog.md, targeted code search, and local docs; mark
gaps NOT FOUND. External-corpus grounding (Phase 2) lands in research/ +
synthesis/2N-*.md and is summarized back here.
-->

Two halves: **(A) in-repo capability inventory** (Phase 0 + Phase 1 audit) and
**(B) external grounding** (Phase 2, pending). Per-slice audit matrices live in
[`synthesis/`](./synthesis/); external deep-research reports live in
[`research/`](./research/).

---

## A. In-repo capability inventory (Phase 0 — DONE)

### A.1 Product direction (what the domain serves)
Local-first, provenance-grounded knowledge workbench for a solo IP practice
("Prose-to-Proof") on an Agentic Professional Runtime spine; law-practice is the
sole active vertical. Authoritative memory primitive = `claim + evidence +
provenance + lifecycle`; everything else is a rebuildable projection.
Candidate-only writes behind a human approval gate; evidence binds to stable
source span IDs. Storage-neutral, schema-first, org-first tenancy. Reasoner /
matter-walls / bitemporal store land at roadmap P4, DMS sync at P5 — *model now,
enforce later*.
- `docs/product/prose-to-proof.md`; `goals/agentic-professional-runtime/SPEC.md`.

### A.2 Slice inventory & maturity (measured in-tree)
| Slice (`packages/<s>/domain`) | #entities | Entities | Folders | Typed errors | Maturity |
|---|---|---|---|---|---|
| workspace | 10 | Workspace, Thread, Turn, Message, EmailArtifact, ContextPacket, CandidateTask, CandidateProject, CandidateDraft, ApprovalGate | entities, values | 0 | rich entities, no typed errors |
| law-practice | 9 | Matter, LegalClient, LegalContact, PatentAsset, OfficeAction, Claim, Rejection, Distinction, PriorArtReference | entities (+ per-entity values) | 0 | richest IP-law vocab, thin lifecycle/errors/provenance |
| epistemic | 4 | CandidateClaim, Evidence, Activity, UsageRecord | entities, values | 1 | the worked hardening precedent |
| agents | 2 | Agent, Skill | entities, turn, values | 0 | thin |
| shared/domain | 3 + kernel | User, Organization, Membership (+ BaseEntity/EntityId/Principal/primitives) | aggregates(empty), entities, entity, identity, values | 2 | the kernel/reference |

Excluded deliberately: **`architecture-lab`** is a *fully-wired* slice
(domain/client/server/ui/tables/use-cases) with a real `Worker` model + an
`aggregates/` dir — not merely a fixture — but it is a synthetic lab/specimen
slice, not a product vertical, so it is out of scope for product-domain hardening.
Foundation packages (`@beep/schema`, `@beep/provenance`, `@beep/rdf`, …) are
treated as **reuse-first substrate** (§A.3), not audited as product slices — they
supply the bricks the slices compose, by design.

### A.3 Canonical patterns ALREADY solved (reuse-first — do NOT re-propose)
Primitives in `packages/foundation/modeling/*` (`@beep/schema`, `@beep/identity`,
`@beep/provenance`) + `@beep/shared-domain`.
- **Persisted entity:** `BaseEntity.Class<Self>($I\`Name\`)(EntityId, { fields,
  persisted }, annote)` — `packages/shared/domain/src/entity/ProductEntity.ts`; over
  `EntitySchema.ClassFactory` (`packages/foundation/modeling/schema/src/index.ts`).
  Tables projected via `@beep/drizzle pgTableFrom`, never hand-mapped.
- **Identity:** `EntityId.factory` (branded PosInt + statics) —
  `packages/shared/domain/src/entity/EntityId.ts`; per-slice registries
  `packages/shared/domain/src/identity/{Shared,Workspace,Epistemic,LawPractice,Agents}.ts`;
  hierarchical `$I` composer + `$I.annote`/`annoteSchema`/`annoteKey` —
  `packages/foundation/modeling/identity/src/Id.ts`.
- **Tagged unions:** `S.toTaggedUnion("<field>")` for domain discriminators;
  `LiteralKit`/`MappedLiteralKit` for literal domains (exhaustive `.match`/`.cases`/guards) —
  `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts`.
- **Typed errors:** `TaggedErrorClass` (+ `CauseTaggedError`, `StatusCauseTaggedErrorClass`) —
  `packages/foundation/modeling/schema/src/index.ts`. No raw `Data.TaggedError`.
- **Value objects** (`@beep/schema/*` barrel `packages/foundation/modeling/schema/src/index.ts`):
  Email, Slug, Semver, Sha256, CurrencyCode, URL, Int/PosInt/NonNegativeInt,
  UnitInterval, Percentage, LocalDate, crypto VOs.
- **Provenance:** `TextAnchor` (half-open `[startChar,endChar)` + quoted substring) —
  `packages/foundation/modeling/provenance/src/TextAnchor.ts`; slices wrap it
  (`EvidenceSpan = TextAnchor + Confidence`).
- **Actor/audit on BaseEntity:** `createdAt`/`updatedAt`, `createdByPrincipal`/
  `updatedByPrincipal` (`Principal` union), `orgId`, `rowVersion` (optimistic
  concurrency), `schemaVersion`, `source` (`SourceKind`) —
  `packages/shared/domain/src/entity/{BaseEntity,Principal,SourceKind}.ts`.
- **Sync substrate (defined, unused by entities):** `HybridLogicalClock`,
  `VectorClock`, `Ed25519Signature`, `EncryptionKeyId` —
  `packages/shared/domain/src/entity/primitives.ts`.

### A.4 Binding rules (the constitution — cite, don't re-litigate)
`standards/ARCHITECTURE.md` + `standards/architecture/{GLOSSARY,DECISIONS,
02-shared-kernel,04-rich-domain-model,01-hexagonal-vertical-slices,
09-errors-across-boundaries}.md`.
- Schema is source of truth; narrow primitives (non-empty/pattern/range/brand)
  (`04-rich-domain-model.md:50-54`).
- Finite cases → discriminated unions, no optional-bag modeling
  (`ARCHITECTURE.md:120-125`; `DECISIONS.md:774-802`).
- `BaseEntity.Class` invariants; tables projected via `pgTableFrom`
  (`ARCHITECTURE.md:127-148`; `DECISIONS.md:580-619`).
- Domain-kind folders `aggregates/ entities/ values/`; role suffixes
  `.model/.values/.errors/.behavior/.policy/.events/.machine.ts`
  (`ARCHITECTURE.md:908-981`).
- Error taxonomy action/port/internal, translated at boundaries
  (`09-errors-across-boundaries.md`).
- Shared-kernel promotion gate: README promotion record + ≥2 consumers
  (`02-shared-kernel.md:93-198`).
- Domain `R` channel driver-free (no Sql/HttpClient/FileSystem/Config)
  (`04-rich-domain-model.md:98-146`).

### A.5 The hardening frontier (open / unbuilt — where this initiative adds value)
1. No typed domain errors in workspace / law-practice / agents (0 each).
2. Two competing audit bases: live `BaseEntity` vs unused
   `@beep/schema/DomainModel` (`packages/foundation/modeling/schema/src/DomainModel/DomainModel.ts`;
   adopted only by tests/dtslint).
3. No soft-delete (`deletedAt/deletedByPrincipal`) on the canonical base.
4. No temporal validity / bitemporal (`validFrom/validTo`) anywhere.
5. No domain-event / event-sourcing substrate (`DomainEvent/EventStore`) — NOT FOUND.
6. No shared cross-field refinement idiom (self-documented gap in `TextAnchor.ts`).
7. Shared-kernel aggregates module retired; identity vocabulary lives in `packages/shared/domain/src/identity/index.ts`.
8. `ConstraintDecoder`/`Encoder` migration partial; annotation-key duplication smell.
9. Law-practice rich in nouns, thin in lifecycle/errors/provenance.

---

## B. External grounding (Phase 2 — DONE)

Full mine of six corpora, paced/main-loop (cited by reference; nothing pasted).
Findings in `synthesis/20` (law+ontology) and `synthesis/21` (signature+dms+notes+
corpus); adopted shapes G1–G14 with WHY in `DECISIONS.md` §"Phase 2 outcomes".

| Corpus | Concern | Status | Grounded |
|---|---|---|---|
| `law_stuff` | legal vocab, patent IDs, bitemporal/lineage | **done** `synthesis/20` | G1,G2,G5–G10 |
| `ontology_research` | claim-body shape (SPO), party model, FOLIO/PROV-O targets | **done** `synthesis/20` | N8, G7 |
| `digital_signature_stuff` | signing/attestation (Box Sign) | **done** `synthesis/21` | G11 |
| `dms_stuff` | document/version model, soft-delete-as-trash (Box) | **done** `synthesis/21` | G12 |
| `meeting_notes_ai` | capture/segment provenance | **done** `synthesis/21` | G13 |
| `oppold-corpus` | real-world hierarchy validation (structure only) | **done** `synthesis/21` | G14 |

**Verdict:** no external source contradicted a Phase-1 recommendation; several
strengthened it (independent convergence on versioned/attributable records +
role-typed-participant + status-lifecycle unions).
