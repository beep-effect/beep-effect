/**
 * Web Annotation seam DTOs for optional evidence interop.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RdfId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { pipe, Result, SchemaGetter } from "effect";
import * as S from "effect/Schema";
import {
  EvidenceAnchor,
  EvidenceSelector,
  EvidenceTarget,
  FragmentSelector,
  TextPositionSelector,
  TextQuoteSelector,
} from "../Evidence.ts";
import { IRIReference } from "../Iri.ts";
import { makeSemanticSchemaMetadata } from "../SemanticSchemaMetadata.ts";

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
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationTextQuoteSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationTextQuoteSelector)({
 *   type: "TextQuoteSelector",
 *   exact: "quoted text"
 * })
 * console.log(selector.exact) // "quoted text"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class WebAnnotationTextQuoteSelector extends S.Class<WebAnnotationTextQuoteSelector>(
  $I`WebAnnotationTextQuoteSelector`
)(
  {
    type: S.tag("TextQuoteSelector"),
    exact: S.NonEmptyString,
    prefix: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suffix: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("WebAnnotationTextQuoteSelector", {
    description: "Web Annotation text-quote selector DTO.",
    semanticSchemaMetadata: adapterMetadata(
      "WebAnnotationTextQuoteSelector",
      "Web Annotation text-quote selector DTO."
    ),
  })
) {}

/**
 * Web Annotation text-position selector DTO.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationTextPositionSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationTextPositionSelector)({
 *   type: "TextPositionSelector",
 *   start: 10,
 *   end: 21
 * })
 * console.log(selector.start) // 10
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class WebAnnotationTextPositionSelector extends S.Class<WebAnnotationTextPositionSelector>(
  $I`WebAnnotationTextPositionSelector`
)(
  {
    type: S.tag("TextPositionSelector"),
    start: NonNegativeInt,
    end: NonNegativeInt,
  },
  $I.annote("WebAnnotationTextPositionSelector", {
    description: "Web Annotation text-position selector DTO.",
    semanticSchemaMetadata: adapterMetadata(
      "WebAnnotationTextPositionSelector",
      "Web Annotation text-position selector DTO."
    ),
  })
) {}

/**
 * Web Annotation fragment selector DTO.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationFragmentSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationFragmentSelector)({
 *   type: "FragmentSelector",
 *   value: "section-1"
 * })
 * console.log(selector.value) // "section-1"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class WebAnnotationFragmentSelector extends S.Class<WebAnnotationFragmentSelector>(
  $I`WebAnnotationFragmentSelector`
)(
  {
    type: S.tag("FragmentSelector"),
    value: S.NonEmptyString,
    conformsTo: S.OptionFromOptionalKey(IRIReference).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("WebAnnotationFragmentSelector", {
    description: "Web Annotation fragment selector DTO.",
    semanticSchemaMetadata: adapterMetadata("WebAnnotationFragmentSelector", "Web Annotation fragment selector DTO."),
  })
) {}

/**
 * Web Annotation selector union.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationSelector)({
 *   type: "TextPositionSelector",
 *   start: 0,
 *   end: 5
 * })
 * console.log(selector.type) // "TextPositionSelector"
 * ```
 *
 * @since 0.0.0
 * @category models
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
 * @example
 * ```ts
 * import type { WebAnnotationSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const acceptWebAnnotationSelector = (value: WebAnnotationSelector) => value
 * console.log(acceptWebAnnotationSelector)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type WebAnnotationSelector = typeof WebAnnotationSelector.Type;

/**
 * Web Annotation target DTO.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationTarget } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const target = S.decodeUnknownSync(WebAnnotationTarget)({
 *   source: "https://example.org/document",
 *   selector: { type: "FragmentSelector", value: "section-1" }
 * })
 * console.log(target.selector.type) // "FragmentSelector"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class WebAnnotationTarget extends S.Class<WebAnnotationTarget>($I`WebAnnotationTarget`)(
  {
    source: IRIReference,
    selector: WebAnnotationSelector,
  },
  $I.annote("WebAnnotationTarget", {
    description: "Web Annotation target DTO.",
    semanticSchemaMetadata: adapterMetadata("WebAnnotationTarget", "Web Annotation target DTO."),
  })
) {}

/**
 * Web Annotation DTO.
 *
 * @example
 * ```ts
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
 * console.log(annotation.type) // "Annotation"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class WebAnnotation extends S.Class<WebAnnotation>($I`WebAnnotation`)(
  {
    id: IRIReference,
    type: S.tag("Annotation"),
    bodyValue: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    target: WebAnnotationTarget,
  },
  $I.annote("WebAnnotation", {
    description: "Web Annotation DTO.",
    semanticSchemaMetadata: adapterMetadata("WebAnnotation", "Web Annotation DTO."),
  })
) {}

const evidenceSelectorToWebAnnotationSelectorEncoded = (
  selector: EvidenceSelector
): typeof WebAnnotationSelector.Encoded =>
  EvidenceSelector.match(selector, {
    "text-quote": (value) => ({
      type: "TextQuoteSelector" as const,
      exact: value.exact,
      ...O.getSomesStruct({ prefix: value.prefix, suffix: value.suffix }),
    }),
    "text-position": (value) => ({
      type: "TextPositionSelector" as const,
      start: value.start,
      end: value.end,
    }),
    fragment: (value) => ({
      type: "FragmentSelector" as const,
      value: value.value,
      ...O.getSomesStruct({ conformsTo: value.conformsTo }),
    }),
  });

const decodeEvidenceSelector = S.decodeUnknownResult(EvidenceSelector);
const encodeEvidenceSelector = S.encodeUnknownResult(EvidenceSelector);

const evidenceSelectorEncodedToWebAnnotationSelectorEncoded = (
  selector: typeof EvidenceSelector.Encoded
): typeof WebAnnotationSelector.Encoded =>
  pipe(decodeEvidenceSelector(selector), Result.map(evidenceSelectorToWebAnnotationSelectorEncoded), Result.getOrThrow);

const webAnnotationSelectorToEvidenceSelectorValue = (selector: WebAnnotationSelector): EvidenceSelector =>
  WebAnnotationSelector.match(selector, {
    TextQuoteSelector: (value) =>
      TextQuoteSelector.make({
        kind: "text-quote",
        exact: value.exact,
        prefix: value.prefix,
        suffix: value.suffix,
      }),
    TextPositionSelector: (value) =>
      TextPositionSelector.make({
        kind: "text-position",
        start: value.start,
        end: value.end,
      }),
    FragmentSelector: (value) =>
      FragmentSelector.make({
        kind: "fragment",
        value: value.value,
        conformsTo: value.conformsTo,
      }),
  });

const decodeWebAnnotationSelector = S.decodeUnknownResult(WebAnnotationSelector);

const webAnnotationSelectorEncodedToEvidenceSelectorValue = (
  selector: typeof WebAnnotationSelector.Encoded
): EvidenceSelector =>
  pipe(
    decodeWebAnnotationSelector(selector),
    Result.map(webAnnotationSelectorToEvidenceSelectorValue),
    Result.getOrThrow
  );

const webAnnotationSelectorEncodedToEvidenceSelectorEncoded = (
  selector: typeof WebAnnotationSelector.Encoded
): typeof EvidenceSelector.Encoded =>
  pipe(webAnnotationSelectorEncodedToEvidenceSelectorValue(selector), encodeEvidenceSelector, Result.getOrThrow);

/**
 * Codec between package-owned evidence selectors and Web Annotation selector DTOs.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationSelectorFromEvidenceSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const selector = S.decodeUnknownSync(WebAnnotationSelectorFromEvidenceSelector)({
 *   kind: "text-quote",
 *   exact: "quoted text"
 * })
 * console.log(selector.type) // "TextQuoteSelector"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const WebAnnotationSelectorFromEvidenceSelector = S.toEncoded(EvidenceSelector).pipe(
  S.decodeTo(WebAnnotationSelector, {
    decode: SchemaGetter.transform(evidenceSelectorEncodedToWebAnnotationSelectorEncoded),
    encode: SchemaGetter.transform(webAnnotationSelectorEncodedToEvidenceSelectorEncoded),
  }),
  $I.annoteSchema("WebAnnotationSelectorFromEvidenceSelector", {
    description: "Codec between package-owned evidence selectors and Web Annotation selector DTOs.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WebAnnotationSelectorFromEvidenceSelector}.
 *
 * @example
 * ```ts
 * import type { WebAnnotationSelectorFromEvidenceSelector } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const acceptWebAnnotationSelector = (value: WebAnnotationSelectorFromEvidenceSelector) => value
 * console.log(acceptWebAnnotationSelector)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type WebAnnotationSelectorFromEvidenceSelector = typeof WebAnnotationSelectorFromEvidenceSelector.Type;

/**
 * Map an evidence selector to a Web Annotation selector DTO.
 *
 * @param selector - Evidence selector.
 * @returns Web Annotation selector DTO.
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { evidenceSelectorToWebAnnotationSelector } from "@beep/rdf/Adapters/WebAnnotation"
 * import { TextQuoteSelector } from "@beep/rdf/Evidence"
 *
 * const evidenceSelector = S.decodeUnknownSync(TextQuoteSelector)({
 *   kind: "text-quote",
 *   exact: "quoted text"
 * })
 * const selector = evidenceSelectorToWebAnnotationSelector(evidenceSelector)
 * console.log(selector.type) // "TextQuoteSelector"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const evidenceSelectorToWebAnnotationSelector = (selector: EvidenceSelector): WebAnnotationSelector =>
  pipe(evidenceSelectorToWebAnnotationSelectorEncoded(selector), decodeWebAnnotationSelector, Result.getOrThrow);

/**
 * Map a Web Annotation selector DTO to an evidence selector.
 *
 * @param selector - Web Annotation selector DTO.
 * @returns Evidence selector.
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import {
 *   WebAnnotationTextPositionSelector,
 *   webAnnotationSelectorToEvidenceSelector
 * } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const annotationSelector = S.decodeUnknownSync(WebAnnotationTextPositionSelector)({
 *   type: "TextPositionSelector",
 *   start: 0,
 *   end: 5
 * })
 * const selector = webAnnotationSelectorToEvidenceSelector(annotationSelector)
 * console.log(selector.kind) // "text-position"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const webAnnotationSelectorToEvidenceSelector = (selector: WebAnnotationSelector): EvidenceSelector =>
  webAnnotationSelectorToEvidenceSelectorValue(selector);

const evidenceTargetToWebAnnotationTargetEncoded = (target: EvidenceTarget): typeof WebAnnotationTarget.Encoded => ({
  source: target.source,
  selector: evidenceSelectorToWebAnnotationSelectorEncoded(target.selector),
});

const decodeEvidenceTarget = S.decodeUnknownResult(EvidenceTarget);
const encodeEvidenceTarget = S.encodeUnknownResult(EvidenceTarget);

const evidenceTargetEncodedToWebAnnotationTargetEncoded = (
  target: typeof EvidenceTarget.Encoded
): typeof WebAnnotationTarget.Encoded =>
  pipe(decodeEvidenceTarget(target), Result.map(evidenceTargetToWebAnnotationTargetEncoded), Result.getOrThrow);

const webAnnotationTargetToEvidenceTargetValue = (target: WebAnnotationTarget): EvidenceTarget =>
  EvidenceTarget.make({
    source: target.source,
    selector: webAnnotationSelectorToEvidenceSelectorValue(target.selector),
  });

const decodeWebAnnotationTarget = S.decodeUnknownResult(WebAnnotationTarget);

const webAnnotationTargetEncodedToEvidenceTargetValue = (target: typeof WebAnnotationTarget.Encoded): EvidenceTarget =>
  pipe(decodeWebAnnotationTarget(target), Result.map(webAnnotationTargetToEvidenceTargetValue), Result.getOrThrow);

const webAnnotationTargetEncodedToEvidenceTargetEncoded = (
  target: typeof WebAnnotationTarget.Encoded
): typeof EvidenceTarget.Encoded =>
  pipe(webAnnotationTargetEncodedToEvidenceTargetValue(target), encodeEvidenceTarget, Result.getOrThrow);

/**
 * Codec between evidence targets and Web Annotation target DTOs.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationTargetFromEvidenceTarget } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const target = S.decodeUnknownSync(WebAnnotationTargetFromEvidenceTarget)({
 *   source: "https://example.org/document",
 *   selector: { kind: "fragment", value: "section-1" }
 * })
 * console.log(target.selector.type) // "FragmentSelector"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const WebAnnotationTargetFromEvidenceTarget = S.toEncoded(EvidenceTarget).pipe(
  S.decodeTo(WebAnnotationTarget, {
    decode: SchemaGetter.transform(evidenceTargetEncodedToWebAnnotationTargetEncoded),
    encode: SchemaGetter.transform(webAnnotationTargetEncodedToEvidenceTargetEncoded),
  }),
  $I.annoteSchema("WebAnnotationTargetFromEvidenceTarget", {
    description: "Codec between evidence targets and Web Annotation target DTOs.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WebAnnotationTargetFromEvidenceTarget}.
 *
 * @example
 * ```ts
 * import type { WebAnnotationTargetFromEvidenceTarget } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const acceptWebAnnotationTarget = (value: WebAnnotationTargetFromEvidenceTarget) => value
 * console.log(acceptWebAnnotationTarget)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type WebAnnotationTargetFromEvidenceTarget = typeof WebAnnotationTargetFromEvidenceTarget.Type;

const evidenceAnchorToWebAnnotationEncoded = (anchor: EvidenceAnchor): typeof WebAnnotation.Encoded => ({
  id: anchor.id,
  type: "Annotation",
  ...O.getSomesStruct({ bodyValue: anchor.note }),
  target: evidenceTargetToWebAnnotationTargetEncoded(anchor.target),
});

const decodeEvidenceAnchor = S.decodeUnknownResult(EvidenceAnchor);
const encodeEvidenceAnchor = S.encodeUnknownResult(EvidenceAnchor);

const evidenceAnchorEncodedToWebAnnotationEncoded = (
  anchor: typeof EvidenceAnchor.Encoded
): typeof WebAnnotation.Encoded =>
  pipe(decodeEvidenceAnchor(anchor), Result.map(evidenceAnchorToWebAnnotationEncoded), Result.getOrThrow);

const webAnnotationToEvidenceAnchorValue = (annotation: WebAnnotation): EvidenceAnchor =>
  EvidenceAnchor.make({
    id: annotation.id,
    target: webAnnotationTargetToEvidenceTargetValue(annotation.target),
    note: annotation.bodyValue,
  });

const decodeWebAnnotation = S.decodeUnknownResult(WebAnnotation);

const webAnnotationEncodedToEvidenceAnchorValue = (annotation: typeof WebAnnotation.Encoded): EvidenceAnchor =>
  pipe(decodeWebAnnotation(annotation), Result.map(webAnnotationToEvidenceAnchorValue), Result.getOrThrow);

const webAnnotationEncodedToEvidenceAnchorEncoded = (
  annotation: typeof WebAnnotation.Encoded
): typeof EvidenceAnchor.Encoded =>
  pipe(webAnnotationEncodedToEvidenceAnchorValue(annotation), encodeEvidenceAnchor, Result.getOrThrow);

/**
 * Codec between evidence anchors and Web Annotation DTOs.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationFromEvidenceAnchor } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const annotation = S.decodeUnknownSync(WebAnnotationFromEvidenceAnchor)({
 *   id: "https://example.org/annotation/1",
 *   target: {
 *     source: "https://example.org/document",
 *     selector: { kind: "fragment", value: "section-1" }
 *   }
 * })
 * console.log(annotation.type) // "Annotation"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const WebAnnotationFromEvidenceAnchor = S.toEncoded(EvidenceAnchor).pipe(
  S.decodeTo(WebAnnotation, {
    decode: SchemaGetter.transform(evidenceAnchorEncodedToWebAnnotationEncoded),
    encode: SchemaGetter.transform(webAnnotationEncodedToEvidenceAnchorEncoded),
  }),
  $I.annoteSchema("WebAnnotationFromEvidenceAnchor", {
    description: "Codec between evidence anchors and Web Annotation DTOs.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WebAnnotationFromEvidenceAnchor}.
 *
 * @example
 * ```ts
 * import type { WebAnnotationFromEvidenceAnchor } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const acceptWebAnnotation = (value: WebAnnotationFromEvidenceAnchor) => value
 * console.log(acceptWebAnnotation)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type WebAnnotationFromEvidenceAnchor = typeof WebAnnotationFromEvidenceAnchor.Type;

/**
 * Map an evidence target to a Web Annotation target DTO.
 *
 * @param target - Evidence target.
 * @returns Web Annotation target DTO.
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { evidenceTargetToWebAnnotationTarget } from "@beep/rdf/Adapters/WebAnnotation"
 * import { EvidenceTarget } from "@beep/rdf/Evidence"
 *
 * const evidenceTarget = S.decodeUnknownSync(EvidenceTarget)({
 *   source: "https://example.org/document",
 *   selector: { kind: "fragment", value: "section-1" }
 * })
 * const target = evidenceTargetToWebAnnotationTarget(evidenceTarget)
 * console.log(target.selector.type) // "FragmentSelector"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const evidenceTargetToWebAnnotationTarget = (target: EvidenceTarget): WebAnnotationTarget =>
  pipe(evidenceTargetToWebAnnotationTargetEncoded(target), decodeWebAnnotationTarget, Result.getOrThrow);

/**
 * Map a Web Annotation target DTO to an evidence target.
 *
 * @param target - Web Annotation target DTO.
 * @returns Evidence target.
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotationTarget, webAnnotationTargetToEvidenceTarget } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const annotationTarget = S.decodeUnknownSync(WebAnnotationTarget)({
 *   source: "https://example.org/document",
 *   selector: { type: "FragmentSelector", value: "section-1" }
 * })
 * const target = webAnnotationTargetToEvidenceTarget(annotationTarget)
 * console.log(target.selector.kind) // "fragment"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const webAnnotationTargetToEvidenceTarget = (target: WebAnnotationTarget): EvidenceTarget =>
  webAnnotationTargetToEvidenceTargetValue(target);

/**
 * Map an evidence anchor to a Web Annotation DTO.
 *
 * @param anchor - Evidence anchor.
 * @returns Web Annotation DTO.
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { evidenceAnchorToWebAnnotation } from "@beep/rdf/Adapters/WebAnnotation"
 * import { EvidenceAnchor } from "@beep/rdf/Evidence"
 *
 * const anchor = S.decodeUnknownSync(EvidenceAnchor)({
 *   id: "https://example.org/annotation/1",
 *   note: "supports the claim",
 *   target: {
 *     source: "https://example.org/document",
 *     selector: { kind: "text-quote", exact: "quoted text" }
 *   }
 * })
 * const annotation = evidenceAnchorToWebAnnotation(anchor)
 * console.log(O.getOrUndefined(annotation.bodyValue)) // "supports the claim"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const evidenceAnchorToWebAnnotation = (anchor: EvidenceAnchor): WebAnnotation =>
  pipe(evidenceAnchorToWebAnnotationEncoded(anchor), decodeWebAnnotation, Result.getOrThrow);

/**
 * Map a Web Annotation DTO to an evidence anchor.
 *
 * @param annotation - Web Annotation DTO.
 * @returns Evidence anchor.
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WebAnnotation, webAnnotationToEvidenceAnchor } from "@beep/rdf/Adapters/WebAnnotation"
 *
 * const annotation = S.decodeUnknownSync(WebAnnotation)({
 *   id: "https://example.org/annotation/1",
 *   type: "Annotation",
 *   target: {
 *     source: "https://example.org/document",
 *     selector: { type: "FragmentSelector", value: "section-1" }
 *   }
 * })
 * const anchor = webAnnotationToEvidenceAnchor(annotation)
 * console.log(anchor.target.selector.kind) // "fragment"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const webAnnotationToEvidenceAnchor = (annotation: WebAnnotation): EvidenceAnchor =>
  webAnnotationToEvidenceAnchorValue(annotation);
