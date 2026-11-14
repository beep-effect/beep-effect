/** Invocation-native capacity and confirmed occupant handover.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import {
  acquireCitationNativeLease,
  CitationNativeProcessAdmission,
  captureCitationNativeAdmission,
} from "./NativeAdmission.ts";
import { CitationNativeProcessFailureReason, makeCitationNativeProcessOwner } from "./NativeProcess.ts";
import type {
  CitationEngineLimits,
  CitationEngineOperation,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import type * as ChildProcess from "effect/process/ChildProcess";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type { CitationNativeProcessLease } from "./NativeAdmission.ts";
import type { CitationOwnedNativeProcess } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/NativeLane");
/** @internal @category models @since 0.0.0 */
export const CitationNativeKind = LiteralKit(["regex", "diff", "markup"]).pipe(
  $I.annoteSchema("CitationNativeKind", { description: "Native occupant kind within one invocation lane." })
);
/** @internal @category models @since 0.0.0 */
export type CitationNativeKind = typeof CitationNativeKind.Type;
/** @internal @category errors @since 0.0.0 */
export class CitationNativeLaneFailure extends S.TaggedError<
  CitationNativeLaneFailure,
  { readonly brand: unique symbol }
>($I`CitationNativeLaneFailure`)(
  "CitationNativeLaneFailure",
  { reason: CitationNativeProcessFailureReason },
  $I.annoteError<CitationNativeLaneFailure>("CitationNativeLaneFailure", {
    description: "Closed source-free lane ownership failure.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationNativeLaneSnapshot extends S.Opaque<
  CitationNativeLaneSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    started: S.Natural,
    confirmed: S.Natural,
    occupied: S.Boolean,
    acquired: S.Boolean,
    unitsAcquired: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationNativeLaneSnapshot", {
      description:
        "Invocation cumulative starts, confirmed retirements and native unit acquisitions, including reacquisition after cleaner yields.",
    })
  )
) {}
/** Explicit process-start shape shared by lanes and standalone cleaner starters.
 * @internal @category services @since 0.0.0
 */
export type CitationNativeStart = (
  kind: CitationNativeKind,
  command: ChildProcess.Command
) => Effect.Effect<
  {
    readonly process: CitationOwnedNativeProcess<CitationNativeLaneFailure>;
    readonly child: Exit.Exit<ChildProcessHandle, CitationNativeLaneFailure>;
    readonly onRetired: (finalizer: Effect.Effect<void>) => Effect.Effect<void>;
  },
  CitationNativeLaneFailure | CitationSafetyLimitExceeded
>;
/** One native unit and one confirmed occupant at a time, yielded across cleaner calls.
 * @internal @category services @since 0.0.0
 */
export class CitationNativeLane extends Context.Service<
  CitationNativeLane,
  {
    readonly start: CitationNativeStart;
    readonly reserve: Effect.Effect<void, CitationNativeLaneFailure | CitationSafetyLimitExceeded>;
    readonly ensureOpen: Effect.Effect<void, CitationNativeLaneFailure>;
    readonly snapshot: Effect.Effect<CitationNativeLaneSnapshot>;
    readonly yieldTo: <A, E, R>(
      body: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | CitationNativeLaneFailure | CitationSafetyLimitExceeded, R>;
  }
>()($I`CitationNativeLane`) {}
// A physical owner's Scope may confirm death independently of the job fiber.
// Late confirmation must also settle the job's private admission bookkeeping.
const makeRetirementNotification = () => {
  let retired = false;
  let listeners = A.empty<Effect.Effect<void>>();
  return {
    onRetired: (finalizer: Effect.Effect<void>) =>
      Effect.suspend(() => {
        if (retired) return finalizer;
        listeners = A.append(listeners, finalizer);
        return Effect.void;
      }).pipe(Effect.uninterruptible),
    confirm: Effect.suspend(() => {
      retired = true;
      const pending = listeners;
      listeners = [];
      return Effect.forEach(pending, (effect) => effect, { concurrency: 1, discard: true });
    }).pipe(Effect.uninterruptible),
  };
};
/** Bind native ownership to the invocation Scope; the first reservation or start claims one unit.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationNativeLane = Effect.fn("Citation.makeNativeLane")(function* (
  limits: CitationEngineLimits,
  operation: CitationEngineOperation
) {
  const admission = yield* CitationNativeProcessAdmission;
  const scope = yield* Scope.Scope;
  const nativeSpawner = yield* ChildProcessSpawner;
  const nativeClock = yield* Clock.Clock;
  const nativeContext = Context.make(ChildProcessSpawner, nativeSpawner).pipe(Context.add(Clock.Clock, nativeClock));
  const ownerFor = yield* Effect.cached(
    makeCitationNativeProcessOwner(limits, operation, (reason) => CitationNativeLaneFailure.make({ reason })).pipe(
      Effect.provideContext(nativeContext),
      Effect.provideService(Scope.Scope, scope)
    )
  );
  const lock = yield* Semaphore.make(1);
  let permit = O.none<CitationNativeProcessLease>();
  let occupant = O.none<CitationOwnedNativeProcess<CitationNativeLaneFailure>>();
  let started = 0;
  let confirmed = 0;
  let unitsAcquired = 0;
  let closed = false;
  let poisoned = false;
  let returning = false;
  let yieldDepth = 0;
  const retire = Effect.gen(function* () {
    if (O.isSome(occupant)) {
      yield* occupant.value.retire(false).pipe(
        Effect.tapError(() =>
          Effect.sync(() => {
            poisoned = true;
          })
        )
      );
      occupant = O.none();
    }
  });
  const release = Effect.gen(function* () {
    returning = true;
    yield* retire;
    if (O.isSome(permit)) {
      yield* permit.value.release;
      permit = O.none();
    }
  });
  yield* Scope.addFinalizer(
    scope,
    lock.withPermit(
      Effect.gen(function* () {
        closed = true;
        yield* release.pipe(Effect.catchCause(() => Effect.logError("Citation lane retirement remains quarantined")));
      })
    )
  );
  const acquire = Effect.fn("Citation.claimLaneUnit")(function* () {
    if (O.isNone(permit)) {
      const lease = yield* acquireCitationNativeLease(admission, operation, false, (reason) =>
        CitationNativeLaneFailure.make({ reason })
      );
      permit = O.some(lease);
      unitsAcquired++;
      yield* Effect.void.pipe(Effect.withSpan("Citation.acquireNativeLane"));
    }
    const status = yield* admission.snapshot;
    if (status.closed || status.quarantined > 0) {
      yield* release;
      return yield* CitationNativeLaneFailure.make({ reason: status.closed ? "closed" : "quarantined" });
    }
    return yield* Effect.fromOption(permit).pipe(
      Effect.mapError(() => CitationNativeLaneFailure.make({ reason: "closed" }))
    );
  });
  const availableOwner = Effect.gen(function* () {
    if (closed) return yield* CitationNativeLaneFailure.make({ reason: "closed" });
    if (poisoned) return yield* CitationNativeLaneFailure.make({ reason: "quarantined" });
    if (yieldDepth > 0) return yield* CitationNativeLaneFailure.make({ reason: "invalid-runtime" });
    const owner = yield* ownerFor;
    yield* owner.ensureOpen;
    return owner;
  });
  const reserve = lock.withPermit(availableOwner.pipe(Effect.andThen(acquire), Effect.asVoid, Effect.uninterruptible));
  const start: CitationNativeStart = Effect.fn("Citation.startNativeLane")(function* (_kind, command) {
    return yield* lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const owner = yield* availableOwner;
          yield* retire;
          const lease = yield* acquire();
          returning = false;
          const notification = makeRetirementNotification();
          let spawned = false;
          let acknowledged = false;
          const record = yield* owner
            .start(command, {
              quarantine: lease.quarantine,
              release: Effect.gen(function* () {
                if (!acknowledged) {
                  acknowledged = true;
                  if (spawned) confirmed++;
                }
                if (returning || closed) {
                  yield* lease.release;
                  if (O.isSome(permit) && permit.value === lease) permit = O.none();
                }
                yield* notification.confirm;
              }),
            })
            .pipe(
              Effect.onError(() =>
                release.pipe(Effect.catchCause(() => Effect.logError("Citation lane cleanup remains quarantined")))
              )
            );
          spawned = Exit.isSuccess(record.child);
          if (spawned) started++;
          const process: CitationOwnedNativeProcess<CitationNativeLaneFailure> = {
            retire: (retry) =>
              record.process.retire(retry).pipe(
                Effect.tapError(() =>
                  Effect.sync(() => {
                    poisoned = true;
                  })
                )
              ),
          };
          occupant = O.some(process);
          return { child: record.child, process, onRetired: notification.onRetired };
        })
      )
    );
  });
  return CitationNativeLane.of({
    start,
    reserve,
    ensureOpen: Effect.gen(function* () {
      if (closed) return yield* CitationNativeLaneFailure.make({ reason: "closed" });
      if (poisoned) return yield* CitationNativeLaneFailure.make({ reason: "quarantined" });
      const owner = yield* ownerFor;
      yield* owner.ensureOpen;
    }),
    snapshot: Effect.sync(() =>
      CitationNativeLaneSnapshot.make({
        started,
        confirmed,
        occupied: O.isSome(occupant) && started > confirmed,
        acquired: O.isSome(permit),
        unitsAcquired,
      })
    ),
    yieldTo: Effect.fn("Citation.yieldNativeLane")(function* (body) {
      return yield* Effect.uninterruptibleMask(
        Effect.fnUntraced(function* (restore) {
          // Serialize only entry/exit with start. Cleaner work can fork nested
          // plans; its logical ownership is the depth, never a fiber-held lock.
          yield* lock.withPermit(
            Effect.gen(function* () {
              if (closed) return yield* CitationNativeLaneFailure.make({ reason: "closed" });
              if (poisoned) return yield* CitationNativeLaneFailure.make({ reason: "quarantined" });
              if (yieldDepth === 0) yield* release;
              yieldDepth++;
            })
          );
          return yield* restore(body).pipe(
            Effect.ensuring(
              lock.withPermit(
                Effect.sync(() => {
                  yieldDepth--;
                })
              )
            )
          );
        })
      );
    }),
  });
});

/** Adapt a real lane reservation to the existing per-job ownership supervisor.
 *
 * **Details**
 * Admission runs when the supervisor's preparation callback acquires. Its ticket
 * never returns capacity: only lane yield or request-Scope closure can do that.
 *
 * **Example** (Keeping capacity with the invocation)
 * ```ts
 * import { CitationNativeLane, citationNativeJobReservation } from "@beep/law-practice-server/internal/Citation/NativeLane";
 * import * as Effect from "effect/Effect";
 * const reservation = Effect.flatMap(CitationNativeLane, (lane) =>
 *   lane.reserve.pipe(citationNativeJobReservation((reason) => ({ reason }))));
 * ```
 * @internal @category operations @since 0.0.0
 */
export const citationNativeJobReservation =
  <E>(failure: (reason: CitationNativeLaneFailure["reason"]) => E) =>
  (reserve: CitationNativeLane["Service"]["reserve"]) =>
    reserve.pipe(
      Effect.mapError((error) => (error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error)),
      Effect.as({ release: Effect.void, quarantine: Effect.void })
    );

/** Run one protocol-v2 job and confirm retirement before returning its result.
 * @internal @category operations @since 0.0.0
 */
export const withCitationNativeStart = Effect.fn("Citation.withNativeStart")(function* <A, E, R>(
  start: CitationNativeStart,
  kind: CitationNativeKind,
  command: ChildProcess.Command,
  body: (child: ChildProcessHandle) => Effect.Effect<A, E, R>
) {
  return yield* Effect.uninterruptibleMask(
    Effect.fnUntraced(function* (restore) {
      const record = yield* start(kind, command);
      const outcome = yield* Effect.exit(restore(Effect.flatMap(record.child, body)));
      yield* record.process.retire(false);
      return yield* outcome;
    })
  );
});

/** Standalone cleaner boundary: one shared admission lease per physical process.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationStandaloneNativeStarter = Effect.fn("Citation.makeStandaloneNativeStarter")(function* (
  limits: CitationEngineLimits,
  operation: CitationEngineOperation
) {
  const admission = yield* captureCitationNativeAdmission(limits, () =>
    CitationNativeLaneFailure.make({ reason: "invalid-runtime" })
  );
  const owner = yield* makeCitationNativeProcessOwner(limits, operation, (reason) =>
    CitationNativeLaneFailure.make({ reason })
  );
  const start: CitationNativeStart = Effect.fn("Citation.startStandaloneNative")(function* (_kind, command) {
    return yield* Effect.uninterruptible(
      Effect.gen(function* () {
        yield* owner.ensureOpen;
        const lease = yield* acquireCitationNativeLease(admission, operation, false, (reason) =>
          CitationNativeLaneFailure.make({ reason })
        );
        const notification = makeRetirementNotification();
        const record = yield* owner
          .start(command, {
            quarantine: lease.quarantine,
            release: lease.release.pipe(Effect.andThen(notification.confirm)),
          })
          .pipe(Effect.onError(() => lease.release));
        return { ...record, onRetired: notification.onRetired };
      })
    );
  });
  return { start, snapshot: owner.snapshot, reap: owner.reap };
});
