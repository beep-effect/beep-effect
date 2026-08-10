/**
 * Act-or-omission content carried by a legal position.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/LegalActContent/LegalActContent.model");

const LegalActPolarityBase = LiteralKit(["act", "omission"]);

/**
 * Whether a position's content is a doing or a refraining.
 *
 * **When to use**
 *
 * Use as the polarity field inside {@link LegalActContent}. Polarity is never
 * carried beside content as a separate field, because the opposite derivation
 * has to move a kind and its polarity together or not at all.
 *
 * **Details**
 *
 * `act` records that the content is performing the described act; `omission`
 * records that it is refraining from it. The two are recorded states of one
 * described act, not two different acts.
 *
 * **Example** (Narrow a recorded polarity)
 *
 * ```ts
 * import { LegalActPolarity } from "@beep/law-practice-domain"
 *
 * console.log(LegalActPolarity.is.omission("omission")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalActPolarity = LegalActPolarityBase.pipe(
  $I.annoteSchema("LegalActPolarity", {
    description: "Whether a legal position's content is performing an act or refraining from it.",
  }),
  SchemaUtils.withLiteralKitStatics(LegalActPolarityBase)
);

/**
 * Runtime type for {@link LegalActPolarity}.
 *
 * @see {@link LegalActPolarity} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type LegalActPolarity = typeof LegalActPolarity.Type;

/**
 * Plain-text description of the act a legal position is about.
 *
 * **Details**
 *
 * The description is structured-but-plain text on purpose. A typed act-verb
 * vocabulary would be a scheme with its own loading and governance, so it is
 * deferred rather than improvised here.
 *
 * **Example** (Record an act description)
 *
 * ```ts
 * import { LegalActDescription } from "@beep/law-practice-domain"
 *
 * console.log(LegalActDescription.make("enter the demised premises"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalActDescription = S.NonEmptyString.pipe(
  $I.annoteSchema("LegalActDescription", {
    description: "Plain-text description of the act a legal position is about.",
  })
);

/**
 * Runtime type for {@link LegalActDescription}.
 *
 * @see {@link LegalActDescription} for the runtime schema and the deferred act-verb vocabulary.
 * @category models
 * @since 0.0.0
 */
export type LegalActDescription = typeof LegalActDescription.Type;

/**
 * The act a legal position is about, together with its required polarity.
 *
 * **When to use**
 *
 * Use as the content half of every legal position. Both derivations are defined
 * over the `(kind, content)` pair, so content never travels without its kind.
 *
 * **Details**
 *
 * Polarity lives inside content rather than beside it. The opposite derivation
 * negates polarity in the same step as it moves the kind, and keeping polarity
 * here is what makes a polarity-only move unrepresentable rather than merely
 * discouraged.
 *
 * **Gotchas**
 *
 * Content equality is exact and structural, never semantic. Two differently
 * worded descriptions of the same act are different content, which
 * under-generates candidate pairs by design. Normalizing, stemming, or
 * embedding the description to "fix" that would compute act equivalence, which
 * is attributed human interpretation and is recorded, never derived.
 *
 * **Example** (Record content and compare it exactly)
 *
 * ```ts
 * import { LegalActContent, legalActContentEquivalence } from "@beep/law-practice-domain"
 *
 * const entering = LegalActContent.make({ description: "enter the land", polarity: "act" })
 * const refraining = LegalActContent.make({ description: "enter the land", polarity: "omission" })
 *
 * console.log(legalActContentEquivalence(entering, refraining)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalActContent extends S.Class<LegalActContent>($I`LegalActContent`)(
  {
    description: LegalActDescription.annotateKey({
      description: "Plain-text description of the act, compared exactly and never normalized.",
    }),
    polarity: LegalActPolarity.annotateKey({
      description: "Whether the content performs the described act or refrains from it.",
    }),
  },
  $I.annote("LegalActContent", {
    description: "The act a legal position is about, carrying its required act-or-omission polarity.",
  })
) {}

/**
 * Exact structural comparison of two {@link LegalActContent} values, derived
 * from the schema.
 *
 * **Details**
 *
 * Same description and same polarity, or not equal. This is the only content
 * comparison the vocabulary offers, so no caller can reach for a looser one by
 * accident.
 *
 * **Example** (Distinguish two recorded contents)
 *
 * ```ts
 * import { LegalActContent, legalActContentEquivalence } from "@beep/law-practice-domain"
 *
 * const recorded = LegalActContent.make({ description: "enter the land", polarity: "act" })
 * const reworded = LegalActContent.make({ description: "come onto the land", polarity: "act" })
 *
 * console.log(legalActContentEquivalence(recorded, reworded)) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const legalActContentEquivalence: SchemaUtils.DualEquivalence<LegalActContent> =
  SchemaUtils.toEquivalence(LegalActContent);
