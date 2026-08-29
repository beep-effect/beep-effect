# `@beep/firecrawl`

Schema-first, Effect-first technical driver for the modern Firecrawl v2 SDK.

## Installation

```bash
bun add @beep/firecrawl
```

## Usage

```ts
import { Firecrawl, FirecrawlScrapePayload } from "@beep/firecrawl"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const firecrawl = yield* Firecrawl
  return yield* firecrawl.scrape(
    FirecrawlScrapePayload.make({ url: "https://example.com" })
  )
})

console.log(program)
```

The live layer reads `FIRECRAWL_API_KEY`, optional `FIRECRAWL_API_URL`, and retry/timeout knobs from Effect Config. Tests can inject an SDK-compatible fake with `Firecrawl.makeLayerFromClient(...)`.

Watcher jobs are exposed as an Effect `Stream` of decoded watcher events. The driver closes the underlying SDK watcher when the stream completes or is interrupted.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/firecrawl` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

Live integration tests are gated by `FIRECRAWL_API_KEY` and only exercise low-cost account/read endpoints by default.

## License

MIT
