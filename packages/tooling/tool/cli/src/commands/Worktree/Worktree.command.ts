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
import { LiteralKit, NonEmptyTrimmedStr } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Console, Effect, FileSystem, Path } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { runRepoCommandStreamingCapture } from "../../internal/repo-run/index.ts";
import { worktreeFleetCommand } from "./Fleet.command.ts";
import { WORKTREES_ROOT_SUFFIX } from "./Worktree.constants.ts";
import { WorktreeCommandError, WorktreeExistsError } from "./Worktree.errors.ts";
import { parseWorktreePorcelain, WorktreeListEntry, WorktreeRemovalRequest } from "./Worktree.schemas.ts";
import {
  branchDeleteCommand,
  runWorktreeGitCapture,
  WorktreeRemovalService,
  WorktreeRemovalServiceLive,
} from "./Worktree.service.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { WorktreeDirtyError, WorktreePreservationError } from "./Worktree.errors.ts";
import type { WorktreeRemovalReceipt } from "./Worktree.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/Worktree.command");
const decodeWorktreeName = S.decodeUnknownEffect(NonEmptyTrimmedStr);

/**
 * Local-only files copied from the main checkout into a fresh worktree.
 *
 * **Details**
 *
 * These are gitignored per-worktree files that a fresh `git worktree add` does
 * not carry over; restoring them makes a new worktree immediately usable.
 *
 * **Example** (Inspect the bootstrap entries)
 *
 * ```ts
 * import { WORKTREE_LOCAL_FILE_ENTRIES } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(WORKTREE_LOCAL_FILE_ENTRIES.includes(".env")) // true
 * console.log(WORKTREE_LOCAL_FILE_ENTRIES.length) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WORKTREE_LOCAL_FILE_ENTRIES = [
  ".env",
  ".claude/settings.local.json",
  "CLAUDE.local.md",
  ".idea/compiler.xml",
  ".idea/effect.intellij.xml",
] as const;

/**
 * Default branch name created for a new worktree when `--branch` is omitted.
 *
 * **Example** (Derive the branch name from a worktree name)
 *
 * ```ts
 * import { defaultWorktreeBranch } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(defaultWorktreeBranch("feature-x")) // "feat/feature-x"
 * ```
 *
 * @param name - Worktree name used as the branch suffix.
 * @returns The default branch name in the form `feat/<name>`.
 * @category utilities
 * @since 0.0.0
 */
export const defaultWorktreeBranch = (name: string): string => `feat/${name}`;

/**
 * Build the `git worktree add` argument vector for a target path and branch.
 *
 * **Example** (Data-first and data-last call forms)
 *
 * ```ts
 * import { worktreeAddArgs } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(worktreeAddArgs("/repo-worktrees/feature-x", "feat/feature-x"))
 * // ["worktree", "add", "/repo-worktrees/feature-x", "-b", "feat/feature-x"]
 * console.log(worktreeAddArgs("feat/feature-x")("/repo-worktrees/feature-x").length) // 5
 * ```
 *
 * @param targetPath - Absolute path of the worktree to create.
 * @param branch - Branch to create and check out in the new worktree.
 * @returns The `git` argument vector (excluding the `git` executable).
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
 * Resolved worktree layout for the invoking repository.
 *
 * **Details**
 *
 * `currentRoot` is the checkout the command was invoked from, which is the
 * main checkout only when the operator is not already inside a worktree.
 *
 * **Example** (Construct a layout for a repository with no worktrees yet)
 *
 * ```ts
 * import { WorktreeContext } from "@beep/repo-cli/commands/Worktree"
 *
 * const context = WorktreeContext.make({
 *   currentRoot: "/repo",
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 * })
 * console.log(context.worktreesRoot) // "/repo-worktrees"
 * ```
 *
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
 * **Details**
 *
 * `reason` is present only for `skipped` outcomes; a `copied` outcome carries
 * no explanation.
 *
 * **Example** (Distinguish a copied entry from a skipped one)
 *
 * ```ts
 * import { WorktreeCopyOutcome } from "@beep/repo-cli/commands/Worktree"
 *
 * const outcome = WorktreeCopyOutcome.make({ entry: ".env", status: "copied" })
 * console.log(outcome.status) // "copied"
 *
 * const skipped = WorktreeCopyOutcome.make({
 *   entry: "CLAUDE.local.md",
 *   status: "skipped",
 *   reason: "not present in main checkout",
 * })
 * console.log(skipped.reason) // "not present in main checkout"
 * ```
 *
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
 * **Details**
 *
 * `branch` is `null` for a detached checkout. `hasEnv` and `hasNodeModules`
 * report whether bootstrap survived, so a `clean` worktree can still be
 * unusable. `unpushed` reports whether `HEAD` has commits absent from
 * `origin/main` or the branch's configured upstream.
 *
 * **Example** (Construct a healthy bootstrapped row)
 *
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
 * console.log(entry.clean) // true
 * ```
 *
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
    unpushed: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
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
 * **Details**
 *
 * `entries` covers only worktrees under the worktrees root; checkouts living
 * elsewhere are excluded. `pruneDryRun` carries the lines that
 * `git worktree prune --dry-run` would act on, so stale metadata is visible
 * without mutating it.
 *
 * **Example** (Construct a report for a fleet with no managed worktrees)
 *
 * ```ts
 * import { WorktreeDoctorReport } from "@beep/repo-cli/commands/Worktree"
 *
 * const report = WorktreeDoctorReport.make({
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 *   pruneDryRun: [],
 * })
 * console.log(report.entries.length) // 0
 * ```
 *
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
 * **Details**
 *
 * The invoking root is discovered from `startFrom` (default: `process.cwd()`).
 * The main checkout and worktrees root are derived from
 * `git worktree list --porcelain`, so the canonical
 * `<main-checkout>-worktrees` sibling directory is stable from any worktree.
 *
 * **Example** (Resolve the layout from a checkout path)
 *
 * ```ts
 * import { resolveWorktreeContext } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(resolveWorktreeContext("/repo"))) // true
 * ```
 *
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
  const porcelain = yield* runWorktreeGitCapture(
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
 * **Details**
 *
 * Creates the branch along with the worktree and returns the created path.
 *
 * **Gotchas**
 *
 * Fails with `WorktreeExistsError` when the target directory already exists,
 * rather than reusing it. Bootstrapping is a separate step; see
 * {@link copyLocalFiles} and the `worktree new` command handler.
 *
 * **Example** (Describe the worktree to create)
 *
 * ```ts
 * import { addWorktree, WorktreeContext } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 *
 * const context = WorktreeContext.make({
 *   currentRoot: "/repo",
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 * })
 * console.log(Effect.isEffect(addWorktree(context, "feature-x", "feat/feature-x"))) // true
 * ```
 *
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
 * **Details**
 *
 * Each entry in {@link WORKTREE_LOCAL_FILE_ENTRIES} is copied when present and
 * skipped otherwise; directories are copied recursively. One
 * {@link WorktreeCopyOutcome} is returned per entry, in that array's order, so
 * the caller can report copies and skips without re-probing the filesystem.
 *
 * **Example** (Bootstrap a freshly created worktree)
 *
 * ```ts
 * import { copyLocalFiles } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(copyLocalFiles("/repo", "/repo-worktrees/feature-x"))) // true
 * ```
 *
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | WorktreeRemovalService
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const removalService = yield* WorktreeRemovalService;
  const statusOutput = yield* runWorktreeGitCapture(
    entry.path,
    ["status", "--porcelain"],
    `Failed to inspect ${entry.path}.`
  );
  const changes = A.filter(Str.split(statusOutput, "\n"), Str.isNonEmpty);
  const unpushed = yield* removalService.hasUnpushedCommits(entry.path, O.fromNullishOr(entry.branch));
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
    unpushed,
    changeCount: changes.length,
    hasEnv,
    hasNodeModules,
  });
});

/**
 * Build the read-only `worktree doctor` report for a resolved context.
 *
 * **Details**
 *
 * Inspects only worktrees under the worktrees root: branch, clean/dirty status,
 * presence of bootstrap files, and prunable metadata. Nothing is mutated —
 * pruning is reported as a dry run.
 *
 * **Example** (Report on a resolved layout)
 *
 * ```ts
 * import { worktreeDoctorReportForContext, WorktreeContext } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 *
 * const context = WorktreeContext.make({
 *   currentRoot: "/repo",
 *   mainCheckout: "/repo",
 *   worktreesRoot: "/repo-worktrees",
 *   entries: [],
 * })
 * console.log(Effect.isEffect(worktreeDoctorReportForContext(context))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const worktreeDoctorReportForContext = Effect.fn("Worktree.worktreeDoctorReportForContext")(function* (
  context: WorktreeContext
): Effect.fn.Return<
  WorktreeDoctorReport,
  WorktreeCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | WorktreeRemovalService
> {
  const path = yield* Path.Path;
  const pruneOutput = yield* runWorktreeGitCapture(
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

const doctorNote = (enabled: boolean, note: string): O.Option<string> =>
  Bool.match(enabled, {
    onFalse: () => O.none(),
    onTrue: () => O.some(note),
  });

const doctorNotes = (entry: WorktreeDoctorEntry): ReadonlyArray<string> =>
  A.getSomes([
    doctorNote(entry.locked, "locked"),
    doctorNote(entry.prunable, "prunable"),
    doctorNote(!entry.hasEnv, "missing .env"),
    doctorNote(!entry.hasNodeModules, "missing node_modules"),
  ]);

const doctorBranchLabel = (entry: WorktreeDoctorEntry): string =>
  O.getOrElse(O.fromNullishOr(entry.branch), () =>
    Bool.match(entry.detached, {
      onFalse: () => "(unknown)",
      onTrue: () => "(detached)",
    })
  );

/**
 * Format one worktree doctor entry as its two human-readable output lines.
 *
 * **Details**
 *
 * Detached and unknown branches receive distinct labels. Dirty and unpushed
 * state is rendered independently, while lock, prune, and missing-bootstrap
 * notes are appended only when present.
 *
 * **Example** (Format a clean attached worktree)
 *
 * ```ts
 * import { WorktreeDoctorEntry, worktreeDoctorEntryLines } from "@beep/repo-cli/commands/Worktree"
 *
 * const lines = worktreeDoctorEntryLines(WorktreeDoctorEntry.make({
 *   path: "/repo-worktrees/feature-x",
 *   branch: "feat/feature-x",
 *   detached: false,
 *   locked: false,
 *   prunable: false,
 *   clean: true,
 *   unpushed: false,
 *   changeCount: 0,
 *   hasEnv: true,
 *   hasNodeModules: true,
 * }))
 * console.log(lines[0]) // "- /repo-worktrees/feature-x"
 * ```
 *
 * @param entry - Inspected worktree state to format.
 * @returns The path line followed by the branch, status, and notes line.
 * @category formatting
 * @since 0.0.0
 */
export const worktreeDoctorEntryLines = (entry: WorktreeDoctorEntry): ReadonlyArray<string> => {
  const branchLabel = doctorBranchLabel(entry);
  const statusLabel = Bool.match(entry.clean, {
    onFalse: () => `dirty (${entry.changeCount})`,
    onTrue: () => "clean",
  });
  const unpushedLabel = Bool.match(entry.unpushed, { onFalse: () => "no", onTrue: () => "yes" });
  const notesSuffix = A.match(doctorNotes(entry), {
    onEmpty: () => "",
    onNonEmpty: (notes) => `  notes: ${A.join(notes, ", ")}`,
  });
  return [
    `- ${entry.path}`,
    `    branch: ${branchLabel}  status: ${statusLabel}  unpushed: ${unpushedLabel}${notesSuffix}`,
  ];
};

const renderDoctorReport = Effect.fn("Worktree.renderDoctorReport")(function* (report: WorktreeDoctorReport) {
  yield* Console.log(`Main checkout:  ${report.mainCheckout}`);
  yield* Console.log(`Worktrees root: ${report.worktreesRoot}`);
  if (report.entries.length === 0) {
    yield* Console.log("No managed worktrees found under the worktrees root.");
  }
  for (const entry of report.entries) {
    for (const line of worktreeDoctorEntryLines(entry)) {
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

const renderRemovalReceipt = Effect.fn("Worktree.renderRemovalReceipt")(function* (
  receipt: WorktreeRemovalReceipt,
  archive: boolean
) {
  if (!archive) {
    yield* Console.log(`Removed worktree ${receipt.targetPath}`);
    yield* Console.log(
      O.match(receipt.branch, {
        onNone: () => "Branch retained; delete it manually when ready.",
        onSome: (branch) => `Branch retained. Delete it when ready:\n  ${branchDeleteCommand(branch)}`,
      })
    );
    return;
  }

  yield* Console.log("");
  yield* Console.log(`Worktree retirement complete: ${receipt.targetPath}`);
  yield* Console.log(`  reason: ${receipt.reason}`);
  yield* O.match(receipt.manifest, {
    onNone: Effect.fn("Worktree.renderCleanRemovalReceipt")(function* () {
      yield* Console.log("  archived: no residue needed (clean with no unpushed commits)");
    }),
    onSome: Effect.fn("Worktree.renderArchivedRemovalReceipt")(function* (manifest) {
      yield* Console.log(`  archive ref: ${manifest.archiveRef}`);
      yield* Console.log(`  repository hash: ${manifest.repositoryHash}`);
      yield* Console.log(`  tracked patch: ${O.getOrElse(manifest.patchPath, () => "(none)")}`);
      yield* Console.log(`  untracked files: ${manifest.untrackedFiles.length}`);
      yield* Console.log(`  residue root: ${manifest.residueRoot}`);
      yield* Console.log(`  manifest: ${manifest.residueRoot}/manifest.json`);
      yield* Console.log("  restore:");
      yield* Console.log(`    git worktree add <restore-path> ${manifest.archiveRef}`);
      if (O.isSome(manifest.patchPath)) {
        yield* Console.log(`    git -C <restore-path> apply ${manifest.patchPath.value}`);
      }
      if (manifest.untrackedFiles.length > 0) {
        yield* Console.log(`    copy ${manifest.residueRoot}/untracked/ contents back into <restore-path>`);
      }
    }),
  });
  yield* Console.log(`  removed: ${receipt.targetPath}`);
  if (receipt.branchDeleted) {
    yield* Console.log(`  branch deleted: ${O.getOrElse(receipt.branch, () => "(detached HEAD)")}`);
    return;
  }
  yield* Console.log(
    O.match(receipt.branch, {
      onNone: () => "  branch: detached HEAD (no branch to delete)",
      onSome: (branch) => `  branch retained. Delete it when ready:\n    ${branchDeleteCommand(branch)}`,
    })
  );
});

/**
 * Write a completed worktree-removal receipt to the Effect console.
 *
 * **Details**
 *
 * Archive receipts include restoration instructions only for residue that was
 * actually preserved. Non-archive receipts retain the shorter legacy output.
 *
 * **Example** (Build clean archive output)
 *
 * ```ts
 * import { renderWorktreeRemovalReceipt, WorktreeRemovalReceipt } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const receipt = WorktreeRemovalReceipt.make({
 *   targetPath: "/repo-worktrees/feature-x",
 *   branch: O.some("feat/feature-x"),
 *   reason: "clean",
 *   manifest: O.none(),
 *   branchDeleted: false,
 * })
 * console.log(Effect.isEffect(renderWorktreeRemovalReceipt(receipt, true))) // true
 * ```
 *
 * @param receipt - Completed removal result to render.
 * @param archive - Whether the command ran in archive-retirement mode.
 * @category formatting
 * @since 0.0.0
 */
export const renderWorktreeRemovalReceipt: {
  (archive: boolean): (receipt: WorktreeRemovalReceipt) => Effect.Effect<void>;
  (receipt: WorktreeRemovalReceipt, archive: boolean): Effect.Effect<void>;
} = dual(2, renderRemovalReceipt);

const runWorktreeRemove = Effect.fn("Worktree.runWorktreeRemove")(function* (options: {
  readonly name: string;
  readonly archive: boolean;
  readonly deleteBranch: boolean;
}): Effect.fn.Return<
  void,
  WorktreeCommandError | WorktreeDirtyError | WorktreePreservationError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | WorktreeRemovalService
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const removalService = yield* WorktreeRemovalService;
  const context = yield* resolveWorktreeContext();
  const name = yield* decodeWorktreeName(options.name).pipe(
    Effect.mapError(WorktreeCommandError.new("Worktree name must be non-empty and contain no surrounding whitespace."))
  );
  const targetPath = path.join(context.worktreesRoot, name);
  const exists = yield* fs.exists(targetPath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return yield* WorktreeCommandError.make({
      message: `No worktree found at ${targetPath}.`,
      path: targetPath,
    });
  }
  const removed = A.findFirst(context.entries, (entry) => entry.path === targetPath);
  const branch = O.flatMap(removed, (entry) => O.fromNullishOr(entry.branch));
  const receipt = yield* removalService.remove(
    WorktreeRemovalRequest.make({
      name,
      targetPath,
      mainCheckout: context.mainCheckout,
      branch,
      archive: options.archive,
      deleteBranch: options.deleteBranch,
    })
  );
  yield* renderWorktreeRemovalReceipt(receipt, options.archive);
});

const runWorktreeDoctor = Effect.fn("Worktree.runWorktreeDoctor")(function* (): Effect.fn.Return<
  void,
  WorktreeCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | WorktreeRemovalService
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
    archive: Flag.boolean("archive").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Preserve dirty files and unpushed commits before removing the worktree")
    ),
    deleteBranch: Flag.boolean("delete-branch").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Delete the local branch after archive retirement (requires --archive)")
    ),
  },
  Effect.fn(function* ({ name, archive, deleteBranch }) {
    yield* runWorktreeRemove({ name, archive, deleteBranch }).pipe(
      Effect.catchTags({
        WorktreeCommandError: Effect.fn(function* (error) {
          yield* Console.error(`worktree remove: ${error.message}`);
          return yield* failWithReportedExit(`worktree remove: ${error.message}`);
        }),
        WorktreeDirtyError: Effect.fn(function* (error) {
          yield* Console.error(`worktree remove: ${error.message}`);
          return yield* failWithReportedExit(`worktree remove: ${error.message}`);
        }),
        WorktreePreservationError: Effect.fn(function* (error) {
          yield* Console.error(`worktree remove: ${error.message}`);
          return yield* failWithReportedExit(`worktree remove: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription("Remove a sibling worktree, optionally preserving dirty or unpushed residue first"),
  Command.provide(WorktreeRemovalServiceLive)
);

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
    "Inspect managed worktrees: branch, clean/dirty and unpushed status, bootstrap files, and prunable metadata"
  ),
  Command.provide(WorktreeRemovalServiceLive)
);

/**
 * Worktree command group.
 *
 * **Details**
 *
 * Bare `worktree` prints the subcommand menu; the work lives in the `new`,
 * `remove`, `doctor`, and `fleet` subcommands.
 *
 * **Example** (Build the CLI program for the group)
 *
 * ```ts
 * import { worktreeCommand } from "@beep/repo-cli/commands/Worktree"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(worktreeCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const worktreeCommand = Command.make("worktree", {}, () =>
  Console.log(
    [
      "Worktree commands:",
      "- bun run beep worktree new <name> [--branch <branch>]",
      "- bun run beep worktree remove <name> [--archive] [--delete-branch]",
      "- bun run beep worktree doctor",
      "- bun run beep worktree fleet [--json]",
    ].join("\n")
  )
).pipe(
  Command.withDescription("Manage sibling git worktrees under the canonical worktrees root"),
  Command.withSubcommands([worktreeNewCommand, worktreeRemoveCommand, worktreeDoctorCommand, worktreeFleetCommand])
);
