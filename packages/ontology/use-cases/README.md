# @beep/ontology-use-cases

Ontology workbench use-case package for session commands, ports, and worker
protocol contracts.

## Installation

```bash
bun add @beep/ontology-use-cases
```

## Usage

```ts
import { VERSION } from "@beep/ontology-use-cases"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/ontology-use-cases` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
