/**
 * Shared, bounded admission and maintenance coordination for one owned worker.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

const $I = $RepoAiMetricsId.create("observation-control");
/**
 * In-process activity ceiling and cooperative drain deadline.
 *
 * **Details**
 *
 * This does not replace listener, memory, CPU or filesystem limits. Excess work is refused without a waiting queue.
 *
 * **Example** (Inspect the observation control policy constructor)
 *
 * ```ts
 * import { ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control"
 * console.log(typeof ObservationControlPolicy.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationControlPolicy extends S.Opaque<ObservationControlPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    maxActive: S.Int.check(S.isBetween({ minimum: 1, maximum: 8 })),
    drainTimeoutMillis: S.Int.check(S.isBetween({ minimum: 100, maximum: 60000 })),
  }).pipe($I.annoteSchema("ObservationControlPolicy", { description: "Bounded worker activity and drain limits." }))
) {}
/**
 * Current control state, separate from source coverage and backend health.
 *
 * **Details**
 *
 * accepting=false with active greater than zero means draining. closed=true forbids reopening after scope release; active work may still be completing its finalizer.
 *
 * **Example** (Inspect the observation control state constructor)
 *
 * ```ts
 * import { ObservationControlState } from "@beep/repo-ai-metrics/observation-control"
 * console.log(typeof ObservationControlState.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationControlState extends S.Opaque<ObservationControlState, { readonly brand: unique symbol }>()(
  S.Struct({
    accepting: S.Boolean,
    active: S.Int.check(S.isBetween({ minimum: 0, maximum: 8 })),
    maintenance: S.Boolean,
    closed: S.Boolean,
  })
    .check(
      S.makeFilter((s) => (!s.accepting || (!s.closed && !s.maintenance)) && (!s.maintenance || s.active === 0), {
        identifier: "ObservationControlInvariant",
        title: "Consistent control state",
        message: "Maintenance requires drained, closed admission",
      })
    )
    .pipe($I.annoteSchema("ObservationControlState", { description: "Admission, drain and maintenance state." }))
) {}
/**
 * Content-free refusal of worker activity or control changes.
 * **Example** (Inspecting a refusal)
 * ```ts
 * import { ObservationControlError } from "@beep/repo-ai-metrics/observation-control"
 * console.log(ObservationControlError.make({reason:"paused"}).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationControlError extends S.TaggedError<ObservationControlError, { readonly brand: unique symbol }>(
  $I`ObservationControlError`
)(
  "ObservationControlError",
  { reason: S.Literals(["paused", "closed", "busy", "deadline"]) },
  $I.annote("ObservationControlError", { description: "Safe worker admission or maintenance refusal." })
) {}
interface ControlRuntime {
  readonly accepting: boolean;
  readonly active: number;
  readonly closed: boolean;
  readonly idle: Deferred.Deferred<void>;
  readonly maintenance: boolean;
}
const failure = (reason: ObservationControlError["reason"]) => ObservationControlError.make({ reason });
/**
 * Construct a scoped controller, initially paused, for one journal owner.
 *
 * **Details**
 *
 * run reserves activity atomically before evaluating its effect and releases on success, failure or interruption. pause closes admission before waiting for that generation to drain. pauseWith retains the same exclusive control permit through an after-drain action, preventing resume from racing scanner suspension. Timeout/interruption keeps admission closed. maintain only runs while paused and drained; control calls never queue behind each other. A failed maintenance action leaves the worker paused. Scope release permanently closes admission. This coordinates one process only; deployment must enforce one owner per database.
 *
 * **Example** (Inspect the factory for observation control)
 *
 * ```ts
 * import { makeObservationControl } from "@beep/repo-ai-metrics/observation-control"
 * console.log(typeof makeObservationControl)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeObservationControl = Effect.fn("AiMetrics.makeObservationControl")(function* (
  policy: ObservationControlPolicy
) {
  const idle = yield* Deferred.make<void>();
  yield* Deferred.succeed(idle, undefined);
  const state = yield* Ref.make<ControlRuntime>({
    accepting: false,
    active: 0,
    maintenance: false,
    closed: false,
    idle,
  });
  const control = yield* Semaphore.make(1);
  yield* Effect.addFinalizer(() => Ref.update(state, (s) => ({ ...s, accepting: false, closed: true })));
  const status = Ref.get(state).pipe(Effect.map(({ idle: _idle, ...s }) => ObservationControlState.make(s)));
  const exclusive = <A, E, R>(work: Effect.Effect<A, E, R>) =>
    control
      .withPermitsIfAvailable(1)(work)
      .pipe(Effect.flatMap((result) => Effect.fromOption(result).pipe(Effect.mapError(() => failure("busy")))));
  const run = <A, E, R>(work: Effect.Effect<A, E, R>) =>
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const nextIdle = yield* Deferred.make<void>();
        const result = yield* Ref.modify(
          state,
          (s): readonly ["closed" | "paused" | "busy" | "accepted", ControlRuntime] => {
            if (s.closed) return ["closed", s];
            if (!s.accepting) return ["paused", s];
            if (s.active >= policy.maxActive) return ["busy", s];
            return ["accepted", { ...s, active: s.active + 1, idle: s.active === 0 ? nextIdle : s.idle }];
          }
        );
        if (result !== "accepted") return yield* failure(result);
      }),
      () => work,
      () =>
        Ref.modify(state, (s) => [s.active === 1 ? O.some(s.idle) : O.none(), { ...s, active: s.active - 1 }]).pipe(
          Effect.flatMap((notify) => (O.isSome(notify) ? Deferred.succeed(notify.value, undefined) : Effect.void))
        )
    );
  const pauseWith = <A, E, R>(afterDrain: Effect.Effect<A, E, R>) =>
    exclusive(
      Effect.gen(function* () {
        const current = yield* Ref.updateAndGet(state, (s) => ({ ...s, accepting: false }));
        if (current.closed) return yield* failure("closed");
        yield* Deferred.await(current.idle).pipe(
          Effect.timeoutOrElse({
            duration: policy.drainTimeoutMillis,
            orElse: () => Effect.fail(failure("deadline")),
          })
        );
        yield* afterDrain;
        return yield* status;
      })
    );
  const pause = pauseWith(Effect.void);
  const resume = exclusive(
    Effect.gen(function* () {
      const result = yield* Ref.modify(state, (s): readonly ["closed" | "busy" | "resumed", ControlRuntime] => {
        if (s.closed) return ["closed", s];
        if (!s.accepting && s.active !== 0) return ["busy", s];
        return ["resumed", { ...s, accepting: true }];
      });
      if (result !== "resumed") return yield* failure(result);
      return yield* status;
    })
  );
  const maintain = <A, E, R>(work: Effect.Effect<A, E, R>) =>
    exclusive(
      Effect.acquireUseRelease(
        Effect.gen(function* () {
          const result = yield* Ref.modify(state, (s): readonly ["closed" | "busy" | "reserved", ControlRuntime] => {
            if (s.closed) return ["closed", s];
            if (s.accepting || s.active !== 0) return ["busy", s];
            return ["reserved", { ...s, maintenance: true }];
          });
          if (result !== "reserved") return yield* failure(result);
        }),
        () => work,
        () => Ref.update(state, (s) => ({ ...s, maintenance: false }))
      )
    );
  return { run, pause, pauseWith, resume, maintain, status };
});
/**
 * Captured controller shared by an owned worker's adapters.
 * **Example** (Naming the controller type)
 * ```ts
 * import type { ObservationControl } from "@beep/repo-ai-metrics/observation-control"
 * const inspect = (_control: ObservationControl) => undefined
 * void inspect
 * ```
 * @category models
 * @since 0.0.0
 */
export type ObservationControl = Effect.Success<ReturnType<typeof makeObservationControl>>;
