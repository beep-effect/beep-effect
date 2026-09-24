import { ObservedCause, ObservedExit } from "@beep/observability";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeToCodecJsonObservedCause = S.decodeUnknownEffect(S.toCodecJson(ObservedCause));
const decodeToCodecJsonObservedExit = S.decodeUnknownEffect(S.toCodecJson(ObservedExit));
const decodeUnknownStructInlineSchemaArray = S.decodeUnknownEffect(
  S.Array(
    S.Struct({
      _tag: S.String,
    })
  )
);
const decodeUnknownStructInlineSchema = S.decodeUnknownEffect(
  S.Struct({
    _tag: S.String,
  })
);
const encodeToCodecJsonObservedCause = S.encodeEffect(S.toCodecJson(ObservedCause));
const encodeToCodecJsonObservedExit = S.encodeEffect(S.toCodecJson(ObservedExit));

class TestObservedError extends S.TaggedError<TestObservedError>()("TestObservedError", {
  message: S.String,
}) {}

describe("Observed", () => {
  it.effect(
    "round-trips a failed Cause through the observed schema",
    Effect.fnUntraced(function* () {
      const cause = Cause.fail(TestObservedError.make({ message: "boom" }));
      const encoded = yield* encodeToCodecJsonObservedCause(cause);
      const encodedReasons = yield* decodeUnknownStructInlineSchemaArray(encoded);

      expect(encodedReasons).toHaveLength(1);
      expect(encodedReasons[0]?._tag).toBe("Fail");

      const decoded = yield* decodeToCodecJsonObservedCause(encoded);
      const firstReason = decoded.reasons[0];

      expect(firstReason?._tag).toBe("Fail");
      expect(firstReason?._tag === "Fail" ? firstReason.error.message : "").toBe("boom");
    })
  );

  it.effect(
    "round-trips a failed Exit through the observed schema",
    Effect.fnUntraced(function* () {
      const exit = Exit.failCause(Cause.fail(TestObservedError.make({ message: "kapow" })));
      const encoded = yield* encodeToCodecJsonObservedExit(exit);
      const encodedTag = yield* decodeUnknownStructInlineSchema(encoded);

      expect(encodedTag._tag).toBe("Failure");

      const decoded = yield* decodeToCodecJsonObservedExit(encoded);

      expect(decoded._tag).toBe("Failure");
      expect(decoded._tag === "Failure" ? decoded.cause.reasons[0]?._tag : "Success").toBe("Fail");
    })
  );

  it.effect.prop(
    "schema-derived arbitrary values are members of ObservedCause",
    [Arbitrary.schema(ObservedCause)],
    Effect.fnUntraced(function* ([cause]) {
      expect(ObservedCause.is(cause)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "schema-derived arbitrary values are members of ObservedExit",
    [Arbitrary.schema(ObservedExit)],
    Effect.fnUntraced(function* ([exit]) {
      expect(ObservedExit.is(exit)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );
});
