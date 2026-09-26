import * as F from "@beep/firecrawl";
import { Str } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";

// Skip when the key is absent, blank, or an unresolved `op://` reference (present
// when secrets are not resolved, e.g. no local `op` session).
const apiKey = pipe(
  Bun.env.FIRECRAWL_API_KEY,
  O.fromUndefinedOr,
  O.filter((value) => Str.isNonEmpty(value) && !Str.startsWith("op://")(value))
);

pipe(
  apiKey,
  O.match({
    onNone: () =>
      describe("@beep/firecrawl live integration (FIRECRAWL_API_KEY)", () => {
        it("skips live API calls when FIRECRAWL_API_KEY is absent", () => {
          assertNone(apiKey);
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
