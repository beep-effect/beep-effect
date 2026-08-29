# @beep/qa-capture

UI-verification capture pipeline: witness instrumentation, event collection, clock correlation, and extraction planning for QA recording sessions.

## Installation

```bash
bun add @beep/qa-capture
```

## Usage

```ts
import { VERSION } from "@beep/qa-capture"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/qa-capture` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
