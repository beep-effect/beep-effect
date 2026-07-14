# Decisions

<!--
Stage 2 (align). One branch-closing question at a time, recommended answer
first. Log every resolution with WHY; keep manifest openQuestions in sync.
Phase-2 corpus findings get adopted/rejected here with WHY.
-->

## Resolved at the Phase-0 gate (2026-06-29)

### D0.1 — Scope of the audit
**Resolved: all product slices + kernel** (`workspace`, `law-practice`,
`epistemic`, `agents`, `shared/domain`). `architecture-lab` excluded (fixture).
**Why:** the user optimizes for future-proofing over token economy; the kernel
sets invariants every slice inherits, so a comprehensive pass beats a single
vertical. Drivers/foundation are substrate, not product domain.

### D0.2 — Artifact home
**Resolved: a new exploration packet, `domain-layer-hardening`.** **Why:** clean
lineage through the `/explore` pipeline (capture→research→align→shape→decompose→
graduate); graduates into a `goals/` packet at Phase 3 without entangling the
existing `atlas-synthesis` gap-map.

### D0.3 — External grounding depth
**Resolved: full mine of all six corpora.** **Why:** the rubric's criterion 3
(external validation) is load-bearing; the legal/DMS/signature/ontology corpora
are exactly the modeling-decision sources the initiative needs to be defensible.

### D0.4 — Execution pacing
**Resolved: sequential per-slice, bounded concurrency (≤2–3 agents), continue
agents via `SendMessage`.** **Why:** an account spend-limit was hit during
orientation; paced execution stays inside budget and avoids mid-run agent kills.

---

## Open for Phase 1 (align — to resolve during/after the audit)

These mirror `ops/manifest.json` `openQuestions`. Each will be closed with a
recommended-answer-first entry once the audit + Phase-2 grounding inform it.

- **Q1 — Audit base reconciliation.** Retire the unused `@beep/schema/DomainModel`,
  or promote its soft-delete/`version` fields into the live `BaseEntity`?
- **Q2 — Soft-delete posture.** Add `deletedAt`/`deletedByPrincipal` to the
  canonical `BaseEntity` now (model-now/enforce-later), or per-entity only?
- **Q3 — Temporal validity.** Introduce `validFrom`/`validTo` (bitemporal
  substrate) at the base or for select aggregates now, vs defer to roadmap P4?
- **Q4 — Domain-event substrate.** Add a `.events.ts` envelope + emission seam
  now, or defer to first cross-slice integration load?
- **Q5 — Typed-error gap.** Add `.errors.ts` actionable domain failures to
  `law-practice`/`workspace`/`agents` (0 each today) in this pass?
- **Q6 — Aggregate roots.** Which flat entities are really consistency
  boundaries belonging in `aggregates/` (candidates: `Matter`, `Thread`,
  `OfficeAction`)?

---

## Phase 1 findings — recommended directions (2026-06-29)

Phase 1 audit complete (`synthesis/10`–`14` + `19`). Recommended answers below
are **provisional pending Phase-2 grounding**; items tagged *[grounded]* depend
on the corpus mine before they close.

### Standing questions
- **Q1 audit-base** → **retire `@beep/schema/DomainModel`; port soft-delete into
  `BaseEntity`** with rich `Principal` actor typing (not `String`). `rowVersion`
  already subsumes `DomainModel.version`.
- **Q2 soft-delete** → **base-wide** `deletedAt`/`deletedByPrincipal` on `BaseEntity`.
- **Q3 temporal validity** → **opt-in `TemporalValidity` VO**, applied to entities
  with real effective-dating; NOT base-wide.
- **Q4 domain events** → **define a `DomainEvent` envelope VO now**, wire emission later.
- **Q5 typed errors** → **per-slice `.errors.ts`** using the epistemic
  `ClaimInvalidTransition` template (smart ctor + union).
- **Q6 aggregate roots** → **`Turn`,`Thread` (workspace), `Matter` (law-practice)**
  are aggregate roots; promote to `aggregates/`. Confirm `Claim`↔`PatentAsset`↔`Matter`
  boundary.

### New questions surfaced by the audit (the highest-leverage debt)
- **N1 — typed references (P1).** Replace `*FixtureKey: S.String` relationships with
  typed `EntityRef`/`EntityId` repo-wide. *Recommend adopt — top structural priority.*
  Open: is `fixtureKey` retained as a seed-import field or moved to a fixtures layer?
- **N2 — typed bodies (P2).** Replace `snapshot: UnknownRecord` (candidates, claims,
  activities, approvals, context packets) with typed value objects. *Recommend adopt;*
  *[grounded]* on Phase-2 ontology/DMS corpus for the claim/activity shapes.
- **N3 — real vocabularies (P3).** Grow the 8 placeholder literals into real domain
  vocabularies (often `toTaggedUnion` with per-case payload). *[grounded]* on law/oppold corpus.
- **N4 — lifecycle unification (P5).** One candidate/approval lifecycle relating to
  `ClaimLifecycle`, vs per-surface vocabularies. *Recommend a shared model; cross-slice decision.*
- **N5 — `ApprovalGate` cannot express approval.** `ApprovalDecision = ["pending"]`
  only; needs approved/rejected/changes_requested + `approverPrincipal` + `decidedAt`
  + `reason`. *Recommend adopt — product-spine critical.*
- **N6 — attestation/provenance adoption (P8).** Wire `TextAnchor` + the unused
  `Sha256`/`Ed25519Signature`/`HybridLogicalClock`/`VectorClock` substrate into a
  reusable attestation VO for evidence/approval/signed entities. *[grounded]* on signature corpus.
- **N7 — agent versioning.** `AgentPrincipal.agentVersionId` exists but `Agent` has no
  version backing it. Field, temporal mixin, or `AgentVersion` entity? *Open.*
- **N8 — claim body shape.** SPO triple vs claim-text+structured-fields vs tagged
  union of claim kinds? *[grounded]* — the product's core primitive; ontology corpus is a hard dep.

---

## Phase 2 — external grounding outcomes (2026-06-29)

All six corpora mined, paced/main-loop (`synthesis/20` law+ontology, `synthesis/21`
signature+dms+notes+corpus). **No external source contradicted a Phase-1
recommendation; several strengthened it.** Adopted shapes (detail + citations in
`synthesis/20`–`21`):

- **G1 bitemporal never-overwrite edges** (`tvalid`/`supersededBy`/`isLatest`) →
  resolves N4 lifecycle supersession + R3 temporal validity + P10 events. *agentmemory.*
- **G2 typed version-lineage `source` enum** (machine-proposed vs human-confirmed) →
  resolves the candidate→approval boundary (N4/N5) + soft-delete (P6). *mike.*
- **G3 verbatim span verifier** → the shared cross-field refinement idiom, closes the
  `TextAnchor` gap (P8/kernel R7). *doc-haus.*
- **G4 confidence + derivation-`source`** on claims/evidence → N8/P2 (how-derived). *harvest-mcp/agentmemory.*
- **G5 authority/quality grading** on cited sources → `PriorArtReference`/Evidence. *research-squad.*
- **G6 claim/prosecution version lineage** → law `Claim`/`PatentAsset` (P1/P9). *uspto_pfw_mcp.*
- **G7 court/jurisdiction SKOS + CPC/IPC + reporter crosswalk** → real vocabularies (P3/N3). *courtlistener/courts-db/patents-mcp-server.*
- **G8 patent identifier + bibliographic VOs** → `PatentAsset` (P3/L2). *uspto MCPs.*
- **G9 temporal-validity as-of filtering** (open-interval sentinels) → `TemporalValidity` VO (R3). *courts-db.*
- **G10 content-addressable hashing** (metadata-normalized) → wires `Sha256` (P8/R6). *doctor.*
- **G11 `Attestation`/`SignatureRequest` VO** (role union + status lifecycle + signed-artifact hash+signature) → N6, wires `Ed25519Signature`. *Box Sign.*
- **G12 document/version + soft-delete-as-trash + typed metadata templates** → P6/P2/R1. *Box.*
- **G13 capture-artifact + timestamped segment provenance + HMAC integrity** → P8/W4. *meeting-notes corpus.*
- **G14 real-corpus client→matter→document hierarchy** (manifests/catalog) → validates party→matter→document aggregates (P3/N3/L5/L6). *oppold (structure only).*

**Convergence:** three independent corpora demand versioned/never-overwrite/
attributable records and role-typed-participant + status-lifecycle unions — the
same shapes the audit flagged. **Resolved directions** for the grounded questions:
N3 (G7/G8), N6 (G11), N8 (SPO-capable assertion + confidence/derivation/lifecycle/
supersession; defer deep FOLIO/PROV-O TBox to `ip-law-knowledge-graph`),
R3 (G9/G1), P6 (G2/G12), P8 (G10/G11/G13).

---

## Adversarial review outcomes (2026-06-29)

A 6-dimension adversarial review (multi-agent, with an independent verify pass)
stress-tested the audit, grounding, plan, and graduated packet. **Verdict: the
Phase-1 audit held** — the code-accuracy dimension tried to refute every
load-bearing claim and verified them all true (only cosmetic nits). Three serious
findings survived verification and were **applied**:

- **R-1 (upheld, packet-compliance).** The graduated `domain-kernel-hardening` SPEC
  proposed promotion records for `TemporalValidity`/`DomainEvent` citing *intended*
  consumers, violating `02-shared-kernel.md:189` (>=2 *current* consumers; these had
  zero). **Fix:** cut both VOs out of packet 1; each is introduced by its first
  consumer (`DomainEvent`→packet 3, `TemporalValidity`→packet 5). Adding fields to
  the already-shared `BaseEntity` needs no new promotion record.
- **R-2 (upheld, plan-soundness).** Same two VOs were speculative scaffolding on the
  critical-path first packet, contradicting its "smallest change" framing. Resolved
  by the same cut (R-1).
- **R-3 (upheld, plan-soundness).** `MAP.md` packet-4 dependency table (`2, lifecycle
  from 1/3`) contradicted the ASCII graph (3/4 drawn parallel). **Fix:** packet 4 now
  depends on `2, 3`; graph redrawn with the `3→4` edge.

Minors applied: softened the `GOLD_SYNTHESIS.md` "independent" framing (it is a
same-day beep-specific synthesis of *independent* repos); corrected G7 "CPC/IPC"→
"CPC" (cited file has no IPC table); footnoted `architecture-lab` as a wired-but-
synthetic slice deliberately excluded; added MAP coordination notes (packet-3 SPO
shape must reconcile with `@beep/ontology`; packet 5 is large and must split +
reconcile with the office-action packets); fixed three code-audit nits
(applicationNumber mislabel, Turn cross-slice overstatement, DomainModel "only
tests" + version floor/mechanism).

Refuted by the verify pass (recorded for honesty): the "foundation surface silently
dropped" critique (it is explicitly scoped as reuse substrate), "retire DomainModel =
64-file churn" (the SPEC sanctions deprecate-alias), "attestation packet is committed
speculation" (it is a deferred candidate), "SPO pre-commits the graph engine" (logical
shape ≠ storage), and "plan shaped in isolation" (the README Related-Packets section
exists). Reuse check (run manually after one review agent degraded): all proposed
NET-NEW symbols return 0 existing files; claimed bricks (`EntityRef`, `Ed25519Signature`)
exist — reuse-first discipline holds.

## 2026-07-14 — sibling review held packets 2–7

**Decision:** Hold all six remaining candidate packets. Packet 1,
`goals/domain-kernel-hardening`, is paused until KG tables approach scale and
opens with the ROADMAP PRD P2 librarian condition; the MAP dependency graph
therefore keeps packets 2–7 closed.

The new goals `law-docketing-patent-spine`, `law-time-capture-spine`,
`citation-verified-span-substrate`, `citation-extraction-engine`,
`court-reporter-vocabulary`, and `law-doc-structure-oa-slice` are recorded as
packet-5 (`law-practice-real-domain`) **SHAPING INPUTS only**. They do not clear
dependency 2, and packet 5 must not duplicate their bounded workflows.

**Rationale:** These consumers sharpen the eventual domain seam, but they do
not land the typed-reference prerequisite or resume the shared-kernel packet.
Treating them as clearance would invert the ratified dependency graph; folding
their workflows into packet 5 would create overlapping owners.
