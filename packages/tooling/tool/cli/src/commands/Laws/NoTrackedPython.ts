/**
 * No-tracked-python law: the git index holds no Python source, stub, windowed
 * script or notebook.
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
import * as Str from "effect/String";
import { adaptGitKitError } from "../../internal/repo-run/GitExec.ts";
import { messageGitErrorAdapter } from "./internal/TrackedTextFiles.ts";
import { NoTrackedPythonExecutionError } from "./Laws.errors.ts";
import { NoTrackedPythonFinding, NoTrackedPythonSummary, TrackedPythonExtension } from "./NoTrackedPython.model.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { NoTrackedPythonOptions } from "./NoTrackedPython.model.ts";

/** `git ls-files --stage` mode of a gitlink, which names a submodule commit, not a file. */
const GITLINK_MODE = "160000";

/** One `git ls-files` pathspec per banned extension; git matches `*` across directories. */
const PYTHON_PATHSPECS = A.map(TrackedPythonExtension.literals, (extension) => `*${extension}`);

/**
 * Whether a repository-relative path names a file the law bans.
 *
 * **Details**
 *
 * A path is banned when it ends with one of the {@link TrackedPythonExtension}
 * literals. The match is case-sensitive, as git pathspecs are.
 *
 * **Example** (Classify paths)
 *
 * ```ts
 * import { isTrackedPythonPath } from "@beep/repo-cli/commands/Laws/NoTrackedPython"
 *
 * console.log(isTrackedPythonPath("scripts/probe.py")) // true
 * console.log(isTrackedPythonPath("research/notes.ipynb")) // true
 * console.log(isTrackedPythonPath("docs/python.md")) // false
 * ```
 *
 * @param file - Repository-relative path with `/` separators.
 * @returns `true` when the law bans the file.
 * @category predicates
 * @since 0.0.0
 */
export const isTrackedPythonPath = (file: string): boolean =>
  A.some(TrackedPythonExtension.literals, (extension) => Str.endsWith(extension)(file));

/**
 * Render one finding as a report line.
 *
 * **Example** (Format a finding)
 *
 * ```ts
 * import { formatNoTrackedPythonFinding } from "@beep/repo-cli/commands/Laws/NoTrackedPython"
 * import { NoTrackedPythonFinding } from "@beep/repo-cli/commands/Laws/NoTrackedPython.model"
 *
 * console.log(formatNoTrackedPythonFinding(NoTrackedPythonFinding.make({ file: "scripts/probe.py" })))
 * ```
 *
 * @param finding - The tracked Python file.
 * @returns The report line, naming the file and the remedy.
 * @category utilities
 * @since 0.0.0
 */
export const formatNoTrackedPythonFinding = (finding: NoTrackedPythonFinding): string =>
  `${finding.file}  port it to TypeScript or run it outside the repository; tracked Python is banned`;

/**
 * Run the no-tracked-python law over the git index.
 *
 * **Details**
 *
 * Lists index entries matching the banned extensions with
 * `git ls-files --stage`, drops gitlinks, and reports every remaining path in
 * path order. There is no allowlist. Untracked files are never listed; a
 * staged deletion is no longer an entry.
 *
 * **Example** (Count findings in the repository)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runNoTrackedPython } from "@beep/repo-cli/commands/Laws/NoTrackedPython"
 * import { NoTrackedPythonOptions } from "@beep/repo-cli/commands/Laws/NoTrackedPython.model"
 *
 * const program = Effect.map(
 *   runNoTrackedPython(NoTrackedPythonOptions.make({ cwd: process.cwd(), strictCheck: true })),
 *   (summary) => summary.findings.length
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location and strictness.
 * @returns Effect that lists the tracked Python files and summarizes them as findings.
 * @category utilities
 * @since 0.0.0
 */
export const runNoTrackedPython = Effect.fn("NoTrackedPython.runNoTrackedPython")(function* (
  options: NoTrackedPythonOptions
): Effect.fn.Return<
  NoTrackedPythonSummary,
  NoTrackedPythonExecutionError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const git = yield* Git;
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(
    NoTrackedPythonExecutionError.mapError("Failed to locate the repository root")
  );
  const entries = yield* git
    .lsFiles(repoRoot, { pathspec: PYTHON_PATHSPECS })
    .pipe(
      Effect.mapError(adaptGitKitError(GitCommand.lsFiles(), messageGitErrorAdapter(NoTrackedPythonExecutionError.new)))
    );
  const findings = F.pipe(
    entries,
    A.filter((entry) => entry.mode !== GITLINK_MODE && isTrackedPythonPath(entry.path)),
    A.map((entry) => entry.path),
    A.dedupe,
    A.sort(Order.String),
    A.map((file) => NoTrackedPythonFinding.make({ file }))
  );
  return NoTrackedPythonSummary.make({
    trackedPythonFiles: A.length(findings),
    strictFailure: options.strictCheck && A.isReadonlyArrayNonEmpty(findings),
    findings,
  });
});
