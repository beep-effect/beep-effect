# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW. Decomposed 2026-08-04 from the APPROVED BRIEF
(one goal packet, two phases) inside the five align boundaries in
DECISIONS.md.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `patent-citation-candor-gate` | Make every AI-discovered patent-reference occurrence a source-versioned, evidence-grounded `PatentCitationEvent`, and block filing promotion until each current one carries an attorney `CandorDisposition` bound to its exact observation version — no legal judgment ever computed. | None blocking. Gated acceptance criteria bind to the SPECs of `goals/citation-extraction-engine` (CitationMention handoff), `goals/uspto-prosecution-read` (observation identity, quarantine producer), and `goals/agentic-professional-runtime` (a gate decision vocabulary that can express release); `goals/citation-verified-span-substrate` is SPEC-bound compose-only (never forked, no gated criterion of its own). | Reuse `@beep/law-practice-domain` (`PatentReference`, `PriorArtReference`, `ApplicationNumber`, `Claim`, `PatentDocumentTriplet`, `DurableLocator`), `@beep/provenance` (`TextAnchor`, `VerifiedTextAnchor`, `TextAnchorVerificationReceipt`, `SourceTextIdentity`), `@beep/schema` (`LiteralKit`), the `ExecutionLedger` port/repo/layer precedent, and read-only `RuntimeApprovalGate` composition; **NET-NEW:** `PatentCitationEvent`, `CandorDisposition`, the law-owned application-identity union, the `CandorPolicy` service, rung-2 IDS fact records, and the law-practice slice's first db-admin migration. Full table below. |

One packet only — the BRIEF's appetite is explicit (one goal packet, two
phases, roughly two focused weeks). The deepen-play children stay named,
triggered, and NOT graduated (see Follow-Ons).

## Sequencing

Two rungs inside the single packet, strictly ordered; the packet's `PLAN.md`
phases map onto them.

1. **Rung 1 — domain proof** (`law-practice/domain` + `law-practice/use-cases`,
   in-memory/test-only storage, the `goals/agentic-professional-runtime`
   first-proof posture). Schemas first (`PatentCitationEvent`,
   `CandorDisposition`, the application-identity union, at most the optional
   `PatentFragmentLocator` slot), then the `CandorPolicy` `Context.Service`
   contract, then the failing-then-green `CandorPolicy.test.ts` (design order
   is standing law: schema → service contract → implementation). Deliberately
   not shippable protection on its own. Budget circuit-breaker from the BRIEF:
   if rung 1 busts its week, drop `PatentFragmentLocator` entirely — never the
   observation-version binding or the fail-closed predicate.
2. **Rung 2 — durability + live invocation** (`law-practice/domain` +
   `tables` + `server`, plus db-admin). Durable storage for events,
   dispositions, and the append-only IDS fact records on the `ExecutionLedger`
   precedent end to end; the law-practice slice's **first** db-admin migration
   with its PGlite migration test, both registered in `AcceptedProofManifest`;
   and the filing-promotion path actually consulting `CandorPolicy` through
   a doctrine-sanctioned cross-slice shape. Decompose narrows the BRIEF's
   list to the two shapes `standards/ARCHITECTURE.md:632-636` sanctions —
   emitted events (preferred) or a contract promoted into `shared/use-cases`
   through the normal promotion gate; app-level entrypoint composition is
   wiring only and never owns cross-slice orchestration. The final binding
   pick lands at goal P0 with an `architecture-guardian` check. Risk
   retirement lands here, not at rung 1.

Rung 2 never starts before rung 1's test is green; nothing else is
sequenced between them. Gated criteria (observation identity, quarantine
producer, `CitationMention` handoff, a release-capable gate vocabulary)
activate whenever their owning goals land — they gate acceptance criteria,
never the rungs' start.

## First Vertical Slice

The failing `CandorPolicy.test.ts` in `packages/law-practice/use-cases`: one
`PatentReference` with an examiner-observed event and an AI-discovered event;
assert filing promotion stays blocked until an attorney disposition covers
the AI event's exact observation version, then flips blocked again when a
newer observation version of the same source arrives (staleness re-blocks:
the superseded event stops blocking only once the newer event is itself
dispositioned). A second `PatentReference` carries its own AI-discovered
event so the gate's quantifier is exercised above cardinality one: with both
events current, disposing only one leaves promotion blocked, and only
disposing both releases it. The quarantine branch is proven against a
hand-constructed fixture (no live producer until `uspto-prosecution-read`
lands its raw-preserving unknown-code failures). Verify with the standard
slice test lane (`@effect/vitest` `layer()` over in-memory test layers only
— no other slice booted, no app runtime Layer).

## Capability Check

| Component | Live capability or gap |
| --- | --- |
| Normalized patent reference | **REUSE:** `PatentReference` at `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts` (the event's reference identity). |
| Examiner-citation record | **REUSE (recorded alongside, never migrated):** `PriorArtReference` at `packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts`; superseding its `officeActionFixtureKey` occurrence semantics is a later packet (out of scope for both rungs — see Follow-Ons), and donor-shaped `CitationBase` (`.../values/CitationBase/CitationBase.model.ts`) is a named no-go. |
| Citing-application identity | **REUSE + NET-NEW:** live `ApplicationNumber` (WIPO ST.13) at `packages/law-practice/domain/src/values/ApplicationNumber/`; **NET-NEW** law-owned union member mirroring the USPTO eight-digit normalized shape (`UsptoApplicationNumber` at `packages/drivers/uspto/src/Uspto.models.ts` — mirrored, never imported: domain never imports drivers), with explicit conversion — never `OfficeAction`'s free-text `applicationNumber`, never a `PatentAsset` fixture key, and never ST.13-only. |
| Entity identity | **NET-NEW (required registration):** `PatentCitationEventId` / `CandorDispositionId` in `packages/shared/domain/src/identity/LawPractice.ts` — every law-practice entity takes its id from there (precedent: `PriorArtReferenceId`, `LawPractice.ts:293`, consumed at `PriorArtReference.model.ts:51`). |
| Evidence grounding | **REUSE:** `TextAnchor` / `VerifiedTextAnchor` / `TextAnchorVerificationReceipt` / `verifyTextAnchor` at `packages/foundation/modeling/provenance/src/` (`TextAnchor.ts`, `VerifiedTextAnchor.ts`); persisted receipts are not live proof — re-verification required before any "current" claim. Epistemic's `EvidenceSpan` is NOT embedded (forbidden cross-slice edge). |
| Source-version identity | **REUSE:** `SourceTextIdentity` at `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts` — digests plus pinned extractor/normalization versions, and no revision order, parent relation, or head marker, so currency is declared by explicit supersession on the event (`EdgeVersion.supersedesId` posture at `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:141` — pattern only, never imported), never inferred from arrival or observation time. Binding that lineage to the USPTO observation identity (parser/vocabulary versions, checksums, retrieval time, freshness, cursor/upstream identity) is a gated criterion on the `uspto-prosecution-read` SPEC. |
| Canonical source text | **REUSE:** `SourceTextResolver` port with `ResolveSourceTextRequest` / `ResolvedSourceText` at `packages/foundation/capability/file-processing/src/SourceText/index.ts` (shape `:357`, service `:374`); `@beep/law-practice-use-cases` already declares `@beep/file-processing` (`package.json:52`) and `standards/ARCHITECTURE.md:622-623` permits use-cases → foundation/capability. A NET-NEW resolution service is a named no-go. Rung 1 uses a `Layer.succeed` fixture layer (precedent: `packages/epistemic/server/test/ContradictionTriage.observability.test.ts:67`); live layers are wired at the app entrypoint (`apps/professional-desktop/src/runtime/Layer.ts:218`, `:295`), never from law-practice. |
| Fragment identity (optional) | **REUSE neighbors:** `Claim`, `PatentDocumentTriplet`, `DurableLocator` under `packages/law-practice/domain/src/`; **NET-NEW (rung-1 optional / later-rung child):** `PatentFragmentLocator` value object beside them, composing verified anchors (align decision: law-practice home). |
| Citation event | **NET-NEW:** `PatentCitationEvent` entity in `law-practice/domain` — actor LiteralKit domain, tagged discovery-provenance union, observation/submission times, explicit staleness + explicit quarantine states that never rewrite evidence. |
| Attorney judgment | **NET-NEW:** `CandorDisposition` entity — dated, scoped, exact-event + exact-observation-version binding, minimal LiteralKit judgment vocabulary; judgment never computed (hard fact/judgment split, align decision). |
| Disposition authorship | **REUSE:** `createdByPrincipal: Principal` on every `BaseEntity` entity (`packages/shared/domain/src/entity/BaseEntity.ts:82`, persisted at `:108`; precedent `PriorArtReference.model.ts:50`), a union discriminating `User`/`Agent`/`ServiceAccount`/`System` (`packages/shared/domain/src/entity/Principal.ts`) — the predicate fails closed on that kind. **GAP (not this goal):** no attorney/practitioner-authority substrate exists — `Membership.Role` is `owner`/`member` only (`packages/shared/domain/src/entities/Membership/Membership.values.ts:13`) — so the gate never asserts practitioner authority (see Follow-Ons). |
| Gate predicate | **NET-NEW:** `CandorPolicy` `Context.Service` in `law-practice/use-cases` — derived, fail-closed, recomputed from events + dispositions; no stored closure state anywhere (align decision). |
| Filing gate state | **REUSE (read-only compose):** `RuntimeApprovalGate` / `RuntimeCandidateDraft` at `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts` — single-member decision vocabulary today; composition only through a lawful cross-slice shape; release-capable vocabulary is a gated criterion on `goals/agentic-professional-runtime`. |
| Durability precedent | **REUSE (pattern):** `ExecutionLedger` ports at `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts` end to end (ports → repo/layer → migration); **NET-NEW:** the law-practice slice's first db-admin migration + PGlite migration test + `AcceptedProofManifest` entries, and the rung-2 append-only IDS fact records (1.97 window facts as candidate-window-never-compliance, 1.17 fee facts, 1.98 content-presence facts, office-treatment states, supplemental submissions each with its own operative date). |
| Literal domains | **REUSE:** `LiteralKit` from `@beep/schema` for every string-literal vocabulary (standing law). |

No NET-NEW component above duplicates an existing brick: the two entities and
the policy service are exactly the reified occurrence/judgment/gate split that
Lane A verified has no live owner (`RESEARCH.md`; nugget T2-F2 survived 3/3),
and the identity union mirrors rather than re-derives the driver's normalized
form.

## Follow-Ons (named, triggered, NOT graduating)

- **Reference reconciliation inbox** — merging OA/IDS/engine/model occurrences
  around one normalized reference (deepen-play child; the predicate meanwhile
  treats possible duplicates as undisposed).
- **As-of citation timeline projection** and **practice-kg-mcp surface
  changes** — deepen-play children after the gate exists.
- **Grouped/manifest dispositions** — own align question, requires practice
  evidence.
- **Continuing-application matrix (MPEP 609.02)** and **1.97(e) certification
  predicates** — each returns only through its own align question.
- **`PatentFragmentLocator` as a full locator family** — shared-kernel
  promotion only if `goals/citation-extraction-engine` needs the contract,
  through the normal promotion-record gate.
- **Widening the quantified gate set** (examiner events gating) — a later
  align question; this wedge records examiner events without gating on them.
- **Practitioner-authority enforcement** — binding a `CandorDisposition` to a
  verified authorized practitioner (bar registration / authorized-signer
  role) needs an authority substrate no slice owns today; epistemic's
  `FrozenGrantSet` governs agent execution grants, not human standing, and
  is cross-slice. Returns through its own align question and packet. Until
  then the predicate's `User`-kind principal check is the entire trust
  boundary.

## Open Risks Inherited From The Brief

- The final gate-composition pick (emitted events preferred vs a promoted
  `shared/use-cases` contract — the two doctrine-sanctioned shapes decompose
  narrowed to) lands at goal P0; the existing `law-practice/use-cases` →
  epistemic dependencies are prior drift that must not be compounded with a
  new edge. Neither shape has a writable consumer on disk yet —
  `RuntimeApprovalGate`/`RuntimeCandidateDraft` have no caller in
  `packages/` or `apps/`, no product slice emits domain events, and
  `packages/shared/use-cases` does not exist — so P0 picks the shape *and*
  names its consumer surface, and the promoted-contract branch additionally
  needs an Exception Ledger entry against the no-new-packages non-goal.
- Quarantine has no live producer at rung 1 — the predicate branch is proven
  against fixtures until `uspto-prosecution-read` lands fail-explicit codes.
- Rung 2's real cost is the migration lane (slice's first db-admin migration,
  PGlite test, `AcceptedProofManifest`), not the schemas.
- Persisted anchor receipts are not live proof; "current" is defined against
  source-version identity, never receipt existence.
- `CitationMention` is spec-only with no patent-reference member; no adapter
  until that goal lands (gated criterion).
- Disposition vocabulary stays minimal at rung 1 while both judgment slots
  (Rule 56 vs litigation-frame) stay representable; the full vocabulary
  (including the dual Rule 56 / 1.98(c) cumulativeness judgments) is rung-2
  shaping detail.
- CFR-vs-MPEP source-version precedence: cite which source version each fact
  state was modeled from; never build version-resolution machinery.
