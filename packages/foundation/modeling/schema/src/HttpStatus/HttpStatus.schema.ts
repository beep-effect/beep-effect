/**
 * Complete HTTP status schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import { NonNegativeInt } from "../Number.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { HttpStatus4XX } from "./HttpStatus.client-error.ts";
import { HttpStatus1XX } from "./HttpStatus.informational.ts";
import { HttpStatus3XX } from "./HttpStatus.redirection.ts";
import { HttpStatus5XX } from "./HttpStatus.server-error.aggregate.ts";
import { $I } from "./HttpStatus.shared.ts";
import { HttpStatus2XX } from "./HttpStatus.success.ts";
import { HttpStatusUnofficial } from "./HttpStatus.unofficial.aggregate.ts";

// =============================================================================
// HttpStatusCode
// =============================================================================

/**
 * Any HTTP response status code in the standard three-digit range.
 *
 * **Details**
 *
 * Unlike {@link HttpStatus}, this schema accepts extension and unassigned
 * status codes in addition to the named codes catalogued by this package.
 *
 * **Example** (Decode an extension status code)
 *
 * ```ts import.meta.vitest name="Decode an extension status code"
 * import { HttpStatusCode } from "@beep/schema/HttpStatus"
 * import * as S from "effect/Schema"
 *
 * S.decodeUnknownSync(HttpStatusCode)(599) // => 599
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpStatusCode = NonNegativeInt.check(S.isBetween({ minimum: 100, maximum: 599 })).pipe(
  $I.annoteSchema("HttpStatusCode", {
    description: "HTTP response status code in the standard three-digit range from 100 through 599.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value accepted by {@link HttpStatusCode}.
 *
 * **Example** (Type an HTTP response status)
 *
 * ```ts import.meta.vitest name="Type an HTTP response status"
 * import { HttpStatusCode } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatusCode = HttpStatusCode.make(404)
 * status // => 404
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HttpStatusCode = typeof HttpStatusCode.Type;

// =============================================================================
// HttpStatus
// =============================================================================

/**
 * A MappedLiteralKit of all HTTP status codes.
 *
 * **Example** (Count HTTP status pairs)
 *
 * ```ts import.meta.vitest name="Count HTTP status pairs"
 * import { HttpStatus } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatus.Pairs.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpStatus = MappedLiteralKit([
  ...HttpStatus1XX.Pairs,
  ...HttpStatus2XX.Pairs,
  ...HttpStatus3XX.Pairs,
  ...HttpStatus4XX.Pairs,
  ...HttpStatus5XX.Pairs,
  ...HttpStatusUnofficial.Pairs,
]).pipe(
  $I.annoteSchema("HttpStatus", {
    description: "A MappedLiteralKit of all HTTP status codes.",
  })
);

/**
 * A namespace for {@link HttpStatus} to contain the Encoded type
 *
 * **Example** (Decode encoded status name)
 *
 * ```ts import.meta.vitest name="Decode encoded status name"
 * import * as S from "effect/Schema"
 * import { HttpStatus } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus.Encoded = "Continue"
 * const status = S.decodeUnknownSync(HttpStatus)(encoded)
 * status // => 100
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export declare namespace HttpStatus {
  /**
   * The encoded type of {@link HttpStatus}
   *
   * @category validation
   * @since 0.0.0
   */
  export type Encoded = typeof HttpStatus.Encoded;
}

/**
 * {@inheritDoc HttpStatus}
 * @category validation
 * @since 0.0.0
 */
export type HttpStatus = typeof HttpStatus.Type;

/**
 * Canonical alias for the complete HTTP status schema.
 *
 * **Example** (Count schema status pairs)
 *
 * ```ts import.meta.vitest name="Count schema status pairs"
 * import { Schema } from "@beep/schema/HttpStatus"
 *
 * console.log(Schema.Pairs.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Schema = HttpStatus;

/**
 * Runtime type extracted from {@link Schema}.
 *
 * **Example** (Decode with Schema alias)
 *
 * ```ts import.meta.vitest name="Decode with Schema alias"
 * import * as S from "effect/Schema"
 * import type { Schema as HttpStatusValue } from "@beep/schema/HttpStatus"
 * import { Schema as HttpStatusSchema } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatusValue = S.decodeUnknownSync(HttpStatusSchema)("Ok")
 * status // => 200
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Schema = HttpStatus;
