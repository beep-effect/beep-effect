---
generated: 2026-08-01
items: [P100, P101, R25]
---

# Late-item mining addendum

> **Campaign status:** These items were mined **AFTER** the track syntheses and have **NOT** passed the adversarial verify gate. They are routed to the `/adhd` integration pass; none of the observations below should be promoted to a verified campaign finding before that pass.

## P100 — FLINT actor-based legal relations

Source distillate: [P100](./mined/P100.md).

- P100 turns normative interpretation into a graph of Act and Fact frame prototypes.
- Facts describe a normative state; preconditioned Acts create or terminate facts to define valid successor states.
- Actor, recipient, object, and action slots make each transition explicitly n-ary.
- Duties are state facts with a holder and claimant, created and terminated through acts rather than asserted timelessly.
- The model gives a compact operational account of power-liability and duty-right relations.
- It does **not** replace `10-track-legal-core.md` F1's closed eight-position schema.
- FLINT covers the two positive Hohfeld pairs most directly, while the synthesis also requires privilege/no-right and immunity/disability.
- Nor does an Act frame replace F2's reified legal-position relator: it is better read as F7's power-exercise event that mutates those relators.
- The useful integration is therefore layered: Hohfeld position tuples describe what holds; FLINT-style transitions describe authorized changes.
- Route `hasPrecondition`, `creates`, and `terminates` to append-only bitemporal edge-revision events, not mutable current-state triples.
- Route frame-to-source links to the epistemic span/claim chain, adding authority, uncertainty, and competing interpretations absent from the paper.
- Route actor/recipient/object slots to authorization gates for assignments, licenses, waivers, filings, and office responses.
- `/adhd` must decide whether this strengthens F7 inside a new legal-core packet or only supplies a transition-pattern donor.

## P101 — high-level controlled legal language

Source distillate: [P101](./mined/P101.md).

- P101 is legal norm specification, not patent-LLM authoring; it remains in track 1.
- It inserts a reversible, human-controlled annotation layer between legal prose and machine-readable rules.
- The cascade performs term definition, shallow structure detection, clause normalization, and user-resolved anaphora.
- Every controlled statement stays linked through its rewrite steps to the original text fragment.
- Modality, conditions, exceptions, lists, roles, quantifiers, negation, and anaphora are treated as preservation obligations.
- Different analysts may choose different granularities, so normalized statements are interpretations rather than source facts.
- This complements synthesis F6's document/content/interpreted-norm identity split with a concrete transformation chain.
- It also operationalizes F9: unresolved actors, themes, conditions, or antecedents should fail or remain explicitly incomplete.
- Route the chain to `EvidenceSpan -> RewriteStep -> CandidateClaim`, with analyst, tool, version, and source digest on every step.
- Route controlled terms through semantic-foundation as provisional mappings, not automatic canonical SKOS concepts.
- Route office-action and regulation normalization to OIP human-review workflows before any reminder or agent action is generated.
- The single two-sentence example has no quantitative evaluation; `/adhd` should treat the pattern as design input, not validated extraction performance.

## R25 — executable FLINT ontology artifacts

Source distillate: [R25](./mined/R25.md).

- R25 supplies the implementation detail that P100's paper summary cannot: 16 OWL classes, 19 object properties, one data property, and 14 functions in the inspected snapshot.
- Its reusable core is the separation of frame prototypes, contextualized uses, concrete postcondition values, and cross-frame slot identity.
- `SlotCorrespondence` is especially relevant to @beep/ontology because it preserves the same actor, object, holder, claimant, or other atom across n-ary frames.
- Embedded rules normalize `creates`/`terminates` shorthands into explicit truth-valued postconditions.
- Source-fragment rules and example character ranges offer a direct bridge to the epistemic evidence-span model.
- Hard SHACL behavior requires exact actor/recipient cardinality, a postcondition, one complex-fact function/list, and acyclic operand use.
- Advisory shapes distinguish suspicious graphs from invalid ones, a useful two-tier import gate for government/legal drivers.
- The 22 executable competency queries can seed schema-required-field tests for frame, source, duty, operand, and slot retrieval.
- The library fixture shows duty creation/termination; tic-tac-toe shows reusable domain-neutral state transitions and source anchoring.
- Register the ontology IRI/version/commit as a donor under semantic-foundation rather than silently absorbing its vocabulary.
- Root Apache-2.0 artifacts are `port-with-attribution`; the `shacl/` subtree is MPL-2.0 and must be clean-room re-expressed, not vendored.
- The checked-in inference utility contains an invalid `Path(..., format=...)` call and has no automated proof, so do not treat it as ready infrastructure.
- `/adhd` should reconcile repo-era changes with P100 and decide whether SlotCorrespondence becomes a first-class Beep schema or an extraction-only construct.

## Integration questions for `/adhd`

1. Does FLINT become the transition semantics layered over the synthesis's Hohfeldian position relator, or only an attributed donor pattern?
2. Should controlled-language rewrite steps live in the epistemic core, a legal extraction package, or an OIP workflow package over the core?
3. Which FLINT competency questions become hard Effect schema requirements versus import warnings?
4. How should Beep represent exogenous events, omissions, violations, deadlines, and privilege/immunity positions that FLINT leaves out?
5. Is clean-room re-expression of the MPL SHACL behavior worth the maintenance cost, or are equivalent Effect Schema validators sufficient?
