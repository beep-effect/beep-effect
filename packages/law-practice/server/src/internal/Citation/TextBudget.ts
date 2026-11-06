/** Invocation-owned parent text reservations for composed citation stages.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { prepareCitationAdmissionPolicy } from "./Admission.ts";
import { makeCitationTextCapacity } from "./TextCapacity.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TextBudget");
const Amount = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)).pipe(
  $I.annoteSchema("Amount", { description: "Bounded native allocation charge in parent-owned UTF-16 units." })
);
const exhausted = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" });
/** One invocation's cumulative allocation authority. Reservations are not refunded
 * on failure or retried by an enclosing Effect transaction: allocated buffers
 * are external to transaction rollback. Install a fresh owner per invocation.
 * @internal @category services @since 0.0.0
 */
export class CitationTextBudget extends Context.Service<
  CitationTextBudget,
  {
    readonly maximum: number;
    readonly reserve: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded>;
    readonly snapshot: Effect.Effect<number>;
    /** The captured producer enforces the allowance before output allocation and
     * completes cleanup before return. Failure/interruption publishes no output
     * or successful charge. Reentry, including child fibers, is forbidden.
     */
    readonly withCapacity: <A, E>(
      produce: (remaining: number) => Effect.Effect<{ readonly value: A; readonly units: number }, E>
    ) => Effect.Effect<{ readonly value: A; readonly units: number }, E | CitationSafetyLimitExceeded>;
  }
>()($I`CitationTextBudget`) {}
/** Share a schema-owned ceiling using Effect's atomic Ref.modify. Rejected
 * charges leave the counter unchanged; methods require no caller services.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTextBudget = Effect.fn("Citation.makeTextBudget")(function* (policy: unknown) {
  const { limits } = yield* prepareCitationAdmissionPolicy(policy);
  const used = yield* Ref.make(0);
  const capacity = yield* makeCitationTextCapacity(exhausted);
  const reserveUnlocked = Effect.fn("Citation.reserveInvocationText")(function* (input: number) {
    const units = yield* S.decodeEffect(Amount)(input).pipe(Effect.mapError(exhausted));
    const accepted = yield* Ref.modify(used, (current) =>
      units <= limits.producedTextUtf16 - current ? Tuple.make(true, current + units) : Tuple.make(false, current)
    );
    if (!accepted) return yield* exhausted();
  });
  const reserve = (units: number) => capacity.exclusive(reserveUnlocked(units));
  const withCapacity: CitationTextBudget["Service"]["withCapacity"] = (produce) =>
    capacity.borrow(
      Effect.uninterruptibleMask(
        Effect.fnUntraced(function* (restore) {
          const remaining = limits.producedTextUtf16 - (yield* Ref.get(used));
          const result = yield* restore(produce(remaining));
          yield* reserveUnlocked(result.units);
          return result;
        })
      )
    );
  return CitationTextBudget.of({ maximum: limits.producedTextUtf16, reserve, snapshot: Ref.get(used), withCapacity });
});
/** Capture an optional composed owner at installation, preserving standalone
 * stage policy behavior. Later caller contexts cannot replace this authority.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationTextReservation = Effect.serviceOption(CitationTextBudget).pipe(
  Effect.map(O.match({ onNone: () => constant(Effect.void), onSome: (budget) => budget.reserve }))
);
