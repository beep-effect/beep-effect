/**
 * Tracked shell allowlist law: every git-tracked `.sh` file must sit under an
 * allowed root or be an allowed exact file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { adaptGitKitError } from "../../internal/repo-run/GitExec.ts";
import { messageGitErrorAdapter } from "./internal/TrackedTextFiles.ts";
import { TrackedShellAllowlistExecutionError } from "./Laws.errors.ts";
import {
  TrackedShellAllowedFile,
  TrackedShellAllowedRoot,
  TrackedShellAllowlistSummary,
  TrackedShellFinding,
} from "./TrackedShellAllowlist.model.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { TrackedShellAllowlistOptions } from "./TrackedShellAllowlist.model.ts";

/** `git ls-files --stage` mode of a gitlink, which names a submodule commit, not a file. */
const GITLINK_MODE = "160000";

const isAllowedFile = S.is(TrackedShellAllowedFile);

/**
 * Whether a repository-relative shell script path is allowed.
 *
 * **Details**
 *
 * A path is allowed when it starts with one of the allowed roots or equals one
 * of the allowed files. Roots and files are exact strings; nothing is matched
 * as a glob.
 *
 * **Example** (Classify shell script paths)
 *
 * ```ts
 * import { isTrackedShellAllowed } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist"
 *
 * console.log(isTrackedShellAllowed(".claude/hooks/session-start.sh")) // true
 * console.log(isTrackedShellAllowed("scripts/cloud/bootstrap.sh")) // true
 * console.log(isTrackedShellAllowed("scripts/release.sh")) // false
 * ```
 *
 * @param file - Repository-relative path with `/` separators.
 * @returns `true` when the law allows the file.
 * @category predicates
 * @since 0.0.0
 */
export const isTrackedShellAllowed = (file: string): boolean =>
  isAllowedFile(file) || A.some(TrackedShellAllowedRoot.literals, (root) => Str.startsWith(root)(file));

/**
 * Render one finding as a report line.
 *
 * **Example** (Format a finding)
 *
 * ```ts
 * import { formatTrackedShellFinding } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist"
 * import { TrackedShellFinding } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * console.log(formatTrackedShellFinding(TrackedShellFinding.make({ file: "scripts/release.sh" })))
 * ```
 *
 * @param finding - The disallowed tracked shell script.
 * @returns The report line, naming the file and the remedy.
 * @category utilities
 * @since 0.0.0
 */
export const formatTrackedShellFinding = (finding: TrackedShellFinding): string =>
  `${finding.file}  tracked shell script outside the allowlist; port it to a beep command or add a reviewed Exception Ledger row and allowlist entry`;

/**
 * Run the tracked shell allowlist law over the git index.
 *
 * **Details**
 *
 * Lists index entries matching `*.sh` with `git ls-files --stage`, drops
 * gitlinks, and reports every path outside the allowlist in path order.
 * Untracked files are never listed; a staged deletion is no longer an entry.
 *
 * **Example** (Count findings in the repository)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runTrackedShellAllowlist } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist"
 * import { TrackedShellAllowlistOptions } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * const program = Effect.map(
 *   runTrackedShellAllowlist(TrackedShellAllowlistOptions.make({ cwd: process.cwd(), strictCheck: true })),
 *   (summary) => summary.findings.length
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location and strictness.
 * @returns Effect that lists the tracked shell scripts and summarizes the disallowed ones.
 * @category utilities
 * @since 0.0.0
 */
export const runTrackedShellAllowlist = Effect.fn("TrackedShellAllowlist.runTrackedShellAllowlist")(function* (
  options: TrackedShellAllowlistOptions
): Effect.fn.Return<
  TrackedShellAllowlistSummary,
  TrackedShellAllowlistExecutionError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const git = yield* Git;
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(
    TrackedShellAllowlistExecutionError.mapError("Failed to locate the repository root")
  );
  const entries = yield* git
    .lsFiles(repoRoot, { pathspec: ["*.sh"] })
    .pipe(
      Effect.mapError(
        adaptGitKitError(GitCommand.lsFiles(), messageGitErrorAdapter(TrackedShellAllowlistExecutionError.new))
      )
    );
  const tracked = F.pipe(
    entries,
    A.filter((entry) => entry.mode !== GITLINK_MODE && Str.endsWith(".sh")(entry.path)),
    A.map((entry) => entry.path),
    A.dedupe,
    A.sort(Order.String)
  );
  const findings = F.pipe(
    tracked,
    A.filter(P.not(isTrackedShellAllowed)),
    A.map((file) => TrackedShellFinding.make({ file }))
  );
  return TrackedShellAllowlistSummary.make({
    trackedShellFiles: A.length(tracked),
    allowedFiles: A.length(tracked) - A.length(findings),
    strictFailure: options.strictCheck && A.isReadonlyArrayNonEmpty(findings),
    findings,
  });
});
