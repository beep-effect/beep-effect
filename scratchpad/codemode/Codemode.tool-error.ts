/**
 * Tool execution failures surfaced through CodeMode.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("codemode/Codemode.tool-error");

/**
 * The `ToolError` model.
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
 * Companion namespace for {@link ToolError}
 *
 * @since 0.0.0
 */
export declare namespace ToolError {
  /**
   * Companion encoded type for {@link ToolError}
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ToolError.Encoded;
}
