/**
 * Dependency-neutral CodeMode boundary data schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("codemode/Codemode.data");

/**
 * JSON value that can cross the confined interpreter boundary.
 *
 * **Example** (Decode nested JSON and reject a function)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(CodeMode.DataValue)
 *
 * console.log(O.isSome(decode({ nested: [1, "two", null] }))) // true
 * console.log(O.isNone(decode(() => 1))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DataValue = S.Json.pipe(
  $I.annoteSchema("DataValue", {
    description: "A JSON value returned across the CodeMode execution boundary.",
  })
);

/**
 * Decoded JSON value produced by {@link DataValue}.
 *
 * @see {@link DataValue} for the runtime schema and boundary decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type DataValue = typeof DataValue.Type;
