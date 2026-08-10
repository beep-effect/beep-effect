import { fcRuns } from "@beep/fc-runs";
import { Port, PortFromString } from "@beep/schema/Port";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const portMinimum = 1;
const portMaximum = 65_535;
const PortArbitrary = S.toArbitrary(Port)(fc);

describe("Port", () => {
  const decode = S.decodeUnknownEffect(Port);
  const decodeSync = S.decodeUnknownSync(Port);

  it.effect(
    "accepts inclusive transport port boundaries",
    Effect.fnUntraced(function* () {
      expect(yield* decode(portMinimum)).toBe(portMinimum);
      expect(yield* decode(443)).toBe(443);
      expect(yield* decode(portMaximum)).toBe(portMaximum);
    })
  );

  it.effect(
    "rejects reserved port zero and values above the 16-bit port space",
    Effect.fnUntraced(function* () {
      const zero = yield* Effect.exit(decode(0));
      const aboveMaximum = yield* Effect.exit(decode(portMaximum + 1));

      expect(Exit.isFailure(zero)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );

  it.effect(
    "rejects non-integer and non-number inputs",
    Effect.fnUntraced(function* () {
      const fractional = yield* Effect.exit(decode(1.5));
      const string = yield* Effect.exit(decode("443"));

      expect(Exit.isFailure(fractional)).toBe(true);
      expect(Exit.isFailure(string)).toBe(true);
    })
  );

  it("uses the annotated range error message", () => {
    expect(() => decodeSync(0)).toThrow("Expected a valid transport port number between 1 and 65535");
  });

  it("derives arbitrary values inside the port range", () => {
    const isPort = S.is(Port);

    fc.assert(
      fc.property(PortArbitrary, (value) => {
        expect(isPort(value)).toBe(true);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(portMinimum);
        expect(value).toBeLessThanOrEqual(portMaximum);
      }),
      fcRuns(100)
    );
  });
});

describe("PortFromString", () => {
  const decode = S.decodeUnknownEffect(PortFromString);
  const decodeSync = S.decodeUnknownSync(PortFromString);
  const encode = S.encodeEffect(PortFromString);

  it.effect(
    "decodes decimal strings into branded transport ports",
    Effect.fnUntraced(function* () {
      expect(yield* decode("1")).toBe(portMinimum);
      expect(yield* decode("443")).toBe(443);
      expect(yield* decode("080")).toBe(80);
      expect(yield* decode("65535")).toBe(portMaximum);
    })
  );

  it.effect(
    "encodes branded transport ports back to decimal strings",
    Effect.fnUntraced(function* () {
      const value = yield* S.decodeEffect(Port)(443);

      expect(yield* encode(value)).toBe("443");
    })
  );

  it.effect(
    "rejects malformed and out-of-range port strings",
    Effect.fnUntraced(function* () {
      const empty = yield* Effect.exit(decode(""));
      const whitespace = yield* Effect.exit(decode(" 443"));
      const hexadecimal = yield* Effect.exit(decode("0x50"));
      const fractional = yield* Effect.exit(decode("1.5"));
      const zero = yield* Effect.exit(decode("0"));
      const aboveMaximum = yield* Effect.exit(decode("65536"));

      expect(Exit.isFailure(empty)).toBe(true);
      expect(Exit.isFailure(whitespace)).toBe(true);
      expect(Exit.isFailure(hexadecimal)).toBe(true);
      expect(Exit.isFailure(fractional)).toBe(true);
      expect(Exit.isFailure(zero)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );

  it("uses the annotated decimal-string error message", () => {
    expect(() => decodeSync("0x50")).toThrow("Port strings must contain only ASCII decimal digits");
  });
});
