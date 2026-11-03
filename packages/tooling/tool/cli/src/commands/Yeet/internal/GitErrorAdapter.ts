/**
 * Yeet's git error wording: the adapter that folds a run-layer git failure
 * into a `YeetCommandError` with Yeet's historical messages.
 *
 * **Details**
 *
 * Split from `GitExec.ts` so library modules (PR provenance) call the
 * run-layer `runGitOutput` with Yeet's wording without importing the Yeet git
 * wrappers (beep-cli-composition W1b).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { YeetCommandError } from "../Yeet.errors.ts";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/GitErrorAdapter");

/**
 * The wording a {@link yeetGitErrorAdapter} folds git failures into.
 *
 * **Details**
 *
 * `spawnFailure` is a fixed message for a run git never reached; when it is absent the message is
 * `Failed to run <command line>.`. A non-zero exit renders `<command line> <nonZeroExit> <code>.`, and
 * a truncated run `<command line> <truncated>`, carrying `truncatedExitCode` when one is set.
 *
 * **Example** (Describe the strict reader wording)
 *
 * ```ts
 * import { YeetGitErrorWording } from "@beep/repo-cli/test/Yeet"
 *
 * const wording = YeetGitErrorWording.make({
 *   spawnFailure: "Failed to read the working-tree status.",
 *   nonZeroExit: "exited with code",
 *   truncated: "produced more output than the capture bound.",
 * })
 * console.log(wording.nonZeroExit) // exited with code
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGitErrorWording extends S.Opaque<YeetGitErrorWording, { readonly brand: unique symbol }>()(
  S.Struct({
    spawnFailure: S.optionalKey(S.String),
    nonZeroExit: S.String,
    truncated: S.String,
    truncatedExitCode: S.optionalKey(S.Finite),
  }).pipe(
    $I.annoteSchema("YeetGitErrorWording", {
      description: "Message text Yeet renders for a git run that failed to spawn, exited non-zero or was truncated.",
    })
  )
) {}

/**
 * Build a `GitCommandErrorAdapter` that folds every git failure into `YeetCommandError` with the
 * given wording.
 *
 * **Details**
 *
 * Yeet keeps two historical wordings. The bounded capture renders
 * `<command line> failed with exit code <n>.`, and the strict readers in Settle render
 * `<command line> exited with code <n>.`. Both share this shape and differ only in their
 * {@link YeetGitErrorWording} (repo-cli-gh-git-consolidation W2b, SPEC D-11).
 *
 * **Example** (Build the strict reader adapter)
 *
 * ```ts
 * import { YeetGitErrorWording, yeetGitErrorAdapter } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const adapter = yeetGitErrorAdapter(
 *   YeetGitErrorWording.make({ nonZeroExit: "exited with code", truncated: "produced more output than the capture bound." })
 * )
 * console.log(O.isSome(adapter.onTruncated)) // true
 * ```
 *
 * @param wording - The message text for each failure kind.
 * @returns The adapter for `adaptGitKitError` or the bounded capture.
 * @category execution
 * @since 0.0.0
 */
export const yeetGitErrorAdapter = (wording: YeetGitErrorWording): GitCommandErrorAdapter<YeetCommandError> => ({
  onSpawnFailure: (commandLine) =>
    YeetCommandError.new(O.getOrElse(O.fromUndefinedOr(wording.spawnFailure), () => `Failed to run ${commandLine}.`)),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    YeetCommandError.make({
      message: `${commandLine} ${wording.nonZeroExit} ${exitCode}.`,
      command: commandLine,
      exitCode,
    }),
  onTruncated: O.some((commandLine) =>
    YeetCommandError.make({
      message: `${commandLine} ${wording.truncated}`,
      command: commandLine,
      ...O.match(O.fromUndefinedOr(wording.truncatedExitCode), {
        onNone: () => ({}),
        onSome: (exitCode) => ({ exitCode }),
      }),
    })
  ),
});

/**
 * Yeet's default git error adapter: the wording every Yeet git run uses.
 *
 * **Details**
 *
 * A non-zero exit reads `<command line> failed with exit code <n>.`, a
 * truncated capture reads
 * `<command line> output exceeded the repo-run capture limit.` with exit
 * code 1, and a run git never reached reads `Failed to run <command line>.`.
 *
 * **Example** (Run git with Yeet's wording)
 *
 * ```ts
 * import { runGitOutput } from "@beep/repo-cli/test/RepoRun"
 * import { yeetGitOutputErrorAdapter } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const head = runGitOutput(".", ["rev-parse", "HEAD"], yeetGitOutputErrorAdapter)
 * console.log(Effect.isEffect(head)) // true
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const yeetGitOutputErrorAdapter: GitCommandErrorAdapter<YeetCommandError> = yeetGitErrorAdapter(
  YeetGitErrorWording.make({
    nonZeroExit: "failed with exit code",
    truncated: "output exceeded the repo-run capture limit.",
    truncatedExitCode: 1,
  })
);
