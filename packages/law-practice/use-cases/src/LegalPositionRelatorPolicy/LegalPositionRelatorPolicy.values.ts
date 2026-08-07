/**
 * Value objects describing the policy's derived relator views and the
 * opposition candidate inputs it emits.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { HohfeldPosition, LegalActDescription, LegalRole, LegalScopeContext } from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.values");
const LegalRelatorViewKindBase = LiteralKit(["correlative", "opposite"]);

const isRelatorPair = (relators: HashSet.HashSet<LawPractice.LegalPositionRelatorId>): boolean =>
  HashSet.size(relators) === 2;

const OpposedRelators = S.HashSet(LawPractice.LegalPositionRelatorId).check(
  S.makeFilter(isRelatorPair, {
    identifier: $I`OpposedRelatorsCheck`,
    title: "Opposed Relators",
    description: "An opposition candidate names exactly two distinct stored relations.",
    message: "An opposition candidate must name exactly two distinct relators.",
  })
);

/**
 * Which derivation a relator view was produced by.
 *
 * **When to use**
 *
 * Use to label a view wherever one is rendered, so a reader can never mistake a
 * derived reading for the stored relation it came from.
 *
 * **Details**
 *
 * The two members are the only views this policy exposes. Their composite is
 * deliberately absent: it is reachable by applying both derivations, and naming
 * it would invite storing it.
 *
 * **Example** (Narrow a view kind)
 *
 * ```ts
 * import { LegalRelatorViewKind } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 *
 * console.log(LegalRelatorViewKind.is.correlative("correlative")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalRelatorViewKind = LegalRelatorViewKindBase.pipe(
  $I.annoteSchema("LegalRelatorViewKind", {
    description: "Which of the two derivations produced a relator view.",
  }),
  SchemaUtils.withLiteralKitStatics(LegalRelatorViewKindBase)
);

/**
 * Runtime type for {@link LegalRelatorViewKind}.
 *
 * @see {@link LegalRelatorViewKind} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type LegalRelatorViewKind = typeof LegalRelatorViewKind.Type;

/**
 * One derived reading of one stored relation.
 *
 * **When to use**
 *
 * Use as the whole output of either derivation. A view is what a renderer shows
 * when it needs the counterparty's side of a relation or a party's own
 * negation of it.
 *
 * **Details**
 *
 * A view carries the relator it was derived from and the derivation that
 * produced it, so it is self-describing: nothing that reads a view has to be
 * told separately that it is not a stored fact. That is what keeps the
 * one-stored-relation invariant honest at the presentation edge as well as in
 * storage.
 *
 * The roles it carries are the roles as the view sees them. The correlative
 * view swaps bearer and counterparty because it is the same relation read from
 * the other end; the opposite view leaves them in place because it is the same
 * party's negation.
 *
 * **Gotchas**
 *
 * A view is never persisted. Persisting one recreates the correlative-drift
 * failure the single stored relation exists to make unreachable — one end
 * superseded while the other stands.
 *
 * **Example** (Read a derived view)
 *
 * ```ts
 * import { LegalPositionRelatorView } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 * import { HohfeldPosition, LegalActContent, LegalRole, PartyKind, SourceNormRef } from "@beep/law-practice-domain"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as HashSet from "effect/HashSet"
 *
 * const role = (name: string, player: number) =>
 *   LegalRole.make({
 *     admittedPlayerKinds: HashSet.make(PartyKind.Enum["natural-person"]),
 *     name,
 *     player: LawPractice.PartyId.make(player),
 *     sourceNorm: SourceNormRef.make({ designation: "cl. 4.1" }),
 *   })
 *
 * const view = LegalPositionRelatorView.make({
 *   bearer: role("lessor", 2),
 *   counterparty: role("lessee", 1),
 *   position: HohfeldPosition.make({
 *     content: LegalActContent.make({ description: "enter the land", polarity: "act" }),
 *     kind: "noRight",
 *   }),
 *   relator: LawPractice.LegalPositionRelatorId.make(1),
 *   viewKind: "correlative",
 * })
 * console.log(view.viewKind) // "correlative"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalPositionRelatorView extends S.Class<LegalPositionRelatorView>($I`LegalPositionRelatorView`)(
  {
    bearer: LegalRole.annotateKey({
      description: "Role holding the position as this view reads it.",
    }),
    counterparty: LegalRole.annotateKey({
      description: "Role the position is held against as this view reads it.",
    }),
    position: HohfeldPosition.annotateKey({
      description: "Derived position: the kind and the act content it qualifies, moved together.",
    }),
    relator: LawPractice.LegalPositionRelatorId.annotateKey({
      description: "Stored relation this view was derived from and is never a substitute for.",
    }),
    viewKind: LegalRelatorViewKind.annotateKey({
      description: "Which derivation produced this view.",
    }),
  },
  $I.annote("LegalPositionRelatorView", {
    description: "One derived reading of one stored legal relation, labelled with the derivation that produced it.",
  })
) {}

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
 * import { LegalOppositionCandidateInput } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 * import { LegalScopeContext } from "@beep/law-practice-domain"
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
