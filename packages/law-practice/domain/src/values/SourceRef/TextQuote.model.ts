/**
 * Existing unverified review-source quote selector, moved from the retired
 * citation locator module without changing its encoded contract.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

// Preserve this non-citation consumer's existing schema annotation identity.
const $I = $LawPracticeDomainId.create("values/DurableLocator/DurableLocator.model");

/**
 * W3C Web Annotation `TextQuoteSelector`: the exact quoted text plus optional
 * text immediately before and after it.
 *
 * **Details**
 *
 * Existing review-source selector data, without source identity or runtime
 * verification capability. `prefix` and `suffix` decode from optional keys into `Option`
 * values and default to `Option.none()` when constructed without them.
 *
 * **Example** (Build a quote without context)
 *
 * ```ts
 * import { TextQuote } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const quote = TextQuote.make({ exact: "410 U.S. 113" })
 *
 * console.log(quote.exact) // "410 U.S. 113"
 * console.log(O.isNone(quote.prefix)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TextQuote extends S.Opaque<TextQuote, { readonly brand: unique symbol }>()(
  S.Struct({
    exact: S.String.annotateKey({
      description: "The exact quoted text — the anchor of record.",
    }),
    prefix: S.String.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Text immediately preceding the exact quote.",
      })
    ),
    suffix: S.String.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Text immediately following the exact quote.",
      })
    ),
  }).pipe(
    $I.annoteSchema("TextQuote", {
      description: "W3C TextQuoteSelector: the exact quoted text with optional prefix and suffix context.",
    })
  )
) {}

/**
 * Companion namespace for `TextQuote`.
 *
 * **Example** (Type an encoded quote prefix)
 *
 * ```ts
 * import type { TextQuote } from "@beep/law-practice-domain"
 *
 * const prefix: TextQuote.Encoded["prefix"] = "comprising "
 * console.log(prefix) // "comprising "
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace TextQuote {
  /**
   * Wire-encoded representation of a decoded {@link TextQuote}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { TextQuote } from "@beep/law-practice-domain"
   *
   * type Wire = TextQuote.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof TextQuote.Encoded;
}
