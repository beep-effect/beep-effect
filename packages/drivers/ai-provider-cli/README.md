# @beep/ai-provider-cli

Driver-level Claude and Codex CLI capability wrapper for product-neutral auth status checks.

## Installation

```bash
bun add @beep/ai-provider-cli
```

## Usage

```ts
import { VERSION } from "@beep/ai-provider-cli"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/ai-provider-cli` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
