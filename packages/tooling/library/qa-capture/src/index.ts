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
 * @category models
 * @since 0.0.0
 */
export * from "./ActionEvent.models.ts";
/**
 * Clock correlator service exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./ClockCorrelator.service.ts";
/**
 * Collector HttpApi contract exports.
 *
 * @category api
 * @since 0.0.0
 */
export * from "./Collector.api.ts";
/**
 * Collector service exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Collector.service.ts";
/**
 * Extraction plan model exports.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./ExtractionPlan.models.ts";
/**
 * Extraction planner exports.
 *
 * @category planning
 * @since 0.0.0
 */
export * from "./ExtractionPlanner.ts";
/**
 * QA capture error exports.
 *
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
 * Session directory store exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./SessionStore.service.ts";
/**
 * Witness bundling service exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Witness.service.ts";
