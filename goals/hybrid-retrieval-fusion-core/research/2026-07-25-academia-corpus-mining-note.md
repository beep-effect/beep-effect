# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** attach-to `goals/hybrid-retrieval-fusion-core` (high priority)
- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)
- **Owning reports:** [memory and bitemporal](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md), [legal ontology design](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md), [legal norms and reasoning](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md), and [retrieval and citation grounding](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached hybrid-retrieval-fusion-core

The target already owns deterministic weighted RRF, literal priority, exposed
per-channel contributions, stable span-bearing candidates, and proof that
retrieval cannot bypass `ClaimGate`
([target README, “Mission” and “Notes”](../README.md#mission);
[target SPEC, “Constraints” 3–8](../SPEC.md#constraints)).
The corpus sharpens the negative meaning of those contracts: a fused score
describes rank arithmetic, not confidence, support, authority, correctness, or
approval.

This boundary matters most where the target is intentionally strongest.
An exact phrase can deterministically outrank fuzzy consensus while still naming
the wrong entity, occurring in an irrelevant passage, or merely co-occurring
with an answer string. `05afbbf3e1e9` — *Should We Fine-Tune or RAG?* found that
additional retrieved and even oracle context could reduce human-rated quality;
`d81e86e1d786` — *IntKB* found more than 60% of extracted spans
entity-ambiguous. The owning retrieval report therefore treats literal priority
as safe only while the result remains a rejectable candidate
([“Design challenges” 4–5](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges)).

The memory report reaches the same conclusion from approximate retrieval:
missingness-aware similarity, activated subgraphs, and symbolic scenario gates
may improve recall, but each candidate must resolve back to an exact record and
span before supporting a claim. Its routed first step explicitly requests
missing-field, false-neighbor, superseded-evidence, graph-hub, and
candidate-to-span diagnostics
([“Direct patterns,” “Fuzzy retrieval as traced candidate generation”](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#direct-patterns)).

Legal retrieval adds a second axis that must not be flattened into score.
`a32b2b3bfed9` — *AI and Law: A fruitful synergy* and
`727fe68fabe6` — *A Model of Legal Reasoning with Cases Incorporating* support
retrieving supporting, contrary, distinguishing, and defeating material.
`703aea161905` — *Argumentation and Standards of Proof* separately warns that
retrieval relevance cannot become legal proof status
([legal-norms “Corroborations”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#corroborations)).
Under align decision 5, richer argumentation belongs after semantic-foundation
M1; this note therefore proposes diagnostic fixtures, not an argumentation
engine or new authority policy.

## Distilled requirements

1. **Make score semantics mechanically non-epistemic.** The public result and
   diagnostic vocabulary should describe ranks, configured/effective weights,
   RRF components, weighted contributions, and fused ordering only. A focused
   contract test should prove that no RRF field represents confidence,
   probability of truth, evidentiary support, legal authority, acceptance, or
   approval. Evidence: `71d075974a2f` — *Measuring Accuracy of Triples in
   Knowledge Graphs*, `a162c3d0158f` — *Towards Knowledge Graphs Validation
   through Weighted Knowledge Sources*, and `0421a1687b40` — *ProVe*
   ([retrieval “Design challenges” 5](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges)).

2. **Prove that literal priority remains candidate-only.** Add a boundary
   fixture in which an exact-phrase candidate wins the locked literal
   tier/floor but the output still cannot encode relevance acceptance, claim
   support, authority, or admission. This extends the existing candidate-packet
   proof without adding a relevance gate to this goal. Evidence:
   `05afbbf3e1e9` — *Should We Fine-Tune or RAG?* and `d81e86e1d786` —
   *IntKB* ([retrieval “Design challenges” 4](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges);
   [target SPEC, “Non-Goals”](../SPEC.md#non-goals)).

3. **Add exact-but-irrelevant fixture diagnostics.** A fixture oracle should
   label an exact phrase found in a top-ranked but irrelevant passage and prove
   that fusion preserves its arithmetic and anchor without reclassifying it as
   relevant. The diagnostic is evaluation metadata, not runtime truth.
   Evidence: `05afbbf3e1e9` — *Should We Fine-Tune or RAG?* and
   `ba0c4177bb61` — *Check Your Facts and Try Again*
   ([retrieval “Tensions & contradictions,” “Always retrieve versus retrieve selectively”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#tensions--contradictions)).

4. **Add wrong-entity and co-occurrence-only fixture diagnostics.** One fixture
   should contain the exact query string for two entities, with the higher
   lexical/literal candidate bound to the wrong entity; another should contain
   subject and answer strings without expressing the queried relation. Tests
   should preserve both candidates and their spans while keeping identity and
   support decisions outside fusion. Evidence: `d81e86e1d786` — *IntKB*
   ([retrieval “Design challenges” 1 and 4](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges))
   and fuzzy-linking failures in `badd96c61d16` — *Ontology Knowledge Map
   Approach Towards Building Linked Data*
   ([legal-ontology “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns)).

5. **Make candidate-to-span resolution attributable and fail closed.** For
   every emitted candidate, diagnostics should identify the input candidate,
   contributing channels, unchanged pre-verified `TextAnchor`, and resolution
   outcome. A candidate lacking a valid pre-verified anchor must never become a
   ranked result; fusion must neither invent nor repair one. Evidence:
   `0e1b8c67380f` — *Modified Sparse Distributed Memory as Transient Episodic
   Memory*, `8fb75bf2f8c9` — *LTMC — An Improved Long-Term Memory for Cognitive
   Architectures*, and `52d958293653` — *Text-based Reasoning with Symbolic
   Memory Model*
   ([memory “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#direct-patterns);
   [target SPEC, “Constraints” 7](../SPEC.md#constraints)).

6. **Keep structural and argument-role signals inspectable.** If optional graph
   or later producer fixtures label candidates as supporting, contrary,
   distinguishing, or rule-attacking, those labels should remain orthogonal to
   channel contribution and fused score. Tests should show that a contrary
   candidate can outrank a supporting one without acquiring a favorable proof
   status. Evidence: `a32b2b3bfed9` — *AI and Law: A fruitful synergy*,
   `727fe68fabe6` — *A Model of Legal Reasoning with Cases Incorporating*, and
   `703aea161905` — *Argumentation and Standards of Proof*
   ([legal-norms “Routing suggestions”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#routing-suggestions)).

7. **Separate deterministic mechanics proof from retrieval-quality evidence.**
   Acceptance tests may establish fusion math, stable order, contribution
   totals, and span fidelity, but their names and evidence must not claim
   relevance quality. Record exact-but-irrelevant, wrong-entity, and
   candidate-to-span cases as diagnostic coverage; route no/retrieved/oracle
   benchmarking, abstention calibration, and unseen-evidence evaluation to
   retrieval follow-ons. Evidence:
   [retrieval “Design challenges” 6](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges)
   and [“Routing suggestions”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#routing-suggestions).

## Fixture candidates

- **Exact phrase, irrelevant section:** the exact query phrase appears in a
  boilerplate or unrelated section and receives literal priority; the oracle
  label is irrelevant, the anchor remains unchanged, and the result remains a
  candidate.

- **Exact phrase, wrong entity:** two entities share the queried surface form;
  the wrong entity ranks first by literal and lexical channels. Diagnostics
  expose entity ambiguity without authorizing an identity fold.

- **Co-occurrence without relation:** subject and object strings share one
  sentence, but the asserted relation is absent or negated. Fusion returns the
  span without representing it as supporting evidence, following
  `d81e86e1d786` — *IntKB*.

- **False high-similarity neighbor:** a semantic candidate matches most query
  features but conflicts on one material field. Preserve its semantic rank and
  exact source binding; label the mismatch only in fixture expectations,
  following `0e1b8c67380f` — *Modified Sparse Distributed Memory as Transient
  Episodic Memory*.

- **Graph hub versus precise leaf:** an optional graph channel ranks a
  high-degree generic node above a lower-degree exact record. Expose the graph
  contribution and prove that neither activation nor fused rank grants
  authority, following `8fb75bf2f8c9` — *LTMC — An Improved Long-Term Memory
  for Cognitive Architectures*.

- **Superseded exact evidence:** an older source version contains the exact
  phrase and wins fusion over the current version. Both candidates retain their
  distinct anchors; currentness and authority remain downstream assessments.

- **Supporting versus contrary precedence:** a contrary precedent wins fused
  rank through multiple channels while a supporting precedent remains lower.
  Argument-role fixture metadata survives, but neither role changes RRF
  arithmetic or encodes acceptance.

- **Unresolvable candidate:** a ranked input has a stale or missing anchor.
  Candidate-to-span diagnostics record the failure, no ranked result is emitted
  for it, and no nearby text is substituted.

## Tensions and limits

- The target locks a literal tier/floor, while the corpus shows that exact
  context can be irrelevant or harmful. The compatible resolution is narrow:
  keep deterministic literal priority inside candidate ordering and make its
  non-epistemic boundary test-visible; do not add reranking or support
  assessment to this packet.

- Wider windows and structural regions can improve recall, but the target
  requires exact span preservation. Candidate generation may use broader
  context only when every emitted candidate resolves to its unchanged
  pre-verified anchor
  ([retrieval “Wide evidence windows versus exact spans”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#tensions--contradictions)).

- The corpus is strong on architectural convergence and failure taxonomy, but
  thin on production validation. No cited study evaluates the repository's
  full combination of privileged legal documents, deterministic hybrid fusion,
  immutable exact spans, natural counterevidence, current-authority checks, and
  attorney-reviewed admission
  ([retrieval “Quality notes”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#quality-notes);
  [memory “Quality notes”](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#quality-notes)).

- Ontology and legal-reasoning evidence is often conceptual, historically
  concentrated, or based on small demonstrations. Structural channels and
  argument buckets are therefore fixture hypotheses, not validated production
  ranking improvements
  ([legal-ontology “Quality notes”](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#quality-notes)).

- Align decision 2 reserves typed-verdict wording changes to a separate PR.
  This additive note uses that vocabulary but does not amend binding product
  prose. Align decision 8 likewise keeps any binding SPEC/PLAN changes outside
  this notes PR.

## Provenance

- The route is the high-priority routing-table row in the
  [master synthesis](../../../explorations/academia-corpus-mining/research/t3-master-synthesis.md#consolidated-routing-table):
  “Make RRF scores explicitly non-epistemic; add exact-but-irrelevant,
  wrong-entity, and candidate-to-span diagnostics.” Its immediate dispatch
  follows align decision 1.

- Target scope was grounded in the
  [packet README](../README.md) and normative [SPEC](../SPEC.md), especially
  candidate-only output, exposed contribution arithmetic, literal priority,
  unchanged `TextAnchor` preservation, and the mandatory `ClaimGate` boundary.

- Gold deep reads consulted first were `0421a1687b40` — *ProVe*,
  `a32b2b3bfed9` — *AI and Law: A fruitful synergy*,
  `703aea161905` — *Argumentation and Standards of Proof*,
  `f4ab0f7d6892` — *Persuasion and Value in Legal Argument*, and
  `727fe68fabe6` — *A Model of Legal Reasoning with Cases Incorporating*.

- Silver deep reads consulted were `05afbbf3e1e9` — *Should We Fine-Tune or
  RAG?*, `ba0c4177bb61` — *Check Your Facts and Try Again*,
  `d81e86e1d786` — *IntKB*, `0e1b8c67380f` — *Modified Sparse Distributed
  Memory as Transient Episodic Memory*, `8fb75bf2f8c9` — *LTMC — An Improved
  Long-Term Memory for Cognitive Architectures*, `52d958293653` — *Text-based
  Reasoning with Symbolic Memory Model*, `badd96c61d16` — *Ontology Knowledge
  Map Approach Towards Building Linked Data*, `2d2219bdb167` — *A
  Complex-System Approach: Legal Knowledge, Ontology, Information and*,
  `93289ccbf666` — *The Future of Law: Relational Justice, Web Services*, and
  `d0ac8b86974d` — *Ontologies, ICTs and Law The International Ontojuris
  Project*. Titles and tiers follow the
  [paper catalog](../../../explorations/academia-corpus-mining/research/paper-catalog.jsonl).

- Align decision 4 defers the June-29 second mining wave until dispatch lands;
  align decision 7 parks the source packet after dispatch. This note therefore
  records bounded evidence for the target owners rather than reopening mining
  or shaping a new brief.
