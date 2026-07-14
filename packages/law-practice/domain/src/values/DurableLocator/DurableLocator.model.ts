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
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/DurableLocator/DurableLocator.model");

/**
 * A portable, host-agnostic locator for a citation, in the style of W3C Web
 * Annotation selectors.
 *
 * Stores the citation as a quote plus surrounding context (TextQuoteSelector)
 * and an offset hint (TextPositionSelector), so it survives edits to the
 * document.
 *
 * **Example**
 *
 * @example
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
export class DurableLocator extends S.Class<DurableLocator>($I`DurableLocator`)(
  {
    v: S.Literal(1).annotateKey({
      description: "Schema version.",
    }),
    space: S.Literals(["original", "clean"]).annotateKey({
      description: "Which text the offsets + quote were taken from.",
    }),
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
  },
  $I.annote("DurableLocator", {
    description: "A portable, host-agnostic locator for a citation, in the style of W3C Web Annotation selectors.",
  })
) {}

/**
 * Companion namespace for `DurableLocator`.
 *
 * @example
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
   * **Example**
   *
   * @example
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
