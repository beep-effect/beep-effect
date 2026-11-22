/**
 * Domain-agnostic provenance value models — the canonical "where did this come
 * from?" substrate that grounding, extraction, and evidence systems share.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

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
