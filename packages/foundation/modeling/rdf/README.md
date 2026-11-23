# @beep/rdf

Domain-safe RDF and linked-data modeling primitives.

`@beep/rdf` owns pure value models for URI identifiers, RDF/JS-aligned
terms and datasets, bounded JSON-LD value shapes, and core vocabulary constants.
It is a `foundation/modeling` package so domain schemas can import it without
taking a dependency on `@beep/semantic-web`. The RFC 3987 IRI schemas live in
`@beep/identity/Iri`.

## Canonical Imports

```ts
import { IRI } from "@beep/identity/Iri"
import { NamedNode, makeNamedNode } from "@beep/rdf/Rdf"
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd"
```

## Development

```bash
bun run --filter=@beep/rdf check
bun run --filter=@beep/rdf test
bun run --filter=@beep/rdf lint
```

## Pinned vocabulary provenance

The term lists of the pinned external namespaces (`as`, `cito`, `deo`,
`doco`, `fabio`, `gufo`, `nif`, `oa`, `prov`, `skos` and `xsd`) are acquired
by `bun run beep sync-data-to-ts --target pinned-vocabularies`. Each pin names
an immutable upstream commit or a dated W3C artifact with its SHA-256 digest
and the metadata markers the artifact must carry; the target refuses byte
drift, a missing marker and a curated term the artifact does not declare.
It writes the identity registry shards
(`packages/foundation/modeling/identity/registry/namespaces/<prefix>.json`)
and the pin sidecar `src/Vocab/generated/namespace-pins.data.json`, which
records each pin's source, license, attribution and term digest. Licenses
and attribution are in the root THIRD_PARTY_NOTICES.md, in the SPAR and the
pinned RDF vocabulary sections. The Md section adapter preserves syntax
nodes and keeps structural/rhetorical typing in the separate document
annotation body.
