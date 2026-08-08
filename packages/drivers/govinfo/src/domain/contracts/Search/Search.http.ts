/**
 * GovInfo search HTTP endpoint descriptor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HttpApiEndpoint, HttpApiSchema } from "effect/unstable/httpapi";
import * as Contract from "./Search.contract.ts";

/**
 * HTTP API endpoint descriptor for the GovInfo `/search` POST route.
 *
 * **Example** (Check HttpApiEndpoint type)
 *
 * ```ts
 * import { Http } from "@beep/govinfo/domain/contracts/Search/Search.http"
 * import { HttpApiEndpoint } from "effect/unstable/httpapi"
 *
 * const isEndpoint = HttpApiEndpoint.isHttpApiEndpoint(Http)
 *
 * console.log(isEndpoint)
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const Http = HttpApiEndpoint.post("search", "/search", {
  payload: Contract.Payload,
  error: Contract.Failure,
  success: Contract.Success.pipe(HttpApiSchema.status(200)),
});
