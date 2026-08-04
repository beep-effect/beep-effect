# @beep/xai

Effect-first xAI driver package with a schema-backed endpoint manifest and an
`XAi` service method for every documented xAI API endpoint.

## Installation

```bash
bun add @beep/xai
```

## Usage

```ts
import { Effect } from "effect"
import { XAi, XAiRequestOptions } from "@beep/xai"

const program = Effect.gen(function* () {
  const xai = yield* XAi

  return yield* xai.createChatCompletion(
    new XAiRequestOptions({
      body: {
        model: "grok-4",
        messages: [{ role: "user", content: "hello" }]
      }
    })
  )
})
```

The live layer reads optional `XAI_API_KEY` and `XAI_MANAGEMENT_API_KEY`
credentials, then selects the right token for each endpoint. It also supports
URL overrides: `XAI_API_URL`, `XAI_MANAGEMENT_API_URL`, and `XAI_WEBSOCKET_URL`.

Streaming helpers are available for the documented SSE-compatible inference
calls: `streamChatCompletion`, `streamResponse`, `streamLegacyCompletion`, and
`streamAnthropicMessage`.

For explicit tests or app wiring, use `XAi.makeLayer(new XAiConfigInput(...))`.

## Public Surface

| Surface | Key exports | Notes |
| --- | --- | --- |
| service | `XAi`, `XAiConfigInput` | Effect service and runtime layer configuration for documented xAI endpoints |
| manifest | `XAI_ENDPOINTS`, `XAI_ENDPOINT_COUNT`, `XAI_ENDPOINT_METHOD_NAMES` | checked-in endpoint coverage inventory |
| language model | `XAiLanguageModel` namespace with `make`, `layer`, `model`, `XAiLanguageModelOptions` | Effect AI language-model adapter backed by `XAi.createChatCompletion` |
| models/errors | `XAiRequestOptions`, `XAiResponse`, `XAiWebSocketSession`, `XAiError` | schema-first boundary models and typed driver errors |

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/xai` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
