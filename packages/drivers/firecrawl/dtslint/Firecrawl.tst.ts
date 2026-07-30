import { Firecrawl, FirecrawlConfigInput, FirecrawlScrapePayload, FirecrawlWatcherPayload } from "@beep/firecrawl";
import { Redacted } from "effect";
import { describe, expect, it } from "tstyche";
import type { FirecrawlError, FirecrawlScrapeSuccess, FirecrawlShape, FirecrawlWatcherEvent } from "@beep/firecrawl";
import type { Effect, Stream } from "effect";

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
});
