# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** attach-to `goals/citation-extraction-engine` (high priority)

- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)

- **Owning reports:** [legal ontology design](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md), [legal norms and reasoning](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md), [retrieval and citation grounding](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md), and [document structure and legal NLP](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md)

- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached citation-extraction-engine

The routed insight is: preserve stage identity, exact anchors, ambiguity,
alternative IRIs, argument roles, and unsupported slots. It sharpens the
target's existing clean/tokenize/extract/group/resolve diagnostics without
changing its locked eyecite port, existing-value output taxonomy, or v1 citation
forms ([target README](../README.md); [target SPEC](../SPEC.md)).

Across the clusters, extraction is consistently a sequence of reviewable
candidate transformations rather than a jump from surface text to canonical
truth. Raw mentions, normalized forms, identity proposals, role assignments,
and resolutions have different evidence and failure modes. Retaining those
distinctions makes the target's stage-attributable parity diagnostically useful.

Argument roles are routed here only as evidence-preservation needs. Under align
decision 5, qualified legal argumentation/evaluation is the first later legal
module; this engine must not become that reasoner. Under align decision 2,
approval is a recorded scoped human disposition, not proof that an extraction
or interpretation is true.

## Distilled requirements

1. **Keep one durable candidate identity across every pipeline stage.** A parity
   fixture should prove that clean, tokenize, extract, group, and resolve outputs
   can be joined to the same candidate while retaining the original surface form,
   source revision, producer/run identity, and stage-local outcome. Evidence:
   [Document structure, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#direct-patterns),
   `3a636c39bbaa — Kleister: A novel task for Information Extraction involving`
   and `9ffd854e6f1d — Streamlining Legal Document Management: A Knowledge‑Driven Service Platform`.

2. **Carry the exact verified anchor through normalization and resolution.**
   Tests should reject any successful normalized citation whose raw mention,
   canonical half-open UTF-16 anchor, source identity/version, or mapping back to
   the source has been dropped or replaced by a detached string. Evidence:
   [Document structure, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#direct-patterns),
   `3a636c39bbaa — Kleister: A novel task for Information Extraction involving`,
   `26c14353f198 — A Span Extraction Approach`, and `9ffd854e6f1d — Streamlining Legal Document Management: A Knowledge‑Driven Service Platform`.

3. **Make resolution ambiguity an output, not a hidden tie-break.** Full,
   short, Id., and supra fixtures should distinguish resolved, ambiguous, and
   unresolved outcomes; an ambiguous result must retain every surviving stable
   identity candidate and the evidence used to generate it. Evidence:
   [Retrieval and grounding, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#direct-patterns),
   `8872b8387074 — Artificial Intelligence and Legal Discourse` and
   `d81e86e1d786 — IntKB`.

4. **Preserve alternative IRIs and their provenance until adjudication.** Equal
   labels, aliases, generated names, fuzzy scores, or corpus association must
   not authorize an identity fold. A negative fixture should prove that two
   plausible stable IDs remain alternatives with mapping source, snapshot,
   score semantics, and review state intact. Evidence:
   [Legal ontology design, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns),
   `bbd2af54d814 — KnowGL: Knowledge Generation and Linking from Text`,
   `badd96c61d16 — Ontology Knowledge Map Approach Towards Building Linked Data`,
   `2d2219bdb167 — A Complex-System Approach: Legal Knowledge, Ontology, Information and`,
   and `e7bc107b3188 — Ontologies as a Set to Describe Legal Information`.

5. **Keep candidate scores non-epistemic.** A test should demonstrate that a
   higher extraction, recurrence, normalization, or linking score may order
   review candidates but cannot establish citation identity, source support,
   legal meaning, or approval. Evidence:
   [Legal ontology design, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns)
   and [Retrieval and grounding, Design challenges](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges),
   especially `bbd2af54d814 — KnowGL: Knowledge Generation and Linking from Text`
   and `d81e86e1d786 — IntKB`.

6. **Preserve supplied argument roles as separately anchored annotations.** If
   a fixture identifies circumstances, facts, proposed rules, warrants,
   backing, qualifiers, rebuttals, hypotheticals, holdings, or dissenting
   positions, each populated role should retain its own exact anchor and
   speaker/opinion context. The engine must not collapse these roles into one
   citation-level support flag. Evidence:
   [Legal norms, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns),
   `f4ab0f7d6892 — Persuasion and Value in Legal Argument`,
   `1b74b7bb166f — Legal case-based reasoning as practical reasoning`,
   `bd232c4bdaba — Arguing About Cases as Practical Reasoning`, and
   `99bbae2d4edf — Using Argument Schemes for Hypothetical Reasoning in Law`.

7. **Represent unsupported or contested slots explicitly.** A fixture should
   prove that a missing warrant, ungrounded rule, disputed premise, absent
   backing, or unresolved rebuttal remains open or contested rather than being
   synthesized to complete an argument. Evidence:
   [Legal norms, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns),
   `bd232c4bdaba — Arguing About Cases as Practical Reasoning`,
   `99bbae2d4edf — Using Argument Schemes for Hypothetical Reasoning in Law`,
   and `ee6c09b92c53 — AI and Legal Argumentation: Aligning the Autonomous Levels`.

8. **Report stage and end-to-end denominators together.** Parity evidence should
   retain eligible, emitted, abstained, ambiguous, unresolved, invalid, and
   correct counts so high conditional accuracy cannot hide candidate loss or
   forced resolution. Evidence:
   [Document structure, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-doc-structure-legal-nlp.md#direct-patterns),
   `9ffd854e6f1d — Streamlining Legal Document Management: A Knowledge‑Driven Service Platform`
   and `26c14353f198 — A Span Extraction Approach`.

## Fixture candidates

- **Normalization without detachment:** a full case citation whose normalized
  reporter identity differs from its exact surface spelling; every stage retains
  the same candidate ID and raw anchor.

- **Ambiguous reporter identity:** one surface form produces two plausible
  stable vocabulary IDs. Resolution returns both alternatives with provenance
  and does not select by label equality or score alone.

- **Competing shortened-reference antecedents:** a short citation, Id., or supra
  form has two admissible prior full citations. The expected outcome is durable
  ambiguity rather than nearest-match resolution.

- **Unresolved but well-formed citation:** tokenization and extraction succeed,
  yet vocabulary lookup has no stable target. The candidate and exact anchor
  survive with an unresolved outcome and warning.

- **Role-separated opinion text:** majority, dissent, and hypothetical passages
  cite the same authority for different roles. Each occurrence keeps its own
  anchor and role context; none overwrites the others.

- **Unsupported argument slot:** a passage states a conclusion and citation but
  supplies no anchored warrant for one inferential step. The fixture expects an
  open support slot, not a generated completion or global supported verdict.

- **Repeated citations with an early miss:** several same-form citations occur
  in one source and an early candidate fails. Later candidates must still be
  emitted, with complete-set recall and stage-local failure attribution.

- **Natural absence versus `NO_CITATION`:** distinguish text containing no
  parseable citation from a parsed citation whose identity or argumentative
  support is insufficient. These outcomes must not share one catch-all state.

## Tensions and limits

- The target's v1 scope remains exactly full/short/Id./supra case citations and
  ratified 35 U.S.C./37 C.F.R. fixtures. Argument-role fixtures preserve inputs
  for downstream consumers; they do not authorize a new argument ontology,
  proof evaluator, or ground-before-cite workflow.

- Exact UTF-16 anchors prove fidelity inside a named text coordinate space, not
  completeness for scans, tables, signatures, or image-only evidence. The
  document-structure report routes those later anchor forms elsewhere and does
  not justify weakening this target's exact-span dependency.

- The corpus is strong on architectural convergence and thin on production
  validation. Most argument examples are manually encoded single cases; the
  extraction studies use Wikipedia, receipts, invoices, small national-law
  corpora, or dated retrieval systems. None evaluates eyecite parity, USPTO
  Office Actions, or this repository's exact verified-anchor contract.

- Several cited evaluations have missing protocols, synthetic negatives,
  conditional-only scores, ambiguous identity handling, or internal reporting
  inconsistencies. They support explicit states and fixtures, not performance
  thresholds or model selection.

- Align decision 8 places this additive note in the notes PR. Any binding
  SPEC/PLAN adoption, including typed-verdict vocabulary associated with align
  decision 2, requires the separate binding-doc PR and owner review.

## Provenance

The note was grounded first in the target's [README](../README.md) and
[normative SPEC](../SPEC.md), then in the routed sections of the four owning
cluster reports. The cluster reports remain the full synthesis and quality
ledger.

- Gold deep reads consulted: `f4ab0f7d6892 — Persuasion and Value in Legal Argument`;
  `1b74b7bb166f — Legal case-based reasoning as practical reasoning`;
  `bd232c4bdaba — Arguing About Cases as Practical Reasoning`;
  `99bbae2d4edf — Using Argument Schemes for Hypothetical Reasoning in Law`;
  and `3a636c39bbaa — Kleister: A novel task for Information Extraction involving`.

- Silver deep reads consulted: `bbd2af54d814 — KnowGL: Knowledge Generation and Linking from Text`;
  `badd96c61d16 — Ontology Knowledge Map Approach Towards Building Linked Data`;
  `2d2219bdb167 — A Complex-System Approach: Legal Knowledge, Ontology, Information and`;
  `e7bc107b3188 — Ontologies as a Set to Describe Legal Information`;
  and `ee6c09b92c53 — AI and Legal Argumentation: Aligning the Autonomous Levels`.

- Additional silver deep reads consulted: `8872b8387074 — Artificial Intelligence and Legal Discourse`;
  `d81e86e1d786 — IntKB`; `26c14353f198 — A Span Extraction Approach`;
  and `9ffd854e6f1d — Streamlining Legal Document Management: A Knowledge‑Driven Service Platform`.

- No paper URL, DOI, or bibliographic identifier is introduced here. Align
  decision 4 defers the approved June-29 backlog mining wave until this dispatch
  lands; this note therefore relies only on the completed 443-paper corpus.
