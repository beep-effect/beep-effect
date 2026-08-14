# identity-iri-fibered — inherited source corpus

Primary ledger: `explorations/identity-as-iri/research/SOURCES.md`.
This file reproduces the graduation-time corpus for implementation convenience;
the exploration ledger remains the primary copy.

# Identity as IRI — Sources & Provenance

- **Cluster / origin:** 2026-07-01 research fan-out: 3 spec-collection codex
  agents (`specs/`), 12 repo-mining codex agents (`repos/`), 3 repo audits,
  1 synthesis + 1 adversarial review. Seeded from the design handoff in
  [`../assets/`](../../../explorations/identity-as-iri/assets/).
- **Provenance:** design session distilled in
  [`../assets/identity-iri-fibration-handoff.md`](../../../explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md)
  (+ XML packet); raw transcripts remain local-only outside the repo.

## 1. Mined source corpus

The mined corpus is the 12 repo reports in [`repos/`](../../../explorations/identity-as-iri/research/repos/) — each report
carries its own file:line citations into its upstream repo. Dispositions are
per-pattern in the synthesis diamonds matrix
([`20-repo-mining-synthesis.md`](../../../explorations/identity-as-iri/research/20-repo-mining-synthesis.md) §2), corrected
by [`21-synthesis-adversarial-review.md`](../../../explorations/identity-as-iri/research/21-synthesis-adversarial-review.md)
and the arbitration rulings in [`../RESEARCH.md`](../../../explorations/identity-as-iri/RESEARCH.md).

## 2. Upstream repositories & licenses

Licenses verified in-repo by each miner (quoted in each report §2 / §1);
adversarial review confirmed no ledger row upgrades a reference-only source.

| Repo (local clone) | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| effect-ontology | MIT (verified) | port-with-attribution | Effect-native ontology/registry/SHACL service seams; local-name collision helpers; ValidationPolicy severity |
| ontosphere | Apache-2.0 (verified) | port-with-attribution | named-graph partitioning; dataset-faithful N-Quads/TriG + canonical hash proofs; reasoning+validation+repair loop; provenance isolation |
| rdflib.js | MIT (verified, MIT-LICENSE.txt) | port-with-attribution | four-position indexing; Namespace factory scar tissue; dotted-local fallback tests; sameAs-smushing warning |
| skygest | NOT VERIFIED (repo code); vendored TTL CC-BY-4.0 | REFERENCE-ONLY (patterns, never code) | entity-local toTriples modules; deterministic vendored-vocab generation + drift tests; projection metadata contracts |
| Ontorite | MIT (verified) | port-with-attribution | prefix registry as data; extraTriples-as-diagnostics warning; idempotent migration/sweep passes |
| ontograph-core | MIT (verified) | port-with-attribution | one assembled model → multiple pure projections; SHACL generation separate from authoring |
| ontology-master | MIT (verified) | port-with-attribution | rough gallery: string refs, hand-built serializers, placeholder vocab gaps |
| OWL-FOL-Bidirectional-Translator | MIT (verified) | port-with-attribution | pure kernel / adapters seam; typed axiom lowering after validation; round-trip canary tests |
| dxos (semantic-index pkg) | FSL-1.1-Apache-2.0 (verified) | REFERENCE-ONLY | provenance/valence channels; query-time conflicts; source cursors; store-layer seam; fuzzy-match anti-pattern |
| n3 (.repos vendored) | MIT (verified) | port-with-attribution | writer prefixed-name safety rule + full-IRI fallback; parser-side PN_LOCAL acceptance model; literal escaping |
| n3-types (.repos vendored) | NOT VERIFIED | REFERENCE-ONLY | template-literal union tricks (clean-room comparison only) |
| rdfjs-types (.repos vendored) | MIT (verified) | port-with-attribution | `NamedNode<Iri>` literal-preserving interfaces; DataFactory contract; boundary-interop target |

## 3. External research sources

Official specs fetched and cited (full per-source tables with fetch status at
the end of each spec doc):

- [`specs/01-iri-uri-curie.md`](../../../explorations/identity-as-iri/research/specs/01-iri-uri-curie.md) — RFC 3986
  (rfc-editor.org/rfc/rfc3986), RFC 3987 (rfc-editor.org/rfc/rfc3987), W3C
  CURIE Syntax 1.0 (w3.org/TR/curie/), RDFa Core 1.1 (w3.org/TR/rdfa-core/),
  plus RDF 1.1 Concepts and W3C slash/hash notes.
- [`specs/02-rdf-turtle-jsonld.md`](../../../explorations/identity-as-iri/research/specs/02-rdf-turtle-jsonld.md) — RDF 1.1
  Concepts (w3.org/TR/rdf11-concepts/), Turtle (w3.org/TR/turtle/), JSON-LD
  1.1 (w3.org/TR/json-ld11/), JSON-LD 1.1 API (w3.org/TR/json-ld11-api/).
- [`specs/03-vocabularies.md`](../../../explorations/identity-as-iri/research/specs/03-vocabularies.md) — SKOS Reference
  (w3.org/TR/skos-reference/), RDF Schema 1.1 (w3.org/TR/rdf-schema/), OWL 2
  Primer + New Features + Structural Spec (w3.org/TR/owl2-*), SHACL
  (w3.org/TR/shacl/), DCMI Terms (dublincore.org), PROV-O (w3.org/TR/prov-o/).

## 4. In-repo capability references

Audited with file:line detail in
[`10-audit-semantic-schema-metadata.md`](../../../explorations/identity-as-iri/research/10-audit-semantic-schema-metadata.md),
[`11-audit-identity-coupling.md`](../../../explorations/identity-as-iri/research/11-audit-identity-coupling.md),
[`12-audit-goals-supersession.md`](../../../explorations/identity-as-iri/research/12-audit-goals-supersession.md):

- `@beep/identity` (`packages/foundation/modeling/identity`) — IdentityComposer / `$I`; REWRITE-IN-PLACE target (surface shape-stable).
- `@beep/rdf` (`packages/foundation/modeling/rdf`) — Iri/Uri/Rdf(Curie, PrefixMap)/JsonLd/Vocab/* constants; EXTEND/reconcile; `SemanticSchemaMetadata` — reconciliation per audit recommendation.
- `@beep/ontology` (`packages/foundation/modeling/ontology`) — holds FOLIO `Ontology.models.ts` (§8 migration target); REPOPULATE.
- `@beep/semantic-web` (`packages/foundation/capability/semantic-web`) — SHACL/SPARQL runtime services; downstream consumer.
- `JSDocTagDefinition.make` — fibration prior art; first `Fibered` consumer.
- Old `@beep/ontology` prototype (packet [`../assets/ontology-prototype/`](../../../explorations/identity-as-iri/assets/ontology-prototype/)) — salvage donor (projections, assembly, error taxonomy, fixtures).
- NET-NEW: vocab registry literal types, CURIE expand/contract codec, PN_LOCAL codec, `$I.key`/`$I.class`/`$I.ontology` nominal entrypoints, `Fibered` kit, registry service.

## 5. Cross-links & provenance

- Exploration packet: [`../README.md`](../../../explorations/identity-as-iri/README.md) · [`../CAPTURE.md`](../../../explorations/identity-as-iri/CAPTURE.md) · [`../DECISIONS.md`](../../../explorations/identity-as-iri/DECISIONS.md) · [`../RESEARCH.md`](../../../explorations/identity-as-iri/RESEARCH.md)
- Design authority: [`../assets/identity-iri-fibration-handoff.md`](../../../explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md) (D1–D9) + [`../assets/identity-as-iri-agent-context.xml`](../../../explorations/identity-as-iri/assets/identity-as-iri-agent-context.xml)
- Synthesis + verification: [`20-repo-mining-synthesis.md`](../../../explorations/identity-as-iri/research/20-repo-mining-synthesis.md) · [`21-synthesis-adversarial-review.md`](../../../explorations/identity-as-iri/research/21-synthesis-adversarial-review.md)
- Prototype home: `scratchpad/identity/` (effect-only, test-enforced — see [`../DECISIONS.md`](../../../explorations/identity-as-iri/DECISIONS.md))
- Supersession pending: `goals/ontology-modeling-foundation` (edit specified in [`12-audit-goals-supersession.md`](../../../explorations/identity-as-iri/research/12-audit-goals-supersession.md), not yet applied)
