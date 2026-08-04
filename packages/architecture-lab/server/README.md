# @beep/architecture-lab-server

Architecture-lab server adapter package for WorkItem repositories, handlers, and Layers.

## Installation

```bash
bun add @beep/architecture-lab-server
```

## Usage

```ts
import { VERSION } from "@beep/architecture-lab-server"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/architecture-lab-server` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
