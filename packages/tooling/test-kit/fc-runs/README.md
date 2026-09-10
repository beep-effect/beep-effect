# @beep/fc-runs

Env-max Effect Arbitrary run-count helpers (property-law lane floor)

## Installation

```bash
bun add @beep/fc-runs
```

## Usage

```ts
import { fcRuns } from "@beep/fc-runs"

// Inline value is a floor; BEEP_FC_NUM_RUNS can only raise it, never lower it.
const options = fcRuns(40) // { runs: max(40, BEEP_FC_NUM_RUNS) }
```

For snapshot `@effect/vitest` property tests, put the check options under `arbitrary`:

```ts
import { fcRuns } from "@beep/fc-runs"
import { it, expect } from "@effect/vitest"
import * as S from "effect/Schema"

it.prop("generates the literal", [S.Literal("ready")], ([value]) => {
  expect(value).toBe("ready")
}, { arbitrary: fcRuns(40) })
```

`fcRuns` returns `Arbitrary.CheckOptions & { readonly runs: number }`.
It no longer returns `numRuns`. For `Arbitrary.checkEffect`, pass `fcRuns(40)`
directly as its third argument and assert that the returned result has `_tag: "Passed"`.
The names and `BEEP_FC_NUM_RUNS` environment contract are retained.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/fc-runs` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
