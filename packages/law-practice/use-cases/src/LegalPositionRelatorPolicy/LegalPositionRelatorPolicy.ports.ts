/**
 * Legal position relator ports: the admission contract over candidate records,
 * the two derived views of a stored relation, and the scope-overlap-and-
 * opposition check that emits candidate inputs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LegalPositionRelator } from "@beep/law-practice-domain";
import { EffectSchema, Fn } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { LegalOppositionCandidateInput, LegalPositionRelatorView } from "./LegalPositionRelatorPolicy.values.ts";
import type { LegalPositionRelatorAdmissionError } from "./LegalPositionRelatorPolicy.errors.ts";

const $I = $LawPracticeUseCasesId.create("LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.ports");

/**
 * Service shape for admitting relations, deriving their views, and screening
 * pairs of them.
 *
 * **When to use**
 *
 * Use as the seam between recorded legal relations and anything that wants to
 * read them: a renderer needing the counterparty's side, an intake path
 * refusing an unreadable record, or a caller collecting pairs worth a human
 * look.
 *
 * **Details**
 *
 * The shape owns three things and nothing else.
 *
 * `admit` refuses a record that cannot be read as a relation — any required
 * field absent, or a burden-side `positionKind`, which is never stored.
 *
 * `correlativeView` and `oppositeView` are the only views. Both are pure and
 * total over an admitted relation, and neither writes anything: one stored
 * relation, every other reading derived. The correlative swaps bearer and
 * counterparty because it is the same relation read from the other end; the
 * opposite leaves them in place because it is the same party's negation, and it
 * moves the position kind and the act polarity together in one step.
 *
 * `screenForOpposition` answers exactly two set-theoretic facts about each pair
 * of relations it is given — whether their recorded scopes intersect on every
 * one of the five axes, and whether one's opposite view coincides with the
 * other's correlative view — and emits a candidate input for the pairs where
 * both hold. Nothing else is consulted and nothing else is reported.
 *
 * **Gotchas**
 *
 * Opposition is never a comparison of two stored `positionKind`s. Every stored
 * kind is advantage-side and every kind's opposite is burden-side, so a
 * stored-against-stored check is vacuously false and would silently emit
 * nothing at all.
 *
 * Emitting a candidate is not a finding. That two relations are prima facie
 * opposed within an overlapping scope says nothing about whether they are
 * legally comparable, whether they conflict, or which prevails.
 *
 * **Example** (Inspect the contract surface)
 *
 * ```ts
 * import { LegalPositionRelatorPolicyShape } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 *
 * console.log(Object.keys(LegalPositionRelatorPolicyShape.fields)) // the four operations
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LegalPositionRelatorPolicyShape extends S.Class<LegalPositionRelatorPolicyShape>(
  $I`LegalPositionRelatorPolicyShape`
)(
  {
    admit: Fn({
      input: S.Unknown,
      output: EffectSchema<LegalPositionRelator, LegalPositionRelatorAdmissionError, never>(),
    }).annotateKey({
      description: "Admit one candidate record as a stored advantage-side legal relation, or refuse it.",
    }),
    correlativeView: Fn({
      input: LegalPositionRelator,
      output: LegalPositionRelatorView,
    }).annotateKey({
      description: "Derive the counterparty's reading of one stored relation; never stored.",
    }),
    oppositeView: Fn({
      input: LegalPositionRelator,
      output: LegalPositionRelatorView,
    }).annotateKey({
      description: "Derive the bearer's own negation of one stored relation; never stored.",
    }),
    screenForOpposition: Fn({
      input: S.Array(LegalPositionRelator),
      output: S.HashSet(LegalOppositionCandidateInput),
    }).annotateKey({
      description: "Emit a candidate input for every pair whose scopes overlap and whose positions are opposed.",
    }),
  },
  $I.annote("LegalPositionRelatorPolicyShape", {
    description:
      "Service shape owning relator admission, the two derived views of a stored relation, and the pair screen.",
  })
) {}

/**
 * Legal position relator policy service tag.
 *
 * **When to use**
 *
 * Use wherever recorded legal relations are read: to refuse a record that
 * cannot be read as a relation, to show a relation from either side, or to
 * collect the pairs a human should look at.
 *
 * **Details**
 *
 * The tag carries no requirements of its own. Admission is a schema question,
 * both views are pure derivations, and the screen reads only the values its
 * caller hands it — so the policy needs no store, no clock, and no cross-slice
 * capability, and the candidate inputs it returns are ordinary law-practice
 * values a caller passes onward however it chooses.
 *
 * **Example** (Screen a caller's relations through the tag)
 *
 * ```ts
 * import {
 *   LegalPositionRelatorPolicy,
 *   LegalPositionRelatorPolicyLive,
 * } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 * import { Effect } from "effect"
 * import * as HashSet from "effect/HashSet"
 *
 * const program = Effect.gen(function* () {
 *   const policy = yield* LegalPositionRelatorPolicy
 *   return HashSet.size(policy.screenForOpposition([]))
 * }).pipe(Effect.provide(LegalPositionRelatorPolicyLive))
 *
 * Effect.runPromise(program).then((count) => console.log(count)) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LegalPositionRelatorPolicy extends Context.Service<
  LegalPositionRelatorPolicy,
  LegalPositionRelatorPolicyShape
>()($I`LegalPositionRelatorPolicy`) {}
