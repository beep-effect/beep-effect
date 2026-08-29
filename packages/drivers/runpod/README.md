# @beep/runpod

Effect-first Runpod REST API v1 driver package.

## Installation

```bash
bun add @beep/runpod
```

## Usage

```ts
import { Effect, Redacted } from "effect"
import { Runpod, RunpodConfigInput } from "@beep/runpod"

const program = Effect.gen(function* () {
  const runpod = yield* Runpod
  return yield* runpod.listPods()
})

const layer = Runpod.makeLayer(
  new RunpodConfigInput({
    apiKey: Redacted.make("runpod-api-key")
  })
)

void program
void layer
```

The package exposes generated request/response models for all operations in the
checked-in Runpod OpenAPI document, plus `Runpod.raw(...)` for ahead-of-spec REST
paths and `RunpodDocs.fetchIndex` for `https://docs.runpod.io/llms.txt`.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/runpod` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
