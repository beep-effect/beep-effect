/**
 * Domain-agnostic text identity and anchoring values — the canonical "where in
 * which source text?" substrate that grounding, extraction, and evidence systems share.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Locator maps between two text captures and their aligned segments.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./LocatorMap.ts";
/**
 * Occurrence identity: anchors-table rows and the ids minted from them.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Occurrence.ts";
/**
 * Offset units, unit-tagged positions and conversion between units.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./OffsetUnit.ts";
/**
 * Quote keys: grouping keys over normalized quotes.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./QuoteKey.ts";
/**
 * Re-anchoring occurrences across text captures.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Reanchoring.ts";
/**
 * Resolving a selector in one text capture.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Resolution.ts";
/**
 * The Web Annotation selector union over one text capture.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Selector.ts";
/**
 * Exact extracted-source identity and digest/version schemas.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./SourceTextIdentity.ts";
/**
 * TextAnchor: char-offset anchor into a source document plus the quoted span.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./TextAnchor.ts";
/**
 * Text normalizations that record their aligned segments.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./TextNormalization.ts";
/**
 * Fail-closed verified-anchor construction.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./VerifiedTextAnchor.ts";
