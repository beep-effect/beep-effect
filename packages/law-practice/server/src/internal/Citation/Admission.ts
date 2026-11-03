/** Shared operation admission for one composed citation engine lifetime.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";

const $I = $LawPracticeServerId.create("internal/Citation/Admission");
const Limits = S.toType(CitationEngineLimits);
const Reason = LiteralKit(["invalid-policy", "closed", "quarantined"]).pipe(
  $I.annoteSchema("Reason", { description: "Redacted private admission construction or lifetime failure." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationAdmissionFailure extends S.TaggedError<
  CitationAdmissionFailure,
  { readonly brand: unique symbol }
>($I`CitationAdmissionFailure`)(
  "CitationAdmissionFailure",
  { reason: Reason },
  $I.annoteError<CitationAdmissionFailure>("CitationAdmissionFailure", {
    description: "Operation admission failed without source content or nested causes.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationAdmissionSnapshot extends S.Opaque<CitationAdmissionSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({ active: S.Natural, queued: S.Natural, closed: S.Boolean }).pipe(
    $I.annoteSchema("CitationAdmissionSnapshot", {
      description: "Source-free counters for one shared engine admission owner.",
    })
  )
) {}
/** Captured operation boundary; nested cleaner stages reuse their enclosing operation.
 * @internal @category services @since 0.0.0
 */
export class CitationOperationAdmission extends Context.Service<
  CitationOperationAdmission,
  {
    readonly run: <A, E>(
      operation: CitationSafetyLimitExceeded["operation"],
      body: Effect.Effect<A, E>
    ) => Effect.Effect<A, E | CitationAdmissionFailure | CitationSafetyLimitExceeded>;
    readonly snapshot: Effect.Effect<CitationAdmissionSnapshot>;
  }
>()($I`CitationOperationAdmission`) {}
/** Capture explicit policy, Clock and Scope once for all operations in a composed engine.
 * Queue time is included in the total operation deadline. Cancellation and closure
 * wait for the operation's finalizers before returning its active permit.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationOperationAdmission = Effect.fn("Citation.makeOperationAdmission")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(
    Effect.mapError(() => CitationAdmissionFailure.make({ reason: "invalid-policy" }))
  );
  const queueDeadline = limits.queueDeadline.pipe(Duration.toMillis, Duration.millis);
  const operationDeadline = limits.operationDeadline.pipe(Duration.toMillis, Duration.millis);
  const clock = yield* Clock.Clock;
  const scope = yield* Scope.Scope;
  const slots = yield* Semaphore.make(limits.concurrentOperations);
  const queueSlots = yield* Semaphore.make(limits.queuedOperations);
  const active = yield* Ref.make(0);
  const queued = yield* Ref.make(0);
  const closed = yield* Deferred.make<void>();
  const failure = () => CitationAdmissionFailure.make({ reason: "closed" });
  const ensureOpen = Effect.gen(function* () {
    if (yield* Deferred.isDone(closed)) return yield* failure();
  });
  yield* Scope.addFinalizer(
    scope,
    Deferred.succeed(closed, undefined).pipe(
      Effect.andThen(slots.withPermits(limits.concurrentOperations)(Effect.void)),
      Effect.andThen(queueSlots.withPermits(limits.queuedOperations)(Effect.void)),
      Effect.asVoid
    )
  );
  const wait = Effect.fn("Citation.waitForOperationAdmission")(
    (operation: CitationSafetyLimitExceeded["operation"], activate: Effect.Effect<void>) =>
      Effect.acquireUseRelease(
        Effect.gen(function* () {
          if (!(yield* queueSlots.takeIfAvailable(1)))
            return yield* CitationSafetyLimitExceeded.make({ operation, limit: "queuedOperations" });
          yield* Ref.update(queued, (count) => count + 1);
        }),
        () =>
          slots.take(1).pipe(
            Effect.timeoutOrElse({
              duration: queueDeadline,
              orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: "queueDeadline" })),
            }),
            Effect.interruptible,
            Effect.andThen(activate)
          ),
        () => Ref.update(queued, (count) => count - 1).pipe(Effect.andThen(queueSlots.release(1)))
      )
  );
  const run = Effect.fn("Citation.admitOperation")(
    function* <A, E>(operation: CitationSafetyLimitExceeded["operation"], body: Effect.Effect<A, E>) {
      return yield* Effect.uninterruptibleMask(
        Effect.fnUntraced(function* (restore) {
          const claimed = yield* Ref.make(false);
          const activate = Ref.set(claimed, true).pipe(Effect.andThen(Ref.update(active, (count) => count + 1)));
          const release = Effect.gen(function* () {
            if (!(yield* Ref.getAndSet(claimed, false))) return;
            yield* Ref.update(active, (count) => count - 1);
            yield* slots.release(1);
          });
          return yield* Effect.gen(function* () {
            yield* ensureOpen;
            if (yield* slots.takeIfAvailable(1)) yield* activate;
            else yield* wait(operation, activate);
            return yield* restore(ensureOpen.pipe(Effect.andThen(body)));
          }).pipe(Effect.ensuring(release));
        })
      ).pipe(
        Effect.raceFirst(Deferred.await(closed).pipe(Effect.andThen(Effect.fail(failure())))),
        Effect.timeoutOrElse({
          duration: operationDeadline,
          orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: "operationDeadline" })),
        })
      );
    },
    Effect.provideService(Clock.Clock, clock)
  );
  return CitationOperationAdmission.of({
    run,
    snapshot: Effect.gen(function* () {
      return CitationAdmissionSnapshot.make({
        active: yield* Ref.get(active),
        queued: yield* Ref.get(queued),
        closed: yield* Deferred.isDone(closed),
      });
    }),
  });
});
