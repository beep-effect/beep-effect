/**
 * Structural guards for Firecrawl SDK response values.
 *
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type {
  ActiveCrawlsResponse,
  AgentResponse,
  AgentStatusResponse,
  BatchScrapeJob,
  BatchScrapeResponse,
  BrowserCreateResponse,
  BrowserDeleteResponse,
  BrowserExecuteResponse,
  BrowserListResponse,
  ConcurrencyCheck,
  CrawlErrorsResponse,
  CrawlJob,
  CrawlResponse,
  CreditUsage,
  CreditUsageHistoricalResponse,
  Document,
  MapData,
  Monitor,
  MonitorCheck,
  MonitorCheckDetail,
  QueueStatusResponse,
  ScrapeBrowserDeleteResponse,
  ScrapeExecuteResponse,
  SearchData,
  TokenUsage,
  TokenUsageHistoricalResponse,
} from "firecrawl";

const $I = $FirecrawlId.create("Firecrawl.responses");

const unknownRecord = S.Record(S.String, S.Unknown);
const optionalString = S.optionalKey(S.String);
const optionalFinite = S.optionalKey(S.Finite);
const optionalBoolean = S.optionalKey(S.Boolean);
const optionalNullableString = S.String.pipe(S.NullOr, S.optionalKey);

const sdkResponse = <A>(name: string, description: string, shape: S.Constraint): S.Codec<A> => {
  const isShape = S.is(S.toEncoded(shape));

  return S.declare<A>((value: unknown): value is A => isShape(value), {
    description,
    expected: name,
  }).pipe($I.annoteSchema(name, { description }));
};

const documentMetadataShape = S.Record(S.String, S.Unknown);
class DocumentAttributeShape extends S.Class<DocumentAttributeShape>($I`DocumentAttributeShape`)({
  attribute: S.String,
  selector: S.String,
  values: S.Array(S.String),
}) {}
class DocumentShape extends S.Class<DocumentShape>($I`DocumentShape`)({
  actions: S.optionalKey(unknownRecord),
  answer: optionalString,
  attributes: DocumentAttributeShape.pipe(S.Array, S.optionalKey),
  audio: optionalString,
  branding: S.optionalKey(S.Unknown),
  changeTracking: S.optionalKey(unknownRecord),
  highlights: optionalString,
  html: optionalString,
  images: S.String.pipe(S.Array, S.optionalKey),
  json: S.optionalKey(S.Unknown),
  links: S.String.pipe(S.Array, S.optionalKey),
  markdown: optionalString,
  menu: S.optionalKey(S.Unknown),
  metadata: S.optionalKey(documentMetadataShape),
  product: S.optionalKey(S.Unknown),
  rawHtml: optionalString,
  screenshot: optionalString,
  summary: optionalString,
  video: optionalString,
  warning: optionalString,
}) {}

class SearchResultWebShape extends S.Class<SearchResultWebShape>($I`SearchResultWebShape`)({
  category: optionalString,
  description: optionalString,
  title: optionalString,
  url: S.String,
}) {}
class SearchResultNewsShape extends S.Class<SearchResultNewsShape>($I`SearchResultNewsShape`)({
  category: optionalString,
  date: optionalString,
  imageUrl: optionalString,
  position: optionalFinite,
  snippet: optionalString,
  title: optionalString,
  url: optionalString,
}) {}
class SearchResultImageShape extends S.Class<SearchResultImageShape>($I`SearchResultImageShape`)({
  imageHeight: optionalFinite,
  imageUrl: optionalString,
  imageWidth: optionalFinite,
  position: optionalFinite,
  title: optionalString,
  url: optionalString,
}) {}
class SearchDocumentShape extends S.Class<SearchDocumentShape>($I`SearchDocumentShape`)({
  ...DocumentShape.fields,
  category: S.optionalKey(S.Never),
  date: S.optionalKey(S.Never),
  description: S.optionalKey(S.Never),
  imageHeight: S.optionalKey(S.Never),
  imageUrl: S.optionalKey(S.Never),
  imageWidth: S.optionalKey(S.Never),
  position: S.optionalKey(S.Never),
  snippet: S.optionalKey(S.Never),
  title: S.optionalKey(S.Never),
  url: S.optionalKey(S.Never),
}) {}
class SearchDataShape extends S.Class<SearchDataShape>($I`SearchDataShape`)({
  images: S.Union([SearchResultImageShape, SearchDocumentShape]).pipe(S.Array, S.optionalKey),
  news: S.Union([SearchResultNewsShape, SearchDocumentShape]).pipe(S.Array, S.optionalKey),
  web: S.Union([SearchResultWebShape, SearchDocumentShape]).pipe(S.Array, S.optionalKey),
}) {}
class MapDataShape extends S.Class<MapDataShape>($I`MapDataShape`)({
  id: optionalString,
  links: S.Array(SearchResultWebShape),
}) {}

class CrawlResponseShape extends S.Class<CrawlResponseShape>($I`CrawlResponseShape`)({
  id: S.String,
  url: S.String,
}) {}
class ScrapeJobShape extends S.Class<ScrapeJobShape>($I`ScrapeJobShape`)({
  completed: S.Finite,
  creditsUsed: optionalFinite,
  data: S.Array(DocumentShape),
  expiresAt: optionalString,
  id: S.String,
  next: optionalNullableString,
  status: S.Literals(["scraping", "completed", "failed", "cancelled"]),
  total: S.Finite,
}) {}
class CrawlErrorShape extends S.Class<CrawlErrorShape>($I`CrawlErrorShape`)({
  code: optionalString,
  error: S.String,
  id: S.String,
  timestamp: optionalString,
  url: S.String,
}) {}
class CrawlErrorsShape extends S.Class<CrawlErrorsShape>($I`CrawlErrorsShape`)({
  errors: S.Array(CrawlErrorShape),
  robotsBlocked: S.Array(S.String),
}) {}
class ActiveCrawlShape extends S.Class<ActiveCrawlShape>($I`ActiveCrawlShape`)({
  id: S.String,
  options: unknownRecord.pipe(S.NullOr, S.optionalKey),
  teamId: S.String,
  url: S.String,
}) {}
class ActiveCrawlsShape extends S.Class<ActiveCrawlsShape>($I`ActiveCrawlsShape`)({
  crawls: S.Array(ActiveCrawlShape),
  success: S.Boolean,
}) {}

class MonitorScheduleShape extends S.Class<MonitorScheduleShape>($I`MonitorScheduleShape`)({
  cron: optionalString,
  text: optionalString,
  timezone: optionalString,
}) {}
class MonitorWebhookShape extends S.Class<MonitorWebhookShape>($I`MonitorWebhookShape`)({
  events: S.String.pipe(S.Array, S.optionalKey),
  headers: S.optionalKey(S.Record(S.String, S.String)),
  metadata: S.optionalKey(S.Record(S.String, S.String)),
  url: S.String,
}) {}
class MonitorEmailNotificationShape extends S.Class<MonitorEmailNotificationShape>($I`MonitorEmailNotificationShape`)({
  enabled: optionalBoolean,
  includeDiffs: optionalBoolean,
  recipients: S.String.pipe(S.Array, S.optionalKey),
}) {}
class MonitorNotificationShape extends S.Class<MonitorNotificationShape>($I`MonitorNotificationShape`)({
  email: S.optionalKey(MonitorEmailNotificationShape),
}) {}
class MonitorScrapeTargetShape extends S.Class<MonitorScrapeTargetShape>($I`MonitorScrapeTargetShape`)({
  id: optionalString,
  scrapeOptions: S.optionalKey(unknownRecord),
  type: S.Literal("scrape"),
  urls: S.Array(S.String),
}) {}
class MonitorCrawlTargetShape extends S.Class<MonitorCrawlTargetShape>($I`MonitorCrawlTargetShape`)({
  crawlOptions: S.optionalKey(unknownRecord),
  id: optionalString,
  scrapeOptions: S.optionalKey(unknownRecord),
  type: S.Literal("crawl"),
  url: S.String,
}) {}
class MonitorSearchTargetShape extends S.Class<MonitorSearchTargetShape>($I`MonitorSearchTargetShape`)({
  excludeDomains: S.String.pipe(S.Array, S.optionalKey),
  id: optionalString,
  includeDomains: S.String.pipe(S.Array, S.optionalKey),
  maxResults: optionalFinite,
  queries: S.Array(S.String),
  searchWindow: S.optionalKey(S.Literals(["5m", "15m", "1h", "6h", "24h", "7d"])),
  type: S.Literal("search"),
}) {}
const monitorTargetShape = S.Union([MonitorScrapeTargetShape, MonitorCrawlTargetShape, MonitorSearchTargetShape]);
class MonitorSummaryShape extends S.Class<MonitorSummaryShape>($I`MonitorSummaryShape`)({
  changed: S.Finite,
  error: S.Finite,
  new: S.Finite,
  removed: S.Finite,
  same: S.Finite,
  totalPages: S.Finite,
}) {}
class MonitorShape extends S.Class<MonitorShape>($I`MonitorShape`)({
  createdAt: S.String,
  currentCheckId: optionalNullableString,
  estimatedCreditsPerMonth: S.Finite.pipe(S.NullOr, S.optionalKey),
  goal: optionalNullableString,
  id: S.String,
  judgeEnabled: optionalBoolean,
  lastCheckSummary: MonitorSummaryShape.pipe(S.NullOr, S.optionalKey),
  lastRunAt: optionalNullableString,
  name: S.String,
  nextRunAt: optionalNullableString,
  notification: MonitorNotificationShape.pipe(S.NullOr, S.optionalKey),
  retentionDays: S.Finite,
  schedule: MonitorScheduleShape,
  status: S.Literals(["active", "paused", "deleted"]),
  targets: S.Array(monitorTargetShape),
  updatedAt: S.String,
  webhook: MonitorWebhookShape.pipe(S.NullOr, S.optionalKey),
}) {}

class MonitorScrapeTargetResultShape extends S.Class<MonitorScrapeTargetResultShape>(
  $I`MonitorScrapeTargetResultShape`
)({
  expectedJobs: S.String.pipe(S.Array, S.optionalKey),
  targetId: S.String,
  type: S.Literal("scrape"),
}) {}
class MonitorCrawlTargetResultShape extends S.Class<MonitorCrawlTargetResultShape>($I`MonitorCrawlTargetResultShape`)({
  crawlId: optionalString,
  targetId: S.String,
  type: S.Literal("crawl"),
}) {}
class MonitorSearchTargetResultShape extends S.Class<MonitorSearchTargetResultShape>(
  $I`MonitorSearchTargetResultShape`
)({
  degradedReason: optionalNullableString,
  judgeCredits: optionalFinite,
  judgeDegraded: optionalBoolean,
  matches: optionalFinite,
  resultCount: optionalFinite,
  resultsJudged: optionalFinite,
  searchCompleted: optionalBoolean,
  searchCredits: optionalFinite,
  summary: optionalString,
  targetId: S.String,
  type: S.Literal("search"),
}) {}
const monitorTargetResultShape = S.Union([
  MonitorScrapeTargetResultShape,
  MonitorCrawlTargetResultShape,
  MonitorSearchTargetResultShape,
]);
class MonitorCheckShape extends S.Class<MonitorCheckShape>($I`MonitorCheckShape`)({
  actualCredits: S.Finite.pipe(S.NullOr, S.optionalKey),
  billingStatus: S.Literals(["not_applicable", "reserved", "confirmed", "released", "failed"]),
  createdAt: S.String,
  error: optionalNullableString,
  estimatedCredits: S.Finite.pipe(S.NullOr, S.optionalKey),
  finishedAt: optionalNullableString,
  id: S.String,
  monitorId: S.String,
  notificationStatus: S.optionalKey(S.Unknown),
  reservedCredits: S.Finite.pipe(S.NullOr, S.optionalKey),
  scheduledFor: optionalNullableString,
  startedAt: optionalNullableString,
  status: S.Literals(["queued", "running", "completed", "failed", "partial", "skipped_overlap", "skipped_no_credits"]),
  summary: MonitorSummaryShape,
  targetResults: monitorTargetResultShape.pipe(S.Array, S.optionalKey),
  trigger: S.Literals(["scheduled", "manual"]),
  updatedAt: S.String,
}) {}
class MonitorCheckPageShape extends S.Class<MonitorCheckPageShape>($I`MonitorCheckPageShape`)({
  createdAt: S.String,
  currentScrapeId: optionalNullableString,
  diff: unknownRecord.pipe(S.NullOr, S.optionalKey),
  error: optionalNullableString,
  id: S.String,
  judgment: unknownRecord.pipe(S.NullOr, S.optionalKey),
  metadata: S.optionalKey(S.Unknown),
  previousScrapeId: optionalNullableString,
  snapshot: unknownRecord.pipe(S.NullOr, S.optionalKey),
  status: S.Literals(["same", "new", "changed", "removed", "error"]),
  statusCode: S.Finite.pipe(S.NullOr, S.optionalKey),
  targetId: S.String,
  url: S.String,
}) {}
class MonitorCheckDetailShape extends S.Class<MonitorCheckDetailShape>($I`MonitorCheckDetailShape`)({
  ...MonitorCheckShape.fields,
  next: optionalNullableString,
  pages: S.Array(MonitorCheckPageShape),
}) {}

class BatchScrapeResponseShape extends S.Class<BatchScrapeResponseShape>($I`BatchScrapeResponseShape`)({
  id: S.String,
  invalidURLs: S.String.pipe(S.Array, S.optionalKey),
  url: S.String,
}) {}
class AgentResponseShape extends S.Class<AgentResponseShape>($I`AgentResponseShape`)({
  error: optionalString,
  id: S.String,
  success: S.Boolean,
}) {}
class AgentStatusShape extends S.Class<AgentStatusShape>($I`AgentStatusShape`)({
  creditsUsed: optionalFinite,
  data: S.optionalKey(S.Unknown),
  error: optionalString,
  expiresAt: S.String,
  model: S.optionalKey(S.Literals(["spark-1-pro", "spark-1-mini"])),
  status: S.Literals(["processing", "completed", "failed"]),
  success: S.Boolean,
}) {}

class BrowserCreateShape extends S.Class<BrowserCreateShape>($I`BrowserCreateShape`)({
  cdpUrl: optionalString,
  error: optionalString,
  expiresAt: optionalString,
  id: optionalString,
  interactiveLiveViewUrl: optionalString,
  liveViewUrl: optionalString,
  success: S.Boolean,
}) {}
class BrowserExecuteShape extends S.Class<BrowserExecuteShape>($I`BrowserExecuteShape`)({
  cdpUrl: optionalString,
  error: optionalString,
  exitCode: optionalFinite,
  interactiveLiveViewUrl: optionalString,
  killed: optionalBoolean,
  liveViewUrl: optionalString,
  output: optionalString,
  result: optionalString,
  stderr: optionalString,
  stdout: optionalString,
  success: S.Boolean,
}) {}
class BrowserDeleteShape extends S.Class<BrowserDeleteShape>($I`BrowserDeleteShape`)({
  creditsBilled: optionalFinite,
  error: optionalString,
  sessionDurationMs: optionalFinite,
  success: S.Boolean,
}) {}
class BrowserSessionShape extends S.Class<BrowserSessionShape>($I`BrowserSessionShape`)({
  cdpUrl: S.String,
  createdAt: S.String,
  id: S.String,
  interactiveLiveViewUrl: optionalString,
  lastActivity: S.String,
  liveViewUrl: S.String,
  status: S.String,
  streamWebView: S.Boolean,
}) {}
class BrowserListShape extends S.Class<BrowserListShape>($I`BrowserListShape`)({
  error: optionalString,
  sessions: BrowserSessionShape.pipe(S.Array, S.optionalKey),
  success: S.Boolean,
}) {}

class ConcurrencyShape extends S.Class<ConcurrencyShape>($I`ConcurrencyShape`)({
  concurrency: S.Finite,
  maxConcurrency: S.Finite,
}) {}
class CreditUsageShape extends S.Class<CreditUsageShape>($I`CreditUsageShape`)({
  billingPeriodEnd: optionalNullableString,
  billingPeriodStart: optionalNullableString,
  planCredits: optionalFinite,
  remainingCredits: S.Finite,
}) {}
class TokenUsageShape extends S.Class<TokenUsageShape>($I`TokenUsageShape`)({
  billingPeriodEnd: optionalNullableString,
  billingPeriodStart: optionalNullableString,
  planTokens: optionalFinite,
  remainingTokens: S.Finite,
}) {}
class CreditUsagePeriodShape extends S.Class<CreditUsagePeriodShape>($I`CreditUsagePeriodShape`)({
  apiKey: optionalString,
  creditsUsed: S.Finite,
  endDate: S.NullOr(S.String),
  startDate: S.NullOr(S.String),
}) {}
class CreditUsageHistoricalShape extends S.Class<CreditUsageHistoricalShape>($I`CreditUsageHistoricalShape`)({
  periods: S.Array(CreditUsagePeriodShape),
  success: S.Boolean,
}) {}
class TokenUsagePeriodShape extends S.Class<TokenUsagePeriodShape>($I`TokenUsagePeriodShape`)({
  apiKey: optionalString,
  endDate: S.NullOr(S.String),
  startDate: S.NullOr(S.String),
  tokensUsed: S.Finite,
}) {}
class TokenUsageHistoricalShape extends S.Class<TokenUsageHistoricalShape>($I`TokenUsageHistoricalShape`)({
  periods: S.Array(TokenUsagePeriodShape),
  success: S.Boolean,
}) {}
class QueueStatusShape extends S.Class<QueueStatusShape>($I`QueueStatusShape`)({
  activeJobsInQueue: S.Finite,
  jobsInQueue: S.Finite,
  maxConcurrency: S.Finite,
  mostRecentSuccess: S.NullOr(S.String),
  success: S.Boolean,
  waitingJobsInQueue: S.Finite,
}) {}

export const FirecrawlDocument = sdkResponse<Document>(
  "FirecrawlDocument",
  "Structurally validated Firecrawl document returned by the SDK.",
  DocumentShape
);
export const FirecrawlSearchData = sdkResponse<SearchData>(
  "FirecrawlSearchData",
  "Structurally validated Firecrawl search response.",
  SearchDataShape
);
export const FirecrawlMapData = sdkResponse<MapData>(
  "FirecrawlMapData",
  "Structurally validated Firecrawl map response.",
  MapDataShape
);
export const FirecrawlCrawlResponseData = sdkResponse<CrawlResponse>(
  "FirecrawlCrawlResponseData",
  "Structurally validated Firecrawl crawl start response.",
  CrawlResponseShape
);
export const FirecrawlCrawlJobData = sdkResponse<CrawlJob>(
  "FirecrawlCrawlJobData",
  "Structurally validated Firecrawl crawl job response.",
  ScrapeJobShape
);
export const FirecrawlCrawlErrorsData = sdkResponse<CrawlErrorsResponse>(
  "FirecrawlCrawlErrorsData",
  "Structurally validated Firecrawl crawl errors response.",
  CrawlErrorsShape
);
export const FirecrawlActiveCrawlsData = sdkResponse<ActiveCrawlsResponse>(
  "FirecrawlActiveCrawlsData",
  "Structurally validated Firecrawl active crawls response.",
  ActiveCrawlsShape
);
export const FirecrawlMonitorData = sdkResponse<Monitor>(
  "FirecrawlMonitorData",
  "Structurally validated Firecrawl monitor response.",
  MonitorShape
);
export const FirecrawlMonitorListData = sdkResponse<ReadonlyArray<Monitor>>(
  "FirecrawlMonitorListData",
  "Structurally validated Firecrawl monitor list response.",
  S.Array(MonitorShape)
);
export const FirecrawlMonitorCheckData = sdkResponse<MonitorCheck>(
  "FirecrawlMonitorCheckData",
  "Structurally validated Firecrawl monitor check response.",
  MonitorCheckShape
);
export const FirecrawlMonitorCheckListData = sdkResponse<ReadonlyArray<MonitorCheck>>(
  "FirecrawlMonitorCheckListData",
  "Structurally validated Firecrawl monitor check list response.",
  S.Array(MonitorCheckShape)
);
export const FirecrawlMonitorCheckDetailData = sdkResponse<MonitorCheckDetail>(
  "FirecrawlMonitorCheckDetailData",
  "Structurally validated Firecrawl monitor check detail response.",
  MonitorCheckDetailShape
);
export const FirecrawlBatchScrapeResponseData = sdkResponse<BatchScrapeResponse>(
  "FirecrawlBatchScrapeResponseData",
  "Structurally validated Firecrawl batch scrape start response.",
  BatchScrapeResponseShape
);
export const FirecrawlBatchScrapeJobData = sdkResponse<BatchScrapeJob>(
  "FirecrawlBatchScrapeJobData",
  "Structurally validated Firecrawl batch scrape job response.",
  ScrapeJobShape
);
export const FirecrawlAgentResponseData = sdkResponse<AgentResponse>(
  "FirecrawlAgentResponseData",
  "Structurally validated Firecrawl agent start response.",
  AgentResponseShape
);
export const FirecrawlAgentStatusData = sdkResponse<AgentStatusResponse>(
  "FirecrawlAgentStatusData",
  "Structurally validated Firecrawl agent status response.",
  AgentStatusShape
);
export const FirecrawlBrowserCreateData = sdkResponse<BrowserCreateResponse>(
  "FirecrawlBrowserCreateData",
  "Structurally validated Firecrawl browser creation response.",
  BrowserCreateShape
);
export const FirecrawlBrowserExecuteData = sdkResponse<BrowserExecuteResponse>(
  "FirecrawlBrowserExecuteData",
  "Structurally validated Firecrawl browser execution response.",
  BrowserExecuteShape
);
export const FirecrawlBrowserDeleteData = sdkResponse<BrowserDeleteResponse>(
  "FirecrawlBrowserDeleteData",
  "Structurally validated Firecrawl browser deletion response.",
  BrowserDeleteShape
);
export const FirecrawlBrowserListData = sdkResponse<BrowserListResponse>(
  "FirecrawlBrowserListData",
  "Structurally validated Firecrawl browser list response.",
  BrowserListShape
);
export const FirecrawlConcurrencyData = sdkResponse<ConcurrencyCheck>(
  "FirecrawlConcurrencyData",
  "Structurally validated Firecrawl concurrency response.",
  ConcurrencyShape
);
export const FirecrawlCreditUsageData = sdkResponse<CreditUsage>(
  "FirecrawlCreditUsageData",
  "Structurally validated Firecrawl credit usage response.",
  CreditUsageShape
);
export const FirecrawlTokenUsageData = sdkResponse<TokenUsage>(
  "FirecrawlTokenUsageData",
  "Structurally validated Firecrawl token usage response.",
  TokenUsageShape
);
export const FirecrawlCreditUsageHistoricalData = sdkResponse<CreditUsageHistoricalResponse>(
  "FirecrawlCreditUsageHistoricalData",
  "Structurally validated Firecrawl historical credit usage response.",
  CreditUsageHistoricalShape
);
export const FirecrawlTokenUsageHistoricalData = sdkResponse<TokenUsageHistoricalResponse>(
  "FirecrawlTokenUsageHistoricalData",
  "Structurally validated Firecrawl historical token usage response.",
  TokenUsageHistoricalShape
);
export const FirecrawlQueueStatusData = sdkResponse<QueueStatusResponse>(
  "FirecrawlQueueStatusData",
  "Structurally validated Firecrawl queue status response.",
  QueueStatusShape
);
export const FirecrawlInteractData = sdkResponse<ScrapeExecuteResponse>(
  "FirecrawlInteractData",
  "Structurally validated Firecrawl interaction response.",
  BrowserExecuteShape
);
export const FirecrawlStopInteractionData = sdkResponse<ScrapeBrowserDeleteResponse>(
  "FirecrawlStopInteractionData",
  "Structurally validated Firecrawl stop interaction response.",
  BrowserDeleteShape
);
