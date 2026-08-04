# @beep/ontology

Ontology modeling package for repo-internal foundation models.

## Boundary

`@beep/ontology` is the foundation modeling package under
`packages/foundation/modeling/ontology`. It owns FOLIO-oriented and
identity-as-IRI modeling primitives used by repo-internal knowledge surfaces.

The professional-desktop ontology workbench is a separate vertical slice under
`packages/ontology/*`, with its domain entrypoint published as
`@beep/ontology-domain`. That slice edits user-supplied Turtle ontology
documents through `@beep/rdf` and `@beep/semantic-web` ports. Do not route
workbench product state, sidecar file IO, or UI concerns through this
foundation package.

## Installation

```bash
bun add @beep/ontology
```

## Usage

```ts
import { VERSION } from "@beep/ontology"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/ontology` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
