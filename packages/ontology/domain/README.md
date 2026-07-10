# @beep/ontology-domain

Ontology workbench domain package for RDF-backed session models.

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
