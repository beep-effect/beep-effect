# Decisions

## 2026-08-17 — Born parked from wave-2 routing

**Decision:** Spawn this exploration at `capture`, parked, from the
`academia-corpus-mining` wave-2 routing triage. The operator explicitly chose
to spawn all four proposed explorations: the parked portfolio is the work
queue for roadmap ordering and for new model capability, so research-backed
candidates are captured as packets rather than left as table rows.

**Resume trigger:** Resume when an epistemic consumer needs calibrated multi-signal confidence (source trust vs extractor vs validator vs reviewer) rather than a single collapsed score.

## 2026-10-09 — Resume trigger fired

**Decision:** G3, the gated `oppold-corpus-semantic-ingestion-v2` candidate, needs the five-signal contract before semantic freeze. The corpus-ingestion run-order program fired the resume trigger. Ratified by the lane under the autonomy charter; the operator reviews asynchronously.

**Reversal:** Re-park with a later dated reason if the consumer or run order changes.

## 2026-10-09 — Align round 1 (agent-decided)

Basis: autonomy charter and corpus-ingestion run-order authorization; operator review is asynchronous.

### Granularity and source trust reference

**Question:** Granularity and source trust reference?

**Answer:** Each extracted claim is one source-local assertion occurrence with an exact document/text version and evidence-span basis. sourceTrust holds a reference to an immutable scoped source assessment; the other signals assess this exact claim basis. Projection resolves the pinned reference without following a mutable latest value.

**Rationale:** Recommended: per-claim envelope with referenced source trust. Reject per-document confidence and unscoped per-span-only claims: both lose assertion identity. Reject copied trust numbers without assessment identity: they become stale and unauditable. Identical propositions from separate sources stay separate assertions.

**Reversal:** Supersede with a dated granularity decision before G3 scaffold; after freeze migrate claim identity and reference bindings.

### Value domains

**Question:** Value domains?

**Answer:** Use @beep/schema/UnitInterval for source trust, source-assertion confidence and extractor confidence values. Use NET-NEW ValidatorAssessment structured report and NET-NEW ReviewerDisposition LiteralKit domain, rather than numeric scores for those two. These are named design building blocks, not code authored here.

**Rationale:** Recommended: preserve measured scalar detail and typed nonnumeric outcomes. Reject low/medium/high tiers for numeric producers because thresholds are arbitrary; reject forcing every signal into UnitInterval. A bounded number is not a probability guarantee.

**Reversal:** Replace the domain definitions in a later dated contract before freeze; afterwards migrate values and consumers.

### Absence

**Question:** Absence?

**Answer:** All five fields are Option<assessment-or-reference>. None means no applicable assessment, not zero. A companion per-field absence reason is required when None: not-assessed, unavailable, not-applicable or legacy-unknown. An assessment event can record a failed attempt without manufacturing a value.

**Rationale:** Recommended: Option plus explicit reason. Reject zero defaults, sentinel -1, and treating absent as rejected. Some(0) means an actual assessed zero; an abstention is a present review decision.

**Reversal:** Supersede absence semantics before scaffold; after freeze migrate missingness and retain original unknown state.

## 2026-10-09 — Align round 2 (agent-decided)

Basis: autonomy charter and corpus-ingestion run-order authorization; operator review is asynchronous.

### Calibration status and method

**Question:** Calibration status and method?

**Answer:** Each numeric assessment carries a named CalibrationStatus LiteralKit: uncalibrated or calibrated. Uncalibrated includes raw-self-report, source-declared or policy-heuristic method metadata; calibrated requires target event, method/version, evaluation artifact reference, population/scope, evaluation date and metrics. The calibrated assessment references and supersedes its raw input while preserving it. Nonnumeric validation/review carry not-applicable calibration metadata.

**Rationale:** Recommended: raw is explicitly uncalibrated until independent evaluation supports the declared target/population. Reject model certainty as calibration and reject cross-field numerical comparison. Source hedging is not converted into a number without a versioned rubric and label. The source assertion value describes the source expressed certainty, not the extractor belief.

**Reversal:** Invalidate calibration applicability with a new assessment on scope or producer drift; keep prior values and evidence. Revise labels before freeze or migrate thereafter.

### Producer identity and versions

**Question:** Producer identity and versions?

**Answer:** Every present assessment has an immutable id, contractVersion, basis digest, producing activity reference, responsible agent/principal, producer version, assessedAt and bitemporal validity/recording bounds. Extractor adds model/provider revision, prompt/template digest and configuration version; source trust adds policy version and scope; source-assertion confidence adds cited expression and measurement/rubric version; validator adds engine and shapes digest/version plus data snapshot; human review adds reviewer identity and review-policy version. Reader run/engine/text lineage is in extractor input provenance. Unavailable historical provenance remains explicitly legacy-unknown, never invented.

**Rationale:** Recommended: per-assessment provenance rather than one run-wide model string. Reject undocumented prompt changes and interpreting source authors as extracting agents. The envelope and history adapter are NET-NEW, composed from existing identity, anchor and review bricks.

**Reversal:** Supersede provenance contract before freeze; subsequently migrate with explicit legacy gaps and retain original producer metadata.

### Append-only history and bitemporal fit

**Question:** Append-only history and bitemporal fit?

**Answer:** Assessments append and supersede; never overwrite value, reason or basis. Keep separate valid-time [validFrom,validTo) and knowledge-time [recordedAt,expiredAt) semantics, assessment supersedes reference and authoritative events. Closing an interval is the established lifecycle operation, not permission to rewrite payload. Resolve deterministic as-of views using declared scope; do not choose a numeric maximum.

**Rationale:** Recommended: compose bitemporal edge-core semantics; NET-NEW signal-history mapping. Reject in-place rescoring, delete-on-retraction and pretending the current Evidence JSONB already has all fields.

**Reversal:** Rebuild derived views from preserved events; supersede a wrong assessment. Storage-layout changes before freeze are decisions, after freeze migrations.

### Dependent sources

**Question:** Dependent sources?

**Answer:** Retain upstream source/derivation references and a versioned lineage assessment: independent, dependent or unknown, with the basis for that conclusion. Copies/mirrors sharing an origin never add independent support; unknown dependence cannot be treated as proven independence.

**Rationale:** Recommended: lineage-aware corroboration over source-local assertions. Reject raw majority vote and treating different URLs as different witnesses. Contradiction match-basis is a useful brick but not a complete copy detector.

**Reversal:** Supersede mistaken lineage with a new event and recompute affected views; retain prior as-of results and policy versions.

## 2026-10-09 — Align round 3 (agent-decided)

Basis: autonomy charter and corpus-ingestion run-order authorization; operator review is asynchronous.

### Reviewer disposition versus existing types

**Question:** Reviewer disposition versus existing types?

**Answer:** ReviewerDisposition has accepted, rejected and abstained literals, recorded by a UserPrincipal with reason, reviewedAt and exact ClaimEvidenceBasis digest/reference. Pending is None/not-assessed; staleness is a derived applicability state, not a disposition literal. Existing current ClaimEvidenceReview maps to accepted only when its basis and source verification are current. Existing ClaimDisposition active/rejected/superseded is lifecycle/gate state and is never automatically a human disposition. Explicit human rejection can map only with an exact review basis.

**Rationale:** Recommended: a small separate review-decision vocabulary with an adapter to existing approval. Reject active-as-accepted, stale-as-rejected and adding quarantine/exclude workflow states as truth judgments. Automation writes validator or critic provenance; it cannot mint human review.

**Reversal:** Supersede a review with another exact-basis human decision; expand vocabulary only by a dated contract revision or post-freeze migration.

### Validator score shape

**Question:** Validator score shape?

**Answer:** The field remains named validatorScore for consumer continuity but contains Option<ValidatorAssessment>: conforms Boolean from the actual complete SHACL report, severityCounts with Natural info/warning/violation counts, immutable report reference/digest, shapes digest/version, validator engine/version and claim/data snapshot basis. Counts cover the full retained report; per-claim witnesses remain addressable. A partial run, crash or unavailable validator is None/unavailable, not a nonconformance result.

**Rationale:** Recommended: structured evidence over a scalar. Reject a normalized conformance percentage, count-derived probability and confusing the paper graph-validator plausibility with SHACL. Preserve actual sh:conforms; admission policy may interpret severities separately and must not rewrite report semantics. ClaimGateResult alone lacks full report provenance, so this envelope is NET-NEW.

**Reversal:** Re-run under a new shape/engine version and append a superseding report; changing conformance/admission meaning after freeze requires migration.

### No collapsed stored score and derived ranking

**Question:** No collapsed stored score and derived ranking?

**Answer:** No aggregate confidence, reliability or ranking score is persisted on the claim or in a score cache. A derived view may recompute ranking from pinned signal assessments, explicit missingness and dependence, with a versioned ranking policy and reproducible input references. It cannot promote truth, verification, human acceptance or permission.

**Rationale:** Recommended: inspectable separate signals. Reject product/mean/max fusion as authority and copying the DocketReview score into this contract. Ranking policy is a consumer concern and changes do not overwrite assessments.

**Reversal:** Discard/recompute ranking views under a new policy; any signal meaning change requires the semantic contract process.

### OCR and reader confidence placement

**Question:** OCR and reader confidence placement?

**Answer:** OCR/reader confidence and warnings remain in extractor input provenance, linked to exact reader activity, image/artifact/text digests and engine/model identity. Do not multiply it into extractor confidence, relabel it source trust or add a sixth top-level signal.

**Rationale:** Recommended: preserve reader observation at its real stage. Reject loss of reader scores and scope expansion to a sixth signal. Parallel GPU OCR lane can supply its versioned reader artifact without changing this field set.

**Reversal:** Revise input-provenance adapter before freeze; a future sixth signal needs a separately ratified contract and migration.

### G3 freeze and contract versioning

**Question:** G3 freeze and contract versioning?

**Answer:** G3 SPEC seeds from this dated v1 ratification and binds contractVersion evidence-signals/v1 to the semantic seed, shapes, extractor/prompt and migration contract. G3 must prove synthetic fixtures for missingness, stale review, copied sources, report warnings, producer drift and as-of supersession before freeze. No goal packet is created here.

**Rationale:** Recommended: one explicit contract version and acceptance boundary. Reject silent schema edits after freeze and presenting gated M4 shapes as a ready implementation. Calibration thresholds, calibration dataset selection, storage layout and ranking algorithm remain implementation work in G3, not unresolved field-design questions.

**Reversal:** Supersede this ratification before G3 is scaffolded; after G3 freezes, change by G3 semantic migration preserving old views.

## 2026-10-09 — Ratified evidence signal field set (v1)

**Decision:** Ratify `evidence-signals/v1`, five separate typed fields on every
extracted source-local claim occurrence. Types below describe schema-fidelity
contracts; NET-NEW means implementation belongs to G3, not this docs lane.
Each field is present in the decoded claim contract as an Option; None carries
its absence reason in the claim's signal provenance. No field is silently omitted.

| Field name | Value type (building block or NET-NEW) | Producing stage | Writer and version provenance | Absence semantics | Mutability | Calibration label | Existing field mapping |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sourceTrust | Option<SourceTrustAssessmentRef> (NET-NEW); referenced SourceTrustAssessment.value uses @beep/schema/UnitInterval | Source-policy assessment before extraction or later scoped reassessment | Policy assessor principal/activity, policy version, source identity/version and predicate/domain/jurisdiction/time scope | None + not-assessed/unavailable/not-applicable/legacy-unknown; no origin-based default | Append assessment; claim pins id/version; supersede through a new event | uncalibrated policy-heuristic by default; calibrated only with declared evaluation target/method/version/artifact/population | NET-NEW; no source trust field in inspected surfaces |
| sourceAssertionConfidence | Option<SourceAssertionAssessment> (NET-NEW); value uses @beep/schema/UnitInterval | Read the source's declared assertion certainty for this claim | Source author/statement provenance plus measuring producer/activity, method/rubric version and cited expression/span basis | None when source supplies no quantifiable confidence; hedging stays in evidence unless a versioned rubric applies | Append, supersede; never substitute extractor belief | uncalibrated source-declared or rubric-derived; calibrated variant needs evidence and raw-input reference | NET-NEW; no source-assertion field in inspected surfaces |
| extractorConfidence | Option<ExtractorAssessment> (NET-NEW envelope); value uses @beep/schema/UnitInterval | Claim extraction; later calibration produces a new assessment | Extraction activity, provider/model revision, prompt digest, configuration version, exact claim/span/text basis; reader input provenance | None if producer supplies none; Some(0) only if assessed zero; required legacy span confidence does not justify fabricated metadata | Append, supersede; preserve raw assessment and basis | uncalibrated raw-self-report unless independently calibrated for declared target/population | ExtractionCandidate.confidence/GroundedExtraction.confidence, EvidenceSpan.confidence, NLP Relation.confidence only with matching basis/semantics; no fuzzy similarity mapping |
| validatorScore | Option<ValidatorAssessment> (NET-NEW), structured conforms Boolean + severityCounts Natural + reportRef/digest | Complete symbolic validation of pinned claim/data snapshot | Validator activity/engine version, shapes version/digest, data/basis digest, report artifact identity | None/unavailable for failure or incomplete run; never substitute false or zero | Append complete reports; supersede on data/shape/engine drift | not-applicable: deterministic constraint conformance, no probability | ClaimGateResult + ClaimGateViolation severity/focus/path/message supply partial adapters; full report/version envelope NET-NEW |
| reviewerDisposition | Option<ReviewerAssessment> (NET-NEW envelope); ReviewerDisposition uses NET-NEW named LiteralKit accepted/rejected/abstained | Human review of exact evidence basis | UserPrincipal reviewer, review policy version, reviewedAt, reason and ClaimEvidenceBasis reference/digest; existing disposition reference when justified | None/not-assessed means pending; abstained is Some; stale approval retains accepted history but loses current applicability | Append human decisions; supersede, never erase; staleness derived | not-applicable: decision rather than probability | Current verified ClaimEvidenceReview -> accepted; ClaimDisposition active/rejected/superseded is gate/lifecycle state, never automatic human review |

### Invariants

1. Each claim binds immutable source-local assertion identity, document/text
   versions and exact evidence spans. No cross-source fusion destroys originals.
2. Each present signal has immutable assessment identity, basis, responsible
   producer, contract version and activity/version provenance. Source trust is
   resolved from the pinned scoped reference; projecting its value never creates
   a second authoritative trust assessment.
3. Absence is Option.none with a typed reason, not zero, rejection or abstention.
   Some(0) is distinct. Failed assessment attempts are retained independently.
4. Numeric assessments label uncalibrated/calibrated status and method. A
   calibrated assessment has a target, method/version, evaluation artifact,
   population/scope, evaluation date and metrics and links its retained raw input.
   No cross-field comparability or model-self-report calibration is assumed.
5. Append and supersede assessments with separate valid and knowledge times.
   Earlier as-of views remain reproducible. Changed input, source, prompt,
   shapes, policy or review basis creates a new assessment or stale applicability.
6. Copies and mirrors do not contribute independent support. Dependent/unknown
   lineage is explicit, provenance-bearing and revisable.
7. validatorScore preserves the complete report's raw conforms and all result
   severities. severityCounts covers info/warning/violation; custom severity IRIs
   are retained with counts in a keyed extension, never dropped or mapped to zero.
   Per-claim results reference their witnesses in the report. Admission policy is
   separately versioned and cannot relabel raw conformance.
8. A human decision binds its exact basis. Pending and stale are applicability
   states; automated gate admission cannot synthesize human acceptance.
9. No collapsed score is stored on claims or in caches. Ranking is a recomputable
   derived view over pinned inputs and versioned policy, with missingness and
   dependence explicit. It is not truth, verification, review or authorization.
10. Reader/OCR confidence remains in extractor input provenance, without numeric
    multiplication or a sixth top-level signal.
11. Legacy values retain original semantics and known provenance. Missing
    historical versions are legacy-unknown; no synthetic certainty fills gaps.
12. G3 pins `evidence-signals/v1` to its semantic freeze and migration contract;
    fixture proof covers absent versus zero, copied support, stale approval,
    warning/custom-severity reports, calibration scope drift and temporal views.

**Consumer:** G3 (`oppold-corpus-semantic-ingestion-v2`) carries these fields on
every extracted claim. Its SPEC seeds from this entry and inherits these
invariants before semantic freeze. The authorized G3 MAP cross-link points here.

**Basis:** Autonomy charter, agent-decided frontier rounds, cited source/repo
research and corpus-ingestion run-order program. The operator reviews
asynchronously; no attended approval is needed for this ratification or shape.

**Reversal:** Supersede this entry with a later dated one before G3 is scaffolded;
after G3 freezes, a change is a G3 semantic migration preserving old assessment
history and reproducible old-contract views. Recompute rankings freely under a
new ranking policy without changing signal meanings.

## 2026-10-09 — Park at shape for the consumer scaffold

**Decision:** Shape is complete and accepted by the lane under the autonomy
charter and run-order authorization. Park at shape; no blocking field-design
questions remain, and no DEFERRED field-design questions remain. Calibration
experiments, thresholds, adapter/storage implementation and ranking algorithm
are scoped G3 work, not claims of proof made here.

**Re-entry trigger:** reopen at decompose when oppold-corpus-semantic-ingestion-v2 is scaffolded.

**Reversal:** Reopen with a dated decision when that trigger fires or supersede
the field set before scaffold if consumer requirements change. Do not decompose,
graduate or create a goal packet in this lane.
