# @beep/architecture-lab-proof

App-level contract harness for the architecture-lab WorkItem proof.

## Installation

```bash
bun add @beep/architecture-lab-proof
```

## Usage

```ts
import { VERSION } from "@beep/architecture-lab-proof"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/architecture-lab-proof` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
