/** Shared one-job markup process operation, extracted from the HTML worker.
 * Effect owns scopes, admission, cancellation and physical retirement.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { captureCitationNativeAdmission } from "./NativeAdmission.ts";
import {
  CitationNativeProcessOwnerSnapshot,
  citationNativeProcessCommand,
  makeCitationNativeProcessOwner,
} from "./NativeProcess.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type { CitationNativeProcessLease } from "./NativeAdmission.ts";
import type {
  CitationNativeProcessFailureReason,
  CitationNativeProcessRuntime,
  CitationOwnedNativeProcess,
} from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/MarkupWorker");
/** @internal @category models @since 0.0.0 */
export class CitationMarkupWorkerSnapshot extends S.Opaque<
  CitationMarkupWorkerSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    active: S.Natural,
    queued: S.Natural,
    ...CitationNativeProcessOwnerSnapshot.fields,
  }).pipe(
    $I.annoteSchema("CitationMarkupWorkerSnapshot", {
      description: "Source-free ownership/admission diagnostics for one supervisor lifetime.",
    })
  )
) {}
/** Capture existing process/admission ownership once. Trusted prepare effects
 * encode one job after queue admission and before native acquisition. They are
 * server composition, never request callbacks; each invocation has R=never.
 * The same owner retires exact children before success, quarantining uncertain
 * exits under the captured cleanup deadline. No duplicate supervisor is added.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationMarkupWorker = Effect.fn("Citation.makeMarkupWorker")(function* <F>(
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  argument: string,
  operation: "clean" | "annotate",
  failure: (reason: CitationNativeProcessFailureReason) => F
) {
  const clock = yield* Clock.Clock;
  const deadlineKey = operation === "clean" ? "cleanDeadline" : "annotateDeadline";
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    CitationSafetyLimitExceeded.make({ operation, limit });
  const nativeAdmission = yield* captureCitationNativeAdmission(limits, () => failure("invalid-runtime"));
  const slots = yield* Semaphore.make(limits.concurrentOperations);
  const queueSlots = yield* Semaphore.make(limits.queuedOperations);
  const nativeOwner = yield* makeCitationNativeProcessOwner(limits, operation, failure);
  const ensureOpen = nativeOwner.ensureOpen;
  const active = yield* Ref.make(0);
  const queued = yield* Ref.make(0);
  const snapshot = Effect.gen(function* () {
    return CitationMarkupWorkerSnapshot.make({
      ...(yield* nativeOwner.snapshot),
      active: yield* Ref.get(active),
      queued: yield* Ref.get(queued),
    });
  });
  const reap = nativeOwner.reap;
  const run = Effect.fn("Citation.runMarkupWorker")(
    function* <A, E, P, R>(prepare: Effect.Effect<(child: ChildProcessHandle) => Effect.Effect<A, E>, P, R>) {
      return yield* Effect.uninterruptibleMask(
        Effect.fnUntraced(function* (restore) {
          yield* ensureOpen;
          const claimed = yield* Ref.make(false);
          const activate = Ref.set(claimed, true).pipe(Effect.andThen(Ref.update(active, (value) => value + 1)));
          let nativeLease = O.none<CitationNativeProcessLease>();
          const release = Effect.gen(function* () {
            if (yield* Ref.getAndSet(claimed, false)) {
              if (O.isSome(nativeLease)) yield* nativeLease.value.release;
              yield* Ref.update(active, (value) => value - 1);
              yield* slots.release(1);
            }
          });
          yield* Effect.gen(function* () {
            if (yield* slots.takeIfAvailable(1)) return yield* activate;
            yield* Effect.acquireUseRelease(
              Effect.gen(function* () {
                if (!(yield* queueSlots.takeIfAvailable(1))) return yield* safety("queuedOperations");
                yield* Ref.update(queued, (value) => value + 1);
              }),
              () =>
                slots.take(1).pipe(
                  Effect.timeoutOrElse({
                    duration: limits.queueDeadline,
                    orElse: () => Effect.fail(safety("queueDeadline")),
                  }),
                  Effect.interruptible,
                  Effect.andThen(activate)
                ),
              () => Ref.update(queued, (value) => value - 1).pipe(Effect.andThen(queueSlots.release(1)))
            );
          }).pipe(Effect.onError(() => release));
          let lease = O.none<CitationOwnedNativeProcess<F>>();
          const body = Effect.gen(function* () {
            yield* ensureOpen;
            const call = yield* prepare;
            yield* nativeAdmission.acquire(operation).pipe(
              Effect.mapError((error) =>
                error._tag === "CitationSafetyLimitExceeded"
                  ? error
                  : failure(error.reason === "quarantined" ? "quarantined" : "closed")
              ),
              Effect.tap((permit) =>
                Effect.sync(() => {
                  nativeLease = O.some(permit);
                })
              ),
              Effect.uninterruptible
            );
            const started = yield* nativeOwner
              .start(citationNativeProcessCommand(runtime, argument), {
                quarantine: Effect.suspend(() => (O.isSome(nativeLease) ? nativeLease.value.quarantine : Effect.void)),
                release,
              })
              .pipe(
                Effect.tap((started) =>
                  Effect.sync(() => {
                    lease = O.some(started.process);
                  })
                ),
                Effect.uninterruptible
              );
            const resource = yield* started.child;
            return yield* call(resource);
          });
          const outcome = yield* Effect.exit(
            restore(
              body.pipe(
                Effect.timeoutOrElse({
                  duration: limits[deadlineKey],
                  orElse: () => Effect.fail(safety(deadlineKey)),
                })
              )
            )
          );
          if (O.isSome(lease)) yield* lease.value.retire(false);
          else yield* release;
          return yield* outcome;
        })
      ).pipe(
        Effect.timeoutOrElse({
          duration: limits.operationDeadline,
          orElse: () => Effect.fail(safety("operationDeadline")),
        })
      );
    },
    Effect.provideService(Clock.Clock, clock)
  );
  return { run, snapshot, reap };
});
