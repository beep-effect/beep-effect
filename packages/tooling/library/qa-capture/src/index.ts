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
 * Witness action-event model exports.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./ActionEvent.models.ts";
/**
 * Clock correlator service exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./ClockCorrelator.service.ts";
/**
 * Collector HttpApi contract exports.
 *
 * @since 0.0.0
 * @category api
 */
export * from "./Collector.api.ts";
/**
 * Collector service exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./Collector.service.ts";
/**
 * Extraction plan model exports.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./ExtractionPlan.models.ts";
/**
 * Extraction planner exports.
 *
 * @since 0.0.0
 * @category planning
 */
export * from "./ExtractionPlanner.ts";
/**
 * QA capture error exports.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./QaCapture.errors.ts";
/**
 * Session, clock-sync, provenance, and collector-handle model exports.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./QaCapture.models.ts";
/**
 * Session directory store exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./SessionStore.service.ts";
/**
 * Witness bundling service exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./Witness.service.ts";
