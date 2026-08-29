import * as F from "@beep/firecrawl";
import { Str } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";

const apiKey = pipe(Bun.env.FIRECRAWL_API_KEY, O.fromUndefinedOr, O.filter(Str.isNonEmpty));

pipe(
  apiKey,
  O.match({
    onNone: () =>
      describe("@beep/firecrawl live integration (FIRECRAWL_API_KEY)", () => {
        it("skips live API calls when FIRECRAWL_API_KEY is absent", () => {
          expect(O.isNone(apiKey)).toBe(true);
        });
      }),
    onSome: () =>
      describe.concurrent("@beep/firecrawl live integration", () => {
        layer(F.Firecrawl.layer, { timeout: "30 seconds" })((it) => {
          it.effect(
            "reads queue status through the live Firecrawl API",
            Effect.fnUntraced(function* () {
              const firecrawl = yield* F.Firecrawl;
              const response = yield* firecrawl.getQueueStatus(F.FirecrawlGetQueueStatusPayload.make({}));

              expect(response).toBeInstanceOf(F.FirecrawlGetQueueStatusSuccess);
              expect(response.data).toBeDefined();
            })
          );

          it.effect(
            "reads credit usage through the live Firecrawl API",
            Effect.fnUntraced(function* () {
              const firecrawl = yield* F.Firecrawl;
              const response = yield* firecrawl.getCreditUsage(F.FirecrawlGetCreditUsagePayload.make({}));

              expect(response).toBeInstanceOf(F.FirecrawlGetCreditUsageSuccess);
              expect(response.data).toBeDefined();
            })
          );
        });
      }),
  })
);
