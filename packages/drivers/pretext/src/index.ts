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
export * from "./Pretext.errors.ts";
/**
 * Font-metrics snapshot contracts and pure layout helpers.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./Pretext.models.ts";
/**
 * Font-metrics capture service contract.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./PretextCapture.service.ts";
/**
 * Fixture-backed capture layers for DOM-free consumer tests.
 *
 * @since 0.0.0
 * @category layers
 */
export * from "./PretextCapture.test-layer.ts";
