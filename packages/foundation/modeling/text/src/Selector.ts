/**
 * The selector union over one text capture: the Web Annotation selector
 * algebra beside the canonical `TextAnchor`.
 *
 * **Details**
 *
 * `Position` (from `OffsetUnit`) and `Quote` locate text directly, `Fragment`
 * names a fragment under a specification, `Refined` applies one selector inside
 * the segment another selects, and `Range` spans from the start of one
 * selection to the start of another. A selector locates text; it never
 * identifies an occurrence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI } from "@beep/identity/Iri";
import { $TextId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { Position } from "./OffsetUnit.ts";

const $I = $TextId.create("Selector");

/**
 * The `Quote` case of {@link Selector}: an exact quote with optional context,
 * which locates but never identifies.
 *
 * **Example** (Quote with a prefix)
 *
 * ```ts import.meta.vitest name="Quote with a prefix"
 * import { QuoteSelector } from "@beep/text/Selector"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const quote = QuoteSelector.make({ exact: "1 U.S. 1", prefix: O.some("; "), suffix: O.none() })
 * S.encodeSync(QuoteSelector)(quote) // => { _tag: "Quote", exact: "1 U.S. 1", prefix: "; " }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuoteSelector extends S.Opaque<QuoteSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Quote", {
    exact: S.NonEmptyString.annotateKey({ description: "Exact quoted text." }),
    prefix: S.OptionFromOptionalKey(S.String).annotateKey({ description: "Text immediately before the quote." }),
    suffix: S.OptionFromOptionalKey(S.String).annotateKey({ description: "Text immediately after the quote." }),
  }).pipe($I.annoteSchema("QuoteSelector", { description: "An oa:TextQuoteSelector." }))
) {}

/**
 * The `Fragment` case of {@link Selector}: a fragment identifier conforming to
 * a named specification.
 *
 * **Example** (Fragment under a media-fragment specification)
 *
 * ```ts import.meta.vitest name="Fragment under a media-fragment specification"
 * import { FragmentSelector } from "@beep/text/Selector"
 * import * as S from "effect/Schema"
 *
 * S.is(FragmentSelector)({
 *   _tag: "Fragment",
 *   conformsTo: "http://www.w3.org/TR/media-frags/",
 *   value: "page=2",
 * }) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FragmentSelector extends S.Opaque<FragmentSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Fragment", {
    conformsTo: IRI.annotateKey({ description: "Specification the fragment conforms to." }),
    value: S.NonEmptyString.annotateKey({ description: "Fragment identifier value." }),
  }).pipe($I.annoteSchema("FragmentSelector", { description: "An oa:FragmentSelector." }))
) {}

type SelectorType = Position | QuoteSelector | FragmentSelector | RefinedSelector | RangeSelector;

type SelectorEncoded =
  | typeof Position.Encoded
  | typeof QuoteSelector.Encoded
  | typeof FragmentSelector.Encoded
  | {
      readonly _tag: "Refined";
      readonly base: SelectorEncoded;
      readonly by: SelectorEncoded;
    }
  | {
      readonly _tag: "Range";
      readonly from: SelectorEncoded;
      readonly to: SelectorEncoded;
    };

const SelectorRef = S.suspend((): S.Codec<Selector.Type, Selector.Encoded> => Selector);

/**
 * The `Refined` case of {@link Selector}: `by` is applied inside the segment
 * `base` selects, with offsets relative to that segment.
 *
 * **Example** (Refine a quote inside a position)
 *
 * ```ts import.meta.vitest name="Refine a quote inside a position"
 * import { Position } from "@beep/text/OffsetUnit"
 * import { QuoteSelector, RefinedSelector } from "@beep/text/Selector"
 * import * as O from "effect/Option"
 *
 * const refined = RefinedSelector.make({
 *   base: Position.make({ unit: "utf16-code-unit", start: 10, end: 20 }),
 *   by: QuoteSelector.make({ exact: "fact", prefix: O.none(), suffix: O.none() }),
 * })
 * refined.base._tag // => "Position"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RefinedSelector extends S.Opaque<RefinedSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Refined", {
    base: SelectorRef.annotateKey({ description: "Outer selector." }),
    by: SelectorRef.annotateKey({ description: "Selector applied inside the outer selection." }),
  }).pipe($I.annoteSchema("RefinedSelector", { description: "An oa:refinedBy chain." }))
) {}

/**
 * The `Range` case of {@link Selector}: the span from the start of `from` to
 * the start of `to`, which is excluded (W3C Web Annotation 4.2.8).
 *
 * **Example** (Range between two quotes)
 *
 * ```ts import.meta.vitest name="Range between two quotes"
 * import { QuoteSelector, RangeSelector } from "@beep/text/Selector"
 * import * as O from "effect/Option"
 *
 * const range = RangeSelector.make({
 *   from: QuoteSelector.make({ exact: "Claim 1", prefix: O.none(), suffix: O.none() }),
 *   to: QuoteSelector.make({ exact: "Claim 2", prefix: O.none(), suffix: O.none() }),
 * })
 * range.to._tag // => "Quote"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RangeSelector extends S.Opaque<RangeSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Range", {
    from: SelectorRef.annotateKey({ description: "Selector whose start opens the range." }),
    to: SelectorRef.annotateKey({ description: "Selector whose start closes the range, exclusive." }),
  }).pipe($I.annoteSchema("RangeSelector", { description: "An oa:RangeSelector." }))
) {}

/**
 * The one selector union beside the canonical `TextAnchor`, recursive through
 * `Refined` and `Range`.
 *
 * **Example** (Decode a nested selector)
 *
 * ```ts import.meta.vitest name="Decode a nested selector"
 * import { Selector } from "@beep/text/Selector"
 * import * as S from "effect/Schema"
 *
 * const selector = S.decodeUnknownSync(Selector)({
 *   _tag: "Refined",
 *   base: { _tag: "Position", unit: "utf16-code-unit", start: 0, end: 8 },
 *   by: { _tag: "Quote", exact: "U.S." },
 * })
 * Selector.guards.Refined(selector) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Selector = S.Union([Position, QuoteSelector, FragmentSelector, RefinedSelector, RangeSelector]).pipe(
  $I.annoteSchema("Selector", { description: "The Web Annotation selector algebra over one text capture." }),
  S.toTaggedUnion("_tag")
);

/**
 * Decoded and encoded sides of the recursive {@link Selector}.
 *
 * **Example** (Annotate an encoded selector)
 *
 * ```ts
 * import type { Selector } from "@beep/text/Selector"
 *
 * const encoded: Selector.Encoded = { _tag: "Quote", exact: "fact" }
 * console.log(encoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Selector {
  /**
   * Decoded selector.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = SelectorType;
  /**
   * Encoded selector.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = SelectorEncoded;
}

/**
 * Type for {@link Selector}.
 *
 * **Example** (Annotate a selector)
 *
 * ```ts
 * import { Position } from "@beep/text/OffsetUnit"
 * import type { Selector } from "@beep/text/Selector"
 *
 * const selector: Selector = Position.make({ unit: "utf8-byte", start: 0, end: 1 })
 * console.log(selector._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Selector = Selector.Type;
