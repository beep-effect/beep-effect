/**
 * Durable-locator value object: a portable, host-agnostic locator for a
 * citation, in the style of W3C Web Annotation selectors.
 *
 * **Details**
 *
 * Stores the citation as a quote plus surrounding context (TextQuoteSelector)
 * and an offset hint (TextPositionSelector), so it survives edits to the
 * document.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $LawPracticeDomainId.create("values/DurableLocator/DurableLocator.model");

const DurableLocatorSpace = LiteralKit(["original", "clean"]);

/**
 * W3C Web Annotation `TextQuoteSelector`: the exact quoted text plus optional
 * text immediately before and after it.
 *
 * **Details**
 *
 * The anchor of record for {@link DurableLocator} and for review source
 * references. `prefix` and `suffix` decode from optional keys into `Option`
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

const DurableLocatorFields = {
  quote: TextQuote.annotateKey({
    description: "W3C TextQuoteSelector — the anchor of record.",
  }),
  position: S.Struct({
    start: S.Natural.annotateKey({
      description: "Start offset in space.",
    }),
    end: S.Natural.annotateKey({
      description: "End offset in space.",
    }),
  }).annotateKey({
    description: "W3C TextPositionSelector — offsets in space. Hint/audit; may drift.",
  }),
  occurrence: S.Natural.pipe(
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone),
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
 * import * as S from "effect/Schema"
 * import { DurableLocator, TextQuote } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const locator = DurableLocator.make({
 *   v: 1,
 *   space: "original",
 *   quote: TextQuote.make({ exact: "410 U.S. 113" }),
 *   position: {
 *     start: S.Natural.make(0),
 *     end: S.Natural.make(12),
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
export const DurableLocator = DurableLocatorSpace.mapMembers(([original, clean]) =>
  Tuple.make(makeDurableLocatorMember(original), makeDurableLocatorMember(clean))
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
