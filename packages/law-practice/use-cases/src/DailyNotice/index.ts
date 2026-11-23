/**
 * Daily notice exports: the notice message and outcome, typed errors, the
 * notice-mailbox port, the notice contract and its layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category errors
 * @since 0.0.0
 */
export * from "./DailyNotice.errors.ts";
/**
 * Daily notice and notice-mailbox service contracts.
 *
 * @category ports
 * @since 0.0.0
 */
export * from "./DailyNotice.ports.ts";
/**
 * The notice message and the outcome of a daily run.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./DailyNotice.schemas.ts";
/**
 * DailyNotice implementation layer.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./DailyNotice.service.ts";
