# @beep/semantic-web

Semantic-web capability package for JSON-LD, SHACL/SPARQL service contracts,
IRI/URI helpers, and compatibility surfaces.

Canonical RDF value models, PROV-O models, evidence anchors, and Web Annotation
DTOs live in `@beep/rdf`. RDF Dataset Canonicalization lives in the driver
package `@beep/rdf-canonize`.

## Surface

- `@beep/semantic-web/iri`
- `@beep/semantic-web/uri`
- `@beep/semantic-web/jsonld`
- `@beep/semantic-web/services/*`
- `@beep/semantic-web/adapters/jsonld-context`
- `@beep/semantic-web/adapters/jsonld-document`
- compatibility shims for `@beep/semantic-web/prov`, `@beep/semantic-web/evidence`, and `@beep/semantic-web/adapters/web-annotation`

## Canonical Imports

```ts
import { IRI } from "@beep/semantic-web/iri"
import { JsonLdDocument } from "@beep/semantic-web/jsonld"
import { JsonLdDocumentService } from "@beep/semantic-web/services/jsonld-document"
import { ProvBundle, EvidenceAnchor, makeQuad } from "@beep/rdf"
```

Canonicalization is intentionally outside the foundation capability package:

```ts
import { canonicalization } from "@beep/rdf-canonize"
```

## Development

```bash
bun run check
bun run test
bun run lint:fix
```

## License

MIT
