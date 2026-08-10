/**
 * Effect HttpApi server route bridge for OIP contact intake.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import {
  ContactSubmissionAccepted,
  ContactSubmissionRejected,
  ContactSubmissionStatus,
  OipHttpApi,
  submitContact,
} from "../../../contact";
import type { ContactSubmissionPayload, ContactSubmissionResponse } from "../../../contact";

type SubmitContact = (payload: ContactSubmissionPayload) => Effect.Effect<ContactSubmissionResponse>;

const contactHttpApiResponse = (
  response: ContactSubmissionResponse
): Effect.Effect<ContactSubmissionAccepted, ContactSubmissionRejected> =>
  ContactSubmissionStatus.$match(response.status, {
    accepted: (status) =>
      Effect.succeed(
        ContactSubmissionAccepted.make({
          message: response.message,
          status,
        })
      ),
    rejected: (status) =>
      Effect.fail(
        ContactSubmissionRejected.make({
          message: response.message,
          status,
        })
      ),
  });

const makeOipContactHttpApiRouteLive = (submit: SubmitContact) =>
  HttpApiBuilder.group(OipHttpApi, "contact", (handlers) =>
    handlers.handle("submit", ({ payload }) => submit(payload).pipe(Effect.flatMap(contactHttpApiResponse)))
  );

const makeOipContactHttpApiAppLayer = (submit: SubmitContact) =>
  HttpApiBuilder.layer(OipHttpApi).pipe(
    Layer.provideMerge(makeOipContactHttpApiRouteLive(submit)),
    Layer.provideMerge(HttpServer.layerServices)
  );

const OipContactHttpApiAppLayer = makeOipContactHttpApiAppLayer(submitContact);

/**
 * Builds a Web-standard OIP contact handler with an injected submit workflow.
 *
 * **Example** (Building handler with submit)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeOipContactHttpApiWebHandlerWithSubmit } from "@beep/oip-web/app/api/contact/ContactHttpApiRoute"
 *
 * const handler = makeOipContactHttpApiWebHandlerWithSubmit(() =>
 *   Effect.succeed({ message: "Your note was received.", status: "accepted" })
 * )
 *
 * console.log(typeof handler)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOipContactHttpApiWebHandlerWithSubmit = (
  submit: SubmitContact
): ((request: Request) => Promise<Response>) =>
  HttpRouter.toWebHandler(makeOipContactHttpApiAppLayer(submit), { disableLogger: true }).handler;

/**
 * Web-standard request handler for the OIP contact API.
 *
 * **Example** (Typing the contact handler)
 *
 * ```ts
 * import { oipContactHttpApiWebHandler } from "@beep/oip-web/app/api/contact/ContactHttpApiRoute"
 *
 * const handler: (request: Request) => Promise<Response> = oipContactHttpApiWebHandler
 * console.log(typeof handler)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const oipContactHttpApiWebHandler: (request: Request) => Promise<Response> = HttpRouter.toWebHandler(
  OipContactHttpApiAppLayer,
  { disableLogger: true }
).handler;
