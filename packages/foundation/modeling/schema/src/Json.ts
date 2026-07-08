/**
 * A module containing effect schema's for json data types
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Json");

/**
 * Schema for a JSON object (a record of string keys to JSON-compatible values).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonObject } from "@beep/schema/Json"
 *
 * const decoded = S.decodeUnknownSync(JsonObject)({ name: "Alice", age: 30 })
 * console.log(decoded.name)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const JsonObject = S.Record(S.String, S.Json).pipe(
  $I.annoteSchema("JsonObject", {
    description: "A Json Object",
  })
);

/**
 * Runtime type extracted from the {@link JsonObject} schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonObject } from "@beep/schema/Json"
 *
 * const decoded: JsonObject = S.decodeUnknownSync(JsonObject)({ name: "Alice" })
 * console.log(decoded.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonObject = typeof JsonObject.Type;

/**
 * Schema for a JSON array (an array of JSON-compatible values).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonArray } from "@beep/schema/Json"
 *
 * const decoded = S.decodeUnknownSync(JsonArray)([1, "two", true, null])
 * console.log(decoded.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const JsonArray = S.Array(S.Json).pipe(
  $I.annoteSchema("JsonArray", {
    description: "A Json Array",
  })
);

/**
 * Runtime type extracted from the {@link JsonArray} schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonArray } from "@beep/schema/Json"
 *
 * const decoded: JsonArray = S.decodeUnknownSync(JsonArray)([1, "two", true, null])
 * console.log(decoded.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonArray = typeof JsonArray.Type;

/**
 * Decodes a JSON string into an unknown JSON-compatible value.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { decodeJsonString } from "@beep/schema/Json"
 *
 * const value = Effect.runSync(decodeJsonString("{\"ok\":true}"))
 *
 * console.log(value)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeJsonString = S.decodeUnknownEffect(S.UnknownFromJsonString);

/**
 * Encodes an unknown JSON-compatible value into a compact JSON string.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { encodeJsonString } from "@beep/schema/Json"
 *
 * const encoded = Effect.runSync(encodeJsonString({ ok: true }))
 *
 * console.log(encoded)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeJsonString = S.encodeUnknownEffect(S.UnknownFromJsonString);
