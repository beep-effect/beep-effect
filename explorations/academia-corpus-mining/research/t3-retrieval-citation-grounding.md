# Cluster synthesis — Retrieval, RAG & citation grounding

- **Date:** 2026-07-25  **Synthesist:** codex gpt-5.6-sol (max)
- **Cluster:** retrieval-citation-grounding — 10 papers (ids listed at the end)
- **Feeds:** `goals/hybrid-retrieval-fusion-core`, `goals/citation-verified-span-substrate`, `goals/citation-extraction-engine`, `docs/product/citation-grounding.md`

## Verdict paragraph

This cluster validates the repo’s candidate-first architecture while narrowing what “verified” may mean. Hybrid retrieval can propose span-bearing candidates, and exact source anchoring can prove which text would be emitted; neither ranking, lexical overlap, model rationale, source consensus, nor colocated answer text proves that a proposition is supported, globally true, or currently authoritative law. The next gap is therefore not in the deliberately narrow verified-span substrate: it is a follow-on, qualifier-aware claim-to-evidence assessment layer between exact anchors and legal admission, with per-span `supports | refutes | insufficient-evidence` judgments kept distinct from authority, temporal validity, and attorney approval. Retrieval itself needs no-evidence/retrieved/oracle comparisons, noisy-context and unseen-evidence slices, natural counterevidence, abstention, and relation/layout complexity tests. No paper escapes the No-Escape doctrine; their failures instead corroborate it. Semantic, graph, and learned channels remain suggestion mechanisms subordinate to exact episodic records and external verification.

## Design challenges

1. **A verified span is not a verified proposition, and source support is not global truth.**

   - **Claim:** Exact raw-slice equality proves quotation and locator fidelity only. `0421a1687b40` (ProVe) explicitly verifies whether one source supports a triple rather than whether the triple is true. `d81e86e1d786` (IntKB) treats answer-string co-occurrence as “verifiable” without testing relational entailment. `ba0c4177bb61` (Check Your Facts and Try Again) mainly measures evidence-token overlap. `1a72f7ffcd1c` (KGValidator) produces plausible reasons that can contradict its own verdict.
   - **Evidence strength:** Strong architectural evidence from four implemented systems, led by the cluster’s only gold paper; legal-domain transfer remains untested.
   - **Re-examine:** Preserve the current exact `TextAnchor` contract, but stop the word “verified” from leaking across layers. Distinguish at least anchor fidelity, claim-to-span stance, aggregation, source authority/currentness, and human admission. Generated explanations must never become evidence.

2. **Qualifier-free claim identity makes verification unsound.**

   - **Claim:** `0421a1687b40` (ProVe) shows that dropping qualifiers can collapse temporally or contextually distinct assertions into the same verifier input. `8872b8387074` (Artificial Intelligence and Legal Discourse) treats doctrine as changing, jurisdictionally situated material, while `a162c3d0158f` (Towards Knowledge Graphs Validation through Weighted Knowledge Sources) admits that its validator handles only static attributes.
   - **Evidence strength:** Moderate-to-strong: one directly diagnosed system failure plus independent legal and source-validation arguments.
   - **Re-examine:** Canonical assertion identity must include applicable dates, jurisdiction, procedural posture, actor role, polarity, and scope before verbalization or evidence comparison. This should be a follow-on consumer of verified spans, not scope added to the current substrate.

3. **Typed output and structural conformance validate shape, not semantic consistency.**

   - **Claim:** `1a72f7ffcd1c` (KGValidator) emitted a valid typed decision whose rationale contradicted it. `036015670131` (Enhancing Knowledge Graph Consistency) constrained answers but still achieved only modest, context-sensitive results. `d81e86e1d786` (IntKB) attached sentences without testing whether they entailed the proposed relation.
   - **Evidence strength:** Moderate, with direct failure examples and held-out classification results, but no legal evaluation.
   - **Re-examine:** Schema decoding, SHACL conformance, and evidence `minCount` cannot by themselves establish semantic support. This directly challenges the June-29 synthesis’s stronger description of grounded-quote conformance as an admissibility fact. Retain rejection-as-value and ClaimGate, but add an explicit support rule rather than interpreting structural validity as entailment.

4. **Additional context—and exact-literal priority—does not monotonically improve relevance.**

   - **Claim:** `05afbbf3e1e9` (Should We Fine-Tune or RAG?) found retrieved and even oracle context harmful in some tasks. `ba0c4177bb61` (Check Your Facts and Try Again) found always-retrieve best on its overlap metric, exposing a task-and-metric dependency rather than a universal rule. `d81e86e1d786` (IntKB) found more than 60% of extracted spans entity-ambiguous.
   - **Evidence strength:** Moderate: controlled ablations demonstrate the failure mechanism, but the workloads are dialogue and Wikipedia rather than legal citation.
   - **Re-examine:** The hybrid core’s locked literal tier is safe only because its output remains a candidate packet. Add wrong-entity, exact-but-irrelevant, co-occurrence-only, and noisy-context fixtures around the downstream boundary; exact matches must still be rejectable by a relevance or support gate, with no-context and abstention paths available.

5. **Fusion scores and source consensus are not confidence, authority, or correctness.**

   - **Claim:** `71d075974a2f` (Measuring Accuracy of Triples in Knowledge Graphs) reports high consensus-validation F1 only on two date predicates and does not model source independence. `a162c3d0158f` (Towards Knowledge Graphs Validation through Weighted Knowledge Sources) applies subjective global source weights despite property-dependent source performance. `0421a1687b40` (ProVe) also shows that learned aggregation can conceal weak passage-level stance classification.
   - **Evidence strength:** Moderate for the hazard; weak for any proposed scoring replacement because both consensus studies are narrow.
   - **Re-examine:** RRF contributions must remain rank arithmetic, never a `Confidence` or authority score. Any later reliability policy should be field-, jurisdiction-, time-, and provenance-conditioned, expose source dependence, and remain a rebuildable assessment over exact records.

6. **Synthetic negatives and aggregate metrics conceal the failures legal grounding most needs to detect.**

   - **Claim:** `0421a1687b40` (ProVe) found FEVER refutations unlike naturally conflicting KG values and had only two end-to-end refuting examples. `d81e86e1d786` (IntKB) manufactured negatives by deleting answer-bearing text. `05afbbf3e1e9` (Should We Fine-Tune or RAG?) found 82% train/test document overlap distorting aggregate results. `036015670131` (Enhancing Knowledge Graph Consistency) found degradation in entity-dense passages, while `2cbbc764e376` (Semantic-Based Access to Digital Document Databases) showed strong template-family effects.
   - **Evidence strength:** Strong methodological triangulation across independent systems, though the exact legal hard set remains to be built.
   - **Re-examine:** Deterministic acceptance tests for fusion math and span fidelity must not be presented as retrieval-quality proof. A separate benchmark should distinguish natural absence, contradiction, qualifier changes, superseded authority, entity ambiguity, high-entity passages, tables, and layout families, with seen and genuinely unseen evidence reported separately.

7. **Algorithm channels alone do not represent the legal and structural axes that govern relevance.**

   - **Claim:** `8872b8387074` (Artificial Intelligence and Legal Discourse) separates doctrine, facts, cited cases, and cited statutes. `2cbbc764e376` (Semantic-Based Access to Digital Document Databases) uses containment and spatial relations. `1a72f7ffcd1c` (KGValidator) and `036015670131` (Enhancing Knowledge Graph Consistency) show relation- and domain-dependent validation performance.
   - **Evidence strength:** Moderate: the studies are narrow or old, but their independent failure patterns converge.
   - **Re-examine:** Semantic/lexical/literal/graph identifies retrieval mechanisms; legal field, relation family, document role, and layout are orthogonal dimensions. Keep the current deterministic first slice intact, but design follow-on producers and evaluations so those dimensions remain inspectable rather than flattened into one opaque score.

## Direct patterns

1. **Layered assertion-to-verdict envelope**

   - **What:** `QualifierCompleteAssertion → anchored candidates → relevance → per-span stance → derived aggregate → reviewer decision`. Every stage retains source/version, exact span IDs, model or rule version, scores, and failure outcomes.
   - **Sources:** `0421a1687b40` (ProVe), `1a72f7ffcd1c` (KGValidator), `036015670131` (Enhancing Knowledge Graph Consistency), `d81e86e1d786` (IntKB).
   - **Target stream:** Verified-span consumers and ground-before-cite integration.
   - **Concrete first step:** Specify a fixture-only follow-on contract with supported, refuted, insufficient-evidence, and qualifier-mismatch cases. Do not widen `goals/citation-verified-span-substrate`, whose exact-anchor scope is correctly narrower.

2. **No-evidence/retrieved/oracle evaluation with contamination controls**

   - **What:** Evaluate the same query under no evidence, retrieved evidence, and oracle evidence; add deliberately noisy evidence and partition results by evidence identity seen or unseen during adaptation.
   - **Sources:** `05afbbf3e1e9` (Should We Fine-Tune or RAG?), `ba0c4177bb61` (Check Your Facts and Try Again).
   - **Target stream:** `goals/hybrid-retrieval-fusion-core` and its retrieval follow-ons.
   - **Concrete first step:** Add a benchmark specification that reports exact-span and parent-region recall, retrieved-to-oracle gap, unsupported-context rejection, latency, and abstention. Do not use KF1, perplexity, or overlap as an acceptance gate.

3. **Hierarchical, fielded, layout-aware retrieval**

   - **What:** Preserve doctrine, factual narrative, case authority, and statutory authority as inspectable fields; combine them with page/region containment, adjacency, alignment, overlap, and document-role signals. Score retrieval at exact span, enclosing region, and document levels.
   - **Sources:** `8872b8387074` (Artificial Intelligence and Legal Discourse), `2cbbc764e376` (Semantic-Based Access to Digital Document Databases), `05afbbf3e1e9` (Should We Fine-Tune or RAG?).
   - **Target stream:** Hybrid retrieval and `goals/law-doc-structure-oa-slice`.
   - **Concrete first step:** Annotate a small office-action fixture set with the four legal fields and structural parent relations, then benchmark flat channels against fielded/structural ranked inputs while preserving every candidate’s existing `TextAnchor`.

4. **Natural counterevidence and calibrated abstention**

   - **What:** Make `SUPPORTED`, `REFUTED`, and `INSUFFICIENT_EVIDENCE` distinct outcomes; evaluate selective precision, recall, coverage, and refutation separately. Natural negatives should include changed dates, amounts, parties, status, jurisdiction, and scope.
   - **Sources:** `0421a1687b40` (ProVe), `d81e86e1d786` (IntKB), `1a72f7ffcd1c` (KGValidator), `036015670131` (Enhancing Knowledge Graph Consistency).
   - **Target stream:** Citation extraction’s negative-attempt boundary and the later ground-before-cite verifier.
   - **Concrete first step:** Add natural answer-absent and contradictory fixtures alongside `NO_CITATION`, while keeping “no citation was parsed” distinct from “a claim lacks sufficient supporting evidence.”

5. **Stage-attributable citation identity resolution**

   - **What:** Detect surface forms, preserve exact source spans, generate stable identity candidates, resolve full and shortened references, and retain ambiguity rather than folding on labels.
   - **Sources:** `8872b8387074` (Artificial Intelligence and Legal Discourse), `d81e86e1d786` (IntKB).
   - **Target stream:** `goals/citation-extraction-engine` and `goals/identity-iri-fold`.
   - **Concrete first step:** Ensure the existing full/short/Id./supra parity fixtures assert original surface form, exact verified anchor, stable vocabulary ID when resolved, and a durable ambiguous/unresolved outcome.

6. **Evidence consolidation as a reversible projection**

   - **What:** Build multi-span or multi-document evidence chains after retrieval, but retain every contributing exact anchor, rank, and derivation. Consolidation may aid generation; it must never replace source records.
   - **Sources:** `ba0c4177bb61` (Check Your Facts and Try Again), `0421a1687b40` (ProVe).
   - **Target stream:** Hybrid retrieval follow-ons; consolidation remains outside the current fusion goal’s non-goals.
   - **Concrete first step:** Compare raw top-k candidates with a consolidated-chain branch on the same fixtures, measuring claim support and cost while proving lossless trace-back to each source span.

7. **Transparent per-source comparison matrix**

   - **What:** For each candidate assertion, expose every supporting or conflicting source, exact record or span, normalized comparison value, entity-match decision, and derived score. Keep the aggregate explicitly non-authoritative.
   - **Sources:** `71d075974a2f` (Measuring Accuracy of Triples in Knowledge Graphs), `a162c3d0158f` (Towards Knowledge Graphs Validation through Weighted Knowledge Sources).
   - **Target stream:** Citation evidence views and `goals/epistemic-bitemporal-edge-core`.
   - **Concrete first step:** Define a fixture schema that can recompute an assessment after a source, mapping, or weight-policy version changes without mutating the underlying assertion or evidence.

## Corroborations

- The No-Escape doctrine is independently reinforced: every semantic or learned system exhibits domain, density, ambiguity, noise, or metric-dependent failure. None earns source-of-truth status.
- The hybrid fusion core is correctly candidate-only, span-preserving, and subordinate to ClaimGate. This cluster supports exposed channel contributions but does not validate the particular RRF constant, weight choices, or literal floor.
- The verified-span substrate is materially stricter than every paper: exact raw equality, source digest/version, deterministic ambiguity handling, and closed failure are justified by the papers’ missing-offset and stale-context hazards.
- Stage-attributable citation extraction is corroborated by the modular pipelines in `0421a1687b40` (ProVe) and `8872b8387074` (Artificial Intelligence and Legal Discourse).
- `NO_CITATION`, abstention, and reviewable rejection are preferable to forced output, corroborated by `d81e86e1d786` (IntKB), `1a72f7ffcd1c` (KGValidator), and `036015670131` (Enhancing Knowledge Graph Consistency).
- Keeping mentions, labels, and stable identities separate is reinforced by IntKB’s high ambiguity and FLEXLAW’s citation-alias reconciliation.
- Attorney approval remains the appropriate durable-promotion seam, although these papers support its control shape more strongly than they establish its workload or reliability.

## Delta vs the June-29 prior synthesis

**Genuinely new here:**

- The June-29 synthesis established deterministic `EvidenceSpan`, typed evidence polarity, provenance, ClaimGate, and temporal/jurisdictional qualification. This cluster supplies implemented retrieval and verification pipelines—and their failures—showing that anchor fidelity, claim support, and global or legal truth require separate verdicts.
- ProVe adds direct evidence that qualifier loss changes verification identity and that natural contradictions differ from synthetic fact-checking negatives.
- The no-evidence/retrieved/oracle design, noisy-context stress tests, seen/unseen evidence partition, and exact-span/parent/document recall hierarchy are new evaluation prescriptions.
- Fielded legal retrieval and geometry-derived document relations add concrete retrieval channels beyond the prior synthesis’s ontology and evidence model.
- Abstention calibration, relation- and entity-complexity slices, source-dependence checks, and bounded validator feedback are operational additions rather than ontology principles.

**Re-confirmed:**

- Exact source records and deterministic alignment must remain authoritative over semantic projections.
- Evidence polarity must be reified rather than collapsed into one confidence scalar.
- Labels are not identity; entity resolution must preserve ambiguity and provenance.
- Legal claims require temporal, jurisdictional, and source qualification.
- Model judgments and semantic scores are revisable epistemic assessments, not durable truth.
- Human approval and rejection-as-value remain sound control-plane choices.

**Contradictions and required refinements:**

- The June-29 synthesis recommended an `AlignmentStatus` family including `match_fuzzy`. The ratified July-14 citation doctrine explicitly forbids fuzzy or case-folded authorization. For legal citation grounding, fuzzy alignment may generate a candidate or persisted failed attempt, but it cannot produce a verified anchor.
- The prior synthesis described grounded-quote SHACL conformance as closely analogous to admissibility. This cluster contradicts that strong reading: an attached quote, typed output, or structurally conforming record can still fail to entail the claim. Structural ClaimGate behavior should remain, but semantic support needs a separate rule and verdict.
- A single `verified | plausible_unverified | flagged` status is too coarse if “verified” is allowed to span locator fidelity, support, identity, temporal validity, and authority. These dimensions should remain separate and compose into publication policy.
- There is no contradiction with the prior synthesis’s multi-temporal and jurisdictional doctrine; ProVe’s qualifier failure strongly re-confirms it.

## Tensions & contradictions

- **Always retrieve versus retrieve selectively.** `ba0c4177bb61` (Check Your Facts and Try Again) reports the best overlap score from always retrieving, while `05afbbf3e1e9` (Should We Fine-Tune or RAG?) shows context can reduce human-rated quality. Adjudicate per workflow with no/retrieved/oracle arms, a relevance gate, abstention, and joint quality/cost measurement.
- **Wide evidence windows versus exact spans.** `0421a1687b40` (ProVe) improves candidate recall with one- and two-unit windows, while the repo requires exact emitted spans. Use wide or structural units for candidate generation, then bind every contributing proposition to exact source anchors; never cite the concatenated retrieval window as though it were one source span.
- **Consolidation versus provenance transparency.** `ba0c4177bb61` (Check Your Facts and Try Again) finds consolidated evidence more useful than raw retrieval, but consolidation can erase boundaries. Treat chains as reversible projections whose leaves are immutable anchors.
- **Consensus versus primary authority.** `71d075974a2f` (Measuring Accuracy of Triples in Knowledge Graphs) and `a162c3d0158f` (Towards Knowledge Graphs Validation through Weighted Knowledge Sources) favor weighted agreement, but neither controls copied sources or common upstream errors. Use consensus for ranking or anomaly detection only; require source lineage and legal authority separately.
- **Task tuning versus controller-based correction.** `036015670131` (Enhancing Knowledge Graph Consistency) favors task-tuned encoder-decoder models, while `ba0c4177bb61` (Check Your Facts and Try Again) improves a frozen model with external control. Compare them under equal evidence and labeled-data budgets; model size or architecture is not a grounding proxy.
- **Human review as architecture versus evidence.** `d81e86e1d786` (IntKB) has the right approval shape but simulates every interaction with an oracle. Keep attorney approval for governance, while treating reviewer accuracy, disagreement, time, and automation bias as unmeasured product questions.
- **Model disagreement versus ensemble value.** `036015670131` (Enhancing Knowledge Graph Consistency) observes low cross-model correlation, but error diversity does not imply complementary correctness. Ensemble only after relation-sliced calibration against exact evidence, and retain abstention when models disagree.

## Routing suggestions

| Insight | Route | Rationale |
|---|---|---|
| Separate exact anchor, claim stance, authority, and admission | extend `explorations/citation-grounding-hallucination-guard` | Shapes the missing follow-on without expanding the verified-span goal’s locked scope. |
| Make RRF score explicitly non-epistemic and literal priority candidate-only | attach-to `goals/hybrid-retrieval-fusion-core` | Contribution diagnostics and ClaimGate boundary tests are the right place to prevent score/authority leakage. |
| Add no/retrieved/oracle, noisy-context, unseen-evidence, and natural-counterevidence evaluation | extend `explorations/rag-retrieval-projection` | This is retrieval-quality research beyond the current deterministic fusion-mechanics goal. |
| Preserve surface form, exact anchor, identity candidates, and ambiguity at every citation stage | attach-to `goals/citation-extraction-engine` | Fits the existing clean/tokenize/extract/group/resolve diagnostics and stable-ID contract. |
| Index containment, adjacency, layout family, and exact-span/parent/document hierarchy | attach-to `goals/law-doc-structure-oa-slice` | Structural retrieval depends on trustworthy document anatomy before entering fusion. |
| Carry qualifier-complete, revisable support/refutation assessments | attach-to `goals/epistemic-bitemporal-edge-core` | Valid time, knowledge time, source version, and supersession belong on derived epistemic events. |
| Preserve mention-to-entity ambiguity and alias provenance | attach-to `goals/identity-iri-fold` | IntKB and FLEXLAW show that exact strings and citation variants cannot authorize identity folding. |
| Calibrate field-, jurisdiction-, time-, and dependency-aware source policy | new-exploration `evidence-source-policy-calibration` | Source authority and calibration are explicit non-goals of the current fusion core and lack adequate evidence here. |

## Quality notes

The evidence profile is one gold paper and nine silver papers. Its strongest contribution is negative architectural evidence—what cannot safely count as grounding—rather than transferable accuracy claims. No study evaluates the repo’s full target: privileged local legal documents, exact versioned spans, qualifier-complete claims, natural counterevidence, current-authority checks, and attorney-reviewed admission.

- `0421a1687b40` (ProVe) is the strongest system study, but excludes PDFs, tables, scans, implicit support, and nearly all meaningful end-to-end refutation; it also lacks durable source offsets.
- `d81e86e1d786` (IntKB) under-delivers on “verifiable”: it displays a sentence but never tests entailment or real human review.
- `1a72f7ffcd1c` (KGValidator) does not support its human-replacement or automatic-update implications; its own outputs demonstrate shape-valid contradiction.
- `ba0c4177bb61` (Check Your Facts and Try Again) optimizes and evaluates largely with evidence-token overlap, has very low human agreement, and reaches poor absolute Wiki QA performance.
- `05afbbf3e1e9` (Should We Fine-Tune or RAG?) supplies valuable controls but does not evaluate citations; its title overstates a choice that its own design correctly treats as two orthogonal axes.
- `71d075974a2f` (Measuring Accuracy of Triples in Knowledge Graphs) reports striking F1 from a date-only, same-domain benchmark. `a162c3d0158f` (Towards Knowledge Graphs Validation through Weighted Knowledge Sources) does not meaningfully evaluate its central weighted score and contains ambiguous percentage reporting.
- `2cbbc764e376` (Semantic-Based Access to Digital Document Databases) and `8872b8387074` (Artificial Intelligence and Legal Discourse) provide durable structural ideas but are old, small, template- or corpus-specific studies without modern baselines or citation-span evaluation.
- `036015670131` (Enhancing Knowledge Graph Consistency) offers useful slices and constrained-output design, but modest F1 and general-domain sentence provenance do not justify production authority.

## Papers in this cluster

- 0421a1687b40 — ProVe — gold
- ba0c4177bb61 — Check Your Facts and Try Again — silver
- 1a72f7ffcd1c — KGValidator — silver
- d81e86e1d786 — IntKB — silver
- 036015670131 — Enhancing Knowledge Graph Consistency — silver
- 2cbbc764e376 — Semantic-Based Access to Digital Document Databases — silver
- 71d075974a2f — Measuring Accuracy of Triples in Knowledge Graphs — silver
- 05afbbf3e1e9 — Should We Fine-Tune or RAG? — silver
- 8872b8387074 — Artificial Intelligence and Legal Discourse — silver
- a162c3d0158f — Towards Knowledge Graphs Validation through Weighted Knowledge Sources — silver
