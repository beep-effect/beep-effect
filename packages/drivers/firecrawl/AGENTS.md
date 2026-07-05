# Agent Guide

`@beep/firecrawl` is the product-neutral technical driver for the Firecrawl v2
SDK: it wraps SDK calls with decoded payload/success schemas, sanitized
`FirecrawlError` values, and an Effect `Stream` for watcher events. The live
layer reads `FIRECRAWL_API_KEY`.

Cost gating: live integration tests must stay env-gated by `FIRECRAWL_API_KEY`
and low-cost. Avoid monitor, browser, agent, crawl, and batch creation unless
explicit cleanup and opt-in behavior are added.

Watcher streams must close the SDK watcher on completion or interruption.
