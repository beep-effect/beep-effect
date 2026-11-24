# @beep/nlp

Schema-first NLP modeling package.

This package owns pure helpers for identifier, path, query and variant text. The
document, token, pattern, vectorization and similarity models and the graph node
schemas moved to `@beep/nlp-processing`, and the Operations, Algebra and GraphOps
modules were deleted, in the text-knowledge-stack rebuild (P6); the remaining
modules retire with the package in P7.

## Modules

- `@beep/annotation` owns standoff annotation documents and their kinds.
- `@beep/nlp/IdentifierText`, `@beep/nlp/PathText`, `@beep/nlp/QueryText`, and `@beep/nlp/VariantText` expose deterministic text helpers.

Processing services and AI tool contracts live in `@beep/nlp-processing`.
Concrete provider implementations live in driver packages such as `@beep/wink`.

## Usage

```ts
import * as QueryText from "@beep/nlp/QueryText"

console.log(QueryText.normalizeQuestion("  hello   world  "))
```

## Consumers

| Consumer | Surface used | Notes |
| --- | --- | --- |

## Development

```bash
bun run check
bun run test
bun run lint:fix
```

## License

Apache-2.0
