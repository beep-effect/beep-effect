# @beep/test-runner

Instrumented Effect Vitest runner without application package dependencies

## Installation

```bash
bun add @beep/test-runner
```

## Usage

```ts
import { it } from "@beep/test-runner"
import { assertTrue } from "@effect/vitest/utils"
import { Effect } from "effect"

it.effect("runs with a watchdog", () => Effect.sync(() => assertTrue(true)))
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/test-runner` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT

The runner uses the public Effect Vitest API. `@beep/test-utils/Vitest` re-exports
this same runner and its error classes. This package has no runtime dependency on
identity, schema, utils or test-utils, allowing foundation tests to adopt it.

`@beep/test-runner/test/Vitest` is a source-only controlled-clock seam. Its exact
published export and the `test/*` wildcard are blocked. Historical error schema
identifiers remain pinned to their original test-utils namespace for compatibility.
