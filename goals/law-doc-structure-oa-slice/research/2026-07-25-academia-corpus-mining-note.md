# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** attach-to `goals/law-doc-structure-oa-slice` (high priority)
- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)
- **Owning reports:** [retrieval, RAG, and citation grounding](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md); [document structure, layout, and legal NLP/IE](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md); [agent metacognition and neuro-symbolic architecture](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached law-doc-structure-oa-slice

The target already requires a deterministic, versioned, fail-closed recognizer
for one atomic pair: an `ACTION-FINALITY` declaration and its `SHORTENED
STATUTORY PERIOD` block. It must emit both schema-backed candidates with exact
verified anchors or emit none with one typed abstention. Its P0 corpus must
cover hostile negatives, ambiguity, malformed periods, Unicode, straddles,
source drift, unsupported forms, and low-quality OCR lineage
([target SPEC, Objective and Constraints](../SPEC.md#objective)).

The routed corpus insight is therefore evidence hardening, not scope expansion:
add full-pipeline coverage, abstention, structural-error, and future-model
hard-negative evidence. The reports show that component accuracy, conditional
precision, answer-string agreement, schema validity, deterministic replay, and
a plausible rationale can each look healthy while the complete result remains
wrong, unsupported, or absent
([document-structure report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#design-challenges);
[metacognition report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#design-challenges)).

This dispatch lands now under align decision 1. It does not authorize a layout
engine, another rule family, LLM-first extraction, or no-match escalation; all
remain explicit non-goals
([target SPEC, Non-Goals](../SPEC.md#non-goals)). Under align decisions 2 and 8,
approval is only a recorded scoped human disposition, and any binding vocabulary
or contract edit belongs in a separate PR.

## Distilled requirements

1. **Maintain two explicitly labeled evaluation lanes.** P0 should distinguish
   oracle-upstream component fixtures from full-pipeline fixtures that begin at
   the packet's permitted span-preserving input and continue through exact
   anchor recovery, atomic pair recognition, candidate construction, and typed
   outcome. No oracle-conditioned score may be reported as end-to-end proof.
   This is testable by requiring every benchmark result to carry one lane label
   and by rejecting summaries that combine the two. Evidence:
   [document-structure report, “Component scores and conditional accuracy”](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#design-challenges),
   `142d0583b149` — *Performance Evaluation of Document Structure Extraction
   Algorithms*, and `15cb15b598de` — *LATEX Rainbow*.

2. **Freeze complete denominators before setting floors.** For every document
   family, source modality, and structure class, record eligible, emitted,
   abstained, invalid, contradicted-by-label, and correct counts. Derive
   precision, coverage, and abstention rates from those raw counts; conditional
   correctness among emitted cases is insufficient. This is testable by
   reconstructing every reported rate from the stored count vector. Evidence:
   [document-structure report, “Risk/coverage and abstention accounting”](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#direct-patterns),
   `9ffd854e6f1d` — *Streamlining Legal Document Management*,
   `39933453659f` — *DUDE*, and `7ace036bae77` — *An Integrated Approach*.

3. **Keep the atomic pair verdict separate from structural diagnostics.** Each
   fixture should retain the existing exact outcome—two candidates or no
   candidates plus one typed abstention—while also classifying structural
   behavior as correct, miss, false alarm, split, merge, or many-to-many.
   This is testable by asserting both fields independently and preserving the
   raw error vector rather than only a weighted aggregate. Evidence:
   [document-structure report, “Error-decomposed structure evaluation”](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#direct-patterns),
   `142d0583b149` — *Performance Evaluation of Document Structure Extraction
   Algorithms*, and `4528245fb9e9` — *Capturing Logical Structure*.

4. **Measure relationships needed to recognize the pair without declaring one
   canonical document tree.** Research fixtures should identify source block
   IDs and independently label same-paragraph, sibling, ancestor-descendant,
   page/segment continuation, and reading-order relationships. Physical and
   logical parentage must remain distinguishable. This is testable by checking
   candidate-to-block mappings and each relation label separately. It is a
   fixture obligation, not authority to create a foundation package. Evidence:
   [document-structure report, “Layered, source-anchored document IR”](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#direct-patterns)
   and `4528245fb9e9` — *Capturing Logical Structure*.

5. **Add natural hard negatives rather than relying on deletion or random
   corruption.** The OA corpus should include exact-but-irrelevant literals,
   wrong-role occurrences, altered period language, conflicting duplicate
   blocks, entity-dense surrounding text, previously seen boilerplate in an
   unseen document family, and a structurally plausible block with no complete
   supported pair. Each must emit no candidate and the appropriate existing
   abstention or verified-span failure. Evidence:
   [retrieval report, “Synthetic negatives and aggregate metrics”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges),
   `0421a1687b40` — *ProVe*, `d81e86e1d786` — *IntKB*, and
   `05afbbf3e1e9` — *Should We Fine-Tune or RAG?*.

6. **Make early structural exclusion observable and reversible in fixtures.**
   Cases marked as debris, omitted, out-of-order, or outside the expected
   section must retain their source identity, rule trace, alternative, and
   exclusion reason. A fixture passes only if an operative all-capital block or
   the sole valid continuation cannot disappear silently; uncertain recall
   must produce abstention. Evidence:
   [document-structure report, “Early hard pruning”](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#design-challenges)
   and `4528245fb9e9` — *Capturing Logical Structure*.

7. **Preserve typed abstention as a successful, auditable outcome.** Fixtures
   must exercise `absent`, `ambiguous`, `unsupported`, `low-quality-source`,
   and `rule-not-covered`, including duplicate pairs, incomplete pairs,
   malformed periods, unknown templates, and unauthorized OCR lineage. Tests
   must prove zero candidates for every closed outcome and must not convert
   absence into model escalation. Evidence:
   [document-structure report, “Corroborations”](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#corroborations),
   `39933453659f` — *DUDE*, `7ace036bae77` — *An Integrated Approach*, and
   `e729be81754d` — *Making Documents Work*.

8. **Inventory future-model hard negatives now, but keep them inert in V1.**
   A separately labeled future-evaluation set should include a correct pair
   accompanied by invalid reasoning, a deterministic and replayable trace that
   selects the wrong pair, a schema-valid output with the wrong legal role, and
   a same-model “correction” that invents missing period language. Passing
   requires external fixture truth and exact anchors to defeat the model output,
   regardless of confidence or rationale. Evidence:
   [metacognition report, “Delta vs the June-29 prior synthesis”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#delta-vs-the-june-29-prior-synthesis),
   `aff0b53d4126` — *AlignedCoT*, `8031a91d7e5b` — *Lari*, and
   `d7c64f6843f5` — *THINK BEYOND SIZE*. This does not alter the target's
   deterministic, no-LLM-first path.

## Fixture candidates

- **Clean full-pipeline pair:** one finality declaration and one shortened-period
  block produce exactly two candidates, both recovering exact raw UTF-16 slices.

- **Atomic incomplete pair:** either member appears alone; the result contains
  no candidate and the fixture-selected typed abstention.

- **Duplicate and conflicting pair:** two plausible finality blocks, or
  incompatible finality/period pairings, force `ambiguous` with zero candidates.

- **Exact-but-irrelevant literals:** “FINAL,” “NON-FINAL,” or period language
  appears in a footer, quoted history, attachment, or unrelated paragraph;
  lexical exactness must not authorize the pair.

- **Split, merge, and straddle matrix:** the two structures cross page or segment
  boundaries, one block is split into fragments, and neighboring blocks are
  merged. Assert the atomic outcome and structural error vector independently.

- **Operative block misclassified as debris:** an all-capital or underlined
  operative block resembles removable material. The original block remains
  available, and uncertain exclusion causes abstention rather than silent loss.

- **Lineage and drift matrix:** valid text, stale artifact identity, raw-slice
  mismatch, changed OCR engine/version, unmapped OCR coordinates, and
  low-quality lineage exercise the verified-span failure boundary and
  `low-quality-source`.

- **Document-disjoint hostile family:** hold out one OA template family entirely,
  preserve real negative sentences, and report its eligible/emitted/abstained/
  correct counts separately from seen-family results.

- **Future-model semantic pitfalls:** store labeled exemplars for correct answer
  with invalid rationale, deterministic false trace, shape-valid wrong role,
  and assumption-inventing correction. These are shadow fixtures only until a
  separately approved model path exists.

## Tensions and limits

- “Full pipeline” is scoped to this packet's owned and consumed boundaries. It
  should expose propagation from permitted span-bearing input through the
  docketing seam, but it must not make this packet select PDF/OCR engines or own
  upstream layout extraction.

- Structural error labels add diagnosis, not new authorization states. The
  target's atomic candidate-or-abstention contract remains the acceptance
  boundary; split, merge, and relationship labels explain why it passed or
  failed.

- The corpus is strong on architectural convergence and evaluation failure
  modes, but thin on production validation. No cited study evaluates USPTO
  Office Actions, this exact paired rule family, privileged local documents,
  the repo's versioned verified-anchor contract, or attorney-reviewed admission.

- Even the strongest directly relevant studies have narrow samples or excluded
  hard modalities. `4528245fb9e9` used a small, single-annotator legal-document
  corpus without Office Actions; `0421a1687b40` excluded PDFs and had only two
  end-to-end refuting examples. Their metrics must not become target floors.

- Future-model fixtures are negative evidence for a possible later path, not an
  argument to add one. Align decision 6 leaves supervisor-versus-integrated
  topology open, and align decision 4 defers the next legal-NLP mining wave
  until this dispatch lands.

## Provenance

- Target scope read: [README](../README.md) and normative
  [SPEC](../SPEC.md), especially Objective, Non-Goals, Constraints, Acceptance
  Criteria, and Stop Conditions.

- Route-owning evidence read:
  [retrieval report](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md),
  [document-structure report](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md),
  and [metacognition report](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md).

- Gold deep-read notes read first: `0421a1687b40` — *ProVe* and
  `4528245fb9e9` — *Capturing Logical Structure*.

- Additional deep-read notes used: `142d0583b149` — *Performance Evaluation of
  Document Structure Extraction Algorithms*; `9ffd854e6f1d` — *Streamlining
  Legal Document Management*; `39933453659f` — *DUDE*; `7ace036bae77` —
  *An Integrated Approach*; `15cb15b598de` — *LATEX Rainbow*;
  `e729be81754d` — *Making Documents Work*; `d81e86e1d786` — *IntKB*;
  `05afbbf3e1e9` — *Should We Fine-Tune or RAG?*; `aff0b53d4126` —
  *AlignedCoT*; `8031a91d7e5b` — *Lari*; and `d7c64f6843f5` —
  *THINK BEYOND SIZE*.
