import { AllowedDevOrigin } from "@beep/repo-configs/next/models/AllowedDevOrigin.schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";

const decodeAllowedDevOriginResult = S.decodeResult(AllowedDevOrigin);
const encodeAllowedDevOriginResult = S.encodeResult(AllowedDevOrigin);

const expectRoundTrip = (value: AllowedDevOrigin) => {
  const encoded = Result.getOrThrow(encodeAllowedDevOriginResult(value));
  const decoded = Result.getOrThrow(decodeAllowedDevOriginResult(encoded));

  assertTrue(Equal.equals(decoded, value));
};

describe("AllowedDevOrigin", () => {
  it("accepts documented exact and wildcard host entries", () => {
    expect(AllowedDevOrigin.decodeUnknownSync("local-origin.dev")).toBe("local-origin.dev");
    expect(AllowedDevOrigin.decodeUnknownSync("*.local-origin.dev")).toBe("*.local-origin.dev");
    expect(AllowedDevOrigin.decodeUnknownSync(" oip-web.beep.localhost ")).toBe("oip-web.beep.localhost");
  });

  it("rejects URL-like values and invalid wildcard domains", () => {
    assertNone(AllowedDevOrigin.decodeUnknownOption(""));
    assertNone(AllowedDevOrigin.decodeUnknownOption("https://local-origin.dev"));
    assertNone(AllowedDevOrigin.decodeUnknownOption("local-origin.dev:3000"));
    assertNone(AllowedDevOrigin.decodeUnknownOption("local-origin.dev/path"));
    assertNone(AllowedDevOrigin.decodeUnknownOption("*.*.local-origin.dev"));
    assertNone(AllowedDevOrigin.decodeUnknownOption("*."));
  });

  it.prop(
    "AllowedDevOrigin: round-trips schema-derived allowed origins",
    [Arbitrary.schema(AllowedDevOrigin)],
    (values) => {
      expectRoundTrip(...values);
    },
    { arbitrary: fcRuns(25) }
  );
});
