import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ChosenMatter, TimerInterval } from "@/PracticeMod.values";

describe("TimerInterval", () => {
  it.effect("preserves a chosen matter and explicit interval in the persisted row", () =>
    Effect.gen(function* () {
      const interval = TimerInterval.make({
        schemaVersion: "practice-timer/v1",
        sessionId: "s-1",
        matter: ChosenMatter.makeOption({ reference: "12345.10008US01", docketKey: null, client: null }),
        startedAt: DateTime.makeUnsafe(0),
        stoppedAt: DateTime.makeUnsafe(60_000),
      });
      const encoded = yield* S.encodeEffect(TimerInterval)(interval);
      expect(encoded).toEqual({
        schemaVersion: "practice-timer/v1",
        sessionId: "s-1",
        matter: { reference: "12345.10008US01", docketKey: null, client: null },
        startedAt: "1970-01-01T00:00:00.000Z",
        stoppedAt: "1970-01-01T00:01:00.000Z",
      });
      const decoded = yield* S.decodeEffect(TimerInterval)(encoded);
      expect(S.toEquivalence(TimerInterval)(decoded, interval)).toBe(true);
    })
  );
});
