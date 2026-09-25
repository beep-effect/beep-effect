import { Timezone } from "@beep/schema/Timezone";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Exit from "effect/Exit";
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
      const failure1 = yield* Effect.exit(decodeUnknownTimezoneEffect("Mars/Base"));
      pipe(failure1, Exit.hasFails, assertTrue);
    })
  );
});
