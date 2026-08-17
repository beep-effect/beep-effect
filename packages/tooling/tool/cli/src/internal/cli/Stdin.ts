/**
 * Shared stdin-document reading for `--from-stdin` command flags.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/Stdin");

/**
 * Failure while reading a stdin document, carrying the caller's phrasing.
 *
 * **Example** (Make StdinDocumentError instance)
 *
 * ```ts
 * import { StdinDocumentError } from "@beep/repo-cli/internal/cli/Stdin"
 *
 * const error = StdinDocumentError.make({ message: "no stdin" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StdinDocumentError extends S.TaggedError<StdinDocumentError>($I`StdinDocumentError`)(
  "StdinDocumentError",
  {
    message: S.String,
  },
  $I.annote("StdinDocumentError", {
    description: "Failure while reading a stdin document for a --from-stdin command flag.",
  })
) {}

/**
 * The caller-specific phrasing for each way a stdin read can fail.
 */
interface StdinDocumentMessages {
  /** Refusal when the command ran without its `--from-stdin` flag. */
  readonly missingFlag: string;
  /** Refusal when stdin is an interactive terminal with nothing piped. */
  readonly noStdin: string;
  /** Prefix for a failed read, completed with the underlying cause. */
  readonly readFailurePrefix: string;
}

/**
 * Read one whole document from stdin, or fail with the caller's phrasing.
 *
 * **Example** (Refuse without the flag)
 *
 * ```ts
 * import { readStdinDocument } from "@beep/repo-cli/internal/cli/Stdin"
 * import { Effect } from "effect"
 *
 * const read = readStdinDocument(false, {
 *   missingFlag: "requires --from-stdin",
 *   noStdin: "received no stdin",
 *   readFailurePrefix: "failed to read stdin"
 * })
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param fromStdin - Whether the command's `--from-stdin` flag was passed.
 * @param messages - The caller's phrasing for the three failure modes.
 * @returns The full stdin text.
 * @category services
 * @since 0.0.0
 */
export const readStdinDocument = Effect.fn("Cli.readStdinDocument")(function* (
  fromStdin: boolean,
  messages: StdinDocumentMessages
): Effect.fn.Return<string, StdinDocumentError> {
  if (!fromStdin) {
    return yield* StdinDocumentError.make({ message: messages.missingFlag });
  }
  if (process.stdin.isTTY) {
    return yield* StdinDocumentError.make({ message: messages.noStdin });
  }
  return yield* Effect.tryPromise(() => Bun.stdin.text()).pipe(
    Effect.mapError((cause) =>
      StdinDocumentError.make({
        message: `${messages.readFailurePrefix}: ${cause instanceof Error ? cause.message : String(cause)}`,
      })
    )
  );
});
