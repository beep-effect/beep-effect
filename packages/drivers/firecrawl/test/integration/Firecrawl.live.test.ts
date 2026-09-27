import * as F from "@beep/firecrawl";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// Skip when the key is absent, blank, or an unresolved `op://` reference (present
// when secrets are not resolved, e.g. no local `op` session).
const usableApiKey = (value: string | undefined): O.Option<string> =>
  pipe(
    value,
    O.fromUndefinedOr,
    O.map(Str.trim),
    O.filter((value) => Str.isNonEmpty(value) && !Str.startsWith("op://")(value))
  );

const apiKey = usableApiKey(Bun.env.FIRECRAWL_API_KEY);

describe("Firecrawl live credential gate", () => {
  it("rejects absent, blank and unresolved synthetic references", () => {
    assertNone(usableApiKey(undefined));
    assertNone(usableApiKey(""));
    assertNone(usableApiKey(" "));
    assertNone(usableApiKey("\t\n"));
    assertNone(usableApiKey("op://synthetic/item/key"));
    assertNone(usableApiKey(" \top://synthetic/item/key\n "));
  });

  it.prop(
    "preserves normalized synthetic configured keys",
    [Arbitrary.schema(S.String)],
    ([suffix]) => {
      const key = `synthetic-${suffix}`;
      assertSome(usableApiKey(` \t${key}\n `), Str.trim(key));
    },
    { arbitrary: fcRuns(25) }
  );
});

pipe(
  apiKey,
  O.match({
    onNone: () =>
      describe("@beep/firecrawl live integration (FIRECRAWL_API_KEY)", () => {
        it.skip("skips live API calls when FIRECRAWL_API_KEY is absent", () => {
          assertNone(apiKey);
        });
      }),
    onSome: () =>
      describe.concurrent("@beep/firecrawl live integration", () => {
        it.layer(F.Firecrawl.layer, { timeout: "30 seconds" })((it) => {
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
