# @beep/fc-runs

Env-max fast-check run-count helpers (property-law lane floor)

## Installation

```bash
bun add @beep/fc-runs
```

## Usage

```ts
import { fcRuns } from "@beep/fc-runs"

// Inline value is a floor; BEEP_FC_NUM_RUNS can only raise it, never lower it.
const options = fcRuns(40) // { numRuns: max(40, BEEP_FC_NUM_RUNS) }
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/fc-runs` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
