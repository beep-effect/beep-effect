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
    readonly reserve: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded>;
    readonly snapshot: Effect.Effect<number>;
  }
>()($I`CitationTextBudget`) {}
/** Share a schema-owned ceiling using Effect's atomic Ref.modify. Rejected
 * charges leave the counter unchanged; methods require no caller services.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTextBudget = Effect.fn("Citation.makeTextBudget")(function* (policy: unknown) {
  const { limits } = yield* prepareCitationAdmissionPolicy(policy);
  const used = yield* Ref.make(0);
  const reserve = Effect.fn("Citation.reserveInvocationText")(function* (input: number) {
    const units = yield* S.decodeEffect(Amount)(input).pipe(Effect.mapError(exhausted));
    const accepted = yield* Ref.modify(used, (current) =>
      units <= limits.producedTextUtf16 - current ? Tuple.make(true, current + units) : Tuple.make(false, current)
    );
    if (!accepted) return yield* exhausted();
  });
  return CitationTextBudget.of({ reserve, snapshot: Ref.get(used) });
});
/** Capture an optional composed owner at installation, preserving standalone
 * stage policy behavior. Later caller contexts cannot replace this authority.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationTextReservation = Effect.serviceOption(CitationTextBudget).pipe(
  Effect.map(O.match({ onNone: () => constant(Effect.void), onSome: (budget) => budget.reserve }))
);
