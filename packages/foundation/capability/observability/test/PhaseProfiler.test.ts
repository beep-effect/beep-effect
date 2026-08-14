import { PhaseProfile, profilePhase } from "@beep/observability";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Equal, Layer, Logger, Metric, References } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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
  it("round-trips schema-derived phase profiles", () => {
    fc.assert(
      fc.property(S.toArbitrary(PhaseProfile)(fc), (profile) => {
        const decoded = O.flatMap(S.encodeOption(PhaseProfile)(profile), S.decodeUnknownOption(PhaseProfile));
        expect(O.exists(decoded, (value) => Equal.equals(value, profile))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("rejects empty phase labels", () => {
    expect(
      O.isNone(
        S.decodeOption(PhaseProfile)({
          phase: "",
          outcome: "completed",
          durationMs: NonNegativeInt.make(1),
          attributes: {},
        })
      )
    ).toBe(true);
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

      yield* Effect.exit(
        profilePhase(
          {
            phase: "indexing",
            attributes: { run_kind: "index" },
            failed,
          },
          Effect.fail(TestPhaseError.make({ message: "boom" }))
        )
      );

      const failedState = yield* Metric.value(
        Metric.withAttributes(failed, { phase: "indexing", run_kind: "index", outcome: "failed" })
      );

      expect(failedState.count).toBe(1);
    })
  );

  it.layer(capturedAnnotationsLayer())("tracks interruption and emits safe Cause annotations", (it) =>
    it.effect(
      "captures the interruption annotation",
      Effect.fnUntraced(function* () {
        const interrupted = Metric.counter("test_phase_interrupted_outcomes_total");
        const annotations = yield* CapturedAnnotations;

        yield* Effect.exit(
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

        expect(interruptedState.count).toBe(1);
        expect(annotations).toHaveLength(1);
        expect(annotations[0]?.cause_classification).toBe("interrupted");
        expect(annotations[0]?.phase_outcome).toBe("interrupted");
      })
    )
  );
});
