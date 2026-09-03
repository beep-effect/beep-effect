/**
 * OIP contact route response helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OipWebId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, Exit } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { NextResponse } from "next/server";
import { ContactSubmissionResponse, contactSubmissionPayloadFromFormDataEffect, submitContact } from "../../../contact";
import type { ContactSubmissionPayload } from "../../../contact";

const $I = $OipWebId.create("app/api/contact/ContactRouteResponse");

type SubmitContact = (payload: ContactSubmissionPayload) => Effect.Effect<ContactSubmissionResponse>;

const ContactRoutePayloadErrorReason = LiteralKit(["form-data", "schema"]).pipe(
  $I.annoteSchema("ContactRoutePayloadErrorReason", {
    description: "Sanitized contact route form payload failure reason.",
  })
);

type ContactRoutePayloadErrorReason = typeof ContactRoutePayloadErrorReason.Type;

/**
 * Typed failure raised when the OIP contact route cannot decode a form payload.
 *
 * **Example** (Create a schema payload failure)
 *
 * ```ts
 * import { ContactRoutePayloadError } from "@/app/api/contact/ContactRouteResponse"
 *
 * const error = ContactRoutePayloadError.fromReason("schema")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContactRoutePayloadError extends S.TaggedError<ContactRoutePayloadError>($I`ContactRoutePayloadError`)(
  "ContactRoutePayloadError",
  {
    reason: ContactRoutePayloadErrorReason,
  },
  $I.annoteError<ContactRoutePayloadError>("ContactRoutePayloadError", {
    description: "Typed OIP contact route form payload failure.",
  })
) {
  static readonly fromReason = (reason: ContactRoutePayloadErrorReason): ContactRoutePayloadError =>
    ContactRoutePayloadError.make({ reason });
}

const rejected = ContactSubmissionResponse.make({
  message: "The submission could not be accepted.",
  status: "rejected",
});

const redirectToContact = (request: Request, response: ContactSubmissionResponse) => {
  const url = new URL("/", request.url);
  url.hash = "contact";
  url.searchParams.set("contact", response.status);

  return NextResponse.redirect(url, 303);
};

const readContactFormPayload = Effect.fn("OipContact.readContactFormPayload")(function* (request: Request) {
  const formData = yield* Effect.tryPromise({
    try: () => request.formData(),
    catch: () => ContactRoutePayloadError.fromReason("form-data"),
  });

  return yield* contactSubmissionPayloadFromFormDataEffect(formData).pipe(
    Effect.mapError(() => ContactRoutePayloadError.fromReason("schema"))
  );
});

/**
 * Builds an OIP form-post redirect response using an injected contact workflow.
 *
 * **Example** (Running with injected submit)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ContactSubmissionResponse } from "@beep/oip-web/contact"
 * import {
 *   contactRequestResponseWithSubmit,
 * } from "@beep/oip-web/app/api/contact/ContactRouteResponse"
 *
 * const request = new Request("https://oip.law/api/contact", { method: "POST" })
 * const submit = () => Effect.succeed(ContactSubmissionResponse.make({ message: "Received.", status: "accepted" }))
 * const program = contactRequestResponseWithSubmit(request, submit)
 *
 * Effect.runPromise(program)
 * ```
 *
 * @effects Reads browser form data and delegates contact submission to the
 * supplied workflow before creating a contact-section redirect response.
 * @category workflows
 * @since 0.0.0
 */
export const contactRequestResponseWithSubmit: {
  (request: Request, submit: SubmitContact): Effect.Effect<NextResponse>;
  (submit: SubmitContact): (request: Request) => Effect.Effect<NextResponse>;
} = dual(
  2,
  Effect.fn("OipContact.contactRequestResponseWithSubmit")(function* (request: Request, submit: SubmitContact) {
    const payloadOption = yield* readContactFormPayload(request).pipe(
      Effect.asSome,
      Effect.catchTag("ContactRoutePayloadError", () => Effect.succeedNone)
    );

    if (O.isNone(payloadOption)) {
      return redirectToContact(request, rejected);
    }

    const exit = yield* Effect.exit(submit(payloadOption.value));
    const response = Exit.isSuccess(exit) ? exit.value : rejected;

    return redirectToContact(request, response);
  })
);

/**
 * Builds an OIP contact route response inside an Effect runtime.
 *
 * **Example** (Running contact request program)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   contactRequestResponse,
 * } from "@beep/oip-web/app/api/contact/ContactRouteResponse"
 *
 * const request = new Request("https://oip.law/api/contact", { method: "POST" })
 * const program = contactRequestResponse(request)
 *
 * Effect.runPromise(program)
 * ```
 *
 * @effects Reads browser form data, submits contact payloads, and creates a
 * contact-section redirect response.
 * @category workflows
 * @since 0.0.0
 */
export const contactRequestResponse: (request: Request) => Effect.Effect<NextResponse> = Effect.fn(
  "OipContact.contactRequestResponse"
)((request: Request) => contactRequestResponseWithSubmit(request, submitContact));
