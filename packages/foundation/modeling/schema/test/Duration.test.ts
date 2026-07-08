import * as Duration from "@beep/schema/Duration";
import { describe, expect, it } from "@effect/vitest";
import * as D from "effect/Duration";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("DurationInput", () => {
  const decode = S.decodeUnknownSync(Duration.Input);

  it("accepts additive duration objects with populated fields", () => {
    const decoded = decode({
      minutes: 1,
      seconds: 30,
    });

    expect(decoded).toBeInstanceOf(Duration.Object);
    expect(decoded).toEqual(Duration.Object.make({ minutes: 1, seconds: 30 }));
  });

  it("rejects empty duration objects", () => {
    expect(() => decode({})).toThrow("Duration object must include at least one populated unit field.");
  });
});

describe("Duration namespace module", () => {
  it("exposes concise role names for the canonical concept import", () => {
    const decodeInput = S.decodeUnknownSync(Duration.Input);
    const decodeDuration = S.decodeUnknownSync(Duration.FromInput);

    const input = decodeInput({ seconds: 2 });

    expect(input).toEqual(Duration.Object.make({ seconds: 2 }));
    expect(D.toMillis(decodeDuration(input))).toBe(2_000);
  });
});

describe("DurationFromInput", () => {
  const decode = S.decodeUnknownSync(Duration.FromInput);
  const encode = S.encodeSync(Duration.FromInput);

  it("passes through existing Duration values", () => {
    const input = D.seconds(2);

    expect(decode(input)).toBe(input);
  });

  it("decodes non-negative integers as milliseconds", () => {
    expect(D.toMillis(decode(1_500))).toBe(1_500);
  });

  it("decodes non-negative bigints as nanoseconds", () => {
    expect(O.getOrUndefined(D.toNanos(decode(1_500_000n)))).toBe(1_500_000n);
  });

  it("decodes hrtime tuples into high-resolution durations", () => {
    expect(O.getOrUndefined(D.toNanos(decode([2, 3])))).toBe(2_000_000_003n);
  });

  it("decodes duration strings", () => {
    expect(D.toMillis(decode("3 minutes"))).toBe(180_000);
  });

  it("decodes additive duration objects", () => {
    const decoded = decode(
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
    expect(() => decode({})).toThrow("Duration object must include at least one populated unit field.");
  });

  it("forbids encoding normalized Duration values back to the source boundary", () => {
    expect(() => encode(D.seconds(1))).toThrow(
      "Encoding DurationFromInput results back to the original duration input is not supported"
    );
  });

  it("derives Duration values from the schema arbitrary that re-validate as durations", () => {
    const arbitrary = S.toArbitrary(Duration.FromInput);
    const isDuration = S.is(Duration.Schema);

    fc.assert(
      fc.property(arbitrary, (value) => D.isDuration(value) && isDuration(value)),
      { numRuns: 50 }
    );
  });
});
