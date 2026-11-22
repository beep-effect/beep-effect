# @beep/text

Text identity, anchors, selectors and occurrence identity.

`@beep/text` owns the canonical "where in which source text" values: the identity
of one exact extracted text (`SourceTextIdentity`), a half-open UTF-16 range with
its exact quote (`TextAnchor`), and the fail-closed proof that an anchor slices its
source to that quote (`VerifiedTextAnchor`). It is a `foundation/modeling` package
so any slice's `domain` can ground knowledge in a source span without coupling to
another slice. Consuming slices wrap a `TextAnchor` in their own value objects
(e.g. epistemic `EvidenceSpan` adds a `Confidence`).

## Canonical Imports

```ts
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
import { TextAnchor, TextAnchorFields } from "@beep/text/TextAnchor"
import { verifyTextAnchor } from "@beep/text/VerifiedTextAnchor"
```

## Development

```bash
bun run --filter=@beep/text check
bun run --filter=@beep/text test
bun run --filter=@beep/text lint
```

Tests import package source through `@beep/text` or other `@beep/*` aliases. Use relative imports only for local
helpers, fixtures, and snapshots.

## License

MIT
