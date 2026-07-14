/** @effect-diagnostics strictEffectProvide:skip-file */
import { PhaseProfile, profilePhase } from "@beep/observability";
import { NonNegativeInt, TaggedErrorClass } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { Effect, Equal, Logger, Metric, References } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

class TestPhaseError extends TaggedErrorClass<TestPhaseError>()("TestPhaseError", {
  message: S.String,
}) {}

describe("PhaseProfiler", () => {
  it("round-trips schema-derived phase profiles", () => {
    fc.assert(
      fc.property(S.toArbitrary(PhaseProfile), (profile) => {
        const decoded = O.flatMap(S.encodeOption(PhaseProfile)(profile), S.decodeUnknownOption(PhaseProfile));
        expect(O.exists(decoded, (value) => Equal.equals(value, profile))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("rejects empty phase labels", () => {
    expect(
      O.isNone(
        S.decodeUnknownOption(PhaseProfile)({
          phase: "",
          outcome: "completed",
          durationMs: NonNegativeInt.make(1),
          attributes: {},
        })
      )
    ).toBe(true);
  });

  it("tracks phase metrics on success", () =>
    Effect.runPromise(
      Effect.gen(function* () {
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
    ));

  it("tracks failures with outcome attributes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
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
    ));

  it("tracks interruption and emits safe Cause annotations", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const interrupted = Metric.counter("test_phase_interrupted_outcomes_total");
        const annotations: Array<Record<string, unknown>> = [];
        const logger = Logger.make<unknown, void>((options) => {
          annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
        });

        yield* Effect.exit(
          profilePhase(
            {
              phase: "stream",
              interrupted,
            },
            Effect.interrupt
          ).pipe(Effect.provide(Logger.layer([logger])))
        );

        const interruptedState = yield* Metric.value(
          Metric.withAttributes(interrupted, { phase: "stream", outcome: "interrupted" })
        );

        expect(interruptedState.count).toBe(1);
        expect(annotations).toHaveLength(1);
        expect(annotations[0]?.cause_classification).toBe("interrupted");
        expect(annotations[0]?.phase_outcome).toBe("interrupted");
      })
    ));
});
