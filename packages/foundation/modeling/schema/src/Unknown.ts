/**
 * Unknown-value and JSON-string boundary schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Unknown");

/**
 * Accepts any value without attaching codec runners.
 *
 * **When to use**
 *
 * Use as the top schema for an intentionally untyped boundary. Compile a
 * runner at module scope or use {@link UnknownFromJsonString} at a JSON-text
 * boundary.
 *
 * **Gotchas**
 *
 * This schema does not validate the shape of a value. Prefer a more specific
 * schema as soon as the boundary contract is known, and prefer Effect-returning
 * codecs over throwing Sync codecs in library code.
 *
 * **Example** (Accept an unknown value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Unknown } from "@beep/schema"
 *
 * const input = { name: "Ada", active: true }
 * console.log(S.decodeUnknownSync(Unknown)(input))
 * ```
 *
 * @see {@link S.Unknown} for the underlying top schema.
 * @see {@link UnknownFromJsonString} for the explicit compact JSON boundary.
 * @category schemas
 * @since 0.0.0
 */
export const Unknown = S.Unknown.pipe(
  $I.annoteSchema("Unknown", {
    description: "An unknown-value schema without an implicit serialization boundary.",
  })
);

/**
 * Compact JSON-string boundary for unknown values.
 *
 * **Details**
 *
 * The JSON codec is constructed once at module scope. Its static surface is
 * limited to runners used by repository consumers; JSON formatting or
 * reviver/replacer policy belongs in a separately named local
 * `S.fromJsonString(...)` schema.
 *
 * **Example** (Encode unknown data as compact JSON)
 *
 * ```ts
 * import { UnknownFromJsonString } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const encoded = await Effect.runPromise(
 *   UnknownFromJsonString.encodeUnknownEffect({ name: "Ada", active: true })
 * )
 *
 * console.log(encoded)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnknownFromJsonString = S.fromJsonString(Unknown).pipe(
  SchemaUtils.withCodecStatics([
    "decodeEffect",
    "decodeResult",
    "decodeUnknownEffect",
    "decodeUnknownOption",
    "decodeUnknownResult",
    "decodeUnknownSync",
    "encodeEffect",
    "encodeResult",
    "encodeUnknownEffect",
    "encodeUnknownOption",
    "encodeUnknownResult",
    "encodeUnknownSync",
  ]),
  $I.annoteSchema("UnknownFromJsonString", {
    description: "A compact JSON-string codec for intentionally unknown values.",
  })
);

/**
 * Decoded value accepted and returned by {@link Unknown}.
 *
 * @see {@link Unknown} for the runtime schema and its schema-bound codec runners.
 * @category type-level
 * @since 0.0.0
 */
export type Unknown = typeof Unknown.Type;

/**
 * Decoded value accepted by {@link UnknownFromJsonString}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UnknownFromJsonString = typeof UnknownFromJsonString.Type;
