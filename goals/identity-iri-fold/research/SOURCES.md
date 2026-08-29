# Identity IRI Fold — Sources & Provenance

This implementation ledger reproduces the fold-relevant corpus from the
source exploration. The primary ledger remains
[`explorations/identity-as-iri/research/SOURCES.md`](../../../explorations/identity-as-iri/research/SOURCES.md).

- **Source exploration:** `explorations/identity-as-iri`
- **Design authority:** handoff D1–D9, ratified decisions, BRIEF, and MAP
- **Satisfied dependency:** `goals/identity-iri-core` (completed-retained 5/5)

## 1. Mined source corpus

| Source | License | Fold-relevant disposition |
| --- | --- | --- |
| effect-ontology | MIT | Port-with-attribution service/registry/SHACL seams; local-name collision and validation-severity patterns. |
| Ontorite | MIT | Port-with-attribution prefix-registry data and idempotent migration/sweep patterns; avoid a second `extraTriples` model. |
| ontograph-core | MIT | Port-with-attribution one-assembled-model to multiple pure projections. |
| OWL-FOL-Bidirectional-Translator | MIT | Port-with-attribution pure-kernel/adapters seam and post-validation lowering/round-trip canaries. |
| n3 | MIT | Port-with-attribution prefixed-name safety, full-IRI fallback, PN_LOCAL acceptance, and literal escaping. |
| rdflib.js | MIT | Port-with-attribution namespace and dotted-local scar tissue; no sameAs smushing. |
| skygest | license not verified | Reference-only entity-local facts and deterministic vocab drift patterns; never copy code. |
| dxos semantic-index | FSL-1.1-Apache-2.0 | Reference-only store seam/provenance patterns; no code. |
| n3-types | license not verified | Reference-only template-literal comparison. |
| rdfjs-types | MIT | Port-with-attribution literal-preserving boundary interface patterns. |

The detailed 12-report corpus with upstream `file:line` citations lives under
[`explorations/identity-as-iri/research/`](../../../explorations/identity-as-iri/research/)
and is synthesized in reports
[`20`](../../../explorations/identity-as-iri/research/20-repo-mining-synthesis.md)
and [`21`](../../../explorations/identity-as-iri/research/21-synthesis-adversarial-review.md).

## 2. Official external sources

- RFC 3986/3987 and W3C CURIE/RDFa grounding
  ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986),
  [RFC 3987](https://www.rfc-editor.org/rfc/rfc3987),
  [CURIE Syntax 1.0](https://www.w3.org/TR/curie/),
  [RDFa Core 1.1](https://www.w3.org/TR/rdfa-core/)):
  [`specs/01-iri-uri-curie.md`](../../../explorations/identity-as-iri/research/specs/01-iri-uri-curie.md).
- RDF 1.1, Turtle, and JSON-LD 1.1 grounding
  ([RDF 1.1 Concepts](https://www.w3.org/TR/rdf11-concepts/),
  [Turtle](https://www.w3.org/TR/turtle/),
  [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/),
  [JSON-LD API](https://www.w3.org/TR/json-ld11-api/)):
  [`specs/02-rdf-turtle-jsonld.md`](../../../explorations/identity-as-iri/research/specs/02-rdf-turtle-jsonld.md).
- SKOS, RDFS, OWL 2, SHACL, DCMI Terms, and PROV-O grounding
  ([SKOS](https://www.w3.org/TR/skos-reference/),
  [RDFS](https://www.w3.org/TR/rdf-schema/),
  [OWL 2](https://www.w3.org/TR/owl2-primer/),
  [SHACL](https://www.w3.org/TR/shacl/),
  [DCMI Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/),
  [PROV-O](https://www.w3.org/TR/prov-o/)):
  [`specs/03-vocabularies.md`](../../../explorations/identity-as-iri/research/specs/03-vocabularies.md).

The spec dossiers carry the exact official URLs and fetch records; do not
replace them with uncited summaries.

## 3. In-repo capabilities

| Capability | Path | Disposition |
| --- | --- | --- |
| Shipped identity/IRI core | `packages/foundation/modeling/identity` | Reuse unchanged; completed dependency. |
| RDF vocab + semantic metadata | `packages/foundation/modeling/rdf` | Reuse; layer documentation metadata under composer-owned addressing. |
| FOLIO ontology models | `packages/foundation/modeling/ontology/src/Ontology.models.ts` | Migration target. |
| Identity prototype fold/projections | `git show 61160e1baf:scratchpad/identity/{Ontology,Projections}.ts` (absent from all working trees; verified 2026-07-31) | Primary donor for fold semantics: tuple grammar, predicate-open `AssembledOntology` facts, CURIE handle resolution, `toContext`/`toJsonLd`/`toTurtle`, plus its 6 test files. Recover via `git show` at P0. |
| Deleted ontology prototype assets | exploration `assets/ontology-prototype/` (present; repo-owned) | Secondary donor for schema-first idioms and structure: `S.Class`/`TaggedErrorClass`/`LiteralKit` patterns, complete Markdown projection (`projectMarkdown`, portable/obsidian modes), SKOS integrity semantics, `parseJsonLdOntology`. Its enumerated draft/profile reference model and authoring API stay dead. Fix `.js` → `.ts` specifiers during port. |
| Semantic-web SHACL services | `packages/foundation/capability/semantic-web` | Downstream reference only; SHACL is out of this goal. |

## 4. Cross-links

- [`handoff D1–D9`](../../../explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md)
- [`BRIEF`](../../../explorations/identity-as-iri/BRIEF.md)
- [`DECISIONS`](../../../explorations/identity-as-iri/DECISIONS.md)
- [`MAP`](../../../explorations/identity-as-iri/MAP.md)
- [`identity-iri-core`](../../identity-iri-core/README.md)

License discipline is binding: unverified/FSL sources are reference-only;
permissive sources may be ported with attribution; official specifications are
the authority for syntax and vocabulary behavior.
