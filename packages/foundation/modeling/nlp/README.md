# @beep/nlp

Schema-first NLP modeling package.

This package owns product-neutral value models and pure helpers for text,
documents, patterns, vectors, similarity, graph schema, and handoff contracts. It
does not own live services, backend contracts, AI tools, provider adapters, or
runtime graph execution.

## Modules

- `@beep/nlp/Core` exposes document, sentence, token, pattern, vectorization, and similarity models.
- `@beep/nlp/Ontology` exposes the stratified text ontology.
- `@beep/nlp/Graph` exposes graph schema classes and pure graph operations.
- `@beep/nlp/Operations` exposes pure composable operation models.
- `@beep/nlp/Handoff` exposes the product-neutral annotated document handoff contract.
- `@beep/nlp/IdentifierText`, `@beep/nlp/PathText`, `@beep/nlp/QueryText`, and `@beep/nlp/VariantText` expose deterministic text helpers.

Processing services and AI tool contracts live in `@beep/nlp-processing`.
Concrete provider implementations live in driver packages such as `@beep/wink`.

## Usage

```ts
import { DocumentId } from "@beep/nlp/Core/Document"
import { BM25Config, DefaultBM25Config } from "@beep/nlp/Core/Vectorization"

const documentId = DocumentId.make("doc-001")
const config = BM25Config.make(DefaultBM25Config)

console.log(documentId)
console.log(config.norm)
```

## Consumers

| Consumer | Surface used | Notes |
| --- | --- | --- |
| `@beep/langextract` | `Core`, `Handoff` | Emits the `AnnotatedDocument` handoff envelope (chunks, mentions, entities) from grounded extractions. |
| `@beep/nlp-processing` | `Core`, `Graph` | Provider-neutral processing contracts and services built on these models. |
| `@beep/wink` | `Core`, `Graph` | wink-nlp driver using shared document, token, vectorization, and similarity models. |

## Development

```bash
bun run check
bun run test
bun run lint:fix
```

## License

Apache-2.0
