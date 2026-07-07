/**
 * OIP contact intake route.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";
import { Effect } from "effect";
import {
  ContactSubmissionPayload,
  ContactSubmissionResponse,
  ContactSubmissionStatus,
  contactResponseBody,
} from "../../../contact";
import { oipContactHttpApiWebHandler } from "./ContactHttpApiRoute";
import { contactRequestResponse } from "./ContactRouteResponse";

const isJsonContactSubmission = (request: Request): boolean =>
  Str.includes("application/json")(request.headers.get("content-type") ?? "");

const rejectedContactSubmission = ContactSubmissionResponse.make({
  message: "The submission could not be accepted.",
  status: "rejected",
});

const contactJsonStatus = (response: ContactSubmissionResponse): 202 | 400 =>
  ContactSubmissionStatus.$match(response.status, {
    accepted: () => 202 as const,
    rejected: () => 400 as const,
  });

const readJsonContactPayload = Effect.fn("OipContact.readJsonContactPayload")(function* (request: Request) {
  const body = yield* Effect.tryPromise({
    try: () => request.json(),
    catch: () => rejectedContactSubmission,
  });

  return yield* ContactSubmissionPayload.decodeUnknownEffect(body).pipe(
    Effect.mapError(() => rejectedContactSubmission)
  );
});

const rejectedJsonContactResponse = (response: ContactSubmissionResponse): Response =>
  Response.json(contactResponseBody(response), { status: contactJsonStatus(response) });

// Effect v4 uses `Effect.catch` for catch-all recovery; the v3 `catchAll` name is not available here.
const recoverRejectedJsonContactResponse = (response: ContactSubmissionResponse): Effect.Effect<Response> =>
  Effect.succeed(rejectedJsonContactResponse(response));

const jsonContactResponse = (request: Request): Effect.Effect<Response> =>
  readJsonContactPayload(request.clone()).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => oipContactHttpApiWebHandler(request),
        catch: () => rejectedContactSubmission,
      })
    ),
    Effect.catch(recoverRejectedJsonContactResponse)
  );

/**
 * Handles OIP contact submissions at the Next.js route boundary.
 *
 * @example
 * ```ts
 * import { POST } from "@beep/oip-web/app/api/contact/route"
 *
 * const handler: (request: Request) => Promise<Response> = POST
 * console.log(typeof handler)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const POST: (request: Request) => Promise<Response> = (request) =>
  Effect.runPromise(isJsonContactSubmission(request) ? jsonContactResponse(request) : contactRequestResponse(request));
