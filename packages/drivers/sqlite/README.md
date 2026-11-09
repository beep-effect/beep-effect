# @beep/sqlite

Driver-level SQLite runtime via @effect/sql-sqlite-bun with FTS5 and sqlite-vec extension loading

## Installation

```bash
bun add @beep/sqlite
```

## Usage

The driver runs on Bun only: `@effect/sql-sqlite-bun` opens databases through `bun:sqlite`.

```ts
import { loadExtensions, makeLayer, probeFts5 } from "@beep/sqlite"
import * as Effect from "effect/Effect"

const SqliteLive = makeLayer({ filename: "./.beep/memory.db" })

const program = Effect.gen(function* () {
  // FTS5 ships in Bun's bundled SQLite; the probe reports it as a boolean.
  const fts5 = yield* probeFts5
  // sqlite-vec loads from a shared-library path the caller supplies.
  yield* loadExtensions(["./vendor/vec0.so"])
  return fts5
}).pipe(Effect.provide(SqliteLive))
```

`SqliteTestLayer` is the same layer over `":memory:"` for tests. Driver failures surface as `SqliteError` with the failing `operation` (`connect`, `loadExtension`, `probeFts5`).

### Cleanup on touch

`@beep/repo-cli`, `@beep/repo-ai-metrics` and `@beep/test-utils` import `@effect/sql-sqlite-bun` directly today. When you next change their SQLite wiring, move them onto `@beep/sqlite`.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/sqlite` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
