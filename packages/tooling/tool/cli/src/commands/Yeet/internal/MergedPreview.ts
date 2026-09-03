/**
 * The merge-preview tree `yeet verify --merged` proves against.
 *
 * Hosted `check.yml` is `on: pull_request` with `actions/checkout@v4` and no
 * `ref:` override, so every hosted lane runs on `refs/pull/N/merge` — this
 * branch merged into the *current* base. A local `yeet verify` proves the
 * worktree's own HEAD. Those are different trees whenever the base has moved,
 * and the stale-base guard cannot close the gap: it fires on textual path
 * overlap, so a semantic conflict (this branch edits A, the base edits B, and a
 * repo-level invariant couples A to B) yields an empty overlap, merges cleanly,
 * and passes every local gate while failing hosted.
 *
 * **Details**
 *
 * A clean merge proves nothing here — both known instances of this class were
 * conflict-free merges. The only proof is to *materialize* the merged tree and
 * re-run the gates on it, which is what this module builds: `merge-tree` writes
 * the merge result into the object store, `commit-tree` gives it a commit, and a
 * detached worktree makes it a directory the ordinary proof can run in.
 *
 * The merged tree is never checked out over the operator's worktree and never
 * touches the index or HEAD. Everything happens in a throwaway worktree under
 * the ignored packet directory, so an interrupted run leaves at worst a stale
 * directory that the next acquire prunes.
 *
 * **Gotchas**
 *
 * The preview worktree is a fresh checkout with no `node_modules`, so the
 * caller installs into it before running any lane. Symlinking the primary
 * worktree's modules instead would be faster and wrong: Bun's workspace links
 * point at package directories in the *primary* worktree, so the proof would
 * read the unmerged sources and report a green that means nothing — the exact
 * false-green class this tier exists to close.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, Effect, Match, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { RepoRunContext, runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { artifactDirForContext } from "./ArtifactPaths.ts";
import { runGitOutput } from "./GitExec.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Yeet/internal/MergedPreview");

/**
 * Packet-relative directory the merge-preview worktree is checked out into.
 *
 * **Details**
 *
 * Lives under the yeet packet directory because `.beep/*` is git-ignored
 * repo-wide, so a full second checkout there is invisible to the primary
 * worktree's status, diffs, and staged-path collection.
 *
 * **Example** (Read the preview directory name)
 *
 * ```ts
 * import { YEET_MERGED_PREVIEW_DIR_NAME } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MERGED_PREVIEW_DIR_NAME)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const YEET_MERGED_PREVIEW_DIR_NAME = `merged-preview-${process.pid}`;

/**
 * Conventional commit subject used for the synthetic merged-preview commit.
 *
 * **Details**
 *
 * The preview commit is checked by the same commitlint lane as ordinary
 * commits. Keep the subject independent of branch and base names so arbitrary
 * ref lengths cannot violate the repository's header limit.
 *
 * **Example** (Read the preview commit subject)
 *
 * ```ts
 * import { YEET_MERGED_PREVIEW_COMMIT_MESSAGE } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MERGED_PREVIEW_COMMIT_MESSAGE)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const YEET_MERGED_PREVIEW_COMMIT_MESSAGE = "chore(yeet): verify merged preview";

/**
 * A merge preview whose tree merged cleanly.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMergeTreeMerged extends S.Class<YeetMergeTreeMerged>($I`YeetMergeTreeMerged`)(
  {
    status: S.tag("merged"),
    treeSha: S.NonEmptyString,
  },
  $I.annote("YeetMergeTreeMerged", {
    description: "A merge preview whose tree merged cleanly, identified by the written tree object.",
  })
) {}

/**
 * A merge preview that conflicts, with the paths that could not be merged.
 *
 * **Details**
 *
 * `paths` comes from the conflicted-file-info block rather than the human
 * messages, because that block is machine-shaped and stable while the messages
 * are prose that varies by conflict kind.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMergeTreeConflicted extends S.Class<YeetMergeTreeConflicted>($I`YeetMergeTreeConflicted`)(
  {
    status: S.tag("conflicted"),
    paths: S.Array(S.String),
    messages: S.Array(S.String),
  },
  $I.annote("YeetMergeTreeConflicted", {
    description: "A merge preview that conflicts, carrying the conflicted paths and git's own messages.",
  })
) {}

/**
 * A merge preview git refused to attempt at all.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMergeTreeUnavailable extends S.Class<YeetMergeTreeUnavailable>($I`YeetMergeTreeUnavailable`)(
  {
    status: S.tag("unavailable"),
    detail: S.String,
  },
  $I.annote("YeetMergeTreeUnavailable", {
    description: "A merge preview git refused to compute, carrying the reported detail.",
  })
) {}

/**
 * What `git merge-tree --write-tree` reported about the merge preview.
 *
 * **Example** (Decode a conflicted outcome)
 *
 * ```ts
 * import { YeetMergeTreeResult } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(YeetMergeTreeResult)({
 *   status: "conflicted",
 *   paths: ["goals/INDEX.md"],
 *   messages: ["CONFLICT (content): Merge conflict in goals/INDEX.md"],
 * })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMergeTreeResult = S.Union([
  YeetMergeTreeMerged,
  YeetMergeTreeConflicted,
  YeetMergeTreeUnavailable,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("YeetMergeTreeResult", {
    description: "Outcome of computing the merge preview tree for yeet verify --merged.",
  })
);

/**
 * What `git merge-tree --write-tree` reported about the merge preview.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMergeTreeResult = typeof YeetMergeTreeResult.Type;

const OBJECT_ID_PATTERN = /^[0-9a-f]{40,64}$/u;
const CONFLICT_FILE_INFO_PATTERN = /^\d{6} [0-9a-f]{40,64} [123]\t(.+)$/u;
const CONFLICT_MESSAGE_PATTERN = /^(?:CONFLICT|warning: )/u;

const outputLines = (output: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/u)(output), A.map(Str.trim), A.filter(Str.isNonEmpty));

/**
 * Pull a git object id out of a capture that may also carry git's diagnostics.
 *
 * **Details**
 *
 * Yeet captures git with stdout and stderr merged, and git writes advisory
 * lines to stderr freely — `git commit-tree` emits
 * `error: duplicate parent ... ignored` and still succeeds, which is the
 * ordinary shape when a branch sits exactly at its base. Trimming the whole
 * capture would hand that prose back as an object id.
 *
 * **Example** (Read the id past a diagnostic line)
 *
 * ```ts
 * import { gitObjectIdFromOutput } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(gitObjectIdFromOutput("error: duplicate parent ignored\n4b825dc642cb6eb9a060e54bf8d69288fbee4904"))
 * ```
 *
 * @param output - Combined stdout and stderr of one git invocation.
 * @returns The first object id on its own line, or `None` when there is none.
 * @category parsing
 * @since 0.0.0
 */
export const gitObjectIdFromOutput = (output: string): O.Option<string> =>
  A.findFirst(outputLines(output), (line) => OBJECT_ID_PATTERN.test(line));

/**
 * Read `git merge-tree --write-tree` output into a merge-preview outcome.
 *
 * **Details**
 *
 * The command prints the written tree object on its first line, then — when the
 * merge conflicts — a conflicted-file-info block whose lines carry a mode, an
 * object id, and a merge stage, tab-separated from the path, then git's own
 * messages. Exit code 0 means merged, 1 means
 * conflicts, and anything else means git declined to compute the merge at all.
 * Both facts are read: an exit code without output cannot name the conflicted
 * paths, and output without the exit code cannot distinguish "no conflicts"
 * from "refused".
 *
 * **Gotchas**
 *
 * The same path appears up to three times in the conflicted-file block, once
 * per merge stage, so paths are deduplicated. Stages are an implementation
 * detail of git's index, not three separate conflicts.
 *
 * **Example** (Read a clean merge)
 *
 * ```ts
 * import { parseYeetMergeTreeResult } from "@beep/repo-cli/test/Yeet"
 *
 * const result = parseYeetMergeTreeResult(0, "4b825dc642cb6eb9a060e54bf8d69288fbee4904\n")
 * console.log(result.status)
 * ```
 *
 * @param exitCode - Exit status reported by `git merge-tree --write-tree`.
 * @param output - Combined stdout and stderr of the same invocation.
 * @returns The merged tree, the conflicted paths, or the refusal detail.
 * @category parsing
 * @since 0.0.0
 */
export const parseYeetMergeTreeResult: {
  (output: string): (exitCode: number) => YeetMergeTreeResult;
  (exitCode: number, output: string): YeetMergeTreeResult;
} = dual(2, (exitCode: number, output: string): YeetMergeTreeResult => {
  const lines = outputLines(output);
  if (exitCode !== 0 && exitCode !== 1) {
    return YeetMergeTreeUnavailable.make({
      detail: Str.isNonEmpty(Str.trim(output)) ? Str.trim(output) : `git merge-tree exited ${exitCode}`,
    });
  }

  if (exitCode === 0) {
    return O.match(gitObjectIdFromOutput(output), {
      onNone: () => YeetMergeTreeUnavailable.make({ detail: "git merge-tree printed no tree object" }),
      onSome: (value) => YeetMergeTreeMerged.make({ treeSha: value }),
    });
  }

  return YeetMergeTreeConflicted.make({
    paths: pipe(
      lines,
      A.map((line) =>
        pipe(
          O.fromNullishOr(CONFLICT_FILE_INFO_PATTERN.exec(line)),
          O.flatMap((match) => O.fromUndefinedOr(match[1]))
        )
      ),
      A.getSomes,
      A.dedupe
    ),
    messages: A.filter(lines, (line) => CONFLICT_MESSAGE_PATTERN.test(line)),
  });
});

/**
 * Render the operator-facing refusal for a conflicting merge preview.
 *
 * **Details**
 *
 * The remediation names a real merge rather than a rebase: the preview proves
 * what hosted CI will run, and hosted CI merges. Telling an operator to rebase
 * here would ask them to rewrite pushed history to fix a merge that has not
 * happened yet.
 *
 * **Example** (Render a conflict refusal)
 *
 * ```ts
 * import { renderYeetMergePreviewConflict, YeetMergeTreeConflicted } from "@beep/repo-cli/test/Yeet"
 *
 * const conflict = YeetMergeTreeConflicted.make({ paths: ["goals/INDEX.md"], messages: [] })
 * console.log(renderYeetMergePreviewConflict("origin/main", conflict))
 * ```
 *
 * @param baseRef - Base ref the branch was merged with.
 * @param conflict - The conflicted merge-preview outcome.
 * @returns A multi-line refusal naming every conflicted path.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMergePreviewConflict: {
  (conflict: YeetMergeTreeConflicted): (baseRef: string) => string;
  (baseRef: string, conflict: YeetMergeTreeConflicted): string;
} = dual(2, (baseRef: string, conflict: YeetMergeTreeConflicted): string =>
  A.join(
    [
      `yeet verify --merged cannot build the merge preview: HEAD conflicts with ${baseRef}.`,
      "Hosted CI proves refs/pull/N/merge, so this conflict blocks hosted lanes too.",
      ...A.map(conflict.paths, (path) => `  conflicted: ${path}`),
      ...A.map(conflict.messages, (message) => `  ${message}`),
      `Resolve it locally with: git fetch origin && git merge ${baseRef}, then re-run yeet verify --merged.`,
    ],
    "\n"
  )
);

/**
 * A materialized merge preview: the merged commit and the worktree holding it.
 *
 * **Example** (Describe a materialized preview)
 *
 * ```ts
 * import { YeetMergePreview } from "@beep/repo-cli/test/Yeet"
 *
 * const preview = YeetMergePreview.make({
 *   baseRef: "origin/main",
 *   baseSha: "1111111111111111111111111111111111111111",
 *   commitSha: "3333333333333333333333333333333333333333",
 *   headSha: "2222222222222222222222222222222222222222",
 *   treeSha: "4444444444444444444444444444444444444444",
 *   worktreePath: "/repo/.beep/yeet/merged-preview",
 * })
 * console.log(preview.worktreePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMergePreview extends S.Class<YeetMergePreview>($I`YeetMergePreview`)(
  {
    baseRef: S.String,
    baseSha: S.NonEmptyString,
    commitSha: S.NonEmptyString,
    headSha: S.NonEmptyString,
    treeSha: S.NonEmptyString,
    worktreePath: S.NonEmptyString,
  },
  $I.annote("YeetMergePreview", {
    description: "A materialized merge preview of HEAD and the base ref, checked out in a throwaway worktree.",
  })
) {}

/**
 * Derive the run context that proves the merge preview instead of HEAD.
 *
 * **Details**
 *
 * Only the tree the proof executes against moves. `branch` is preserved so
 * artifacts keep landing under the same run id, and `packetDir` is resolved to
 * an absolute path in the *primary* worktree so failure artifacts outlive the
 * preview directory — which is removed as soon as the proof finishes.
 *
 * **Gotchas**
 *
 * `head` becomes the merge commit rather than the branch head. Any step that
 * diffs `base...head` therefore sees the merged range, which is the point: that
 * is the range hosted CI's affected-lane selection sees.
 *
 * `absolutePacketDir` must already be resolved against the *primary* worktree.
 * Passing a relative packet dir would send every artifact into the preview,
 * which is deleted the moment the proof finishes — losing precisely the issue
 * artifacts a failing merged proof exists to produce.
 *
 * **Example** (Point a context at the preview)
 *
 * ```ts
 * import { RepoRunContext } from "@beep/repo-cli/internal/repo-run"
 * import { YeetMergePreview, yeetMergedPreviewContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/widgets",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const preview = YeetMergePreview.make({
 *   baseRef: "origin/main",
 *   baseSha: "1111111111111111111111111111111111111111",
 *   commitSha: "3333333333333333333333333333333333333333",
 *   headSha: "2222222222222222222222222222222222222222",
 *   treeSha: "4444444444444444444444444444444444444444",
 *   worktreePath: "/repo/.beep/yeet/merged-preview",
 * })
 * console.log(yeetMergedPreviewContext(context, preview, "/repo/.beep/yeet").repoRoot)
 * ```
 *
 * @param context - The primary worktree's run context.
 * @param preview - The materialized merge preview.
 * @param absolutePacketDir - Artifact directory in the primary worktree.
 * @returns A context whose commands run inside the preview worktree.
 * @category constructors
 * @since 0.0.0
 */
export const yeetMergedPreviewContext: {
  (preview: YeetMergePreview, absolutePacketDir: string): (context: RepoRunContext) => RepoRunContext;
  (context: RepoRunContext, preview: YeetMergePreview, absolutePacketDir: string): RepoRunContext;
} = dual(
  3,
  (context: RepoRunContext, preview: YeetMergePreview, absolutePacketDir: string): RepoRunContext =>
    RepoRunContext.make({
      ...context,
      cwd: preview.worktreePath,
      head: preview.commitSha,
      packetDir: absolutePacketDir,
      repoRoot: preview.worktreePath,
    })
);

const gitCapture = Effect.fn("Yeet.mergedPreviewGitCapture")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<
  { readonly exitCode: number; readonly output: string },
  never,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const result = yield* runRepoCommandCapture("git", args, repoRoot).pipe(
    Effect.orElseSucceed(() => ({ exitCode: 128, output: "git could not be executed", truncated: false }))
  );
  return { exitCode: result.exitCode, output: result.output };
});

/**
 * Resolve the absolute preview worktree path for a run context.
 *
 * @param context - Run context whose packet directory hosts the preview.
 * @returns Absolute path the preview worktree is checked out into.
 * @category constructors
 * @since 0.0.0
 */
export const yeetMergedPreviewPath = Effect.fn("Yeet.yeetMergedPreviewPath")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, YEET_MERGED_PREVIEW_DIR_NAME);
});

const removeMergePreviewWorktree = Effect.fn("Yeet.removeMergePreviewWorktree")(function* (
  context: RepoRunContext,
  worktreePath: string
): Effect.fn.Return<void, never, ChildProcessSpawner.ChildProcessSpawner> {
  yield* gitCapture(context.repoRoot, ["worktree", "remove", "--force", worktreePath]);
  yield* gitCapture(context.repoRoot, ["worktree", "prune"]);
});

/**
 * Materialize the merge of HEAD into the base ref as a detached worktree.
 *
 * **Details**
 *
 * Mirrors what GitHub does for `refs/pull/N/merge`: the base is the first
 * parent and this branch is the second, so the merged commit has the same shape
 * hosted lanes check out. `merge-tree --write-tree` performs the merge entirely
 * in the object database, so the operator's index and HEAD are never touched.
 *
 * **Gotchas**
 *
 * Any leftover preview from an interrupted run is removed before the new one is
 * created, so this never fails with "directory already exists" and never proves
 * a previous run's tree.
 *
 * **Example** (Materialize a preview through the test seam)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { createYeetMergePreview, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/widgets",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const created = createYeetMergePreview(context).pipe(Effect.map((preview) => preview.commitSha))
 * ```
 *
 * @param context - The primary worktree's run context.
 * @returns The materialized preview, or a failure naming the conflicts.
 * @category constructors
 * @since 0.0.0
 */
export const createYeetMergePreview = Effect.fn("Yeet.createYeetMergePreview")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetMergePreview, YeetCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const worktreePath = yield* yeetMergedPreviewPath(context);
  const headSha = yield* runGitOutput(context.repoRoot, ["rev-parse", context.head]).pipe(Effect.map(Str.trim));
  const baseSha = yield* runGitOutput(context.repoRoot, ["rev-parse", context.base]).pipe(
    Effect.map(Str.trim),
    Effect.mapError(
      YeetCommandError.new(
        `yeet verify --merged could not resolve ${context.base}. Run git fetch origin first so the base ref exists locally.`
      )
    )
  );

  const merge = yield* gitCapture(context.repoRoot, ["merge-tree", "--write-tree", baseSha, headSha]);
  const treeSha = yield* Match.value(parseYeetMergeTreeResult(merge.exitCode, merge.output)).pipe(
    Match.discriminatorsExhaustive("status")({
      merged: (value) => Effect.succeed(value.treeSha),
      conflicted: (value) =>
        Effect.fail(
          YeetCommandError.make({
            message: renderYeetMergePreviewConflict(context.base, value),
            command: `git merge-tree --write-tree ${context.base} ${context.head}`,
            exitCode: 1,
          })
        ),
      unavailable: (value) =>
        Effect.fail(
          YeetCommandError.make({
            message: `yeet verify --merged could not compute the merge preview: ${value.detail}`,
            command: `git merge-tree --write-tree ${context.base} ${context.head}`,
            exitCode: 1,
          })
        ),
    })
  );

  const parents = baseSha === headSha ? ["-p", baseSha] : ["-p", baseSha, "-p", headSha];
  const committed = yield* gitCapture(context.repoRoot, [
    "commit-tree",
    treeSha,
    ...parents,
    "-m",
    YEET_MERGED_PREVIEW_COMMIT_MESSAGE,
  ]);
  const commitSha = yield* Effect.fromOption(gitObjectIdFromOutput(committed.output), () =>
    YeetCommandError.make({
      message: `yeet verify --merged could not commit the merge preview tree:\n${committed.output}`,
      command: `git commit-tree ${treeSha}`,
      exitCode: committed.exitCode === 0 ? 1 : committed.exitCode,
    })
  );

  yield* removeMergePreviewWorktree(context, worktreePath);
  const added = yield* gitCapture(context.repoRoot, ["worktree", "add", "--detach", worktreePath, commitSha]);
  if (added.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `yeet verify --merged could not check out the merge preview worktree:\n${added.output}`,
      command: `git worktree add --detach ${worktreePath} ${commitSha}`,
      exitCode: added.exitCode,
    });
  }

  return YeetMergePreview.make({ baseRef: context.base, baseSha, commitSha, headSha, treeSha, worktreePath });
});

/**
 * Install dependencies into the merge-preview worktree.
 *
 * **Details**
 *
 * `--frozen-lockfile` on purpose: the preview carries the *merged* lockfile, so
 * an install that silently resolves around it would hide exactly the dependency
 * conflict this tier exists to surface. A refusal here is a finding, not a
 * setup problem.
 *
 * **Example** (Install into a preview through the test seam)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { installYeetMergePreview, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/widgets",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const installed = installYeetMergePreview(context, "/repo/.beep/yeet/merged-preview").pipe(Effect.asVoid)
 * ```
 *
 * @param context - The primary worktree's run context, used for reporting.
 * @param worktreePath - Absolute path of the preview worktree.
 * @returns An Effect that completes once the preview can run repo lanes.
 * @category use-cases
 * @since 0.0.0
 */
export const installYeetMergePreview = Effect.fn("Yeet.installYeetMergePreview")(function* (
  context: RepoRunContext,
  worktreePath: string
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(`[yeet] installing dependencies into the merge preview at ${worktreePath}`);
  const result = yield* runRepoCommandCapture("bun", ["install", "--frozen-lockfile"], worktreePath).pipe(
    Effect.mapError(YeetCommandError.new("yeet verify --merged could not run bun install in the merge preview."))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `yeet verify --merged could not install the merged lockfile. The merge of ${context.base} produced a lockfile bun refuses:\n${result.output}`,
      command: "bun install --frozen-lockfile",
      exitCode: result.exitCode,
    });
  }
});

/**
 * Run an effect against a materialized merge preview, then remove it.
 *
 * **When to use**
 *
 * Use as the single entry point for the `--merged` tier. It owns the whole
 * lifecycle, so no caller can leak a preview worktree by failing early.
 *
 * **Gotchas**
 *
 * Removal runs uninterruptibly on every exit path, including an operator
 * interrupt, because a leaked preview is a full second checkout inside the
 * packet directory.
 *
 * **Example** (Use a preview through the test seam)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, withYeetMergePreview } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/widgets",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const used = withYeetMergePreview(context, (preview) => Effect.succeed(preview.commitSha))
 * ```
 *
 * @param context - The primary worktree's run context.
 * @param use - Work to run against the derived preview.
 * @returns The result of `use`, after the preview worktree is removed.
 * @category use-cases
 * @since 0.0.0
 */
export const withYeetMergePreview: {
  <A, E, R>(
    use: (preview: YeetMergePreview) => Effect.Effect<A, E, R>
  ): (
    context: RepoRunContext
  ) => Effect.Effect<A, E | YeetCommandError, R | Path.Path | ChildProcessSpawner.ChildProcessSpawner>;
  <A, E, R>(
    context: RepoRunContext,
    use: (preview: YeetMergePreview) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | YeetCommandError, R | Path.Path | ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  <A, E, R>(
    context: RepoRunContext,
    use: (preview: YeetMergePreview) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | YeetCommandError, R | Path.Path | ChildProcessSpawner.ChildProcessSpawner> =>
    Effect.acquireUseRelease(createYeetMergePreview(context), use, (preview) =>
      removeMergePreviewWorktree(context, preview.worktreePath)
    )
);
