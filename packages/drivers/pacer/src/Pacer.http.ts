/**
 * Shared HTTP helpers for the PACER driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as P from "effect/Predicate";
import * as HttpClientError from "effect/unstable/http/HttpClientError";

/**
 * Render a transport or decoding cause into a stable, non-secret diagnostic.
 *
 * **Example** (Log network error diagnostic)
 *
 * ```ts
 * import { pacerCauseMessage } from "@beep/pacer/Pacer.http"
 *
 * console.log(pacerCauseMessage(new Error("network failed")))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const pacerCauseMessage = (cause: unknown): string =>
  HttpClientError.isHttpClientError(cause)
    ? `HttpClientError:${cause.reason._tag}`
    : P.hasProperty(cause, "_tag") && P.isString(cause._tag)
      ? cause._tag
      : P.isError(cause)
        ? cause.name
        : "unknown";
