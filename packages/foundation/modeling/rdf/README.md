# @beep/rdf

Domain-safe RDF and linked-data modeling primitives.

`@beep/rdf` owns pure value models for IRI/URI identifiers, RDF/JS-aligned
terms and datasets, bounded JSON-LD value shapes, and core vocabulary constants.
It is a `foundation/modeling` package so domain schemas can import it without
taking a dependency on `@beep/semantic-web`.

## Canonical Imports

```ts
import { IRI } from "@beep/rdf/Iri"
import { NamedNode, makeNamedNode } from "@beep/rdf/Rdf"
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd"
```

## Development

```bash
bun run --filter=@beep/rdf check
bun run --filter=@beep/rdf test
bun run --filter=@beep/rdf lint
```

## SPAR provenance

DOCO, DEO, FaBiO and CiTO inventories are acquired from immutable upstream
commits by `bun run beep sync-data-to-ts --target spar-terms`. The target
checks byte and semantic digests before writing the curated inventories and
identity registry. Each pinned artifact is CC BY 4.0; attribution and release
paths are in the root THIRD_PARTY_NOTICES.md SPAR section and the target's
data sidecar. The Md section adapter preserves syntax nodes and keeps
structural/rhetorical typing in the separate document annotation body.
