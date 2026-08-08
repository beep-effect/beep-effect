/**
 * Contact form submission contracts for OIP intake.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OipWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, TrimmedNonEmptyText } from "@beep/schema";
import { Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, pipe, Result, SchemaTransformation } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $OipWebId.create("contact/ContactSubmission.model");

const contactEmailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const ContactEmailArbitraryValues = ["builder@example.com", "intake@oip.law", "tom@example.com"] as const;
const ContactNameArbitraryValues = ["Builder", "Thomas Oppold", "OIP Intake"] as const;
const ContactMessageArbitraryValues = [
  "I would like to discuss a patent matter.",
  "Please contact me about protecting a new machine design.",
  "We need help reviewing an intellectual property portfolio.",
] as const;

const TrimmedContactText = TrimmedNonEmptyText.annotate({
  toArbitrary: () => (fc) => fc.string({ minLength: 1 }).map(Str.trim).filter(Str.isNonEmpty),
}).pipe(
  $I.annoteSchema("TrimmedContactText", {
    description: "Trimmed non-empty contact form text.",
  })
);

const ContactName = TrimmedContactText.pipe(
  S.check(
    S.isMinLength(2, {
      message: "Name must include at least 2 characters.",
    })
  ),
  $I.annoteSchema("ContactName", {
    description: "Normalized contact form name.",
    toArbitrary: () => (fc) => fc.constantFrom(...ContactNameArbitraryValues),
  })
);

const ContactEmail = TrimmedContactText.pipe(S.decode(SchemaTransformation.toLowerCase()))
  .check(
    S.isMaxLength(254, {
      message: "Email must be 254 characters or fewer.",
    }),
    S.isPattern(contactEmailPattern, {
      message: "Email must be a valid email address.",
    })
  )
  .pipe(
    $I.annoteSchema("ContactEmail", {
      description: "Normalized contact form email address.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom(...ContactEmailArbitraryValues),
  });

const ContactMessage = TrimmedContactText.check(
  S.isMinLength(10, {
    message: "Message must include at least 10 characters.",
  })
)
  .pipe(
    $I.annoteSchema("ContactMessage", {
      description: "Normalized contact form message.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom(...ContactMessageArbitraryValues),
  });

const ContactSubmissionStatusBase = LiteralKit(["accepted", "rejected"]);

/**
 * Public contact submission status.
 *
 * @example
 * ```ts
 * import { ContactSubmissionStatus } from "@beep/oip-web/contact"
 *
 * const accepted = ContactSubmissionStatus.Enum.accepted
 * console.log(accepted)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContactSubmissionStatus = ContactSubmissionStatusBase.pipe(
  $I.annoteSchema("ContactSubmissionStatus", {
    description: "Public contact submission result status.",
  }),
  SchemaUtils.withLiteralKitStatics(ContactSubmissionStatusBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type for {@link ContactSubmissionStatus}.
 *
 * @example
 * ```ts
 * import type { ContactSubmissionStatus } from "@beep/oip-web/contact"
 *
 * const status: ContactSubmissionStatus = "accepted"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContactSubmissionStatus = typeof ContactSubmissionStatus.Type;

/**
 * Non-empty public contact response message text.
 *
 * @example
 * ```ts
 * import { ContactResponseMessage } from "@beep/oip-web/contact"
 *
 * const message: ContactResponseMessage = "Your note was received."
 * console.log(message)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContactResponseMessage = S.NonEmptyString.pipe(
  $I.annoteSchema("ContactResponseMessage", {
    description: "Non-empty public message text returned by the OIP contact API.",
    toArbitrary: () => (fc) => fc.constant("Your note was received."),
  })
);

/**
 * Type for {@link ContactResponseMessage}.
 *
 * @example
 * ```ts
 * import type { ContactResponseMessage } from "@beep/oip-web/contact"
 *
 * const message: ContactResponseMessage = "The submission could not be accepted."
 * console.log(message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContactResponseMessage = typeof ContactResponseMessage.Type;

/**
 * Browser-submitted OIP contact form payload.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 * import { decodeContactSubmission } from "@beep/oip-web/contact"
 *
 * const program = decodeContactSubmission({
 *   email: "builder@example.com",
 *   message: "I would like to discuss a patent matter.",
 *   name: "Builder",
 *   submittedAt: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(program).then((submission) => {
 *   console.log(submission.email)
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContactSubmission extends S.Class<ContactSubmission>($I`ContactSubmission`)(
  {
    company: S.OptionFromOptionalKey(TrimmedContactText).pipe(SchemaUtils.withNoneDefault),
    email: ContactEmail,
    message: ContactMessage,
    name: ContactName,
    phone: S.OptionFromOptionalKey(TrimmedContactText).pipe(SchemaUtils.withNoneDefault),
    posture: S.OptionFromOptionalKey(TrimmedContactText).pipe(SchemaUtils.withNoneDefault),
    submittedAt: NonNegativeInt,
    technology: S.OptionFromOptionalKey(TrimmedContactText).pipe(SchemaUtils.withNoneDefault),
    website: S.OptionFromOptionalKey(TrimmedContactText).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ContactSubmission", {
    description: "Browser-submitted OIP contact form payload.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(this);
}

const ContactSubmissionFormSubmittedAtFromString = S.FiniteFromString.pipe(
  S.decodeTo(NonNegativeInt),
  $I.annoteSchema("ContactSubmissionFormSubmittedAtFromString", {
    description: "Form-submitted contact timestamp decoded from a numeric string.",
  })
);

const ContactSubmissionFormSubmittedAt = S.Union([NonNegativeInt, ContactSubmissionFormSubmittedAtFromString]).pipe(
  S.withDecodingDefault(Effect.succeed(0)),
  $I.annoteSchema("ContactSubmissionFormSubmittedAt", {
    description: "Form-submitted contact timestamp decoded from a number or numeric string.",
  })
);

/**
 * Normalized browser form payload before the contact domain schema decodes it.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { ContactSubmissionFormPayload } from "@beep/oip-web/contact"
 *
 * const payload = ContactSubmissionFormPayload.make({
 *   email: "builder@example.com",
 *   message: "I would like to discuss a patent matter.",
 *   name: "Builder",
 *   submittedAt: NonNegativeInt.make(0)
 * })
 *
 * console.log(payload.submittedAt)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContactSubmissionFormPayload extends S.Class<ContactSubmissionFormPayload>(
  $I`ContactSubmissionFormPayload`
)(
  {
    company: S.optionalKey(TrimmedContactText),
    email: ContactEmail,
    message: ContactMessage,
    name: ContactName,
    phone: S.optionalKey(TrimmedContactText),
    posture: S.optionalKey(TrimmedContactText),
    submittedAt: ContactSubmissionFormSubmittedAt,
    technology: S.optionalKey(TrimmedContactText),
    website: S.optionalKey(TrimmedContactText),
  },
  $I.annote("ContactSubmissionFormPayload", {
    description: "Normalized browser form payload before contact submission decoding.",
  })
) {
  static readonly decodeUnknownResult = S.decodeUnknownResult(this);
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(this);
}

const formTextOption = (value: FormDataEntryValue | null): O.Option<string> =>
  pipe(O.fromNullishOr(value), O.filter(P.isString), O.map(Str.trim), O.filter(Str.isNonEmpty));

const requiredFormTextValue = (value: FormDataEntryValue | null): string =>
  pipe(
    formTextOption(value),
    O.getOrElse(() => "")
  );

const contactSubmissionPayloadInputFromFormData = (formData: FormData) => ({
  email: requiredFormTextValue(formData.get("email")),
  message: requiredFormTextValue(formData.get("message")),
  name: requiredFormTextValue(formData.get("name")),
  ...O.getSomesStruct({
    company: formTextOption(formData.get("company")),
    phone: formTextOption(formData.get("phone")),
    posture: formTextOption(formData.get("posture")),
    submittedAt: formTextOption(formData.get("submittedAt")),
    technology: formTextOption(formData.get("technology")),
    website: formTextOption(formData.get("website")),
  }),
});

const contactSubmissionPayloadFallback = (formData: FormData): ContactSubmissionFormPayload =>
  ContactSubmissionFormPayload.make({
    email: requiredFormTextValue(formData.get("email")),
    message: requiredFormTextValue(formData.get("message")),
    name: requiredFormTextValue(formData.get("name")),
    submittedAt: NonNegativeInt.make(0),
    ...O.getSomesStruct({
      company: formTextOption(formData.get("company")),
      phone: formTextOption(formData.get("phone")),
      posture: formTextOption(formData.get("posture")),
      technology: formTextOption(formData.get("technology")),
      website: formTextOption(formData.get("website")),
    }),
  });

/**
 * Effectfully converts browser form data into the contact submission wire payload.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { contactSubmissionPayloadFromFormDataEffect } from "@beep/oip-web/contact"
 *
 * const formData = new FormData()
 * formData.set("email", "builder@example.com")
 * formData.set("message", "I would like to discuss a patent matter.")
 * formData.set("name", "Builder")
 * formData.set("submittedAt", "0")
 *
 * Effect.runPromise(contactSubmissionPayloadFromFormDataEffect(formData))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const contactSubmissionPayloadFromFormDataEffect = (formData: FormData) =>
  ContactSubmissionFormPayload.decodeUnknownEffect(contactSubmissionPayloadInputFromFormData(formData));

/**
 * Converts browser form data into the contact submission wire payload.
 *
 * @example
 * ```ts
 * import { contactSubmissionPayloadFromFormData } from "@beep/oip-web/contact"
 *
 * const formData = new FormData()
 * formData.set("email", "builder@example.com")
 * formData.set("message", "I would like to discuss a patent matter.")
 * formData.set("name", "Builder")
 * formData.set("submittedAt", "0")
 *
 * const payload = contactSubmissionPayloadFromFormData(formData)
 * console.log(payload.email)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const contactSubmissionPayloadFromFormData = (formData: FormData): ContactSubmissionFormPayload =>
  pipe(contactSubmissionPayloadInputFromFormData(formData), (input) =>
    pipe(
      ContactSubmissionFormPayload.decodeUnknownResult(input),
      Result.getOrElse(() => contactSubmissionPayloadFallback(formData))
    )
  );

/**
 * Public contact submission response.
 *
 * @example
 * ```ts
 * import { ContactSubmissionResponse } from "@beep/oip-web/contact"
 *
 * const response = new ContactSubmissionResponse({
 *   message: "Your note was received.",
 *   status: "accepted"
 * })
 *
 * console.log(response.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContactSubmissionResponse extends S.Class<ContactSubmissionResponse>($I`ContactSubmissionResponse`)(
  {
    message: ContactResponseMessage,
    status: ContactSubmissionStatus,
  },
  $I.annote("ContactSubmissionResponse", {
    description: "Public contact submission response.",
  })
) {}

/**
 * Decodes unknown input into a contact submission.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 * import { decodeContactSubmission } from "@beep/oip-web/contact"
 *
 * const program = decodeContactSubmission({
 *   email: "builder@example.com",
 *   message: "I would like to discuss a patent matter.",
 *   name: "Builder",
 *   submittedAt: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeContactSubmission: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ContactSubmission, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ContactSubmission, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, ContactSubmission.decodeUnknownEffect);
