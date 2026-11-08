# @beep/execution-authority-server

Execution authority slice server: the Drizzle execution ledger, the governed MCP tier gate, and governed egress.

## Installation

```bash
bun add @beep/execution-authority-server
```

## Usage

```ts
import * as Package from "@beep/execution-authority-server"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/execution-authority-server` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
