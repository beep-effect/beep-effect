/**
 * Reusable schema constructors for boundaries that model absence with `Option`.
 *
 * This module provides repository-named wrappers around Effect's option schema
 * helpers when the local codebase benefits from a more explicit boundary name.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";

/**
 * Decodes an optional object key whose value may also be `null` or `undefined`
 * into a required `Option`.
 *
 * **Details**
 *
 * This helper is a repository-named wrapper around
 * {@link S.OptionFromOptionalNullOr}. It is intended for object and class
 * fields where the boundary allows all common "missing" shapes:
 *
 * - omitted key
 * - present key with `undefined`
 * - present key with `null`
 *
 * Decoding turns each of those shapes into `None`. Any present non-nullish
 * value is decoded as `Some`.
 *
 * Encoding is controlled by `options.onNoneEncoding`:
 *
 * - `"omit"`: encode `None` by omitting the key
 * - `null`: encode `None` as `null`
 * - `undefined`: encode `None` as `undefined`
 *
 * Use this when an object boundary treats an omitted key, `undefined`, and
 * `null` as the same absence case but the decoded domain model should always
 * carry an explicit `Option`.
 *
 * **Example** (Decode optional nullish key)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OptionFromOptionalNullishKey } from "@beep/schema"
 *
 * const Payload = S.Struct({
 *   nickname: OptionFromOptionalNullishKey(S.String)
 * })
 *
 * const decode = S.decodeUnknownSync(Payload)
 *
 * const missing = decode({})
 * const nullish = decode({ nickname: null })
 * const present = decode({ nickname: "beep" })
 *
 * console.log(O.isNone(missing.nickname)) // true
 * console.log(O.isNone(nullish.nickname)) // true
 * console.log(O.getOrUndefined(present.nickname)) // "beep"
 * ```
 *
 * **Example** (Encode None as null)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OptionFromOptionalNullishKey } from "@beep/schema"
 *
 * const Payload = S.Struct({
 *   homepage: OptionFromOptionalNullishKey({ schema: S.URLFromString, onNoneEncoding: null })
 * })
 *
 * const encode = S.encodeSync(Payload)
 *
 * const encodedNone = encode({ homepage: O.none() })
 * const encodedSome = encode({ homepage: O.some(new URL("https://example.com")) })
 *
 * console.log(encodedNone) // { homepage: null }
 * console.log(encodedSome) // { homepage: "https://example.com/" }
 * ```
 *
 * @typeParam Schema - Schema used when the key is present with a non-nullish value.
 * @param schemaOrOptions - The `Some` schema, or an options object carrying that
 *   schema plus the `None` encoding.
 * @returns A schema that decodes optional nullish keys into `Option` values.
 * @category schemas
 * @since 0.0.0
 */
export function OptionFromOptionalNullishKey<Schema extends S.Top>(schema: Schema): S.OptionFromOptionalNullOr<Schema>;
export function OptionFromOptionalNullishKey<Schema extends S.Top>(options: {
  readonly schema: Schema;
  readonly onNoneEncoding: "omit" | null | undefined;
}): S.OptionFromOptionalNullOr<Schema>;
export function OptionFromOptionalNullishKey<Schema extends S.Top>(
  schemaOrOptions: Schema | { readonly schema: Schema; readonly onNoneEncoding: "omit" | null | undefined }
): S.OptionFromOptionalNullOr<Schema> {
  return S.isSchema(schemaOrOptions)
    ? S.OptionFromOptionalNullOr(schemaOrOptions)
    : S.OptionFromOptionalNullOr(schemaOrOptions.schema, { onNoneEncoding: schemaOrOptions.onNoneEncoding });
}
