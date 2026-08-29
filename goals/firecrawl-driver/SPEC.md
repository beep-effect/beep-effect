# Firecrawl Driver Specification

## Status

**PENDING IMPLEMENTATION**

Created on 2026-06-04 as a packet-authoring pass. The driver package has not
been implemented.

## Owner

@beep-team

## Purpose

The repository needs a robust Firecrawl technical driver so product slices and
app adapters can consume web scraping, crawling, parsing, monitoring, browser,
agent, usage, and watcher capabilities without depending directly on the raw
Firecrawl SDK, thrown SDK errors, raw API failures, or unbounded external wire
shapes.

`@beep/firecrawl` is not product language. It is a dev-safe wrapper around an
external SDK and service.

## Architecture Contract

`@beep/firecrawl` lives in the flat repo-level `drivers` family:

```txt
packages/drivers/firecrawl -> @beep/firecrawl
```

This follows the binding architecture rule that external SDKs, services,
engines, frameworks, and browser platform wrappers belong in `drivers/*`.

The driver may:

- wrap the modern `firecrawl` npm SDK;
- expose schema-first technical payloads, successes, failures, and service
  methods;
- define technical driver errors;
- provide live and fake Layers;
- provide low-cost live smoke tests gated by `FIRECRAWL_API_KEY`;
- expose watcher streams as Effect-native streams.

The driver must not:

- import product slices, product use-cases, product domain models, shared
  product language, UI, apps, app-local runtime wiring, or product policy;
- translate technical Firecrawl failures into product-facing action errors;
- log or trace API keys, raw request bodies, raw URLs with sensitive query
  strings, prompts, extracted content, raw HTML, documents, or PII;
- expose deprecated v1 compatibility aliases or maintenance-mode extract
  methods in the required V1 wrapper surface.

Application policy belongs in consumers. Product-facing consumers translate
technical `FirecrawlError` values at their adapter or use-case boundary.

## Source Hierarchy

Implementation must read sources in this order:

1. User objective captured in this packet.
2. Repo instructions: `AGENTS.md`, `CLAUDE.md`, and loaded skills.
3. Architecture standards:
   - `standards/ARCHITECTURE.md`
   - `standards/architecture/03-driver-boundaries.md`
   - `standards/architecture/07-non-slice-families.md`
   - `standards/architecture/09-errors-across-boundaries.md`
   - `standards/architecture/12-observability.md`
4. Documentation standards:
   - `.patterns/jsdoc-documentation.md`
5. Existing driver package patterns:
   - `packages/drivers/hubspot`
   - `packages/drivers/openai-compat`
   - `packages/drivers/venice-ai`
   - `packages/drivers/box` only as a scaffold/stub contrast, not as an
     implementation-quality service reference
6. Firecrawl references:
   - `https://docs.firecrawl.dev/llms.txt`
   - `https://docs.firecrawl.dev/llms-full.txt`
   - `https://docs.firecrawl.dev/api-reference/errors.md`
   - `https://docs.firecrawl.dev/api-reference/v2-openapi.json`
   - `https://www.npmjs.com/package/firecrawl`
7. Local Firecrawl source clone:
   - `/home/elpresidank/YeeBois/dev/firecrawl`
   - `/home/elpresidank/YeeBois/dev/firecrawl/apps/js-sdk/firecrawl`
   - expected SDK files:
     - `src/index.ts`
     - `src/v2/client.ts`
     - `src/v2/types.ts`
     - `src/v2/watcher.ts`
     - `src/v2/methods/**`

Current architecture doctrine outranks older packet prose and current code
drift.

## Required Skills

The implementation agent must use these repo-local skills or record any
unavailable path and continue with the closest repo-native fallback:

- `$grill-with-docs`
- `$effect-first-development`
- `$schema-first-development`
- `$jsdoc-annotation-specialist`
- `$quality-review-fix-loop`
- `github:yeet`
- `github:gh-fix-ci`
- `github:gh-address-comments`

During packet authoring on 2026-06-04, all listed skill paths were available
and loaded. Graphiti MCP status was OK, but scoped fact search timed out, so
repo files, docs, local SDK source, npm, and Firecrawl docs were used as the
grounding sources.

## Package Scaffold

The implementation must scaffold the package with:

```sh
bun run create-package firecrawl --family drivers --description "Firecrawl driver package"
```

Run the same command with `--dry-run` first. During packet authoring, the dry
run reported that it would create `@beep/firecrawl` at
`packages/drivers/firecrawl`, add the workspace entry, register `firecrawl` in
`packages/foundation/modeling/identity/src/packages.ts`, export
`$FirecrawlId`, and run derived repo config sync after scaffolding.

## SDK Dependency Decision

Use the modern `firecrawl` npm package. Do not use
`@mendable/firecrawl-js` unless the implementation inventory proves the modern
package is no longer viable and records the reason.

Observed drift to re-check:

- npm `firecrawl` latest was `4.25.2` on 2026-06-04.
- Local clone SDK manifest at
  `/home/elpresidank/YeeBois/dev/firecrawl/apps/js-sdk/firecrawl/package.json`
  declared `@mendable/firecrawl-js@4.25.2` while depending on
  `firecrawl@4.16.0`.

The implementation inventory must compare the current local clone commit,
current npm `firecrawl` version, installed package version, and live docs before
coding.

## Required SDK Surface

Wrap the current nondeprecated v2 SDK surface, re-verified at implementation
time:

- `scrape`
- `interact`
- `stopInteraction`
- `parse`
- `search`
- `map`
- `startCrawl`
- `getCrawlStatus`
- `cancelCrawl`
- `crawl`
- `getCrawlErrors`
- `getActiveCrawls`
- `crawlParamsPreview`
- `createMonitor`
- `listMonitors`
- `getMonitor`
- `updateMonitor`
- `deleteMonitor`
- `runMonitor`
- `listMonitorChecks`
- `getMonitorCheck`
- `startBatchScrape`
- `getBatchScrapeStatus`
- `getBatchScrapeErrors`
- `cancelBatchScrape`
- `batchScrape`
- `startAgent`
- `getAgentStatus`
- `agent`
- `cancelAgent`
- `browser`
- `browserExecute`
- `deleteBrowser`
- `listBrowsers`
- `getConcurrency`
- `getCreditUsage`
- `getTokenUsage`
- `getCreditUsageHistorical`
- `getTokenUsageHistorical`
- `getQueueStatus`
- `watcher`

Explicitly excluded:

- Deprecated v1 compatibility aliases such as `scrapeUrl`, `crawlUrl`,
  `asyncCrawlUrl`, `checkCrawlStatus`, `checkCrawlErrors`, `mapUrl`,
  `batchScrapeUrls`, `asyncBatchScrapeUrls`,
  `checkBatchScrapeStatus`, `checkBatchScrapeErrors`, and similar aliases.
- Deprecated scrape-browser aliases such as `scrapeExecute`,
  `stopInteractiveBrowser`, and `deleteScrapeBrowser`.
- Deprecated maintenance-mode extract methods:
  - `startExtract`
  - `getExtractStatus`
  - `extract`

Live Firecrawl v2 OpenAPI currently includes extra paths such as support,
account activity, search feedback, `GET /scrape/{jobId}`, and extract paths.
These are not required in V1 unless the current SDK/npm inventory proves the
requested SDK surface has changed and the packet is updated with the rationale.

## Schema Requirements

Use `$schema-first-development`. Schemas are the source of truth.

For every in-scope SDK method, define these schemas with `S.Class`:

- `Firecrawl<Method>Payload`
- `Firecrawl<Method>Success`
- `Firecrawl<Method>Failure`

Service methods must return decoded `Success` class values, not raw SDK output.

Every optional, nullable, undefined, or nullish field from SDK payloads, success
results, failures, watcher events, and configuration must transform into
Effect `Option` at the boundary using Effect Schema primitives such as:

- `S.OptionFromOptional`
- `S.OptionFromOptionalKey`
- `S.OptionFromNullOr`
- `S.OptionFromNullishOr`
- another appropriate Effect-provided Option transform

Every literal union must use a named `LiteralKit` schema. Do not use ad-hoc
literal arrays or local predicate helpers for literal domains.

Every SDK shape with discriminatable properties must be modeled as a tagged
union using one of:

- `S.TaggedUnion`
- `LiteralKit.mapMembers` plus `Tuple.evolve` plus `S.toTaggedUnion`

Document truly unrepresentable dynamic shapes in the inventory and constrain
them with the narrowest safe schema available. Dynamic JSON Schema/Zod-like
inputs used by Firecrawl JSON extraction must not leak as `any`; prefer
`S.Record(S.String, S.Unknown)`, `S.Unknown`, or a narrower schema if current
SDK/docs prove one.

## Effect Service Requirements

Use `$effect-first-development` and existing driver patterns.

The package must expose an Effect service boundary around the Firecrawl SDK:

- Use `Context.Service` and Layers.
- Use the package identity composer `$FirecrawlId`.
- Keep configuration effectful.
- Read secrets through Effect `Config` and `Redacted`.
- Use `Effect.tryPromise` or equivalent Effect lifting around SDK promise
  calls.
- Never leak thrown SDK errors or raw thrown values across the service
  boundary.
- Decode external inputs and SDK outputs at the boundary.
- Return typed `Firecrawl<Method>Success` values.
- Fail with typed technical `FirecrawlError` values.

The error model is dual:

- Each method has a schema-level `Failure` class for decoded Firecrawl/API
  failure shape.
- The Effect error channel uses technical `FirecrawlError` variants that carry
  method name, decoded failure context where available, and sanitized
  diagnostic metadata.

`FirecrawlError` must model SDK thrown errors, HTTP/API failures, schema decode
failures, missing configuration, watcher failures, retries, and timeouts
without leaking API keys, raw request bodies, raw PII, raw prompts, raw HTML,
raw documents, or unbounded user input.

## Watcher Requirement

Treat `watcher` as a first-class Effect-native stream surface.

The implementation must define:

- `FirecrawlWatcherPayload`
- `FirecrawlWatcherSuccess` or a construction success schema if no single
  success payload exists
- `FirecrawlWatcherFailure`
- `FirecrawlWatcherEvent` tagged union with variants at least:
  - `document`
  - `snapshot`
  - `done`
  - `error`

The service method must return an Effect `Stream` of decoded watcher events.
It must preserve interruption/finalizer behavior and close the underlying SDK
watcher when the stream is interrupted or completes.

Tests must use a fake watcher Layer or fake SDK/event source and cover normal
events, decode failures, completion, error events, and interruption finalizers.

## Observability, Logging, And Tracing

Use `@beep/observability` and Effect spans/logging in a driver-appropriate way.

Required behavior:

- Technical span names such as `firecrawl.scrape`,
  `firecrawl.batch_scrape.start`, and `firecrawl.watcher.stream`.
- Low-cardinality attributes such as method name, job kind, SDK version, retry
  state, status, failure reason, and sanitized Firecrawl status.
- No secrets, API keys, raw URLs with sensitive query strings, raw prompts, raw
  extracted content, raw HTML, raw documents, or PII in spans/logs.
- Logs only for noteworthy diagnostics:
  - retries;
  - fallbacks;
  - dropped technical details;
  - decoded Firecrawl/API failures;
  - watcher fallback from websocket to polling.
- Metrics/duration tracking through `@beep/observability` helpers where they
  fit existing package patterns.

## Documentation Requirements

Use `$jsdoc-annotation-specialist`.

The implementation must provide:

- JSDoc/TSDoc for every exported schema, service, Layer, error, helper, and
  public type.
- Meaningful examples using package aliases such as `@beep/firecrawl`, not
  relative imports into workspace `src`.
- Schema annotations with quality descriptions, identifiers, examples, and
  category/since metadata consistent with `.patterns/jsdoc-documentation.md`.
- Docs that explain `@beep/firecrawl` is a technical Firecrawl driver, not a
  product/domain package.
- No `@template`, no type blobs in tags, no `@module`, no invalid
  `@returns -`, and no examples using `any`, type assertions, or deprecated
  `@effect/schema` imports.

## Testing Requirements

Use `@effect/vitest` best practices.

Required tests:

- Unit tests with deterministic fake SDK Layers.
- Watcher stream tests with fake event emission and interruption/finalizer
  coverage.
- Error translation tests covering:
  - SDK-thrown errors;
  - Firecrawl API failure responses;
  - undecodable SDK output;
  - missing configuration;
  - sanitized diagnostics.
- Schema decoding tests for representative payload/success/failure shapes.
- dtslint tests for public API, service method return types,
  schema-derived types, and package-alias imports.
- Env-gated live integration smoke tests using `FIRECRAWL_API_KEY`.

Live tests must be minimal and low-cost by default:

- Prefer stable smoke calls such as `scrape`, `map`, and account/usage reads.
- Skip cleanly when `FIRECRAWL_API_KEY` is absent.
- Do not attempt live coverage for every method.
- Avoid live flows that create expensive or hard-to-clean resources unless
  explicitly opted in.

## Quality And PR Closure Requirements

Use `$quality-review-fix-loop` before PR readiness.

Required local closure behavior:

```sh
bunx turbo run check test lint type-test --filter=@beep/firecrawl
bunx turbo run test:integration --filter=@beep/firecrawl
bun run docgen:local
bun run repo-exports:catalog
bun run repo-exports:catalog:check
bun run lint:fix
bun run audit:github quality
```

If unrelated repo failures appear, reproduce and record them clearly without
masking package-specific failures.

Required PR behavior:

- Create a focused branch, preferably `codex/firecrawl-driver`.
- Commit only intended files.
- Use a packet commit message:

```text
feat: add firecrawl driver goal packet
```

- Use a future implementation commit message:

```text
feat: add firecrawl driver
```

- Open a draft PR after local quality is green.
- Use GitHub skills to babysit the PR:
  - inspect failing checks;
  - fetch CI logs;
  - fix pipeline issues;
  - push follow-up commits;
  - inspect unresolved PR review threads;
  - resolve actionable review comments.

After each follow-up commit, comment:

```text
@greptileai
```

Wait for the new Greptile review, parse/report the score, and continue fixing
and retriggering Greptile until the PR receives `5/5`. Mark the PR ready only
after CI is green, actionable comments are resolved, and Greptile reports
`5/5`.

## Stop Conditions

Stop and report exact evidence if:

- Firecrawl docs, npm, installed SDK, or local source drift makes the method
  surface ambiguous.
- Live integration tests would incur unexpected cost or destructive side
  effects.
- A CI failure is unrelated and cannot be reproduced locally after reasonable
  investigation.
- Greptile cannot be triggered or its score cannot be observed after
  documented attempts.
