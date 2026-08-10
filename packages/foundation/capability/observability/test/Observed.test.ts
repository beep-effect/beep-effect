import { ObservedCause, ObservedExit } from "@beep/observability";
import { TaggedErrorClass } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { Cause, Exit } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

class TestObservedError extends TaggedErrorClass<TestObservedError>()("TestObservedError", {
  message: S.String,
}) {}

describe("Observed", () => {
  it("round-trips a failed Cause through the observed schema", () => {
    const cause = Cause.fail(TestObservedError.make({ message: "boom" }));
    const encoded = S.encodeSync(S.toCodecJson(ObservedCause))(cause);
    const encodedReasons = S.decodeUnknownSync(
      S.Array(
        S.Struct({
          _tag: S.String,
        })
      )
    )(encoded);

    expect(encodedReasons).toHaveLength(1);
    expect(encodedReasons[0]?._tag).toBe("Fail");

    const decoded = S.decodeSync(S.toCodecJson(ObservedCause))(encoded);
    const firstReason = decoded.reasons[0];

    expect(firstReason?._tag).toBe("Fail");
    expect(firstReason?._tag === "Fail" ? firstReason.error.message : "").toBe("boom");
  });

  it("round-trips a failed Exit through the observed schema", () => {
    const exit = Exit.failCause(Cause.fail(TestObservedError.make({ message: "kapow" })));
    const encoded = S.encodeSync(S.toCodecJson(ObservedExit))(exit);
    const encodedTag = S.decodeUnknownSync(
      S.Struct({
        _tag: S.String,
      })
    )(encoded);

    expect(encodedTag._tag).toBe("Failure");

    const decoded = S.decodeSync(S.toCodecJson(ObservedExit))(encoded);

    expect(decoded._tag).toBe("Failure");
    expect(decoded._tag === "Failure" ? decoded.cause.reasons[0]?._tag : "Success").toBe("Fail");
  });

  it("schema-derived arbitrary values are members of ObservedCause", () => {
    const arbitrary = S.toArbitrary(ObservedCause)(fc);

    fc.assert(
      fc.property(arbitrary, (cause) => {
        expect(ObservedCause.is(cause)).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("schema-derived arbitrary values are members of ObservedExit", () => {
    const arbitrary = S.toArbitrary(ObservedExit)(fc);

    fc.assert(
      fc.property(arbitrary, (exit) => {
        expect(ObservedExit.is(exit)).toBe(true);
      }),
      fcRuns(50)
    );
  });
});
