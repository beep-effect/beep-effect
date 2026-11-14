/**
 * Captured, lazy cleaner orchestration adapted from eyecite 2.7.6 clean.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * Captures the public cleaner port; live server adapters retain value ownership.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCleaner,
  CitationCleanerFailure,
  CitationCleanerRun,
  CitationCleanerTextCharge,
  CitationCleanerWorkSnapshot,
  CitationEngineAbsoluteMaxima,
  CitationEngineCleanInput,
  CitationLiveCleanerObject,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationInvocation } from "./Invocation.ts";
import { makeCitationTextCapacity } from "./TextCapacity.ts";
import type {
  CitationCleanerObject,
  CitationCleanerWork,
  CitationEngineLimits,
} from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/CleanerPipeline");
const Plan = CitationEngineCleanInput.fields.plan;
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
type Failure = CitationCleanerFailure | CitationSafetyLimitExceeded;
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
export const makeCitationCleanerPipeline = Effect.fn("Citation.makeCleanerPipeline")(function* (
  limits: CitationEngineLimits
) {
  const clock = yield* Clock.Clock;
  const runtime = yield* CitationCleaner;
  const sanitize = <A, R>(body: Effect.Effect<A, Failure, R>): Effect.Effect<A, Failure, R> =>
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
    const parent = (yield* CitationInvocation).budget;
    const state = yield* Ref.make(CitationCleanerWorkSnapshot.make({ producedTextUtf16: 0, closed: false }));
    const issued = new WeakMap<CitationCleanerTextCharge, number>();
    const capacity = yield* makeCitationTextCapacity(() => fail("invalid-reservation"));
    const exclusive = capacity.exclusive;
    const ensureOpen = Ref.get(state).pipe(
      Effect.flatMap((value) => (value.closed ? Effect.fail(fail("closed-work")) : Effect.void))
    );
    // Callers pass amounts already decoded as positive integers (ReservationUnits/Units).
    const reserveUnlocked = Effect.fn("Citation.reserveCleanerText")(function* (amount: number) {
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
    const releaseUnlocked = (ticket: CitationCleanerTextCharge) =>
      Effect.sync(() => issued.delete(ticket)).pipe(
        Effect.andThen(
          Ref.update(state, (current) =>
            CitationCleanerWorkSnapshot.make({
              ...current,
              producedTextUtf16: current.producedTextUtf16 - ticket.units,
            })
          )
        )
      );
    // The parent ledger has no refund, so the cleaner commits atomically first and
    // is rolled back if the parent refuses or the wait for it is interrupted.
    const reserveText = (units: number) =>
      exclusive(
        S.decodeEffect(ReservationUnits)(units).pipe(
          Effect.mapError(() => fail("invalid-reservation")),
          Effect.flatMap((amount) =>
            Effect.uninterruptibleMask((restore) =>
              reserveUnlocked(amount).pipe(
                Effect.tap((ticket) =>
                  restore(parent.reserve(amount)).pipe(Effect.onError(() => releaseUnlocked(ticket)))
                )
              )
            )
          )
        )
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
                const result = yield* parent.withCapacity((available) =>
                  run(available < remaining ? available : remaining)
                );
                return result.value;
              })
            )
          )
        )
      );
    const takeCharge = Effect.fnUntraced(function* (charge: CitationCleanerTextCharge) {
      const reserved = issued.get(charge);
      if (reserved === undefined || charge.units !== reserved) return yield* fail("invalid-reservation");
      issued.delete(charge);
      return reserved;
    });
    const consume = Effect.fn("Citation.consumeCleanerText")(function* (
      charges: ReadonlyArray<CitationCleanerTextCharge>,
      units: number
    ) {
      const actual = yield* S.decodeEffect(Units)(units).pipe(Effect.mapError(() => fail("invalid-reservation")));
      let total = 0;
      let index = 0;
      for (const charge of charges) {
        if (index % 4096 === 0) {
          yield* ensureOpen;
          yield* Effect.yieldNow;
        }
        total += yield* takeCharge(charge);
        index++;
        if (total > actual) return yield* fail("invalid-reservation");
      }
      yield* ensureOpen;
      if (total !== actual) return yield* fail("invalid-reservation");
    });
    const consumeUnchanged = Effect.fnUntraced(function* (value: CitationCleanerObject, chargeParent: boolean) {
      const units = yield* runtime.textUnits(value);
      if (O.isSome(units)) {
        const amount = yield* S.decodeEffect(S.Natural)(units.value).pipe(
          Effect.mapError(() => fail("invalid-reservation"))
        );
        if (amount > 0) {
          const charge = yield* chargeParent ? reserveText(amount) : exclusive(reserveUnlocked(amount));
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
      initial: CitationCleanerObject,
      chargeUnchangedParent = true
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
          if (steps === 0) yield* consumeUnchanged(value, chargeUnchangedParent);
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
      execute,
      close: Ref.update(state, (current) => CitationCleanerWorkSnapshot.make({ ...current, closed: true })),
    };
  });
  const runInitial = Effect.fn("Citation.runOwnedCleanerPlan")(function* (
    plan: string,
    initial: Effect.Effect<CitationCleanerObject, Failure>,
    chargeUnchangedParent = true
  ) {
    return yield* Effect.acquireUseRelease(
      makeWork,
      ({ work, execute }) =>
        sanitize(
          Effect.gen(function* () {
            const value = yield* initial;
            const result = yield* execute(plan, value, chargeUnchangedParent);
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
     * Unchanged input is counted locally without another parent allocation:
     * the enclosing operation owns its source reservation. New callback/builtin
     * output still charges both ledgers. Uses the same timers and close path.
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
          }),
          false
        );
      },
      sanitize,
      Effect.provideService(Clock.Clock, clock)
    ),
  };
});
