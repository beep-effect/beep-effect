/**
 * Nominal schema for string-keyed objects with unknown values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { UnknownRecord } from "../Record/index.ts";

const $I = $SchemaId.create("SafeObject");

/**
 * Brands a string-keyed unknown record as a safe object.
 *
 * @remarks
 * Inputs need not use a plain-object prototype. Decoding follows
 * {@link UnknownRecord} by copying enumerable own string-keyed properties into
 * a new ordinary object. The brand is nominal and does not guarantee JSON
 * serialization or sanitize property names.
 *
 * @example
 * ```ts
 * import { SafeObject } from "@beep/schema/SafeObject"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(SafeObject)({ enabled: true, count: 1 })
 * )
 * console.log(value.enabled) // true
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
 * @example
 * ```ts
 * import { SafeObject as SafeObjectSchema } from "@beep/schema/SafeObject"
 * import type { SafeObject } from "@beep/schema/SafeObject"
 *
 * const value: SafeObject = SafeObjectSchema.make({ enabled: true })
 * console.log(value.enabled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeObject = typeof SafeObject.Type;

/**
 * Concise namespace alias for {@link SafeObject}.
 *
 * @example
 * ```ts
 * import * as SafeObject from "@beep/schema/SafeObject"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(SafeObject.Schema)({ enabled: true })
 * )
 * console.log(value.enabled) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export { SafeObject as Schema };
