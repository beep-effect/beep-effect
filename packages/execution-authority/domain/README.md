# @beep/execution-authority-domain

Execution authority slice domain: grants, grant sets, verdicts, and hash-chained decision and outcome records.

## Installation

```bash
bun add @beep/execution-authority-domain
```

## Usage

```ts
import * as Package from "@beep/execution-authority-domain"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/execution-authority-domain` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
