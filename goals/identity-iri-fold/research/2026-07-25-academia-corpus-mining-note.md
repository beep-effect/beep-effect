# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** attach-to `goals/identity-iri-fold` (high priority)
- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)
- **Owning reports:** [memory and bitemporal](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md), [legal ontology design](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md), [legal norms and reasoning](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md), and [retrieval and citation grounding](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached identity-iri-fold

The dispatched insight is: “Add negative fold fixtures and scoped, reversible
mapping records outside the fold.” It reinforces the packet's existing mission:
deterministic tuple assembly and pure projection through nominal `$I.key`,
`$I.class`, and `$I.ontology` entrypoints, without turning the fold into a
legal-meaning engine ([target README](../README.md), [target SPEC](../SPEC.md)).

The corpus repeatedly separates stable IRIs, storage identifiers, labels,
aliases, conceptual meanings, and claims of equivalence. A fold can prove that
an allowed schema handle, known CURIE, or absolute IRI resolves deterministically;
it cannot infer that two resources denote the same thing because their labels,
translations, suffixes, predicates, or vocabulary memberships resemble one
another ([memory report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#design-challenges);
[ontology report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#design-challenges)).

This dispatch is therefore a boundary-hardening input, not new fold authority.
Semantic mappings should be explicit, scoped, evidenced, reviewable, and
reversible records outside deterministic assembly. That preserves the SPEC's
fold-first grammar, typed diagnostics, pure projections, and prohibition on
synonym methods while respecting align decision 8: this additive note does not
change binding documents.

## Distilled requirements

1. **Reject resemblance as fold authority.** Acceptance fixtures should prove
   that equal labels, translated labels, shared local-name suffixes, one matching
   predicate, and shared vocabulary membership do not authorize identity
   folding. Evidence: [ontology report, “Design challenges” and “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns),
   especially `e6bc0ec90155 — Formalising Ontologies and Their Relations`,
   `3c06bfc28d1d — Classifications and the Law: Doctrinal Classifications vs. Computational Ontologies`,
   and `5943ec738200 — Declarative Repairing Policies for Curated KBs`.

2. **Keep semantic correspondence outside deterministic assembly.** Any
   equivalence, redirect, exact/close/broader/narrower relationship, or
   intentional non-equivalence used by a consumer should be supplied as a
   separate mapping record, never inferred or created by `$I.ontology`.
   Removing or replacing that record must leave the underlying IRIs and source
   tuples intact. Evidence: [ontology report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#direct-patterns),
   `e6bc0ec90155`, and [norms report, “Typed concept-mapping and hierarchy validation”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns),
   citing `e4c1e92b3477 — A Linked Term Bank of Copyright-Related Terms`.

3. **Require mapping scope sufficient for later reversal.** A candidate mapping
   record should identify its mapping type, participating IRIs, source and
   source version, jurisdiction or community where applicable, governing
   instrument or purpose, reviewer or adopting authority, review state, and
   validity/version scope. The fold need only preserve or project an explicitly
   admitted record; ownership and adjudication of that record remain outside
   this packet. Evidence: [norms report, “Design challenges,” item 6](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#design-challenges)
   and `e4c1e92b3477`; [ontology report, “Tensions & contradictions”](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#tensions--contradictions).

4. **Preserve ambiguity as a typed negative result.** When a mention, alias, or
   citation surface form has multiple candidate IRIs, assembly must not select
   one by string similarity or ontology range alone. The fixture should retain
   the candidates outside the fold and produce the packet's typed
   unresolved/ambiguous diagnostic rather than a projected identity assertion.
   Evidence: [retrieval report, “Stage-attributable citation identity resolution”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#direct-patterns),
   `d81e86e1d786 — IntKB: A Verifiable Interactive Framework` and
   `8872b8387074 — Artificial Intelligence and Legal Discourse: The Flexlaw Legal`.

5. **Treat an approved identity change as a global, inspectable input delta.**
   A fixture for an externally approved fold should enumerate every affected
   reference before assembly, reject partial tuple-local replacement, and prove
   byte-identical assembly and projections for repeated application of the same
   complete delta. Evidence: [ontology report, “Delta vs the June-29 prior synthesis”](../../../explorations/academia-corpus-mining/research/t3-legal-ontology-design.md#delta-vs-the-june-29-prior-synthesis)
   and `5943ec738200`; [memory report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#design-challenges)
   and `d9e73d47d4a2 — Formal Foundations for RDF/S KB Evolution`.

6. **Do not encode renames as delete-and-recreate identity changes.** A label or
   alias change on a stable IRI should preserve the resource identity, while an
   equivalence correction should remain an evidenced, time-indexed mapping
   change. Replaying either history must not manufacture a new authoritative
   entity or erase the earlier mapping state. Evidence: [memory report,
   “Reasoner-aware longitudinal change analysis”](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#direct-patterns),
   `10828be135bf — Finding fault`, and
   `2ebef49a0b91 — Construction of Knowledge Graphs`.

7. **Keep assertion lineage distinct from entity folding.** Two separately
   sourced assertions about the same resolved IRIs may disagree without being
   duplicate versions of one assertion lineage. Fold fixtures should prove only
   deterministic endpoint identity and must not collapse, supersede, or select
   between those evidence records. Evidence: [memory report, “Design
   challenges,” item 4](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#design-challenges)
   and `5c2aeef6919d — Ontology Revision as Non-Prioritized Belief Revision`;
   this also preserves align decision 3's retained inconsistent evidence and
   recoverable preferred working views.

## Fixture candidates

- **Equal label, distinct resources:** two absolute IRIs carry the same English
  label but no mapping record. Both survive assembly and projection as distinct;
  no identity edge is synthesized.

- **Different labels, explicit correspondence:** two IRIs have unrelated labels
  but an approved, scoped mapping record. Assembly is deterministic from the
  explicit record, demonstrating that correspondence is deliberate rather than
  lexical (`e6bc0ec90155`).

- **Translated-label false friend:** two jurisdiction-specific concepts share a
  translation but have different governing instruments or scopes. The fold
  preserves both and reports no equivalence (`3c06bfc28d1d`, `e4c1e92b3477`).

- **Intentional non-equivalence:** a mapping set records that two identically
  named attributes remain distinct. Projection preserves that decision, and
  removing the mapping set leaves the original tuples unchanged
  (`e6bc0ec90155`).

- **Ambiguous mention:** one exact surface form resolves to two ranked IRI
  candidates. Neither rank nor range authorizes a fold; the result is a typed
  unresolved/ambiguous diagnostic (`d81e86e1d786`).

- **Rename without identity churn:** release B changes only the label attached
  to a stable IRI. The assembled identity remains stable, while a
  release-difference projection reports the label change without deletion and
  recreation (`10828be135bf`).

- **Reversible mapping correction:** version 1 records a scoped close mapping;
  version 2 retracts it and records an unresolved or disputed state. Replaying
  either version is deterministic, and switching versions never mutates the
  source IRIs (`2ebef49a0b91`, `e4c1e92b3477`).

- **Global-impact guard:** an approved replacement affects several tuples.
  Supplying an incomplete impact set fails the gate; supplying the complete
  externally reviewed delta yields byte-identical repeated projections
  (`5943ec738200`).

- **Separate disagreement lineages:** two sources make contradictory assertions
  using the same resolved subject and predicate. Both remain addressable;
  identity resolution neither merges their lineage IDs nor chooses a preferred
  assertion (`5c2aeef6919d`).

- **Reversed hierarchy negative:** a proposed mapping reverses the intended
  specific-to-general SKOS direction. The typed mapping/hierarchy gate rejects
  it rather than repairing or silently projecting it (`e4c1e92b3477`).

## Deferred align questions

- Master align Q5: How should no-overlap identity distinguish one assertion lineage from separately sourced disagreement without allowing duplicate authoritative versions inside either lineage?

The corpus supports a compound identity boundary: assertion lineage should be
keyed by the claim's qualifier-complete identity plus its derivation or
supersession ancestry, while source identity remains part of the evidence
record. Separately sourced disagreement therefore creates distinct lineages
that may coexist, whereas a new version within one lineage must atomically
close or supersede its predecessor rather than overlap it
([memory report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md#design-challenges);
[retrieval report, “Qualifier-free claim identity makes verification unsound”](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges)).
Preferred-view membership should be a recoverable projection over those
lineages, consistent with align decision 3, not an identity fold or destructive
deduplication (`5c2aeef6919d`, `0421a1687b40 — ProVe`).

## Tensions and limits

- The target SPEC excludes general version fibers and unrelated ontology-domain
  expansion. Consequently, this note proposes negative boundary fixtures and
  an external mapping-record contract; it does not propose that
  `identity-iri-fold` own a mapping registry, bitemporal store, belief selector,
  or semantic-equivalence reasoner.

- Stable IRIs provide continuity, but the legal-ontology papers warn that
  meaning varies by jurisdiction, instrument, purpose, community, and time.
  Stability must not be mistaken for timeless intension.

- Global identity deltas are safer to inspect than tuple-local replacements,
  but exhaustive global repair is exponential and was evaluated only on modest
  synthetic knowledge bases (`5943ec738200`). The fixture can require complete
  declared impact without claiming globally optimal semantic repair.

- The corpus is strong on architectural convergence and thin on production
  validation. It contains formal models, surveys, prototypes, one biomedical
  release history, older legal retrieval systems, and mostly small or
  hand-modeled legal examples; it does not validate a production USPTO identity
  fold, mapping-governance workflow, or attorney review burden.

- Align decision 2 correctly keeps approval vocabulary separate from truth:
  reviewer approval can record a scoped human disposition on a mapping, but it
  cannot make the mapped concepts universally identical. Align decision 5 also
  keeps qualified legal argumentation downstream rather than widening this fold
  into “more ontology.”

## Provenance

The target scope was read first from [README.md](../README.md) and
[SPEC.md](../SPEC.md). Route evidence was then mined from the four linked
cluster reports, with the owning memory report controlling the lineage and
rename cautions and the legal-ontology report supplying the dispatched fixture
and mapping boundary.

Gold-tier deep-read notes inspected for this dispatch were
`e6bc0ec90155 — Formalising Ontologies and Their Relations`,
`5943ec738200 — Declarative Repairing Policies for Curated KBs`,
`3c06bfc28d1d — Classifications and the Law: Doctrinal Classifications vs. Computational Ontologies`,
`d9e73d47d4a2 — Formal Foundations for RDF/S KB Evolution`,
`10828be135bf — Finding fault`,
`2ebef49a0b91 — Construction of Knowledge Graphs`,
`5c2aeef6919d — Ontology Revision as Non-Prioritized Belief Revision`, and
`0421a1687b40 — ProVe`. Silver notes inspected for route-specific
corroboration were `e4c1e92b3477 — A Linked Term Bank of Copyright-Related Terms`,
`d81e86e1d786 — IntKB: A Verifiable Interactive Framework`, and
`8872b8387074 — Artificial Intelligence and Legal Discourse: The Flexlaw Legal`.
Titles were checked against the cluster reports and
[paper catalog](../../../explorations/academia-corpus-mining/research/paper-catalog.jsonl);
no DOI, URL, or bibliographic identifier is inferred here.
