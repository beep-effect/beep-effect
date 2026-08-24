/**
 * Image command error types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Image/Image.errors");

const ImageCommandErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameImageCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("ImageCommandError", {
    message: ImageCommandErrorFields.message,
  })
);
const sameImageCommandError = (self: ImageCommandError, that: ImageCommandError): boolean =>
  sameImageCommandErrorFields(self, that);

/**
 * Error raised by image curation commands.
 *
 * **Example** (Create ImageCommandError instance)
 *
 * ```ts
 * import { ImageCommandError } from "@beep/repo-cli/commands/Image/index"
 *
 * const error = ImageCommandError.make({ message: "No videos found" })
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class ImageCommandError extends S.TaggedError<ImageCommandError>($I`ImageCommandError`)(
  "ImageCommandError",
  ImageCommandErrorFields,
  $I.annoteClass<
    S.declare<ImageCommandError>,
    readonly [S.TaggedStruct<"ImageCommandError", typeof ImageCommandErrorFields>]
  >("ImageCommandError", {
    description: "A failure raised while preparing or applying an image curation operation.",
    toEquivalence: () => sameImageCommandError,
  })
) {
  /**
   * Construct an image command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): ImageCommandError;
    (message: string): (cause: unknown) => ImageCommandError;
  } = dual(
    2,
    (cause: unknown, message: string): ImageCommandError =>
      ImageCommandError.make({
        message,
        cause,
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}
