/**
 * Web Annotation wire DTOs and the codec between a `TextAnchor` and an
 * `oa:` target.
 *
 * **Details**
 *
 * A `TextAnchor` counts UTF-16 code units; Web Annotation position selectors
 * count code points. The codec converts through `@beep/text` `convertPosition`
 * over the source text, writes one position and one quote selector, and reads
 * every selector of a target back, failing closed when they disagree. What it
 * decodes is a candidate anchor, never a proof: the caller verifies it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRIReference } from "@beep/identity/Iri";
import { $RdfId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { convertPosition, Position } from "@beep/text/OffsetUnit";
import { Resolution, resolve } from "@beep/text/Resolution";
import { QuoteSelector } from "@beep/text/Selector";
import { TextAnchor } from "@beep/text/TextAnchor";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, constTrue, dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeSemanticSchemaMetadata } from "../SemanticSchemaMetadata/index.ts";
import type { UnitConversionRefused } from "@beep/text/OffsetUnit";

const $I = $RdfId.create("adapters/web-annotation");

const adapterMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "adapterBoundary",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "Web Annotation Data Model", disposition: "informative" }],
    equivalenceBasis: "Exact DTO field equality.",
    representations: [{ kind: "JSON-LD" }],
    evidenceAnchoring: "Optional adapter seam only; not the canonical package storage model.",
  });

/**
 * Web Annotation text-quote selector DTO.
 *
 * **Example** (Decode text-quote selector)
 *
 * ```ts import.meta.vitest name="Decode text-quote selector"
 * import * as S from "effect/Schema"
 * import { WebAnnotationTextQuoteSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationTextQuoteSelector)({
 *   type: "TextQuoteSelector",
 *   exact: "quoted text"
 * })
 * selector.exact // => "quoted text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebAnnotationTextQuoteSelector extends S.Opaque<
  WebAnnotationTextQuoteSelector,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("TextQuoteSelector"),
    exact: S.NonEmptyString,
    prefix: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    suffix: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("WebAnnotationTextQuoteSelector", {
      description: "Web Annotation text-quote selector DTO.",
      semanticSchemaMetadata: adapterMetadata(
        "WebAnnotationTextQuoteSelector",
        "Web Annotation text-quote selector DTO."
      ),
    })
  )
) {}

/**
 * Web Annotation text-position selector DTO.
 *
 * **Example** (Decode text-position selector)
 *
 * ```ts import.meta.vitest name="Decode text-position selector"
 * import * as S from "effect/Schema"
 * import { WebAnnotationTextPositionSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationTextPositionSelector)({
 *   type: "TextPositionSelector",
 *   start: 10,
 *   end: 21
 * })
 * selector.start // => 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebAnnotationTextPositionSelector extends S.Opaque<
  WebAnnotationTextPositionSelector,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("TextPositionSelector"),
    start: S.Natural,
    end: S.Natural,
  }).pipe(
    $I.annoteSchema("WebAnnotationTextPositionSelector", {
      description: "Web Annotation text-position selector DTO.",
      semanticSchemaMetadata: adapterMetadata(
        "WebAnnotationTextPositionSelector",
        "Web Annotation text-position selector DTO."
      ),
    })
  )
) {}

/**
 * Web Annotation fragment selector DTO.
 *
 * **Example** (Decode fragment selector)
 *
 * ```ts import.meta.vitest name="Decode fragment selector"
 * import * as S from "effect/Schema"
 * import { WebAnnotationFragmentSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationFragmentSelector)({
 *   type: "FragmentSelector",
 *   value: "section-1"
 * })
 * selector.value // => "section-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebAnnotationFragmentSelector extends S.Opaque<
  WebAnnotationFragmentSelector,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("FragmentSelector"),
    value: S.NonEmptyString,
    conformsTo: S.OptionFromOptionalKey(IRIReference).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("WebAnnotationFragmentSelector", {
      description: "Web Annotation fragment selector DTO.",
      semanticSchemaMetadata: adapterMetadata("WebAnnotationFragmentSelector", "Web Annotation fragment selector DTO."),
    })
  )
) {}

/**
 * Web Annotation selector union.
 *
 * **Example** (Decode selector union)
 *
 * ```ts import.meta.vitest name="Decode selector union"
 * import * as S from "effect/Schema"
 * import { WebAnnotationSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationSelector)({
 *   type: "TextPositionSelector",
 *   start: 0,
 *   end: 5
 * })
 * selector.type // => "TextPositionSelector"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WebAnnotationSelector = S.Union([
  WebAnnotationTextQuoteSelector,
  WebAnnotationTextPositionSelector,
  WebAnnotationFragmentSelector,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("WebAnnotationSelector", {
    description: "Web Annotation selector union.",
  })
);

/**
 * Type for {@link WebAnnotationSelector}.
 *
 * **Example** (Accept selector type)
 *
 * ```ts
 * import type { WebAnnotationSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const acceptWebAnnotationSelector = (value: WebAnnotationSelector) => value
 * console.log(acceptWebAnnotationSelector)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WebAnnotationSelector = typeof WebAnnotationSelector.Type;

/**
 * Web Annotation target DTO with one or more selectors of the same source.
 *
 * **Details**
 *
 * `selector` decodes one selector object or an array of them to a non-empty
 * array, and a one-member array encodes back to the bare object, so a
 * single-selector annotation keeps its wire bytes.
 *
 * **Example** (Decode annotation target)
 *
 * ```ts import.meta.vitest name="Decode annotation target"
 * import * as S from "effect/Schema"
 * import { WebAnnotationTarget } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const target = S.decodeUnknownSync(WebAnnotationTarget)({
 *   source: "https://example.org/document",
 *   selector: { type: "FragmentSelector", value: "section-1" }
 * })
 * target.selector.length // => 1
 * target.selector[0]?.type // => "FragmentSelector"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebAnnotationTarget extends S.Opaque<WebAnnotationTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    source: IRIReference,
    selector: S.ArrayEnsure(WebAnnotationSelector).check(S.isMinLength(1)),
  }).pipe(
    $I.annoteSchema("WebAnnotationTarget", {
      description: "Web Annotation target DTO.",
      semanticSchemaMetadata: adapterMetadata("WebAnnotationTarget", "Web Annotation target DTO."),
    })
  )
) {}

/**
 * Web Annotation DTO.
 *
 * **Example** (Decode web annotation)
 *
 * ```ts import.meta.vitest name="Decode web annotation"
 * import * as S from "effect/Schema"
 * import { WebAnnotation } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const annotation = S.decodeUnknownSync(WebAnnotation)({
 *   id: "https://example.org/annotation/1",
 *   type: "Annotation",
 *   bodyValue: "supports the claim",
 *   target: {
 *     source: "https://example.org/document",
 *     selector: { type: "TextQuoteSelector", exact: "quoted text" }
 *   }
 * })
 * annotation.type // => "Annotation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebAnnotation extends S.Opaque<WebAnnotation, { readonly brand: unique symbol }>()(
  S.Struct({
    id: IRIReference,
    type: S.tag("Annotation"),
    bodyValue: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    target: WebAnnotationTarget,
  }).pipe(
    $I.annoteSchema("WebAnnotation", {
      description: "Web Annotation DTO.",
      semanticSchemaMetadata: adapterMetadata("WebAnnotation", "Web Annotation DTO."),
    })
  )
) {}

/**
 * Why a `TextAnchor` and a Web Annotation target could not be mapped.
 *
 * **Details**
 *
 * `split-boundary`, `out-of-range` and `ill-formed-text` come from the unit
 * conversion. `empty-range` is a wire position whose start is not before its
 * end, `selector-conflict` is selectors (or an anchor and its text) that
 * disagree, `ambiguous` and `not-found` are a quote-only target that does not
 * resolve to one place, and `no-text-selector` is a target with neither a
 * position nor a quote selector.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts import.meta.vitest name="Check an anchor refusal reason"
 * import { WebAnnotationAnchorRefusal } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * WebAnnotationAnchorRefusal.is["selector-conflict"]("selector-conflict") // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WebAnnotationAnchorRefusal = LiteralKit([
  "split-boundary",
  "out-of-range",
  "ill-formed-text",
  "empty-range",
  "selector-conflict",
  "ambiguous",
  "not-found",
  "no-text-selector",
]).pipe(
  $I.annoteSchema("WebAnnotationAnchorRefusal", {
    description: "Reason a TextAnchor and a Web Annotation target could not be mapped.",
    semanticSchemaMetadata: adapterMetadata(
      "WebAnnotationAnchorRefusal",
      "Reason a TextAnchor and a Web Annotation target could not be mapped."
    ),
  })
);

/**
 * Type for {@link WebAnnotationAnchorRefusal}.
 *
 * **Example** (Annotate a refusal reason)
 *
 * ```ts
 * import type { WebAnnotationAnchorRefusal } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const reason: WebAnnotationAnchorRefusal = "no-text-selector"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type WebAnnotationAnchorRefusal = typeof WebAnnotationAnchorRefusal.Type;

/**
 * Typed refusal of the `TextAnchor` to Web Annotation codec.
 *
 * **Example** (Read a refusal)
 *
 * ```ts import.meta.vitest name="Read an anchor refusal"
 * import { WebAnnotationAnchorRefused } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const refused = WebAnnotationAnchorRefused.make({ reason: "ambiguous" })
 * refused.reason // => "ambiguous"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WebAnnotationAnchorRefused extends S.TaggedError<
  WebAnnotationAnchorRefused,
  { readonly brand: unique symbol }
>($I`WebAnnotationAnchorRefused`)(
  "WebAnnotationAnchorRefused",
  { reason: WebAnnotationAnchorRefusal },
  $I.annoteError<WebAnnotationAnchorRefused>("WebAnnotationAnchorRefused", {
    description: "A TextAnchor and a Web Annotation target that could not be mapped onto each other.",
    semanticSchemaMetadata: adapterMetadata(
      "WebAnnotationAnchorRefused",
      "A TextAnchor and a Web Annotation target that could not be mapped onto each other."
    ),
  })
) {}

const refused = (reason: WebAnnotationAnchorRefusal): WebAnnotationAnchorRefused =>
  WebAnnotationAnchorRefused.make({ reason });

const conversionRefused = (refusal: UnitConversionRefused): WebAnnotationAnchorRefused => refused(refusal.reason);

const selectorConflict = (): WebAnnotationAnchorRefused => refused("selector-conflict");

const utf16Position = (start: number, end: number): Position => Position.make({ unit: "utf16-code-unit", start, end });

// The code-point position of a UTF-16 range, which also proves the text before the range end is well formed.
const toCodePoints = (range: Position, sourceText: string): Result.Result<Position, WebAnnotationAnchorRefused> =>
  pipe(convertPosition(range, "unicode-code-point", sourceText), Result.mapError(conversionRefused));

const encodeTextAnchor = (
  anchor: TextAnchor,
  options: { readonly source: IRIReference; readonly sourceText: string }
): Result.Result<WebAnnotationTarget, WebAnnotationAnchorRefused> =>
  pipe(
    toCodePoints(utf16Position(anchor.startChar, anchor.endChar), options.sourceText),
    Result.filterOrFail(
      () => Str.slice(anchor.startChar, anchor.endChar)(options.sourceText) === anchor.quote,
      selectorConflict
    ),
    Result.map((points) =>
      WebAnnotationTarget.make({
        source: options.source,
        selector: [
          WebAnnotationTextPositionSelector.make({
            type: "TextPositionSelector",
            start: points.start,
            end: points.end,
          }),
          WebAnnotationTextQuoteSelector.make({ type: "TextQuoteSelector", exact: anchor.quote }),
        ],
      })
    )
  );

const sameRange =
  (left: Position) =>
  (right: Position): boolean =>
    left.start === right.start && left.end === right.end;

// Every selector of one kind must give the same range; no selector of the kind gives none.
const agreeing = (ranges: ReadonlyArray<Position>): Result.Result<O.Option<Position>, WebAnnotationAnchorRefused> =>
  A.match(ranges, {
    onEmpty: () => Result.succeedNone,
    onNonEmpty: (all) =>
      pipe(
        Result.succeed(A.headNonEmpty(all)),
        Result.filterOrFail((first) => A.every(all, sameRange(first)), selectorConflict),
        Result.map(O.some)
      ),
  });

const positionRange =
  (sourceText: string) =>
  (selector: WebAnnotationTextPositionSelector): Result.Result<Position, WebAnnotationAnchorRefused> =>
    selector.start < selector.end
      ? pipe(
          convertPosition(
            Position.make({ unit: "unicode-code-point", start: selector.start, end: selector.end }),
            "utf16-code-unit",
            sourceText
          ),
          Result.mapError(conversionRefused)
        )
      : Result.fail(refused("empty-range"));

// A quote beside a position must be the text the position selects, with its stated context on either side.
const quoteFits =
  (sourceText: string, range: Position) =>
  (quote: WebAnnotationTextQuoteSelector): boolean =>
    quote.exact === Str.slice(range.start, range.end)(sourceText) &&
    O.match(quote.prefix, { onNone: constTrue, onSome: (prefix) => Str.endsWith(prefix, range.start)(sourceText) }) &&
    O.match(quote.suffix, { onNone: constTrue, onSome: (suffix) => Str.startsWith(suffix, range.end)(sourceText) });

const quoteRange =
  (sourceText: string) =>
  (quote: WebAnnotationTextQuoteSelector): Result.Result<Position, WebAnnotationAnchorRefused> =>
    Resolution.match(
      resolve(sourceText, QuoteSelector.make({ exact: quote.exact, prefix: quote.prefix, suffix: quote.suffix })),
      {
        Unique: (unique) => Result.succeed(unique.position),
        Ambiguous: () => Result.fail(refused("ambiguous")),
        NotFound: () => Result.fail(refused("not-found")),
      }
    );

const anchorOver = (sourceText: string, range: Position): TextAnchor =>
  TextAnchor.make({ startChar: range.start, endChar: range.end, quote: Str.slice(range.start, range.end)(sourceText) });

const fromPosition = (
  sourceText: string,
  range: Position,
  quotes: ReadonlyArray<WebAnnotationTextQuoteSelector>
): Result.Result<TextAnchor, WebAnnotationAnchorRefused> =>
  A.every(quotes, quoteFits(sourceText, range))
    ? Result.succeed(anchorOver(sourceText, range))
    : Result.fail(selectorConflict());

// A quote-only target must resolve to one range, and that range must convert to code points as an encoded anchor
// does, so every decoded anchor encodes again.
const fromQuotes = (
  sourceText: string,
  quotes: ReadonlyArray<WebAnnotationTextQuoteSelector>
): Result.Result<TextAnchor, WebAnnotationAnchorRefused> =>
  pipe(
    Result.all(A.map(quotes, quoteRange(sourceText))),
    Result.flatMap(agreeing),
    Result.flatMap(Result.fromOption(() => refused("no-text-selector"))),
    Result.flatMap((range) => Result.map(toCodePoints(range, sourceText), constant(range))),
    Result.map((range) => anchorOver(sourceText, range))
  );

const decodeTarget = (
  target: WebAnnotationTarget,
  sourceText: string
): Result.Result<TextAnchor, WebAnnotationAnchorRefused> => {
  const quotes = A.filter(target.selector, WebAnnotationSelector.guards.TextQuoteSelector);
  return pipe(
    Result.all(
      A.map(A.filter(target.selector, WebAnnotationSelector.guards.TextPositionSelector), positionRange(sourceText))
    ),
    Result.flatMap(agreeing),
    Result.flatMap(
      O.match({
        onNone: () => fromQuotes(sourceText, quotes),
        onSome: (range) => fromPosition(sourceText, range, quotes),
      })
    )
  );
};

/**
 * Write a `TextAnchor` as a Web Annotation target over its source text.
 *
 * **Details**
 *
 * The anchor's UTF-16 range is converted to code points over `sourceText`,
 * the text there must be the anchor's quote, and the target carries a
 * `TextPositionSelector` and a `TextQuoteSelector`. `source` is the caller's
 * `oa:hasSource` IRI: a source text identity is not one.
 *
 * **Example** (Encode an anchor after an astral character)
 *
 * ```ts import.meta.vitest name="Encode an anchor after an astral character"
 * import * as S from "effect/Schema"
 * import * as Result from "effect/Result"
 * import { IRIReference } from "@beep/identity/Iri"
 * import { textAnchorToWebAnnotationTarget, WebAnnotationTarget } from "@beep/rdf/Adapters/WebAnnotation"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 *
 * const anchor = TextAnchor.make({ startChar: 3, endChar: 4, quote: "B" })
 * const source = S.decodeUnknownSync(IRIReference)("https://example.org/document")
 * const target = Result.getOrThrow(textAnchorToWebAnnotationTarget(anchor, { source, sourceText: "A😀B" }))
 * const wire = JSON.stringify(S.encodeSync(WebAnnotationTarget)(target).selector)
 * wire // => '[{"type":"TextPositionSelector","start":2,"end":3},{"type":"TextQuoteSelector","exact":"B"}]'
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const textAnchorToWebAnnotationTarget: {
  (options: {
    readonly source: IRIReference;
    readonly sourceText: string;
  }): (anchor: TextAnchor) => Result.Result<WebAnnotationTarget, WebAnnotationAnchorRefused>;
  (
    anchor: TextAnchor,
    options: { readonly source: IRIReference; readonly sourceText: string }
  ): Result.Result<WebAnnotationTarget, WebAnnotationAnchorRefused>;
} = dual(2, encodeTextAnchor);

/**
 * Read a Web Annotation target back to a candidate `TextAnchor` over its
 * source text.
 *
 * **Details**
 *
 * Every selector is read and all must agree. Position selectors are code
 * points; each converts to UTF-16, and two of them must give one range. A
 * quote beside a position must be the text there, with any stated prefix and
 * suffix matching the text on either side. Without a position, each quote
 * must resolve to one place (`resolve`) and all to the same one. Fragment
 * selectors are ignored beside a text selector. The anchor holds no prefix,
 * suffix or fragment, so re-encoding is stable on the anchor, not on the
 * target. The result is never a proof: verify it against the source.
 *
 * **Example** (Decode a quote-only target)
 *
 * ```ts import.meta.vitest name="Decode a quote-only target"
 * import * as S from "effect/Schema"
 * import * as Result from "effect/Result"
 * import { WebAnnotationTarget, webAnnotationTargetToTextAnchor } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const target = S.decodeUnknownSync(WebAnnotationTarget)({
 *   source: "https://example.org/document",
 *   selector: { type: "TextQuoteSelector", exact: "B" }
 * })
 * const anchor = Result.getOrThrow(webAnnotationTargetToTextAnchor(target, "A😀B"))
 * anchor.startChar // => 3
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const webAnnotationTargetToTextAnchor: {
  (sourceText: string): (target: WebAnnotationTarget) => Result.Result<TextAnchor, WebAnnotationAnchorRefused>;
  (target: WebAnnotationTarget, sourceText: string): Result.Result<TextAnchor, WebAnnotationAnchorRefused>;
} = dual(2, decodeTarget);
