# @beep/firecrawl

Typed Firecrawl web scrape driver with bounded responses, typed errors, and live and test layers

## Installation

```bash
bun add @beep/firecrawl
```

## Usage

`Firecrawl.scrape` posts one `/v2/scrape` request for `markdown` and `rawHtml`, cuts
the response stream at `maxResponseBytes` (20 MB by default) before keeping bytes,
refuses PDF targets with `unsupported-content`, and returns the decoded document
together with the exact response body.

```ts
import { Firecrawl, FirecrawlScrapeRequest } from "@beep/firecrawl"
import * as Effect from "effect/Effect"

const program = Effect.gen(function* () {
  const firecrawl = yield* Firecrawl
  const result = yield* firecrawl.scrape(FirecrawlScrapeRequest.make({ url: "https://example.org" }))
  return result.document.metadata.statusCode
}).pipe(Effect.provide(Firecrawl.layer))
```

Layers:

- `Firecrawl.layer` reads `FIRECRAWL_API_KEY` and optional `FIRECRAWL_API_URL`.
- `Firecrawl.makeLayer(config)` takes a resolved, redacted key.
- `Firecrawl.makeLayerWithKey(effect)` resolves the key on the first scrape and caches
  it; the research library uses it to read `FIRECRAWL_API_KEY_REFERENCE` through the
  PATH `op` shim.
- `Firecrawl.makeTestLayer(handler)` answers scrapes deterministically.

Failures are `FirecrawlError` values with a redacted `reason`; the key never appears
in messages.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/firecrawl` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
