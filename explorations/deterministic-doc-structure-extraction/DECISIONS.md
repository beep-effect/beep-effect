# Deterministic Doc-Structure Extraction — Decisions

All decisions below closed at the 2026-07-14 align gate. `LOCKED` means the
shape pass must carry the answer forward without reopening it.

## 2026-08-13 — Packet graduation and re-entry

**Decision:** Close the packet as `graduated`. The four gated MAP rows remain
re-entry points; acceptance of the `law-doc-structure-oa-slice` first slice
reopens the packet at `decompose` under the repository convention.

## 2026-07-14 — Q1 LOCKED: What does this packet own?

**Question:** Which document-recognition concerns belong here, and which are
consumed from neighboring packets?

**Answer:** This packet owns versioned deterministic recognition of
**non-citation legal document structure** and conversion of recognized raw
spans into evidence-backed candidates for real consumers. Office-action
structure is first; defined terms, amendments, parties, and contract structure
enter only when the approved appetite names them. It consumes:

- [`goals/citation-verified-span-substrate`](../../goals/citation-verified-span-substrate/README.md)
  for raw anchors, normalization maps, half-open UTF-16 offsets, ambiguity,
  drift, and straddle;
- the queued Effect-native citation engine from
  [`citation-grounding-hallucination-guard`](../citation-grounding-hallucination-guard/DECISIONS.md#q1-locked-build-or-adopt-the-citation-extraction-engine)
  for every legal citation;
- [`goals/file-processing-capability`](../../goals/file-processing-capability/README.md)
  for PDF/OCR/layout text production and engine selection;
- [`goals/pandoc-ast-foundation`](../../goals/pandoc-ast-foundation/README.md)
  for structural input; and
- existing epistemic admission contracts unchanged.

**Rationale:** Legal document structures are product language, while verified
anchoring, file conversion, generic ASTs, and admission are reusable substrate.
This boundary gives one owner to each concern and prevents two citation
hierarchies. It overrides the 2026-06-29 pre-draft, which mixed legal entities,
generic anchoring, streaming, and citation work into this packet.

**Rejected:** Own citation parsing; own PDF/OCR engine selection; change the
epistemic admission model; make all legal entity graphs or streaming part of
this packet.

## 2026-07-14 — Q2 LOCKED: What is the first vertical slice?

**Question:** What is the smallest end-to-end rule that proves useful legal
structure extraction?

**Answer:** On one fixture-backed office action, extract both the
`ACTION-FINALITY` declaration (`NON-FINAL` or `FINAL`) and its `SHORTENED
STATUTORY PERIOD` block. Carry the exact raw span through the shared verified
anchor contract and emit evidence-backed candidates at the docketing intake
seam owned by
[`goals/law-docketing-patent-spine`](../../goals/law-docketing-patent-spine/README.md).
Fail closed on absent, duplicate, stale, malformed, or unverifiable input.
Consume `GroundedExtraction[]`, or an equally span-preserving array, and never
`AnnotatedDocument` as the evidence boundary.

Execution is blocked on P0/P1 of
[`citation-verified-span-substrate`](../../goals/citation-verified-span-substrate/PLAN.md),
which must first freeze and implement the verified-anchor contract. The
docketing goal's manifest currently lists only M365 and reliability
dependencies; graduation from this exploration must add this explicit
cross-packet consumer edge.

**Rationale:** Finality and the shortened statutory period are the two facts
the deadline-rules module directly consumes. This slice proves recognition,
raw-span verification, typed abstention, and a real product seam without
inventing a generic graph handoff. It inherits the citation-grounding decision
to use direct span-bearing input and exact raw-slice proof
([Q3](../citation-grounding-hallucination-guard/DECISIONS.md#q3-locked-what-is-the-first-vertical-slice),
[Q7](../citation-grounding-hallucination-guard/DECISIONS.md#q7-locked-what-counts-as-verbatim-grounding)).

**Rejected:** Start with citations; start with a broad entity catalog; use
`AnnotatedDocument`; emit unverified candidates; build streaming first.

## 2026-07-14 — Q3 LOCKED: Where does the capability live?

**Question:** Which package families own patterns, ports, workflows, and
integration?

**Answer:** Law-practice owns the capability:

- pure legal patterns, extractor versions, and candidate values in
  `packages/law-practice/domain`;
- extraction ports and candidate workflows in
  `packages/law-practice/use-cases`;
- composition, persistence, and docketing integration in
  `packages/law-practice/server`;
- generic provenance, langextract, and modeling/NLP bricks in foundation; and
- external PDF engines under `packages/drivers/*`.

The live NLP modeling path is `packages/foundation/modeling/nlp`.

**Rationale:** Office-action and contract structures are legal product
language, not a product-neutral foundation capability. This overturns the
pre-draft's proposed `packages/foundation/capability/doc-structure` sibling and
its stale `@beep/nlp` path. It is consistent with the citation program's locked
placement of generic anchors in provenance/langextract and legal vocabulary in
law-practice
([Q5](../citation-grounding-hallucination-guard/DECISIONS.md#q5-locked-where-do-the-capabilities-live)).

**Rejected:** Create a new foundation doc-structure package; put legal regexes
inside langextract or modeling/NLP; put external engines in law-practice.

## 2026-07-14 — Q4 LOCKED: How are citations handled?

**Question:** Should this packet adopt `eyecite-js`, build citation patterns,
or consume the citation program?

**Answer:** Consume the citation-grounding lane's queued Effect-native engine.
Add no `eyecite-js` dependency and no second citation hierarchy. `eyecite`,
`eyecite-js`, `courts-db`, and `reporters-db` remain licensed parity/reference
corpora only, under the dispositions recorded by their owning source ledger.

**Rationale:** The binding citation decision is an Effect-native port over the
existing law-practice citation values
([citation Q1](../citation-grounding-hallucination-guard/DECISIONS.md#q1-locked-build-or-adopt-the-citation-extraction-engine)).
That 2026-07-14 user override fully supersedes this packet's 2026-06-29
pre-draft recommendation to adopt `eyecite-js`.

**Rejected:** Depend on `eyecite-js`; re-port citations in this packet; create
parallel citation models; use a hosted parser as grounding truth.

## 2026-07-14 — Q5 LOCKED: What is the court-PDF boundary?

**Question:** Does this packet select a court-PDF/layout engine or recognize
layout-dependent structures now?

**Answer:** Route court-PDF work entirely to
[`goals/file-processing-capability`](../../goals/file-processing-capability/README.md)'s
deferred layout/OCR lane. This packet specifies only the input contract:
identified extracted text, stable source-coordinate provenance, and typed
quality warnings. Captions, header stamps, and other court-PDF structural
features wait for that lane's layout spike, including any Poppler-sidecar
decision.

**Rationale:** Text production, OCR, layout coordinates, quality diagnosis,
and engine selection must be decided together by the file-processing owner.
Offsets from layout/OCR-derived text cannot authorize a candidate until their
lineage and quality status satisfy the source-artifact contract.

**Rejected:** Pick PDFBox, pdf.js, Poppler, Docling, or Tika here; parse caption
alignment or header stamps from unqualified text; duplicate the layout spike.

## 2026-07-14 — Q6 LOCKED: What confidence type crosses boundaries?

**Question:** Which confidence schema is canonical, and does this packet clean
up all existing copies?

**Answer:** Use branded `@beep/schema/UnitInterval` at every verified-evidence
and admission boundary. Add explicit adapters at this packet's boundaries.
Absorb no repo-wide cleanup. The unbranded modeling/NLP copy is repaired by
its owner; `CitationBase`'s loose `S.Finite` confidence is repaired by the
citation-engine goal. Hand-authored scores are explicitly non-calibrated
priors.

**Rationale:** Boundary decoding prevents structurally similar but
non-identical confidence schemas from leaking into evidence. Owner-routed
cleanup keeps the first slice narrow while leaving no ambiguity about the
canonical type.

**Rejected:** Treat all finite numbers as confidence; silently cast existing
values; make this packet a repo-wide confidence migration; claim priors are
calibrated probabilities.

## 2026-07-14 — Q7 LOCKED: Is streaming in scope?

**Question:** Does a `Partial`/`Complete` stream belong in this packet's first
program?

**Answer:** No. Streaming is deferred because there is no named product
consumer. Preserve this doctrine for a future follow-on: `Complete` is a new,
schema-backed, span-preserving contract carrying source identity/digest,
document id, raw-text reference, direct verified extractions, and diagnostics.
It is never `LangExtractResult` verbatim and never `AnnotatedDocument`.
`Partial` is presentation-only, never persisted and never authoritative.
`Complete` means extraction finished, not admitted or approved.

**Rationale:** A consumerless stream would freeze the wrong payload. Direct
verified extractions and source identity are the minimum future authority
handoff. This overturns the 2026-06-29 pre-draft's recommendation to carry
`LangExtractResult` verbatim and resolves the packet's earlier deferred
streaming conflict without reopening langextract V1.

**Rejected:** Stream in V1; persist partials; equate complete with admission;
carry `LangExtractResult` or `AnnotatedDocument` as the future authority
boundary.

## 2026-07-14 — Q8 LOCKED: What is the cascade policy?

**Question:** When may deterministic extraction escalate to an LLM, and how
does V1 fail?

**Answer:** V1 fails closed with typed abstention codes: `absent`, `ambiguous`,
`unsupported`, `low-quality-source`, and `rule-not-covered`. LLM refinement is
a later, local, privilege-approved path, gated on per-family thresholds
validated against labeled candidate outcomes. A regex returning no match is
never an escalation trigger.

**Rationale:** Absence and unsupported rule coverage are evidence states, not
permission to guess. Calibration requires labeled outcomes per rule family;
until those exist, a confidence-like literal is only a non-calibrated prior.

**Rejected:** Escalate on empty regex output; use a hosted LLM on privileged
text; tune thresholds without labeled outcomes; return a guessed candidate.

## 2026-07-14 — DEFERRED: Streaming follow-on

**Question:** When should a streaming product surface be shaped?

**Answer:** Defer until a named consumer exists. The future packet inherits the
Q7 `Partial`/`Complete` payload doctrine in full.

**Rationale:** The doctrine prevents evidence loss now; a concrete consumer is
needed to justify transport, backpressure, cancellation, and UI semantics.

**Rejected now:** A speculative stream API or a `LangExtractResult` wrapper.

## 2026-07-14 — DEFERRED: Calibration spike

**Question:** When should priors and cascade thresholds be calibrated?

**Answer:** Defer until labeled candidate outcomes exist for each rule family.
Then run a calibration spike before enabling any LLM refinement threshold.

**Rationale:** Global or hand-authored thresholds cannot establish per-family
precision. V1 retains typed abstention and labels scores as non-calibrated.

**Rejected now:** Treat regex strength as probability; one threshold for every
family; use extraction absence as the escalation policy.

## 2026-07-14 — DEFERRED: Court-PDF structural features

**Question:** When may captions, header stamps, and layout-dependent legal
structures enter this capability?

**Answer:** Defer until file-processing completes its layout/OCR spike and can
provide identified text, stable source-coordinate lineage, typed quality
warnings, and an engine decision.

**Rationale:** Without that contract, layout-derived offsets cannot satisfy
raw-slice verification and must not authorize docketing candidates.

**Rejected now:** Infer layout from flattened text or select a PDF engine here.
