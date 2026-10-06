/**
 * Mail-tagging use-case export surface: ports, the pure matter tagger, the
 * resumable tagging job, the attachment filer, and the undo.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

export * from "./MailTagging.errors.ts";
/**
 * Attachment filer constructor.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./MailTagging.filer.ts";
/**
 * Mail-tagging job constructor.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./MailTagging.job.ts";
/**
 * Pure read models over the tag ledger.
 *
 * @category read-models
 * @since 0.0.0
 */
export * from "./MailTagging.ledger.ts";
/**
 * Mail-tagging ports and service tags.
 *
 * @category ports
 * @since 0.0.0
 */
export * from "./MailTagging.ports.ts";
/**
 * Pure matter tagger.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./MailTagging.tagger.ts";
/**
 * Mail-tagging undo constructor.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./MailTagging.undo.ts";
/**
 * Request and response values of the mail-tagging ports and use-cases.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./MailTagging.values.ts";
