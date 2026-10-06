/**
 * Mail-tagging server entrypoint: the file-backed ledgers and checkpoint, the
 * provider adapters, and the live layers of the use-cases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Box document store adapter.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.documents.ts";
/**
 * File-backed ledger and checkpoint layers.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.files.ts";
/**
 * Matter-folder directory over the private folder-id map.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.folders.ts";
/**
 * Known-documents index adapter.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.known.ts";
/**
 * Live layers of the mail-tagging use-cases.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.layers.ts";
/**
 * Microsoft 365 mailbox adapter.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.mailbox.ts";
/**
 * Practice knowledge-graph matter directory adapter.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.matters.ts";
/**
 * Provider API-call metering.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./MailTagging.metering.ts";
/**
 * Assembled mail-tagging service and its configuration.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./MailTagging.service.ts";
/**
 * State directory configuration.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./MailTagging.state.ts";
