/**
 * `Stdlib`
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {TaggedErrorClass, SchemaUtils} from "@beep/schema";
import {O} from "@beep/utils";

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
  static readonly new = (message: string, cause?: unknown): ToolError => ToolError.make({
    message,
    cause: O.fromNullishOr(cause)
  });
}

/** Creates a schema-owned tool failure. */
export const toolError = (message: string, cause?: unknown): ToolError =>
  ToolError.new(message, cause);

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
  export type Encoded = typeof ToolError.Encoded
}
