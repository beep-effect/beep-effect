# @beep/discord

Driver-level Discord REST capability wrapper for product-neutral channel liveness and message checks.

## Installation

```bash
bun add @beep/discord
```

## Usage

```ts
import { VERSION } from "@beep/discord"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/discord` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
