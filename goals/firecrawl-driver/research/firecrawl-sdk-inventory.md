# Firecrawl SDK Inventory

## Status

Initial packet-authoring inventory created on 2026-06-04.

Implementation refresh completed on 2026-06-04 before package scaffolding.
The modern `firecrawl` npm package remains viable for `@beep/firecrawl`.
No package code existed in this repo at refresh time, and no `firecrawl` or
`@mendable/firecrawl-js` dependency was installed in the workspace before
scaffolding. After scaffolding, `packages/drivers/firecrawl/package.json`
depends on `firecrawl` `^4.25.2`, and `node_modules/firecrawl/package.json`
reports installed version `4.25.2`.

Continuation refresh completed on 2026-06-04 during implementation closure.
Current npm metadata still reports `firecrawl` `4.25.2` as `latest`; the
installed package still reports `4.25.2`; the local clone remains at
`42b46be4f75afbd88cd4161495345e94a04c3148` with only untracked `.idea/`.
The docs `llms.txt` response was refreshed at 21,652 bytes with
`last-modified: Thu, 04 Jun 2026 07:58:03 GMT`. The v2 OpenAPI response
remains 260,303 bytes, info version `v2`, with `last-modified:
Tue, 02 Jun 2026 22:03:12 GMT`, and exposes the same path set recorded below.
No method-surface ambiguity was found, so the implementation scope remains the
current nondeprecated SDK client surface.

Post-main-refresh recovery refresh completed on 2026-06-04 after rebasing the
work onto `origin/main` commit `ab66ed1fcee76e5576d138c35a81c897b5e55503`.
The local clone remains at
`42b46be4f75afbd88cd4161495345e94a04c3148` with status `main...origin/main`
and untracked `.idea/`. `npm view firecrawl` still reports `4.25.2` as
`latest`; the package dependency is `^4.25.2`; and the installed package still
reports `4.25.2`. The docs refresh observed `llms.txt` at 21,652 bytes with
`last-modified: Thu, 04 Jun 2026 09:08:21 GMT`,
`llms-full.txt` at 700,586 bytes with `last-modified:
Thu, 04 Jun 2026 05:55:07 GMT`, `errors.md` at 9,311 bytes with
`last-modified: Thu, 04 Jun 2026 09:08:37 GMT`, and the v2 OpenAPI document at
260,303 bytes, `etag: "6d32a848317ee6427f3ec0371cfaf459"`,
`last-modified: Tue, 02 Jun 2026 22:03:12 GMT`, info version `v2`. A method
surface check against both the local clone `src/v2/client.ts` and installed
`node_modules/firecrawl/dist/index.d.ts` found all in-scope methods present and
all excluded deprecated/extract methods still present but intentionally
excluded. No source/npm/docs drift changes the implementation scope.

## Sources

### Local Clone

- Path: `/home/elpresidank/YeeBois/dev/firecrawl`
- Refreshed commit: `42b46be4f75afbd88cd4161495345e94a04c3148`
- Refreshed status: `main...origin/main` with untracked `.idea/`
- JS SDK path:
  `/home/elpresidank/YeeBois/dev/firecrawl/apps/js-sdk/firecrawl`
- Local SDK package manifest refreshed:
  - name: `@mendable/firecrawl-js`
  - version: `4.25.2`
  - dependency: `firecrawl` `4.16.0`

The local clone remains useful as source evidence, but its package manifest is
not the package the driver should depend on.

### npm

- Package: `firecrawl`
- Refreshed latest version: `4.25.2`
- Refreshed dist-tags: `latest: 4.25.2`, `beta: 1.7.0`
- Repository: `git+https://github.com/firecrawl/firecrawl.git`
- License: MIT
- Tarball inspected: `/tmp/firecrawl-4.25.2.tgz`
  - package: `firecrawl@4.25.2`
  - shasum: `561a93732522863289c84a22ade8032a29c25805`
  - integrity:
    `sha512-TTwav6XidvwZ4/Df0inFaCa9iZtoxjpNXp3crRYBoaIKYqZyWMIuwhB3Ta/KgpM64RTyD3o2pCftOj4olicohA==`
  - published files include `dist/index.d.ts`, `src/index.ts`,
    `src/v2/client.ts`, `src/v2/types.ts`, `src/v2/watcher.ts`, and
    `src/v2/methods/**`.
  - package manifest has no nested dependency on `firecrawl`.

### Docs And OpenAPI

- `https://docs.firecrawl.dev/llms.txt`
  - fetched 2026-06-04, 21,652 bytes, `last-modified:
    Thu, 04 Jun 2026 07:11:27 GMT`
- `https://docs.firecrawl.dev/llms-full.txt`
  - fetched 2026-06-04, 700,586 bytes, `last-modified:
    Thu, 04 Jun 2026 05:55:07 GMT`
- `https://docs.firecrawl.dev/api-reference/errors.md`
  - fetched 2026-06-04, 9,311 bytes, `last-modified:
    Thu, 04 Jun 2026 07:11:10 GMT`
- `https://docs.firecrawl.dev/api-reference/v2-openapi.json`
  - fetched 2026-06-04, 260,303 bytes, OpenAPI info version `v2`,
    `last-modified: Tue, 02 Jun 2026 22:03:12 GMT`
- `https://www.npmjs.com/package/firecrawl`

Refreshed v2 OpenAPI paths included:

- `/scrape`
- `/scrape/{jobId}`
- `/scrape/{jobId}/interact`
- `/parse`
- `/search`
- `/search/{jobId}/feedback`
- `/map`
- `/crawl`
- `/crawl/{id}`
- `/crawl/{id}/errors`
- `/crawl/active`
- `/crawl/params-preview`
- `/batch/scrape`
- `/batch/scrape/{id}`
- `/batch/scrape/{id}/errors`
- `/monitor`
- `/monitor/{monitorId}`
- `/monitor/{monitorId}/run`
- `/monitor/{monitorId}/checks`
- `/monitor/{monitorId}/checks/{checkId}`
- `/extract`
- `/extract/{id}`
- `/agent`
- `/agent/{jobId}`
- `/browser`
- `/browser/{sessionId}`
- `/browser/{sessionId}/execute`
- `/team/credit-usage`
- `/team/credit-usage/historical`
- `/team/token-usage`
- `/team/token-usage/historical`
- `/team/queue-status`
- `/team/activity`
- `/support/ask`
- `/support/docs-search`

OpenAPI contains extra support/account/activity/search-feedback/scrape-status
surfaces that are not in the required SDK wrapper surface. They are excluded
from V1 because they are not present on the current nondeprecated SDK client
surface. Conversely, the SDK includes `getConcurrency()` backed by
`/v2/concurrency-check`, but the refreshed OpenAPI/docs index does not expose a
matching path. This is classified as source/docs drift, not an ambiguous SDK
method surface: the current npm type declarations and local source both expose
`getConcurrency()` as a nondeprecated v2 SDK method, so it remains in scope.

## Local SDK Files Inspected

- `src/index.ts`
- `src/v2/client.ts`
- `src/v2/types.ts`
- `src/v2/watcher.ts`
- `src/v2/methods/agent.ts`
- `src/v2/methods/batch.ts`
- `src/v2/methods/browser.ts`
- `src/v2/methods/crawl.ts`
- `src/v2/methods/extract.ts`
- `src/v2/methods/map.ts`
- `src/v2/methods/monitor.ts`
- `src/v2/methods/parse.ts`
- `src/v2/methods/scrape.ts`
- `src/v2/methods/search.ts`
- `src/v2/methods/usage.ts`
- `src/v2/utils/errorHandler.ts`
- `src/v2/utils/httpClient.ts`
- `src/v2/utils/pagination.ts`
- `src/v2/utils/validation.ts`

The npm `firecrawl@4.25.2` tarball was also inspected at
`/tmp/firecrawl-npm-4.25.2/package`:

- `package.json`
- `dist/index.d.ts`
- `dist/index.d.cts`
- `src/index.ts`
- `src/v2/client.ts`
- `src/v2/types.ts`
- `src/v2/watcher.ts`
- `src/v2/methods/**`

The published type declaration confirms the same v2 client method surface as
the local clone, including nondeprecated `getConcurrency()` and deprecated
extract/v1 compatibility aliases.

## In-Scope Method Matrix

Implementation must refresh this table and keep schema names current.

| Method | Local SDK evidence | Payload schema | Success schema | Failure schema |
| --- | --- | --- | --- | --- |
| `scrape` | `src/v2/client.ts` delegates to `methods/scrape.ts`; POST `/v2/scrape`. | `FirecrawlScrapePayload` | `FirecrawlScrapeSuccess` | `FirecrawlScrapeFailure` |
| `interact` | `src/v2/client.ts`; POST `/v2/scrape/{jobId}/interact`. | `FirecrawlInteractPayload` | `FirecrawlInteractSuccess` | `FirecrawlInteractFailure` |
| `stopInteraction` | `src/v2/client.ts`; DELETE `/v2/scrape/{jobId}/interact`. | `FirecrawlStopInteractionPayload` | `FirecrawlStopInteractionSuccess` | `FirecrawlStopInteractionFailure` |
| `parse` | `src/v2/client.ts` delegates to `methods/parse.ts`; POST `/v2/parse`. | `FirecrawlParsePayload` | `FirecrawlParseSuccess` | `FirecrawlParseFailure` |
| `search` | `src/v2/client.ts` delegates to `methods/search.ts`; POST `/v2/search`. | `FirecrawlSearchPayload` | `FirecrawlSearchSuccess` | `FirecrawlSearchFailure` |
| `map` | `src/v2/client.ts` delegates to `methods/map.ts`; POST `/v2/map`. | `FirecrawlMapPayload` | `FirecrawlMapSuccess` | `FirecrawlMapFailure` |
| `startCrawl` | `src/v2/client.ts`; POST `/v2/crawl`. | `FirecrawlStartCrawlPayload` | `FirecrawlStartCrawlSuccess` | `FirecrawlStartCrawlFailure` |
| `getCrawlStatus` | `src/v2/client.ts`; GET `/v2/crawl/{id}`. | `FirecrawlGetCrawlStatusPayload` | `FirecrawlGetCrawlStatusSuccess` | `FirecrawlGetCrawlStatusFailure` |
| `cancelCrawl` | `src/v2/client.ts`; DELETE `/v2/crawl/{id}`. | `FirecrawlCancelCrawlPayload` | `FirecrawlCancelCrawlSuccess` | `FirecrawlCancelCrawlFailure` |
| `crawl` | `src/v2/client.ts`; waiter around start/status. | `FirecrawlCrawlPayload` | `FirecrawlCrawlSuccess` | `FirecrawlCrawlFailure` |
| `getCrawlErrors` | `src/v2/client.ts`; GET `/v2/crawl/{id}/errors`. | `FirecrawlGetCrawlErrorsPayload` | `FirecrawlGetCrawlErrorsSuccess` | `FirecrawlGetCrawlErrorsFailure` |
| `getActiveCrawls` | `src/v2/client.ts`; GET `/v2/crawl/active`. | `FirecrawlGetActiveCrawlsPayload` | `FirecrawlGetActiveCrawlsSuccess` | `FirecrawlGetActiveCrawlsFailure` |
| `crawlParamsPreview` | `src/v2/client.ts`; POST `/v2/crawl/params-preview`. | `FirecrawlCrawlParamsPreviewPayload` | `FirecrawlCrawlParamsPreviewSuccess` | `FirecrawlCrawlParamsPreviewFailure` |
| `createMonitor` | `src/v2/client.ts`; monitor methods. | `FirecrawlCreateMonitorPayload` | `FirecrawlCreateMonitorSuccess` | `FirecrawlCreateMonitorFailure` |
| `listMonitors` | `src/v2/client.ts`; monitor methods. | `FirecrawlListMonitorsPayload` | `FirecrawlListMonitorsSuccess` | `FirecrawlListMonitorsFailure` |
| `getMonitor` | `src/v2/client.ts`; monitor methods. | `FirecrawlGetMonitorPayload` | `FirecrawlGetMonitorSuccess` | `FirecrawlGetMonitorFailure` |
| `updateMonitor` | `src/v2/client.ts`; monitor methods. | `FirecrawlUpdateMonitorPayload` | `FirecrawlUpdateMonitorSuccess` | `FirecrawlUpdateMonitorFailure` |
| `deleteMonitor` | `src/v2/client.ts`; monitor methods. | `FirecrawlDeleteMonitorPayload` | `FirecrawlDeleteMonitorSuccess` | `FirecrawlDeleteMonitorFailure` |
| `runMonitor` | `src/v2/client.ts`; monitor methods. | `FirecrawlRunMonitorPayload` | `FirecrawlRunMonitorSuccess` | `FirecrawlRunMonitorFailure` |
| `listMonitorChecks` | `src/v2/client.ts`; monitor methods. | `FirecrawlListMonitorChecksPayload` | `FirecrawlListMonitorChecksSuccess` | `FirecrawlListMonitorChecksFailure` |
| `getMonitorCheck` | `src/v2/client.ts`; monitor methods. | `FirecrawlGetMonitorCheckPayload` | `FirecrawlGetMonitorCheckSuccess` | `FirecrawlGetMonitorCheckFailure` |
| `startBatchScrape` | `src/v2/client.ts`; POST `/v2/batch/scrape`. | `FirecrawlStartBatchScrapePayload` | `FirecrawlStartBatchScrapeSuccess` | `FirecrawlStartBatchScrapeFailure` |
| `getBatchScrapeStatus` | `src/v2/client.ts`; GET `/v2/batch/scrape/{id}`. | `FirecrawlGetBatchScrapeStatusPayload` | `FirecrawlGetBatchScrapeStatusSuccess` | `FirecrawlGetBatchScrapeStatusFailure` |
| `getBatchScrapeErrors` | `src/v2/client.ts`; GET `/v2/batch/scrape/{id}/errors`. | `FirecrawlGetBatchScrapeErrorsPayload` | `FirecrawlGetBatchScrapeErrorsSuccess` | `FirecrawlGetBatchScrapeErrorsFailure` |
| `cancelBatchScrape` | `src/v2/client.ts`; DELETE `/v2/batch/scrape/{id}`. | `FirecrawlCancelBatchScrapePayload` | `FirecrawlCancelBatchScrapeSuccess` | `FirecrawlCancelBatchScrapeFailure` |
| `batchScrape` | `src/v2/client.ts`; waiter around batch start/status. | `FirecrawlBatchScrapePayload` | `FirecrawlBatchScrapeSuccess` | `FirecrawlBatchScrapeFailure` |
| `startAgent` | `src/v2/client.ts`; POST `/v2/agent`. | `FirecrawlStartAgentPayload` | `FirecrawlStartAgentSuccess` | `FirecrawlStartAgentFailure` |
| `getAgentStatus` | `src/v2/client.ts`; GET `/v2/agent/{jobId}`. | `FirecrawlGetAgentStatusPayload` | `FirecrawlGetAgentStatusSuccess` | `FirecrawlGetAgentStatusFailure` |
| `agent` | `src/v2/client.ts`; waiter around agent start/status. | `FirecrawlAgentPayload` | `FirecrawlAgentSuccess` | `FirecrawlAgentFailure` |
| `cancelAgent` | `src/v2/client.ts`; DELETE `/v2/agent/{jobId}`. | `FirecrawlCancelAgentPayload` | `FirecrawlCancelAgentSuccess` | `FirecrawlCancelAgentFailure` |
| `browser` | `src/v2/client.ts`; POST `/v2/browser`. | `FirecrawlBrowserPayload` | `FirecrawlBrowserSuccess` | `FirecrawlBrowserFailure` |
| `browserExecute` | `src/v2/client.ts`; POST `/v2/browser/{sessionId}/execute`. | `FirecrawlBrowserExecutePayload` | `FirecrawlBrowserExecuteSuccess` | `FirecrawlBrowserExecuteFailure` |
| `deleteBrowser` | `src/v2/client.ts`; DELETE `/v2/browser/{sessionId}`. | `FirecrawlDeleteBrowserPayload` | `FirecrawlDeleteBrowserSuccess` | `FirecrawlDeleteBrowserFailure` |
| `listBrowsers` | `src/v2/client.ts`; GET `/v2/browser`. | `FirecrawlListBrowsersPayload` | `FirecrawlListBrowsersSuccess` | `FirecrawlListBrowsersFailure` |
| `getConcurrency` | `src/v2/client.ts`; usage methods. | `FirecrawlGetConcurrencyPayload` | `FirecrawlGetConcurrencySuccess` | `FirecrawlGetConcurrencyFailure` |
| `getCreditUsage` | `src/v2/client.ts`; usage methods. | `FirecrawlGetCreditUsagePayload` | `FirecrawlGetCreditUsageSuccess` | `FirecrawlGetCreditUsageFailure` |
| `getTokenUsage` | `src/v2/client.ts`; usage methods. | `FirecrawlGetTokenUsagePayload` | `FirecrawlGetTokenUsageSuccess` | `FirecrawlGetTokenUsageFailure` |
| `getCreditUsageHistorical` | `src/v2/client.ts`; usage methods. | `FirecrawlGetCreditUsageHistoricalPayload` | `FirecrawlGetCreditUsageHistoricalSuccess` | `FirecrawlGetCreditUsageHistoricalFailure` |
| `getTokenUsageHistorical` | `src/v2/client.ts`; usage methods. | `FirecrawlGetTokenUsageHistoricalPayload` | `FirecrawlGetTokenUsageHistoricalSuccess` | `FirecrawlGetTokenUsageHistoricalFailure` |
| `getQueueStatus` | `src/v2/client.ts`; usage methods. | `FirecrawlGetQueueStatusPayload` | `FirecrawlGetQueueStatusSuccess` | `FirecrawlGetQueueStatusFailure` |
| `watcher` | `src/v2/client.ts` constructs `Watcher`; `src/v2/watcher.ts` emits events. | `FirecrawlWatcherPayload` | `FirecrawlWatcherSuccess` | `FirecrawlWatcherFailure` |

## Excluded Methods And Rationale

| Excluded method | Evidence | Rationale |
| --- | --- | --- |
| `scrapeUrl` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `scrape`. | Excluded from required V1 wrapper surface. |
| `crawlUrl` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `crawl`. | Excluded from required V1 wrapper surface. |
| `asyncCrawlUrl` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `startCrawl`. | Excluded from required V1 wrapper surface. |
| `checkCrawlStatus` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `getCrawlStatus`. | Excluded from required V1 wrapper surface. |
| `checkCrawlErrors` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `getCrawlErrors`. | Excluded from required V1 wrapper surface. |
| `mapUrl` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `map`. | Excluded from required V1 wrapper surface. |
| `batchScrapeUrls` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `batchScrape`. | Excluded from required V1 wrapper surface. |
| `asyncBatchScrapeUrls` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `startBatchScrape`. | Excluded from required V1 wrapper surface. |
| `checkBatchScrapeStatus` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `getBatchScrapeStatus`. | Excluded from required V1 wrapper surface. |
| `checkBatchScrapeErrors` | `src/v2/client.ts` marks as deprecated v1 compatibility alias for `getBatchScrapeErrors`. | Excluded from required V1 wrapper surface. |
| `scrapeExecute` | `src/v2/client.ts` marks as deprecated alias for `interact`. | Use `interact`. |
| `stopInteractiveBrowser` | `src/v2/client.ts` marks as deprecated alias for `stopInteraction`. | Use `stopInteraction`. |
| `deleteScrapeBrowser` | `src/v2/client.ts` marks as deprecated alias for `stopInteraction`. | Use `stopInteraction`. |
| `startExtract` | `src/v2/client.ts` and `src/v2/methods/extract.ts` mark extract as maintenance mode. | Explicit extract deferment. |
| `getExtractStatus` | `src/v2/client.ts` and `src/v2/methods/extract.ts` mark extract as maintenance mode. | Explicit extract deferment. |
| `extract` | `src/v2/client.ts` and `src/v2/methods/extract.ts` mark extract as maintenance mode. | Explicit extract deferment. |

## LiteralKit Domains To Model

Refresh this list at implementation time. Initial domains observed:

- `FirecrawlFormatType`: `markdown`, `html`, `rawHtml`, `links`, `images`,
  `screenshot`, `summary`, `changeTracking`, `json`, `attributes`,
  `branding`, `audio`, `video`, `pii`
- `FirecrawlQuestionFormatType`: `question`
- `FirecrawlHighlightsFormatType`: `highlights`
- `FirecrawlParseFormatType`: `FormatString` excluding screenshot,
  changeTracking, branding, audio, and video
- `FirecrawlSearchSourceType`: `web`, `news`, `images`
- `FirecrawlCategoryType`: `github`, `research`, `pdf`
- `FirecrawlCrawlStatus`: `scraping`, `completed`, `failed`, `cancelled`
- `FirecrawlBatchScrapeStatus`: `scraping`, `completed`, `failed`,
  `cancelled`
- `FirecrawlAgentStatus`: `processing`, `completed`, `failed`
- `FirecrawlAgentModel`: `spark-1-pro`, `spark-1-mini`
- `FirecrawlScrapeActionType`: `wait`, `screenshot`, `click`, `write`,
  `press`, `scroll`, `scrape`, `executeJavascript`, `pdf`
- `FirecrawlProxyMode`: `basic`, `stealth`, `enhanced`, `auto`
- `FirecrawlRedactPIIEntity`: `PERSON`, `EMAIL`, `PHONE`, `LOCATION`,
  `FINANCIAL`, `SECRET`
- `FirecrawlRedactPIIMode`: `accurate`, `aggressive`, `fast`
- `FirecrawlRedactPIIReplaceStyle`: `tag`, `mask`, `remove`
- `FirecrawlPIIStatus`: `ok`, `skipped`, `failed`
- `FirecrawlPIIReason`: `empty_input`, `too_large`, `upstream_skipped`,
  `service_unavailable`, `timeout`, `error`
- `FirecrawlWebhookEvent`: `completed`, `failed`, `page`, `started`
- `FirecrawlAgentWebhookEvent`: `started`, `action`, `completed`, `failed`,
  `cancelled`
- `FirecrawlMonitorTargetType`: `scrape`, `crawl`
- `FirecrawlMonitorStatus`: `active`, `paused`, `deleted`
- `FirecrawlMonitorCheckStatus`: `queued`, `running`, `completed`, `failed`,
  `partial`, `skipped_overlap`
- `FirecrawlMonitorTrigger`: `scheduled`, `manual`
- `FirecrawlMonitorBillingStatus`: `not_applicable`, `reserved`,
  `confirmed`, `released`, `failed`
- `FirecrawlMonitorPageStatus`: `same`, `new`, `changed`, `removed`, `error`
- `FirecrawlBrowserLanguage`: `python`, `node`, `bash`
- `FirecrawlBrowserSessionStatus`: `active`, `destroyed`
- `FirecrawlWatcherKind`: `crawl`, `batch`
- `FirecrawlWatcherEventType`: `document`, `snapshot`, `done`, `error`
- `FirecrawlErrorReason`: `config`, `request encoding`, `response decoding`,
  `response status`, `transport`, `sdk thrown`, `schema decoding`,
  `watcher`, `timeout`, `interrupted`

Current SDK/OpenAPI also carry deprecated format object `type: "query"` with
`mode: "freeform" | "directQuote"` and comments instructing callers to use
`QuestionFormat` or `HighlightsFormat` instead. The driver should prefer
nondeprecated `question` and `highlights` format object variants. If it accepts
`query` for SDK parity, mark it deprecated and keep it out of examples.

## Tagged And Discriminated Unions To Model

Refresh this list at implementation time. Initial candidates:

- Format option union by `type`.
- Parse format option union by `type`.
- Scrape action union by `type`.
- Search source union by `type`.
- Category option union by `type`.
- Monitor target union by `type`.
- Watcher event union by event `type`.
- Job status snapshots by `status` where fields differ.
- Browser execution language by `language` if behavior branches by language.
- Deprecated SDK `query` format object by `type`, only if accepted for SDK
  parity; do not use it in examples.

Use `S.TaggedUnion` for canonical `_tag` unions and
`LiteralKit.mapMembers` plus `Tuple.evolve` plus `S.toTaggedUnion` for
external discriminants such as `type`, `status`, or `language`.

## Option And Nullish Transform Policy

Every external optional, nullable, undefined, or nullish field becomes Effect
`Option` at the schema boundary.

Use:

- `S.OptionFromOptional` or `S.OptionFromOptionalKey` for optional fields.
- `S.OptionFromNullOr` for nullable fields.
- `S.OptionFromNullishOr` for values that may be absent, `undefined`, or
  `null`.

Do not leak undefined/null into domain/service logic. When shaping runtime
objects from Option values, use `R.getSomes({...})` when `None` should omit a
key and `O.all({...})` when an object is all-or-nothing.

## Failure And Retry Model

Firecrawl error docs state that non-2xx responses use a JSON shape with
`success: false`, `error`, and sometimes `details` or `code`. The retry table
marks these as generally retryable:

- `408`
- `429`
- `500`
- `502`
- `503`
- `504`

`422` is sometimes retryable depending on cause. Treat the docs' retry guidance
as authoritative, not HTTP status alone. Respect `Retry-After` on `429` where
available.

The driver should decode failure bodies where possible, attach sanitized
method/status/retry metadata to `FirecrawlError`, and avoid carrying raw bodies
or sensitive user input.

## Watcher Event Model

Local `src/v2/watcher.ts` emits:

- `document` for individual documents
- `snapshot` for crawl/batch status snapshots
- `done` for terminal status payloads
- `error` for watcher failures

It attempts websocket first and falls back to polling. The wrapper must expose
an Effect stream and close the SDK watcher when interrupted or complete.

Required schemas:

- `FirecrawlWatcherPayload`
- `FirecrawlWatcherSuccess`
- `FirecrawlWatcherFailure`
- `FirecrawlWatcherEvent`
- `FirecrawlWatcherDocumentEvent`
- `FirecrawlWatcherSnapshotEvent`
- `FirecrawlWatcherDoneEvent`
- `FirecrawlWatcherErrorEvent`

## Live Integration Smoke Scope

Default live smoke tests must be env-gated by `FIRECRAWL_API_KEY` and low-cost.

Recommended smoke scope:

- `scrape` against a stable lightweight public URL.
- `map` against a stable lightweight docs/example URL with a low limit.
- `getCreditUsage`, `getTokenUsage`, `getConcurrency`, or `getQueueStatus`
  where the current SDK/docs prove these are safe account reads.

Do not run live tests for every method. Do not create monitors, browser
sessions, crawls, agents, or batch jobs by default unless explicitly opted in
and cleanup is proven.

## Drift To Re-Check

- The local clone SDK package name is `@mendable/firecrawl-js`, but npm
  `firecrawl` is the intended modern package. Refreshed npm tarball inspection
  confirms `firecrawl@4.25.2` is viable and should be used.
- The local SDK package version and npm latest both observed as `4.25.2`, but
  local package dependency on `firecrawl` was `4.16.0`. The published
  `firecrawl@4.25.2` package has no nested `firecrawl` dependency, so this is
  local-monorepo packaging drift rather than a driver dependency blocker.
- Live OpenAPI includes `/extract` and `/extract/{id}`, but local SDK marks
  extract maintenance-mode deprecated; this packet intentionally excludes
  extract.
- Live OpenAPI includes support/account/activity/search-feedback and
  `GET /scrape/{jobId}` surfaces outside the requested method list; classify
  them before deciding whether to defer or update scope.
- Live OpenAPI/docs index does not expose `/v2/concurrency-check`, but the
  current SDK source and published `dist/index.d.ts` expose nondeprecated
  `getConcurrency()`. Keep `getConcurrency()` in scope because this packet wraps
  the current nondeprecated SDK client surface.
- Current SDK/OpenAPI include nondeprecated `question` and `highlights` format
  object variants. The SDK also includes deprecated `query`; prefer
  `question`/`highlights` in schemas and examples, and only include `query` as
  a deprecated compatibility payload if strict SDK parity requires it.
- Firecrawl docs and SDK surface can change quickly; re-run npm/docs/local
  checks at implementation time.
