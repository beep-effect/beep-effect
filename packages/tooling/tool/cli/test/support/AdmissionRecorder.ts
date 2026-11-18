import { QualityScheduler, QualitySchedulerLive } from "@beep/repo-cli/test/RepoRun";
import { vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { AdmissionOriginGate, AdmissionRequest, QualitySchedulerError } from "@beep/repo-cli/test/RepoRun";

const admitAtOnce = (_request: AdmissionRequest): Effect.Effect<void, QualitySchedulerError> => Effect.void;

/**
 * A `QualityScheduler` double for command tests.
 *
 * `admit` records each request on the `admitted` mock, runs what the mock
 * returns (nothing by default; a test can make it wait or refuse), then runs
 * the admitted work directly. Every other operation is the live scheduler's.
 * Reset `admitted` at the start of each fixture: the recorder outlives tests.
 */
export const makeAdmissionRecorder = () => {
  const admitted = vi.fn(admitAtOnce);
  const admit = Effect.fn("AdmissionRecorder.admit")(function* <
    Success,
    UseError,
    UseRequirements,
    OriginLease,
    GateError,
    GateRequirements,
  >(
    request: AdmissionRequest,
    _gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
    use: Effect.Effect<Success, UseError, UseRequirements>
  ) {
    yield* admitted(request);
    return yield* use;
  });
  const layer = Layer.effect(
    QualityScheduler,
    Effect.map(QualityScheduler, (live) => QualityScheduler.of({ ...live, admit }))
  ).pipe(Layer.provide(QualitySchedulerLive));
  return { admitted, layer };
};
