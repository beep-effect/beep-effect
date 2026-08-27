/**
 * Tool execution failures surfaced through CodeMode.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { O } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("codemode/Codemode.tool-error");

/**
 * Host tool failure that is safe to surface through CodeMode diagnostics.
 *
 * **Gotchas**
 *
 * Omitting `cause` stores `O.none()`; the field is optional at construction,
 * not a required defect payload.
 *
 * **Example** (Construct and narrow a tool refusal)
 *
 * ```ts
 * import { ToolError } from "@beep/scratchpad/codemode"
 *
 * const error = ToolError.new("search is disabled in this runtime")
 *
 * console.log(ToolError.is(error)) // true
 * console.log(error.message) // "search is disabled in this runtime"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ToolError extends S.TaggedError<ToolError>($I`ToolError`)(
  "ToolError",
  {
    message: S.String,
    cause: S.Defect().pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("ToolError", {
    description: "A host tool failure safe to surface through CodeMode.",
  })
) {
  static readonly is = S.is(ToolError);

  /** Creates a tool refusal whose message is safe to include in an execution diagnostic. */
  static readonly new = (message: string, cause?: unknown): ToolError =>
    ToolError.make({
      message,
      cause: O.fromNullishOr(cause),
    });
}

/**
 * Encoded companions for the {@link ToolError} tagged error.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ToolError {
  /**
   * Encoded wire shape accepted by {@link ToolError} before decoding.
   *
   * @see {@link ToolError} for the runtime tagged error and constructors.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ToolError.Encoded;
}
