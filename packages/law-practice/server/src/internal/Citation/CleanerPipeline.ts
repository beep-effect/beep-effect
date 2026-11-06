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
import * as Str from "effect/String";
import { CitationTextBudget } from "./TextBudget.ts";
import { makeCitationTextCapacity } from "./TextCapacity.ts";

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
/** @internal @category models @since 0.0.0 */
export const CitationLiveCleanerObject = S.declare<CitationCleanerObject>((value): value is CitationCleanerObject =>
  S.is(CitationCleanerObject)(value)
).pipe(
  $I.annoteSchema("CitationLiveCleanerObject", {
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
  S.Struct({ value: CitationLiveCleanerObject, charges: S.Array(LiveCharge) }).pipe(
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
const OwnedRequest = S.Struct({ value: CitationLiveCleanerObject, plan: Plan }).pipe(
  $I.annoteSchema("OwnedRequest", {
    description:
      "An issued immutable native/host value and captured server plan; structural decoding does not grant ownership.",
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
  S.Struct({ value: CitationLiveCleanerObject, producedTextUtf16: S.Natural }).pipe(
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
   * returning. No ledger reentry is permitted from the borrowing fiber or its children. Empty
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
  const parent = yield* Effect.serviceOption(CitationTextBudget);
  if (O.isSome(parent) && parent.value.maximum > limits.producedTextUtf16) return yield* fail("invalid-input");
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
    const capacity = yield* makeCitationTextCapacity(() => fail("invalid-reservation"));
    const exclusive = capacity.exclusive;
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
    const reserveText = (units: number) =>
      exclusive(
        Effect.gen(function* () {
          const amount = yield* S.decodeEffect(ReservationUnits)(units).pipe(
            Effect.mapError(() => fail("invalid-reservation"))
          );
          yield* ensureOpen;
          const current = yield* Ref.get(state);
          if (amount > limits.producedTextUtf16 - current.producedTextUtf16) return yield* safety("producedTextUtf16");
          if (O.isSome(parent)) yield* parent.value.reserve(amount);
          return yield* Effect.uninterruptible(reserveUnlocked(amount));
        })
      );
    const withTextCapacity: CitationCleanerWork["withTextCapacity"] = (produce) =>
      capacity.borrow(
        ensureOpen.pipe(
          Effect.andThen(
            Effect.uninterruptibleMask(
              Effect.fnUntraced(function* (restore) {
                const remaining = limits.producedTextUtf16 - (yield* Ref.get(state)).producedTextUtf16;
                const run = Effect.fnUntraced(function* (allowance: number) {
                  const result = yield* restore(produce(allowance));
                  const units = yield* S.decodeEffect(Units)(result.units).pipe(
                    Effect.mapError(() => fail("invalid-reservation"))
                  );
                  if (units > allowance) return yield* safety("producedTextUtf16");
                  yield* ensureOpen;
                  const charges = units === 0 ? [] : [yield* reserveUnlocked(units)];
                  return { value: { value: result.value, charges }, units };
                });
                const result = O.isSome(parent)
                  ? yield* parent.value.withCapacity((available) => run(available < remaining ? available : remaining))
                  : yield* run(remaining);
                return result.value;
              })
            )
          )
        )
      );
    const takeCharge = Effect.fnUntraced(function* (charge: CitationCleanerTextCharge | undefined) {
      const reserved = charge === undefined ? undefined : issued.get(charge);
      if (reserved === undefined || charge === undefined || charge.units !== reserved)
        return yield* fail("invalid-reservation");
      issued.delete(charge);
      return reserved;
    });
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
        total += yield* takeCharge(charges[index]);
        if (total > actual) return yield* fail("invalid-reservation");
      }
      yield* ensureOpen;
      if (total !== actual) return yield* fail("invalid-reservation");
    });
    const consumeUnchanged = Effect.fnUntraced(function* (value: CitationCleanerObject) {
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
    });
    const lookupCallable = Effect.fnUntraced(function* (value: CitationCleanerObject) {
      if (yield* runtime.contains(value, work)) return yield* runtime.get(value, work);
      if (yield* runtime.callable(value, work)) return value;
      return yield* fail("unknown-step");
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
          if (steps === 0) yield* consumeUnchanged(value);
          return value;
        }
        yield* runtime.assertOwned(next.value);
        const callable = yield* lookupCallable(next.value);
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
  const runInitial = Effect.fn("Citation.runOwnedCleanerPlan")(function* (
    plan: string,
    initial: Effect.Effect<CitationCleanerObject, Failure>
  ) {
    return yield* Effect.acquireUseRelease(
      makeWork,
      ({ work }) =>
        sanitize(
          Effect.gen(function* () {
            const value = yield* initial;
            const result = yield* work.nested(plan, value);
            return CitationCleanerRun.make({
              value: result,
              producedTextUtf16: (yield* work.snapshot).producedTextUtf16,
            });
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
  });
  return {
    run: Effect.fn("Citation.runCleanerPipeline")(
      function* (input: unknown) {
        if (P.isObject(input) && P.isString(input.text) && Str.length(input.text) > limits.sourceUtf16)
          return yield* safety("sourceUtf16");
        const request = yield* S.decodeUnknownEffect(Request, { onExcessProperty: "error" })(input).pipe(
          Effect.mapError(() => fail("invalid-input"))
        );
        return yield* runInitial(request.plan, runtime.fromText(request.text));
      },
      sanitize,
      Effect.provideService(Clock.Clock, clock)
    ),
    /** Run an already-issued value without projecting native words or replacing
     * its object identity. The enclosing document owns the initial handle.
     * Uses the same work ledger, timers, invocation and close path as raw text.
     */
    runOwned: Effect.fn("Citation.runOwnedCleanerPipeline")(
      function* (input: unknown) {
        const request = yield* S.decodeUnknownEffect(OwnedRequest, { onExcessProperty: "error" })(input).pipe(
          Effect.mapError(() => fail("invalid-input"))
        );
        return yield* runInitial(
          request.plan,
          Effect.gen(function* () {
            yield* runtime.assertOwned(request.value);
            const units = yield* runtime.textUnits(request.value);
            if (O.isSome(units) && units.value > limits.sourceUtf16) return yield* safety("sourceUtf16");
            return request.value;
          })
        );
      },
      sanitize,
      Effect.provideService(Clock.Clock, clock)
    ),
  };
});
