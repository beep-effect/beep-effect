/**
 * Shared string normalization schemas.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { Str } from "@beep/utils";
import { identity, Result, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { Unknown } from "./Unknown.ts";

const $I = $SchemaId.create("String");
const encodeUnknownAsJsonResult = Unknown.encodeUnknownResultFromJsonString;
const isError = S.is(S.instanceOf(Error));

const stringifyFallback = (value: unknown): string => {
  try {
    return String(value);
  } catch {
    try {
      return Object.prototype.toString.call(value);
    } catch {
      return "[object Unknown]";
    }
  }
};

const stringifyUnknown = (value: unknown): string => {
  if (Str.isString(value)) {
    return value;
  }

  if (isError(value)) {
    return value.message;
  }

  return encodeUnknownAsJsonResult(value).pipe(
    Result.match({
      onFailure: () => stringifyFallback(value),
      onSuccess: identity,
    })
  );
};

/**
 * Branded non-empty trimmed string schema that strips whitespace and rejects empty results.
 *
 * **Example** (Decode trimmed non-empty string)
 *
 * ```ts import.meta.vitest name="Decode trimmed non-empty string"
 * import * as S from "effect/Schema"
 * import { NonEmptyTrimmedStr } from "@beep/schema/String"
 *
 * const value = S.decodeUnknownSync(NonEmptyTrimmedStr)("  hello  ")
 * value // => "hello"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonEmptyTrimmedStr = S.Trim.check(S.isNonEmpty({ message: "String must not be empty" })).pipe(
  S.brand("NonEmptyTrimmedStr"),
  $I.annoteSchema("NonEmptyTrimmedStr", {
    description: "Non-empty trimmed string",
    documentation: "A string that is not empty and has leading/trailing whitespace removed.",
  })
);

/**
 * Type for {@link NonEmptyTrimmedStr}.
 *
 * **Example** (Annotate decoded trimmed string)
 *
 * ```ts import.meta.vitest name="Annotate decoded trimmed string"
 * import * as S from "effect/Schema"
 * import { NonEmptyTrimmedStr } from "@beep/schema/String"
 *
 * const label: NonEmptyTrimmedStr = S.decodeUnknownSync(NonEmptyTrimmedStr)("  hello  ")
 * label // => "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonEmptyTrimmedStr = typeof NonEmptyTrimmedStr.Type;

/**
 * Branded UUID string schema that validates RFC 4122 format.
 *
 * **Example** (Decode RFC 4122 UUID)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UUID } from "@beep/schema/String"
 *
 * const id = S.decodeUnknownSync(UUID)("550e8400-e29b-41d4-a716-446655440000")
 * console.log(id)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const UUID = NonEmptyTrimmedStr.check(S.isUUID()).pipe(
  S.brand("UUID"),
  $I.annoteSchema("UUID", {
    description: "Universally Unique Identifier",
    documentation: "A 128-bit number used to identify information in computer systems.",
  })
);

/**
 * Type for {@link UUID}.
 *
 * **Example** (Annotate decoded UUID value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UUID } from "@beep/schema/String"
 *
 * const userId: UUID = S.decodeUnknownSync(UUID)("550e8400-e29b-41d4-a716-446655440000")
 * console.log(userId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UUID = typeof UUID.Type;

/**
 * A nullable string schema that accepts `string | null`.
 *
 * **Example** (Decode string or null)
 *
 * ```ts import.meta.vitest name="Decode string or null"
 * import * as S from "effect/Schema"
 * import { NullableStr } from "@beep/schema/String"
 *
 * S.decodeUnknownSync(NullableStr)("hello") // => "hello"
 * S.decodeUnknownSync(NullableStr)(null) // => null
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NullableStr = S.String.pipe(
  S.NullOr,
  $I.annoteSchema("NullableStr", {
    description: "A nullable string",
  })
);

/**
 * Type for {@link NullableStr}.
 *
 * **Example** (Annotate nullable string type)
 *
 * ```ts import.meta.vitest name="Annotate nullable string type"
 * import * as S from "effect/Schema"
 * import { NullableStr } from "@beep/schema/String"
 *
 * const name: NullableStr = S.decodeUnknownSync(NullableStr)(null)
 * name // => null
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NullableStr = typeof NullableStr.Type;

/**
 * A nullable string that decodes to `Option<string>` using `S.OptionFromNullOr`.
 *
 * **Example** (Decode null to Option.none)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OptionFromNullableStr } from "@beep/schema/String"
 *
 * const option = S.decodeUnknownSync(OptionFromNullableStr)(null)
 * console.log(option) // Option.none()
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const OptionFromNullableStr = S.String.pipe(
  S.OptionFromNullOr,
  $I.annoteSchema("OptionFromNullableStr", {
    description: "An option from a nullable string",
  })
);

/**
 * Type for {@link OptionFromNullableStr}.
 *
 * **Example** (Annotate Option string type)
 *
 * ```ts import.meta.vitest name="Annotate Option string type"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OptionFromNullableStr } from "@beep/schema/String"
 *
 * const value: OptionFromNullableStr = S.decodeUnknownSync(OptionFromNullableStr)("hello")
 * O.isSome(value) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OptionFromNullableStr = typeof OptionFromNullableStr.Type;

/**
 * Schema transformation that decodes any unknown input into a string.
 *
 * **Details**
 *
 * Strings pass through unchanged. Errors decode to their message. JSON-compatible
 * values decode to compact JSON text, and values that cannot be JSON encoded
 * fall back to JavaScript string coercion.
 *
 * **Example** (Decode object to JSON string)
 *
 * ```ts import.meta.vitest name="Decode object to JSON string"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { StrFromUnknown } from "@beep/schema/String"
 *
 * const program = S.decodeUnknownEffect(StrFromUnknown)({ ok: true })
 * const value = Effect.runSync(program)
 *
 * value // => "{\"ok\":true}"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const StrFromUnknown = S.Unknown.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform<string, unknown>({
      decode: stringifyUnknown,
      encode: identity,
    })
  ),
  $I.annoteSchema("StrFromUnknown", {
    description: "Schema transformation that decodes any unknown input into a string.",
  })
);

/**
 * Type for {@link StrFromUnknown}.
 *
 * **Example** (Decode Error to message)
 *
 * ```ts import.meta.vitest name="Decode Error to message"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { StrFromUnknown } from "@beep/schema/String"
 *
 * const text: StrFromUnknown = Effect.runSync(S.decodeUnknownEffect(StrFromUnknown)(new Error("boom")))
 * text // => "boom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StrFromUnknown = typeof StrFromUnknown.Type;
