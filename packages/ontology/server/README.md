# @beep/ontology-server

Ontology workbench server adapter package for sidecar file IO and Turtle codec
layers.

## Installation

```bash
bun add @beep/ontology-server
```

## Usage

```ts
import { VERSION } from "@beep/ontology-server"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/ontology-server` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
