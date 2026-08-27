# @beep/openai

Product-neutral Effect driver for OpenAI.

The package composes Effect AI's shipped OpenAI client and model Layers. It
does not implement an OpenAI protocol client or model engine.

## Installation

```bash
bun add @beep/openai
```

## Usage

```ts
import {
  makeOpenAiEmbeddingModelLayer,
  OpenAiEmbeddingModelOptions,
  OpenAiLive
} from "@beep/openai"
import { PosInt } from "@beep/schema"
import { Layer } from "effect"

const embeddingLayer = makeOpenAiEmbeddingModelLayer(
  OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(1536) })
).pipe(Layer.provide(OpenAiLive))

console.log(embeddingLayer)
```

`OpenAiLive` reads `AI_OPENAI_API_KEY` as a redacted Effect Config value. Local
configuration may store a secret reference such as
`op://BEEP_SECRETS/OpenAI/API Key`; do not commit a resolved key. Language and
embedding model ids may be overridden with `AI_OPENAI_MODEL` and
`AI_OPENAI_EMBEDDING_MODEL`. Embedding dimensions are always an explicit
positive integer and have no environment default.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/openai` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
