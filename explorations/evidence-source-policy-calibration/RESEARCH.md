# Research

## External Landscape

### 2026-10-09 — Evidence and limits

Paper `0a8de1437753`, *Uncertainty Management in the Construction of Knowledge
Graphs: a Survey*, separates source trust, confidence in the source's own
assertion, and confidence in extraction in its ideal integration pipeline
(section 5.2). It also describes source dependence: copied assertions can
mislead majority voting (section 8.2). This is a survey and conceptual design,
not calibration proof. Its destructive replacement proposal is rejected here:
retain assertions and supersede assessments instead.
[Paper](https://arxiv.org/abs/2405.16929); machine-local academia-2026-07
research corpus, `notes/0a8de1437753.json`, claims 2, 3 and 5.

Paper `b7ab12db479a`, *Populating Web-Scale Knowledge Graphs Using Distantly
Supervised Relation Extraction and Validation*, keeps extraction and graph
validation modular before learned aggregation (sections 3–3.3). Validation
benefits vary with graph connectivity; unseen entities can lack a score
(sections 3.2 and 4.3). Ranking gains do not establish calibrated probabilities,
source entailment or legal-domain transfer. Its graph score is a plausibility
feature, distinct from a SHACL report.
[Paper](https://doi.org/10.3390/info12080316); machine-local academia-2026-07
research corpus, `notes/b7ab12db479a.json`, claims 1, 6 and 7, limitations.

The wave-2 synthesis routes exactly these five signals here and to the
bitemporal edge core; it calls for calibration, abstention, source-span
correctness and explicit structural-feature missingness. It reports the
absence of legal-domain and bitemporal validation, so no paper percentage is
adopted as a release threshold. Source: machine-local academia-2026-07 research
corpus, `synthesis/wave2-synthesis.md`, sections 4, 5, new findings, honest limits
and proposed routing table. Repository counterparts:
`explorations/academia-corpus-mining/research/t3-master-synthesis.md`,
`explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md`,
and `goals/epistemic-bitemporal-edge-core/research/2026-08-17-academia-wave2-reentry.md`.

### 2026-10-09 — Prior art survey

Public primary sources were fetched with curl on 2026-10-09 (HTTP 200).

| Prior art | Supported distinction and applicability limit |
| --- | --- |
| [W3C PROV-O](https://www.w3.org/TR/prov-o/), section 3.1 | Entities, activities and agents describe derivation, generation and responsibility. Use as provenance vocabulary; lineage does not certify truth. |
| [Nanopublication Guidelines](https://nanopub.net/guidelines/working_draft/), Basic Elements | Assertion, assertion provenance, publication information and linking head are separate graphs. Community working draft, not a truth or calibration standard. |
| [W3C Web Annotation](https://www.w3.org/TR/annotation-model/), Motivation and Purpose | Assessment, questioning, replying and moderation records can target resources. Motivation describes intent; reviewer authority and completed acceptance still need project policy. |
| [Dong et al., source dependence](https://www.vldb.org/pvldb/vol2/vldb09-pvldb47.pdf), introduction and models | Copied false values can defeat majority voting; dependence-aware discovery discounts repeated support. Static, single-truth and tractability assumptions do not prove independence of arbitrary documents. |
| [Guo et al., calibration](https://proceedings.mlr.press/v70/guo17a/guo17a.pdf), calibration definition and temperature scaling | Calibration tests confidence against empirical correctness frequency; temperature is fitted on validation data. The classifier experiments do not calibrate free-form model self-reports, source authority or shifted domains. |
| [Geifman and El-Yaniv, selective classification](https://papers.nips.cc/paper_files/paper/2017/file/4a8423d5e91fda00bb7e46540e2b0cf1-Paper.pdf), selective risk and coverage | Abstention trades accepted-set risk against coverage. Stated guarantees require the specified procedure and i.i.d. labeled samples; an informal threshold inherits none. |
| [W3C SHACL](https://www.w3.org/TR/shacl/), severity and validation report | sh:conforms is true iff there are no validation results. Info/Warning/Violation categorize results without changing validation semantics; custom severity IRIs are permitted. Project admission must preserve raw conformance, and passing constraints does not prove factual truth. |

Design inference: retain independent provenance-bearing assessments; declare
calibration scope; permit missingness and abstention; keep validation and
human review independent. No referenced source establishes a universal numeric
threshold or legal-domain accuracy claim.
All external sources are reference-only; no implementation or paper text is
copied. The policy conclusions in DECISIONS are lane decisions, not claims
that a reference standard mandates this five-field contract.

## In-Repo Capability Inventory

### 2026-10-09 — Live source and public-surface inspection

Graft located the review/disposition seams, followed by source inspection and
targeted searches. NOT FOUND means absent in these inspected producer/domain
surfaces, not a claim about every experimental file in the repository.

| Package and source path | Existing field/type | Writing stage and relevance |
| --- | --- | --- |
| `@beep/schema`, `packages/foundation/modeling/schema/src/UnitInterval.ts` | Branded finite number in [0,1]; subpath `@beep/schema/UnitInterval` | Decode primitive, no producer or calibration semantics. Reuse for three numeric signals. |
| `@beep/epistemic-domain`, `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts` | `Confidence` aliases UnitInterval; `EvidenceSpan.confidence` is required | Extraction/span construction. No calibration metadata; legacy span score cannot silently become source trust. |
| `@beep/langextract`, `packages/foundation/capability/langextract/src/Extraction/Extraction.model.ts` | `ExtractionCandidate.confidence`: Option<UnitInterval>, retained by GroundedExtraction; AlignmentStatus literals | Model extraction writes confidence; deterministic grounding writes alignment status. Optional confidence has no calibration label. |
| `@beep/langextract`, `packages/foundation/capability/langextract/src/Alignment/Alignment.model.ts` | `ScoredMatch[2]`: UnitInterval Levenshtein similarity; `AlignedMatch[0]`: alignment tier; fuzzyThreshold | Deterministic source matching. Similarity and thresholds are not epistemic probabilities. |
| `@beep/nlp`, `packages/foundation/modeling/nlp/src/Handoff/Contract.ts` and `packages/foundation/modeling/nlp/src/Handoff/index.ts` | Provenance.confidence, Entity.confidence, Relation.confidence: optional UnitInterval; source/generatedBy/timestamp | NLP handoff producer. Provenance fields exist but model/prompt/calibration version envelope is NET-NEW. Handoff re-exports the schema primitive. |
| `@beep/provenance`, `packages/foundation/modeling/provenance/src/TextAnchor.ts` | startChar/endChar: Natural; quote: NonEmptyString; width check | Anchoring. No confidence field; internal width consistency alone does not verify source or entailment. |
| `@beep/epistemic-domain`, `packages/epistemic/domain/src/values/ClaimEvidenceReview/ClaimEvidenceReview.model.ts` | ClaimEvidenceReview: basis, reviewedBy UserPrincipal, reviewedAt; review status Pending/Current/Stale; verification Verified/Unverified | Human evidence review. Approval is bound to exact claim/span/source basis; staleness and source verification stay separate. Negative/abstain review events NOT FOUND here. |
| `@beep/epistemic-domain`, `packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts`; `packages/epistemic/domain/src/values/ClaimDispositionStatus/ClaimDispositionStatus.model.ts` | status active/rejected/superseded; resolvedBy Principal, resolvedAt, reason, violations | Gate/lifecycle resolution. A System principal is allowed; active does not prove human acceptance. |
| `@beep/shared-domain`, `packages/shared/domain/src/identity/Epistemic/ClaimDispositionId.ts` | EntityId factory for claim_disposition | Persistence identity, no signal value. Reference existing disposition ids when applicable. |
| `@beep/epistemic-domain`, `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts` | admitted/rejected tagged verdict; ClaimGateViolation severity info/warning/violation, focusNode/path/message | Symbolic gate. Full report ref, shape digest and severity-count envelope NOT FOUND in this result. |
| `@beep/epistemic-domain`, `packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts` | ContradictionAssessment.confidence: Confidence; match basis same-source-overlap/independent-evidence; detector/proposal digests; rejected/superseded review | Contradiction detection and resolution. Detector confidence is not any of the five fields without its own typed provenance. Match basis is useful lineage precedent, not proof that all copies are detected. |
| `@beep/file-processing`, `packages/foundation/capability/file-processing/src/PageOcr/PageOcr.schema.ts` | PageOcrResult.confidence: optional finite [0,1] local schema; warnings; engine/runtime/model/weights identity and image/source digests | Page OCR. Reader uncertainty belongs in extraction input provenance, not source-assertion confidence. |
| `@beep/law-practice-use-cases`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts` | ParalegalRevision.selfReportedConfidence and ReviewRound.extractorConfidence: Option<UnitInterval>; ReviewRound.score: UnitInterval; acceptThreshold | Extractor/critic loop records self-reports without scoring them. scoreRound combines material-findings and agreement, with deterministic checks as a separate gate. Existing threshold is task-specific, not transferable calibration. |
| `@beep/epistemic-tables`, `packages/epistemic/tables/src/entities/Evidence/Evidence.table.ts`; domain `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts` | Evidence.span: EvidenceSpan persisted JSONB; artifact/span fixture keys | Evidence persistence preserves fractional extraction confidence; five-signal record NOT FOUND. Table is derived from domain entity. |
| `@beep/db-admin`, `packages/_internal/db-admin/src/migrations/EpistemicEdge.ts` | Migration target registers candidateClaim, evidence, edgeVersion, claimDisposition | Schema application, not a scoring producer. No migration for five-signal assessments exists here. |
| `@beep/epistemic-domain`, `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts` | validFrom/validTo and recordedAt/expiredAt; supersedesId | Bitemporal persistence precedent. Signal-history adapter and assessment identity are NET-NEW; no existing table is promised to fit unchanged. |
| Inspected epistemic/langextract/provenance surfaces above | sourceTrust, sourceAssertionConfidence, calibration method/version: NOT FOUND | Source policy and source-assertion assessment envelopes are NET-NEW. Do not infer a value from document origin or extraction confidence. |

Design inputs are not runtime dependencies. `goals/legal-document-intake/SPEC.md`
D7-S1 supersedes only D7's validator with the real `@beep/shacl` driver;
`goals/semantic-foundation/PLAN.md` M4 remains gated. The bounded engine in
`goals/epistemic-claim-lifecycle-gate/SPEC.md` therefore cannot be assumed to
cover G3's final shapes. G3 must pin a ready validator and shape version.
`explorations/ingestion-security-secret-governance/research/secret-pii-scrub-and-audit.md`
uses “validator score” as design vocabulary, not an authoritative schema.
`explorations/gpu-document-ocr/RESEARCH.md` is the parallel reader investigation;
this lane does not adopt its unmeasured quality claims as thresholds.

## Constraints Discovered

### 2026-10-09

- Five top-level signals are fixed; provenance and calibration are envelopes,
  not a sixth quality signal. No collapsed score is stored, including caches.
- Source trust has scope (predicate/domain, jurisdiction where relevant, valid
  time and policy version). It is an assessment, never universal authority.
- Per-source assertions retain distinct identities even for identical content.
  Lineage uncertainty stays explicit; copies cannot become independent votes.
- Missing assessment is Option.none, not zero. Per-field absence reason must
  distinguish not-assessed, unavailable, not-applicable and legacy-unknown.
- UnitInterval bounds do not establish probability calibration. Unknown legacy
  calibration must remain uncalibrated and must never be upgraded by a cast.
- SHACL conformance is a structural result, not truth, entailment or permission.
  Human approval applies only to its exact basis and becomes stale on drift.
- G3 is currently a gated MAP candidate. It must seed its SPEC from the dated
  ratification, pin signal contract v1, and migrate semantic changes after freeze.
- This lane is docs-only. No schemas, package changes, corpus processing,
  decompose, graduation, goal scaffold or metered services are admitted.
