# @beep/openclaw

OpenClaw deployment driver: desired-intent schema, versioned render adapter, CLI process wrapper, probes

## Installation

```bash
bun add @beep/openclaw
```

## Usage

```ts
import { VERSION } from "@beep/openclaw"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/openclaw` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
