# @beep/provenance

Domain-agnostic provenance value models.

`@beep/provenance` owns the canonical "where did this come from?" primitives —
starting with `TextAnchor`, a char-offset anchor into a source document. It is a
`foundation/modeling` package so any slice's `domain` can ground knowledge in a
source span without coupling to another slice. Consuming slices wrap a
`TextAnchor` in their own value objects (e.g. epistemic `EvidenceSpan` adds a
`Confidence`).

## Canonical Imports

```ts
import { TextAnchor, TextAnchorFields, isWellOrdered } from "@beep/provenance/TextAnchor"
```

## Development

```bash
bun run --filter=@beep/provenance check
bun run --filter=@beep/provenance test
bun run --filter=@beep/provenance lint
```
