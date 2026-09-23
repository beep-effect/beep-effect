import { Timezone } from "@beep/schema/Timezone";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeTimezoneEffect = S.decodeEffect(Timezone);
const decodeUnknownTimezoneEffect = S.decodeUnknownEffect(Timezone);

describe("Timezone", () => {
  it.effect(
    "decodes IANA timezone literals from generated @beep/data values",
    Effect.fnUntraced(function* () {
      expect(yield* decodeTimezoneEffect("UTC")).toBe("UTC");
      expect(yield* decodeTimezoneEffect("America/New_York")).toBe("America/New_York");
      expect(Timezone.Options).toContain("Europe/London");
    })
  );

  it.effect(
    "rejects unknown timezone names",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownTimezoneEffect("Mars/Base"));
      expect(Result.isFailure(failure1)).toBe(true);
    })
  );
});
