/**
 * HTTP status category schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { pipe } from "effect";
import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import { $I } from "./HttpStatus.shared.ts";

/**
 * HttpStatusCategory - HTTP status code category
 *
 * @example
 * ```ts
 * import { HttpStatusCategory } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatusCategory.Pairs.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const HttpStatusCategory = MappedLiteralKit([
  ["INFO", "1XX"],
  ["SUCCESS", "2XX"],
  ["REDIRECTION", "3XX"],
  ["CLIENT_ERROR", "4XX"],
  ["SERVER_ERROR", "5XX"],
]).pipe(
  $I.annoteSchema("HttpStatusCategory", {
    description: "HTTP status code category",
    documentation: pipe(
      A.make(
        "1XX - Informational codes that the server returns to tell the client that the request is in progress.",
        "2XX – Successful codes indicating that the request is recognized and is being handled.",
        "3XX – Codes specifying that there will be a redirection.",
        "4XX – These are error codes signaling a problem with the request sent from the client (browser).",
        "5XX – Errors originating from the website’s server that prevent it from sending a valid response."
      ),
      A.join("\n")
    ),
  })
);

/**
 * {@inheritDoc HttpStatusCategory}
 *
 * @example
 * ```ts
 * import type { HttpStatusCategory } from "@beep/schema/HttpStatus"
 *
 * const category: HttpStatusCategory = "4XX"
 * console.log(category)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HttpStatusCategory = typeof HttpStatusCategory.Type;
