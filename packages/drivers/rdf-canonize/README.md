# @beep/rdf-canonize

Driver package for RDF Dataset Canonicalization using the external
`rdf-canonize` implementation.

The service contract remains in `@beep/semantic-web/services/canonicalization`.
RDF value models come from `@beep/rdf`. This package owns the third-party
adapter, resource limits, and canonicalization security tests.

## Surface

- `@beep/rdf-canonize`
- `@beep/rdf-canonize/adapters/canonicalization`

## Usage

```ts
import * as Effect from "effect/Effect";
import { CanonicalizationService } from "@beep/semantic-web/services/canonicalization"
import { canonicalization } from "@beep/rdf-canonize"

const program = Effect.gen(function* () {
  const service = yield* CanonicalizationService
  return service
})

console.log(program.pipe(Effect.provide(canonicalization.CanonicalizationServiceLive)))
```

## Development

```bash
bun run check
bun run test
bun run lint:fix
```

## License

MIT
