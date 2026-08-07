/**
 * Legal opposition candidate input value model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { HashSet as StoredHashSet } from "@beep/schema/HashSet";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { LegalActDescription } from "../LegalActContent/index.ts";
import { LegalScopeContext } from "../LegalScopeContext/index.ts";

const $I = $LawPracticeDomainId.create("values/LegalOppositionCandidateInput/LegalOppositionCandidateInput.model");

const isRelatorPair = (relators: HashSet.HashSet<LawPractice.LegalPositionRelatorId>): boolean =>
  HashSet.size(relators) === 2;

const OpposedRelators = StoredHashSet(LawPractice.LegalPositionRelatorId).check(
  S.makeFilter(isRelatorPair, {
    identifier: $I`OpposedRelatorsCheck`,
    title: "Opposed Relators",
    description: "An opposition candidate names exactly two distinct stored relations.",
    message: "An opposition candidate must name exactly two distinct relators.",
  })
);

/**
 * Two stored relations that overlap in scope and are prima facie opposed.
 *
 * **When to use**
 *
 * Use as the whole output of the scope-overlap-and-opposition check, and as the
 * input a law-practice caller offers onward. It is an *input* to whatever
 * records candidates, never a record of a finding.
 *
 * **Details**
 *
 * Every field is a recorded or derived fact about the pair, and none is a
 * conclusion. `relators` is an unordered set of exactly two ids, so nothing in
 * the shape can read as precedence between them. `act` is the act description
 * both relations are about, which is necessarily shared: the two views coincide
 * on content, and the derivations never rewrite a description. `overlappingScope`
 * is the per-axis intersection of the two recorded scopes — the actual values
 * that qualified the pair, rather than a claim that the scopes are the same.
 *
 * Act polarity is deliberately absent. The two relations carry opposite
 * polarities by construction, so recording one would arbitrarily privilege one
 * end of a pair the shape otherwise refuses to order.
 *
 * It lives in the domain tier rather than beside the policy that emits it
 * because a durable candidate record composes it, and the tables tier that
 * projects that record depends on this package alone. The record composes it
 * whole rather than restating its three fields, so the pair, the shared act
 * description, and the exactly-two check have one definition that the emitting
 * policy and the stored record cannot drift apart on.
 *
 * **Gotchas**
 *
 * Prima facie opposition and scope overlap are set-theoretic facts about
 * recorded values. Together they are not a finding that the two positions are
 * legally comparable, that they conflict, or that either prevails — those are
 * attributed human judgments this package never computes and never proxies.
 *
 * **Example** (Emit a candidate for two opposed relations)
 *
 * ```ts
 * import { LegalOppositionCandidateInput, LegalScopeContext } from "@beep/law-practice-domain"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as HashSet from "effect/HashSet"
 *
 * const candidate = LegalOppositionCandidateInput.make({
 *   act: "enter the land",
 *   overlappingScope: LegalScopeContext.make({
 *     material: HashSet.make("the demised premises"),
 *     quantitative: HashSet.make("unlimited"),
 *     subjective: HashSet.make("the lessor"),
 *     temporal: HashSet.make("the term of the lease"),
 *     territorial: HashSet.make("US-CA"),
 *   }),
 *   relators: HashSet.make(
 *     LawPractice.LegalPositionRelatorId.make(1),
 *     LawPractice.LegalPositionRelatorId.make(2)
 *   ),
 * })
 * console.log(HashSet.size(candidate.relators)) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalOppositionCandidateInput extends S.Class<LegalOppositionCandidateInput>(
  $I`LegalOppositionCandidateInput`
)(
  {
    act: LegalActDescription.annotateKey({
      description: "Act description both relations are about, shared because the derivations never rewrite it.",
    }),
    overlappingScope: LegalScopeContext.annotateKey({
      description: "Per-axis intersection of the two recorded scopes: the values that qualified the pair.",
    }),
    relators: OpposedRelators.annotateKey({
      description: "The two stored relations, unordered so nothing in the shape reads as precedence.",
    }),
  },
  $I.annote("LegalOppositionCandidateInput", {
    description:
      "Two stored relations whose recorded scopes overlap on every axis and whose positions are prima facie opposed.",
  })
) {}
