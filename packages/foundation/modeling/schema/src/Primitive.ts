/**
 * A primitive data type schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Primitive");

/**
 * Schema for JavaScript primitive types (`string | number | boolean | bigint | null | undefined`).
 *
 * **Example** (Decode string number null)
 *
 * ```ts import.meta.vitest name="Decode string number null"
 * import * as S from "effect/Schema"
 * import { Primitive } from "@beep/schema/Primitive"
 *
 * S.decodeUnknownSync(Primitive)("hello") // => "hello"
 * S.decodeUnknownSync(Primitive)(42) // => 42
 * S.decodeUnknownSync(Primitive)(null) // => null
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Primitive = S.Union([S.String, S.Finite, S.Boolean, S.BigInt, S.Null, S.Undefined]).pipe(
  $I.annoteSchema("Primitive", {
    description: "A primitive data type, (string | number | boolean | bigint | null | undefined )",
  })
);

/**
 * {@inheritDoc Primitive}
 * @category models
 * @since 0.0.0
 */
export type Primitive = typeof Primitive.Type;
