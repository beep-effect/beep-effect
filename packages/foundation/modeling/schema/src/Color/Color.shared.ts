/**
 * Internal support for color schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

/**
 * Internal identity composer for color schemas.
 *
 * @example
 * ```ts
 * import { $I } from "../../src/Color/Color.shared.ts"
 *
 * const identifier = $I`ExampleCheck`
 * console.log(identifier)
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const $I = $SchemaId.create("Color");

/**
 * Convert a schema issue into the package-local schema error type.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Result from "effect/Result"
 * import { schemaIssueToError } from "../../src/Color/Color.shared.ts"
 *
 * const result = S.decodeUnknownResult(S.Number)("not-a-number")
 * if (Result.isFailure(result)) {
 *   const error = schemaIssueToError(result.failure)
 *   console.log(error instanceof S.SchemaError)
 * }
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Encoded RGB channel payload used by internal color conversions.
 *
 * @example
 * ```ts
 * import { RgbEncoded } from "../../src/Color/Color.shared.ts"
 *
 * const encoded = new RgbEncoded({ r: 0.2, g: 0.4, b: 0.6 })
 * console.log(encoded.r)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class RgbEncoded extends S.Class<RgbEncoded>($I`RgbEncoded`)(
  {
    r: S.Finite,
    g: S.Finite,
    b: S.Finite,
  },
  $I.annote("RgbEncoded", {
    description: "Encoded RGB channel payload used by internal color conversions.",
  })
) {}

/**
 * Encoded OKLCH coordinate payload used by internal color conversions.
 *
 * @example
 * ```ts
 * import { OklchEncoded } from "../../src/Color/Color.shared.ts"
 *
 * const encoded = new OklchEncoded({ l: 0.7, c: 0.1, h: 240 })
 * console.log(encoded.h)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class OklchEncoded extends S.Class<OklchEncoded>($I`OklchEncoded`)(
  {
    l: S.Finite,
    c: S.Finite,
    h: S.Finite,
  },
  $I.annote("OklchEncoded", {
    description: "Encoded OKLCH coordinate payload used by internal color conversions.",
  })
) {}
