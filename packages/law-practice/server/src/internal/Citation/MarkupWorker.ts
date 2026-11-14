/** Shared one-job markup process operation, extracted from the HTML worker.
 * Effect owns scopes, admission, cancellation and physical retirement.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { CitationNativeProcessOwnerSnapshot, citationNativeProcessCommand } from "./NativeProcess.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type { CitationNativeLaneFailure, CitationNativeStart } from "./NativeLane.ts";
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
  const slots = yield* Semaphore.make(limits.concurrentOperations);
  const queueSlots = yield* Semaphore.make(limits.queuedOperations);
  const closed = yield* Ref.make(false);
  const records = yield* Ref.make<ReadonlyArray<CitationOwnedNativeProcess<CitationNativeLaneFailure>>>([]);
  const quarantined = yield* Ref.make(0);
  yield* Effect.addFinalizer(() => Ref.set(closed, true));
  const ensureOpen = Effect.gen(function* () {
    if (yield* Ref.get(closed)) return yield* Effect.fail(failure("closed"));
    if ((yield* Ref.get(quarantined)) > 0) return yield* Effect.fail(failure("quarantined"));
  });
  const active = yield* Ref.make(0);
  const queued = yield* Ref.make(0);
  const snapshot = Effect.gen(function* () {
    return CitationMarkupWorkerSnapshot.make({
      processes: (yield* Ref.get(records)).length,
      closed: yield* Ref.get(closed),
      quarantined: yield* Ref.get(quarantined),
      active: yield* Ref.get(active),
      queued: yield* Ref.get(queued),
    });
  });
  const forget = Effect.fnUntraced(function* (record: CitationOwnedNativeProcess<CitationNativeLaneFailure>) {
    yield* Ref.update(
      records,
      A.filter((entry) => entry !== record)
    );
  });
  const reap = Effect.fn("Citation.reapMarkupWorker")(function* () {
    for (const record of yield* Ref.get(records)) {
      yield* record
        .retire(true)
        .pipe(Effect.mapError((error) => (error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error)));
      yield* forget(record);
    }
    yield* Ref.set(quarantined, 0);
  });
  const run = Effect.fn("Citation.runMarkupWorker")(
    function* <A, E, P, R>(
      prepare: Effect.Effect<(child: ChildProcessHandle) => Effect.Effect<A, E>, P, R>,
      start: CitationNativeStart
    ) {
      return yield* Effect.uninterruptibleMask(
        Effect.fnUntraced(function* (restore) {
          yield* ensureOpen;
          const claimed = yield* Ref.make(false);
          const activate = Ref.set(claimed, true).pipe(Effect.andThen(Ref.update(active, (value) => value + 1)));
          const release = Effect.gen(function* () {
            if (yield* Ref.getAndSet(claimed, false)) {
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
          let lease = O.none<CitationOwnedNativeProcess<CitationNativeLaneFailure>>();
          let acknowledged = false;
          let uncertain = false;
          const body = Effect.gen(function* () {
            yield* ensureOpen;
            const call = yield* prepare;
            const started = yield* start("markup", citationNativeProcessCommand(runtime, argument)).pipe(
              Effect.mapError((error) => (error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error)),
              Effect.uninterruptible
            );
            lease = O.some(started.process);
            yield* Ref.update(records, A.append(started.process));
            yield* started.onRetired(
              Effect.gen(function* () {
                acknowledged = true;
                yield* forget(started.process);
                yield* Ref.update(quarantined, (value) => (uncertain ? value - 1 : value));
                yield* release;
              })
            );
            const resource = yield* started.child.pipe(Effect.mapError((error) => failure(error.reason)));
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
          if (O.isSome(lease)) {
            const record = lease.value;
            yield* record.retire(false).pipe(
              Effect.tapError(() =>
                Ref.update(quarantined, (value) => {
                  if (acknowledged) return value;
                  uncertain = true;
                  return value + 1;
                })
              ),
              Effect.mapError((error) => (error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error))
            );
            yield* forget(record);
          }
          yield* release;
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
