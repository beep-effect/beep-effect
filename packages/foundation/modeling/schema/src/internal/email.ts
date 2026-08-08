/**
 * Internal email normalization and validation schema implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { SchemaTransformation } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Email");

// --- Regex ---

/**
 * Regular expression used by the internal email schema.
 *
 * **Example** (Test email regex)
 *
 * ```ts
 * import { emailRegex } from "@beep/schema/internal/email"
 *
 * const matchesEmail = emailRegex.test("admin@example.com")
 *
 * console.log(matchesEmail)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const emailRegex: RegExp =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

// --- Normalization base ---

const NormalizedString = S.NonEmptyString.pipe(
  S.decode(SchemaTransformation.trim()),
  S.decode(SchemaTransformation.toLowerCase())
);

// --- Filter group ---

const emailChecks = S.makeFilterGroup([
  S.isNonEmpty({ message: "Email cannot be empty" }),
  S.isTrimmed({ message: "Email must be trimmed" }),
  S.isLowercased({ message: "Email must be lowercase" }),
  S.isMaxLength(254, { message: "Email must not exceed 254 characters" }),
  S.isPattern(emailRegex, { message: "Invalid email format" }),
]);

// --- Branded Email ---

const EmailBranded = NormalizedString.check(emailChecks).pipe(S.brand("Email"));

// --- Public non-redacted schema: branded + annotated ---

/**
 * Internal normalized, branded, non-redacted email string schema.
 *
 * **Example** (Decode and normalize email)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EmailString } from "@beep/schema/internal/email"
 *
 * const email = S.decodeUnknownSync(EmailString)("Admin@Example.COM")
 * console.log(email) // "admin@example.com"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const EmailString = EmailBranded.pipe(
  $I.annoteSchema("EmailString", {
    description: "RFC 5322 compliant normalized email address string.",
  })
);

/**
 * Internal branded, non-redacted email string type.
 *
 * **Example** (Typed decoded email value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { EmailString } from "@beep/schema/internal/email"
 * import { EmailString as EmailStringSchema } from "@beep/schema/internal/email"
 *
 * const email: EmailString = S.decodeUnknownSync(EmailStringSchema)("admin@example.com")
 * console.log(email)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EmailString = typeof EmailString.Type;

// --- Final schema: branded + redacted + annotated ---

/**
 * Internal normalized, branded, and redacted email schema.
 *
 * **Example** (Decode redacted email)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Email } from "@beep/schema/internal/email"
 *
 * const decode = S.decodeUnknownSync(Email)
 * const email = decode("admin@example.com")
 *
 * console.log(email)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Email = S.RedactedFromValue(EmailString, { label: "Email" }).pipe(
  $I.annoteSchema("Email", { description: "RFC 5322 compliant email address" })
);

/**
 * Internal branded, redacted email value type.
 *
 * **Example** (Typed redacted email value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Email, type Email as EmailValue } from "@beep/schema/internal/email"
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
