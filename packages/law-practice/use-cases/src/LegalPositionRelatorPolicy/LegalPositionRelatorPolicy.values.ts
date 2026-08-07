/**
 * Value objects describing the policy's derived relator views and the
 * opposition candidate inputs it emits.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { HohfeldPosition, LegalRole } from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";

/**
 * The candidate input this policy emits, re-exported from the tier that owns it.
 *
 * **Details**
 *
 * It moved to `@beep/law-practice-domain` when a durable candidate record began
 * composing it: the tables tier that projects that record depends on the domain
 * package alone, so a use-cases-owned shape could not be persisted without
 * inverting the tiers. Re-exporting keeps it reachable where the policy that
 * emits it lives.
 *
 * @category models
 * @since 0.0.0
 */
export { LegalOppositionCandidateInput } from "@beep/law-practice-domain";

const $I = $LawPracticeUseCasesId.create("LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.values");
const LegalRelatorViewKindBase = LiteralKit(["correlative", "opposite"]);

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
