/** Shared native ownership across workers in one citation engine lifetime.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import { CitationAdmissionFailure } from "./Admission.ts";

const $I = $LawPracticeServerId.create("internal/Citation/NativeAdmission");
const Limits = S.toType(CitationEngineLimits);
/** Runtime authority: only the worker holding the exact child may acknowledge release.
 * These effects intentionally survive caller cancellation and owner Scope closure.
 * @internal @category services @since 0.0.0
 */
export interface CitationNativeProcessLease {
  readonly quarantine: Effect.Effect<void>;
  readonly release: Effect.Effect<void>;
}
/** @internal @category models @since 0.0.0 */
export class CitationNativeAdmissionSnapshot extends S.Opaque<
  CitationNativeAdmissionSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({ active: S.Natural, queued: S.Natural, quarantined: S.Natural, closed: S.Boolean }).pipe(
    $I.annoteSchema("CitationNativeAdmissionSnapshot", {
      description: "Source-free shared native reservations, including unacknowledged retired children.",
    })
  )
) {}
/** Native leases are transferred to retirement ownership, never automatically
 * released when the calling operation finishes. Compose all workers with this owner.
 * @internal @category services @since 0.0.0
 */
export class CitationNativeProcessAdmission extends Context.Service<
  CitationNativeProcessAdmission,
  {
    readonly acquire: (
      operation: CitationSafetyLimitExceeded["operation"]
    ) => Effect.Effect<CitationNativeProcessLease, CitationAdmissionFailure | CitationSafetyLimitExceeded>;
    readonly snapshot: Effect.Effect<CitationNativeAdmissionSnapshot>;
  }
>()($I`CitationNativeProcessAdmission`) {}
/** Capture policy, Clock and Scope. The total native bound uses operation concurrency;
 * regex workers additionally need their regex-specific concurrency bound. Closure
 * rejects waiters but cannot acknowledge a child on behalf of its retirement owner.
 * Call acquire in a masked ownership transfer and release only after confirmed exit.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeProcessAdmission = Effect.fn("Citation.makeNativeProcessAdmission")(function* (
  policy: unknown
) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(
    Effect.mapError(() => CitationAdmissionFailure.make({ reason: "invalid-policy" }))
  );
  const queueDeadline = limits.queueDeadline.pipe(Duration.toMillis, Duration.millis);
  const clock = yield* Clock.Clock;
  const scope = yield* Scope.Scope;
  const slots = yield* Semaphore.make(limits.concurrentOperations);
  const queueSlots = yield* Semaphore.make(limits.queuedOperations);
  const active = yield* Ref.make(0);
  const queued = yield* Ref.make(0);
  const quarantined = yield* Ref.make(0);
  const closed = yield* Deferred.make<void>();
  const quarantineSignal = yield* Ref.make(yield* Deferred.make<void>());
  const fail = (reason: CitationAdmissionFailure["reason"]) => CitationAdmissionFailure.make({ reason });
  const ensureOpen = Effect.gen(function* () {
    if (yield* Deferred.isDone(closed)) return yield* fail("closed");
    if ((yield* Ref.get(quarantined)) > 0) return yield* fail("quarantined");
  });
  yield* Scope.addFinalizer(scope, Deferred.succeed(closed, undefined).pipe(Effect.asVoid));
  const acquire = Effect.fn("Citation.acquireNativeProcess")(
    function* (operation: CitationSafetyLimitExceeded["operation"]) {
      return yield* Effect.uninterruptibleMask(() =>
        Effect.gen(function* () {
          const claimed = yield* Ref.make(false);
          const isolated = yield* Ref.make(false);
          const release = Effect.gen(function* () {
            if (!(yield* Ref.getAndSet(claimed, false))) return;
            if (yield* Ref.getAndSet(isolated, false)) {
              const remaining = yield* Ref.updateAndGet(quarantined, (count) => count - 1);
              if (remaining === 0) yield* Ref.set(quarantineSignal, yield* Deferred.make<void>());
            }
            yield* Ref.update(active, (count) => count - 1);
            yield* slots.release(1);
          }).pipe(Effect.uninterruptible);
          const activate = Ref.set(claimed, true).pipe(Effect.andThen(Ref.update(active, (count) => count + 1)));
          return yield* Effect.gen(function* () {
            yield* ensureOpen;
            const signal = yield* Ref.get(quarantineSignal);
            if (yield* slots.takeIfAvailable(1)) yield* activate;
            else
              yield* Effect.acquireUseRelease(
                Effect.gen(function* () {
                  if (!(yield* queueSlots.takeIfAvailable(1)))
                    return yield* CitationSafetyLimitExceeded.make({ operation, limit: "queuedOperations" });
                  yield* Ref.update(queued, (count) => count + 1);
                }),
                () =>
                  Effect.uninterruptibleMask(() =>
                    slots.take(1).pipe(Effect.interruptible, Effect.andThen(activate))
                  ).pipe(
                    Effect.raceFirst(Deferred.await(closed).pipe(Effect.andThen(Effect.fail(fail("closed"))))),
                    Effect.raceFirst(Deferred.await(signal).pipe(Effect.andThen(Effect.fail(fail("quarantined"))))),
                    Effect.timeoutOrElse({
                      duration: queueDeadline,
                      orElse: () =>
                        Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: "queueDeadline" })),
                    }),
                    Effect.interruptible
                  ),
                () => Ref.update(queued, (count) => count - 1).pipe(Effect.andThen(queueSlots.release(1)))
              );
            yield* ensureOpen;
            return {
              release,
              quarantine: Effect.gen(function* () {
                if (!(yield* Ref.get(claimed)) || (yield* Ref.getAndSet(isolated, true))) return;
                yield* Ref.update(quarantined, (count) => count + 1);
                yield* Deferred.succeed(yield* Ref.get(quarantineSignal), undefined);
              }).pipe(Effect.asVoid, Effect.uninterruptible),
            } satisfies CitationNativeProcessLease;
          }).pipe(Effect.onError(() => release));
        })
      );
    },
    Effect.provideService(Clock.Clock, clock)
  );
  return CitationNativeProcessAdmission.of({
    acquire,
    snapshot: Effect.gen(function* () {
      return CitationNativeAdmissionSnapshot.make({
        active: yield* Ref.get(active),
        queued: yield* Ref.get(queued),
        quarantined: yield* Ref.get(quarantined),
        closed: yield* Deferred.isDone(closed),
      });
    }),
  });
});
