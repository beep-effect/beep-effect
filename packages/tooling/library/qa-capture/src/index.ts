/**
 * `@beep/qa-capture` UI-verification capture pipeline.
 *
 * Witness instrumentation, event collection, clock correlation, extraction
 * planning, and session directory management for QA recording sessions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category models
 * @since 0.0.0
 */
export * from "./ActionEvent.models.ts";
/**
 * @category services
 * @since 0.0.0
 */
export * from "./ClockCorrelator.service.ts";
/**
 * Collector HttpApi contract exports.
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./Collector.api.ts";
/**
 * @category services
 * @since 0.0.0
 */
export * from "./Collector.service.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./ExtractionPlan.models.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export * from "./ExtractionPlanner.ts";
/**
 * @category errors
 * @since 0.0.0
 */
export * from "./QaCapture.errors.ts";
/**
 * Session, clock-sync, provenance, and collector-handle model exports.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./QaCapture.models.ts";
/**
 * @category services
 * @since 0.0.0
 */
export * from "./SessionStore.service.ts";
/**
 * @category services
 * @since 0.0.0
 */
export * from "./Witness.service.ts";
