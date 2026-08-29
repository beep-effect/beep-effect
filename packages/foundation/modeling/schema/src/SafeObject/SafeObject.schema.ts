/**
 * Schemas and codecs for nominally safe string-keyed objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { Effect, SchemaIssue, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { UnknownRecord } from "../Record/index.ts";

const $I = $SchemaId.create("SafeObject");

/**
 * Brands a string-keyed unknown record as a safe object.
 *
 * **Gotchas**
 *
 * Inputs need not use a plain-object prototype. Decoding follows
 * {@link UnknownRecord} by copying enumerable own string-keyed properties into
 * a new ordinary object. The brand is nominal and does not guarantee JSON
 * serialization or sanitize property names.
 *
 * **Example** (Decode branded safe object)
 *
 * ```ts import.meta.vitest name="Decode branded safe object"
 * import { SafeObject } from "@beep/schema/SafeObject"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(SafeObject)({ enabled: true, count: 1 })
 * )
 * value.enabled // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SafeObject = UnknownRecord.pipe(
  S.brand("SafeObject"),
  $I.annoteSchema("SafeObject", {
    description: "A nominally branded record with string keys and unknown values.",
  })
);

/**
 * Runtime type inferred from {@link SafeObject}.
 *
 * **Example** (Construct typed SafeObject)
 *
 * ```ts import.meta.vitest name="Construct typed SafeObject"
 * import { SafeObject as SafeObjectSchema } from "@beep/schema/SafeObject"
 * import type { SafeObject } from "@beep/schema/SafeObject"
 *
 * const value: SafeObject = SafeObjectSchema.make({ enabled: true })
 * value.enabled // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeObject = typeof SafeObject.Type;

/**
 * Normalizes any JavaScript object-keyword value into a safe object.
 *
 * **Gotchas**
 *
 * Decoding shallow-copies enumerable own string-keyed properties into a new
 * ordinary object before applying {@link SafeObject}. Arrays become
 * index-keyed records, functions contribute their enumerable own properties,
 * and prototype, symbol-keyed, and non-enumerable state is discarded.
 * Encoding returns the normalized record as an `object`; it cannot reconstruct
 * the original container or prototype.
 *
 * **Example** (Normalize array into object)
 *
 * ```ts import.meta.vitest name="Normalize array into object"
 * import { SafeObjectFromObjectKeyword } from "@beep/schema/SafeObject"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(SafeObjectFromObjectKeyword)(["first", "second"])
 * )
 * value // => { "0": "first", "1": "second" }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SafeObjectFromObjectKeyword = S.ObjectKeyword.pipe(
  S.decodeTo(
    SafeObject,
    SchemaTransformation.transformOrFail({
      decode: (input) =>
        Effect.try({
          try: () => ({ ...input }),
          catch: () =>
            new SchemaIssue.InvalidValue({
              message: "Could not read enumerable own properties from object",
            }),
        }),
      encode: Effect.succeed,
    })
  ),
  $I.annoteSchema("SafeObjectFromObjectKeyword", {
    description: "Normalizes any JavaScript object-keyword value into a nominally branded string-keyed record.",
  })
);

/**
 * Runtime type inferred from {@link SafeObjectFromObjectKeyword}.
 *
 * **Example** (Construct typed normalized object)
 *
 * ```ts import.meta.vitest name="Construct typed normalized object"
 * import { SafeObjectFromObjectKeyword as SafeObjectSchema } from "@beep/schema/SafeObject"
 * import type { SafeObjectFromObjectKeyword } from "@beep/schema/SafeObject"
 *
 * const value: SafeObjectFromObjectKeyword = SafeObjectSchema.make({ enabled: true })
 * value.enabled // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeObjectFromObjectKeyword = typeof SafeObjectFromObjectKeyword.Type;

/**
 * Concise namespace alias for {@link SafeObject}.
 *
 * **Example** (Decode via namespace alias)
 *
 * ```ts import.meta.vitest name="Decode via namespace alias"
 * import * as SafeObject from "@beep/schema/SafeObject"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(SafeObject.Schema)({ enabled: true })
 * )
 * value.enabled // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export { SafeObject as Schema };
