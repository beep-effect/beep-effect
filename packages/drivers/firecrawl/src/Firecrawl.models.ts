/**
 * Schema-first request, response, failure, and watcher models for Firecrawl.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type {
  ActiveCrawlsResponse,
  AgentResponse,
  AgentStatusResponse,
  AgentWebhookConfig,
  BatchScrapeJob,
  BatchScrapeOptions,
  BatchScrapeResponse,
  BrowserCreateResponse,
  BrowserDeleteResponse,
  BrowserExecuteResponse,
  BrowserListResponse,
  ConcurrencyCheck,
  CrawlErrorsResponse,
  CrawlJob,
  CrawlOptions,
  CrawlResponse,
  CreateMonitorRequest,
  CreditUsage,
  CreditUsageHistoricalResponse,
  Document,
  GetMonitorCheckOptions,
  ListMonitorChecksOptions,
  ListMonitorsOptions,
  MapData,
  MapOptions,
  Monitor,
  MonitorCheck,
  MonitorCheckDetail,
  PaginationConfig,
  ParseFile,
  ParseOptions,
  QueueStatusResponse,
  ScrapeBrowserDeleteResponse,
  ScrapeExecuteRequest,
  ScrapeExecuteResponse,
  ScrapeOptions,
  SearchData,
  SearchRequest,
  TokenUsage,
  TokenUsageHistoricalResponse,
  UpdateMonitorRequest,
  WatcherOptions,
} from "firecrawl";

const $I = $FirecrawlId.create("Firecrawl.models");

const typedUnknown = <A>(name: string, description: string): S.Decoder<A> =>
  S.declare<A>((value: unknown): value is A => P.isUnknown(value), {
    description,
    expected: "FirecrawlSdkShape",
  }).pipe(
    $I.annoteSchema(name, {
      description,
    })
  );

const optionalString = S.OptionFromOptionalKey(S.String).pipe(
  S.withConstructorDefault(Effect.succeed(O.none<string>()))
);
const optionalNumber = S.OptionFromOptionalKey(S.Number).pipe(
  S.withConstructorDefault(Effect.succeed(O.none<number>()))
);
const optionalBoolean = S.OptionFromOptionalKey(S.Boolean).pipe(
  S.withConstructorDefault(Effect.succeed(O.none<boolean>()))
);
const optionalUnknown = S.OptionFromOptionalKey(S.Unknown).pipe(
  S.withConstructorDefault(Effect.succeed(O.none<unknown>()))
);

type FirecrawlSdkAgentRequest = {
  readonly integration?: string;
  readonly maxCredits?: number;
  readonly model?: "spark-1-mini" | "spark-1-pro";
  readonly origin?: string;
  readonly prompt: string;
  readonly schema?: Record<string, unknown>;
  readonly strictConstrainToURLs?: boolean;
  readonly urls?: Array<string>;
  readonly webhook?: string | AgentWebhookConfig;
};

type FirecrawlSdkAgentWaitRequest = FirecrawlSdkAgentRequest & {
  readonly pollInterval?: number;
  readonly timeout?: number;
};

/**
 * Output formats accepted by Firecrawl scrape endpoints.
 *
 * @example
 * ```ts
 * import { FirecrawlFormatType } from "@beep/firecrawl"
 *
 * console.log(FirecrawlFormatType.is.markdown("markdown"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlFormatType = LiteralKit([
  "markdown",
  "html",
  "rawHtml",
  "links",
  "images",
  "screenshot",
  "summary",
  "changeTracking",
  "json",
  "attributes",
  "branding",
  "audio",
  "video",
  "pii",
]).pipe(
  $I.annoteSchema("FirecrawlFormatType", {
    description: "Output formats accepted by Firecrawl scrape endpoints.",
  })
);

/**
 * Type for {@link FirecrawlFormatType}.
 *
 * @example
 * ```ts
 * import type { FirecrawlFormatType } from "@beep/firecrawl"
 *
 * const format: FirecrawlFormatType = "markdown"
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlFormatType = typeof FirecrawlFormatType.Type;

/**
 * Firecrawl scrape-browser action types.
 *
 * @example
 * ```ts
 * import { FirecrawlScrapeActionType } from "@beep/firecrawl"
 *
 * console.log(FirecrawlScrapeActionType.is.click("click"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlScrapeActionType = LiteralKit([
  "wait",
  "screenshot",
  "click",
  "write",
  "press",
  "scroll",
  "scrape",
  "executeJavascript",
  "pdf",
]).pipe(
  $I.annoteSchema("FirecrawlScrapeActionType", {
    description: "Firecrawl scrape-browser action types.",
  })
);

/**
 * Type for {@link FirecrawlScrapeActionType}.
 *
 * @example
 * ```ts
 * import type { FirecrawlScrapeActionType } from "@beep/firecrawl"
 *
 * const action: FirecrawlScrapeActionType = "click"
 * console.log(action)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlScrapeActionType = typeof FirecrawlScrapeActionType.Type;

/**
 * Firecrawl search source types.
 *
 * @example
 * ```ts
 * import { FirecrawlSearchSourceType } from "@beep/firecrawl"
 *
 * console.log(FirecrawlSearchSourceType.is.web("web"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlSearchSourceType = LiteralKit(["web", "news", "images"]).pipe(
  $I.annoteSchema("FirecrawlSearchSourceType", {
    description: "Firecrawl search source types.",
  })
);

/**
 * Type for {@link FirecrawlSearchSourceType}.
 *
 * @example
 * ```ts
 * import type { FirecrawlSearchSourceType } from "@beep/firecrawl"
 *
 * const source: FirecrawlSearchSourceType = "web"
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlSearchSourceType = typeof FirecrawlSearchSourceType.Type;

/**
 * Firecrawl crawl and batch status values.
 *
 * @example
 * ```ts
 * import { FirecrawlJobStatus } from "@beep/firecrawl"
 *
 * console.log(FirecrawlJobStatus.is.completed("completed"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlJobStatus = LiteralKit(["scraping", "completed", "failed", "cancelled"]).pipe(
  $I.annoteSchema("FirecrawlJobStatus", {
    description: "Firecrawl crawl and batch status values.",
  })
);

/**
 * Type for {@link FirecrawlJobStatus}.
 *
 * @example
 * ```ts
 * import type { FirecrawlJobStatus } from "@beep/firecrawl"
 *
 * const status: FirecrawlJobStatus = "completed"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlJobStatus = typeof FirecrawlJobStatus.Type;

/**
 * Firecrawl agent status values.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentStatus } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentStatus.is.processing("processing"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlAgentStatus = LiteralKit(["processing", "completed", "failed"]).pipe(
  $I.annoteSchema("FirecrawlAgentStatus", {
    description: "Firecrawl agent status values.",
  })
);

/**
 * Type for {@link FirecrawlAgentStatus}.
 *
 * @example
 * ```ts
 * import type { FirecrawlAgentStatus } from "@beep/firecrawl"
 *
 * const status: FirecrawlAgentStatus = "processing"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlAgentStatus = typeof FirecrawlAgentStatus.Type;

/**
 * Firecrawl browser execution languages.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserLanguage } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserLanguage.is.node("node"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBrowserLanguage = LiteralKit(["python", "node", "bash"]).pipe(
  $I.annoteSchema("FirecrawlBrowserLanguage", {
    description: "Firecrawl browser execution languages.",
  })
);

/**
 * Type for {@link FirecrawlBrowserLanguage}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBrowserLanguage } from "@beep/firecrawl"
 *
 * const language: FirecrawlBrowserLanguage = "node"
 * console.log(language)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBrowserLanguage = typeof FirecrawlBrowserLanguage.Type;

/**
 * Firecrawl watcher job kinds.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherKind } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherKind.is.crawl("crawl"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlWatcherKind = LiteralKit(["crawl", "batch"]).pipe(
  $I.annoteSchema("FirecrawlWatcherKind", {
    description: "Firecrawl watcher job kinds.",
  })
);

/**
 * Type for {@link FirecrawlWatcherKind}.
 *
 * @example
 * ```ts
 * import type { FirecrawlWatcherKind } from "@beep/firecrawl"
 *
 * const kind: FirecrawlWatcherKind = "crawl"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlWatcherKind = typeof FirecrawlWatcherKind.Type;

/**
 * Firecrawl watcher event types.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherEventType } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherEventType.is.document("document"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlWatcherEventType = LiteralKit(["document", "snapshot", "done", "error"]).pipe(
  $I.annoteSchema("FirecrawlWatcherEventType", {
    description: "Firecrawl watcher event types emitted by the SDK watcher.",
  })
);

/**
 * Type for {@link FirecrawlWatcherEventType}.
 *
 * @example
 * ```ts
 * import type { FirecrawlWatcherEventType } from "@beep/firecrawl"
 *
 * const eventType: FirecrawlWatcherEventType = "document"
 * console.log(eventType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlWatcherEventType = typeof FirecrawlWatcherEventType.Type;

/**
 * Opaque Firecrawl scrape options accepted by the SDK.
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlScrapeOptions = typedUnknown<ScrapeOptions>(
  "FirecrawlScrapeOptions",
  "Opaque Firecrawl scrape options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlScrapeOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlScrapeOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlScrapeOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlScrapeOptions = typeof FirecrawlScrapeOptions.Type;

/**
 * Opaque Firecrawl parse file accepted by the SDK.
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlParseFile = typedUnknown<ParseFile>(
  "FirecrawlParseFile",
  "Opaque Firecrawl parse file accepted by the SDK."
);
/**
 * Type for {@link FirecrawlParseFile}.
 *
 * @example
 * ```ts
 * import type { FirecrawlParseFile } from "@beep/firecrawl"
 *
 * const value: FirecrawlParseFile | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlParseFile = typeof FirecrawlParseFile.Type;

/**
 * Opaque Firecrawl parse options accepted by the SDK.
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlParseOptions = typedUnknown<ParseOptions>(
  "FirecrawlParseOptions",
  "Opaque Firecrawl parse options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlParseOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlParseOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlParseOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlParseOptions = typeof FirecrawlParseOptions.Type;

/**
 * Firecrawl Search Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlSearchOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlSearchOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlSearchOptions = typedUnknown<Omit<SearchRequest, "query">>(
  "FirecrawlSearchOptions",
  "Opaque Firecrawl search options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlSearchOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlSearchOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlSearchOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlSearchOptions = typeof FirecrawlSearchOptions.Type;

/**
 * Firecrawl Map Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlMapOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMapOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMapOptions = typedUnknown<MapOptions>(
  "FirecrawlMapOptions",
  "Opaque Firecrawl map options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlMapOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMapOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlMapOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMapOptions = typeof FirecrawlMapOptions.Type;

/**
 * Firecrawl Crawl Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCrawlOptions = typedUnknown<CrawlOptions>(
  "FirecrawlCrawlOptions",
  "Opaque Firecrawl crawl options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlCrawlOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCrawlOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlCrawlOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCrawlOptions = typeof FirecrawlCrawlOptions.Type;

/**
 * Firecrawl Crawl Wait Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlWaitOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlWaitOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCrawlWaitOptions = typedUnknown<
  CrawlOptions & { readonly pollInterval?: number; readonly timeout?: number }
>("FirecrawlCrawlWaitOptions", "Opaque Firecrawl crawl waiter options accepted by the SDK.");
/**
 * Type for {@link FirecrawlCrawlWaitOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCrawlWaitOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlCrawlWaitOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCrawlWaitOptions = typeof FirecrawlCrawlWaitOptions.Type;

/**
 * Firecrawl Pagination Config schema.
 *
 * @example
 * ```ts
 * import { FirecrawlPaginationConfig } from "@beep/firecrawl"
 *
 * console.log(FirecrawlPaginationConfig)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlPaginationConfig = typedUnknown<PaginationConfig>(
  "FirecrawlPaginationConfig",
  "Opaque Firecrawl pagination config accepted by the SDK."
);
/**
 * Type for {@link FirecrawlPaginationConfig}.
 *
 * @example
 * ```ts
 * import type { FirecrawlPaginationConfig } from "@beep/firecrawl"
 *
 * const value: FirecrawlPaginationConfig | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlPaginationConfig = typeof FirecrawlPaginationConfig.Type;

/**
 * Firecrawl Create Monitor Request opaque SDK request schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCreateMonitorRequest } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCreateMonitorRequest)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCreateMonitorRequest = typedUnknown<CreateMonitorRequest>(
  "FirecrawlCreateMonitorRequest",
  "Opaque Firecrawl monitor creation request accepted by the SDK."
);
/**
 * Type for {@link FirecrawlCreateMonitorRequest}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCreateMonitorRequest } from "@beep/firecrawl"
 *
 * const value: FirecrawlCreateMonitorRequest | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCreateMonitorRequest = typeof FirecrawlCreateMonitorRequest.Type;

/**
 * Firecrawl Update Monitor Request opaque SDK request schema.
 *
 * @example
 * ```ts
 * import { FirecrawlUpdateMonitorRequest } from "@beep/firecrawl"
 *
 * console.log(FirecrawlUpdateMonitorRequest)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlUpdateMonitorRequest = typedUnknown<UpdateMonitorRequest>(
  "FirecrawlUpdateMonitorRequest",
  "Opaque Firecrawl monitor update request accepted by the SDK."
);
/**
 * Type for {@link FirecrawlUpdateMonitorRequest}.
 *
 * @example
 * ```ts
 * import type { FirecrawlUpdateMonitorRequest } from "@beep/firecrawl"
 *
 * const value: FirecrawlUpdateMonitorRequest | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlUpdateMonitorRequest = typeof FirecrawlUpdateMonitorRequest.Type;

/**
 * Firecrawl List Monitors Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorsOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorsOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlListMonitorsOptions = typedUnknown<ListMonitorsOptions>(
  "FirecrawlListMonitorsOptions",
  "Opaque Firecrawl monitor list options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlListMonitorsOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlListMonitorsOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlListMonitorsOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlListMonitorsOptions = typeof FirecrawlListMonitorsOptions.Type;

/**
 * Firecrawl List Monitor Checks Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorChecksOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorChecksOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlListMonitorChecksOptions = typedUnknown<ListMonitorChecksOptions>(
  "FirecrawlListMonitorChecksOptions",
  "Opaque Firecrawl monitor check list options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlListMonitorChecksOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlListMonitorChecksOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlListMonitorChecksOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlListMonitorChecksOptions = typeof FirecrawlListMonitorChecksOptions.Type;

/**
 * Firecrawl Get Monitor Check Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlGetMonitorCheckOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetMonitorCheckOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlGetMonitorCheckOptions = typedUnknown<GetMonitorCheckOptions>(
  "FirecrawlGetMonitorCheckOptions",
  "Opaque Firecrawl monitor check pagination options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlGetMonitorCheckOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlGetMonitorCheckOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlGetMonitorCheckOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlGetMonitorCheckOptions = typeof FirecrawlGetMonitorCheckOptions.Type;

/**
 * Firecrawl Batch Scrape Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBatchScrapeOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBatchScrapeOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBatchScrapeOptions = typedUnknown<BatchScrapeOptions>(
  "FirecrawlBatchScrapeOptions",
  "Opaque Firecrawl batch scrape options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlBatchScrapeOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBatchScrapeOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlBatchScrapeOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBatchScrapeOptions = typeof FirecrawlBatchScrapeOptions.Type;

/**
 * Firecrawl Batch Scrape Wait Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBatchScrapeWaitOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBatchScrapeWaitOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBatchScrapeWaitOptions = typedUnknown<
  BatchScrapeOptions & { readonly pollInterval?: number; readonly timeout?: number }
>("FirecrawlBatchScrapeWaitOptions", "Opaque Firecrawl batch scrape waiter options accepted by the SDK.");
/**
 * Type for {@link FirecrawlBatchScrapeWaitOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBatchScrapeWaitOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlBatchScrapeWaitOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBatchScrapeWaitOptions = typeof FirecrawlBatchScrapeWaitOptions.Type;

/**
 * Firecrawl Agent Request opaque SDK request schema.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentRequest } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentRequest)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlAgentRequest = typedUnknown<FirecrawlSdkAgentRequest>(
  "FirecrawlAgentRequest",
  "Opaque Firecrawl agent request accepted by the SDK."
);
/**
 * Type for {@link FirecrawlAgentRequest}.
 *
 * @example
 * ```ts
 * import type { FirecrawlAgentRequest } from "@beep/firecrawl"
 *
 * const value: FirecrawlAgentRequest | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlAgentRequest = typeof FirecrawlAgentRequest.Type;

/**
 * Firecrawl Agent Wait Request opaque SDK request schema.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentWaitRequest } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentWaitRequest)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlAgentWaitRequest = typedUnknown<FirecrawlSdkAgentWaitRequest>(
  "FirecrawlAgentWaitRequest",
  "Opaque Firecrawl agent waiter request accepted by the SDK."
);
/**
 * Type for {@link FirecrawlAgentWaitRequest}.
 *
 * @example
 * ```ts
 * import type { FirecrawlAgentWaitRequest } from "@beep/firecrawl"
 *
 * const value: FirecrawlAgentWaitRequest | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlAgentWaitRequest = typeof FirecrawlAgentWaitRequest.Type;

/**
 * Firecrawl Browser Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBrowserOptions = typedUnknown<Parameters<import("firecrawl").FirecrawlClient["browser"]>[0]>(
  "FirecrawlBrowserOptions",
  "Opaque Firecrawl browser session options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlBrowserOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBrowserOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlBrowserOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBrowserOptions = typeof FirecrawlBrowserOptions.Type;

/**
 * Firecrawl Interact Request opaque SDK request schema.
 *
 * @example
 * ```ts
 * import { FirecrawlInteractRequest } from "@beep/firecrawl"
 *
 * console.log(FirecrawlInteractRequest)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlInteractRequest = typedUnknown<ScrapeExecuteRequest>(
  "FirecrawlInteractRequest",
  "Opaque Firecrawl scrape interaction request accepted by the SDK."
);
/**
 * Type for {@link FirecrawlInteractRequest}.
 *
 * @example
 * ```ts
 * import type { FirecrawlInteractRequest } from "@beep/firecrawl"
 *
 * const value: FirecrawlInteractRequest | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlInteractRequest = typeof FirecrawlInteractRequest.Type;

/**
 * Firecrawl Browser Execute Request opaque SDK request schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserExecuteRequest } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserExecuteRequest)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBrowserExecuteRequest = typedUnknown<
  Parameters<import("firecrawl").FirecrawlClient["browserExecute"]>[1]
>("FirecrawlBrowserExecuteRequest", "Opaque Firecrawl browser execution request accepted by the SDK.");
/**
 * Type for {@link FirecrawlBrowserExecuteRequest}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBrowserExecuteRequest } from "@beep/firecrawl"
 *
 * const value: FirecrawlBrowserExecuteRequest | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBrowserExecuteRequest = typeof FirecrawlBrowserExecuteRequest.Type;

/**
 * Firecrawl List Browsers Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlListBrowsersOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListBrowsersOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlListBrowsersOptions = typedUnknown<
  Parameters<import("firecrawl").FirecrawlClient["listBrowsers"]>[0]
>("FirecrawlListBrowsersOptions", "Opaque Firecrawl browser list options accepted by the SDK.");
/**
 * Type for {@link FirecrawlListBrowsersOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlListBrowsersOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlListBrowsersOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlListBrowsersOptions = typeof FirecrawlListBrowsersOptions.Type;

/**
 * Firecrawl Watcher Options opaque SDK options schema.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherOptions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlWatcherOptions = typedUnknown<WatcherOptions>(
  "FirecrawlWatcherOptions",
  "Opaque Firecrawl watcher options accepted by the SDK."
);
/**
 * Type for {@link FirecrawlWatcherOptions}.
 *
 * @example
 * ```ts
 * import type { FirecrawlWatcherOptions } from "@beep/firecrawl"
 *
 * const value: FirecrawlWatcherOptions | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlWatcherOptions = typeof FirecrawlWatcherOptions.Type;

/**
 * Firecrawl Document schema.
 *
 * @example
 * ```ts
 * import { FirecrawlDocument } from "@beep/firecrawl"
 *
 * console.log(FirecrawlDocument)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlDocument = typedUnknown<Document>(
  "FirecrawlDocument",
  "Opaque Firecrawl document returned by the SDK."
);
/**
 * Type for {@link FirecrawlDocument}.
 *
 * @example
 * ```ts
 * import type { FirecrawlDocument } from "@beep/firecrawl"
 *
 * const value: FirecrawlDocument | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlDocument = typeof FirecrawlDocument.Type;
/**
 * Firecrawl Search Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlSearchData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlSearchData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlSearchData = typedUnknown<SearchData>(
  "FirecrawlSearchData",
  "Opaque Firecrawl search data returned by the SDK."
);
/**
 * Type for {@link FirecrawlSearchData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlSearchData } from "@beep/firecrawl"
 *
 * const value: FirecrawlSearchData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlSearchData = typeof FirecrawlSearchData.Type;
/**
 * Firecrawl Map Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlMapData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMapData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMapData = typedUnknown<MapData>(
  "FirecrawlMapData",
  "Opaque Firecrawl map data returned by the SDK."
);
/**
 * Type for {@link FirecrawlMapData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMapData } from "@beep/firecrawl"
 *
 * const value: FirecrawlMapData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMapData = typeof FirecrawlMapData.Type;
/**
 * Firecrawl Crawl Response Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlResponseData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlResponseData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCrawlResponseData = typedUnknown<CrawlResponse>(
  "FirecrawlCrawlResponseData",
  "Opaque Firecrawl crawl start response returned by the SDK."
);
/**
 * Type for {@link FirecrawlCrawlResponseData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCrawlResponseData } from "@beep/firecrawl"
 *
 * const value: FirecrawlCrawlResponseData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCrawlResponseData = typeof FirecrawlCrawlResponseData.Type;
/**
 * Firecrawl Crawl Job Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlJobData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlJobData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCrawlJobData = typedUnknown<CrawlJob>(
  "FirecrawlCrawlJobData",
  "Opaque Firecrawl crawl job returned by the SDK."
);
/**
 * Type for {@link FirecrawlCrawlJobData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCrawlJobData } from "@beep/firecrawl"
 *
 * const value: FirecrawlCrawlJobData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCrawlJobData = typeof FirecrawlCrawlJobData.Type;
/**
 * Firecrawl Crawl Errors Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlErrorsData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlErrorsData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCrawlErrorsData = typedUnknown<CrawlErrorsResponse>(
  "FirecrawlCrawlErrorsData",
  "Opaque Firecrawl crawl errors response returned by the SDK."
);
/**
 * Type for {@link FirecrawlCrawlErrorsData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCrawlErrorsData } from "@beep/firecrawl"
 *
 * const value: FirecrawlCrawlErrorsData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCrawlErrorsData = typeof FirecrawlCrawlErrorsData.Type;
/**
 * Firecrawl Active Crawls Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlActiveCrawlsData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlActiveCrawlsData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlActiveCrawlsData = typedUnknown<ActiveCrawlsResponse>(
  "FirecrawlActiveCrawlsData",
  "Opaque Firecrawl active crawls response returned by the SDK."
);
/**
 * Type for {@link FirecrawlActiveCrawlsData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlActiveCrawlsData } from "@beep/firecrawl"
 *
 * const value: FirecrawlActiveCrawlsData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlActiveCrawlsData = typeof FirecrawlActiveCrawlsData.Type;
/**
 * Firecrawl Monitor Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlMonitorData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMonitorData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMonitorData = typedUnknown<Monitor>(
  "FirecrawlMonitorData",
  "Opaque Firecrawl monitor returned by the SDK."
);
/**
 * Type for {@link FirecrawlMonitorData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMonitorData } from "@beep/firecrawl"
 *
 * const value: FirecrawlMonitorData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMonitorData = typeof FirecrawlMonitorData.Type;
/**
 * Firecrawl Monitor List Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlMonitorListData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMonitorListData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMonitorListData = typedUnknown<ReadonlyArray<Monitor>>(
  "FirecrawlMonitorListData",
  "Opaque Firecrawl monitor list returned by the SDK."
);
/**
 * Type for {@link FirecrawlMonitorListData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMonitorListData } from "@beep/firecrawl"
 *
 * const value: FirecrawlMonitorListData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMonitorListData = typeof FirecrawlMonitorListData.Type;
/**
 * Firecrawl Monitor Check Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlMonitorCheckData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMonitorCheckData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMonitorCheckData = typedUnknown<MonitorCheck>(
  "FirecrawlMonitorCheckData",
  "Opaque Firecrawl monitor check returned by the SDK."
);
/**
 * Type for {@link FirecrawlMonitorCheckData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMonitorCheckData } from "@beep/firecrawl"
 *
 * const value: FirecrawlMonitorCheckData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMonitorCheckData = typeof FirecrawlMonitorCheckData.Type;
/**
 * Firecrawl Monitor Check List Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlMonitorCheckListData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMonitorCheckListData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMonitorCheckListData = typedUnknown<ReadonlyArray<MonitorCheck>>(
  "FirecrawlMonitorCheckListData",
  "Opaque Firecrawl monitor check list returned by the SDK."
);
/**
 * Type for {@link FirecrawlMonitorCheckListData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMonitorCheckListData } from "@beep/firecrawl"
 *
 * const value: FirecrawlMonitorCheckListData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMonitorCheckListData = typeof FirecrawlMonitorCheckListData.Type;
/**
 * Firecrawl Monitor Check Detail Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlMonitorCheckDetailData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMonitorCheckDetailData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMonitorCheckDetailData = typedUnknown<MonitorCheckDetail>(
  "FirecrawlMonitorCheckDetailData",
  "Opaque Firecrawl monitor check detail returned by the SDK."
);
/**
 * Type for {@link FirecrawlMonitorCheckDetailData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMonitorCheckDetailData } from "@beep/firecrawl"
 *
 * const value: FirecrawlMonitorCheckDetailData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMonitorCheckDetailData = typeof FirecrawlMonitorCheckDetailData.Type;
/**
 * Firecrawl Batch Scrape Response Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBatchScrapeResponseData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBatchScrapeResponseData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBatchScrapeResponseData = typedUnknown<BatchScrapeResponse>(
  "FirecrawlBatchScrapeResponseData",
  "Opaque Firecrawl batch scrape start response returned by the SDK."
);
/**
 * Type for {@link FirecrawlBatchScrapeResponseData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBatchScrapeResponseData } from "@beep/firecrawl"
 *
 * const value: FirecrawlBatchScrapeResponseData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBatchScrapeResponseData = typeof FirecrawlBatchScrapeResponseData.Type;
/**
 * Firecrawl Batch Scrape Job Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBatchScrapeJobData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBatchScrapeJobData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBatchScrapeJobData = typedUnknown<BatchScrapeJob>(
  "FirecrawlBatchScrapeJobData",
  "Opaque Firecrawl batch scrape job returned by the SDK."
);
/**
 * Type for {@link FirecrawlBatchScrapeJobData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBatchScrapeJobData } from "@beep/firecrawl"
 *
 * const value: FirecrawlBatchScrapeJobData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBatchScrapeJobData = typeof FirecrawlBatchScrapeJobData.Type;
/**
 * Firecrawl Agent Response Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentResponseData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentResponseData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlAgentResponseData = typedUnknown<AgentResponse>(
  "FirecrawlAgentResponseData",
  "Opaque Firecrawl agent start response returned by the SDK."
);
/**
 * Type for {@link FirecrawlAgentResponseData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlAgentResponseData } from "@beep/firecrawl"
 *
 * const value: FirecrawlAgentResponseData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlAgentResponseData = typeof FirecrawlAgentResponseData.Type;
/**
 * Firecrawl Agent Status Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentStatusData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentStatusData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlAgentStatusData = typedUnknown<AgentStatusResponse>(
  "FirecrawlAgentStatusData",
  "Opaque Firecrawl agent status response returned by the SDK."
);
/**
 * Type for {@link FirecrawlAgentStatusData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlAgentStatusData } from "@beep/firecrawl"
 *
 * const value: FirecrawlAgentStatusData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlAgentStatusData = typeof FirecrawlAgentStatusData.Type;
/**
 * Firecrawl Browser Create Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserCreateData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserCreateData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBrowserCreateData = typedUnknown<BrowserCreateResponse>(
  "FirecrawlBrowserCreateData",
  "Opaque Firecrawl browser creation response returned by the SDK."
);
/**
 * Type for {@link FirecrawlBrowserCreateData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBrowserCreateData } from "@beep/firecrawl"
 *
 * const value: FirecrawlBrowserCreateData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBrowserCreateData = typeof FirecrawlBrowserCreateData.Type;
/**
 * Firecrawl Browser Execute Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserExecuteData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserExecuteData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBrowserExecuteData = typedUnknown<BrowserExecuteResponse>(
  "FirecrawlBrowserExecuteData",
  "Opaque Firecrawl browser execution response returned by the SDK."
);
/**
 * Type for {@link FirecrawlBrowserExecuteData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBrowserExecuteData } from "@beep/firecrawl"
 *
 * const value: FirecrawlBrowserExecuteData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBrowserExecuteData = typeof FirecrawlBrowserExecuteData.Type;
/**
 * Firecrawl Browser Delete Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserDeleteData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserDeleteData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBrowserDeleteData = typedUnknown<BrowserDeleteResponse>(
  "FirecrawlBrowserDeleteData",
  "Opaque Firecrawl browser deletion response returned by the SDK."
);
/**
 * Type for {@link FirecrawlBrowserDeleteData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBrowserDeleteData } from "@beep/firecrawl"
 *
 * const value: FirecrawlBrowserDeleteData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBrowserDeleteData = typeof FirecrawlBrowserDeleteData.Type;
/**
 * Firecrawl Browser List Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserListData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserListData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlBrowserListData = typedUnknown<BrowserListResponse>(
  "FirecrawlBrowserListData",
  "Opaque Firecrawl browser list response returned by the SDK."
);
/**
 * Type for {@link FirecrawlBrowserListData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlBrowserListData } from "@beep/firecrawl"
 *
 * const value: FirecrawlBrowserListData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlBrowserListData = typeof FirecrawlBrowserListData.Type;
/**
 * Firecrawl Concurrency Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlConcurrencyData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlConcurrencyData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlConcurrencyData = typedUnknown<ConcurrencyCheck>(
  "FirecrawlConcurrencyData",
  "Opaque Firecrawl concurrency response returned by the SDK."
);
/**
 * Type for {@link FirecrawlConcurrencyData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlConcurrencyData } from "@beep/firecrawl"
 *
 * const value: FirecrawlConcurrencyData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlConcurrencyData = typeof FirecrawlConcurrencyData.Type;
/**
 * Firecrawl Credit Usage Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCreditUsageData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCreditUsageData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCreditUsageData = typedUnknown<CreditUsage>(
  "FirecrawlCreditUsageData",
  "Opaque Firecrawl credit usage response returned by the SDK."
);
/**
 * Type for {@link FirecrawlCreditUsageData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCreditUsageData } from "@beep/firecrawl"
 *
 * const value: FirecrawlCreditUsageData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCreditUsageData = typeof FirecrawlCreditUsageData.Type;
/**
 * Firecrawl Token Usage Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlTokenUsageData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlTokenUsageData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlTokenUsageData = typedUnknown<TokenUsage>(
  "FirecrawlTokenUsageData",
  "Opaque Firecrawl token usage response returned by the SDK."
);
/**
 * Type for {@link FirecrawlTokenUsageData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlTokenUsageData } from "@beep/firecrawl"
 *
 * const value: FirecrawlTokenUsageData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlTokenUsageData = typeof FirecrawlTokenUsageData.Type;
/**
 * Firecrawl Credit Usage Historical Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlCreditUsageHistoricalData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCreditUsageHistoricalData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCreditUsageHistoricalData = typedUnknown<CreditUsageHistoricalResponse>(
  "FirecrawlCreditUsageHistoricalData",
  "Opaque Firecrawl historical credit usage response returned by the SDK."
);
/**
 * Type for {@link FirecrawlCreditUsageHistoricalData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlCreditUsageHistoricalData } from "@beep/firecrawl"
 *
 * const value: FirecrawlCreditUsageHistoricalData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCreditUsageHistoricalData = typeof FirecrawlCreditUsageHistoricalData.Type;
/**
 * Firecrawl Token Usage Historical Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlTokenUsageHistoricalData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlTokenUsageHistoricalData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlTokenUsageHistoricalData = typedUnknown<TokenUsageHistoricalResponse>(
  "FirecrawlTokenUsageHistoricalData",
  "Opaque Firecrawl historical token usage response returned by the SDK."
);
/**
 * Type for {@link FirecrawlTokenUsageHistoricalData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlTokenUsageHistoricalData } from "@beep/firecrawl"
 *
 * const value: FirecrawlTokenUsageHistoricalData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlTokenUsageHistoricalData = typeof FirecrawlTokenUsageHistoricalData.Type;
/**
 * Firecrawl Queue Status Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlQueueStatusData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlQueueStatusData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlQueueStatusData = typedUnknown<QueueStatusResponse>(
  "FirecrawlQueueStatusData",
  "Opaque Firecrawl queue status response returned by the SDK."
);
/**
 * Type for {@link FirecrawlQueueStatusData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlQueueStatusData } from "@beep/firecrawl"
 *
 * const value: FirecrawlQueueStatusData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlQueueStatusData = typeof FirecrawlQueueStatusData.Type;
/**
 * Firecrawl Interact Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlInteractData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlInteractData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlInteractData = typedUnknown<ScrapeExecuteResponse>(
  "FirecrawlInteractData",
  "Opaque Firecrawl interact response returned by the SDK."
);
/**
 * Type for {@link FirecrawlInteractData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlInteractData } from "@beep/firecrawl"
 *
 * const value: FirecrawlInteractData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlInteractData = typeof FirecrawlInteractData.Type;
/**
 * Firecrawl Stop Interaction Data opaque SDK response schema.
 *
 * @example
 * ```ts
 * import { FirecrawlStopInteractionData } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStopInteractionData)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlStopInteractionData = typedUnknown<ScrapeBrowserDeleteResponse>(
  "FirecrawlStopInteractionData",
  "Opaque Firecrawl stop interaction response returned by the SDK."
);
/**
 * Type for {@link FirecrawlStopInteractionData}.
 *
 * @example
 * ```ts
 * import type { FirecrawlStopInteractionData } from "@beep/firecrawl"
 *
 * const value: FirecrawlStopInteractionData | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlStopInteractionData = typeof FirecrawlStopInteractionData.Type;

const failureFields = {
  code: optionalString,
  details: optionalUnknown,
  error: S.String,
  status: optionalNumber,
  success: S.Literal(false),
};

/**
 * Firecrawl Scrape Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlScrapePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlScrapePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlScrapePayload extends S.Class<FirecrawlScrapePayload>($I`FirecrawlScrapePayload`)(
  {
    options: S.OptionFromOptionalKey(FirecrawlScrapeOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<ScrapeOptions>()))
    ),
    url: S.String,
  },
  $I.annote("FirecrawlScrapePayload", { description: "Payload decoded before calling Firecrawl scrape." })
) {}
/**
 * Firecrawl Scrape Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlScrapeSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlScrapeSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlScrapeSuccess extends S.Class<FirecrawlScrapeSuccess>($I`FirecrawlScrapeSuccess`)(
  { data: FirecrawlDocument },
  $I.annote("FirecrawlScrapeSuccess", { description: "Decoded success value returned by Firecrawl scrape." })
) {}
/**
 * Firecrawl Scrape Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlScrapeFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlScrapeFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlScrapeFailure extends S.Class<FirecrawlScrapeFailure>($I`FirecrawlScrapeFailure`)(
  failureFields,
  $I.annote("FirecrawlScrapeFailure", { description: "Decoded failure shape returned by Firecrawl scrape." })
) {}

/**
 * Firecrawl Interact Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlInteractPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlInteractPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlInteractPayload extends S.Class<FirecrawlInteractPayload>($I`FirecrawlInteractPayload`)(
  { args: FirecrawlInteractRequest, jobId: S.String },
  $I.annote("FirecrawlInteractPayload", { description: "Payload decoded before calling Firecrawl interact." })
) {}
/**
 * Firecrawl Interact Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlInteractSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlInteractSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlInteractSuccess extends S.Class<FirecrawlInteractSuccess>($I`FirecrawlInteractSuccess`)(
  { data: FirecrawlInteractData },
  $I.annote("FirecrawlInteractSuccess", { description: "Decoded success value returned by Firecrawl interact." })
) {}
/**
 * Firecrawl Interact Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlInteractFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlInteractFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlInteractFailure extends S.Class<FirecrawlInteractFailure>($I`FirecrawlInteractFailure`)(
  failureFields,
  $I.annote("FirecrawlInteractFailure", { description: "Decoded failure shape returned by Firecrawl interact." })
) {}

/**
 * Firecrawl Stop Interaction Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlStopInteractionPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStopInteractionPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStopInteractionPayload extends S.Class<FirecrawlStopInteractionPayload>(
  $I`FirecrawlStopInteractionPayload`
)(
  { jobId: S.String },
  $I.annote("FirecrawlStopInteractionPayload", {
    description: "Payload decoded before calling Firecrawl stopInteraction.",
  })
) {}
/**
 * Firecrawl Stop Interaction Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlStopInteractionSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStopInteractionSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStopInteractionSuccess extends S.Class<FirecrawlStopInteractionSuccess>(
  $I`FirecrawlStopInteractionSuccess`
)(
  { data: FirecrawlStopInteractionData },
  $I.annote("FirecrawlStopInteractionSuccess", {
    description: "Decoded success value returned by Firecrawl stopInteraction.",
  })
) {}
/**
 * Firecrawl Stop Interaction Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlStopInteractionFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStopInteractionFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStopInteractionFailure extends S.Class<FirecrawlStopInteractionFailure>(
  $I`FirecrawlStopInteractionFailure`
)(
  failureFields,
  $I.annote("FirecrawlStopInteractionFailure", {
    description: "Decoded failure shape returned by Firecrawl stopInteraction.",
  })
) {}

/**
 * Firecrawl Parse Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlParsePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlParsePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlParsePayload extends S.Class<FirecrawlParsePayload>($I`FirecrawlParsePayload`)(
  {
    file: FirecrawlParseFile,
    options: S.OptionFromOptionalKey(FirecrawlParseOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<ParseOptions>()))
    ),
  },
  $I.annote("FirecrawlParsePayload", { description: "Payload decoded before calling Firecrawl parse." })
) {}
/**
 * Firecrawl Parse Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlParseSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlParseSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlParseSuccess extends S.Class<FirecrawlParseSuccess>($I`FirecrawlParseSuccess`)(
  { data: FirecrawlDocument },
  $I.annote("FirecrawlParseSuccess", { description: "Decoded success value returned by Firecrawl parse." })
) {}
/**
 * Firecrawl Parse Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlParseFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlParseFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlParseFailure extends S.Class<FirecrawlParseFailure>($I`FirecrawlParseFailure`)(
  failureFields,
  $I.annote("FirecrawlParseFailure", { description: "Decoded failure shape returned by Firecrawl parse." })
) {}

/**
 * Firecrawl Search Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlSearchPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlSearchPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlSearchPayload extends S.Class<FirecrawlSearchPayload>($I`FirecrawlSearchPayload`)(
  {
    query: S.String,
    request: S.OptionFromOptionalKey(FirecrawlSearchOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<Omit<SearchRequest, "query">>()))
    ),
  },
  $I.annote("FirecrawlSearchPayload", { description: "Payload decoded before calling Firecrawl search." })
) {}
/**
 * Firecrawl Search Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlSearchSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlSearchSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlSearchSuccess extends S.Class<FirecrawlSearchSuccess>($I`FirecrawlSearchSuccess`)(
  { data: FirecrawlSearchData },
  $I.annote("FirecrawlSearchSuccess", { description: "Decoded success value returned by Firecrawl search." })
) {}
/**
 * Firecrawl Search Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlSearchFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlSearchFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlSearchFailure extends S.Class<FirecrawlSearchFailure>($I`FirecrawlSearchFailure`)(
  failureFields,
  $I.annote("FirecrawlSearchFailure", { description: "Decoded failure shape returned by Firecrawl search." })
) {}

/**
 * Firecrawl Map Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlMapPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMapPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlMapPayload extends S.Class<FirecrawlMapPayload>($I`FirecrawlMapPayload`)(
  {
    options: S.OptionFromOptionalKey(FirecrawlMapOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<MapOptions>()))
    ),
    url: S.String,
  },
  $I.annote("FirecrawlMapPayload", { description: "Payload decoded before calling Firecrawl map." })
) {}
/**
 * Firecrawl Map Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlMapSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMapSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlMapSuccess extends S.Class<FirecrawlMapSuccess>($I`FirecrawlMapSuccess`)(
  { data: FirecrawlMapData },
  $I.annote("FirecrawlMapSuccess", { description: "Decoded success value returned by Firecrawl map." })
) {}
/**
 * Firecrawl Map Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlMapFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMapFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlMapFailure extends S.Class<FirecrawlMapFailure>($I`FirecrawlMapFailure`)(
  failureFields,
  $I.annote("FirecrawlMapFailure", { description: "Decoded failure shape returned by Firecrawl map." })
) {}

/**
 * Firecrawl Start Crawl Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlStartCrawlPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartCrawlPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartCrawlPayload extends S.Class<FirecrawlStartCrawlPayload>($I`FirecrawlStartCrawlPayload`)(
  {
    request: S.OptionFromOptionalKey(FirecrawlCrawlOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<CrawlOptions>()))
    ),
    url: S.String,
  },
  $I.annote("FirecrawlStartCrawlPayload", { description: "Payload decoded before calling Firecrawl startCrawl." })
) {}
/**
 * Firecrawl Start Crawl Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlStartCrawlSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartCrawlSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartCrawlSuccess extends S.Class<FirecrawlStartCrawlSuccess>($I`FirecrawlStartCrawlSuccess`)(
  { data: FirecrawlCrawlResponseData },
  $I.annote("FirecrawlStartCrawlSuccess", { description: "Decoded success value returned by Firecrawl startCrawl." })
) {}
/**
 * Firecrawl Start Crawl Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlStartCrawlFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartCrawlFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartCrawlFailure extends S.Class<FirecrawlStartCrawlFailure>($I`FirecrawlStartCrawlFailure`)(
  failureFields,
  $I.annote("FirecrawlStartCrawlFailure", { description: "Decoded failure shape returned by Firecrawl startCrawl." })
) {}

/**
 * Firecrawl Get Crawl Status Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCrawlStatusPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCrawlStatusPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCrawlStatusPayload extends S.Class<FirecrawlGetCrawlStatusPayload>(
  $I`FirecrawlGetCrawlStatusPayload`
)(
  {
    jobId: S.String,
    pagination: S.OptionFromOptionalKey(FirecrawlPaginationConfig).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PaginationConfig>()))
    ),
  },
  $I.annote("FirecrawlGetCrawlStatusPayload", {
    description: "Payload decoded before calling Firecrawl getCrawlStatus.",
  })
) {}
/**
 * Firecrawl Get Crawl Status Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCrawlStatusSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCrawlStatusSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCrawlStatusSuccess extends S.Class<FirecrawlGetCrawlStatusSuccess>(
  $I`FirecrawlGetCrawlStatusSuccess`
)(
  { data: FirecrawlCrawlJobData },
  $I.annote("FirecrawlGetCrawlStatusSuccess", {
    description: "Decoded success value returned by Firecrawl getCrawlStatus.",
  })
) {}
/**
 * Firecrawl Get Crawl Status Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCrawlStatusFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCrawlStatusFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCrawlStatusFailure extends S.Class<FirecrawlGetCrawlStatusFailure>(
  $I`FirecrawlGetCrawlStatusFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetCrawlStatusFailure", {
    description: "Decoded failure shape returned by Firecrawl getCrawlStatus.",
  })
) {}

/**
 * Firecrawl Cancel Crawl Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelCrawlPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelCrawlPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelCrawlPayload extends S.Class<FirecrawlCancelCrawlPayload>($I`FirecrawlCancelCrawlPayload`)(
  { jobId: S.String },
  $I.annote("FirecrawlCancelCrawlPayload", { description: "Payload decoded before calling Firecrawl cancelCrawl." })
) {}
/**
 * Firecrawl Cancel Crawl Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelCrawlSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelCrawlSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelCrawlSuccess extends S.Class<FirecrawlCancelCrawlSuccess>($I`FirecrawlCancelCrawlSuccess`)(
  { cancelled: S.Boolean },
  $I.annote("FirecrawlCancelCrawlSuccess", { description: "Decoded success value returned by Firecrawl cancelCrawl." })
) {}
/**
 * Firecrawl Cancel Crawl Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelCrawlFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelCrawlFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelCrawlFailure extends S.Class<FirecrawlCancelCrawlFailure>($I`FirecrawlCancelCrawlFailure`)(
  failureFields,
  $I.annote("FirecrawlCancelCrawlFailure", { description: "Decoded failure shape returned by Firecrawl cancelCrawl." })
) {}

/**
 * Firecrawl Crawl Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCrawlPayload extends S.Class<FirecrawlCrawlPayload>($I`FirecrawlCrawlPayload`)(
  {
    request: S.OptionFromOptionalKey(FirecrawlCrawlWaitOptions).pipe(
      S.withConstructorDefault(
        Effect.succeed(O.none<CrawlOptions & { readonly pollInterval?: number; readonly timeout?: number }>())
      )
    ),
    url: S.String,
  },
  $I.annote("FirecrawlCrawlPayload", { description: "Payload decoded before calling Firecrawl crawl." })
) {}
/**
 * Firecrawl Crawl Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCrawlSuccess extends S.Class<FirecrawlCrawlSuccess>($I`FirecrawlCrawlSuccess`)(
  { data: FirecrawlCrawlJobData },
  $I.annote("FirecrawlCrawlSuccess", { description: "Decoded success value returned by Firecrawl crawl." })
) {}
/**
 * Firecrawl Crawl Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCrawlFailure extends S.Class<FirecrawlCrawlFailure>($I`FirecrawlCrawlFailure`)(
  failureFields,
  $I.annote("FirecrawlCrawlFailure", { description: "Decoded failure shape returned by Firecrawl crawl." })
) {}

/**
 * Firecrawl Get Crawl Errors Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCrawlErrorsPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCrawlErrorsPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCrawlErrorsPayload extends S.Class<FirecrawlGetCrawlErrorsPayload>(
  $I`FirecrawlGetCrawlErrorsPayload`
)(
  { crawlId: S.String },
  $I.annote("FirecrawlGetCrawlErrorsPayload", {
    description: "Payload decoded before calling Firecrawl getCrawlErrors.",
  })
) {}
/**
 * Firecrawl Get Crawl Errors Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCrawlErrorsSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCrawlErrorsSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCrawlErrorsSuccess extends S.Class<FirecrawlGetCrawlErrorsSuccess>(
  $I`FirecrawlGetCrawlErrorsSuccess`
)(
  { data: FirecrawlCrawlErrorsData },
  $I.annote("FirecrawlGetCrawlErrorsSuccess", {
    description: "Decoded success value returned by Firecrawl getCrawlErrors.",
  })
) {}
/**
 * Firecrawl Get Crawl Errors Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCrawlErrorsFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCrawlErrorsFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCrawlErrorsFailure extends S.Class<FirecrawlGetCrawlErrorsFailure>(
  $I`FirecrawlGetCrawlErrorsFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetCrawlErrorsFailure", {
    description: "Decoded failure shape returned by Firecrawl getCrawlErrors.",
  })
) {}

/**
 * Firecrawl Get Active Crawls Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetActiveCrawlsPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetActiveCrawlsPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetActiveCrawlsPayload extends S.Class<FirecrawlGetActiveCrawlsPayload>(
  $I`FirecrawlGetActiveCrawlsPayload`
)(
  {},
  $I.annote("FirecrawlGetActiveCrawlsPayload", {
    description: "Payload decoded before calling Firecrawl getActiveCrawls.",
  })
) {}
/**
 * Firecrawl Get Active Crawls Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetActiveCrawlsSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetActiveCrawlsSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetActiveCrawlsSuccess extends S.Class<FirecrawlGetActiveCrawlsSuccess>(
  $I`FirecrawlGetActiveCrawlsSuccess`
)(
  { data: FirecrawlActiveCrawlsData },
  $I.annote("FirecrawlGetActiveCrawlsSuccess", {
    description: "Decoded success value returned by Firecrawl getActiveCrawls.",
  })
) {}
/**
 * Firecrawl Get Active Crawls Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetActiveCrawlsFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetActiveCrawlsFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetActiveCrawlsFailure extends S.Class<FirecrawlGetActiveCrawlsFailure>(
  $I`FirecrawlGetActiveCrawlsFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetActiveCrawlsFailure", {
    description: "Decoded failure shape returned by Firecrawl getActiveCrawls.",
  })
) {}

/**
 * Firecrawl Crawl Params Preview Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlParamsPreviewPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlParamsPreviewPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCrawlParamsPreviewPayload extends S.Class<FirecrawlCrawlParamsPreviewPayload>(
  $I`FirecrawlCrawlParamsPreviewPayload`
)(
  { prompt: S.String, url: S.String },
  $I.annote("FirecrawlCrawlParamsPreviewPayload", {
    description: "Payload decoded before calling Firecrawl crawlParamsPreview.",
  })
) {}
/**
 * Firecrawl Crawl Params Preview Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlParamsPreviewSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlParamsPreviewSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCrawlParamsPreviewSuccess extends S.Class<FirecrawlCrawlParamsPreviewSuccess>(
  $I`FirecrawlCrawlParamsPreviewSuccess`
)(
  { data: S.Record(S.String, S.Unknown) },
  $I.annote("FirecrawlCrawlParamsPreviewSuccess", {
    description: "Decoded success value returned by Firecrawl crawlParamsPreview.",
  })
) {}
/**
 * Firecrawl Crawl Params Preview Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlCrawlParamsPreviewFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCrawlParamsPreviewFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCrawlParamsPreviewFailure extends S.Class<FirecrawlCrawlParamsPreviewFailure>(
  $I`FirecrawlCrawlParamsPreviewFailure`
)(
  failureFields,
  $I.annote("FirecrawlCrawlParamsPreviewFailure", {
    description: "Decoded failure shape returned by Firecrawl crawlParamsPreview.",
  })
) {}

/**
 * Firecrawl Create Monitor Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlCreateMonitorPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCreateMonitorPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCreateMonitorPayload extends S.Class<FirecrawlCreateMonitorPayload>(
  $I`FirecrawlCreateMonitorPayload`
)(
  { request: FirecrawlCreateMonitorRequest },
  $I.annote("FirecrawlCreateMonitorPayload", { description: "Payload decoded before calling Firecrawl createMonitor." })
) {}
/**
 * Firecrawl Create Monitor Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlCreateMonitorSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCreateMonitorSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCreateMonitorSuccess extends S.Class<FirecrawlCreateMonitorSuccess>(
  $I`FirecrawlCreateMonitorSuccess`
)(
  { data: FirecrawlMonitorData },
  $I.annote("FirecrawlCreateMonitorSuccess", {
    description: "Decoded success value returned by Firecrawl createMonitor.",
  })
) {}
/**
 * Firecrawl Create Monitor Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlCreateMonitorFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCreateMonitorFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCreateMonitorFailure extends S.Class<FirecrawlCreateMonitorFailure>(
  $I`FirecrawlCreateMonitorFailure`
)(
  failureFields,
  $I.annote("FirecrawlCreateMonitorFailure", {
    description: "Decoded failure shape returned by Firecrawl createMonitor.",
  })
) {}

/**
 * Firecrawl List Monitors Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorsPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorsPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListMonitorsPayload extends S.Class<FirecrawlListMonitorsPayload>(
  $I`FirecrawlListMonitorsPayload`
)(
  {
    options: S.OptionFromOptionalKey(FirecrawlListMonitorsOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<ListMonitorsOptions>()))
    ),
  },
  $I.annote("FirecrawlListMonitorsPayload", { description: "Payload decoded before calling Firecrawl listMonitors." })
) {}
/**
 * Firecrawl List Monitors Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorsSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorsSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListMonitorsSuccess extends S.Class<FirecrawlListMonitorsSuccess>(
  $I`FirecrawlListMonitorsSuccess`
)(
  { data: FirecrawlMonitorListData },
  $I.annote("FirecrawlListMonitorsSuccess", {
    description: "Decoded success value returned by Firecrawl listMonitors.",
  })
) {}
/**
 * Firecrawl List Monitors Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorsFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorsFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListMonitorsFailure extends S.Class<FirecrawlListMonitorsFailure>(
  $I`FirecrawlListMonitorsFailure`
)(
  failureFields,
  $I.annote("FirecrawlListMonitorsFailure", {
    description: "Decoded failure shape returned by Firecrawl listMonitors.",
  })
) {}

/**
 * Firecrawl Get Monitor Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetMonitorPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetMonitorPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetMonitorPayload extends S.Class<FirecrawlGetMonitorPayload>($I`FirecrawlGetMonitorPayload`)(
  { monitorId: S.String },
  $I.annote("FirecrawlGetMonitorPayload", { description: "Payload decoded before calling Firecrawl getMonitor." })
) {}
/**
 * Firecrawl Get Monitor Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetMonitorSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetMonitorSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetMonitorSuccess extends S.Class<FirecrawlGetMonitorSuccess>($I`FirecrawlGetMonitorSuccess`)(
  { data: FirecrawlMonitorData },
  $I.annote("FirecrawlGetMonitorSuccess", { description: "Decoded success value returned by Firecrawl getMonitor." })
) {}
/**
 * Firecrawl Get Monitor Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetMonitorFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetMonitorFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetMonitorFailure extends S.Class<FirecrawlGetMonitorFailure>($I`FirecrawlGetMonitorFailure`)(
  failureFields,
  $I.annote("FirecrawlGetMonitorFailure", { description: "Decoded failure shape returned by Firecrawl getMonitor." })
) {}

/**
 * Firecrawl Update Monitor Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlUpdateMonitorPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlUpdateMonitorPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlUpdateMonitorPayload extends S.Class<FirecrawlUpdateMonitorPayload>(
  $I`FirecrawlUpdateMonitorPayload`
)(
  { monitorId: S.String, request: FirecrawlUpdateMonitorRequest },
  $I.annote("FirecrawlUpdateMonitorPayload", { description: "Payload decoded before calling Firecrawl updateMonitor." })
) {}
/**
 * Firecrawl Update Monitor Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlUpdateMonitorSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlUpdateMonitorSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlUpdateMonitorSuccess extends S.Class<FirecrawlUpdateMonitorSuccess>(
  $I`FirecrawlUpdateMonitorSuccess`
)(
  { data: FirecrawlMonitorData },
  $I.annote("FirecrawlUpdateMonitorSuccess", {
    description: "Decoded success value returned by Firecrawl updateMonitor.",
  })
) {}
/**
 * Firecrawl Update Monitor Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlUpdateMonitorFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlUpdateMonitorFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlUpdateMonitorFailure extends S.Class<FirecrawlUpdateMonitorFailure>(
  $I`FirecrawlUpdateMonitorFailure`
)(
  failureFields,
  $I.annote("FirecrawlUpdateMonitorFailure", {
    description: "Decoded failure shape returned by Firecrawl updateMonitor.",
  })
) {}

/**
 * Firecrawl Delete Monitor Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlDeleteMonitorPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlDeleteMonitorPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlDeleteMonitorPayload extends S.Class<FirecrawlDeleteMonitorPayload>(
  $I`FirecrawlDeleteMonitorPayload`
)(
  { monitorId: S.String },
  $I.annote("FirecrawlDeleteMonitorPayload", { description: "Payload decoded before calling Firecrawl deleteMonitor." })
) {}
/**
 * Firecrawl Delete Monitor Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlDeleteMonitorSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlDeleteMonitorSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlDeleteMonitorSuccess extends S.Class<FirecrawlDeleteMonitorSuccess>(
  $I`FirecrawlDeleteMonitorSuccess`
)(
  { deleted: S.Boolean },
  $I.annote("FirecrawlDeleteMonitorSuccess", {
    description: "Decoded success value returned by Firecrawl deleteMonitor.",
  })
) {}
/**
 * Firecrawl Delete Monitor Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlDeleteMonitorFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlDeleteMonitorFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlDeleteMonitorFailure extends S.Class<FirecrawlDeleteMonitorFailure>(
  $I`FirecrawlDeleteMonitorFailure`
)(
  failureFields,
  $I.annote("FirecrawlDeleteMonitorFailure", {
    description: "Decoded failure shape returned by Firecrawl deleteMonitor.",
  })
) {}

/**
 * Firecrawl Run Monitor Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlRunMonitorPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlRunMonitorPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlRunMonitorPayload extends S.Class<FirecrawlRunMonitorPayload>($I`FirecrawlRunMonitorPayload`)(
  { monitorId: S.String },
  $I.annote("FirecrawlRunMonitorPayload", { description: "Payload decoded before calling Firecrawl runMonitor." })
) {}
/**
 * Firecrawl Run Monitor Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlRunMonitorSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlRunMonitorSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlRunMonitorSuccess extends S.Class<FirecrawlRunMonitorSuccess>($I`FirecrawlRunMonitorSuccess`)(
  { data: FirecrawlMonitorCheckData },
  $I.annote("FirecrawlRunMonitorSuccess", { description: "Decoded success value returned by Firecrawl runMonitor." })
) {}
/**
 * Firecrawl Run Monitor Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlRunMonitorFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlRunMonitorFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlRunMonitorFailure extends S.Class<FirecrawlRunMonitorFailure>($I`FirecrawlRunMonitorFailure`)(
  failureFields,
  $I.annote("FirecrawlRunMonitorFailure", { description: "Decoded failure shape returned by Firecrawl runMonitor." })
) {}

/**
 * Firecrawl List Monitor Checks Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorChecksPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorChecksPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListMonitorChecksPayload extends S.Class<FirecrawlListMonitorChecksPayload>(
  $I`FirecrawlListMonitorChecksPayload`
)(
  {
    monitorId: S.String,
    options: S.OptionFromOptionalKey(FirecrawlListMonitorChecksOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<ListMonitorChecksOptions>()))
    ),
  },
  $I.annote("FirecrawlListMonitorChecksPayload", {
    description: "Payload decoded before calling Firecrawl listMonitorChecks.",
  })
) {}
/**
 * Firecrawl List Monitor Checks Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorChecksSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorChecksSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListMonitorChecksSuccess extends S.Class<FirecrawlListMonitorChecksSuccess>(
  $I`FirecrawlListMonitorChecksSuccess`
)(
  { data: FirecrawlMonitorCheckListData },
  $I.annote("FirecrawlListMonitorChecksSuccess", {
    description: "Decoded success value returned by Firecrawl listMonitorChecks.",
  })
) {}
/**
 * Firecrawl List Monitor Checks Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlListMonitorChecksFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListMonitorChecksFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListMonitorChecksFailure extends S.Class<FirecrawlListMonitorChecksFailure>(
  $I`FirecrawlListMonitorChecksFailure`
)(
  failureFields,
  $I.annote("FirecrawlListMonitorChecksFailure", {
    description: "Decoded failure shape returned by Firecrawl listMonitorChecks.",
  })
) {}

/**
 * Firecrawl Get Monitor Check Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetMonitorCheckPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetMonitorCheckPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetMonitorCheckPayload extends S.Class<FirecrawlGetMonitorCheckPayload>(
  $I`FirecrawlGetMonitorCheckPayload`
)(
  {
    checkId: S.String,
    monitorId: S.String,
    options: S.OptionFromOptionalKey(FirecrawlGetMonitorCheckOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<GetMonitorCheckOptions>()))
    ),
  },
  $I.annote("FirecrawlGetMonitorCheckPayload", {
    description: "Payload decoded before calling Firecrawl getMonitorCheck.",
  })
) {}
/**
 * Firecrawl Get Monitor Check Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetMonitorCheckSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetMonitorCheckSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetMonitorCheckSuccess extends S.Class<FirecrawlGetMonitorCheckSuccess>(
  $I`FirecrawlGetMonitorCheckSuccess`
)(
  { data: FirecrawlMonitorCheckDetailData },
  $I.annote("FirecrawlGetMonitorCheckSuccess", {
    description: "Decoded success value returned by Firecrawl getMonitorCheck.",
  })
) {}
/**
 * Firecrawl Get Monitor Check Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetMonitorCheckFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetMonitorCheckFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetMonitorCheckFailure extends S.Class<FirecrawlGetMonitorCheckFailure>(
  $I`FirecrawlGetMonitorCheckFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetMonitorCheckFailure", {
    description: "Decoded failure shape returned by Firecrawl getMonitorCheck.",
  })
) {}

/**
 * Firecrawl Start Batch Scrape Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlStartBatchScrapePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartBatchScrapePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartBatchScrapePayload extends S.Class<FirecrawlStartBatchScrapePayload>(
  $I`FirecrawlStartBatchScrapePayload`
)(
  {
    options: S.OptionFromOptionalKey(FirecrawlBatchScrapeOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<BatchScrapeOptions>()))
    ),
    urls: S.Array(S.String),
  },
  $I.annote("FirecrawlStartBatchScrapePayload", {
    description: "Payload decoded before calling Firecrawl startBatchScrape.",
  })
) {}
/**
 * Firecrawl Start Batch Scrape Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlStartBatchScrapeSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartBatchScrapeSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartBatchScrapeSuccess extends S.Class<FirecrawlStartBatchScrapeSuccess>(
  $I`FirecrawlStartBatchScrapeSuccess`
)(
  { data: FirecrawlBatchScrapeResponseData },
  $I.annote("FirecrawlStartBatchScrapeSuccess", {
    description: "Decoded success value returned by Firecrawl startBatchScrape.",
  })
) {}
/**
 * Firecrawl Start Batch Scrape Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlStartBatchScrapeFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartBatchScrapeFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartBatchScrapeFailure extends S.Class<FirecrawlStartBatchScrapeFailure>(
  $I`FirecrawlStartBatchScrapeFailure`
)(
  failureFields,
  $I.annote("FirecrawlStartBatchScrapeFailure", {
    description: "Decoded failure shape returned by Firecrawl startBatchScrape.",
  })
) {}

/**
 * Firecrawl Get Batch Scrape Status Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetBatchScrapeStatusPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetBatchScrapeStatusPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetBatchScrapeStatusPayload extends S.Class<FirecrawlGetBatchScrapeStatusPayload>(
  $I`FirecrawlGetBatchScrapeStatusPayload`
)(
  {
    jobId: S.String,
    pagination: S.OptionFromOptionalKey(FirecrawlPaginationConfig).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PaginationConfig>()))
    ),
  },
  $I.annote("FirecrawlGetBatchScrapeStatusPayload", {
    description: "Payload decoded before calling Firecrawl getBatchScrapeStatus.",
  })
) {}
/**
 * Firecrawl Get Batch Scrape Status Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetBatchScrapeStatusSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetBatchScrapeStatusSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetBatchScrapeStatusSuccess extends S.Class<FirecrawlGetBatchScrapeStatusSuccess>(
  $I`FirecrawlGetBatchScrapeStatusSuccess`
)(
  { data: FirecrawlBatchScrapeJobData },
  $I.annote("FirecrawlGetBatchScrapeStatusSuccess", {
    description: "Decoded success value returned by Firecrawl getBatchScrapeStatus.",
  })
) {}
/**
 * Firecrawl Get Batch Scrape Status Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetBatchScrapeStatusFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetBatchScrapeStatusFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetBatchScrapeStatusFailure extends S.Class<FirecrawlGetBatchScrapeStatusFailure>(
  $I`FirecrawlGetBatchScrapeStatusFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetBatchScrapeStatusFailure", {
    description: "Decoded failure shape returned by Firecrawl getBatchScrapeStatus.",
  })
) {}

/**
 * Firecrawl Get Batch Scrape Errors Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetBatchScrapeErrorsPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetBatchScrapeErrorsPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetBatchScrapeErrorsPayload extends S.Class<FirecrawlGetBatchScrapeErrorsPayload>(
  $I`FirecrawlGetBatchScrapeErrorsPayload`
)(
  { jobId: S.String },
  $I.annote("FirecrawlGetBatchScrapeErrorsPayload", {
    description: "Payload decoded before calling Firecrawl getBatchScrapeErrors.",
  })
) {}
/**
 * Firecrawl Get Batch Scrape Errors Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetBatchScrapeErrorsSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetBatchScrapeErrorsSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetBatchScrapeErrorsSuccess extends S.Class<FirecrawlGetBatchScrapeErrorsSuccess>(
  $I`FirecrawlGetBatchScrapeErrorsSuccess`
)(
  { data: FirecrawlCrawlErrorsData },
  $I.annote("FirecrawlGetBatchScrapeErrorsSuccess", {
    description: "Decoded success value returned by Firecrawl getBatchScrapeErrors.",
  })
) {}
/**
 * Firecrawl Get Batch Scrape Errors Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetBatchScrapeErrorsFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetBatchScrapeErrorsFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetBatchScrapeErrorsFailure extends S.Class<FirecrawlGetBatchScrapeErrorsFailure>(
  $I`FirecrawlGetBatchScrapeErrorsFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetBatchScrapeErrorsFailure", {
    description: "Decoded failure shape returned by Firecrawl getBatchScrapeErrors.",
  })
) {}

/**
 * Firecrawl Cancel Batch Scrape Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelBatchScrapePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelBatchScrapePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelBatchScrapePayload extends S.Class<FirecrawlCancelBatchScrapePayload>(
  $I`FirecrawlCancelBatchScrapePayload`
)(
  { jobId: S.String },
  $I.annote("FirecrawlCancelBatchScrapePayload", {
    description: "Payload decoded before calling Firecrawl cancelBatchScrape.",
  })
) {}
/**
 * Firecrawl Cancel Batch Scrape Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelBatchScrapeSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelBatchScrapeSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelBatchScrapeSuccess extends S.Class<FirecrawlCancelBatchScrapeSuccess>(
  $I`FirecrawlCancelBatchScrapeSuccess`
)(
  { cancelled: S.Boolean },
  $I.annote("FirecrawlCancelBatchScrapeSuccess", {
    description: "Decoded success value returned by Firecrawl cancelBatchScrape.",
  })
) {}
/**
 * Firecrawl Cancel Batch Scrape Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelBatchScrapeFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelBatchScrapeFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelBatchScrapeFailure extends S.Class<FirecrawlCancelBatchScrapeFailure>(
  $I`FirecrawlCancelBatchScrapeFailure`
)(
  failureFields,
  $I.annote("FirecrawlCancelBatchScrapeFailure", {
    description: "Decoded failure shape returned by Firecrawl cancelBatchScrape.",
  })
) {}

/**
 * Firecrawl Batch Scrape Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlBatchScrapePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBatchScrapePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBatchScrapePayload extends S.Class<FirecrawlBatchScrapePayload>($I`FirecrawlBatchScrapePayload`)(
  {
    options: S.OptionFromOptionalKey(FirecrawlBatchScrapeWaitOptions).pipe(
      S.withConstructorDefault(
        Effect.succeed(O.none<BatchScrapeOptions & { readonly pollInterval?: number; readonly timeout?: number }>())
      )
    ),
    urls: S.Array(S.String),
  },
  $I.annote("FirecrawlBatchScrapePayload", { description: "Payload decoded before calling Firecrawl batchScrape." })
) {}
/**
 * Firecrawl Batch Scrape Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlBatchScrapeSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBatchScrapeSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBatchScrapeSuccess extends S.Class<FirecrawlBatchScrapeSuccess>($I`FirecrawlBatchScrapeSuccess`)(
  { data: FirecrawlBatchScrapeJobData },
  $I.annote("FirecrawlBatchScrapeSuccess", { description: "Decoded success value returned by Firecrawl batchScrape." })
) {}
/**
 * Firecrawl Batch Scrape Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlBatchScrapeFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBatchScrapeFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBatchScrapeFailure extends S.Class<FirecrawlBatchScrapeFailure>($I`FirecrawlBatchScrapeFailure`)(
  failureFields,
  $I.annote("FirecrawlBatchScrapeFailure", { description: "Decoded failure shape returned by Firecrawl batchScrape." })
) {}

/**
 * Firecrawl Start Agent Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlStartAgentPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartAgentPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartAgentPayload extends S.Class<FirecrawlStartAgentPayload>($I`FirecrawlStartAgentPayload`)(
  { request: FirecrawlAgentRequest },
  $I.annote("FirecrawlStartAgentPayload", { description: "Payload decoded before calling Firecrawl startAgent." })
) {}
/**
 * Firecrawl Start Agent Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlStartAgentSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartAgentSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartAgentSuccess extends S.Class<FirecrawlStartAgentSuccess>($I`FirecrawlStartAgentSuccess`)(
  { data: FirecrawlAgentResponseData },
  $I.annote("FirecrawlStartAgentSuccess", { description: "Decoded success value returned by Firecrawl startAgent." })
) {}
/**
 * Firecrawl Start Agent Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlStartAgentFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlStartAgentFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlStartAgentFailure extends S.Class<FirecrawlStartAgentFailure>($I`FirecrawlStartAgentFailure`)(
  failureFields,
  $I.annote("FirecrawlStartAgentFailure", { description: "Decoded failure shape returned by Firecrawl startAgent." })
) {}

/**
 * Firecrawl Get Agent Status Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetAgentStatusPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetAgentStatusPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetAgentStatusPayload extends S.Class<FirecrawlGetAgentStatusPayload>(
  $I`FirecrawlGetAgentStatusPayload`
)(
  { jobId: S.String },
  $I.annote("FirecrawlGetAgentStatusPayload", {
    description: "Payload decoded before calling Firecrawl getAgentStatus.",
  })
) {}
/**
 * Firecrawl Get Agent Status Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetAgentStatusSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetAgentStatusSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetAgentStatusSuccess extends S.Class<FirecrawlGetAgentStatusSuccess>(
  $I`FirecrawlGetAgentStatusSuccess`
)(
  { data: FirecrawlAgentStatusData },
  $I.annote("FirecrawlGetAgentStatusSuccess", {
    description: "Decoded success value returned by Firecrawl getAgentStatus.",
  })
) {}
/**
 * Firecrawl Get Agent Status Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetAgentStatusFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetAgentStatusFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetAgentStatusFailure extends S.Class<FirecrawlGetAgentStatusFailure>(
  $I`FirecrawlGetAgentStatusFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetAgentStatusFailure", {
    description: "Decoded failure shape returned by Firecrawl getAgentStatus.",
  })
) {}

/**
 * Firecrawl Agent Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlAgentPayload extends S.Class<FirecrawlAgentPayload>($I`FirecrawlAgentPayload`)(
  { request: FirecrawlAgentWaitRequest },
  $I.annote("FirecrawlAgentPayload", { description: "Payload decoded before calling Firecrawl agent." })
) {}
/**
 * Firecrawl Agent Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlAgentSuccess extends S.Class<FirecrawlAgentSuccess>($I`FirecrawlAgentSuccess`)(
  { data: FirecrawlAgentStatusData },
  $I.annote("FirecrawlAgentSuccess", { description: "Decoded success value returned by Firecrawl agent." })
) {}
/**
 * Firecrawl Agent Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlAgentFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlAgentFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlAgentFailure extends S.Class<FirecrawlAgentFailure>($I`FirecrawlAgentFailure`)(
  failureFields,
  $I.annote("FirecrawlAgentFailure", { description: "Decoded failure shape returned by Firecrawl agent." })
) {}

/**
 * Firecrawl Cancel Agent Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelAgentPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelAgentPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelAgentPayload extends S.Class<FirecrawlCancelAgentPayload>($I`FirecrawlCancelAgentPayload`)(
  { jobId: S.String },
  $I.annote("FirecrawlCancelAgentPayload", { description: "Payload decoded before calling Firecrawl cancelAgent." })
) {}
/**
 * Firecrawl Cancel Agent Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelAgentSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelAgentSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelAgentSuccess extends S.Class<FirecrawlCancelAgentSuccess>($I`FirecrawlCancelAgentSuccess`)(
  { cancelled: S.Boolean },
  $I.annote("FirecrawlCancelAgentSuccess", { description: "Decoded success value returned by Firecrawl cancelAgent." })
) {}
/**
 * Firecrawl Cancel Agent Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlCancelAgentFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCancelAgentFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlCancelAgentFailure extends S.Class<FirecrawlCancelAgentFailure>($I`FirecrawlCancelAgentFailure`)(
  failureFields,
  $I.annote("FirecrawlCancelAgentFailure", { description: "Decoded failure shape returned by Firecrawl cancelAgent." })
) {}

/**
 * Firecrawl Browser Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBrowserPayload extends S.Class<FirecrawlBrowserPayload>($I`FirecrawlBrowserPayload`)(
  {
    options: S.OptionFromOptionalKey(FirecrawlBrowserOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<FirecrawlBrowserOptions>()))
    ),
  },
  $I.annote("FirecrawlBrowserPayload", { description: "Payload decoded before calling Firecrawl browser." })
) {}
/**
 * Firecrawl Browser Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBrowserSuccess extends S.Class<FirecrawlBrowserSuccess>($I`FirecrawlBrowserSuccess`)(
  { data: FirecrawlBrowserCreateData },
  $I.annote("FirecrawlBrowserSuccess", { description: "Decoded success value returned by Firecrawl browser." })
) {}
/**
 * Firecrawl Browser Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBrowserFailure extends S.Class<FirecrawlBrowserFailure>($I`FirecrawlBrowserFailure`)(
  failureFields,
  $I.annote("FirecrawlBrowserFailure", { description: "Decoded failure shape returned by Firecrawl browser." })
) {}

/**
 * Firecrawl Browser Execute Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserExecutePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserExecutePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBrowserExecutePayload extends S.Class<FirecrawlBrowserExecutePayload>(
  $I`FirecrawlBrowserExecutePayload`
)(
  { request: FirecrawlBrowserExecuteRequest, sessionId: S.String },
  $I.annote("FirecrawlBrowserExecutePayload", {
    description: "Payload decoded before calling Firecrawl browserExecute.",
  })
) {}
/**
 * Firecrawl Browser Execute Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserExecuteSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserExecuteSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBrowserExecuteSuccess extends S.Class<FirecrawlBrowserExecuteSuccess>(
  $I`FirecrawlBrowserExecuteSuccess`
)(
  { data: FirecrawlBrowserExecuteData },
  $I.annote("FirecrawlBrowserExecuteSuccess", {
    description: "Decoded success value returned by Firecrawl browserExecute.",
  })
) {}
/**
 * Firecrawl Browser Execute Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlBrowserExecuteFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlBrowserExecuteFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlBrowserExecuteFailure extends S.Class<FirecrawlBrowserExecuteFailure>(
  $I`FirecrawlBrowserExecuteFailure`
)(
  failureFields,
  $I.annote("FirecrawlBrowserExecuteFailure", {
    description: "Decoded failure shape returned by Firecrawl browserExecute.",
  })
) {}

/**
 * Firecrawl Delete Browser Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlDeleteBrowserPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlDeleteBrowserPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlDeleteBrowserPayload extends S.Class<FirecrawlDeleteBrowserPayload>(
  $I`FirecrawlDeleteBrowserPayload`
)(
  { sessionId: S.String },
  $I.annote("FirecrawlDeleteBrowserPayload", { description: "Payload decoded before calling Firecrawl deleteBrowser." })
) {}
/**
 * Firecrawl Delete Browser Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlDeleteBrowserSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlDeleteBrowserSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlDeleteBrowserSuccess extends S.Class<FirecrawlDeleteBrowserSuccess>(
  $I`FirecrawlDeleteBrowserSuccess`
)(
  { data: FirecrawlBrowserDeleteData },
  $I.annote("FirecrawlDeleteBrowserSuccess", {
    description: "Decoded success value returned by Firecrawl deleteBrowser.",
  })
) {}
/**
 * Firecrawl Delete Browser Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlDeleteBrowserFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlDeleteBrowserFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlDeleteBrowserFailure extends S.Class<FirecrawlDeleteBrowserFailure>(
  $I`FirecrawlDeleteBrowserFailure`
)(
  failureFields,
  $I.annote("FirecrawlDeleteBrowserFailure", {
    description: "Decoded failure shape returned by Firecrawl deleteBrowser.",
  })
) {}

/**
 * Firecrawl List Browsers Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlListBrowsersPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListBrowsersPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListBrowsersPayload extends S.Class<FirecrawlListBrowsersPayload>(
  $I`FirecrawlListBrowsersPayload`
)(
  {
    options: S.OptionFromOptionalKey(FirecrawlListBrowsersOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<FirecrawlListBrowsersOptions>()))
    ),
  },
  $I.annote("FirecrawlListBrowsersPayload", { description: "Payload decoded before calling Firecrawl listBrowsers." })
) {}
/**
 * Firecrawl List Browsers Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlListBrowsersSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListBrowsersSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListBrowsersSuccess extends S.Class<FirecrawlListBrowsersSuccess>(
  $I`FirecrawlListBrowsersSuccess`
)(
  { data: FirecrawlBrowserListData },
  $I.annote("FirecrawlListBrowsersSuccess", {
    description: "Decoded success value returned by Firecrawl listBrowsers.",
  })
) {}
/**
 * Firecrawl List Browsers Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlListBrowsersFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlListBrowsersFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlListBrowsersFailure extends S.Class<FirecrawlListBrowsersFailure>(
  $I`FirecrawlListBrowsersFailure`
)(
  failureFields,
  $I.annote("FirecrawlListBrowsersFailure", {
    description: "Decoded failure shape returned by Firecrawl listBrowsers.",
  })
) {}

/**
 * Firecrawl Get Concurrency Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetConcurrencyPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetConcurrencyPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetConcurrencyPayload extends S.Class<FirecrawlGetConcurrencyPayload>(
  $I`FirecrawlGetConcurrencyPayload`
)(
  {},
  $I.annote("FirecrawlGetConcurrencyPayload", {
    description: "Payload decoded before calling Firecrawl getConcurrency.",
  })
) {}
/**
 * Firecrawl Get Concurrency Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetConcurrencySuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetConcurrencySuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetConcurrencySuccess extends S.Class<FirecrawlGetConcurrencySuccess>(
  $I`FirecrawlGetConcurrencySuccess`
)(
  { data: FirecrawlConcurrencyData },
  $I.annote("FirecrawlGetConcurrencySuccess", {
    description: "Decoded success value returned by Firecrawl getConcurrency.",
  })
) {}
/**
 * Firecrawl Get Concurrency Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetConcurrencyFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetConcurrencyFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetConcurrencyFailure extends S.Class<FirecrawlGetConcurrencyFailure>(
  $I`FirecrawlGetConcurrencyFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetConcurrencyFailure", {
    description: "Decoded failure shape returned by Firecrawl getConcurrency.",
  })
) {}

/**
 * Firecrawl Get Credit Usage Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCreditUsagePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCreditUsagePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCreditUsagePayload extends S.Class<FirecrawlGetCreditUsagePayload>(
  $I`FirecrawlGetCreditUsagePayload`
)(
  {},
  $I.annote("FirecrawlGetCreditUsagePayload", {
    description: "Payload decoded before calling Firecrawl getCreditUsage.",
  })
) {}
/**
 * Firecrawl Get Credit Usage Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCreditUsageSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCreditUsageSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCreditUsageSuccess extends S.Class<FirecrawlGetCreditUsageSuccess>(
  $I`FirecrawlGetCreditUsageSuccess`
)(
  { data: FirecrawlCreditUsageData },
  $I.annote("FirecrawlGetCreditUsageSuccess", {
    description: "Decoded success value returned by Firecrawl getCreditUsage.",
  })
) {}
/**
 * Firecrawl Get Credit Usage Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCreditUsageFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCreditUsageFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCreditUsageFailure extends S.Class<FirecrawlGetCreditUsageFailure>(
  $I`FirecrawlGetCreditUsageFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetCreditUsageFailure", {
    description: "Decoded failure shape returned by Firecrawl getCreditUsage.",
  })
) {}

/**
 * Firecrawl Get Token Usage Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetTokenUsagePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetTokenUsagePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetTokenUsagePayload extends S.Class<FirecrawlGetTokenUsagePayload>(
  $I`FirecrawlGetTokenUsagePayload`
)(
  {},
  $I.annote("FirecrawlGetTokenUsagePayload", { description: "Payload decoded before calling Firecrawl getTokenUsage." })
) {}
/**
 * Firecrawl Get Token Usage Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetTokenUsageSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetTokenUsageSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetTokenUsageSuccess extends S.Class<FirecrawlGetTokenUsageSuccess>(
  $I`FirecrawlGetTokenUsageSuccess`
)(
  { data: FirecrawlTokenUsageData },
  $I.annote("FirecrawlGetTokenUsageSuccess", {
    description: "Decoded success value returned by Firecrawl getTokenUsage.",
  })
) {}
/**
 * Firecrawl Get Token Usage Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetTokenUsageFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetTokenUsageFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetTokenUsageFailure extends S.Class<FirecrawlGetTokenUsageFailure>(
  $I`FirecrawlGetTokenUsageFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetTokenUsageFailure", {
    description: "Decoded failure shape returned by Firecrawl getTokenUsage.",
  })
) {}

/**
 * Firecrawl Get Credit Usage Historical Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCreditUsageHistoricalPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCreditUsageHistoricalPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCreditUsageHistoricalPayload extends S.Class<FirecrawlGetCreditUsageHistoricalPayload>(
  $I`FirecrawlGetCreditUsageHistoricalPayload`
)(
  { byApiKey: optionalBoolean },
  $I.annote("FirecrawlGetCreditUsageHistoricalPayload", {
    description: "Payload decoded before calling Firecrawl getCreditUsageHistorical.",
  })
) {}
/**
 * Firecrawl Get Credit Usage Historical Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCreditUsageHistoricalSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCreditUsageHistoricalSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCreditUsageHistoricalSuccess extends S.Class<FirecrawlGetCreditUsageHistoricalSuccess>(
  $I`FirecrawlGetCreditUsageHistoricalSuccess`
)(
  { data: FirecrawlCreditUsageHistoricalData },
  $I.annote("FirecrawlGetCreditUsageHistoricalSuccess", {
    description: "Decoded success value returned by Firecrawl getCreditUsageHistorical.",
  })
) {}
/**
 * Firecrawl Get Credit Usage Historical Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetCreditUsageHistoricalFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetCreditUsageHistoricalFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetCreditUsageHistoricalFailure extends S.Class<FirecrawlGetCreditUsageHistoricalFailure>(
  $I`FirecrawlGetCreditUsageHistoricalFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetCreditUsageHistoricalFailure", {
    description: "Decoded failure shape returned by Firecrawl getCreditUsageHistorical.",
  })
) {}

/**
 * Firecrawl Get Token Usage Historical Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetTokenUsageHistoricalPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetTokenUsageHistoricalPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetTokenUsageHistoricalPayload extends S.Class<FirecrawlGetTokenUsageHistoricalPayload>(
  $I`FirecrawlGetTokenUsageHistoricalPayload`
)(
  { byApiKey: optionalBoolean },
  $I.annote("FirecrawlGetTokenUsageHistoricalPayload", {
    description: "Payload decoded before calling Firecrawl getTokenUsageHistorical.",
  })
) {}
/**
 * Firecrawl Get Token Usage Historical Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetTokenUsageHistoricalSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetTokenUsageHistoricalSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetTokenUsageHistoricalSuccess extends S.Class<FirecrawlGetTokenUsageHistoricalSuccess>(
  $I`FirecrawlGetTokenUsageHistoricalSuccess`
)(
  { data: FirecrawlTokenUsageHistoricalData },
  $I.annote("FirecrawlGetTokenUsageHistoricalSuccess", {
    description: "Decoded success value returned by Firecrawl getTokenUsageHistorical.",
  })
) {}
/**
 * Firecrawl Get Token Usage Historical Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetTokenUsageHistoricalFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetTokenUsageHistoricalFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetTokenUsageHistoricalFailure extends S.Class<FirecrawlGetTokenUsageHistoricalFailure>(
  $I`FirecrawlGetTokenUsageHistoricalFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetTokenUsageHistoricalFailure", {
    description: "Decoded failure shape returned by Firecrawl getTokenUsageHistorical.",
  })
) {}

/**
 * Firecrawl Get Queue Status Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlGetQueueStatusPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetQueueStatusPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetQueueStatusPayload extends S.Class<FirecrawlGetQueueStatusPayload>(
  $I`FirecrawlGetQueueStatusPayload`
)(
  {},
  $I.annote("FirecrawlGetQueueStatusPayload", {
    description: "Payload decoded before calling Firecrawl getQueueStatus.",
  })
) {}
/**
 * Firecrawl Get Queue Status Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlGetQueueStatusSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetQueueStatusSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetQueueStatusSuccess extends S.Class<FirecrawlGetQueueStatusSuccess>(
  $I`FirecrawlGetQueueStatusSuccess`
)(
  { data: FirecrawlQueueStatusData },
  $I.annote("FirecrawlGetQueueStatusSuccess", {
    description: "Decoded success value returned by Firecrawl getQueueStatus.",
  })
) {}
/**
 * Firecrawl Get Queue Status Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlGetQueueStatusFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlGetQueueStatusFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlGetQueueStatusFailure extends S.Class<FirecrawlGetQueueStatusFailure>(
  $I`FirecrawlGetQueueStatusFailure`
)(
  failureFields,
  $I.annote("FirecrawlGetQueueStatusFailure", {
    description: "Decoded failure shape returned by Firecrawl getQueueStatus.",
  })
) {}

/**
 * Firecrawl Watcher Payload decoded before calling the Firecrawl SDK.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherPayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlWatcherPayload extends S.Class<FirecrawlWatcherPayload>($I`FirecrawlWatcherPayload`)(
  {
    jobId: S.String,
    options: S.OptionFromOptionalKey(FirecrawlWatcherOptions).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<WatcherOptions>()))
    ),
  },
  $I.annote("FirecrawlWatcherPayload", {
    description: "Payload decoded before constructing a Firecrawl watcher stream.",
  })
) {}
/**
 * Firecrawl Watcher Success decoded after a successful Firecrawl SDK call.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherSuccess } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherSuccess)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlWatcherSuccess extends S.Class<FirecrawlWatcherSuccess>($I`FirecrawlWatcherSuccess`)(
  { jobId: S.String },
  $I.annote("FirecrawlWatcherSuccess", { description: "Decoded success value for Firecrawl watcher construction." })
) {}
/**
 * Firecrawl Watcher Failure decoded from a Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherFailure } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlWatcherFailure extends S.Class<FirecrawlWatcherFailure>($I`FirecrawlWatcherFailure`)(
  failureFields,
  $I.annote("FirecrawlWatcherFailure", {
    description: "Decoded failure shape emitted while constructing or running a Firecrawl watcher.",
  })
) {}

/**
 * Firecrawl Watcher Document Event watcher event schema.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherDocumentEvent } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherDocumentEvent)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FirecrawlWatcherDocumentEvent extends S.Class<FirecrawlWatcherDocumentEvent>(
  $I`FirecrawlWatcherDocumentEvent`
)(
  {
    document: FirecrawlDocument,
    id: optionalString,
    type: S.Literal("document"),
  },
  $I.annote("FirecrawlWatcherDocumentEvent", { description: "Firecrawl watcher document event." })
) {}

/**
 * Firecrawl Watcher Snapshot Event watcher event schema.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherSnapshotEvent } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherSnapshotEvent)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FirecrawlWatcherSnapshotEvent extends S.Class<FirecrawlWatcherSnapshotEvent>(
  $I`FirecrawlWatcherSnapshotEvent`
)(
  {
    snapshot: S.Unknown,
    type: S.Literal("snapshot"),
  },
  $I.annote("FirecrawlWatcherSnapshotEvent", { description: "Firecrawl watcher snapshot event." })
) {}

/**
 * Firecrawl Watcher Done Event watcher event schema.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherDoneEvent } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherDoneEvent)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FirecrawlWatcherDoneEvent extends S.Class<FirecrawlWatcherDoneEvent>($I`FirecrawlWatcherDoneEvent`)(
  {
    completed: optionalNumber,
    creditsUsed: optionalNumber,
    data: S.OptionFromOptionalKey(FirecrawlDocument.pipe(S.Array)).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<ReadonlyArray<FirecrawlDocument>>()))
    ),
    id: optionalString,
    status: optionalString,
    total: optionalNumber,
    type: S.Literal("done"),
  },
  $I.annote("FirecrawlWatcherDoneEvent", { description: "Firecrawl watcher terminal done event." })
) {}

/**
 * Firecrawl Watcher Error Event watcher event schema.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherErrorEvent } from "@beep/firecrawl"
 *
 * console.log(FirecrawlWatcherErrorEvent)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FirecrawlWatcherErrorEvent extends S.Class<FirecrawlWatcherErrorEvent>($I`FirecrawlWatcherErrorEvent`)(
  {
    error: S.String,
    id: optionalString,
    status: optionalString,
    type: S.Literal("error"),
  },
  $I.annote("FirecrawlWatcherErrorEvent", { description: "Firecrawl watcher error event." })
) {}

/**
 * Tagged Firecrawl watcher event union.
 *
 * @example
 * ```ts
 * import { FirecrawlWatcherDocumentEvent } from "@beep/firecrawl"
 *
 * const event = FirecrawlWatcherDocumentEvent.make({
 *   document: {},
 *   type: "document"
 * })
 *
 * console.log(event.type)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlWatcherEvent = S.Union([
  FirecrawlWatcherDocumentEvent,
  FirecrawlWatcherSnapshotEvent,
  FirecrawlWatcherDoneEvent,
  FirecrawlWatcherErrorEvent,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("FirecrawlWatcherEvent", {
    description: "Tagged Firecrawl watcher event union decoded from SDK watcher events.",
  })
);

/**
 * Type for {@link FirecrawlWatcherEvent}.
 *
 * @example
 * ```ts
 * import type { FirecrawlWatcherEvent } from "@beep/firecrawl"
 *
 * const handle = (event: FirecrawlWatcherEvent) => event.type
 * console.log(handle)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlWatcherEvent = typeof FirecrawlWatcherEvent.Type;
