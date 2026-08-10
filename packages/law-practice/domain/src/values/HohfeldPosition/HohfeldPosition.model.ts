/**
 * A Hohfeldian legal position and its correlative and opposite derivations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { HohfeldPositionKind } from "../HohfeldPositionKind/index.ts";
import { LegalActContent, LegalActPolarity } from "../LegalActContent/index.ts";

const $I = $LawPracticeDomainId.create("values/HohfeldPosition/HohfeldPosition.model");

const correlativeKind = HohfeldPositionKind.$match({
  claim: (): HohfeldPositionKind => "duty",
  duty: (): HohfeldPositionKind => "claim",
  privilege: (): HohfeldPositionKind => "noRight",
  noRight: (): HohfeldPositionKind => "privilege",
  power: (): HohfeldPositionKind => "liability",
  liability: (): HohfeldPositionKind => "power",
  immunity: (): HohfeldPositionKind => "disability",
  disability: (): HohfeldPositionKind => "immunity",
});

const oppositeKind = HohfeldPositionKind.$match({
  claim: (): HohfeldPositionKind => "noRight",
  noRight: (): HohfeldPositionKind => "claim",
  privilege: (): HohfeldPositionKind => "duty",
  duty: (): HohfeldPositionKind => "privilege",
  power: (): HohfeldPositionKind => "disability",
  disability: (): HohfeldPositionKind => "power",
  immunity: (): HohfeldPositionKind => "liability",
  liability: (): HohfeldPositionKind => "immunity",
});

const negatedPolarity = LegalActPolarity.$match({
  act: (): LegalActPolarity => "omission",
  omission: (): LegalActPolarity => "act",
});

/**
 * One Hohfeldian legal position: a position kind applied to act content.
 *
 * **When to use**
 *
 * Use as the argument and result of every position derivation, and as the shape
 * a derived view is presented in. A relator stores its kind and its content as
 * separate fields so the stored kind can carry the advantage-side narrowing;
 * this pair is how those two fields are read together.
 *
 * **Details**
 *
 * Pairing kind with content is the whole soundness argument. A derivation that
 * moved a kind while leaving content untouched, or negated content while
 * leaving the kind untouched, would produce a position that no source says
 * anything about. Because {@link correlativePosition} and
 * {@link oppositePosition} take and return this pair, and no kind-only or
 * polarity-only map is exported, neither half-move can be written.
 *
 * **Gotchas**
 *
 * A derived position is a view, never a record. Persisting one alongside its
 * source is correlative drift: the two ends can then be superseded
 * independently, leaving a duty standing with no claim behind it.
 *
 * **Example** (Read a position's two halves)
 *
 * ```ts
 * import { HohfeldPosition, LegalActContent } from "@beep/law-practice-domain"
 *
 * const position = HohfeldPosition.make({
 *   content: LegalActContent.make({ description: "enter the land", polarity: "act" }),
 *   kind: "privilege",
 * })
 * console.log(position.kind) // "privilege"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HohfeldPosition extends S.Class<HohfeldPosition>($I`HohfeldPosition`)(
  {
    content: LegalActContent.annotateKey({
      description: "The act the position is about, carrying its act-or-omission polarity.",
    }),
    kind: HohfeldPositionKind.annotateKey({
      description: "Position kind, drawn from the full eight-member domain because derived views are burden-side.",
    }),
  },
  $I.annote("HohfeldPosition", {
    description: "One Hohfeldian legal position: a position kind paired with the act content it qualifies.",
  })
) {}

/**
 * The correlative view of a position: the same relation read from the other
 * party's side.
 *
 * **When to use**
 *
 * Use to present what a stored advantage-side relation means for the
 * counterparty. Storing the result is correlative drift.
 *
 * **Details**
 *
 * The kind moves through claim↔duty, privilege↔noRight, power↔liability, and
 * immunity↔disability; content is carried through unchanged, because the
 * correlative is the same act seen from the other end rather than a different
 * act. Holder and counterparty swap at the relator-view level, where the two
 * roles are actually named.
 *
 * The function is total, closed, and involutive: applying it twice returns the
 * position it started from, and it commutes with {@link oppositePosition}.
 *
 * **Example** (Read the counterparty's side of a stored privilege)
 *
 * ```ts
 * import { HohfeldPosition, LegalActContent, correlativePosition } from "@beep/law-practice-domain"
 *
 * const stored = HohfeldPosition.make({
 *   content: LegalActContent.make({ description: "enter the land", polarity: "act" }),
 *   kind: "privilege",
 * })
 * const view = correlativePosition(stored)
 * console.log(view.kind) // "noRight"
 * console.log(view.content.polarity) // "act"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const correlativePosition = (position: HohfeldPosition): HohfeldPosition =>
  HohfeldPosition.make({
    content: position.content,
    kind: correlativeKind(position.kind),
  });

/**
 * The opposite view of a position: the same party's negation of it.
 *
 * **When to use**
 *
 * Use to present what the same party's contradictory position would be. As with
 * the correlative, the result is a view and is never stored.
 *
 * **Details**
 *
 * The kind moves through claim↔noRight, privilege↔duty, power↔disability, and
 * immunity↔liability **and** the content's polarity is negated in the same
 * step. Moving one without the other is the named unsoundness, so the two moves
 * are one operation with no exported way to reach either half.
 *
 * The function is total, closed, and involutive, and together with
 * {@link correlativePosition} it generates a Klein four-group over the eight
 * kinds with exactly two four-member orbits. The composite of the two is
 * deliberately not exposed as a named view.
 *
 * **Example** (Negate a stored privilege)
 *
 * ```ts
 * import { HohfeldPosition, LegalActContent, oppositePosition } from "@beep/law-practice-domain"
 *
 * const stored = HohfeldPosition.make({
 *   content: LegalActContent.make({ description: "enter the land", polarity: "act" }),
 *   kind: "privilege",
 * })
 * const view = oppositePosition(stored)
 * console.log(view.kind) // "duty"
 * console.log(view.content.polarity) // "omission"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const oppositePosition = (position: HohfeldPosition): HohfeldPosition =>
  HohfeldPosition.make({
    content: LegalActContent.make({
      description: position.content.description,
      polarity: negatedPolarity(position.content.polarity),
    }),
    kind: oppositeKind(position.kind),
  });
