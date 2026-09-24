import { fcRuns } from "@beep/fc-runs";
import * as Duration from "@beep/schema/Duration";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as D from "effect/Duration";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownDurationFromInputEffect = S.decodeUnknownEffect(Duration.FromInput);
const decodeUnknownDurationInputEffect = S.decodeUnknownEffect(Duration.Input);
const encodeDurationFromInputEffect = S.encodeEffect(Duration.FromInput);
const isDurationSchema = S.is(Duration.Schema);

describe("DurationInput", () => {
  it.effect(
    "accepts additive duration objects with populated fields",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeUnknownDurationInputEffect({
        minutes: 1,
        seconds: 30,
      });

      expect(decoded).toBeInstanceOf(Duration.Object);
      expect(decoded).toEqual(Duration.Object.make({ minutes: 1, seconds: 30 }));
    })
  );

  it.effect(
    "rejects empty duration objects",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownDurationInputEffect({}));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Duration object must include at least one populated unit field.");
      }
    })
  );
});

describe("Duration namespace module", () => {
  it.effect(
    "exposes concise role names for the canonical concept import",
    Effect.fnUntraced(function* () {
      const input = yield* decodeUnknownDurationInputEffect({ seconds: 2 });

      expect(input).toEqual(Duration.Object.make({ seconds: 2 }));
      expect(D.toMillis(yield* decodeUnknownDurationFromInputEffect(input))).toBe(2_000);
    })
  );
});

describe("DurationFromInput", () => {
  it.effect(
    "passes through existing Duration values",
    Effect.fnUntraced(function* () {
      const input = D.seconds(2);

      expect(yield* decodeUnknownDurationFromInputEffect(input)).toBe(input);
    })
  );

  it.effect(
    "decodes non-negative integers as milliseconds",
    Effect.fnUntraced(function* () {
      expect(D.toMillis(yield* decodeUnknownDurationFromInputEffect(1_500))).toBe(1_500);
    })
  );

  it.effect(
    "decodes non-negative bigints as nanoseconds",
    Effect.fnUntraced(function* () {
      expect(O.getOrUndefined(D.toNanos(yield* decodeUnknownDurationFromInputEffect(1_500_000n)))).toBe(1_500_000n);
    })
  );

  it.effect(
    "decodes hrtime tuples into high-resolution durations",
    Effect.fnUntraced(function* () {
      expect(O.getOrUndefined(D.toNanos(yield* decodeUnknownDurationFromInputEffect([2, 3])))).toBe(2_000_000_003n);
    })
  );

  it.effect(
    "decodes duration strings",
    Effect.fnUntraced(function* () {
      expect(D.toMillis(yield* decodeUnknownDurationFromInputEffect("3 minutes"))).toBe(180_000);
    })
  );

  it.effect(
    "decodes additive duration objects",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeUnknownDurationFromInputEffect(
        Duration.Object.make({
          minutes: 1,
          seconds: 30,
          microseconds: 4,
          nanoseconds: 5,
        })
      );

      expect(O.getOrUndefined(D.toNanos(decoded))).toBe(90_000_004_005n);
    })
  );

  it.effect(
    "preserves DurationInput validation failures",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(decodeUnknownDurationFromInputEffect({}));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("Duration object must include at least one populated unit field.");
      }
    })
  );

  it.effect(
    "forbids encoding normalized Duration values back to the source boundary",
    Effect.fnUntraced(function* () {
      const failure3 = yield* Effect.result(encodeDurationFromInputEffect(D.seconds(1)));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain(
          "Encoding DurationFromInput results back to the original duration input is not supported"
        );
      }
    })
  );

  {
    const arbitrary = Arbitrary.schema(Duration.FromInput);
    it.effect.prop(
      "derives Duration values from the schema arbitrary that re-validate as durations",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        return D.isDuration(value) && isDurationSchema(value);
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});
