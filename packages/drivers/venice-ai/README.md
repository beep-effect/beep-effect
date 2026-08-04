# @beep/venice-ai

Product-neutral Effect driver for the Venice AI API.

## Installation

```bash
bun add @beep/venice-ai
```

## Usage

```ts
import { Effect } from "effect"
import { VeniceAI, VeniceAIRequestOptions } from "@beep/venice-ai"

const program = Effect.gen(function* () {
  const venice = yield* VeniceAI
  return yield* venice.createChatCompletion(
    new VeniceAIRequestOptions({
      body: {
        messages: [{ role: "user", content: "Hello" }],
        model: "venice-uncensored-1-2"
      }
    })
  )
})
```

The service exposes one method per operation in `swagger.yaml`, plus
`streamChatCompletion` and `streamResponse` for SSE streaming.

## Public Surface

| Surface | Key exports | Notes |
| --- | --- | --- |
| service | `VeniceAI`, `VeniceAIConfigInput` | Effect service and runtime layer configuration for Venice AI operations |
| compatibility | `VeniceAiChat` | chat text convenience wrapper that delegates through `VeniceAI.createChatCompletion` |
| language model | `VeniceAiLanguageModel` namespace with `make`, `layer`, `model`, `VeniceAiLanguageModelOptions` | Effect AI language-model adapter backed by `VeniceAI.createChatCompletion` |
| models/errors | `VeniceAIRequestOptions`, `VeniceAIResponse`, `VeniceAIError`, `VENICE_AI_OPERATION_DESCRIPTORS` | schema-first boundary models, typed errors, and operation descriptors |

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/venice-ai` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
