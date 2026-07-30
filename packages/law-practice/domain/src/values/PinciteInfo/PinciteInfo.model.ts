/**
 * Pincite value object: structured page, paragraph, and footnote references
 * parsed from citation text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import type * as O from "effect/Option";
import type { FastCheck } from "effect/testing";

const $I = $LawPracticeDomainId.create("values/PinciteInfo/PinciteInfo.model");

const additionalPincitesToArbitrary: () => (
  fc: typeof FastCheck
) => FastCheck.Arbitrary<ReadonlyArray<PinciteInfo.Type>> = () => (fc) => fc.constant([]);

/**
 * Companion namespace for `PinciteInfo`.
 *
 * The decoded and encoded shapes are hand-written so the self-recursive
 * `additionalPincites` suspend can name them without making the class's own
 * base expression circular (see the {@link PinciteInfo} field definition).
 *
 * @example
 * ```ts
 * import type { PinciteInfo } from "@beep/law-practice-domain"
 *
 * type PinciteWire = PinciteInfo.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PinciteInfo {
  /**
   * Decoded representation of a {@link PinciteInfo}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { PinciteInfo } from "@beep/law-practice-domain"
   *
   * type Decoded = PinciteInfo.Type
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type {
    readonly additionalPincites: ReadonlyArray<PinciteInfo.Type>;
    readonly endPage: O.Option<NonNegativeInt>;
    readonly endParagraph: O.Option<NonNegativeInt>;
    readonly footnote: O.Option<NonNegativeInt>;
    readonly footnoteEnd: O.Option<NonNegativeInt>;
    readonly isRange: boolean;
    readonly page: O.Option<NonNegativeInt>;
    readonly paragraph: O.Option<NonNegativeInt>;
    readonly raw: string;
    readonly starPage: boolean;
  }

  /**
   * Wire-encoded representation of a decoded {@link PinciteInfo}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { PinciteInfo } from "@beep/law-practice-domain"
   *
   * type Wire = PinciteInfo.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly additionalPincites?: ReadonlyArray<PinciteInfo.Encoded> | undefined;
    readonly endPage?: number;
    readonly endParagraph?: number;
    readonly footnote?: number;
    readonly footnoteEnd?: number;
    readonly isRange: boolean;
    readonly page?: number;
    readonly paragraph?: number;
    readonly raw: string;
    readonly starPage?: boolean;
  }
}

/**
 * Additional discrete pincites following the primary one (#247).
 *
 * Kept as a standalone schema so the self-recursive `S.suspend` sits outside the
 * {@link PinciteInfo} class base expression — referencing the class there would
 * make its own base expression circular. The suspend annotation names only the
 * hand-written {@link PinciteInfo} namespace types for the same reason.
 */
const AdditionalPincites = S.Array(S.suspend((): S.Codec<PinciteInfo.Type, PinciteInfo.Encoded> => PinciteInfo)).pipe(
  SchemaUtils.withEmptyArrayDefaults<PinciteInfo.Type>(),
  S.annotate({
    toArbitrary: additionalPincitesToArbitrary,
  }),
  S.annotateKey({
    description:
      "Additional discrete pincites following the primary one (#247). Each entry is a full PinciteInfo so ranges/footnotes/star-pages inside the comma chain are preserved.",
  })
);

/**
 * Structured pincite information parsed from citation text.
 *
 * `page` and `paragraph` are mutually exclusive — a pincite is either a page
 * reference or a paragraph reference (#204). Every optional numeric component
 * is modeled as `Option<NonNegativeInt>` with a `None` constructor default.
 * `starPage` defaults to `false`, and `additionalPincites` defaults to an empty
 * self-recursive array whose entries preserve their own ranges, footnotes, and
 * star-pages (#247).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { PinciteInfo } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const pincite = PinciteInfo.make({
 *   page: O.some(NonNegativeInt.make(570)),
 *   endPage: O.some(NonNegativeInt.make(575)),
 *   isRange: true,
 *   raw: "570-75",
 *   additionalPincites: [
 *     PinciteInfo.make({
 *       page: O.some(NonNegativeInt.make(580)),
 *       isRange: false,
 *       raw: "580",
 *     }),
 *   ],
 * })
 *
 * console.log(O.isSome(pincite.page)) // true
 * console.log(pincite.isRange) // true
 * console.log(O.isNone(pincite.paragraph)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PinciteInfo extends S.Class<PinciteInfo>($I`PinciteInfo`)(
  {
    page: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Primary page number. Undefined when the pincite is paragraph-only (#204).",
      })
    ),
    endPage: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'End page for ranges: "570-75" → 575',
      })
    ),
    footnote: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Footnote number: "570 n.3" → 3. For multi-footnote refs ("nn.3-5"), the first note; see footnoteEnd for the range end.',
      })
    ),
    footnoteEnd: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'End footnote for multi-note refs: "570 nn.3-5" → 5',
      })
    ),
    isRange: S.Boolean.annotateKey({
      description: "True if this is a page or paragraph range",
    }),
    starPage: SchemaUtils.BoolKeyDefaultFalse.pipe(
      S.annotateKey({
        description:
          'True when the pincite uses star-pagination (e.g., "*2"), denoting a slip-opinion page or unreported-decision page rather than a reporter page.',
      })
    ),
    paragraph: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Paragraph number for ¶ N / para. N pincites (#204).",
      })
    ),
    endParagraph: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "End paragraph for ¶¶ N-M / paras. N-M pincites (#204).",
      })
    ),
    additionalPincites: AdditionalPincites,
    raw: S.String.annotateKey({
      description: "Original text before parsing",
    }),
  },
  $I.annote("PinciteInfo", {
    description:
      "Structured pincite information parsed from citation text; page and paragraph are mutually exclusive (#204).",
  })
) {}
