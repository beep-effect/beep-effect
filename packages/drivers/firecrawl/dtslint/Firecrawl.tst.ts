import { Firecrawl, FirecrawlConfigInput, FirecrawlScrapePayload, FirecrawlWatcherPayload } from "@beep/firecrawl";
import { Redacted } from "effect";
import { describe, expect, it } from "tstyche";
import type {
  FirecrawlActiveCrawlsData,
  FirecrawlAgentResponseData,
  FirecrawlAgentStatusData,
  FirecrawlBatchScrapeJobData,
  FirecrawlBatchScrapeResponseData,
  FirecrawlBrowserCreateData,
  FirecrawlBrowserDeleteData,
  FirecrawlBrowserExecuteData,
  FirecrawlBrowserListData,
  FirecrawlConcurrencyData,
  FirecrawlCrawlErrorsData,
  FirecrawlCrawlJobData,
  FirecrawlCrawlResponseData,
  FirecrawlCreditUsageData,
  FirecrawlCreditUsageHistoricalData,
  FirecrawlDocument,
  FirecrawlError,
  FirecrawlInteractData,
  FirecrawlMapData,
  FirecrawlMonitorCheckData,
  FirecrawlMonitorCheckDetailData,
  FirecrawlMonitorCheckListData,
  FirecrawlMonitorData,
  FirecrawlMonitorListData,
  FirecrawlQueueStatusData,
  FirecrawlScrapeSuccess,
  FirecrawlSearchData,
  FirecrawlShape,
  FirecrawlStopInteractionData,
  FirecrawlTokenUsageData,
  FirecrawlTokenUsageHistoricalData,
  FirecrawlWatcherEvent,
} from "@beep/firecrawl";
import type { Effect, Stream } from "effect";
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

describe("@beep/firecrawl", () => {
  it("exposes the typed public service and schema surface", () => {
    expect(Firecrawl).type.not.toBe<never>();
    expect(FirecrawlConfigInput.make({ apiKey: Redacted.make("fc-test-key") })).type.toBe<FirecrawlConfigInput>();
    expect(FirecrawlScrapePayload.make({ url: "https://example.com" })).type.toBe<FirecrawlScrapePayload>();
    expect(FirecrawlWatcherPayload.make({ jobId: "crawl-id" })).type.toBe<FirecrawlWatcherPayload>();
  });

  it("keeps method return channels typed", () => {
    expect<FirecrawlShape["scrape"]>().type.toBe<
      (payload: FirecrawlScrapePayload) => Effect.Effect<FirecrawlScrapeSuccess, FirecrawlError>
    >();
    expect<FirecrawlShape["watcher"]>().type.toBe<
      (payload: FirecrawlWatcherPayload) => Stream.Stream<FirecrawlWatcherEvent, FirecrawlError>
    >();
  });

  it("keeps response schemas in exact parity with the Firecrawl SDK", () => {
    expect<FirecrawlDocument>().type.toBe<Document>();
    expect<FirecrawlSearchData>().type.toBe<SearchData>();
    expect<FirecrawlMapData>().type.toBe<MapData>();
    expect<FirecrawlCrawlResponseData>().type.toBe<CrawlResponse>();
    expect<FirecrawlCrawlJobData>().type.toBe<CrawlJob>();
    expect<FirecrawlCrawlErrorsData>().type.toBe<CrawlErrorsResponse>();
    expect<FirecrawlActiveCrawlsData>().type.toBe<ActiveCrawlsResponse>();
    expect<FirecrawlMonitorData>().type.toBe<Monitor>();
    expect<FirecrawlMonitorListData>().type.toBe<ReadonlyArray<Monitor>>();
    expect<FirecrawlMonitorCheckData>().type.toBe<MonitorCheck>();
    expect<FirecrawlMonitorCheckListData>().type.toBe<ReadonlyArray<MonitorCheck>>();
    expect<FirecrawlMonitorCheckDetailData>().type.toBe<MonitorCheckDetail>();
    expect<FirecrawlBatchScrapeResponseData>().type.toBe<BatchScrapeResponse>();
    expect<FirecrawlBatchScrapeJobData>().type.toBe<BatchScrapeJob>();
    expect<FirecrawlAgentResponseData>().type.toBe<AgentResponse>();
    expect<FirecrawlAgentStatusData>().type.toBe<AgentStatusResponse>();
    expect<FirecrawlBrowserCreateData>().type.toBe<BrowserCreateResponse>();
    expect<FirecrawlBrowserExecuteData>().type.toBe<BrowserExecuteResponse>();
    expect<FirecrawlBrowserDeleteData>().type.toBe<BrowserDeleteResponse>();
    expect<FirecrawlBrowserListData>().type.toBe<BrowserListResponse>();
    expect<FirecrawlConcurrencyData>().type.toBe<ConcurrencyCheck>();
    expect<FirecrawlCreditUsageData>().type.toBe<CreditUsage>();
    expect<FirecrawlTokenUsageData>().type.toBe<TokenUsage>();
    expect<FirecrawlCreditUsageHistoricalData>().type.toBe<CreditUsageHistoricalResponse>();
    expect<FirecrawlTokenUsageHistoricalData>().type.toBe<TokenUsageHistoricalResponse>();
    expect<FirecrawlQueueStatusData>().type.toBe<QueueStatusResponse>();
    expect<FirecrawlInteractData>().type.toBe<ScrapeExecuteResponse>();
    expect<FirecrawlStopInteractionData>().type.toBe<ScrapeBrowserDeleteResponse>();
  });
});
