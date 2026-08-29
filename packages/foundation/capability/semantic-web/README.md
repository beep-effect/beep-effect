# @beep/semantic-web

RDF capability service contracts plus the exact identity-registry RDF binding
and SHACL policy projection. This package is the ports layer between the RDF
value models in `@beep/rdf` and the driver packages that implement the
contracts.

Canonical RDF value models, IRI/URI schemas, vocabularies, PROV-O models,
evidence anchors, and Web Annotation DTOs live in `@beep/rdf`. RDF Dataset
Canonicalization lives in the driver package `@beep/rdf-canonize`; the
`shacl-engine`-backed validator lives in `@beep/shacl`; the bounded validator
behind the epistemic claim gate lives in `@beep/epistemic-server`.

## Surface

- `@beep/semantic-web` (root: service contracts plus identity RDF binding,
  dataset registry layer, and SHACL projection)
- `@beep/semantic-web/services/canonicalization`
- `@beep/semantic-web/services/shacl-validation`
- `@beep/semantic-web/services/sparql-query`

## Canonical Imports

```ts
import { SparqlQueryService } from "@beep/semantic-web/services/sparql-query"
import { ShaclValidationService } from "@beep/semantic-web/services/shacl-validation"
import { CanonicalizationService } from "@beep/semantic-web/services/canonicalization"
import { entriesToDataset, projectShapes } from "@beep/semantic-web"
import { ProvBundle, EvidenceAnchor, makeQuad, IRI } from "@beep/rdf"
```

## Consumers

Named importers (the `foundation/capability` gate requires this list):

- `@beep/epistemic-use-cases` — programs the claim gate against `ShaclValidationService`.
- `@beep/epistemic-server` — provides the bounded validator for the claim gate and wires the contract at the layer boundary.
- `@beep/ontology-use-cases` — session validation and SPARQL aggregates over the contracts.
- `@beep/ontology-server` — wires the `@beep/shacl` and `@beep/oxigraph` drivers to the contracts.
- `@beep/shacl` — driver implementing `ShaclValidationService` over `shacl-engine`.
- `@beep/oxigraph` — driver implementing `SparqlQueryService` over Oxigraph.
- `@beep/rdf-canonize` — driver implementing `CanonicalizationService` over `rdf-canonize`.

## Development

```bash
bun run check
bun run test
bun run lint:fix
```

## License

Apache-2.0
