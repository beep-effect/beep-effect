/**
 * Text measurement as a typed, schema-first capability, backed by
 * `@chenglou/pretext`.
 *
 * This root entrypoint is the browser-safe pure surface: versioned
 * font-metrics contracts, codecs, pure layout helpers over decoded
 * snapshots, the capture service contract, and fixture-backed test layers.
 * No canvas, no DOM. The impure capture surface lives at
 * `@beep/pretext/browser`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Pretext driver typed errors.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./Pretext.errors.js";
/**
 * Font-metrics snapshot contracts and pure layout helpers.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./Pretext.models.js";
/**
 * Font-metrics capture service contract.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./PretextCapture.service.js";
/**
 * Fixture-backed capture layers for DOM-free consumer tests.
 *
 * @since 0.0.0
 * @category layers
 */
export * from "./PretextCapture.test-layer.js";
