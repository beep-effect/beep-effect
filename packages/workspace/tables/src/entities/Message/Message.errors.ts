/**
 * Workspace Message row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $WorkspaceTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $WorkspaceTablesId.create("entities/Message/Message.errors");

/**
 * Failure converting a Message persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { MessageConverterError } from "@beep/workspace-tables/entities/Message"
 *
 * const error = MessageConverterError.make({ message: "invalid Message row" })
 * console.log(error._tag) // "MessageConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MessageConverterError extends S.TaggedError<MessageConverterError>($I`MessageConverterError`)(
  "MessageConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a Message row or insert.",
    }),
  },
  $I.annoteError<MessageConverterError>("MessageConverterError", {
    title: "Message converter failure",
    description: "Failure converting a Message persistence row or insert.",
  })
) {
  /**
   * Construct a converter failure from the schema failure that refused the row.
   *
   * **Details**
   *
   * The schema failure is rendered rather than carried, so callers never depend
   * on the shape of an issue tree.
   *
   * **Example** (Adapt a schema failure)
   *
   * ```ts
   * import { MessageConverterError } from "@beep/workspace-tables/entities/Message"
   * import { Message } from "@beep/workspace-domain/entities/Message"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(Message)({}),
   *   MessageConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): MessageConverterError =>
    MessageConverterError.make({ message: error.message });
}
