/**
 * Mail-tagging server entrypoint: the file-backed ledgers and checkpoint, and
 * the live layers of the use-cases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * File-backed ledger and checkpoint layers.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.files.ts";
/**
 * Live layers of the mail-tagging use-cases.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.layers.ts";
/**
 * State directory configuration.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./MailTagging.state.ts";
