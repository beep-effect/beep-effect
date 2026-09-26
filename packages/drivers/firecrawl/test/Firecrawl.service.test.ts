import * as F from "@beep/firecrawl";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { thunkTrue } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { Cause, Effect, Exit, Stream } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeFFirecrawlApiFailure = S.decodeEffect(F.FirecrawlApiFailure);
const decodeFFirecrawlConfigInput = S.decodeEffect(F.FirecrawlConfigInput);
const decodeFFirecrawlScrapePayload = S.decodeEffect(F.FirecrawlScrapePayload);
const decodeUnknownFFirecrawlDocument = S.decodeUnknownEffect(F.FirecrawlDocument);
const decodeUnknownFFirecrawlSearchData = S.decodeUnknownEffect(F.FirecrawlSearchData);
const decodeUnknownFFirecrawlDocumentOption = S.decodeUnknownOption(F.FirecrawlDocument);
const decodeUnknownFFirecrawlMonitorListDataOption = S.decodeUnknownOption(F.FirecrawlMonitorListData);
const decodeUnknownFFirecrawlScrapeOptionsOption = S.decodeUnknownOption(F.FirecrawlScrapeOptions);
const decodeUnknownFFirecrawlScrapeSuccessOption = S.decodeUnknownOption(F.FirecrawlScrapeSuccess);
const decodeUnknownFFirecrawlSearchDataOption = S.decodeUnknownOption(F.FirecrawlSearchData);
const encodeFFirecrawlApiFailure = S.encodeEffect(F.FirecrawlApiFailure);
const encodeFFirecrawlConfigInput = S.encodeEffect(F.FirecrawlConfigInput);

type FakeWatcherEventName = "document" | "done" | "error" | "snapshot";
type FakeWatcherListener = (payload: unknown) => void;
const decodeWatcherEventOption = S.decodeUnknownOption(F.FirecrawlWatcherEvent);
type FakeWatcherEmission = {
  readonly eventName: FakeWatcherEventName;
  readonly payload: unknown;
};

class FakeFirecrawlWatcher implements F.FirecrawlSdkWatcher {
  readonly emissions: ReadonlyArray<FakeWatcherEmission>;
  closed = false;
  listeners: Record<FakeWatcherEventName, ReadonlyArray<FakeWatcherListener>> = {
    document: [],
    done: [],
    error: [],
    snapshot: [],
  };
  started = false;

  constructor(emissions: ReadonlyArray<FakeWatcherEmission> = []) {
    this.emissions = emissions;
  }

  close(): void {
    this.closed = true;
  }

  off(eventName: FakeWatcherEventName, listener: FakeWatcherListener): F.FirecrawlSdkWatcher {
    this.listeners[eventName] = A.filter(this.listeners[eventName], (current) => current !== listener);
    return this;
  }

  on(eventName: FakeWatcherEventName, listener: FakeWatcherListener): F.FirecrawlSdkWatcher {
    this.listeners[eventName] = A.append(this.listeners[eventName], listener);
    return this;
  }

  private emitAll(): void {
    for (const emission of this.emissions) {
      if (this.closed) {
        return;
      }
      for (const listener of this.listeners[emission.eventName]) {
        listener(emission.payload);
      }
    }
  }

  start(): Promise<void> {
    this.started = true;
    return Promise.resolve().then(() => this.emitAll());
  }
}

const document = { markdown: "ok" };
const crawlJob = {
  completed: 1,
  data: [document],
  id: "crawl-id",
  status: "completed",
  total: 1,
} satisfies F.FirecrawlCrawlJobData;
const batchJob = {
  completed: 1,
  data: [document],
  id: "batch-id",
  status: "completed",
  total: 1,
} satisfies F.FirecrawlBatchScrapeJobData;
const monitorSummary = {
  changed: 0,
  error: 0,
  new: 0,
  removed: 0,
  same: 1,
  totalPages: 1,
};
const monitor = {
  createdAt: "2026-06-04T00:00:00Z",
  id: "monitor-id",
  name: "Monitor",
  retentionDays: 7,
  schedule: { cron: "* * * * *" },
  status: "active",
  targets: [{ type: "scrape", urls: ["https://example.com"] }],
  updatedAt: "2026-06-04T00:00:00Z",
} satisfies F.FirecrawlMonitorData;
const monitorCheck = {
  billingStatus: "not_applicable",
  createdAt: "2026-06-04T00:00:00Z",
  id: "check-id",
  monitorId: "monitor-id",
  status: "completed",
  summary: monitorSummary,
  trigger: "manual",
  updatedAt: "2026-06-04T00:00:00Z",
} satisfies F.FirecrawlMonitorCheckData;
const queueStatus = {
  activeJobsInQueue: 0,
  jobsInQueue: 0,
  maxConcurrency: 1,
  mostRecentSuccess: null,
  success: true,
  waitingJobsInQueue: 0,
} satisfies F.FirecrawlQueueStatusData;

const makeFakeClient = (overrides: Partial<F.FirecrawlSdkClient> = {}): F.FirecrawlSdkClient => {
  const defaults: F.FirecrawlSdkClient = {
    agent: () =>
      Promise.resolve({ creditsUsed: 1, expiresAt: "2026-06-04T00:00:00Z", status: "completed", success: true }),
    batchScrape: () => Promise.resolve(batchJob),
    browser: () => Promise.resolve({ id: "browser-id", success: true }),
    browserExecute: () => Promise.resolve({ output: "ok", success: true }),
    cancelAgent: () => Promise.resolve(true),
    cancelBatchScrape: () => Promise.resolve(true),
    cancelCrawl: () => Promise.resolve(true),
    crawl: () => Promise.resolve(crawlJob),
    crawlParamsPreview: () => Promise.resolve({ limit: 1 }),
    createMonitor: () => Promise.resolve(monitor),
    deleteBrowser: () => Promise.resolve({ success: true }),
    deleteMonitor: () => Promise.resolve(true),
    getActiveCrawls: () => Promise.resolve({ crawls: [], success: true }),
    getAgentStatus: () =>
      Promise.resolve({ creditsUsed: 1, expiresAt: "2026-06-04T00:00:00Z", status: "completed", success: true }),
    getBatchScrapeErrors: () => Promise.resolve({ errors: [], robotsBlocked: [] }),
    getBatchScrapeStatus: () => Promise.resolve(batchJob),
    getConcurrency: () => Promise.resolve({ concurrency: 0, maxConcurrency: 1 }),
    getCrawlErrors: () => Promise.resolve({ errors: [], robotsBlocked: [] }),
    getCrawlStatus: () => Promise.resolve(crawlJob),
    getCreditUsage: () => Promise.resolve({ remainingCredits: 1 }),
    getCreditUsageHistorical: () => Promise.resolve({ periods: [], success: true }),
    getMonitor: () => Promise.resolve(monitor),
    getMonitorCheck: () => Promise.resolve({ ...monitorCheck, pages: [] }),
    getQueueStatus: () => Promise.resolve(queueStatus),
    getTokenUsage: () => Promise.resolve({ remainingTokens: 1 }),
    getTokenUsageHistorical: () => Promise.resolve({ periods: [], success: true }),
    interact: () => Promise.resolve({ output: "ok", success: true }),
    listBrowsers: () => Promise.resolve({ sessions: [], success: true }),
    listMonitorChecks: () => Promise.resolve([monitorCheck]),
    listMonitors: () => Promise.resolve([monitor]),
    map: () => Promise.resolve({ links: [] }),
    parse: () => Promise.resolve(document),
    runMonitor: () => Promise.resolve(monitorCheck),
    scrape: () => Promise.resolve(document),
    search: () => Promise.resolve({ web: [] }),
    startAgent: () => Promise.resolve({ id: "agent-id", success: true }),
    startBatchScrape: () =>
      Promise.resolve({ id: "batch-id", url: "https://api.firecrawl.dev/v2/batch/scrape/batch-id" }),
    startCrawl: () => Promise.resolve({ id: "crawl-id", url: "https://api.firecrawl.dev/v2/crawl/crawl-id" }),
    stopInteraction: () => Promise.resolve({ success: true }),
    updateMonitor: () => Promise.resolve(monitor),
    watcher: () => new FakeFirecrawlWatcher(),
  };

  return { ...defaults, ...overrides };
};

const assertRoundTrip = Effect.fn("assertRoundTrip")(function* <SchemaT extends S.Codec<unknown, unknown>>(
  schema: SchemaT,
  value: SchemaT["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
});

describe("@beep/firecrawl", () => {
  it.effect(
    "decodes schema defaults into Option values",
    Effect.fnUntraced(function* () {
      const payload = yield* decodeFFirecrawlScrapePayload({ url: "https://example.com" });

      expect(payload.url).toBe("https://example.com");
      assertNone(payload.options);
    })
  );

  it.effect(
    "keeps config wire shape while normalizing through the schema",
    Effect.fnUntraced(function* () {
      const config = yield* decodeFFirecrawlConfigInput({
        apiKey: "fc-test-key",
        apiUrl: "https://api.firecrawl.dev/",
        backoffFactor: 2,
        maxRetries: 3,
        timeoutMs: 1_000,
      });
      const encoded = yield* encodeFFirecrawlConfigInput(config);

      expect(config.apiUrl).toBe("https://api.firecrawl.dev");
      assertSome(config.backoffFactor, 2);
      assertSome(config.maxRetries, 3);
      assertSome(config.timeoutMs, 1_000);
      expect(encoded).toEqual({
        apiKey: "fc-test-key",
        apiUrl: "https://api.firecrawl.dev",
        backoffFactor: 2,
        maxRetries: 3,
        timeoutMs: 1_000,
      });
    })
  );

  it.effect(
    "keeps error wire shape while tightening numeric diagnostics",
    Effect.fnUntraced(function* () {
      const failure = yield* decodeFFirecrawlApiFailure({
        error: "Unauthorized",
        status: 429,
        success: false,
      });
      const encoded = yield* encodeFFirecrawlApiFailure(failure);

      assertSome(failure.status, 429);
      expect(encoded).toEqual({
        error: "Unauthorized",
        status: 429,
        success: false,
      });
      assertNone(F.FirecrawlError.fromReason("transport", { status: -1 }).status);
      assertSome(O.map(decodeWatcherEventOption({ error: "watcher error", type: "error" }), thunkTrue), true);
    })
  );

  it.effect.prop(
    "round-trips crispened schema invariants through derived arbitraries",
    [
      Arbitrary.schema(F.FirecrawlApiUrl),
      Arbitrary.schema(F.FirecrawlConfigInput),
      Arbitrary.schema(F.FirecrawlMethodName),
      Arbitrary.schema(F.FirecrawlErrorReason),
      Arbitrary.schema(F.FirecrawlCodecErrorReason),
      Arbitrary.schema(F.FirecrawlApiFailure),
      Arbitrary.schema(F.FirecrawlErrorOptions),
      Arbitrary.schema(F.FirecrawlError),
      Arbitrary.schema(F.FirecrawlFormatType),
      Arbitrary.schema(F.FirecrawlScrapeActionType),
      Arbitrary.schema(F.FirecrawlSearchSourceType),
      Arbitrary.schema(F.FirecrawlJobStatus),
      Arbitrary.schema(F.FirecrawlAgentStatus),
      Arbitrary.schema(F.FirecrawlBrowserLanguage),
      Arbitrary.schema(F.FirecrawlWatcherKind),
      Arbitrary.schema(F.FirecrawlWatcherEventType),
    ],
    Effect.fnUntraced(function* ([
      apiUrl,
      config,
      method,
      reason,
      codecReason,
      failure,
      errorOptions,
      error,
      format,
      action,
      searchSource,
      jobStatus,
      agentStatus,
      language,
      watcherKind,
      eventType,
    ]) {
      yield* assertRoundTrip(F.FirecrawlApiUrl, apiUrl);
      yield* assertRoundTrip(F.FirecrawlConfigInput, config);
      yield* assertRoundTrip(F.FirecrawlMethodName, method);
      yield* assertRoundTrip(F.FirecrawlErrorReason, reason);
      yield* assertRoundTrip(F.FirecrawlCodecErrorReason, codecReason);
      yield* assertRoundTrip(F.FirecrawlApiFailure, failure);
      yield* assertRoundTrip(F.FirecrawlErrorOptions, errorOptions);
      yield* assertRoundTrip(F.FirecrawlError, error);
      yield* assertRoundTrip(F.FirecrawlFormatType, format);
      yield* assertRoundTrip(F.FirecrawlScrapeActionType, action);
      yield* assertRoundTrip(F.FirecrawlSearchSourceType, searchSource);
      yield* assertRoundTrip(F.FirecrawlJobStatus, jobStatus);
      yield* assertRoundTrip(F.FirecrawlAgentStatus, agentStatus);
      yield* assertRoundTrip(F.FirecrawlBrowserLanguage, language);
      yield* assertRoundTrip(F.FirecrawlWatcherKind, watcherKind);
      yield* assertRoundTrip(F.FirecrawlWatcherEventType, eventType);
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "rejects malformed SDK shapes while preserving future response fields",
    Effect.fnUntraced(function* () {
      const documentWithFutureField = yield* decodeUnknownFFirecrawlDocument({
        futureField: { enabled: true },
        markdown: "ok",
      });
      const representativeSearchData = yield* decodeUnknownFFirecrawlSearchData({
        web: [
          { description: "result", url: "https://example.com/result" },
          { futureField: { enabled: true }, markdown: "document" },
        ],
      });

      expect(documentWithFutureField).toEqual({
        futureField: { enabled: true },
        markdown: "ok",
      });
      expect(representativeSearchData).toEqual({
        web: [
          { description: "result", url: "https://example.com/result" },
          { futureField: { enabled: true }, markdown: "document" },
        ],
      });
      assertNone(decodeUnknownFFirecrawlScrapeOptionsOption(42));
      assertNone(decodeUnknownFFirecrawlScrapeOptionsOption([]));
      assertNone(decodeUnknownFFirecrawlDocumentOption({ markdown: 42 }));
      assertNone(decodeUnknownFFirecrawlSearchDataOption({ web: [{ url: 42 }] }));
      assertNone(decodeUnknownFFirecrawlMonitorListDataOption([42]));
      assertNone(decodeUnknownFFirecrawlScrapeSuccessOption({ data: 42 }));
    })
  );

  it.layer(F.Firecrawl.makeLayerFromClient(makeFakeClient()), { timeout: "5 seconds" })((it) => {
    it.effect(
      "wraps SDK scrape output in a decoded success class",
      Effect.fnUntraced(function* () {
        const firecrawl = yield* F.Firecrawl;
        const response = yield* firecrawl.scrape(F.FirecrawlScrapePayload.make({ url: "https://example.com" }));

        expect(response).toBeInstanceOf(F.FirecrawlScrapeSuccess);
        expect(response.data.markdown).toBe("ok");
      })
    );

    it.effect(
      "wraps usage endpoints in decoded success classes",
      Effect.fnUntraced(function* () {
        const firecrawl = yield* F.Firecrawl;
        const response = yield* firecrawl.getQueueStatus(F.FirecrawlGetQueueStatusPayload.make({}));

        expect(response).toBeInstanceOf(F.FirecrawlGetQueueStatusSuccess);
        expect(response.data.maxConcurrency).toBe(1);
      })
    );

    it.effect(
      "decodes every fake SDK endpoint through its public service method",
      Effect.fnUntraced(function* () {
        const firecrawl = yield* F.Firecrawl;
        const monitorRequest = {
          name: "Monitor",
          schedule: { cron: "* * * * *" },
          targets: [{ type: "scrape", urls: ["https://example.com"] }],
        } satisfies F.FirecrawlCreateMonitorRequest;

        yield* Effect.all(
          [
            firecrawl.agent(F.FirecrawlAgentPayload.make({ request: { prompt: "summarize" } })),
            firecrawl.batchScrape(F.FirecrawlBatchScrapePayload.make({ urls: ["https://example.com"] })),
            firecrawl.browser(F.FirecrawlBrowserPayload.make({})),
            firecrawl.browserExecute(
              F.FirecrawlBrowserExecutePayload.make({
                request: { code: "return true" },
                sessionId: "browser-id",
              })
            ),
            firecrawl.cancelAgent(F.FirecrawlCancelAgentPayload.make({ jobId: "agent-id" })),
            firecrawl.cancelBatchScrape(F.FirecrawlCancelBatchScrapePayload.make({ jobId: "batch-id" })),
            firecrawl.cancelCrawl(F.FirecrawlCancelCrawlPayload.make({ jobId: "crawl-id" })),
            firecrawl.crawl(F.FirecrawlCrawlPayload.make({ url: "https://example.com" })),
            firecrawl.crawlParamsPreview(
              F.FirecrawlCrawlParamsPreviewPayload.make({
                prompt: "find documents",
                url: "https://example.com",
              })
            ),
            firecrawl.createMonitor(F.FirecrawlCreateMonitorPayload.make({ request: monitorRequest })),
            firecrawl.deleteBrowser(F.FirecrawlDeleteBrowserPayload.make({ sessionId: "browser-id" })),
            firecrawl.deleteMonitor(F.FirecrawlDeleteMonitorPayload.make({ monitorId: "monitor-id" })),
            firecrawl.getActiveCrawls(F.FirecrawlGetActiveCrawlsPayload.make({})),
            firecrawl.getAgentStatus(F.FirecrawlGetAgentStatusPayload.make({ jobId: "agent-id" })),
            firecrawl.getBatchScrapeErrors(F.FirecrawlGetBatchScrapeErrorsPayload.make({ jobId: "batch-id" })),
            firecrawl.getBatchScrapeStatus(F.FirecrawlGetBatchScrapeStatusPayload.make({ jobId: "batch-id" })),
            firecrawl.getConcurrency(F.FirecrawlGetConcurrencyPayload.make({})),
            firecrawl.getCrawlErrors(F.FirecrawlGetCrawlErrorsPayload.make({ crawlId: "crawl-id" })),
            firecrawl.getCrawlStatus(F.FirecrawlGetCrawlStatusPayload.make({ jobId: "crawl-id" })),
            firecrawl.getCreditUsage(F.FirecrawlGetCreditUsagePayload.make({})),
            firecrawl.getCreditUsageHistorical(F.FirecrawlGetCreditUsageHistoricalPayload.make({})),
            firecrawl.getMonitor(F.FirecrawlGetMonitorPayload.make({ monitorId: "monitor-id" })),
            firecrawl.getMonitorCheck(
              F.FirecrawlGetMonitorCheckPayload.make({
                checkId: "check-id",
                monitorId: "monitor-id",
              })
            ),
            firecrawl.getQueueStatus(F.FirecrawlGetQueueStatusPayload.make({})),
            firecrawl.getTokenUsage(F.FirecrawlGetTokenUsagePayload.make({})),
            firecrawl.getTokenUsageHistorical(F.FirecrawlGetTokenUsageHistoricalPayload.make({})),
            firecrawl.interact(
              F.FirecrawlInteractPayload.make({
                args: { code: "return true" },
                jobId: "interaction-id",
              })
            ),
            firecrawl.listBrowsers(F.FirecrawlListBrowsersPayload.make({})),
            firecrawl.listMonitorChecks(
              F.FirecrawlListMonitorChecksPayload.make({
                monitorId: "monitor-id",
              })
            ),
            firecrawl.listMonitors(F.FirecrawlListMonitorsPayload.make({})),
            firecrawl.map(F.FirecrawlMapPayload.make({ url: "https://example.com" })),
            firecrawl.parse(
              F.FirecrawlParsePayload.make({
                file: { data: "document", filename: "document.txt" },
              })
            ),
            firecrawl.runMonitor(F.FirecrawlRunMonitorPayload.make({ monitorId: "monitor-id" })),
            firecrawl.scrape(F.FirecrawlScrapePayload.make({ url: "https://example.com" })),
            firecrawl.search(F.FirecrawlSearchPayload.make({ query: "effect" })),
            firecrawl.startAgent(F.FirecrawlStartAgentPayload.make({ request: { prompt: "summarize" } })),
            firecrawl.startBatchScrape(
              F.FirecrawlStartBatchScrapePayload.make({
                urls: ["https://example.com"],
              })
            ),
            firecrawl.startCrawl(F.FirecrawlStartCrawlPayload.make({ url: "https://example.com" })),
            firecrawl.stopInteraction(F.FirecrawlStopInteractionPayload.make({ jobId: "interaction-id" })),
            firecrawl.updateMonitor(
              F.FirecrawlUpdateMonitorPayload.make({
                monitorId: "monitor-id",
                request: { name: "Updated Monitor" },
              })
            ),
          ],
          { concurrency: 1 }
        );
      })
    );
  });

  it.layer(
    F.Firecrawl.makeLayerFromClient(
      makeFakeClient({
        scrape: () => Promise.reject({ name: "SdkError", statusCode: 429 }),
      })
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "translates SDK throws into sanitized FirecrawlError values",
      Effect.fnUntraced(function* () {
        const firecrawl = yield* F.Firecrawl;
        const exit = yield* Effect.exit(
          firecrawl.scrape(F.FirecrawlScrapePayload.make({ url: "https://example.com" }))
        );

        const error = Exit.match(exit, { onFailure: Cause.findErrorOption, onSuccess: O.none });
        assertSome(
          O.map(error, (error) => {
            assertInstanceOf(error, F.FirecrawlError);
            assertSome(error.status, 429);
            return error.reason;
          }),
          "sdk thrown"
        );
      })
    );
  });

  it.layer(
    F.Firecrawl.makeLayerFromClient(
      makeFakeClient({
        getQueueStatus: () =>
          Promise.resolve({
            ...queueStatus,
            maxConcurrency: Number.POSITIVE_INFINITY,
          }),
      })
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "maps malformed SDK responses to response-decoding errors",
      Effect.fnUntraced(function* () {
        const firecrawl = yield* F.Firecrawl;
        const exit = yield* Effect.exit(firecrawl.getQueueStatus(F.FirecrawlGetQueueStatusPayload.make({})));

        const error = Exit.match(exit, { onFailure: Cause.findErrorOption, onSuccess: O.none });
        assertSome(
          O.map(error, (error) => {
            assertInstanceOf(error, F.FirecrawlError);
            assertSome(error.method, "getQueueStatus");
            return error.reason;
          }),
          "response decoding"
        );
      })
    );
  });

  const watcher = new FakeFirecrawlWatcher([
    { eventName: "document", payload: document },
    {
      eventName: "done",
      payload: {
        completed: 1,
        data: [document],
        id: "crawl-id",
        status: "completed",
        total: 1,
      },
    },
  ]);

  it.layer(F.Firecrawl.makeLayerFromClient(makeFakeClient({ watcher: () => watcher })), { timeout: "5 seconds" })(
    (it) => {
      it.effect(
        "streams watcher events and closes the SDK watcher after done",
        Effect.fnUntraced(function* () {
          const firecrawl = yield* F.Firecrawl;
          const events = yield* firecrawl
            .watcher(F.FirecrawlWatcherPayload.make({ jobId: "crawl-id" }))
            .pipe(Stream.runCollect);
          const values = A.fromIterable(events);

          expect(watcher.started).toBe(true);
          expect(watcher.closed).toBe(true);
          expect(A.map(values, (event) => event.type)).toEqual(["document", "done"]);
        })
      );
    }
  );

  const invalidDoneWatcher = new FakeFirecrawlWatcher([{ eventName: "done", payload: { data: { markdown: "bad" } } }]);

  it.layer(F.Firecrawl.makeLayerFromClient(makeFakeClient({ watcher: () => invalidDoneWatcher })), {
    timeout: "5 seconds",
  })((it) => {
    it.effect(
      "fails watcher streams when terminal event payloads cannot decode",
      Effect.fnUntraced(function* () {
        const firecrawl = yield* F.Firecrawl;
        const exit = yield* Effect.exit(
          firecrawl.watcher(F.FirecrawlWatcherPayload.make({ jobId: "crawl-id" })).pipe(Stream.runCollect)
        );

        const error = Exit.match(exit, { onFailure: Cause.findErrorOption, onSuccess: O.none });
        expect(invalidDoneWatcher.closed).toBe(true);
        assertSome(
          O.map(error, (error) => {
            assertInstanceOf(error, F.FirecrawlError);
            return error.reason;
          }),
          "response decoding"
        );
      })
    );
  });
});
