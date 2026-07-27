# Cluster synthesis — Document structure, layout & legal NLP/IE

- **Date:** 2026-07-25  **Synthesist:** codex gpt-5.6-sol (max)
- **Cluster:** doc-structure-legal-nlp — 39 papers (ids listed at the end)
- **Feeds:** `goals/law-doc-structure-oa-slice`, `goals/citation-extraction-engine`, and their boundaries with `goals/citation-verified-span-substrate`, `goals/file-processing-capability`, and `goals/hybrid-retrieval-fusion-core`

## Verdict paragraph

This cluster supports keeping both current goal slices narrow, deterministic, local, versioned, and fail-closed; it does not justify replacing the Office Action rule family or the citation parity port with a layout model or generative extractor. Its material contribution is at the boundaries: exact UTF-16 source equality is necessary but verifies only one text coordinate space; scanned, graphical, tabular, and ambiguously ordered evidence also needs immutable artifact/page-region anchors and reversible OCR mappings. Physical regions, OCR, reading order, logical sections, functional roles, normalized values, and retrieval indexes must remain separately versioned, rebuildable projections under the No-Escape doctrine. Future structure should be a multi-view graph or partial order, with trees and flattened text as consumer-specific projections. Release evidence must separate component accuracy from end-to-end anchor recovery, semantic correctness, abstention, and coverage.

## Design challenges

- **A text-equal `TextAnchor` is not a complete evidence-anchor model.** **Papers:** 39933453659f — *Document Understanding Dataset and Evaluation (DUDE)*; 517d7e937747 — *A Framework for the Encoding of Multilayered Documents*; 5e23eb0e55b7 — *Data-Driven Recognition and Extraction of PDF Document Elements*; 355af156cd8c — *Robust Document Image Understanding Technologies*; bcef9525b1aa — *Digitizing, Coding, Annotating, Disseminating, and Preserving Documents*. **Strength:** strong convergence across empirical datasets, deployed systems, and preservation analysis, although none tests USPTO Office Actions. **Re-examine:** the current verified-span objective proves exactness inside a named text coordinate space, not completeness across the source artifact. Do not weaken or delay its locked `source.slice(start, end) === quote` slice; define a later typed page-region/composite-anchor extension for checkboxes, signatures, stamps, tables, image-rendered text, and OCR-only evidence.

- **“Verified span” must not be allowed to imply verified meaning, field identity, citation resolution, or claim support.** **Papers:** 3a636c39bbaa — *Kleister*; 26c14353f198 — *A Span Extraction Approach*; 39933453659f — *DUDE*; 9ffd854e6f1d — *Streamlining Legal Document Management*. Kleister’s reference values can originate outside the document, while query-conditioned exact spans prove extractiveness without proving that the selected text has the intended legal role. **Strength:** strong conceptual boundary with direct benchmark failure evidence; semantic entailment itself was not evaluated. **Re-examine:** reserve verified-anchor status for source identity, coordinates, and exact slice or region equality. Citation-form classification, target resolution, field-role correctness, and claim entailment must remain distinct typed gates. This supports the citation engine’s current separation from ground-before-cite orchestration.

- **One canonical tree and one total reading order are unsafe structural assumptions.** **Papers:** 15cb15b598de — *LATEX Rainbow*; 6d1be2ceb88a — *✂✁☎…*; 35c9b6f5e8af — *Towards a Canonical and Structured Representation*; 01ff4c639194 — *Comprehensive Document Representation*; 0bf817197a6f and b3b5679e4e77 — *Dolores*. Physical blocks and logical units have many-to-many relationships; citations, sections, tables, annotations, and rhetorical structures may overlap; independent regions may have no defensible total order. **Strength:** broad architectural agreement with some reading-order and extraction evidence, but limited legal-domain validation. **Re-examine:** treat a section tree as one versioned projection over source-anchored stand-off nodes and typed edges. Use a DAG or partial order for reading flow and retain alternative application-specific logical views.

- **The upstream extracted text is not a neutral or uniquely correct “raw source.”** **Papers:** 3a636c39bbaa — *Kleister*; 35c9b6f5e8af — *Towards a Canonical and Structured Representation*; e25f6b20b258 — *DocBed*; 15cb15b598de — *LATEX Rainbow*; 517d7e937747 — *A Framework for the Encoding of Multilayered Documents*. PDF engine choice changes downstream accuracy; visually correct PDFs can expose corrupt extracted text; compiler revisions move rendered coordinates; delivery renditions may be downsampled or lossy. **Strength:** strong for modality- and engine-dependence, including real legal documents in Kleister; no Office Action comparison exists. **Re-examine:** whether every upstream producer actually supplies the lineage already required by the Office Action SPEC: immutable parent digest, engine and transformation versions, coordinate-space contract, warnings, and mappings. A derived transcript may be an exact source for its own coordinate space, but it cannot replace the parent PDF or page image.

- **More geometry, more modalities, or more fusion do not reliably improve extraction.** **Papers:** 0a4ab229f341 — *Understanding the Logical and Semantic Structure of Large Documents*; f396503aba3a — *Position Masking*; a2aeaa8f1ec0 — *Vision and Natural Language*; e4c942f8ecd1 — *DOC LLM*; 4528245fb9e9 — *Capturing Logical Structure*; 7c09133178dc — *LAPDoc*. Text-only classification sometimes beats fused models; removing width and height explains part of a layout-model gain; late fusion regresses on individual classes; DocLLM’s selected configuration disables its advertised directional cross terms. Conversely, multimodal StructTexT decisively beats text prompting on SROIE. **Strength:** moderate, with several controlled ablations but heterogeneous tasks and datasets. **Re-examine:** any future assumption that “layout-aware” means unconditional feature fusion. Require text-only, layout-only, and fused comparisons at equal model size and context, with per-label regression gates and modality-aware routing.

- **Early hard pruning can irreversibly delete evidence that later stages cannot recover.** **Papers:** 4528245fb9e9 — *Capturing Logical Structure*; 6d1be2ceb88a — *✂✁☎…*; 26c14353f198 — *A Span Extraction Approach*; 15cb15b598de — *LATEX Rainbow*; e729be81754d — *Making Documents Work*. All-capital operative blocks were misclassified as debris; a correct reading order was removed by spatial constraints; recursive multi-span extraction can truncate after an early error; template-generated material may still be evidentiary; workflow expectations can suppress unexpected documents or facts. **Strength:** moderate but consistent system-level failure evidence. **Re-examine:** every “omitted,” debris, class filter, recursive stop, and candidate-pruning decision. Preserve the original node, alternatives, confidence, rule trace, and reason; abstain when candidate recall is uncertain.

- **Component scores and conditional accuracy can materially overstate pipeline readiness.** **Papers:** 142d0583b149 — *Performance Evaluation of Document Structure Extraction Algorithms*; e25f6b20b258 — *DocBed*; 9ffd854e6f1d — *Streamlining Legal Document Management*; 6e6a8334be80 — *Named Entity Recognition for Serbian Legal Documents*; 39933453659f — *DUDE*; 15cb15b598de — *LATEX Rainbow*. Oracle-supplied upstream regions hide propagation; layout mIoU does not predict OCR order or fidelity; high conditional correctness coexists with poor eligible-case yield; positive-only NER tests omit false-positive pressure; answer-string metrics confound serialization with comprehension; successful annotation covered only 61 of 100 sampled LaTeX papers. **Strength:** strong methodological evidence across independent evaluations. **Re-examine:** acceptance evidence for both goals. Preserve stage-local metrics, but add full-pipeline coverage, eligible/emitted/abstained/correct counts, source-anchor recovery, and document-family strata. Never report an oracle-conditioned component score as end-to-end proof.

## Direct patterns

- **Typed dual- and multi-anchor evidence.** Represent exact text evidence and visual evidence separately: immutable artifact revision, page, region or polygon, optional OCR-token IDs and offsets, coordinate-space identity, and multi-region derivation. **Sources:** 39933453659f — *DUDE*; 517d7e937747 — *A Framework for the Encoding of Multilayered Documents*; bcef9525b1aa — *Digitizing, Coding, Annotating, Disseminating, and Preserving Documents*; 15cb15b598de — *LATEX Rainbow*. **Target:** `goals/citation-verified-span-substrate`. **First step:** after the locked text-anchor slice, define fixtures for a checkbox, image-rendered word, table cell, and multi-page answer that cannot be completely represented by one character interval; use them to shape a follow-on anchor union rather than changing current P0/P1.

- **Layered, source-anchored document IR.** Keep source primitives and regions, physical grouping and reading order, logical grouping, functional/legal role, and topical or cross-reference edges as distinct views joined by stable node mappings. **Sources:** 4528245fb9e9 — *Capturing Logical Structure*; 01ff4c639194 — *Comprehensive Document Representation*; 35c9b6f5e8af — *Towards a Canonical and Structured Representation*; fccac1fd4c6d — *Integrating Natural Language Understanding with Document Structure Analysis*; 0bf817197a6f — *Dolores*. **Target:** `goals/law-doc-structure-oa-slice` and its broader exploration lineage. **First step:** create a research fixture—not a new foundation package—in which the current finality/shortened-period candidates map back to source block IDs while physical and logical parentage remain separate.

- **Error-decomposed structure evaluation.** Retain gold coverage and prediction purity separately, then classify correct, miss, false alarm, split, merge, and many-to-many outcomes. Evaluate same-paragraph, sibling, ancestor-descendant, and reading-order relations independently. **Sources:** 142d0583b149 — *Performance Evaluation of Document Structure Extraction Algorithms*; 4528245fb9e9 — *Capturing Logical Structure*. **Target:** `goals/law-doc-structure-oa-slice`. **First step:** add the raw error vector and an explicit oracle-upstream/full-pipeline label to the P0 benchmark design; keep the current atomic pair’s exact candidate/abstention result as its own metric.

- **Versioned artifact DAG with dependency-driven revalidation.** Model source artifact → rendition → OCR tokens/boxes → block and reading-order hypotheses → normalized text → extracted candidate → verified anchor. Every edge records producer, version, parameters, quality, and source mapping; corrections supersede outputs and enqueue dependents for revalidation. **Sources:** 355af156cd8c — *Robust Document Image Understanding Technologies*; 94896fbc3276 — *A machine learning pipeline for document extraction*; f1c9490e6b58 — *Integrated Text and Image Understanding*; 35c09789198c — *Machine Learning for Digital Document Processing*. **Target:** `goals/file-processing-capability`, `goals/citation-verified-span-substrate`, and `goals/epistemic-bitemporal-edge-core`. **First step:** audit the existing extraction manifest against parent digest, engine/model version, coordinate mapping, alternative hypothesis, supersession, and dependent-anchor invalidation fields.

- **Provenance-recorded adaptive parser routing.** Detect born-digital versus scanned input and structural hazards such as columns, tables, forms, and essential graphics; select native extraction, region OCR, layout processing, or image-aware escalation accordingly. Record route, engine, cost, latency, confidence, and warnings. **Sources:** 3a636c39bbaa — *Kleister*; e25f6b20b258 — *DocBed*; e65fad86b1ab — *GREYC@FinTOC-2022*; 13ef8ec4bf44 — *Optimizing PDF Ingestion*. **Target:** `goals/file-processing-capability`. **First step:** label a license-safe corpus matrix by modality and hazard, then compare existing native extraction with one OCR/layout route before selecting any new engine. This remains upstream of the current Office Action goal.

- **Evidence-bearing candidate detection → canonicalization → adjudication.** Preserve raw mention, exact anchor, normalized value, transformation, score, competing candidates, and selection rationale through every stage. Repeated fields require complete-set recall and bounded/cycle-aware decoding. **Sources:** 3a636c39bbaa — *Kleister*; 26c14353f198 — *A Span Extraction Approach*; 9ffd854e6f1d — *Streamlining Legal Document Management*. **Target:** `goals/citation-extraction-engine`. **First step:** extend stage-parity fixtures so clean/tokenize/extract/group/resolve assertions retain candidate IDs and exact anchors; normalized citation values must never become detached strings.

- **Constraint-then-rank reading flow with abstention.** Generate structurally admissible block flows, rank surviving alternatives with textual coherence, and retain a DAG or partial order rather than forcing one serialization. Log candidate counts, constraints, scores, margins, and pruning reasons. **Sources:** 6d1be2ceb88a — *✂✁☎…*; 4528245fb9e9 — *Capturing Logical Structure*; bee4a80ff68a — *Recent Work in the Document Image Decoding Group*. **Target:** a broader Office Action structure follow-on and a future structural retrieval channel. **First step:** benchmark the transition alphabet and partial-order representation offline on source-anchored page-block fixtures; do not introduce it into the current two-candidate text slice.

- **Risk/coverage and abstention accounting.** Report eligible, emitted, abstained, invalid, contradicted, and correct counts by source modality and structure class; add calibration and risk-versus-coverage where probabilistic models are used. **Sources:** 9ffd854e6f1d — *Streamlining Legal Document Management*; 39933453659f — *DUDE*; 7c09133178dc — *LAPDoc*; 7ace036bae77 — *An Integrated Approach for Automatic Semantic Structure Extraction*. **Target:** both primary goals. **First step:** freeze these denominators in P0 before selecting confidence or abstention floors, so high conditional precision cannot conceal low yield.

## Corroborations

- The current exact-source invariant is strongly corroborated. Normalization, whitespace reconstruction, OCR correction, hierarchy recovery, and canonicalization all alter or synthesize text; they are useful locators or projections, never authority (35c9b6f5e8af — *Towards a Canonical and Structured Representation*; 355af156cd8c — *Robust Document Image Understanding Technologies*).

- The current local, deterministic, no-LLM-escalation posture is appropriate for the first slices. LAPDoc invents absent fields, DocLLM’s comparisons are supervision-confounded, and several layout/fusion additions regress individual tasks (7c09133178dc — *LAPDoc*; e4c942f8ecd1 — *DOC LLM*; a2aeaa8f1ec0 — *Vision and Natural Language*).

- Typed abstention is independently supported. Hierarchical rejection, explicit unclassified states, invalid-output handling, and no-answer calibration consistently outperform forced classification as an operational design (7ace036bae77 — *An Integrated Approach*; e729be81754d — *Making Documents Work*; 39933453659f — *DUDE*).

- Stage-attributable parity is the right evaluation posture. Oracle-conditioned modules and accumulated converter errors show why one aggregate score cannot locate a failure (142d0583b149 — *Performance Evaluation*; a1932b5b9fe4 — *Reengineering PDF-Based Documents*).

- Separating generic physical extraction from Office Action-specific interpretation is well supported and matches the current package boundary and “no new foundation document-structure package” decision (0bf817197a6f and b3b5679e4e77 — *Dolores*; 35c9b6f5e8af — *Towards a Canonical and Structured Representation*).

- No-Escape is corroborated across the cluster: OCR, layout trees, embeddings, concept graphs, normalized values, and retrieval results are fallible derived products. Exact source artifacts and symbolic verification remain authoritative; fused or semantic hits remain candidates (355af156cd8c — *Robust Document Image Understanding Technologies*; d422aab67d80 — *Streamlining Legal Document Management*; 13ef8ec4bf44 — *Optimizing PDF Ingestion*).

## Delta vs the June-29 prior synthesis

- **Genuinely new:** the June-29 synthesis centered legal ontology, relators, identity, provenance, and text-grounded `EvidenceSpan`. This cluster supplies the missing document-perception substrate: page-space evidence, OCR and PDF transformation lineage, physical/logical many-to-many mappings, partial-order reading flow, multi-page and bundle structure, adaptive parser routing, and explicit component-versus-pipeline evaluation.

- **Genuinely new:** it provides a concrete evaluation vocabulary absent from the prior synthesis: gold coverage versus prediction purity; split/merge/miss/false/spurious errors; same-paragraph/sibling/ancestor relations; reading-order accuracy; eligible/emitted/abstained yield; source-region accuracy; and risk/coverage calibration.

- **Genuinely new:** several independent negative results constrain future architecture. Richer geometry can hurt; unconditional multimodal fusion can regress individual labels; pagewise maximum confidence is poorly calibrated; source markup and bookmarks fail; generic layout models transfer poorly across domain and vintage; and layout mIoU does not predict citation-quality text or order.

- **Re-confirmed:** deterministic quote-to-source alignment, immutable source identity, per-assertion provenance, stable mention/entity separation, human review, and the rule that semantic or graph representations remain rebuildable projections. The cluster strengthens these claims with document-ingestion failure evidence.

- **Re-confirmed:** the prior synthesis’s term-versus-concept and mention-versus-entity distinctions. Kleister and IDJ show that normalized strings and registry values can collapse different predicates, senses, or evidence origins.

- **Contradiction:** the prior synthesis described required character offsets plus `match_exact | match_greater | match_lesser | match_fuzzy` as the right `EvidenceSpan` substrate. The live verified-span SPEC now correctly forbids fuzzy, case-folded, or lesser-match authorization, and this cluster reinforces that correction. Non-exact statuses may remain locator diagnostics, but only exact raw equality—or a separately verified page-region contract—can authorize evidence.

- **Contradiction:** the prior synthesis treated a half-open character span as broadly sufficient. This cluster shows it is sufficient only for text-bearing evidence in a named coordinate space. It cannot completely represent checkboxes, signatures, stamps, diagrams, blank table cells, image-rendered words, or facts established by spatial arrangement.

- **Contradiction:** the prior synthesis’s strongest “SHACL conformance counts as an admissible claim” formulation is too strong if conformance means only shape validity and presence of a grounded quote. This cluster repeatedly shows that exact location, normalized value match, field-role correctness, target resolution, and claim support are different questions. The prior document itself acknowledged that the existing gate lacked normative content; the cluster makes that limitation load-bearing.

- **Contradiction requiring a terminology correction:** the prior roadmap called Oxigraph the “OWL source of truth.” Under No-Escape and this cluster, an ontology store may be authoritative for a controlled vocabulary or schema projection, but an extracted semantic graph cannot be documentary or evidentiary authority. Source bytes and exact records remain authority; OWL/Cypher structures are rebuildable views.

This delta addresses the prior synthesis’s conceptual recommendations only and does not rely on its separately audited code examples.

## Tensions & contradictions

- **Joint multimodal reasoning versus staged separability.** f1c9490e6b58 — *Integrated Text and Image Understanding* argues for intertwined processing, while Dolores, Xed, and the current repo contracts separate physical extraction from logical interpretation. Adjudicate by separating data authority and provenance even when one model jointly scores modalities: joint computation is compatible with versioned stage outputs and explicit mappings.

- **Tree reconstruction versus overlapping graph structure.** 4528245fb9e9 — *Capturing Logical Structure* obtains useful tree metrics, while 15cb15b598de — *LATEX Rainbow* and 6d1be2ceb88a — *✂✁☎…* reject a sole tree or total order. Use trees for queryable section projections; retain stand-off spans, typed cross-links, and partial-order edges underneath.

- **Canonical normalized representation versus preserved uncertainty.** Xed seeks a canonical PDF representation; Kleister normalizes document-level values; robust OCR work argues for alternative hypotheses and dependency-aware correction. Adjudicate with one immutable source plus any number of versioned normalized views. “Canonical” may describe an interchange shape, never unique documentary truth.

- **Layout-aware processing versus text-only processing.** Layout improves many tasks and multimodal StructTexT dominates LAPDoc on SROIE, but text-only and feature-removal ablations sometimes win. Adjudicate by source modality, field class, and equal-budget ablation rather than one global architecture.

- **Early deterministic constraints versus candidate recall.** Transition rules and spatial constraints efficiently reduce search, but can remove the only correct candidate. Require recall-preserving component tests, logged pruning, and abstention when no defensible candidate survives; a later ranker cannot repair upstream exclusion.

- **Human correction as mutable learning versus append-only history.** Dolores, DOMINUS, IDJ, and AGATHE reuse corrections, sometimes by replacing theories or RDF triples. Under No-Escape and the repo’s bitemporal commitments, corrections must append new events, preserve superseded outputs, validate revisions offline, and promote versions atomically.

- **Document-derived labels versus external registry truth.** Kleister’s Charity values sometimes came from external registries and were absent from reports. Adjudicate with separate evidence states—document span, external metadata, inferred, contradicted, and missing—rather than merging them into one gold value.

## Routing suggestions

All routes below are suggestions only; none was executed.

| Insight | Route | Rationale |
|---|---|---|
| Typed page-region and composite evidence anchors | extend `goals/citation-verified-span-substrate` after its locked text-anchor slice | Preserves the exact UTF-16 invariant while covering non-text and OCR-only evidence without broadening current P0/P1. |
| OCR/layout derivation DAG, coordinate mappings, alternatives, and parser-route audit | extend `goals/file-processing-capability` | That goal already owns generic extraction IR, strategies, engines, renditions, spans, warnings, and future OCR; legal semantics should remain outside it. |
| Error-decomposed, document-disjoint, eligible/emitted/abstained scorecard for the atomic pair | attach-to `goals/law-doc-structure-oa-slice` | Strengthens P0 evidence without introducing a layout engine, another rule family, or an ML path. |
| Per-stage candidate identity, normalization provenance, and separation of anchor verification from citation resolution | attach-to `goals/citation-extraction-engine` | Directly sharpens its existing clean/tokenize/extract/group/resolve parity contract and avoids detached normalized citations. |
| Structural rank channel over section paths, partial-order adjacency, and resolved cross-references | extend `explorations/rag-retrieval-projection` | The current fusion core intentionally accepts ranked channels but does not own their producers; structural retrieval needs its own shaped producer contract. |
| Multi-view Office Action page structure and reading-order benchmark | new-exploration `office-action-layout-evidence-benchmark` | Layout/OCR engine selection is explicitly outside the current Office Action goal, yet legal-domain fixtures are required before a later production design can be justified. |
| Append-only OCR/structure correction and dependent-anchor revalidation | extend `goals/epistemic-bitemporal-edge-core` | Corrections are knowledge-time events that supersede interpretations and trigger rebuilds; they must not mutate source artifacts or erase prior anchor decisions. |
| Alternative logical trees and partial-order structure over shared physical nodes | extend `explorations/deterministic-doc-structure-extraction` | The existing exploration is the correct provenance home for broader structure research while its graduated goal remains intentionally narrow. |

## Quality notes

- The tier distribution is 3 gold, 35 silver, and 1 bronze. The load-bearing claims therefore rest mainly on convergence across moderate studies rather than decisive modern legal benchmarks.

- No paper evaluates USPTO Office Actions, the paired finality/shortened-period rule, eyecite parity, 35 U.S.C./37 C.F.R. citation forms, or the repo’s exact verified-anchor contract. Transfer to those tasks is unverified.

- The 39 note IDs are not 39 fully independent evidentiary units. There are duplicate or closely overlapping publication lineages for IDJ (9ffd854e6f1d, d422aab67d80), Dolores (0bf817197a6f, b3b5679e4e77), DocPro (d35e1665176d, 145a460064d8), and IDUS (fccac1fd4c6d, f1c9490e6b58). Their repeated claims should not be counted as independent replication.

- Much of the strongest architectural material is from 2001–2009. Its source/derivation, uncertainty, partial-order, and evaluation lessons remain durable; its OCR accuracy, model choice, latency, and cost figures are stale.

- Legal evidence is narrow. Kleister is highly relevant but lacks grounded gold spans and sometimes uses external labels. IDJ covers small Italian court samples with incomplete extraction. The Serbian NER study excludes entity-free sentences and may leak boilerplate. None establishes Office Action generalization.

- Several papers under-delivered against their framing: DocLLM’s selected configuration disables advertised cross-modal terms; DocBed’s downstream test has 15 pages and an internal read-order inconsistency; LATEX Rainbow succeeds on only 61% of its sample with κ=0.32; 9ff4a158746a reports an undefined 96% result; 94896fbc3276 supplies almost no quantitative validation; both DocPro notes are conceptual only; Xed’s unique canonical representation is unproven; and Dolores’s “class-free” framing conflicts with its class-specific transformation requirement.

- Many high scores arise from synthetic templates, random rather than template-held-out splits, tiny private datasets, balanced line samples, positive-only sentences, oracle upstream regions, or classification of already-correctly-localized elements. These numbers should not be used for capacity planning or acceptance floors.

- Retrieval evidence is especially weak. The older fuzzy-retrieval result offers high recall at roughly 30% true hits, and several papers merely propose structural retrieval without measuring it. Structural signals should enter as candidate channels with diagnostics, never as authority or fixed weighting evidence.

## Papers in this cluster

- 26c14353f198 — A Span Extraction Approach for Information Extraction on — silver
- 4528245fb9e9 — Capturing Logical Structure of Visually Structured Documents with — gold
- e4c942f8ecd1 — DOC LLM: A LAYOUT-AWARE GENERATIVE LANGUAGE MODEL FOR MULTIMODAL — silver
- fccac1fd4c6d — Integrating Natural Language Understanding with Document Structure Analysis — silver
- 3a636c39bbaa — Kleister: A novel task for Information Extraction involving — gold
- 35c9b6f5e8af — Towards a Canonical and Structured Representation of PDF Documents — silver
- 0a4ab229f341 — Understanding the Logical and Semantic Structure of Large Documents — silver
- 39933453659f — Document Understanding Dataset and Evaluation (DUDE) — silver
- 9ffd854e6f1d — Streamlining Legal Document Management: A Knowledge‑Driven Service Platform — silver
- 01ff4c639194 — Comprehensive Document Representation — silver
- 5e23eb0e55b7 — Data-Driven Recognition and Extraction of PDF Document Elements — silver
- e25f6b20b258 — DocBed: A Multi-Stage OCR Solution for Documents with — silver
- 15cb15b598de — LATEX Rainbow: Universal LATEX to PDF Document Semantic — silver
- 142d0583b149 — Performance Evaluation of Document Structure Extraction Algorithms — silver
- 7c09133178dc — LAPDoc: Layout-Aware Prompting for Documents — silver
- f396503aba3a — Position Masking for Improved Layout-Aware Document Understanding — silver
- 6e6a8334be80 — Named Entity Recognition for Serbian Legal Documents: Design — silver
- f1c9490e6b58 — Integrated Text and Image Understanding for D o c u m e n t Understanding — silver
- 35c09789198c — Machine Learning for Digital Document Processing: From Layout Analysis — silver
- 13ef8ec4bf44 — OPTIMIZING PDF INGESTION FOR LARGE LANGUAGE MODELS IN — silver
- a1932b5b9fe4 — Reengineering PDF-Based Documents Targeting Complex Software Specifications* — silver
- 355af156cd8c — Robust Document Image Understanding Technologies — gold
- 94896fbc3276 — A machine learning pipeline for document extraction — silver
- e65fad86b1ab — GREYC@FinTOC-2022: Handling Document Layout and Structure in Native — silver
- 6d1be2ceb88a — ✂✁☎✄✝✆✟✞✡✠☞☛✍✌✝✎✑✏✓✒✔✞✕✎✖✒✔✏✑✗✙✘✚✗✛✎✖✗✜✞✕✎✓✆✢✁☞✣ ✤✥✁☞✏ — silver
- 517d7e937747 — A Framework for the Encoding of Multilayered Documents — silver
- 7ace036bae77 — An Integrated Approach for Automatic Semantic Structure Extraction — silver
- 0bf817197a6f — Dolores: An Interactive and Class-Free Approach for Document — silver
- b3b5679e4e77 — Dolores: An Interactive and Class-Free Approach for Document — silver
- e729be81754d — Making Documents Work: Challenges for Document Understanding — silver
- a2aeaa8f1ec0 — Vision and Natural Language for Metadata Extraction from — silver
- d35e1665176d — DocPro: A Framework for Processing Semantic and Layout — silver
- d422aab67d80 — Streamlining Legal Document Management: A Knowledge-Driven Service Platform — silver
- bee4a80ff68a — Recent Work in the Document Image Decoding Group — silver
- 145a460064d8 — DOCPRO: A FRAMEWORK FOR BUILDING DOCUMENT PROCESSING SYSTEMS — silver
- d1073b1851c7 — Collecte d’information sur domaines restreints du web à — silver
- b32f8852d157 — An Augmentation Strategy for Visually Rich Documents — silver
- 9ff4a158746a — Document Understanding: Problems and Technological Solutions — bronze
- bcef9525b1aa — Digitizing, Coding, Annotating, Disseminating, and Preserving Documents — silver
