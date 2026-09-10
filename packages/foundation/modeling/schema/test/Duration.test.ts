import { fcRuns } from "@beep/fc-runs";
import * as Duration from "@beep/schema/Duration";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as D from "effect/Duration";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownDurationFromInputSync = S.decodeUnknownSync(Duration.FromInput);
const decodeUnknownDurationInputSync = S.decodeUnknownSync(Duration.Input);
const encodeDurationFromInputSync = S.encodeSync(Duration.FromInput);
const isDurationSchema = S.is(Duration.Schema);

describe("DurationInput", () => {
  it("accepts additive duration objects with populated fields", () => {
    const decoded = decodeUnknownDurationInputSync({
      minutes: 1,
      seconds: 30,
    });

    expect(decoded).toBeInstanceOf(Duration.Object);
    expect(decoded).toEqual(Duration.Object.make({ minutes: 1, seconds: 30 }));
  });

  it("rejects empty duration objects", () => {
    expect(() => decodeUnknownDurationInputSync({})).toThrow(
      "Duration object must include at least one populated unit field."
    );
  });
});

describe("Duration namespace module", () => {
  it("exposes concise role names for the canonical concept import", () => {
    const input = decodeUnknownDurationInputSync({ seconds: 2 });

    expect(input).toEqual(Duration.Object.make({ seconds: 2 }));
    expect(D.toMillis(decodeUnknownDurationFromInputSync(input))).toBe(2_000);
  });
});

describe("DurationFromInput", () => {
  it("passes through existing Duration values", () => {
    const input = D.seconds(2);

    expect(decodeUnknownDurationFromInputSync(input)).toBe(input);
  });

  it("decodes non-negative integers as milliseconds", () => {
    expect(D.toMillis(decodeUnknownDurationFromInputSync(1_500))).toBe(1_500);
  });

  it("decodes non-negative bigints as nanoseconds", () => {
    expect(O.getOrUndefined(D.toNanos(decodeUnknownDurationFromInputSync(1_500_000n)))).toBe(1_500_000n);
  });

  it("decodes hrtime tuples into high-resolution durations", () => {
    expect(O.getOrUndefined(D.toNanos(decodeUnknownDurationFromInputSync([2, 3])))).toBe(2_000_000_003n);
  });

  it("decodes duration strings", () => {
    expect(D.toMillis(decodeUnknownDurationFromInputSync("3 minutes"))).toBe(180_000);
  });

  it("decodes additive duration objects", () => {
    const decoded = decodeUnknownDurationFromInputSync(
      Duration.Object.make({
        minutes: 1,
        seconds: 30,
        microseconds: 4,
        nanoseconds: 5,
      })
    );

    expect(O.getOrUndefined(D.toNanos(decoded))).toBe(90_000_004_005n);
  });

  it("preserves DurationInput validation failures", () => {
    expect(() => decodeUnknownDurationFromInputSync({})).toThrow(
      "Duration object must include at least one populated unit field."
    );
  });

  it("forbids encoding normalized Duration values back to the source boundary", () => {
    expect(() => encodeDurationFromInputSync(D.seconds(1))).toThrow(
      "Encoding DurationFromInput results back to the original duration input is not supported"
    );
  });

  it("derives Duration values from the schema arbitrary that re-validate as durations", () => {
    const arbitrary = Arbitrary.schema(Duration.FromInput);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([value]) => D.isDuration(value) && isDurationSchema(value),
          fcRuns(50)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
