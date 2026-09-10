import { ObservedCause, ObservedExit } from "@beep/observability";
import { fcRuns } from "@beep/test-utils";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { describe, expect, it } from "vitest";

const decodeToCodecJsonObservedCauseSync = S.decodeSync(S.toCodecJson(ObservedCause));
const decodeToCodecJsonObservedExitSync = S.decodeSync(S.toCodecJson(ObservedExit));
const decodeUnknownStructInlineSchemaArraySync = S.decodeUnknownSync(
  S.Array(
    S.Struct({
      _tag: S.String,
    })
  )
);
const decodeUnknownStructInlineSchemaSync = S.decodeUnknownSync(
  S.Struct({
    _tag: S.String,
  })
);
const encodeToCodecJsonObservedCauseSync = S.encodeSync(S.toCodecJson(ObservedCause));
const encodeToCodecJsonObservedExitSync = S.encodeSync(S.toCodecJson(ObservedExit));

class TestObservedError extends S.TaggedError<TestObservedError>()("TestObservedError", {
  message: S.String,
}) {}

describe("Observed", () => {
  it("round-trips a failed Cause through the observed schema", () => {
    const cause = Cause.fail(TestObservedError.make({ message: "boom" }));
    const encoded = encodeToCodecJsonObservedCauseSync(cause);
    const encodedReasons = decodeUnknownStructInlineSchemaArraySync(encoded);

    expect(encodedReasons).toHaveLength(1);
    expect(encodedReasons[0]?._tag).toBe("Fail");

    const decoded = decodeToCodecJsonObservedCauseSync(encoded);
    const firstReason = decoded.reasons[0];

    expect(firstReason?._tag).toBe("Fail");
    expect(firstReason?._tag === "Fail" ? firstReason.error.message : "").toBe("boom");
  });

  it("round-trips a failed Exit through the observed schema", () => {
    const exit = Exit.failCause(Cause.fail(TestObservedError.make({ message: "kapow" })));
    const encoded = encodeToCodecJsonObservedExitSync(exit);
    const encodedTag = decodeUnknownStructInlineSchemaSync(encoded);

    expect(encodedTag._tag).toBe("Failure");

    const decoded = decodeToCodecJsonObservedExitSync(encoded);

    expect(decoded._tag).toBe("Failure");
    expect(decoded._tag === "Failure" ? decoded.cause.reasons[0]?._tag : "Success").toBe("Fail");
  });

  it("schema-derived arbitrary values are members of ObservedCause", () => {
    const arbitrary = Arbitrary.schema(ObservedCause);

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([cause]) => {
            expect(ObservedCause.is(cause)).toBe(true);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
  });

  it("schema-derived arbitrary values are members of ObservedExit", () => {
    const arbitrary = Arbitrary.schema(ObservedExit);

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([exit]) => {
            expect(ObservedExit.is(exit)).toBe(true);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
  });
});
