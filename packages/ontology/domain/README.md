# @beep/ontology-domain

Ontology workbench domain package for RDF-backed session models.

## Boundary

`@beep/ontology-domain` is the domain role for the product slice under
`packages/ontology/*`. It models user ontology documents as file-backed Turtle
sessions with typed change operations, derived graph partitions, undo/redo, and
read-model inputs for the workbench.

The similarly named `@beep/ontology` package lives at
`packages/foundation/modeling/ontology` and is a foundation modeling package
for repo-internal FOLIO/identity-as-IRI surfaces. Shared RDF, SPARQL, SHACL,
and canonicalization needs must pass through `@beep/rdf` and
`@beep/semantic-web`; this slice must not import foundation ontology product
language or make foundation models depend on workbench state.

## Installation

```bash
bun add @beep/ontology-domain
```

## Usage

```ts
import { VERSION } from "@beep/ontology-domain"
```

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/ontology-domain` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
