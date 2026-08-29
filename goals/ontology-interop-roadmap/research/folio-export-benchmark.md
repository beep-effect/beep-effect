# FOLIO Export Benchmark

Access date: 2026-06-04

## Sources

- Browse page: https://folio.openlegalstandard.org/taxonomy/browse
- OpenAPI: https://folio.openlegalstandard.org/openapi.json
- Example IRI JSON: https://folio.openlegalstandard.org/R8pNPutX0TN6DlEqkyZuxSw
- Example JSON-LD: https://folio.openlegalstandard.org/R8pNPutX0TN6DlEqkyZuxSw/jsonld
- Example XML: https://folio.openlegalstandard.org/R8pNPutX0TN6DlEqkyZuxSw/xml
- Example Markdown: https://folio.openlegalstandard.org/R8pNPutX0TN6DlEqkyZuxSw/markdown
- Example HTML: https://folio.openlegalstandard.org/R8pNPutX0TN6DlEqkyZuxSw/html
- Local source: `/home/elpresidank/YeeBois/legal_ontologies/openlegalstandards_folio/folio-api`
- Local source: `/home/elpresidank/YeeBois/legal_ontologies/openlegalstandards_folio/folio-mcp`

## Live Endpoint Check

All checked endpoints returned HTTP 200 on 2026-06-04.

| URL | Content type |
| --- | --- |
| `/taxonomy/browse` | `text/html; charset=utf-8` |
| `/openapi.json` | `application/json` |
| `/R8pNPutX0TN6DlEqkyZuxSw` | `application/json` |
| `/R8pNPutX0TN6DlEqkyZuxSw/jsonld` | `application/ld+json` |
| `/R8pNPutX0TN6DlEqkyZuxSw/xml` | `application/xml` |
| `/R8pNPutX0TN6DlEqkyZuxSw/markdown` | `text/markdown; charset=utf-8` |
| `/R8pNPutX0TN6DlEqkyZuxSw/html` | `text/html; charset=utf-8` |

## Representation Pattern

FOLIO exposes a base IRI resolver plus format suffixes:

- `/{iri}` -> JSON
- `/{iri}/jsonld` -> JSON-LD
- `/{iri}/xml` -> XML labeled as OWL XML in the UX/source
- `/{iri}/markdown` -> Markdown
- `/{iri}/html` -> human detail page

Local `folio-api` source confirms the suffix routes in `folio_api/routes/root.py`.
The HTML detail page includes a "Download as" affordance for JSON, JSON-LD,
OWL XML, and Markdown. `folio-mcp` mirrors export behavior for `markdown`,
`jsonld`, and `owl_xml`.

## Example Class Shape

The example class is `Lessor`.

The JSON and Markdown representations expose:

- IRI
- label
- alternative labels
- translations
- hidden label
- definition
- subclass relationship
- deprecated flag
- identifier

The JSON-LD representation emits:

- `@type: owl:Class`
- `rdfs:label`
- `rdfs:subClassOf`
- `skos:altLabel`
- `skos:hiddenLabel`
- `skos:definition`
- `dc:identifier`

The XML representation for the class is best described as RDF/XML-style
`owl:Class` XML with `rdf:about`, `rdfs:subClassOf`, `rdfs:label`,
`skos:altLabel`, `skos:hiddenLabel`, and `skos:definition`. It is not evidence
that v1 should implement full OWL 2 XML serialization.

## Benchmark Value

FOLIO is valuable as a user-experience and API benchmark:

- browse pages need stable class/concept cards
- detail pages need readable metadata and copyable IRIs
- format suffixes make API exploration easy
- Markdown export is useful for documentation and RAG ingestion
- JSON-LD remains the semantic web interchange spine
- XML/OWL XML parity is useful for compatibility but not necessary for v1

## Roadmap Recommendations

1. Use FOLIO as inspiration, not mandatory v1 parity.
2. Prioritize JSON-LD, Turtle, and Markdown projection from `@beep/ontology`.
3. Make SKOS labels, definitions, hidden labels, multilingual labels, hierarchy,
   and mappings first-class profile data.
4. Defer XML/OWL XML until the ontology model supports a clearer OWL surface.
5. Keep HTML pages, visual browsers, and route suffixes in future app/server
   layers, not in foundation/modeling packages.

## Risks

- FOLIO OpenAPI response schemas/content metadata are looser than live response
  content types.
- Property JSON shape appears less clean than class JSON because the root route
  is class-biased.
- XML output is labeled OWL XML, but class samples look closer to RDF/XML-style
  OWL class snippets.
