# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** extend `explorations/citation-grounding-hallucination-guard` (high priority)
- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)
- **Owning reports:** [Retrieval, RAG & citation grounding](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md) and [Norms, deontic logic, legal reasoning & argumentation](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached citation-grounding-hallucination-guard

The routed insight is to “Shape the anchor-to-stance-to-authority-to-admission
follow-on.” The target already fixes the first boundary: an exact, versioned
raw-source anchor proves what text may be emitted, while its queued
`citation-ground-before-cite` lane carries verified matter-scoped evidence into
the existing admission machinery. The corpus identifies the missing semantics
between those boundaries without reopening the shaped
[brief](../BRIEF.md) or [map](../MAP.md).

The owning cluster finds that exact anchoring, retrieval relevance, semantic
support, legal authority, temporal validity, and human disposition are distinct
verdicts. ProVe verifies source support rather than global truth, loses
qualifiers before comparison, and performs much worse on passage-level stance
than on aggregate classification. IntKB, KGValidator, and the consistency study
show that attached text, typed output, or constrained labels can remain
co-occurrence-only, contradictory, or relation-sensitive
([retrieval report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges);
`0421a1687b40` — ProVe; `d81e86e1d786` — IntKB;
`1a72f7ffcd1c` — KGValidator; `036015670131` — Enhancing Knowledge Graph
Consistency).

The legal cluster supplies the authority and admission boundary. Credibility is
claim- and conflict-specific; proof standards vary by procedure; and approval
records scoped closure rather than manufacturing truth. That correction is
already locked for separate product prose by align decision 2. This extension
should therefore preserve the target's exact-span invariant, existing
`ClaimLifecycle`, and app/server composition seam while shaping a distinct
qualifier-aware assessment before admission
([legal report, “Design challenges” §§1, 4–5](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#design-challenges);
`703aea161905` — Argumentation and Standards of Proof;
`73abf21862dc` — The adaptive nature of text-driven law).

## Distilled requirements

1. A follow-on assessment must emit a separate per-span outcome of `supports`,
   `refutes`, or `insufficient-evidence`; exact slice equality, schema
   conformance, retrieval rank, or a generated rationale must never satisfy that
   outcome by themselves. A fixture passes only when reversing the asserted
   relation can change stance without changing the verified anchor
   ([retrieval report, “Direct patterns” §§1 and 4](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#direct-patterns);
   `0421a1687b40` — ProVe; `1a72f7ffcd1c` — KGValidator).

2. Before two claims or a claim and span-derived proposition may be compared,
   assertion identity must carry applicable dates, jurisdiction, procedural
   posture, actor role, polarity, and scope. Missing or conflicting mandatory
   qualifiers must produce a reviewable qualifier-mismatch or
   insufficient-evidence result, never an inferred default
   ([retrieval report, “Design challenges” §2](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges);
   `0421a1687b40` — ProVe).

3. The evidence envelope must preserve both the semantic legal target and the
   reproducible evidentiary target: original citation text, work or expression
   identity when resolved, immutable item or manifestation identity, source
   version or hash, and exact anchor. An unresolved semantic target must remain
   representable without weakening the verified item/span
   ([legal report, “Direct patterns” §6](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns);
   `7d7f8ed65c53` — Computable Models of the Law: Languages, Dialogues, Games,
   Ontologies).

4. Authority and credibility must be assessed for the particular proposition,
   conflict, procedure, jurisdiction, and time. A test must reject any policy
   that converts fusion score, model confidence, source consensus, or one
   global source rank directly into legal sufficiency
   ([retrieval report, “Design challenges” §5](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges);
   [legal report, “Design challenges” §5](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#design-challenges);
   `703aea161905` — Argumentation and Standards of Proof).

5. Every derived stance, aggregate, authority assessment, and admission
   disposition must retain the exact contributing anchor IDs, assertion
   qualifiers, evaluator or rule version, source version, and failure outcomes.
   Recalculation after a source or policy change must leave the underlying
   assertions and evidence unchanged
   ([retrieval report, “Direct patterns” §§1 and 7](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#direct-patterns);
   `036015670131` — Enhancing Knowledge Graph Consistency).

6. Admission must fail closed unless anchor fidelity, qualifier compatibility,
   claim-to-span stance, authority/currentness, matter scope, and explicit human
   disposition all satisfy their own gates. Approval records a scoped,
   revisable disposition under align decision 2; it must not become evidence,
   source truth, or a new `ClaimLifecycle` meaning
   ([legal report, “Verdict paragraph”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#verdict-paragraph);
   `73abf21862dc` — The adaptive nature of text-driven law).

7. `NO_CITATION`, no evidence retrieved, qualifier mismatch, refutation,
   insufficient evidence, stale authority, ambiguity, and reviewer rejection
   must remain distinguishable durable outcomes. A fixture must prove that
   “nothing parsed” cannot be collapsed into “the parsed citation does not
   support this claim”
   ([retrieval report, “Direct patterns” §4](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#direct-patterns);
   `d81e86e1d786` — IntKB).

8. Competing support and counterevidence must be retained even when a preferred
   working assessment is selected. The target may shape the handoff, but
   preferred belief views belong to the bitemporal edge core under align
   decision 3, and qualified legal evaluation belongs to the later
   argumentation/evaluation module under align decision 5
   ([legal report, “Direct patterns” §3](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns);
   `703aea161905` — Argumentation and Standards of Proof).

## Fixture candidates

- **Same anchor, opposite claims:** one exact source span is evaluated against
  positive and negated assertions; one supports and the other refutes, proving
  that anchor fidelity does not determine stance.

- **Qualifier collision:** textually similar claims differ only by effective
  date, jurisdiction, procedural posture, actor role, polarity, or scope; the
  incomplete and mismatched variants fail before semantic comparison.

- **Historically supported, currently stale:** an immutable prior version
  supports the claim at its valid time, while a later authority supersedes it;
  the historical stance survives but current admission fails.

- **Co-occurrence without entailment:** a sentence contains the expected party
  and outcome but expresses a different relation; extraction succeeds while
  stance returns insufficient evidence, exercising the IntKB failure mode.

- **Shape-valid contradiction:** a typed verdict says “supports” while its
  generated explanation describes contrary evidence; deterministic
  evidence/verdict checks reject the result and never treat the explanation as
  evidence, reproducing KGValidator's observed hazard.

- **Conflicting authorities:** two exact anchors support incompatible
  propositions, with source rank varied independently. Both remain visible;
  claim-specific authority and procedure select no result unless the configured
  evaluation context justifies one.

- **Dual citation identity:** two manifestations express the same legal work,
  but only one hash and span was reviewed. Semantic resolution may converge;
  evidentiary authorization remains item-specific.

- **Negative-path separation:** run otherwise identical cases for
  `NO_CITATION`, no retrieved evidence, refutation, ambiguity, stale authority,
  and reviewer rejection; persistence and replay must preserve six distinct
  outcomes.

## Deferred align questions

**Master align Q7: Where should qualifier-aware claim-to-span stance assessment live, and what minimum assertion qualifiers are mandatory before two claims may be compared?**

The corpus supports placing it in the queued ground-before-cite follow-on,
after exact anchor verification and before app/server composition invokes the
existing admission port. Its revisable results should hand off to the
bitemporal edge core, not widen the verified-span substrate or redefine
`ClaimLifecycle`. The minimum comparison qualifiers supported here are
applicable dates, jurisdiction, procedural posture, actor role, polarity, and
scope; missing values should block comparison or yield an explicit mismatch,
not be silently defaulted
([retrieval report, “Design challenges” §2](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges);
`0421a1687b40` — ProVe).

## Tensions and limits

- Wide retrieval windows can improve candidate recall, but the target requires
  exact emitted spans. A wide window may propose evidence; it cannot become one
  synthetic cited span
  ([retrieval report, “Tensions & contradictions”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#tensions--contradictions)).

- The corpus is strong on architectural convergence and thin on production
  validation. No study tests privileged local legal documents, exact versioned
  spans, qualifier-complete assertions, current-authority checks, natural
  counterevidence, and attorney-reviewed admission end to end.

- ProVe is the strongest implementation evidence, yet excludes PDFs, tables,
  scans, and most meaningful refutation; its passage stance results are modest.
  The legal papers are principally formal or jurisprudential arguments without
  deployed legal-grounding benchmarks.

- Human approval is supported as a control shape, not validated as an accurate
  or affordable production process. Reviewer disagreement, workload,
  automation bias, and reopening behavior remain unmeasured.

- Calibrating source policy is outside this target's shaped scope and was routed
  separately by the owning report. This note requires the authority boundary
  and fixtures, not a universal authority model.

## Provenance

- Target scope read: [README](../README.md), [BRIEF](../BRIEF.md), and
  [MAP](../MAP.md). No target `SPEC.md` is present.

- Owning evidence:
  [retrieval-citation-grounding cluster](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md)
  and [legal-norms-reasoning cluster](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md).

- Per-paper deep reads consulted: `0421a1687b40` — ProVe;
  `703aea161905` — Argumentation and Standards of Proof;
  `73abf21862dc` — The adaptive nature of text-driven law;
  `7d7f8ed65c53` — Computable Models of the Law: Languages, Dialogues, Games,
  Ontologies; `1a72f7ffcd1c` — KGValidator; `036015670131` — Enhancing
  Knowledge Graph Consistency; and `d81e86e1d786` — IntKB. Titles and corpus
  identities are traceable through the
  [paper catalog](../../../explorations/academia-corpus-mining/research/paper-catalog.jsonl).

- This additive note executes align decisions 1 and 8 only as evidence
  dispatch. Binding prose remains a separate PR; the source mining packet parks
  after dispatch under align decision 7, and the approved second mining wave
  remains deferred under align decision 4.
