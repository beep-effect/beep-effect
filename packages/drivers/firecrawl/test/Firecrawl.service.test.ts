import * as F from "@beep/firecrawl";
import { describe, expect, it, layer } from "@effect/vitest";
import { Cause, Effect, Exit, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

type FakeWatcherEventName = "document" | "done" | "error" | "snapshot";
type FakeWatcherListener = (payload: unknown) => void;
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

  start(): Promise<void> {
    this.started = true;
    for (const emission of this.emissions) {
      for (const listener of this.listeners[emission.eventName]) {
        listener(emission.payload);
      }
    }
    return Promise.resolve();
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

describe("@beep/firecrawl", () => {
  it.effect(
    "decodes schema defaults into Option values",
    Effect.fnUntraced(function* () {
      const payload = yield* S.decodeUnknownEffect(F.FirecrawlScrapePayload)({ url: "https://example.com" });

      expect(payload.url).toBe("https://example.com");
      expect(O.isNone(payload.options)).toBe(true);
    })
  );

  layer(F.Firecrawl.makeLayerFromClient(makeFakeClient()))((it) => {
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
  });

  layer(
    F.Firecrawl.makeLayerFromClient(
      makeFakeClient({
        scrape: () => Promise.reject({ name: "SdkError", status: 429 }),
      })
    )
  )((it) => {
    it.effect(
      "translates SDK throws into sanitized FirecrawlError values",
      Effect.fnUntraced(function* () {
        const firecrawl = yield* F.Firecrawl;
        const exit = yield* Effect.exit(
          firecrawl.scrape(F.FirecrawlScrapePayload.make({ url: "https://example.com" }))
        );

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(F.FirecrawlError);
            expect(error.value.reason).toBe("sdk thrown");
            expect(error.value.status).toEqual(O.some(429));
          }
        }
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

  layer(F.Firecrawl.makeLayerFromClient(makeFakeClient({ watcher: () => watcher })))((it) => {
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
  });
});
