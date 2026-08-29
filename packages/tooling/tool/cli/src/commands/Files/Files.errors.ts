/**
 * Typed errors for dataset file curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import { Err } from "@beep/utils";
import { Effect, Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Files/Files.errors");

class PlatformErrorOptions extends S.Class<PlatformErrorOptions>($I`PlatformErrorOptions`)(
  {
    cause: Defect({ includeStack: true }),
  },
  $I.annote("PlatformErrorOptions", {
    description: "Options for platform errors, including a cause.",
  })
) {}

/**
 * Error raised by file curation commands.
 *
 * **Example** (Create FilesCommandError instance)
 *
 * ```ts
 * import { FilesCommandError } from "@beep/repo-cli/commands/Files/index"
 *
 * const error = FilesCommandError.make({ message: "Invalid directory" })
 * console.log(error.message)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class FilesCommandError extends S.TaggedError<FilesCommandError>($I`FilesCommandError`)(
  "FilesCommandError",
  {
    message: S.String,
    cause: S.optionalKey(Defect({ includeStack: true })),
    exitCode: S.optionalKey(S.Literals([1, 2])).annotateKey({
      description:
        "Process exit-code hint per the file-processing SPEC: 2 for configuration/engine-discovery failures, 1 (default) otherwise.",
    }),
  },
  $I.annoteError<FilesCommandError>("FilesCommandError", {
    description: "A failure raised while preparing or applying a file curation operation.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a file command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): FilesCommandError;
    (message: string): (cause: unknown) => FilesCommandError;
  } = dual(2, (cause: unknown, message: string): FilesCommandError => FilesCommandError.make({ cause, message }));

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Convert a platform failure into a file command error.
 *
 * **Example** (Format rename platform error)
 *
 * ```ts
 * import { formatPlatformError } from "@beep/repo-cli/commands/Files"
 *
 * const error = formatPlatformError("rename", "/tmp/source.txt", { cause: new Error("EACCES") })
 * console.log(error.message.includes("/tmp/source.txt")) // true
 * ```
 *
 * @param operation - Operation being attempted.
 * @param filePath - Path involved in the failed operation.
 * @param options - Wrapped platform failure details.
 * @returns File command error with operation context.
 * @category error-handling
 * @since 0.0.0
 */
export const formatPlatformError: {
  (filePath: string, options: PlatformErrorOptions): (operation: string) => FilesCommandError;
  (operation: string, filePath: string, options: PlatformErrorOptions): FilesCommandError;
} = dual(
  3,
  (operation: string, filePath: string, options: PlatformErrorOptions): FilesCommandError =>
    FilesCommandError.make({
      message: `${operation}: "${filePath}"`,
      cause: options.cause,
    })
);

/**
 * Fail when a rename operation selects an extensionless file.
 *
 * **Example** (Fail on extensionless path)
 *
 * ```ts
 * import { failOnExtensionlessFile } from "@beep/repo-cli/commands/Files"
 * import { Effect } from "effect"
 *
 * const program = failOnExtensionlessFile("/tmp/README")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param filePath - Path rejected because it has no suffix to preserve.
 * @returns Failed effect with a file command error.
 * @category error-handling
 * @since 0.0.0
 */
export const failOnExtensionlessFile = (filePath: string): Effect.Effect<never, FilesCommandError> =>
  Effect.fail(
    FilesCommandError.make({
      message: `Cannot rename extensionless file: "${filePath}"`,
    })
  );
