/**
 * Provider-neutral LangExtract-style structured extraction capability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Deterministic source-alignment helpers.
 *
 * @category mapping
 * @since 0.0.0
 */
export * as Alignment from "./Alignment/index.ts";
/**
 * Extraction requests, results, parser contracts, and typed errors.
 *
 * @category models
 * @since 0.0.0
 */
export * as Extraction from "./Extraction/index.ts";
/**
 * Adapters into `@beep/nlp/Handoff`.
 *
 * @category interop
 * @since 0.0.0
 */
export * as Handoff from "./Handoff/index.ts";
/**
 * Effect service layer over an injected language model.
 *
 * @category services
 * @since 0.0.0
 */
export * as Service from "./Service/index.ts";
/**
 * Extraction target and example schemas.
 *
 * @category models
 * @since 0.0.0
 */
export * as Target from "./Target/index.ts";
/**
 * Strict normalized-locator to exact-raw-span mapping.
 *
 * @category mapping
 * @since 0.0.0
 */
export * as VerifiedSpan from "./VerifiedSpan/index.ts";
