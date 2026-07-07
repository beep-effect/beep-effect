/**
 * Effect HttpApi contracts and Atom client for OIP contact intake.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OipWebId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { AtomHttpApi } from "effect/unstable/reactivity";
import { ContactResponseMessage, ContactSubmissionFormPayload } from "./ContactSubmission.model.ts";

const $I = $OipWebId.create("contact/ContactSubmission.http");

const contactClientBaseUrl = (): string =>
  globalThis.window === undefined ? "http://localhost" : globalThis.window.location.origin;

/**
 * Accepted OIP contact response body.
 *
 * @example
 * ```ts
 * import { ContactSubmissionAccepted } from "@beep/oip-web/contact"
 *
 * const response = ContactSubmissionAccepted.make({
 *   message: "Your note was received.",
 *   status: "accepted"
 * })
 *
 * console.log(response.status)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContactSubmissionAccepted extends S.Class<ContactSubmissionAccepted>($I`ContactSubmissionAccepted`)(
  {
    message: ContactResponseMessage,
    status: S.tag("accepted"),
  },
  $I.annote("ContactSubmissionAccepted", {
    description: "Accepted OIP contact response body.",
  })
) {}

/**
 * Rejected OIP contact response body.
 *
 * @example
 * ```ts
 * import { ContactSubmissionRejected } from "@beep/oip-web/contact"
 *
 * const response = ContactSubmissionRejected.make({
 *   message: "The submission could not be accepted.",
 *   status: "rejected"
 * })
 *
 * console.log(response.status)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContactSubmissionRejected extends S.Class<ContactSubmissionRejected>($I`ContactSubmissionRejected`)(
  {
    message: ContactResponseMessage,
    status: S.tag("rejected"),
  },
  $I.annote("ContactSubmissionRejected", {
    description: "Rejected OIP contact response body.",
  })
) {}

/**
 * Browser wire payload for OIP contact submissions.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { ContactSubmissionPayload } from "@beep/oip-web/contact"
 *
 * const payload: ContactSubmissionPayload = {
 *   email: "builder@example.com",
 *   message: "I would like to discuss a patent matter.",
 *   name: "Builder",
 *   submittedAt: NonNegativeInt.make(0)
 * }
 *
 * console.log(payload.email)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContactSubmissionPayload = ContactSubmissionFormPayload.pipe(
  $I.annoteSchema("ContactSubmissionPayload", {
    description: "Browser wire payload accepted by the OIP contact HTTP API.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeUnknownEffect: S.decodeUnknownEffect(schema),
  }))
);

/**
 * Type for {@link ContactSubmissionPayload}.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import type { ContactSubmissionPayload } from "@beep/oip-web/contact"
 *
 * const payload: ContactSubmissionPayload = {
 *   email: "builder@example.com",
 *   message: "I would like to discuss a patent matter.",
 *   name: "Builder",
 *   submittedAt: NonNegativeInt.make(0)
 * }
 *
 * console.log(payload.submittedAt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContactSubmissionPayload = typeof ContactSubmissionPayload.Type;

/**
 * HttpApi group for OIP contact intake endpoints.
 *
 * @example
 * ```ts
 * import { OipContactHttpApiGroup } from "@beep/oip-web/contact"
 *
 * console.log(OipContactHttpApiGroup.identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OipContactHttpApiGroup = HttpApiGroup.make("contact").add(
  HttpApiEndpoint.post("submit", "/api/contact", {
    payload: ContactSubmissionPayload,
    success: ContactSubmissionAccepted.pipe(HttpApiSchema.status(202)),
    error: ContactSubmissionRejected.pipe(HttpApiSchema.status(400)),
  })
);

/**
 * Public OIP HttpApi contract.
 *
 * @example
 * ```ts
 * import { OipHttpApi } from "@beep/oip-web/contact"
 *
 * console.log(OipHttpApi.identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OipHttpApi = HttpApi.make("OipHttpApi").add(OipContactHttpApiGroup);

/**
 * Atom-enabled HttpApi client for OIP browser workflows.
 *
 * @example
 * ```ts
 * import { OipContactHttpApiClient } from "@beep/oip-web/contact"
 *
 * const submit = OipContactHttpApiClient.mutation("contact", "submit")
 * console.log(submit)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OipContactHttpApiClient extends AtomHttpApi.Service<OipContactHttpApiClient>()(
  $I`OipContactHttpApiClient`,
  {
    api: OipHttpApi,
    baseUrl: contactClientBaseUrl(),
    httpClient: FetchHttpClient.layer,
  }
) {}
