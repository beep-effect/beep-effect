# @beep/contract-kit

Interim contract kit over @alchemy.run/domain: model-shaped catalogs for client Apis

## Installation

```bash
bun add @beep/contract-kit
```

## Usage

```ts
import * as Package from "@beep/contract-kit"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/contract-kit` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
