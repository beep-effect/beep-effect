/**
 * Sibling git-worktree management command.
 *
 * Automates the workflow documented in `standards/git-worktrees.md`: creating,
 * removing, and inspecting Git-native sibling worktrees rooted at the canonical
 * `<main-checkout>-worktrees` directory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Console, Effect, FileSystem, Path } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { runGitOutput, runRepoCommandStreamingCapture } from "../../internal/repo-run/index.js";
import { WorktreeCommandError, WorktreeDirtyError, WorktreeExistsError } from "./Worktree.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.js";

const $I = $RepoCliId.create("commands/Worktree/Worktree.command");

const WORKTREES_ROOT_SUFFIX = "-worktrees";
const REFS_HEADS_PREFIX = "refs/heads/";

/**
 * Local-only files copied from the main checkout into a fresh worktree.
 *
 * These are gitignored per-worktree files that a fresh `git worktree add` does
 * not carry over; restoring them makes a new worktree immediately usable.
 *
 * @example
 * ```ts
 * import { WORKTREE_LOCAL_FILE_ENTRIES } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(WORKTREE_LOCAL_FILE_ENTRIES.length)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const WORKTREE_LOCAL_FILE_ENTRIES = [".env", ".claude/settings.local.json", "CLAUDE.local.md", ".idea"] as const;

/**
 * Default branch name created for a new worktree when `--branch` is omitted.
 *
 * @param name - Worktree name used as the branch suffix.
 * @returns The default branch name in the form `feat/<name>`.
 * @example
 * ```ts
 * import { defaultWorktreeBranch } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(defaultWorktreeBranch("feature-x"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const defaultWorktreeBranch = (name: string): string => `feat/${name}`;

/**
 * Build the `git worktree add` argument vector for a target path and branch.
 *
 * @param targetPath - Absolute path of the worktree to create.
 * @param branch - Branch to create and check out in the new worktree.
 * @returns The `git` argument vector (excluding the `git` executable).
 * @example
 * ```ts
 * import { worktreeAddArgs } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(worktreeAddArgs("/repo-worktrees/feature-x", "feat/feature-x"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const worktreeAddArgs: {
  (branch: string): (targetPath: string) => ReadonlyArray<string>;
  (targetPath: string, branch: string): ReadonlyArray<string>;
} = dual(
  2,
  (targetPath: string, branch: string): ReadonlyArray<string> => ["worktree", "add", targetPath, "-b", branch]
);

/**
 * Build the `git worktree remove` argument vector, optionally forced.
 *
 * @param targetPath - Absolute path of the worktree to remove.
 * @param force - Whether to pass `--force` so removal ignores dirty state.
 * @returns The `git` argument vector (excluding the `git` executable).
 * @example
 * ```ts
 * import { worktreeRemoveArgs } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(worktreeRemoveArgs("/repo-worktrees/feature-x", true))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const worktreeRemoveArgs: {
  (force: boolean): (targetPath: string) => ReadonlyArray<string>;
  (targetPath: string, force: boolean): ReadonlyArray<string>;
} = dual(
  2,
  (targetPath: string, force: boolean): ReadonlyArray<string> =>
    force ? ["worktree", "remove", "--force", targetPath] : ["worktree", "remove", targetPath]
);

/**
 * Suggested command an operator can run to delete a retired branch.
 *
 * @param branch - Branch left behind after a worktree is removed.
 * @returns The `git branch -D <branch>` command string.
 * @example
 * ```ts
 * import { branchDeleteCommand } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(branchDeleteCommand("feat/feature-x"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const branchDeleteCommand = (branch: string): string => `git branch -D ${branch}`;

/**
 * One parsed entry from `git worktree list --porcelain`.
 *
 * @example
 * ```ts
 * import { WorktreeListEntry } from "@beep/repo-cli/commands/Worktree"
 *
 * const entry = WorktreeListEntry.make({
 *   path: "/repo",
 *   head: "abc123",
 *   branch: "main",
 *   detached: false,
 *   locked: false,
 *   prunable: false,
 * })
 * console.log(entry.path)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorktreeListEntry extends S.Class<WorktreeListEntry>($I`WorktreeListEntry`)(
  {
    path: S.String,
    head: S.NullOr(S.String),
    branch: S.NullOr(S.String),
    detached: S.Boolean,
    locked: S.Boolean,
    prunable: S.Boolean,
  },
  $I.annote("WorktreeListEntry", {
    description: "One parsed entry from git worktree list --porcelain.",
  })
) {}

/**
 * Resolved worktree layout for the invoking repository.
 *
 * @example
 * ```ts
 * import { WorktreeContext } from "@beep/repo-cli/commands/Worktree"
 *
 * const context = WorktreeContext.make({
 *   currentRoot: "/repo",
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 * })
 * console.log(context.worktreesRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorktreeContext extends S.Class<WorktreeContext>($I`WorktreeContext`)(
  {
    currentRoot: S.String,
    mainCheckout: S.String,
    worktreesRoot: S.String,
    entries: S.Array(WorktreeListEntry),
  },
  $I.annote("WorktreeContext", {
    description: "Resolved worktree layout (invoking root, main checkout, worktrees root) plus listed worktrees.",
  })
) {}

/**
 * Outcome of copying one local-only file into a fresh worktree.
 *
 * @example
 * ```ts
 * import { WorktreeCopyOutcome } from "@beep/repo-cli/commands/Worktree"
 *
 * const outcome = WorktreeCopyOutcome.make({ entry: ".env", status: "copied" })
 * console.log(outcome.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorktreeCopyOutcome extends S.Class<WorktreeCopyOutcome>($I`WorktreeCopyOutcome`)(
  {
    entry: S.String,
    status: LiteralKit(["copied", "skipped"]),
    reason: S.optionalKey(S.String),
  },
  $I.annote("WorktreeCopyOutcome", {
    description: "Outcome of copying one local-only file from the main checkout into a fresh worktree.",
  })
) {}

/**
 * Per-worktree diagnostic row emitted by `worktree doctor`.
 *
 * @example
 * ```ts
 * import { WorktreeDoctorEntry } from "@beep/repo-cli/commands/Worktree"
 *
 * const entry = WorktreeDoctorEntry.make({
 *   path: "/repo-worktrees/feature-x",
 *   branch: "feat/feature-x",
 *   detached: false,
 *   locked: false,
 *   prunable: false,
 *   clean: true,
 *   changeCount: 0,
 *   hasEnv: true,
 *   hasNodeModules: true,
 * })
 * console.log(entry.clean)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorktreeDoctorEntry extends S.Class<WorktreeDoctorEntry>($I`WorktreeDoctorEntry`)(
  {
    path: S.String,
    branch: S.NullOr(S.String),
    detached: S.Boolean,
    locked: S.Boolean,
    prunable: S.Boolean,
    clean: S.Boolean,
    changeCount: S.Finite,
    hasEnv: S.Boolean,
    hasNodeModules: S.Boolean,
  },
  $I.annote("WorktreeDoctorEntry", {
    description: "Per-worktree diagnostic row emitted by worktree doctor.",
  })
) {}

/**
 * Read-only report produced by `worktree doctor`.
 *
 * @example
 * ```ts
 * import { WorktreeDoctorReport } from "@beep/repo-cli/commands/Worktree"
 *
 * const report = WorktreeDoctorReport.make({
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 *   pruneDryRun: [],
 * })
 * console.log(report.worktreesRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorktreeDoctorReport extends S.Class<WorktreeDoctorReport>($I`WorktreeDoctorReport`)(
  {
    mainCheckout: S.String,
    worktreesRoot: S.String,
    entries: S.Array(WorktreeDoctorEntry),
    pruneDryRun: S.Array(S.String),
  },
  $I.annote("WorktreeDoctorReport", {
    description: "Read-only report produced by worktree doctor.",
  })
) {}

type PorcelainAccumulator = {
  path: string;
  head: string | null;
  branch: string | null;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
};

const stripRefsHeads = (ref: string): string =>
  Str.startsWith(REFS_HEADS_PREFIX)(ref) ? ref.slice(REFS_HEADS_PREFIX.length) : ref;

const accumulatorEntry = (accumulator: PorcelainAccumulator): WorktreeListEntry =>
  WorktreeListEntry.make({
    path: accumulator.path,
    head: accumulator.head,
    branch: accumulator.branch,
    detached: accumulator.detached,
    locked: accumulator.locked,
    prunable: accumulator.prunable,
  });

const applyPorcelainAttribute = (current: PorcelainAccumulator, line: string): void => {
  if (Str.startsWith("HEAD ")(line)) {
    current.head = line.slice("HEAD ".length);
  } else if (Str.startsWith("branch ")(line)) {
    current.branch = stripRefsHeads(line.slice("branch ".length));
  } else if (line === "detached") {
    current.detached = true;
  } else if (line === "locked" || Str.startsWith("locked ")(line)) {
    current.locked = true;
  } else if (line === "prunable" || Str.startsWith("prunable ")(line)) {
    current.prunable = true;
  }
};

/**
 * Parse `git worktree list --porcelain` output into structured entries.
 *
 * @param porcelain - Raw stdout from `git worktree list --porcelain`.
 * @returns One entry per worktree block, in listing order.
 * @example
 * ```ts
 * import { parseWorktreePorcelain } from "@beep/repo-cli/commands/Worktree"
 *
 * const entries = parseWorktreePorcelain("worktree /repo\nHEAD abc123\nbranch refs/heads/main\n")
 * console.log(entries.length)
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const parseWorktreePorcelain = (porcelain: string): ReadonlyArray<WorktreeListEntry> => {
  const lines = Str.split(Str.trimEnd(porcelain), "\n");
  const entries: Array<WorktreeListEntry> = [];
  let current: PorcelainAccumulator | undefined;

  for (const line of lines) {
    if (Str.startsWith("worktree ")(line)) {
      if (current !== undefined) {
        entries.push(accumulatorEntry(current));
      }
      current = {
        path: line.slice("worktree ".length),
        head: null,
        branch: null,
        detached: false,
        locked: false,
        prunable: false,
      };
      continue;
    }

    if (current === undefined) {
      continue;
    }

    applyPorcelainAttribute(current, line);
  }

  if (current !== undefined) {
    entries.push(accumulatorEntry(current));
  }

  return entries;
};

const isUnderWorktreesRoot = (path: Path.Path, worktreesRoot: string, candidate: string): boolean => {
  const relative = path.relative(worktreesRoot, candidate);
  return relative.length > 0 && !Str.startsWith("..")(relative) && !path.isAbsolute(relative);
};

const failOnNonZeroExit = Effect.fn("Worktree.failOnNonZeroExit")(function* (
  commandText: string,
  failMessage: string,
  exitCode: number
): Effect.fn.Return<void, WorktreeCommandError> {
  if (exitCode !== 0) {
    return yield* WorktreeCommandError.make({
      message: `${failMessage} (exit ${exitCode}).`,
      command: commandText,
      exitCode,
    });
  }
});

const worktreeGitErrorAdapter = (failMessage: string): GitCommandErrorAdapter<WorktreeCommandError> => ({
  onSpawnFailure: (commandLine) => WorktreeCommandError.new(failMessage, { command: commandLine }),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    WorktreeCommandError.make({ message: `${failMessage} (exit ${exitCode}).`, command: commandLine, exitCode }),
  onTruncated: O.none(),
});

const runGitCapture = Effect.fn("Worktree.runGitCapture")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  failMessage: string
): Effect.fn.Return<string, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitOutput(cwd, args, worktreeGitErrorAdapter(failMessage));
});

const runStreamingStep = Effect.fn("Worktree.runStreamingStep")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  failMessage: string
): Effect.fn.Return<void, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const commandText = A.join([command, ...args], " ");
  const result = yield* runRepoCommandStreamingCapture(command, args, cwd).pipe(
    Effect.mapError(WorktreeCommandError.new(failMessage, { command: commandText }))
  );
  yield* failOnNonZeroExit(commandText, failMessage, result.exitCode);
});

/**
 * Resolve the worktree layout for the invoking repository.
 *
 * The invoking root is discovered from `startFrom` (default: `process.cwd()`).
 * The main checkout and worktrees root are derived from
 * `git worktree list --porcelain`, so the canonical
 * `<main-checkout>-worktrees` sibling directory is stable from any worktree.
 *
 * @example
 * ```ts
 * import { resolveWorktreeContext } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(resolveWorktreeContext("/repo"))
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const resolveWorktreeContext = Effect.fn("Worktree.resolveWorktreeContext")(function* (
  startFrom?: string
): Effect.fn.Return<
  WorktreeContext,
  WorktreeCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const currentRoot = yield* findRepoRoot(startFrom).pipe(
    Effect.mapError(WorktreeCommandError.new("Failed to locate the current repository root."))
  );
  const porcelain = yield* runGitCapture(
    currentRoot,
    ["worktree", "list", "--porcelain"],
    "Failed to list git worktrees."
  );
  const entries = parseWorktreePorcelain(porcelain);
  const mainCheckout = O.match(A.head(entries), {
    onNone: () => currentRoot,
    onSome: (entry) => entry.path,
  });
  const worktreesRoot = path.join(path.dirname(mainCheckout), `${path.basename(mainCheckout)}${WORKTREES_ROOT_SUFFIX}`);
  return WorktreeContext.make({ currentRoot, mainCheckout, worktreesRoot, entries });
});

/**
 * Add a sibling worktree under the resolved worktrees root.
 *
 * Refuses when the target directory already exists. Does not bootstrap; see
 * {@link copyLocalFiles} and the `worktree new` command handler.
 *
 * @example
 * ```ts
 * import { addWorktree, WorktreeContext } from "@beep/repo-cli/commands/Worktree"
 *
 * const context = WorktreeContext.make({
 *   currentRoot: "/repo",
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 * })
 * console.log(addWorktree(context, "feature-x", "feat/feature-x"))
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const addWorktree = Effect.fn("Worktree.addWorktree")(function* (
  context: WorktreeContext,
  name: string,
  branch: string
): Effect.fn.Return<
  string,
  WorktreeCommandError | WorktreeExistsError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const targetPath = path.join(context.worktreesRoot, name);
  const exists = yield* fs.exists(targetPath).pipe(Effect.orElseSucceed(() => false));
  if (exists) {
    return yield* WorktreeExistsError.new(targetPath);
  }
  yield* runStreamingStep(
    "git",
    worktreeAddArgs(targetPath, branch),
    context.currentRoot,
    "Failed to add the git worktree."
  );
  return targetPath;
});

/**
 * Copy local-only files from the main checkout into a fresh worktree.
 *
 * Each entry in {@link WORKTREE_LOCAL_FILE_ENTRIES} is copied when present and
 * skipped otherwise; directories are copied recursively.
 *
 * @example
 * ```ts
 * import { copyLocalFiles } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(copyLocalFiles("/repo", "/repo-worktrees/feature-x"))
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const copyLocalFiles = Effect.fn("Worktree.copyLocalFiles")(function* (
  mainCheckout: string,
  targetPath: string
): Effect.fn.Return<ReadonlyArray<WorktreeCopyOutcome>, WorktreeCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const outcomes: Array<WorktreeCopyOutcome> = [];

  for (const entry of WORKTREE_LOCAL_FILE_ENTRIES) {
    const source = path.join(mainCheckout, entry);
    const present = yield* fs.exists(source).pipe(Effect.orElseSucceed(() => false));
    if (!present) {
      outcomes.push(WorktreeCopyOutcome.make({ entry, status: "skipped", reason: "not present in main checkout" }));
      continue;
    }
    const destination = path.join(targetPath, entry);
    yield* fs
      .makeDirectory(path.dirname(destination), { recursive: true })
      .pipe(
        Effect.mapError(
          WorktreeCommandError.new(`Failed to prepare the directory for ${entry}.`, { path: destination })
        )
      );
    yield* fs
      .copy(source, destination)
      .pipe(
        Effect.mapError(
          WorktreeCommandError.new(`Failed to copy ${entry} into the new worktree.`, { path: destination })
        )
      );
    outcomes.push(WorktreeCopyOutcome.make({ entry, status: "copied" }));
  }

  return outcomes;
});

const inspectWorktreeEntry = Effect.fn("Worktree.inspectWorktreeEntry")(function* (
  entry: WorktreeListEntry
): Effect.fn.Return<
  WorktreeDoctorEntry,
  WorktreeCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const statusOutput = yield* runGitCapture(entry.path, ["status", "--porcelain"], `Failed to inspect ${entry.path}.`);
  const changes = A.filter(Str.split(statusOutput, "\n"), Str.isNonEmpty);
  const hasEnv = yield* fs.exists(path.join(entry.path, ".env")).pipe(Effect.orElseSucceed(() => false));
  const hasNodeModules = yield* fs
    .exists(path.join(entry.path, "node_modules"))
    .pipe(Effect.orElseSucceed(() => false));
  return WorktreeDoctorEntry.make({
    path: entry.path,
    branch: entry.branch,
    detached: entry.detached,
    locked: entry.locked,
    prunable: entry.prunable,
    clean: changes.length === 0,
    changeCount: changes.length,
    hasEnv,
    hasNodeModules,
  });
});

/**
 * Build the read-only `worktree doctor` report for a resolved context.
 *
 * Inspects only worktrees under the worktrees root: branch, clean/dirty status,
 * presence of bootstrap files, and prunable metadata.
 *
 * @example
 * ```ts
 * import { worktreeDoctorReportForContext, WorktreeContext } from "@beep/repo-cli/commands/Worktree"
 *
 * const context = WorktreeContext.make({
 *   currentRoot: "/repo",
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 * })
 * console.log(worktreeDoctorReportForContext(context))
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const worktreeDoctorReportForContext = Effect.fn("Worktree.worktreeDoctorReportForContext")(function* (
  context: WorktreeContext
): Effect.fn.Return<
  WorktreeDoctorReport,
  WorktreeCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const pruneOutput = yield* runGitCapture(
    context.currentRoot,
    ["worktree", "prune", "--dry-run"],
    "Failed to compute prunable worktrees."
  );
  const pruneDryRun = A.filter(Str.split(pruneOutput, "\n"), Str.isNonEmpty);
  const managed = A.filter(context.entries, (entry) => isUnderWorktreesRoot(path, context.worktreesRoot, entry.path));
  const entries = yield* Effect.forEach(managed, inspectWorktreeEntry);
  return WorktreeDoctorReport.make({
    mainCheckout: context.mainCheckout,
    worktreesRoot: context.worktreesRoot,
    entries,
    pruneDryRun,
  });
});

const renderCreationSummary = Effect.fn("Worktree.renderCreationSummary")(function* (
  name: string,
  branch: string,
  targetPath: string,
  copies: ReadonlyArray<WorktreeCopyOutcome>
) {
  const copied = A.filter(copies, (copy) => copy.status === "copied");
  const skipped = A.filter(copies, (copy) => copy.status === "skipped");
  yield* Console.log("");
  yield* Console.log(`Worktree ready: ${targetPath}`);
  yield* Console.log(`  name:   ${name}`);
  yield* Console.log(`  branch: ${branch}`);
  yield* Console.log(
    `  copied local files:    ${
      copied.length === 0
        ? "(none)"
        : A.join(
            A.map(copied, (copy) => copy.entry),
            ", "
          )
    }`
  );
  yield* Console.log(
    `  skipped (not present): ${
      skipped.length === 0
        ? "(none)"
        : A.join(
            A.map(skipped, (copy) => copy.entry),
            ", "
          )
    }`
  );
  yield* Console.log(`  next: cd ${targetPath}`);
});

const doctorEntryLines = (entry: WorktreeDoctorEntry): ReadonlyArray<string> => {
  const branchLabel = entry.branch ?? (entry.detached ? "(detached)" : "(unknown)");
  const statusLabel = entry.clean ? "clean" : `dirty (${entry.changeCount})`;
  const notes = A.filter(
    [
      entry.locked ? "locked" : undefined,
      entry.prunable ? "prunable" : undefined,
      entry.hasEnv ? undefined : "missing .env",
      entry.hasNodeModules ? undefined : "missing node_modules",
    ],
    (note): note is string => note !== undefined
  );
  return [
    `- ${entry.path}`,
    `    branch: ${branchLabel}  status: ${statusLabel}${notes.length === 0 ? "" : `  notes: ${A.join(notes, ", ")}`}`,
  ];
};

const renderDoctorReport = Effect.fn("Worktree.renderDoctorReport")(function* (report: WorktreeDoctorReport) {
  yield* Console.log(`Main checkout:  ${report.mainCheckout}`);
  yield* Console.log(`Worktrees root: ${report.worktreesRoot}`);
  if (report.entries.length === 0) {
    yield* Console.log("No managed worktrees found under the worktrees root.");
  }
  for (const entry of report.entries) {
    for (const line of doctorEntryLines(entry)) {
      yield* Console.log(line);
    }
  }
  if (report.pruneDryRun.length > 0) {
    yield* Console.log("Prunable metadata (git worktree prune --dry-run):");
    for (const line of report.pruneDryRun) {
      yield* Console.log(`  ${line}`);
    }
  }
});

const runWorktreeNew = Effect.fn("Worktree.runWorktreeNew")(function* (options: {
  readonly name: string;
  readonly branch: O.Option<string>;
}): Effect.fn.Return<
  void,
  WorktreeCommandError | WorktreeExistsError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const context = yield* resolveWorktreeContext();
  const branch = O.getOrElse(options.branch, () => defaultWorktreeBranch(options.name));
  const targetPath = yield* addWorktree(context, options.name, branch);
  yield* runStreamingStep(
    "git",
    ["submodule", "update", "--init", "--recursive"],
    targetPath,
    "Failed to update submodules in the new worktree."
  );
  yield* runStreamingStep("bun", ["install"], targetPath, "Failed to run bun install in the new worktree.");
  const copies = yield* copyLocalFiles(context.mainCheckout, targetPath);
  yield* renderCreationSummary(options.name, branch, targetPath, copies);
});

const runWorktreeRemove = Effect.fn("Worktree.runWorktreeRemove")(function* (options: {
  readonly name: string;
  readonly force: boolean;
}): Effect.fn.Return<
  void,
  WorktreeCommandError | WorktreeDirtyError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* resolveWorktreeContext();
  const targetPath = path.join(context.worktreesRoot, options.name);
  const exists = yield* fs.exists(targetPath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return yield* WorktreeCommandError.make({
      message: `No worktree found at ${targetPath}.`,
      path: targetPath,
    });
  }
  if (!options.force) {
    const statusOutput = yield* runGitCapture(
      targetPath,
      ["status", "--porcelain"],
      `Failed to inspect ${targetPath}.`
    );
    const changes = A.filter(Str.split(statusOutput, "\n"), Str.isNonEmpty);
    if (changes.length > 0) {
      return yield* WorktreeDirtyError.new(targetPath, changes.length);
    }
  }
  yield* runStreamingStep(
    "git",
    worktreeRemoveArgs(targetPath, options.force),
    context.currentRoot,
    "Failed to remove the git worktree."
  );
  yield* Console.log(`Removed worktree ${targetPath}`);
  const removed = A.findFirst(context.entries, (entry) => entry.path === targetPath);
  const hint = O.match(removed, {
    onNone: () => "Branch retained; delete it manually when ready.",
    onSome: (entry) =>
      entry.branch === null
        ? "Branch retained; delete it manually when ready."
        : `Branch retained. Delete it when ready:\n  ${branchDeleteCommand(entry.branch)}`,
  });
  yield* Console.log(hint);
});

const runWorktreeDoctor = Effect.fn("Worktree.runWorktreeDoctor")(function* (): Effect.fn.Return<
  void,
  WorktreeCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const context = yield* resolveWorktreeContext();
  const report = yield* worktreeDoctorReportForContext(context);
  yield* renderDoctorReport(report);
});

const worktreeNewCommand = Command.make(
  "new",
  {
    name: Argument.string("name").pipe(
      Argument.withDescription("Worktree name (directory under the worktrees root and default branch suffix)")
    ),
    branch: Flag.string("branch").pipe(
      Flag.withAlias("b"),
      Flag.withDescription("Branch to create for the new worktree (default: feat/<name>)"),
      Flag.optional
    ),
  },
  Effect.fn(function* ({ name, branch }) {
    yield* runWorktreeNew({ name, branch }).pipe(
      Effect.catchTags({
        WorktreeCommandError: Effect.fn(function* (error) {
          yield* Console.error(`worktree new: ${error.message}`);
          return yield* failWithReportedExit(`worktree new: ${error.message}`);
        }),
        WorktreeExistsError: Effect.fn(function* (error) {
          yield* Console.error(`worktree new: ${error.message}`);
          return yield* failWithReportedExit(`worktree new: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription("Create a sibling worktree, bootstrap it, and copy local-only files from the main checkout")
);

const worktreeRemoveCommand = Command.make(
  "remove",
  {
    name: Argument.string("name").pipe(Argument.withDescription("Worktree name under the worktrees root")),
    force: Flag.boolean("force").pipe(Flag.withDescription("Remove even when the worktree has uncommitted changes")),
  },
  Effect.fn(function* ({ name, force }) {
    yield* runWorktreeRemove({ name, force }).pipe(
      Effect.catchTags({
        WorktreeCommandError: Effect.fn(function* (error) {
          yield* Console.error(`worktree remove: ${error.message}`);
          return yield* failWithReportedExit(`worktree remove: ${error.message}`);
        }),
        WorktreeDirtyError: Effect.fn(function* (error) {
          yield* Console.error(`worktree remove: ${error.message}`);
          return yield* failWithReportedExit(`worktree remove: ${error.message}`);
        }),
      })
    );
  })
).pipe(Command.withDescription("Remove a sibling worktree (refuses on uncommitted changes unless --force)"));

const worktreeDoctorCommand = Command.make(
  "doctor",
  {},
  Effect.fn(function* () {
    yield* runWorktreeDoctor().pipe(
      Effect.catchTag(
        "WorktreeCommandError",
        Effect.fn(function* (error) {
          yield* Console.error(`worktree doctor: ${error.message}`);
          return yield* failWithReportedExit(`worktree doctor: ${error.message}`);
        })
      )
    );
  })
).pipe(
  Command.withDescription(
    "Inspect managed worktrees: branch, clean/dirty status, bootstrap files, and prunable metadata"
  )
);

/**
 * Worktree command group.
 *
 * @example
 * ```ts
 * import { worktreeCommand } from "@beep/repo-cli/commands/Worktree"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(worktreeCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const worktreeCommand = Command.make("worktree", {}, () =>
  Console.log(
    [
      "Worktree commands:",
      "- bun run beep worktree new <name> [--branch <branch>]",
      "- bun run beep worktree remove <name> [--force]",
      "- bun run beep worktree doctor",
    ].join("\n")
  )
).pipe(
  Command.withDescription("Manage sibling git worktrees under the canonical worktrees root"),
  Command.withSubcommands([worktreeNewCommand, worktreeRemoveCommand, worktreeDoctorCommand])
);
