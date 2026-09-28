import { ObservedCause, ObservedExit } from "@beep/observability";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertDefined, assertExitSuccess, assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

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
const observedCauseJson = ObservedCause.pipe(S.toCodecJson, S.fromJsonString);
const observedExitJson = ObservedExit.pipe(S.toCodecJson, S.fromJsonString);
const encodeObservedCauseJson = S.encodeEffect(observedCauseJson);
const decodeObservedCauseJson = S.decodeUnknownEffect(observedCauseJson);
const encodeObservedExitJson = S.encodeEffect(observedExitJson);
const decodeObservedExitJson = S.decodeUnknownEffect(observedExitJson);

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

  it.effect.prop(
    "preserves generated ObservedCause wire values through decode and re-encode",
    [Arbitrary.schema(ObservedCause)],
    Effect.fnUntraced(function* ([cause]) {
      const encoded = yield* encodeToCodecJsonObservedCause(cause);
      const decoded = yield* decodeToCodecJsonObservedCause(encoded);
      const reencoded = yield* encodeToCodecJsonObservedCause(decoded);
      expect(reencoded).toStrictEqual(encoded);
      const text = yield* encodeObservedCauseJson(cause);
      const transported = yield* decodeObservedCauseJson(text);
      const reencodedText = yield* encodeObservedCauseJson(transported);
      expect(reencodedText).toBe(text);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "preserves generated ObservedExit wire values through decode and re-encode",
    [Arbitrary.schema(ObservedExit)],
    Effect.fnUntraced(function* ([exit]) {
      const encoded = yield* encodeToCodecJsonObservedExit(exit);
      const decoded = yield* decodeToCodecJsonObservedExit(encoded);
      const reencoded = yield* encodeToCodecJsonObservedExit(decoded);
      expect(reencoded).toStrictEqual(encoded);
      const text = yield* encodeObservedExitJson(exit);
      const transported = yield* decodeObservedExitJson(text);
      const reencodedText = yield* encodeObservedExitJson(transported);
      expect(reencodedText).toBe(text);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "preserves a pinned success payload through JSON text",
    Effect.fnUntraced(function* () {
      const payload = { status: "ok", count: 7, items: ["first", "second"] };
      const text = yield* encodeObservedExitJson(Exit.succeed(payload));
      const decoded = yield* decodeObservedExitJson(text);
      assertExitSuccess(decoded, { status: "ok", count: 7, items: ["first", "second"] });
      const reencoded = yield* encodeObservedExitJson(decoded);
      expect(reencoded).toBe(text);
    })
  );

  it.effect(
    "preserves a pinned defect through JSON text",
    Effect.fnUntraced(function* () {
      const text = yield* encodeObservedCauseJson(Cause.die("defect-witness"));
      const decoded = yield* decodeObservedCauseJson(text);
      expect(decoded.reasons).toHaveLength(1);
      const reason = decoded.reasons[0];
      assertDefined(reason);
      assertTrue(Cause.isDieReason(reason));
      expect(reason.defect).toBe("defect-witness");
      const reencoded = yield* encodeObservedCauseJson(decoded);
      expect(reencoded).toBe(text);
    })
  );

  it.effect(
    "preserves a pinned interruption through JSON text",
    Effect.fnUntraced(function* () {
      const text = yield* encodeObservedCauseJson(Cause.interrupt(37));
      const decoded = yield* decodeObservedCauseJson(text);
      expect(decoded.reasons).toHaveLength(1);
      const reason = decoded.reasons[0];
      assertDefined(reason);
      assertTrue(Cause.isInterruptReason(reason));
      expect(reason.fiberId).toBe(37);
      const reencoded = yield* encodeObservedCauseJson(decoded);
      expect(reencoded).toBe(text);
    })
  );

  it.effect(
    "preserves pinned mixed failure and defect reasons through JSON text",
    Effect.fnUntraced(function* () {
      const original = Cause.combine(
        Cause.fail(TestObservedError.make({ message: "mixed-failure" })),
        Cause.die("mixed-defect")
      );
      const text = yield* encodeObservedCauseJson(original);
      const decoded = yield* decodeObservedCauseJson(text);
      expect(decoded.reasons).toHaveLength(2);
      const failure = decoded.reasons[0];
      const defect = decoded.reasons[1];
      assertDefined(failure);
      assertDefined(defect);
      assertTrue(Cause.isFailReason(failure));
      assertTrue(Cause.isDieReason(defect));
      expect(failure.error.message).toBe("mixed-failure");
      expect(defect.defect).toBe("mixed-defect");
      const reencoded = yield* encodeObservedCauseJson(decoded);
      expect(reencoded).toBe(text);
    })
  );
});
