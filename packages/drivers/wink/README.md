# @beep/wink

Driver-level wink-nlp runtime for the product-neutral `@beep/nlp` contracts.

## Installation

```bash
bun add @beep/wink
```

## Surface

- `WinkEngine` and `WinkEngineLive` wrap `wink-nlp` with the English lite web model.
- `WinkTokenizationLive` implements `@beep/nlp/Core` tokenization.
- `WinkBackendLive` implements `@beep/nlp-processing/Backend/NLPBackend`.
- `WinkNlpToolkitLive` implements `@beep/nlp-processing/Tools/NlpToolkit`.
- `WinkCorpusManager`, `WinkVectorizer`, `WinkSimilarity`, and `WinkUtils` expose wink-backed retrieval and utility services.
- `observeWinkWorkflow`, `observeWinkTool`, and `mapWinkToolError` provide package-standard tracing, metrics, and AI-tool failure mapping.

Shared BM25, vector, bag-of-words, and similarity schemas are canonical in `@beep/nlp/Core`.

## Observability

`@beep/wink` depends on `@beep/observability` and wraps driver workflows with standard workflow counters, duration metrics, and spans. Text inputs are annotated by length only; raw text is not added to metric dimensions or span attributes by the helper layer.

AI-facing tools declare `AiToolError` as their failure schema with `failureMode: "return"`. Expected driver failures, such as querying a missing corpus, are returned to AI clients as structured tool results with `toolName`, `operation`, `reason`, `message`, and `retryable` fields instead of being raised as defects.

## Usage

```ts
import { Effect } from "effect"
import { tokenizeToDocument } from "@beep/nlp/Core"
import { WinkLayerLive } from "@beep/wink"

const document = await Effect.runPromise(
  tokenizeToDocument("Ada wrote code.", "example").pipe(
    Effect.provide(WinkLayerLive)
  )
)

console.log(document.tokenCount)
```

```ts
import { Effect } from "effect"
import { exportTools } from "@beep/nlp-processing/Tools"
import { WinkNlpToolkitLive } from "@beep/wink"

const tools = await Effect.runPromise(
  exportTools.pipe(Effect.provide(WinkNlpToolkitLive))
)

console.log(tools.map((tool) => tool.name))
```

```ts
import { Effect } from "effect"
import { observeWinkWorkflow } from "@beep/wink"

const observed = Effect.succeed("ready").pipe(
  observeWinkWorkflow({ name: "example.workflow" })
)

console.log(observed)
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/wink` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
