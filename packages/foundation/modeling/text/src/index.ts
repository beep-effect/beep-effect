/**
 * Domain-agnostic text identity and anchoring values — the canonical "where in
 * which source text?" substrate that grounding, extraction, and evidence systems share.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Offset units, unit-tagged positions and conversion between units.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./OffsetUnit.ts";
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
 * Fail-closed verified-anchor construction.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./VerifiedTextAnchor.ts";
