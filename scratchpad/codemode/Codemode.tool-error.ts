/**
 * `Stdlib`
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {TaggedErrorClass, SchemaUtils} from "@beep/schema";
import {P, A, O, Str, R, Struct, pipe, dual} from "@beep/utils";
import {HashMap, HashSet} from "effect";

const $I = $ScratchpadId.create("StdLib.json");

/**
 * The `ToolError` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ToolError } from "@beep/codemode";
 *
 * const thing: ToolError = ToolError.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolError extends TaggedErrorClass<ToolError>($I`ToolError`)(
  "ToolError",
  {
    message: S.String,
    cause: S.Defect().pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault
    )
  },
  $I.annote("ToolError", {
    description: "The `ToolError` model"
  })
) {
  /** Creates a tool refusal whose message is safe to include in an execution diagnostic. */
  static readonly new: {
    (message: string, cause?: unknown): ToolError,
    (cause?: unknown): (message: string) => ToolError
  } = dual(2, (message: string, cause?: unknown): ToolError => ToolError.make({
    message,
    cause: O.fromNullishOr(cause)
  }))
}

/**
 * Companion namespace for {@link ToolError}
 *
 * @since 0.0.0
 */
export declare namespace ToolError {
  /**
   * Companion encoded type for {@link ToolError}
   *
   * **Example**
   *
   * @example
   * ```ts
   * import { ToolError } from "@beep/codemode";
   * import * as S from "effect/Schema";
   * const thingEncoded: ToolError.Encoded = S.encodeSync(ToolError)(ToolError.make());
   *
   * console.log(thingEncoded); // `{}`
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {}
}
