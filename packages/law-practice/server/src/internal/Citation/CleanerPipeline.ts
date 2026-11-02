/**
 * Captured, lazy cleaner orchestration adapted from eyecite 2.7.6 clean.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * This execution seam has no live default adapter or global admission Layer.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";

const CitationEngineLimitsType = S.toType(CitationEngineLimits);

const $I = $LawPracticeServerId.create("internal/Citation/CleanerPipeline");
/**
 * An adapter-owned runtime value/step/function identity. Decoding this data does
 * not issue ownership; the captured adapter must validate its original handle.
 * No host value or callable is serialized in this schema.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationCleanerObject extends S.Opaque<CitationCleanerObject, { readonly brand: unique symbol }>()(
  S.Struct({ slot: S.Natural }).pipe(
    $I.annoteSchema("CitationCleanerObject", {
      description: "Private runtime identity; never a citation, source anchor or persisted entity ID.",
    })
  )
) {}
/**
 * A positive text charge. Issuance and single consumption are checked by the
 * operation's private weak map; a structural clone has no spending authority.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationCleanerTextCharge extends S.Opaque<CitationCleanerTextCharge, { readonly brand: unique symbol }>()(
  S.Struct({
    units: S.Int.check(S.isBetween({ minimum: 1, maximum: CitationEngineAbsoluteMaxima.producedTextUtf16 })),
  }).pipe(
    $I.annoteSchema("CitationCleanerTextCharge", {
      description: "Source-free, operation-issued text reservation; zero text needs no charge object.",
    })
  )
) {}
// A structural decoder reconstructs data. These fields instead carry live
// adapter/operation handles unchanged; their owner still rejects decoded copies.
const LiveObject = S.declare<CitationCleanerObject>((value): value is CitationCleanerObject =>
  S.is(CitationCleanerObject)(value)
).pipe(
  $I.annoteSchema("LiveObject", {
    description: "Preserve a live reference's identity while validating its shape; ownership is checked separately.",
  })
);
const LiveCharge = S.declare<CitationCleanerTextCharge>((value): value is CitationCleanerTextCharge =>
  S.is(CitationCleanerTextCharge)(value)
).pipe(
  $I.annoteSchema("LiveCharge", {
    description: "Preserve the operation's exact reservation token; decoding data never issues a reservation.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationCleanerProduced extends S.Opaque<CitationCleanerProduced, { readonly brand: unique symbol }>()(
  S.Struct({ value: LiveObject, charges: S.Array(LiveCharge) }).pipe(
    $I.annoteSchema("CitationCleanerProduced", {
      description:
        "Runtime result plus reservations made before materializing its text; non-text results have no text charge.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCleanerWorkSnapshot extends S.Opaque<
  CitationCleanerWorkSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({ producedTextUtf16: S.Natural, closed: S.Boolean }).pipe(
    $I.annoteSchema("CitationCleanerWorkSnapshot", {
      description: "One operation's cumulative text reservations and lifetime, without source content.",
    })
  )
) {}
const Plan = S.NonEmptyString.check(S.isMaxLength(4096)).pipe(
  $I.annoteSchema("Plan", { description: "Trusted registered server program selector; never executable request code." })
);
const Request = S.Struct({
  text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16)),
  plan: Plan,
}).pipe(
  $I.annoteSchema("Request", {
    description: "Private raw-text invocation of a captured server plan, not the final public cleaner request.",
  })
);
const Reason = LiteralKit([
  "invalid-input",
  "unknown-plan",
  "unknown-step",
  "lookup-key-missing",
  "not-callable",
  "callback-failed",
  "iteration-failed",
  "unissued-value",
  "closed-work",
  "invalid-reservation",
  "runtime-failed",
  "closed-owner",
  "identity-exhausted",
  "invalid-text-allocation",
  "builtin-input-type",
  "html-parse-error",
  "html-unicode-encoding-declaration",
  "html-unicode-decode-error",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed private execution/adapter failures; no native messages, host values or nested causes.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationCleanerFailure extends S.TaggedError<CitationCleanerFailure, { readonly brand: unique symbol }>(
  $I`CitationCleanerFailure`
)(
  "CitationCleanerFailure",
  { reason: Reason },
  $I.annoteError<CitationCleanerFailure>("CitationCleanerFailure", {
    description: "Redacted cleaner execution failure pending the complete engine translator.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCleanerRun extends S.Opaque<CitationCleanerRun, { readonly brand: unique symbol }>()(
  S.Struct({ value: LiveObject, producedTextUtf16: S.Natural }).pipe(
    $I.annoteSchema("CitationCleanerRun", {
      description: "Private complete result identity and logical work; no partial result accompanies failure.",
    })
  )
) {}
type Failure = CitationCleanerFailure | CitationSafetyLimitExceeded;
/** Runtime cursor: no iterator or function is placed in request data. @internal @category services @since 0.0.0 */
export interface CitationCleanerCursor {
  readonly next: Effect.Effect<O.Option<CitationCleanerObject>, Failure>;
}
/**
 * A runtime capability captured by adapter code. Reserve positive units before
 * materializing text, then return those exact tickets with the produced value.
 * Nested execution shares these charges and the enclosing timer. Adapters must
 * own/retire native work and must not detach callback work.
 * @internal
 * @category services
 * @since 0.0.0
 */
export interface CitationCleanerWork {
  readonly nested: (plan: string, initial: CitationCleanerObject) => Effect.Effect<CitationCleanerObject, Failure>;
  readonly reserveText: (units: number) => Effect.Effect<CitationCleanerTextCharge, Failure>;
  readonly snapshot: Effect.Effect<CitationCleanerWorkSnapshot>;
  /**
   * Exclusively lend remaining capacity to a captured bounded producer. It must
   * enforce this ceiling before allocating output and retire native work before
   * returning. No ledger reentry is permitted from the borrowing fiber. Empty
   * output is valid even at zero capacity; settlement issues no empty ticket.
   */
  readonly withTextCapacity: <A, E>(
    produce: (remaining: number) => Effect.Effect<{ readonly value: A; readonly units: number }, E>
  ) => Effect.Effect<{ readonly value: A; readonly charges: ReadonlyArray<CitationCleanerTextCharge> }, E | Failure>;
}
/**
 * All host values, callables, registries and iterator state stay in a captured
 * server adapter. Every method returns R = never. `contains` and `get` are
 * separate observable operations. `invoke` must reserve text before allocation;
 * `textUnits` inspects owned text without invoking user length/coercion hooks.
 * Default primitive/native adapters, ownership issuance and their safety laws
 * are integration work; this service does not license unsafe arbitrary code.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationCleanerRuntime extends Context.Service<
  CitationCleanerRuntime,
  {
    readonly fromText: (text: string) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly assertOwned: (value: CitationCleanerObject) => Effect.Effect<void, Failure>;
    readonly textUnits: (value: CitationCleanerObject) => Effect.Effect<O.Option<number>, Failure>;
    readonly open: (
      plan: string,
      initial: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerCursor, Failure>;
    readonly contains: (step: CitationCleanerObject, work: CitationCleanerWork) => Effect.Effect<boolean, Failure>;
    readonly get: (
      step: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly callable: (value: CitationCleanerObject, work: CitationCleanerWork) => Effect.Effect<boolean, Failure>;
    readonly invoke: (
      callable: CitationCleanerObject,
      value: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerProduced, Failure>;
  }
>()($I`CitationCleanerRuntime`) {}
const fail = (reason: CitationCleanerFailure["reason"]) => CitationCleanerFailure.make({ reason });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit });
const ReservationUnits = S.Int.check(S.isGreaterThan(0));
const Units = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16));
/**
 * Capture policy, Clock and runtime once. Execute lazy plans without coercing
 * host values. Each top-level call owns one text budget and timer; reentrant
 * calls reuse both. Global queue/admission, native retirement, default adapters
 * and public service integration remain outside this private execution seam.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationCleanerPipeline = Effect.fn("Citation.makeCleanerPipeline")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(CitationEngineLimitsType)(policy).pipe(
    Effect.mapError(() => fail("invalid-input"))
  );
  const clock = yield* Clock.Clock;
  const runtime = yield* CitationCleanerRuntime;
  const sanitize = <A>(body: Effect.Effect<A, Failure>): Effect.Effect<A, Failure> =>
    body.pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterrupts(cause))
          return Effect.failCause(
            Cause.fromReasons(
              A.map(A.filter(cause.reasons, Cause.isInterruptReason), (reason) =>
                Cause.makeInterruptReason(reason.fiberId)
              )
            )
          );
        const error = Cause.findErrorOption(cause);
        if (O.isSome(error) && S.is(CitationCleanerFailure)(error.value)) return Effect.fail(fail(error.value.reason));
        if (O.isSome(error) && S.is(CitationSafetyLimitExceeded)(error.value))
          return Effect.fail(safety(error.value.limit));
        return Effect.fail(fail("runtime-failed"));
      })
    );
  const makeWork = Effect.gen(function* () {
    const state = yield* Ref.make(CitationCleanerWorkSnapshot.make({ producedTextUtf16: 0, closed: false }));
    const issued = new WeakMap<CitationCleanerTextCharge, number>();
    const capacity = yield* Semaphore.make(1);
    let borrower = O.none<number>();
    const exclusive = <A, E>(body: Effect.Effect<A, E>): Effect.Effect<A, E | Failure> =>
      Effect.withFiber((fiber) =>
        Effect.suspend(
          (): Effect.Effect<A, E | Failure> =>
            O.isSome(borrower) && borrower.value === fiber.id
              ? Effect.fail(fail("invalid-reservation"))
              : capacity.withPermit(body)
        )
      );
    const ensureOpen = Ref.get(state).pipe(
      Effect.flatMap((value) => (value.closed ? Effect.fail(fail("closed-work")) : Effect.void))
    );
    const reserveUnlocked = Effect.fn("Citation.reserveCleanerText")(function* (units: number) {
      const amount = yield* S.decodeEffect(ReservationUnits)(units).pipe(
        Effect.mapError(() => fail("invalid-reservation"))
      );
      return yield* Ref.modify(
        state,
        (current): readonly [Effect.Effect<CitationCleanerTextCharge, Failure>, CitationCleanerWorkSnapshot] => {
          if (current.closed) return [Effect.fail(fail("closed-work")), current];
          if (amount > limits.producedTextUtf16 - current.producedTextUtf16)
            return [Effect.fail(safety("producedTextUtf16")), current];
          const ticket = CitationCleanerTextCharge.make({ units: amount });
          issued.set(ticket, amount);
          return [
            Effect.succeed(ticket),
            CitationCleanerWorkSnapshot.make({ producedTextUtf16: current.producedTextUtf16 + amount, closed: false }),
          ];
        }
      ).pipe(Effect.flatten);
    });
    const reserveText = (units: number) => exclusive(reserveUnlocked(units));
    const withTextCapacity: CitationCleanerWork["withTextCapacity"] = (produce) =>
      exclusive(
        Effect.withFiber((fiber) =>
          Effect.acquireUseRelease(
            ensureOpen.pipe(
              Effect.andThen(
                Effect.sync(() => {
                  borrower = O.some(fiber.id);
                })
              )
            ),
            () =>
              Effect.gen(function* () {
                const remaining = limits.producedTextUtf16 - (yield* Ref.get(state)).producedTextUtf16;
                const result = yield* produce(remaining);
                const units = yield* S.decodeEffect(Units)(result.units).pipe(
                  Effect.mapError(() => fail("invalid-reservation"))
                );
                yield* ensureOpen;
                const charges = units === 0 ? [] : [yield* reserveUnlocked(units)];
                return { value: result.value, charges };
              }),
            () =>
              Effect.sync(() => {
                borrower = O.none();
              })
          )
        )
      );
    const consume = Effect.fn("Citation.consumeCleanerText")(function* (
      charges: ReadonlyArray<CitationCleanerTextCharge>,
      units: number
    ) {
      const actual = yield* S.decodeEffect(Units)(units).pipe(Effect.mapError(() => fail("invalid-reservation")));
      let total = 0;
      for (let index = 0; index < charges.length; index++) {
        if (index % 4096 === 0) {
          yield* ensureOpen;
          yield* Effect.yieldNow;
        }
        const charge = charges[index];
        const reserved = charge === undefined ? undefined : issued.get(charge);
        if (reserved === undefined || charge === undefined || charge.units !== reserved)
          return yield* fail("invalid-reservation");
        issued.delete(charge);
        total += reserved;
        if (total > actual) return yield* fail("invalid-reservation");
      }
      yield* ensureOpen;
      if (total !== actual) return yield* fail("invalid-reservation");
    });
    const execute = Effect.fn("Citation.executeCleanerPlan")(function* (
      plan: string,
      initial: CitationCleanerObject
    ): Effect.fn.Return<CitationCleanerObject, Failure> {
      yield* ensureOpen;
      const selected = yield* S.decodeEffect(Plan)(plan).pipe(Effect.mapError(() => fail("invalid-input")));
      yield* runtime.assertOwned(initial);
      const cursor = yield* runtime.open(selected, initial, work);
      let value = initial;
      let steps = 0;
      while (true) {
        yield* ensureOpen;
        yield* Effect.yieldNow;
        const next = yield* cursor.next;
        if (O.isNone(next)) {
          if (steps === 0) {
            const units = yield* runtime.textUnits(value);
            if (O.isSome(units)) {
              const amount = yield* S.decodeEffect(S.Natural)(units.value).pipe(
                Effect.mapError(() => fail("invalid-reservation"))
              );
              if (amount > 0) {
                const charge = yield* reserveText(amount);
                yield* consume([charge], amount);
              }
            }
          }
          return value;
        }
        yield* runtime.assertOwned(next.value);
        let callable: CitationCleanerObject;
        if (yield* runtime.contains(next.value, work)) callable = yield* runtime.get(next.value, work);
        else if (yield* runtime.callable(next.value, work)) callable = next.value;
        else return yield* fail("unknown-step");
        yield* runtime.assertOwned(callable);
        const produced = yield* runtime.invoke(callable, value, work);
        yield* runtime.assertOwned(produced.value);
        const units = yield* runtime.textUnits(produced.value);
        yield* consume(
          produced.charges,
          O.getOrElse(units, () => 0)
        );
        value = produced.value;
        steps++;
      }
    });
    const work: CitationCleanerWork = {
      reserveText,
      withTextCapacity,
      snapshot: Ref.get(state),
      nested: Effect.fn("Citation.nestedCleanerPlan")(
        (plan: string, initial: CitationCleanerObject) => sanitize(execute(plan, initial)),
        Effect.provideService(Clock.Clock, clock)
      ),
    };
    return {
      work,
      close: Ref.update(state, (current) => CitationCleanerWorkSnapshot.make({ ...current, closed: true })),
    };
  });
  return {
    run: Effect.fn("Citation.runCleanerPipeline")(
      function* (input: unknown) {
        if (P.isObject(input) && P.isString(input.text) && Str.length(input.text) > limits.sourceUtf16)
          return yield* safety("sourceUtf16");
        const request = yield* S.decodeUnknownEffect(Request, { onExcessProperty: "error" })(input).pipe(
          Effect.mapError(() => fail("invalid-input"))
        );
        return yield* Effect.acquireUseRelease(
          makeWork,
          ({ work }) =>
            sanitize(
              Effect.gen(function* () {
                const initial = yield* runtime.fromText(request.text);
                const value = yield* work.nested(request.plan, initial);
                return CitationCleanerRun.make({ value, producedTextUtf16: (yield* work.snapshot).producedTextUtf16 });
              })
            ).pipe(
              Effect.timeoutOrElse({
                duration: limits.cleanDeadline,
                orElse: () => Effect.fail(safety("cleanDeadline")),
              }),
              Effect.timeoutOrElse({
                duration: limits.operationDeadline,
                orElse: () => Effect.fail(safety("operationDeadline")),
              })
            ),
          ({ close }) => close
        );
      },
      sanitize,
      Effect.provideService(Clock.Clock, clock)
    ),
  };
});
