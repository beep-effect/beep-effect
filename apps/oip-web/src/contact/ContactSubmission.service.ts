/**
 * Server-side OIP contact submission workflow.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  HubSpot,
  HubSpotConfigInput,
  HubSpotFormField,
  HubSpotSubmitFormRequest,
  HubSpotUpsertContactRequest,
} from "@beep/hubspot";
import { $OipWebId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Clock, Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import { makeRedactedConfigOptionReader, makeTextConfigOptionReader } from "../runtime/OipRuntimeConfig.ts";
import { ContactSubmissionResponse, decodeContactSubmission } from "./ContactSubmission.model.ts";
import type { HubSpotError } from "@beep/hubspot";
import type { ContactResponseMessage, ContactSubmission } from "./ContactSubmission.model.ts";

const $I = $OipWebId.create("contact/ContactSubmission.service");
const minimumElapsedMs = 3_000;

const ContactProviderHttpStatus = S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })).pipe(
  $I.annoteSchema("ContactProviderHttpStatus", {
    description: "Integer HTTP status code recorded for contact provider errors.",
  })
);

const ContactSubmissionErrorReason = LiteralKit(["config", "decode", "provider", "spam"]).pipe(
  $I.annoteSchema("ContactSubmissionErrorReason", {
    description: "Sanitized contact submission failure reason.",
  })
);

type ContactSubmissionErrorReason = typeof ContactSubmissionErrorReason.Type;

type ContactSubmissionErrorOptions = {
  readonly provider?: string;
  readonly providerReason?: string;
  readonly status?: number;
};

class ContactSubmissionError extends S.TaggedError<ContactSubmissionError>($I`ContactSubmissionError`)(
  "ContactSubmissionError",
  {
    provider: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    providerReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    reason: ContactSubmissionErrorReason,
    status: S.OptionFromOptionalKey(ContactProviderHttpStatus).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ContactSubmissionError", {
    description: "Typed server-side contact submission boundary failure.",
  })
) {
  static readonly fromReason = (
    reason: ContactSubmissionErrorReason,
    options: ContactSubmissionErrorOptions = {}
  ): ContactSubmissionError =>
    ContactSubmissionError.make({
      reason,
      provider: O.fromUndefinedOr(options.provider),
      providerReason: O.fromUndefinedOr(options.providerReason),
      status: O.fromUndefinedOr(options.status),
    });
}

const readTextConfigOption = makeTextConfigOptionReader("OipContact.readTextConfigOption", () =>
  ContactSubmissionError.fromReason("config")
);
const readRedactedConfigOption = makeRedactedConfigOptionReader("OipContact.readRedactedConfigOption", () =>
  ContactSubmissionError.fromReason("config")
);

const firstTextConfigOption = Effect.fn("OipContact.firstTextConfigOption")(function* (keys: ReadonlyArray<string>) {
  const values = yield* Effect.forEach(keys, readTextConfigOption, { concurrency: A.length(keys) });
  return pipe(values, A.findFirst(O.isSome), O.flatten);
});

const firstRedactedConfigOption = Effect.fn("OipContact.firstRedactedConfigOption")(function* (
  keys: ReadonlyArray<string>
) {
  const values = yield* Effect.forEach(keys, readRedactedConfigOption, { concurrency: A.length(keys) });
  return pipe(values, A.findFirst(O.isSome), O.flatten);
});

const hubSpotConfig = Effect.fn("OipContact.hubSpotConfig")(function* (): Effect.fn.Return<
  {
    readonly config: HubSpotConfigInput;
    readonly formGuid: O.Option<string>;
  },
  ContactSubmissionError
> {
  const accountId = yield* firstTextConfigOption(["CRM_HUBSPOT_ACCOUNT_ID", "HUBSPOT_ACCOUNT_ID"]);
  const accessToken = yield* firstRedactedConfigOption(["CRM_HUBSPOT_SERVICE_KEY", "HUBSPOT_SERVICE_KEY"]);
  const formGuid = yield* firstTextConfigOption(["CRM_HUBSPOT_FORM_GUID", "HUBSPOT_FORM_GUID"]);

  if (O.isNone(accountId) || O.isNone(accessToken)) {
    return yield* ContactSubmissionError.fromReason("config");
  }

  return {
    config: HubSpotConfigInput.make({
      accountId: accountId.value,
      accessToken: accessToken.value,
    }),
    formGuid,
  };
});

const textField = (name: string, value: O.Option<string>): ReadonlyArray<HubSpotFormField> =>
  pipe(
    value,
    O.match({
      onNone: A.empty,
      onSome: (fieldValue) => [HubSpotFormField.make({ name, value: fieldValue })],
    })
  );

const submissionFields = (submission: ContactSubmission): ReadonlyArray<HubSpotFormField> =>
  A.flatten([
    textField("email", O.some(submission.email)),
    textField("firstname", O.some(submission.name)),
    textField("company", submission.company),
    textField("phone", submission.phone),
    textField("message", O.some(submission.message)),
    textField("technology", submission.technology),
    textField("posture", submission.posture),
  ]);

const noteLine = (label: string, value: O.Option<string>): ReadonlyArray<string> =>
  pipe(
    value,
    O.match({
      onNone: A.empty,
      onSome: (fieldValue) => [`${label}: ${fieldValue}`],
    })
  );

const crmMessage = (submission: ContactSubmission): string =>
  pipe(
    A.flatten([
      [`Message:\n${submission.message}`],
      noteLine("Technology", submission.technology),
      noteLine("Relationship", submission.posture),
    ]),
    A.join("\n\n")
  );

const contactProperties = (submission: ContactSubmission): Readonly<Record<string, string>> => ({
  email: submission.email,
  firstname: submission.name,
  message: crmMessage(submission),
  ...O.getSomesStruct({
    company: submission.company,
    phone: submission.phone,
  }),
});

const acceptedMessage: ContactResponseMessage = "Your note was received.";
const rejectedMessage: ContactResponseMessage = "The submission could not be accepted.";

const accepted = ContactSubmissionResponse.make({
  message: acceptedMessage,
  status: "accepted",
});

const rejected = ContactSubmissionResponse.make({
  message: rejectedMessage,
  status: "rejected",
});

const validateSpamControls = Effect.fn("OipContact.validateSpamControls")(function* (
  submission: ContactSubmission
): Effect.fn.Return<void, ContactSubmissionError> {
  const honeypot = submission.website;
  const now = yield* Clock.currentTimeMillis;
  const elapsedMs = now - submission.submittedAt;

  if (O.isSome(honeypot)) {
    return yield* ContactSubmissionError.fromReason("spam");
  }

  if (submission.submittedAt <= 0 || elapsedMs < minimumElapsedMs) {
    return yield* ContactSubmissionError.fromReason("spam");
  }

  return undefined;
});

const submitConfiguredContact = (
  settings: {
    readonly config: HubSpotConfigInput;
    readonly formGuid: O.Option<string>;
  },
  submission: ContactSubmission
) =>
  Effect.scoped(
    Layer.build(HubSpot.makeLayer(settings.config).pipe(Layer.provide(FetchHttpClient.layer))).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const hubspot = yield* HubSpot;
          if (O.isSome(settings.formGuid)) {
            return yield* hubspot.submitForm(
              HubSpotSubmitFormRequest.make({
                fields: submissionFields(submission),
                formGuid: settings.formGuid.value,
                submittedAt: submission.submittedAt,
                context: {
                  pageName: "OIP contact",
                  pageUri: "https://oip.law/#contact",
                },
              })
            );
          }

          return yield* hubspot.upsertContact(
            HubSpotUpsertContactRequest.make({
              email: submission.email,
              objectWriteTraceId: "oip-contact-form",
              properties: contactProperties(submission),
            })
          );
        }).pipe(Effect.provide(context))
      )
    )
  ).pipe(
    Effect.mapError((error: HubSpotError) =>
      ContactSubmissionError.fromReason("provider", {
        provider: "hubspot",
        providerReason: error.reason,
        ...O.getSomesStruct({ status: O.fromUndefinedOr(error.status) }),
      })
    )
  );

const contactResponseForError = (_error: ContactSubmissionError): ContactSubmissionResponse => rejected;

/**
 * Submits an OIP contact payload to HubSpot when runtime config is present.
 *
 * **Example** (Submit contact via Effect)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 * import { submitContact } from "@beep/oip-web/contact"
 *
 * const program = submitContact({
 *   email: "builder@example.com",
 *   message: "I would like to discuss a patent matter.",
 *   name: "Builder",
 *   submittedAt: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(program)
 * ```
 *
 * @effects Reads server runtime config, decodes untrusted input, optionally
 * writes the contact to HubSpot, and logs sanitized public rejection reasons.
 * @category workflows
 * @since 0.0.0
 */
export const submitContact: (input: unknown) => Effect.Effect<ContactSubmissionResponse> = Effect.fn(
  "OipContact.submitContact"
)((input: unknown) =>
  Effect.gen(function* () {
    const submission = yield* decodeContactSubmission(input).pipe(
      Effect.mapError(() => ContactSubmissionError.fromReason("decode"))
    );
    yield* validateSpamControls(submission);

    const settings = yield* hubSpotConfig();
    yield* submitConfiguredContact(settings, submission);

    return accepted;
  }).pipe(
    Effect.catchTag("ContactSubmissionError", (error) =>
      Effect.logWarning("OIP contact submission returned a public rejection.").pipe(
        Effect.annotateLogs({
          operation: "oip.contact.submit",
          outcome: "rejected",
          reason: error.reason,
          ...O.getSomesStruct({
            provider: error.provider,
            providerReason: error.providerReason,
            status: error.status,
          }),
        }),
        Effect.as(contactResponseForError(error))
      )
    )
  )
);

/**
 * Builds a JSON-safe contact response object.
 *
 * **Example** (Build contact response body)
 *
 * ```ts
 * import { ContactSubmissionResponse, contactResponseBody } from "@beep/oip-web/contact"
 *
 * const body = contactResponseBody(ContactSubmissionResponse.make({
 *   message: "Your note was received.",
 *   status: "accepted"
 * }))
 *
 * console.log(body.status)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const contactResponseBody = (response: ContactSubmissionResponse): typeof ContactSubmissionResponse.Encoded => ({
  message: response.message,
  status: response.status,
});
