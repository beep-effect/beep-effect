# @beep/firecrawl Agent Guide

## Purpose & Fit
- Product-neutral technical driver for the modern Firecrawl v2 SDK.
- Keep this package in the flat repo-level `drivers` family. Do not import product slices, UI, apps, or domain language into this package.
- The driver wraps SDK calls with decoded payload/success schemas, sanitized `FirecrawlError` values, and an Effect `Stream` for watcher events.

## Surface Map
| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Firecrawl`, config, models, errors, `VERSION` | package entry point |
| service | `Firecrawl`, `FirecrawlShape`, `FirecrawlSdkClient`, `FirecrawlSdkWatcher` | live/config/test Layers and watcher stream |
| models | `Firecrawl<Method>Payload`, `Firecrawl<Method>Success`, `Firecrawl<Method>Failure` | schema source of truth for the wrapped v2 method surface |
| errors | `FirecrawlError`, `FirecrawlApiFailure`, method/reason domains | technical driver errors only |
| config | `FirecrawlConfigInput`, `FIRECRAWL_API_URL` | live layer reads `FIRECRAWL_API_KEY` |

## Laws
- Follow repository laws through command discovery.
- Run `bun run beep docs laws`.
- Prefer tersest equivalent helper forms when behavior is unchanged.
- In `test/` and `dtslint/`, import package source through `@beep/firecrawl` or other `@beep/*` package aliases; keep relative imports for local helpers, fixtures, and snapshots only.
- Live integration tests must stay env-gated by `FIRECRAWL_API_KEY` and low-cost. Avoid monitor, browser, agent, crawl, and batch creation unless explicit cleanup and opt-in behavior are added.
- Watcher streams must close the SDK watcher on completion or interruption.
- Keep package guidance concise and avoid duplicating long policy prose.

## Quick Recipes
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

## Verifications
- `bunx turbo run test --filter=@beep/firecrawl`
- `bunx turbo run test:integration --filter=@beep/firecrawl`
- `bunx turbo run type-test --filter=@beep/firecrawl`
- `bunx turbo run lint --filter=@beep/firecrawl`
- `bunx turbo run check --filter=@beep/firecrawl`

## Contributor Checklist
- [ ] New exports include jsdoc metadata
- [ ] Tests added or updated for behavior changes
- [ ] `bun run check` passes
- [ ] `bun run test` passes
- [ ] `bun run lint` passes
