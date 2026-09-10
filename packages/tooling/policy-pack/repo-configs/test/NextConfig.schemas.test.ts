import { AllowedDevOrigin } from "@beep/repo-configs/next/models/AllowedDevOrigin.schema";
import { fcRuns } from "@beep/test-utils";
import { Effect, Result } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { describe, expect, it } from "vitest";

const decodeAllowedDevOriginResult = S.decodeResult(AllowedDevOrigin);
const encodeAllowedDevOriginResult = S.encodeResult(AllowedDevOrigin);

const expectRoundTrip = (value: AllowedDevOrigin) => {
  const encoded = Result.getOrThrow(encodeAllowedDevOriginResult(value));
  const decoded = Result.getOrThrow(decodeAllowedDevOriginResult(encoded));

  expect(Equal.equals(decoded, value)).toBe(true);
};

describe("AllowedDevOrigin", () => {
  it("accepts documented exact and wildcard host entries", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(AllowedDevOrigin.decodeUnknownSync("local-origin.dev")).toBe("local-origin.dev");
        expect(AllowedDevOrigin.decodeUnknownSync("*.local-origin.dev")).toBe("*.local-origin.dev");
        expect(AllowedDevOrigin.decodeUnknownSync(" oip-web.beep.localhost ")).toBe("oip-web.beep.localhost");
      })
    ));

  it("rejects URL-like values and invalid wildcard domains", () => {
    expect(O.isNone(AllowedDevOrigin.decodeUnknownOption(""))).toBe(true);
    expect(O.isNone(AllowedDevOrigin.decodeUnknownOption("https://local-origin.dev"))).toBe(true);
    expect(O.isNone(AllowedDevOrigin.decodeUnknownOption("local-origin.dev:3000"))).toBe(true);
    expect(O.isNone(AllowedDevOrigin.decodeUnknownOption("local-origin.dev/path"))).toBe(true);
    expect(O.isNone(AllowedDevOrigin.decodeUnknownOption("*.*.local-origin.dev"))).toBe(true);
    expect(O.isNone(AllowedDevOrigin.decodeUnknownOption("*."))).toBe(true);
  });

  it("round-trips schema-derived allowed origins", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(AllowedDevOrigin)]),
          (values) => {
            expectRoundTrip(...values);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });
});
