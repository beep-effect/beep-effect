import { PhaseProfile, profilePhase } from "@beep/observability";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it as loggerSubjectIt } from "@effect/vitest";
import { assertDefined, assertNone, assertTrue } from "@effect/vitest/utils";
import { Cause, Context, Effect, Equal, Exit, Layer, Logger, Metric, References } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodePhaseProfileOption = S.decodeOption(PhaseProfile);
const decodeUnknownPhaseProfileOption = S.decodeUnknownOption(PhaseProfile);
const encodePhaseProfileOption = S.encodeOption(PhaseProfile);

class CapturedAnnotations extends Context.Service<CapturedAnnotations, Array<Record<string, unknown>>>()(
  "@beep/observability/test/PhaseProfiler.test/CapturedAnnotations"
) {}

const capturedAnnotationsLayer = (): Layer.Layer<CapturedAnnotations> => {
  const annotations: Array<Record<string, unknown>> = [];
  const logger = Logger.make<unknown, void>((options) => {
    annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
  });
  return Layer.merge(Layer.succeed(CapturedAnnotations, annotations), Logger.layer([logger]));
};

class TestPhaseError extends S.TaggedError<TestPhaseError>()("TestPhaseError", {
  message: S.String,
}) {}

describe("PhaseProfiler", () => {
  it.prop(
    "round-trips schema-derived phase profiles",
    [Arbitrary.schema(PhaseProfile)],
    ([profile]) => {
      const decoded = O.flatMap(encodePhaseProfileOption(profile), decodeUnknownPhaseProfileOption);
      expect(O.exists(decoded, (value) => Equal.equals(value, profile))).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it("rejects empty phase labels", () => {
    assertNone(
      decodePhaseProfileOption({
        phase: "",
        outcome: "completed",
        durationMs: S.Natural.make(1),
        attributes: {},
      })
    );
  });

  it.effect(
    "tracks phase metrics on success",
    Effect.fnUntraced(function* () {
      const started = Metric.counter("test_phase_started_total");
      const completed = Metric.counter("test_phase_completed_total");
      const failed = Metric.counter("test_phase_failed_total");

      yield* profilePhase(
        {
          phase: "retrieve",
          attributes: { run_kind: "query" },
          started,
          completed,
          failed,
        },
        Effect.succeed("ok")
      );

      const startedState = yield* Metric.value(
        Metric.withAttributes(started, { phase: "retrieve", run_kind: "query" })
      );
      const completedState = yield* Metric.value(
        Metric.withAttributes(completed, { phase: "retrieve", run_kind: "query", outcome: "completed" })
      );

      expect(startedState.count).toBe(1);
      expect(completedState.count).toBe(1);
    })
  );

  it.effect(
    "tracks failures with outcome attributes",
    Effect.fnUntraced(function* () {
      const failed = Metric.counter("test_phase_failed_outcomes_total");

      const expectedError = TestPhaseError.make({ message: "boom" });
      const exit = yield* Effect.exit(
        profilePhase(
          {
            phase: "indexing",
            attributes: { run_kind: "index" },
            failed,
          },
          Effect.fail(expectedError)
        )
      );

      const failedState = yield* Metric.value(
        Metric.withAttributes(failed, { phase: "indexing", run_kind: "index", outcome: "failed" })
      );

      assertTrue(Exit.isFailure(exit));
      expect(exit.cause.reasons).toHaveLength(1);
      const reason = exit.cause.reasons[0];
      assertDefined(reason);
      assertTrue(Cause.isFailReason(reason));
      expect(reason.error).toBe(expectedError);
      expect(failedState.count).toBe(1);
    })
  );

  // This layer's logger is the subject: runner lifecycle logs would alter its exact captures.
  loggerSubjectIt.layer(capturedAnnotationsLayer(), { timeout: "10 seconds" })(
    "tracks interruption and emits safe Cause annotations",
    (it) =>
      it.effect(
        "captures the interruption annotation",
        Effect.fnUntraced(function* () {
          const interrupted = Metric.counter("test_phase_interrupted_outcomes_total");
          const annotations = yield* CapturedAnnotations;

          const exit = yield* Effect.exit(
            profilePhase(
              {
                phase: "stream",
                interrupted,
              },
              Effect.interrupt
            )
          );

          const interruptedState = yield* Metric.value(
            Metric.withAttributes(interrupted, { phase: "stream", outcome: "interrupted" })
          );

          assertTrue(Exit.isFailure(exit));
          assertTrue(Cause.hasInterruptsOnly(exit.cause));
          expect(interruptedState.count).toBe(1);
          expect(annotations).toHaveLength(1);
          expect(annotations[0]?.cause_classification).toBe("interrupted");
          expect(annotations[0]?.phase_outcome).toBe("interrupted");
        })
      )
  );
});
