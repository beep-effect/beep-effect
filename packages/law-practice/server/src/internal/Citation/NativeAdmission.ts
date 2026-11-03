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
  S.Struct({
    active: S.Natural,
    regexActive: S.Natural,
    queued: S.Natural,
    quarantined: S.Natural,
    closed: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationNativeAdmissionSnapshot", {
      description:
        "Source-free shared native reservations, including unacknowledged retired children and their regex subset.",
    })
  )
) {}
/** Native leases transfer to retirement ownership, never automatically release
 * when an operation finishes. Regex reservations consume both concurrency bounds.
 * @internal @category services @since 0.0.0
 */
export class CitationNativeProcessAdmission extends Context.Service<
  CitationNativeProcessAdmission,
  {
    readonly acquire: (
      operation: CitationSafetyLimitExceeded["operation"]
    ) => Effect.Effect<CitationNativeProcessLease, CitationAdmissionFailure | CitationSafetyLimitExceeded>;
    readonly acquireRegex: (
      operation: CitationSafetyLimitExceeded["operation"]
    ) => Effect.Effect<CitationNativeProcessLease, CitationAdmissionFailure | CitationSafetyLimitExceeded>;
    readonly snapshot: Effect.Effect<CitationNativeAdmissionSnapshot>;
  }
>()($I`CitationNativeProcessAdmission`) {}
/** Capture policy, Clock and Scope. A single atomic reservation checks the total
 * and regex ceilings together, without holding one capacity while waiting for
 * the other. One bounded queue/deadline applies to the entire wait. Closure
 * rejects waiters but cannot acknowledge a child for its retirement owner.
 * Call acquire in a masked ownership transfer; release only after confirmed exit.
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
  // Lease flags and aggregate counters change together, including concurrent
  // quarantine/retirement acknowledgement of the same exact lease.
  const ownershipLock = yield* Semaphore.make(1);
  const state = yield* Ref.make(
    CitationNativeAdmissionSnapshot.make({
      active: 0,
      regexActive: 0,
      queued: 0,
      quarantined: 0,
      closed: false,
    })
  );
  const changed = yield* Ref.make(yield* Deferred.make<void>());
  const notify = Effect.gen(function* () {
    const previous = yield* Ref.getAndSet(changed, yield* Deferred.make<void>());
    yield* Deferred.succeed(previous, undefined);
  }).pipe(Effect.asVoid);
  const fail = (reason: CitationAdmissionFailure["reason"]) => CitationAdmissionFailure.make({ reason });
  const ensureOpen = Effect.gen(function* () {
    const current = yield* Ref.get(state);
    if (current.closed) return yield* fail("closed");
    if (current.quarantined > 0) return yield* fail("quarantined");
  });
  yield* Scope.addFinalizer(
    scope,
    ownershipLock.withPermit(
      Ref.update(state, (current) => CitationNativeAdmissionSnapshot.make({ ...current, closed: true })).pipe(
        Effect.andThen(notify)
      )
    )
  );
  const acquireKind = Effect.fn("Citation.acquireNativeProcessKind")(
    function* (operation: CitationSafetyLimitExceeded["operation"], regex: boolean) {
      return yield* Effect.uninterruptibleMask(
        Effect.fnUntraced(function* () {
          const claimed = yield* Ref.make(false);
          const isolated = yield* Ref.make(false);
          const release = Effect.gen(function* () {
            if (!(yield* Ref.getAndSet(claimed, false))) return;
            const quarantined = yield* Ref.getAndSet(isolated, false);
            yield* Ref.update(state, (current) =>
              CitationNativeAdmissionSnapshot.make({
                ...current,
                active: current.active - 1,
                regexActive: current.regexActive - (regex ? 1 : 0),
                quarantined: current.quarantined - (quarantined ? 1 : 0),
              })
            );
            yield* notify;
          }).pipe(ownershipLock.withPermit, Effect.uninterruptible);
          const claim = ownershipLock.withPermit(
            Effect.gen(function* () {
              yield* ensureOpen;
              const reserved = yield* Ref.modify(state, (current) => {
                if (
                  current.active >= limits.concurrentOperations ||
                  (regex && current.regexActive >= limits.concurrentRegexProcesses)
                )
                  return [false, current];
                return [
                  true,
                  CitationNativeAdmissionSnapshot.make({
                    ...current,
                    active: current.active + 1,
                    regexActive: current.regexActive + (regex ? 1 : 0),
                  }),
                ];
              });
              if (reserved) yield* Ref.set(claimed, true);
              return reserved;
            })
          );
          return yield* Effect.gen(function* () {
            if (!(yield* claim))
              yield* Effect.acquireUseRelease(
                Effect.gen(function* () {
                  const entered = yield* Ref.modify(state, (current) =>
                    current.queued >= limits.queuedOperations
                      ? [false, current]
                      : [true, CitationNativeAdmissionSnapshot.make({ ...current, queued: current.queued + 1 })]
                  );
                  if (!entered)
                    return yield* CitationSafetyLimitExceeded.make({ operation, limit: "queuedOperations" });
                }),
                () =>
                  Effect.uninterruptibleMask(
                    Effect.fnUntraced(function* (restore) {
                      while (true) {
                        // Capture the notification before testing capacity: release,
                        // quarantine or closure cannot be lost between claim and sleep.
                        const signal = yield* Ref.get(changed);
                        if (yield* claim) return;
                        yield* restore(Deferred.await(signal));
                      }
                    })
                  ).pipe(
                    Effect.timeoutOrElse({
                      duration: queueDeadline,
                      orElse: () =>
                        Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: "queueDeadline" })),
                    }),
                    Effect.interruptible
                  ),
                () =>
                  Ref.update(state, (current) =>
                    CitationNativeAdmissionSnapshot.make({ ...current, queued: current.queued - 1 })
                  )
              );
            yield* ensureOpen;
            return {
              release,
              quarantine: Effect.gen(function* () {
                if (!(yield* Ref.get(claimed)) || (yield* Ref.getAndSet(isolated, true))) return;
                yield* Ref.update(state, (current) =>
                  CitationNativeAdmissionSnapshot.make({
                    ...current,
                    quarantined: current.quarantined + 1,
                  })
                );
                yield* notify;
              }).pipe(ownershipLock.withPermit, Effect.uninterruptible),
            } satisfies CitationNativeProcessLease;
          }).pipe(Effect.onError(() => release));
        })
      );
    },
    Effect.provideService(Clock.Clock, clock)
  );
  return CitationNativeProcessAdmission.of({
    acquire: Effect.fn("Citation.acquireNativeProcess")((operation) => acquireKind(operation, false)),
    acquireRegex: Effect.fn("Citation.acquireRegexProcess")((operation) => acquireKind(operation, true)),
    snapshot: Ref.get(state).pipe(Effect.map((current) => CitationNativeAdmissionSnapshot.make({ ...current }))),
  });
});
