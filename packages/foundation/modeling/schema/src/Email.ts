/**
 * Public email address schema exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Email as InternalEmail, EmailString as InternalEmailString } from "./internal/email.ts";

/**
 * RFC 5322 compliant email address string schema.
 *
 * **Details**
 *
 * Accepts a string, trims whitespace, lowercases, validates against RFC 5322,
 * and keeps the decoded value as a branded string. Use this when the email
 * address must remain displayable or serializable as plain text. Use
 * {@link Email} when accidental logging should be prevented with `Redacted`.
 *
 * **Example** (Normalize email address strings)
 *
 * ```ts import.meta.vitest name="Normalize email address strings"
 * import * as S from "effect/Schema"
 * import { EmailString } from "@beep/schema"
 *
 * const email = S.decodeUnknownSync(EmailString)("Admin@Example.COM")
 * email // => "admin@example.com"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const EmailString = InternalEmailString;

/**
 * Branded email address string type extracted from {@link EmailString}.
 *
 * **Example** (Type branded email strings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { EmailString } from "@beep/schema"
 * import { EmailString as EmailStringSchema } from "@beep/schema"
 *
 * const email: EmailString = S.decodeUnknownSync(EmailStringSchema)("admin@example.com")
 * console.log(email)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EmailString = typeof EmailString.Type;

/**
 * RFC 5322 compliant email address schema.
 *
 * **Details**
 *
 * Accepts a string, trims whitespace, lowercases, validates against RFC 5322,
 * and wraps the result in a `Redacted` to prevent accidental logging.
 *
 * **Example** (Decode redacted email addresses)
 *
 * ```ts import.meta.vitest name="Decode redacted email addresses"
 * import * as S from "effect/Schema"
 * import { Email } from "@beep/schema"
 *
 * const decode = S.decodeUnknownSync(Email)
 *
 * const email = decode("Alice@Example.COM")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Email = InternalEmail;

/**
 * Branded, redacted email address type extracted from {@link Email}.
 *
 * **Example** (Type redacted email values)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Email, type Email as EmailValue } from "@beep/schema"
 *
 * const decode = S.decodeUnknownSync(Email)
 * const email: EmailValue = decode("admin@example.com")
 *
 * console.log(email)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Email = typeof Email.Type;
