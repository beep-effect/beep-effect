/** Shared native ownership across workers in one citation engine lifetime.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as TxRef from "effect/TxRef";
import { CitationAdmissionFailure, prepareCitationAdmissionPolicy } from "./Admission.ts";

const $I = $LawPracticeServerId.create("internal/Citation/NativeAdmission");
// Native ownership is external to a caller's retryable work. Public operations
// must commit independently; only the owner's internal claim/retry steps compose.
const outsideCallerTransaction = <A, E>(body: Effect.Effect<A, E>): Effect.Effect<A, E> =>
  Effect.updateContext(body, (context: Context.Context<never>) => context.pipe(Context.omit(Effect.Transaction)));
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
/** Capture the existing composed owner, or install the standalone fallback.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationNativeAdmission = Effect.fn("Citation.captureNativeAdmission")(function* <E>(
  policy: unknown,
  invalid: () => E
) {
  const supplied = yield* Effect.serviceOption(CitationNativeProcessAdmission);
  return O.isSome(supplied)
    ? supplied.value
    : yield* makeCitationNativeProcessAdmission(policy).pipe(Effect.mapError(invalid));
});
/** Preserve the existing total/regex acquisition and closed boundary translation.
 * @internal @category operations @since 0.0.0
 */
export const acquireCitationNativeLease = Effect.fn("Citation.acquireNativeLease")(function* <E>(
  admission: CitationNativeProcessAdmission["Service"],
  operation: CitationSafetyLimitExceeded["operation"],
  regex: boolean,
  failed: (reason: "quarantined" | "closed") => E
) {
  return yield* (regex ? admission.acquireRegex(operation) : admission.acquire(operation)).pipe(
    Effect.mapError((error) =>
      error._tag === "CitationSafetyLimitExceeded"
        ? error
        : failed(error.reason === "quarantined" ? "quarantined" : "closed")
    )
  );
});
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
  const { limits, queueDeadline } = yield* prepareCitationAdmissionPolicy(policy);
  const clock = yield* Clock.Clock;
  const scope = yield* Scope.Scope;
  // Transactions commit lease flags and both capacity counters together.
  // Retry watches this state directly; no parallel notification protocol exists.
  const state = yield* TxRef.make(
    CitationNativeAdmissionSnapshot.make({
      active: 0,
      regexActive: 0,
      queued: 0,
      quarantined: 0,
      closed: false,
    })
  );
  const fail = (reason: CitationAdmissionFailure["reason"]) => CitationAdmissionFailure.make({ reason });
  const ensureOpen = Effect.gen(function* () {
    const current = yield* TxRef.get(state);
    if (current.closed) return yield* fail("closed");
    if (current.quarantined > 0) return yield* fail("quarantined");
  });
  yield* Scope.addFinalizer(
    scope,
    TxRef.update(state, (current) => CitationNativeAdmissionSnapshot.make({ ...current, closed: true })).pipe(
      outsideCallerTransaction
    )
  );
  const acquireKind = Effect.fn("Citation.acquireNativeProcessKind")(
    function* (operation: CitationSafetyLimitExceeded["operation"], regex: boolean) {
      return yield* Effect.uninterruptibleMask(
        Effect.fnUntraced(function* () {
          const claimed = yield* TxRef.make(false);
          const isolated = yield* TxRef.make(false);
          const release = Effect.gen(function* () {
            if (!(yield* TxRef.modify(claimed, (current) => [current, false]))) return;
            const quarantined = yield* TxRef.modify(isolated, (current) => [current, false]);
            yield* TxRef.update(state, (current) =>
              CitationNativeAdmissionSnapshot.make({
                ...current,
                active: current.active - 1,
                regexActive: current.regexActive - (regex ? 1 : 0),
                quarantined: current.quarantined - (quarantined ? 1 : 0),
              })
            );
          }).pipe(Effect.tx, Effect.uninterruptible, outsideCallerTransaction);
          const claim = Effect.gen(function* () {
            yield* ensureOpen;
            const current = yield* TxRef.get(state);
            if (
              current.active >= limits.concurrentOperations ||
              (regex && current.regexActive >= limits.concurrentRegexProcesses)
            )
              return false;
            yield* TxRef.set(
              state,
              CitationNativeAdmissionSnapshot.make({
                ...current,
                active: current.active + 1,
                regexActive: current.regexActive + (regex ? 1 : 0),
              })
            );
            yield* TxRef.set(claimed, true);
            return true;
          }).pipe(Effect.tx);
          return yield* Effect.gen(function* () {
            if (!(yield* claim))
              yield* Effect.acquireUseRelease(
                Effect.gen(function* () {
                  const current = yield* TxRef.get(state);
                  if (current.queued >= limits.queuedOperations)
                    return yield* CitationSafetyLimitExceeded.make({ operation, limit: "queuedOperations" });
                  yield* TxRef.set(
                    state,
                    CitationNativeAdmissionSnapshot.make({ ...current, queued: current.queued + 1 })
                  );
                }).pipe(Effect.tx),
                () =>
                  Effect.gen(function* () {
                    if (!(yield* claim)) return yield* Effect.txRetry;
                  }).pipe(
                    Effect.tx,
                    Effect.timeoutOrElse({
                      duration: queueDeadline,
                      orElse: () =>
                        Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: "queueDeadline" })),
                    }),
                    Effect.interruptible
                  ),
                () =>
                  TxRef.update(state, (current) =>
                    CitationNativeAdmissionSnapshot.make({ ...current, queued: current.queued - 1 })
                  )
              );
            yield* ensureOpen;
            return {
              release,
              quarantine: Effect.gen(function* () {
                if (!(yield* TxRef.get(claimed)) || (yield* TxRef.modify(isolated, (current) => [current, true])))
                  return;
                yield* TxRef.update(state, (current) =>
                  CitationNativeAdmissionSnapshot.make({
                    ...current,
                    quarantined: current.quarantined + 1,
                  })
                );
              }).pipe(Effect.tx, Effect.uninterruptible, outsideCallerTransaction),
            } satisfies CitationNativeProcessLease;
          }).pipe(Effect.onError(() => release));
        })
      );
    },
    Effect.provideService(Clock.Clock, clock),
    outsideCallerTransaction
  );
  return CitationNativeProcessAdmission.of({
    acquire: Effect.fn("Citation.acquireNativeProcess")((operation) => acquireKind(operation, false)),
    acquireRegex: Effect.fn("Citation.acquireRegexProcess")((operation) => acquireKind(operation, true)),
    snapshot: TxRef.get(state).pipe(
      Effect.map((current) => CitationNativeAdmissionSnapshot.make({ ...current })),
      outsideCallerTransaction
    ),
  });
});
