# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** attach-to `goals/semantic-foundation` (high priority)
- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)
- **Owning reports:** [legal ontology design](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md), [legal norms and reasoning](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md), [agent metacognition and neuro-symbolic architecture](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md), and [agent security and orchestration](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached semantic-foundation

The target already owns a bounded M1 substrate: repo-owned SKOS concepts,
vetted FOLIO alignment metadata, and an `@beep/ontology` registry/loader.
It explicitly excludes a graph store, SPARQL runtime, law-practice entities,
and legal reasoning machinery
([README](../README.md#mission);
[SPEC, Objective](../SPEC.md#objective);
[SPEC, Non-Goals](../SPEC.md#non-goals)).

The corpus does not justify changing that boundary. It does show that M1
acceptance evidence should make several distinctions explicit: competency
question versus implementation example, asserted versus entailed result,
open-world consistency versus closed-world integrity, approved mapping versus
identity, and supported reasoning fragment versus unsupported or exhausted
reasoning.

Those distinctions protect the existing registry/loader contract. They prevent
a successful classification, mapping, consistency check, or future SHACL result
from being consumed as source existence, legal validity, or adjudicated truth
([legal ontology design, Design challenges](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#design-challenges);
[legal norms and reasoning, Design challenges](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#design-challenges)).

Align decision 5 fixes the next legal layer as qualified argumentation and
evaluation, not “more ontology.” Accordingly, these diagnostics should expose
where M1 stops. They must not import arguments, defeaters, proof standards,
procedural effects, or audience-relative acceptance into the semantic seed.

Align decision 8 also fixes the change shape: this additive note records
research input, while any binding SPEC, PLAN, or product-language amendment
belongs in a separate PR.

## Distilled requirements

1. **Represent each adopted M1 competency question as a replayable fixture.**
   A fixture should identify its controlled-language question, resolved stable
   IRIs, exact seed or manifest snapshot, expected evaluation regime, expected
   result, and typed mismatch explanation. The test passes only when replay
   against the named snapshot produces the declared result; unresolved or
   ambiguous IRIs must fail explicitly. Evidence:
   `3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL`
   ([legal ontology design, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns)).

2. **Label asserted and entailed observations independently.**
   A diagnostic must state whether its answer is present in committed input,
   derived under a named supported profile, contradicted, or unknown. An
   asserted-only M1 implementation may report entailment as unavailable; it
   must not silently treat absence as false or simulate a reasoner. Test with
   one explicit concept relation and one relation obtainable only through the
   fixture's declared inference assumptions. Evidence:
   `7c1bd43b5958 — A Quality Assurance Workflow for Ontologies based on`
   and `3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL`
   ([legal ontology design, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns)).

3. **Run open-world and closed-world diagnostics as separate regimes.**
   The same incomplete input must be able to remain open-world-consistent while
   failing a closed-world existence or completeness check. Each result must
   name its regime and input snapshot. Neither result may overwrite the other
   or be described as legal truth. Evidence:
   `36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational`
   and `abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations`
   ([legal ontology design, Tensions and contradictions](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#tensions--contradictions)).

4. **Return typed, localized diagnostic verdicts rather than Boolean success.**
   At minimum, fixtures should distinguish asserted, entailed, contradicted,
   unknown, closed-world-invalid, unsupported-fragment, and budget-exhausted.
   Failures should identify the focal IRI and implicated statements or path
   where available. A clean consistency result must not imply source existence,
   mapping correctness, or legal resolution. Evidence:
   `abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations`
   and `1ce62d3842ef — Knowledge representation and acquisition: Reflections on implicitly learning`
   ([legal ontology design, Design challenges](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#design-challenges);
   [metacognition, Design challenges](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#design-challenges)).

5. **Diagnose mappings as scoped assertions, never label-derived identity.**
   Every vetted `skos:exactMatch` or `skos:closeMatch` fixture should carry the
   mapped IRIs, mapping kind, source vocabulary and version, scope or
   jurisdiction where applicable, evidence, reviewer disposition, and any
   intentional non-equivalence. Equal labels, translations, shared suffixes,
   or vocabulary overlap must not satisfy the fixture. Evidence:
   `e6bc0ec90155 — Formalising Ontologies and Their Relations`,
   `e4c1e92b3477 — A Linked Term Bank of Copyright-Related Terms`, and
   `d0ac8b86974d — Ontologies, ICTs and Law The International Ontojuris Project`
   ([legal ontology design, Design challenges](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#design-challenges);
   [legal norms and reasoning, Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns)).

6. **Make hierarchy direction an executable mapping invariant.**
   A fixture must accept the SKOS direction from a specific concept to its
   broader general concept and reject the inverse. This directly guards the
   reversed-hierarchy defect reported in
   `e4c1e92b3477 — A Linked Term Bank of Copyright-Related Terms`
   ([legal norms and reasoning, Quality notes](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#quality-notes)).

7. **Declare the reasoning fragment and operational limits of every derived result.**
   A reasoner-backed fixture, if later adopted behind an existing gate, should
   name its logic/profile, engine version, completeness claim, time or resource
   budget, and terminal outcome. A query outside the profile or beyond budget
   must return its own verdict rather than `false` or generic `unknown`.
   For M1, the valid declaration may simply be that no general reasoner is
   supported. Evidence:
   `1ce62d3842ef — Knowledge representation and acquisition: Reflections on implicitly learning`
   ([metacognition, Tensions and contradictions](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#tensions--contradictions);
   [metacognition, Routing suggestions](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#routing-suggestions)).

8. **Treat the M1 intake loop as plumbing proof, not legal evaluation.**
   Its fixture may prove document-to-concept-to-class-to-filing-path resolution,
   mapping provenance, and deterministic replay. It must not claim semantic
   usefulness, legal validity, authorization, or adjudicated correctness.
   Argumentation and evaluation remain the recorded next layer under align
   decision 5. Evidence:
   `93289ccbf666 — The Future of Law: Relational Justice, Web Services`
   ([legal norms and reasoning, Corroborations](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#corroborations)).

9. **Reject diagnostic proposals that widen M1.**
   A candidate fails packet review if it requires SPARQL execution, a graph
   store, new SHACL behavior, law-practice entities, autonomous legal-action
   policy, argument graphs, proof standards, or procedural reasoning. The
   contextual legal-action relations suggested by
   `cd46cb0bd639 — Authorized and Unauthorized Practices of Law: The Role`
   therefore remain future domain/governance input, not M1 additions
   ([security and orchestration, Routing suggestions](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#routing-suggestions);
   [SPEC, Stop Conditions](../SPEC.md#stop-conditions)).

## Fixture candidates

- **Asserted versus entailed hierarchy:** commit a small concept hierarchy in
  which one broader relation is explicit and another is reachable only under a
  named transitive rule. Expect separate asserted and entailed observations;
  with no supported reasoner, expect `unsupported-fragment`.

- **Open-world reference gap:** provide a source record that refers to a missing
  target. Expect open-world consistency or unknown existence alongside a
  closed-world missing-record violation. The fixture fails if either regime is
  presented as subsuming the other.

- **Mapping by label collision:** give two concepts the same English label but
  different jurisdictions, sources, or meanings. Expect no exact mapping until
  an evidence-bearing mapping disposition is supplied.

- **Exact versus close alignment:** map one repo-owned concept to two external
  concepts, one approved as exact within a stated scope and one only close.
  Expect both records to survive independently and no identity fold.

- **Reversed SKOS hierarchy:** provide a specific legal term whose fixture
  incorrectly points from the general concept to the specific concept through
  `skos:broader`. Expect a typed hierarchy-direction failure naming both IRIs.

- **Quantifier mutation:** replay otherwise identical competency questions for
  at-most, at-least, and exactly three. Expect distinct results and reject any
  normalization that collapses the three, reflecting the defect found in
  `3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL`.

- **Unsupported reasoning profile:** ask the M1 surface for a temporal,
  defeasible, or unrestricted first-order conclusion. Expect
  `unsupported-fragment`, the declared M1 capability profile, and no fallback
  to guessed or label-derived output.

- **Budget exhaustion:** run a bounded diagnostic fixture whose allowed budget
  is deliberately insufficient. Expect `budget-exhausted` with consumed budget
  and snapshot identity, never `false`, `unknown`, or partial success.

- **Classification is not validity:** classify a sample document successfully,
  then ask whether its legal position prevails. Expect the classification
  evidence to remain valid while the legal question is rejected as outside M1
  and routed conceptually to the argumentation/evaluation layer.

## Tensions and limits

- The corpus is strong on architectural convergence and thin on production
  validation. Its best support is for distinctions, typed outcomes, and
  negative fixtures—not for claims that these diagnostics improve legal work.

- Several ontology-QA mechanisms were evaluated on biomedical, synthetic, or
  small non-legal ontologies. Transfer to legal vocabularies, attorney
  comprehension, and production-scale costs remains unproved
  ([legal ontology design, Quality notes](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#quality-notes)).

- `3033635e217a` contains a material cardinality inconsistency, while
  `7c1bd43b5958` reports compressibility and candidate irregularities without
  precision or recall. They support adversarial fixtures, not adoption of
  their tools or reported correctness.

- `e6bc0ec90155` supplies a rigorous mapping model but only a toy worked domain,
  no implementation, and no evidence that a mechanically compatible mapping is
  semantically correct. Human-reviewed correspondence remains separate from
  consistency checking.

- M1 is already reported complete in the target README. Owners should decide
  whether these candidates become regression fixtures, later M4 inputs, or
  acceptance vocabulary for subsequent releases; this note does not reopen M1.

- Align decision 2 assigns typed-verdict corrections to
  `docs/product/prose-to-proof.md` in a separate PR. This note may use that
  vocabulary, but it neither performs nor substitutes for the binding-doc edit.

- The security report's function-, audience-, jurisdiction-, practitioner-, and
  matter-specific policy route is useful boundary evidence, but implementing
  its legal-service entities here would violate the current SPEC. Closed
  structural diagnostics may guard M1; open-textured legal action and
  authorization remain outside static ontology types.

## Provenance

Target scope was grounded in [the packet README](../README.md) and
[the normative SPEC](../SPEC.md). No target requirement is amended here.

Relevant cluster sections read were the owning report's
[Design challenges](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#design-challenges),
[Direct patterns](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns),
[Tensions and contradictions](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#tensions--contradictions),
and [Quality notes](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#quality-notes);
the corresponding design, mapping, M1-boundary, reasoning-fragment, and
routing sections of the other three owning reports linked above were also read.

Gold-tier deep reads consulted from the local Academia corpus notes were:

- `36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational`
- `e6bc0ec90155 — Formalising Ontologies and Their Relations`

Silver-tier deep reads consulted were:

- `3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL`
- `abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations`
- `7c1bd43b5958 — A Quality Assurance Workflow for Ontologies based on`
- `e4c1e92b3477 — A Linked Term Bank of Copyright-Related Terms`
- `d0ac8b86974d — Ontologies, ICTs and Law The International Ontojuris Project`
- `93289ccbf666 — The Future of Law: Relational Justice, Web Services`
- `1ce62d3842ef — Knowledge representation and acquisition: Reflections on implicitly learning`
- `cd46cb0bd639 — Authorized and Unauthorized Practices of Law: The Role`

Paper identifiers and titles follow the cluster reports and the
[paper catalog](../../../explorations/academia-corpus-mining/research/paper-catalog.jsonl).
No paper URL, DOI, or bibliographic identifier is inferred.
