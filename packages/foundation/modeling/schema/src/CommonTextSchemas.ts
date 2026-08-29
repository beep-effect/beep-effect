/**
 * Shared text-normalization schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { flow, HashSet, identity, pipe, SchemaTransformation } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("CommonTextSchemas");

const truthyBooleanString = HashSet.fromIterable(["true", "1", "yes", "on"]);

const normalizeBooleanString: (value: string) => boolean = flow(Str.trim, Str.toLowerCase, (normalized) =>
  HashSet.has(truthyBooleanString, normalized)
);

/**
 * Trimmed and non-empty text schema that strips whitespace and rejects empty results.
 *
 * **Example** (Decode trimmed non-empty text)
 *
 * ```ts import.meta.vitest name="Decode trimmed non-empty text"
 * import * as S from "effect/Schema"
 * import { TrimmedNonEmptyText } from "@beep/schema/CommonTextSchemas"
 *
 * const value = S.decodeUnknownSync(TrimmedNonEmptyText)("  hello  ")
 * value // => "hello"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TrimmedNonEmptyText = S.String.pipe(
  S.decodeTo(
    S.NonEmptyString,
    SchemaTransformation.transform({
      decode: Str.trim,
      encode: identity,
    })
  ),
  $I.annoteSchema("TrimmedNonEmptyText", {
    description: "Trimmed text that must be non-empty after normalization.",
  })
);

/**
 * Type for {@link TrimmedNonEmptyText}.
 *
 * **Example** (Type annotated trimmed text)
 *
 * ```ts import.meta.vitest name="Type annotated trimmed text"
 * import * as S from "effect/Schema"
 * import { TrimmedNonEmptyText } from "@beep/schema/CommonTextSchemas"
 *
 * const name: TrimmedNonEmptyText = S.decodeUnknownSync(TrimmedNonEmptyText)("  hello  ")
 * name // => "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TrimmedNonEmptyText = typeof TrimmedNonEmptyText.Type;

/**
 * Schema that decodes a comma-separated string into a trimmed non-empty string array.
 *
 * **Example** (Decode comma-separated items)
 *
 * ```ts import.meta.vitest name="Decode comma-separated items"
 * import * as S from "effect/Schema"
 * import { CommaSeparatedList } from "@beep/schema/CommonTextSchemas"
 *
 * const items = S.decodeUnknownSync(CommaSeparatedList)("foo, bar, baz")
 * items // => ["foo", "bar", "baz"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const CommaSeparatedList = S.String.pipe(
  S.decodeTo(
    S.Array(TrimmedNonEmptyText),
    SchemaTransformation.transform({
      decode: (value): ReadonlyArray<string> => pipe(Str.split(",")(value), A.map(Str.trim), A.filter(Str.isNonEmpty)),
      encode: (values: ReadonlyArray<string>) => A.join(values, ","),
    })
  ),
  $I.annoteSchema("CommaSeparatedList", {
    description: "Comma-separated text decoded into a trimmed non-empty string list.",
  })
);

/**
 * Type for {@link CommaSeparatedList}.
 *
 * **Example** (Type annotated list decode)
 *
 * ```ts import.meta.vitest name="Type annotated list decode"
 * import * as S from "effect/Schema"
 * import { CommaSeparatedList } from "@beep/schema/CommonTextSchemas"
 *
 * const tags: CommaSeparatedList = S.decodeUnknownSync(CommaSeparatedList)("a, b")
 * tags.join("|") // => "a|b"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CommaSeparatedList = typeof CommaSeparatedList.Type;

/**
 * Schema that normalizes common boolean string spellings (`"true"`, `"1"`, `"yes"`, `"on"`, etc.) to `boolean`.
 *
 * **Example** (Normalize boolean string values)
 *
 * ```ts import.meta.vitest name="Normalize boolean string values"
 * import * as S from "effect/Schema"
 * import { NormalizedBooleanString } from "@beep/schema/CommonTextSchemas"
 *
 * S.decodeUnknownSync(NormalizedBooleanString)("yes") // => true
 * S.decodeUnknownSync(NormalizedBooleanString)("0") // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NormalizedBooleanString = S.String.pipe(
  S.decodeTo(
    S.Boolean,
    SchemaTransformation.transform({
      decode: normalizeBooleanString,
      encode: String,
    })
  ),
  $I.annoteSchema("NormalizedBooleanString", {
    description: "Normalized boolean value decoded from common boolean string values.",
  })
);

/**
 * Type for {@link NormalizedBooleanString}.
 *
 * **Example** (Type annotated boolean flag)
 *
 * ```ts import.meta.vitest name="Type annotated boolean flag"
 * import * as S from "effect/Schema"
 * import { NormalizedBooleanString } from "@beep/schema/CommonTextSchemas"
 *
 * const flag: NormalizedBooleanString = S.decodeUnknownSync(NormalizedBooleanString)("yes")
 * flag // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizedBooleanString = typeof NormalizedBooleanString.Type;
