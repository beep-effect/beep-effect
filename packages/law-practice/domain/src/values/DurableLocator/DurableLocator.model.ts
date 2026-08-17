/**
 * Durable-locator value object: a portable, host-agnostic locator for a
 * citation, in the style of W3C Web Annotation selectors.
 *
 * Stores the citation as a quote plus surrounding context (TextQuoteSelector)
 * and an offset hint (TextPositionSelector), so it survives edits to the
 * document.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $LawPracticeDomainId.create("values/DurableLocator/DurableLocator.model");

const DurableLocatorSpace = LiteralKit(["original", "clean"]);

const DurableLocatorFields = {
  quote: S.Struct({
    exact: S.String.annotateKey({
      description: "The exact quoted text — the anchor of record.",
    }),
    prefix: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Text immediately preceding the exact quote.",
      })
    ),
    suffix: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Text immediately following the exact quote.",
      })
    ),
  }).annotateKey({
    description: "W3C TextQuoteSelector — the anchor of record.",
  }),
  position: S.Struct({
    start: NonNegativeInt.annotateKey({
      description: "Start offset in space.",
    }),
    end: NonNegativeInt.annotateKey({
      description: "End offset in space.",
    }),
  }).annotateKey({
    description: "W3C TextPositionSelector — offsets in space. Hint/audit; may drift.",
  }),
  occurrence: NonNegativeInt.pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description:
        "Document-order ordinal among token-bounded hits of exact. Omitted when the span is not a token-bounded hit.",
    })
  ),
  contentHash: S.String.annotateKey({
    description: "Stable FNV-1a-64 hex of exact+prefix+suffix — locator identity.",
  }),
};

const makeDurableLocatorMember = <T extends typeof DurableLocatorSpace.Type>(literal: S.Literal<T>) =>
  S.Struct({
    v: S.tag(1).annotateKey({
      description: "Schema version.",
    }),
    space: S.tag(literal.literal).annotateKey({
      description: "Which text the offsets and quote were taken from.",
    }),
    ...DurableLocatorFields,
  });

/**
 * A portable, host-agnostic locator for a citation, in the style of W3C Web
 * Annotation selectors.
 *
 * **Details**
 *
 * Stores the citation as a quote plus surrounding context (TextQuoteSelector)
 * and an offset hint (TextPositionSelector), so it survives edits to the
 * document.
 *
 * **Example** (Creating a DurableLocator)
 *
 * ```ts
 * import { DurableLocator } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const locator = DurableLocator.make({
 *   v: 1,
 *   space: "original",
 *   quote: { exact: "410 U.S. 113" },
 *   position: {
 *     start: NonNegativeInt.make(0),
 *     end: NonNegativeInt.make(12),
 *   },
 *   contentHash: "9f2c4a1b7e3d0056",
 * })
 *
 * console.log(locator.quote.exact) // "410 U.S. 113"
 * console.log(O.isNone(locator.occurrence)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DurableLocator = DurableLocatorSpace.mapMembers(
  Tuple.evolve([makeDurableLocatorMember, makeDurableLocatorMember])
).pipe(
  S.toTaggedUnion("space"),
  $I.annoteSchema("DurableLocator", {
    description: "A portable, host-agnostic locator for a citation, in the style of W3C Web Annotation selectors.",
  })
);

/**
 * Runtime type for {@link DurableLocator}.
 *
 * @see {@link DurableLocator} for the tagged-union schema and locator semantics.
 * @category models
 * @since 0.0.0
 */
export type DurableLocator = typeof DurableLocator.Type;

/**
 * Companion namespace for `DurableLocator`.
 *
 * **Example** (Accessing Encoded space type)
 *
 * ```ts
 * import type { DurableLocator } from "@beep/law-practice-domain"
 *
 * const space: DurableLocator.Encoded["space"] = "original"
 * console.log(space) // "original"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace DurableLocator {
  /**
   * Wire-encoded representation of a decoded {@link DurableLocator}.
   *
   * **Example** (Aliasing the Encoded type)
   *
   * ```ts
   * import type { DurableLocator } from "@beep/law-practice-domain"
   *
   * type Wire = DurableLocator.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof DurableLocator.Encoded;
}
