import { fcRuns } from "@beep/fc-runs";
import { Port, PortFromString } from "@beep/schema/Port";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodePort = S.decodeEffect(Port);
const decodeUnknownPort = S.decodeUnknownEffect(Port);
const decodeUnknownPortFromString = S.decodeUnknownEffect(PortFromString);
const decodeUnknownPortEffect = S.decodeUnknownEffect(Port);
const decodeUnknownPortFromStringEffect = S.decodeUnknownEffect(PortFromString);
const encodePortFromString = S.encodeEffect(PortFromString);
const isPort2 = S.is(Port);

const portMinimum = 1;
const portMaximum = 65_535;
const PortArbitrary = Arbitrary.schema(Port);

describe("Port", () => {
  it.effect(
    "accepts inclusive transport port boundaries",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownPort(portMinimum)).toBe(portMinimum);
      expect(yield* decodeUnknownPort(443)).toBe(443);
      expect(yield* decodeUnknownPort(portMaximum)).toBe(portMaximum);
    })
  );

  it.effect(
    "rejects reserved port zero and values above the 16-bit port space",
    Effect.fnUntraced(function* () {
      const zero = yield* Effect.exit(decodeUnknownPort(0));
      const aboveMaximum = yield* Effect.exit(decodeUnknownPort(portMaximum + 1));

      expect(Exit.isFailure(zero)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );

  it.effect(
    "rejects non-integer and non-number inputs",
    Effect.fnUntraced(function* () {
      const fractional = yield* Effect.exit(decodeUnknownPort(1.5));
      const string = yield* Effect.exit(decodeUnknownPort("443"));

      expect(Exit.isFailure(fractional)).toBe(true);
      expect(Exit.isFailure(string)).toBe(true);
    })
  );

  it.effect(
    "uses the annotated range error message",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownPortEffect(0));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Expected a valid transport port number between 1 and 65535");
      }
    })
  );

  it.effect.prop(
    "derives arbitrary values inside the port range",
    [PortArbitrary],
    Effect.fnUntraced(function* ([value]) {
      expect(isPort2(value)).toBe(true);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(portMinimum);
      expect(value).toBeLessThanOrEqual(portMaximum);

      return true;
    }),
    { arbitrary: fcRuns(100) }
  );
});

describe("PortFromString", () => {
  it.effect(
    "decodes decimal strings into branded transport ports",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownPortFromString("1")).toBe(portMinimum);
      expect(yield* decodeUnknownPortFromString("443")).toBe(443);
      expect(yield* decodeUnknownPortFromString("080")).toBe(80);
      expect(yield* decodeUnknownPortFromString("65535")).toBe(portMaximum);
    })
  );

  it.effect(
    "encodes branded transport ports back to decimal strings",
    Effect.fnUntraced(function* () {
      const value = yield* decodePort(443);

      expect(yield* encodePortFromString(value)).toBe("443");
    })
  );

  it.effect(
    "rejects malformed and out-of-range port strings",
    Effect.fnUntraced(function* () {
      const empty = yield* Effect.exit(decodeUnknownPortFromString(""));
      const whitespace = yield* Effect.exit(decodeUnknownPortFromString(" 443"));
      const hexadecimal = yield* Effect.exit(decodeUnknownPortFromString("0x50"));
      const fractional = yield* Effect.exit(decodeUnknownPortFromString("1.5"));
      const zero = yield* Effect.exit(decodeUnknownPortFromString("0"));
      const aboveMaximum = yield* Effect.exit(decodeUnknownPortFromString("65536"));

      expect(Exit.isFailure(empty)).toBe(true);
      expect(Exit.isFailure(whitespace)).toBe(true);
      expect(Exit.isFailure(hexadecimal)).toBe(true);
      expect(Exit.isFailure(fractional)).toBe(true);
      expect(Exit.isFailure(zero)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );

  it.effect(
    "uses the annotated decimal-string error message",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(decodeUnknownPortFromStringEffect("0x50"));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("Port strings must contain only ASCII decimal digits");
      }
    })
  );
});
