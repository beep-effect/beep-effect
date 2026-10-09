# @beep/nlp-processing

Provider-neutral NLP processing capability.

This package owns live service contracts, backend abstractions, runtime graph
execution, tokenization services, and AI tool contracts built on the shared
models in `@beep/nlp`. It does not bind a concrete NLP engine; drivers such as
`@beep/wink` provide those layers.

## Modules

- `@beep/nlp-processing/Backend` exposes the pluggable `NLPBackend` contract.
- `@beep/nlp-processing/Core` exposes the `Tokenization` service.
- `@beep/nlp-processing/Graph` exposes annotated/text graph carriers and runtime graph helpers.
- `@beep/nlp-processing/Graph/GraphOperations` exposes graph operation catalog, executor, and result store services.
- `@beep/nlp-processing/NLPService` exposes product-neutral NLP workflows over a backend.
- `@beep/nlp-processing/Tools` exposes AI tool schemas, `NlpToolkit`, and tool export helpers.

## Usage

```ts
import * as Effect from "effect/Effect";
import { exportTools } from "@beep/nlp-processing/Tools"
import { WinkNlpToolkitLive } from "@beep/wink"

const tools = await Effect.runPromise(
  exportTools.pipe(Effect.provide(WinkNlpToolkitLive))
)

console.log(tools.map((tool) => tool.name))
```

```ts
import * as Effect from "effect/Effect";
import { tokenizeToDocument } from "@beep/nlp-processing/Core"
import { WinkLayerLive } from "@beep/wink"

const document = await Effect.runPromise(
  tokenizeToDocument("Ada wrote code. Grace debugged it.", "history").pipe(
    Effect.provide(WinkLayerLive)
  )
)

console.log(document.sentenceCount)
```

## Consumers

| Consumer | Surface used | Notes |
| --- | --- | --- |
| `@beep/wink` | `Backend`, `Core`, `Tools` | wink-nlp driver implementing tokenization, backend, corpus, similarity, and tool handlers. |
| `@beep/nlp-mcp` | `Tools` | MCP driver exposing the canonical NLP toolkit over stdio. |

## Development

```bash
bun run check
bun run test
bun run lint:fix
```

## License

Apache-2.0
