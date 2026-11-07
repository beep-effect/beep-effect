# Attributed Multi-Claim Span Spec

## Objective

Ship a schema-first annotation aggregate in which one verified TextAnchor /
EvidenceSpan seam carries multiple independently attributed, supersedable
claims through LangExtract and ClaimGate while preserving claim-specific
confidence, principal/model identity, time, provenance, and gate disposition.

## Non-Goals

- A Lynx vocabulary fork or wholesale TTL/OWL vendoring.
- Schema-to-SHACL generation before semantic-foundation M4.
- A multilingual language-map framework without a consumer-backed competency
  question.
- A second epistemic claim or identity authority.
- Persistent graph storage, runtime OWL reasoning, or legal positions as SKOS
  concepts.
- Patent/IP semantics inferred from Lynx.

## Source Hierarchy

1. The 2026-08-13 operator sign-off and ceremony request.
2. Repo instructions and required skills.
3. [`BRIEF.md`](../../explorations/lynx-lkg-ontology-grounding/BRIEF.md),
   [`MAP.md`](../../explorations/lynx-lkg-ontology-grounding/MAP.md), and
   [`DECISIONS.md`](../../explorations/lynx-lkg-ontology-grounding/DECISIONS.md).
4. This `SPEC.md`, then `PLAN.md` and `GOAL.md`.

## Target Surfaces

- `packages/foundation/modeling/provenance/src/TextAnchor.ts` and its verified
  anchor seam.
- `packages/epistemic/domain/src/values/EvidenceSpan/` and the appropriate
  epistemic annotation/value modules.
- LangExtract and `packages/epistemic/use-cases/src/ClaimGate/` integration.
- Focused fixtures/tests and a lexicog competency-question design record.

## Constraints

- The aggregate is evidence/annotation, never a replacement claim authority.
- Each claim independently preserves attribution, model/version or human
  principal, confidence, time, provenance, disposition, and supersession.
- Supersession does not mutate the source anchor or erase prior annotations.
- LangExtract-to-ClaimGate outcomes preserve claim-specific evidence for both
  acceptance and rejection.
- Author one lexicog competency question now and compare it with the
  LangExtract-to-ClaimGate loop for term-level work.
- Lexicog, ELI, and any other source without a verified license remain
  reference-only.
- SHACL generation remains behind M4 and language discipline remains a MAP
  re-entry note.

## Acceptance Criteria

- [ ] One verified anchored span carries at least two independently attributed
      claims without duplicating claim authority.
- [ ] Every claim preserves distinct confidence, attribution, time, provenance,
      gate disposition, and supersession history.
- [ ] LangExtract emits the annotations and ClaimGate evaluates them with
      accepted/rejected evidence retained per claim.
- [ ] A lexicog competency question is authored and exercised in the fixture or
      design record.
- [ ] No SHACL generator, multilingual framework, unlicensed vendoring, or Lynx
      vocabulary fork enters scope.

## Decision Log

| Decision | Ratified contract |
| --- | --- |
| Lead shape | Attributed multi-claim span annotation is the lead goal. |
| SHACL | Generation stays behind semantic-foundation M4 and reopens the exploration at `decompose`. |
| Language | Language discipline remains a re-entry note until a multilingual CQ and consumer exist. |
| Lynx artifact | `lkg.ttl` uses the existing FOLIO TaxonomySeed route after Lynx-owned vetting/license proof. |
| Licensing | ELI and lexicog are reference-only without stated licenses. |
| Lexicog CQ | Author one competency question now and compare it with LangExtract-to-ClaimGate term work. |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug attributed-multi-claim-span`; add a `kind: decision` file there, never edit this block._

### research-intake-2026-11 routed 43 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 112 findings to this packet (43 affirmative, 4 critiques or disputes; 70 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- citesAsEvidence: https://ipwatchdog.com/2026/08/28/uspto-issues-its-first-ai-predicated-discipline-order-involving-hallucinated-cites-to-intrinsic-record/ — The article reports fabrication and attribution failures inside the patent’s intrinsic record. This supplies a concrete failure case for checking both source existence and whether the cited passage ac
- citesAsEvidence: https://www.bakerlaw.com/insights/from-hallucinations-to-legislation-california-codifies-ai-rules-for-attorneys/ — Responsibility for a citation does not depend on where it came from. Verification must check both that the authority exists and that it supports the proposition, which argues for span-level support ch
- usesMethodIn: https://neo4j.com/videos/why-graph-ai-succeeds-where-llms-fail/ — LLM-extracted entities are normalised to shared vocabularies (Schema.org) so synonyms resolve to one canonical concept linked to its defining paragraph.
- usesMethodIn: https://www.mdpi.com/2504-2289/10/9/295 — Source pointers are a triple of document id, structural path, and character offsets, enough to recover the exact cited span.
- supports: https://github.com/gfodor/legal-skills — Audit findings must carry a verbatim quote from the draft as evidence; this matches span-verified citation substrates.

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane `feat/research-intake-2026-11`

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

<!-- beep:decisions:end -->

## First Vertical Slice

Attach two independently attributed claims to one verified TextAnchor span,
send both through ClaimGate, and prove confidence, provenance, disposition,
and supersession remain claim-specific while exercising one lexicog
competency question.

## Stop Conditions

- The aggregate would become a second claim or minting authority.
- A required source artifact lacks verified reuse terms.
- The slice requires pre-M4 SHACL generation or a general multilingual model.
- Existing TextAnchor/EvidenceSpan or ClaimGate contracts would need an
  unrelated redesign.
