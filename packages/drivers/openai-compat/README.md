# @beep/openai-compat

OpenAI-compatible Effect AI protocol driver with tolerant chat completion
schemas, an HTTP client service, and Effect AI language-model constructors.

## Installation

```bash
bun add @beep/openai-compat
```

## Usage

```ts
import { Effect, Redacted } from "effect"
import {
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatClient,
  OpenAiCompatClientOptions
} from "@beep/openai-compat"

const program = Effect.gen(function* () {
  const client = yield* OpenAiCompatClient

  return yield* client.createChatCompletion(
    new OpenAiCompatChatCompletionRequest({
      messages: [{ content: "Hello", role: "user" }],
      model: "gpt-compatible"
    })
  )
})

const layer = OpenAiCompatClient.makeLayer(
  new OpenAiCompatClientOptions({
    apiKey: Redacted.make("test-key"),
    apiUrl: "https://provider.example/v1"
  })
)

void program
void layer
```

## Public Surface

| Surface | Key exports | Notes |
| --- | --- | --- |
| client service | `OpenAiCompatClient`, `OpenAiCompatClientOptions`, `OpenAiCompatClientShape` | OpenAI-compatible `/chat/completions` HTTP client and streaming service |
| language model | `makeFromProvider`, `layerFromProvider`, `make`, `layer`, `model` | Effect AI language-model constructors for provider callbacks or the package client |
| chat schemas | `OpenAiCompatChatCompletionRequest`, `OpenAiCompatChatCompletionResponse`, `OpenAiCompatChatCompletionChunk` | schema-first request, response, and stream chunk models |
| codecs | `decodeChatCompletionResponse`, `decodeChatCompletionChunk` | decoders for provider responses and SSE chunks |

For provider-owned clients, use `makeFromProvider` or `layerFromProvider` to
adapt `createChatCompletion` and `streamChatCompletion` callbacks into an
Effect AI `LanguageModel` service:

```ts
import { Effect, Stream } from "effect"
import { makeFromProvider } from "@beep/openai-compat"

const languageModel = makeFromProvider({
  model: "gpt-compatible",
  moduleName: "CompatProvider",
  provider: {
    createChatCompletion: () =>
      Effect.succeed({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: { content: "Hello", role: "assistant" }
          }
        ]
      }),
    streamChatCompletion: () => Stream.empty
  }
})

void languageModel
```

For the package HTTP client service, use `make`, `layer`, or `model`:

```ts
import { model } from "@beep/openai-compat"

const aiModel = model("gpt-compatible")

void aiModel
```

The schema surface includes chat completion request/response/chunk models,
message, tool-call, response-format, usage models, and
`decodeChatCompletionResponse` / `decodeChatCompletionChunk` codecs.

```ts
import { OpenAiCompatChatCompletionRequest } from "@beep/openai-compat"

const request = new OpenAiCompatChatCompletionRequest({
  messages: [{ content: "Hello", role: "user" }],
  model: "gpt-compatible"
})

void request
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

# Docs
bun run docgen

# Lint
bun run lint
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/openai-compat` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
