/**
 * Evidence anchors and selectors for provenance-adjacent workflows.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RdfId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { IRIReference } from "./Iri.ts";
import { makeSemanticSchemaMetadata } from "./SemanticSchemaMetadata.ts";

const $I = $RdfId.create("evidence");

/**
 * Evidence selector discriminator.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EvidenceSelectorKind } from "@beep/rdf/Evidence"
 *
 * console.log(S.is(EvidenceSelectorKind)("text-quote")) // true
 * console.log(S.is(EvidenceSelectorKind)("unknown")) // false
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const EvidenceSelectorKind = LiteralKit(["text-quote", "text-position", "fragment"]).pipe(
  $I.annoteSchema("EvidenceSelectorKind", {
    description: "Evidence selector discriminator.",
  })
);

/**
 * Type for {@link EvidenceSelectorKind}.
 *
 * @example
 * ```ts
 * import type { EvidenceSelectorKind } from "@beep/rdf/Evidence"
 *
 * const acceptEvidenceSelectorKind = (value: EvidenceSelectorKind) => value
 * console.log(acceptEvidenceSelectorKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EvidenceSelectorKind = typeof EvidenceSelectorKind.Type;

/**
 * Text-quote selector for evidence anchors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextQuoteSelector } from "@beep/rdf/Evidence"
 *
 * const selector = S.decodeUnknownSync(TextQuoteSelector)({
 *   kind: "text-quote",
 *   exact: "quoted text",
 *   prefix: "before ",
 *   suffix: " after"
 * })
 * console.log(selector.kind) // "text-quote"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TextQuoteSelector extends S.Class<TextQuoteSelector>($I`TextQuoteSelector`)(
  {
    kind: S.tag("text-quote"),
    exact: S.NonEmptyString,
    prefix: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suffix: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("TextQuoteSelector", {
    description: "Text-quote selector for evidence anchors.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "TextQuoteSelector",
      overview: "Text-quote selector for evidence anchors.",
      status: "stable",
      specifications: [
        { name: "Web Annotation Data Model", section: "Text Quote Selector", disposition: "informative" },
      ],
      equivalenceBasis: "Exact quote, prefix, and suffix equality.",
      evidenceAnchoring: "Adapter-neutral evidence selector compatible with Web Annotation text selectors.",
    }),
  })
) {}

/**
 * Text-position selector for evidence anchors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextPositionSelector } from "@beep/rdf/Evidence"
 *
 * const selector = S.decodeUnknownSync(TextPositionSelector)({
 *   kind: "text-position",
 *   start: 0,
 *   end: 5
 * })
 * console.log(selector.start) // 0
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TextPositionSelector extends S.Class<TextPositionSelector>($I`TextPositionSelector`)(
  {
    kind: S.tag("text-position"),
    start: NonNegativeInt,
    end: NonNegativeInt,
  },
  $I.annote("TextPositionSelector", {
    description: "Text-position selector for evidence anchors.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "TextPositionSelector",
      overview: "Text-position selector for evidence anchors.",
      status: "stable",
      specifications: [
        { name: "Web Annotation Data Model", section: "Text Position Selector", disposition: "informative" },
      ],
      equivalenceBasis: "Exact start and end offset equality.",
      evidenceAnchoring: "Adapter-neutral evidence selector compatible with Web Annotation text-position selectors.",
    }),
  })
) {}

/**
 * Fragment selector for evidence anchors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FragmentSelector } from "@beep/rdf/Evidence"
 *
 * const selector = S.decodeUnknownSync(FragmentSelector)({
 *   kind: "fragment",
 *   value: "section-1"
 * })
 * console.log(selector.value) // "section-1"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class FragmentSelector extends S.Class<FragmentSelector>($I`FragmentSelector`)(
  {
    kind: S.tag("fragment"),
    value: S.NonEmptyString,
    conformsTo: S.OptionFromOptionalKey(IRIReference).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FragmentSelector", {
    description: "Fragment selector for evidence anchors.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "FragmentSelector",
      overview: "Fragment selector for evidence anchors.",
      status: "stable",
      specifications: [{ name: "Media Fragments URI 1.0", disposition: "informative" }],
      equivalenceBasis: "Exact fragment and optional conformsTo equality.",
      evidenceAnchoring: "Adapter-neutral evidence selector for URI fragment addressing.",
    }),
  })
) {}

/**
 * Evidence selector union.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EvidenceSelector } from "@beep/rdf/Evidence"
 *
 * const decoded = S.decodeUnknownSync(EvidenceSelector)({
 *   kind: "text-quote",
 *   exact: "quoted text"
 * })
 * console.log(decoded.kind) // "text-quote"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const EvidenceSelector = S.Union([TextQuoteSelector, TextPositionSelector, FragmentSelector]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("EvidenceSelector", {
    description: "Evidence selector union.",
  })
);

/**
 * Type for {@link EvidenceSelector}.
 *
 * @example
 * ```ts
 * import type { EvidenceSelector } from "@beep/rdf/Evidence"
 *
 * const acceptEvidenceSelector = (value: EvidenceSelector) => value
 * console.log(acceptEvidenceSelector)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EvidenceSelector = typeof EvidenceSelector.Type;

/**
 * Target resource plus selector pair referenced by an evidence anchor.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EvidenceTarget } from "@beep/rdf/Evidence"
 *
 * const target = S.decodeUnknownSync(EvidenceTarget)({
 *   source: "https://example.org/document",
 *   selector: { kind: "fragment", value: "section-1" }
 * })
 * console.log(target.selector.kind) // "fragment"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class EvidenceTarget extends S.Class<EvidenceTarget>($I`EvidenceTarget`)(
  {
    source: IRIReference,
    selector: EvidenceSelector,
  },
  $I.annote("EvidenceTarget", {
    description: "Target resource plus selector pair referenced by an evidence anchor.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "EvidenceTarget",
      overview: "Target resource plus selector pair referenced by an evidence anchor.",
      status: "stable",
      specifications: [{ name: "Web Annotation Data Model", section: "Target", disposition: "informative" }],
      equivalenceBasis: "Source and selector equality.",
      evidenceAnchoring: "Core package-owned evidence target that can be mapped to Web Annotation.",
    }),
  })
) {}

/**
 * Evidence anchor value referenced from provenance and verification services.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EvidenceAnchor } from "@beep/rdf/Evidence"
 *
 * const anchor = S.decodeUnknownSync(EvidenceAnchor)({
 *   id: "https://example.org/annotation/1",
 *   target: {
 *     source: "https://example.org/document",
 *     selector: { kind: "text-position", start: 0, end: 12 }
 *   },
 *   note: "supports the claim"
 * })
 * console.log(anchor.id) // "https://example.org/annotation/1"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class EvidenceAnchor extends S.Class<EvidenceAnchor>($I`EvidenceAnchor`)(
  {
    id: IRIReference,
    target: EvidenceTarget,
    note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("EvidenceAnchor", {
    description: "Evidence anchor value referenced from provenance and verification services.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "EvidenceAnchor",
      overview: "Evidence anchor value referenced from provenance and verification services.",
      status: "stable",
      specifications: [{ name: "Web Annotation Data Model", disposition: "informative" }],
      equivalenceBasis: "Identifier and target equality.",
      evidenceAnchoring:
        "Core package-owned evidence anchor that can be mapped to Web Annotation without making that model mandatory.",
    }),
  })
) {}

/**
 * Bounded evidence projection.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoundedEvidenceProjection } from "@beep/rdf/Evidence"
 *
 * const projection = S.decodeUnknownSync(BoundedEvidenceProjection)({
 *   anchors: [
 *     {
 *       id: "https://example.org/annotation/1",
 *       target: {
 *         source: "https://example.org/document",
 *         selector: { kind: "fragment", value: "section-1" }
 *       }
 *     }
 *   ],
 *   truncated: false
 * })
 * console.log(projection.anchors.length) // 1
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class BoundedEvidenceProjection extends S.Class<BoundedEvidenceProjection>($I`BoundedEvidenceProjection`)(
  {
    anchors: S.Array(EvidenceAnchor),
    truncated: S.Boolean,
  },
  $I.annote("BoundedEvidenceProjection", {
    description: "Bounded evidence projection.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "BoundedEvidenceProjection",
      overview: "Bounded evidence projection.",
      status: "stable",
      specifications: [{ name: "PROV-O", disposition: "informative" }],
      equivalenceBasis: "Anchor collection equality plus truncated flag equality.",
      evidenceAnchoring: "Projection wrapper that keeps evidence exports bounded.",
    }),
  })
) {}
