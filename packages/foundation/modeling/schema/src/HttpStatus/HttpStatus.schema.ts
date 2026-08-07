/**
 * Complete HTTP status schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import { HttpStatus4XX } from "./HttpStatus.client-error.ts";
import { HttpStatus1XX } from "./HttpStatus.informational.ts";
import { HttpStatus3XX } from "./HttpStatus.redirection.ts";
import { HttpStatus5XX } from "./HttpStatus.server-error.aggregate.ts";
import { $I } from "./HttpStatus.shared.ts";
import { HttpStatus2XX } from "./HttpStatus.success.ts";
import { HttpStatusUnofficial } from "./HttpStatus.unofficial.aggregate.ts";

// =============================================================================
// HttpStatus
// =============================================================================

/**
 * A MappedLiteralKit of all HTTP status codes.
 *
 * **Example** (Count HTTP status pairs)
 *
 * ```ts
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
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpStatus } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus.Encoded = "Continue"
 * const status = S.decodeUnknownSync(HttpStatus)(encoded)
 * console.log(status) // 100
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
 *
 * **Example** (Annotate numeric status type)
 *
 * ```ts
 * import type { HttpStatus } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatus = 100
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HttpStatus = typeof HttpStatus.Type;

/**
 * Canonical alias for the complete HTTP status schema.
 *
 * **Example** (Count schema status pairs)
 *
 * ```ts
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
 * ```ts
 * import * as S from "effect/Schema"
 * import type { Schema as HttpStatusValue } from "@beep/schema/HttpStatus"
 * import { Schema as HttpStatusSchema } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatusValue = S.decodeUnknownSync(HttpStatusSchema)(200)
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Schema = HttpStatus;
