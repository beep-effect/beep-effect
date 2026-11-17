# @beep/runpod

Effect-first Runpod REST API v2 driver package (`https://api.runpod.io/v2`).

## Installation

```bash
bun add @beep/runpod
```

## Usage

```ts
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { ListPodsParams, PodActionParams, Runpod, RunpodConfigInput } from "@beep/runpod"

const program = Effect.gen(function* () {
  const runpod = yield* Runpod
  // One page: `{ pods, pagination }`.
  const page = yield* runpod.listPods(ListPodsParams.make({ limit: 100 }))
  // Every pod, following `pagination.nextCursor`.
  const pods = yield* Stream.runCollect(runpod.listPodsStream())
  // Pod lifecycle goes through one action endpoint.
  yield* runpod.podAction(PodActionParams.make({ id: "pod-id", body: { action: "stop" } }))
  return { page, pods }
})

const layer = Runpod.makeLayer(
  RunpodConfigInput.make({
    apiKey: Redacted.make("runpod-api-key")
  })
)

void program
void layer
```

Every operation in the checked-in Runpod OpenAPI document is a method on
`Runpod` that takes its `<Operation>Params` request. Each cursor-paginated list
also gets a `<method>Stream` member, and the Pod and Serverless worker log
operations return a `Stream` of Server-Sent Events. Failures are typed
`RunpodError` values; a rejected request carries the RFC 9457 `problem` with
its validation `errors`. Request bodies are closed: an unknown field, such as a
v1 name, fails as a `request encoding` error before anything is sent, instead
of being dropped. `Runpod.raw(...)` reaches ahead-of-spec paths relative
to the v2 base URL, and `RunpodDocs.fetchIndex` reads
`https://docs.runpod.io/llms.txt`.

## Development

```bash
# Regenerate from openapi.json, then prove no drift
bun run generate
bun run generate:check

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. The live suite fetches the public OpenAPI document and lists pods only when `RUNPOD_API_KEY` holds a resolved key. Tests import package source through `@beep/runpod` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
