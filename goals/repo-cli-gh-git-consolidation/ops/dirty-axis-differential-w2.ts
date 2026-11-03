/**
 * W2 differential: the dirty-axis, name-status and one-liner git reads on `@beep/git` against the hand-rolled
 * bodies they replace.
 *
 * W2 of `goals/repo-cli-gh-git-consolidation` moves the G7 dirty-axis readers onto the kit members that carry the
 * `diffFilter` / `noRenames` / `pathspec` / `status` options: `internal/repo-run/ChangedFiles.ts`
 * (`collectDirtyWorktreeFiles` -> `Git.unstagedChanges` / `stagedChanges` / `untrackedFiles`, `collectChangedFiles`
 * and the new `collectBaseRangeChangedFiles` -> `Git.changedFiles`), Yeet's `lockfileChangedSinceBase`
 * (`changedFiles` with a `bun.lock` pathspec), the `status` probes of `ResidueReap.ts`, `TmpfsReap.ts` and
 * `Fleet.service.ts`, the `worktree list` readers of the Worktree group (`Git.worktreeList` mapped by
 * `worktreeListEntriesFromGit`), Fleet's `remote get-url` / `rev-parse --git-common-dir`, and the per-group
 * one-liners of `Ci/CiLane.ts`, `Quality/ChangesetStatus.ts`, `Codex/Security.command.ts`,
 * `Session/SessionLedger.service.ts` and the `rev-parse HEAD` readers (`PackageVerify`, `CoverageRegression`,
 * `CoverageArtifacts`, `Runners`). The Knowledge path-removal log (#110) stays on the capture: `Git.log` takes no
 * starting ref and `pathRemovalsLive` logs from the tree commit, so it is not exercised here (SPEC D-10).
 *
 * Each pre-W2 body is frozen below as `old*` (from main 6dd9b92e2f), running the same git argv through the capture it
 * used; the two retired parsers (`parseStatusPorcelainZ`, `parseWorktreePorcelain`) are copied verbatim. Every
 * scenario builds a real scratch repository, runs the old body and the shipped reader on the same state, and compares
 * the normalized outcomes: a success is its value, a failure is its error tag and exit code where it carries one.
 * Error text is deliberately NOT compared: every migrated site renders the kit's argv in its message where it used
 * to render the frozen argv, and that shift is recorded in SPEC D-10, not re-derived here. A difference is either
 * classified (an intended divergence named in D-10 with a witness scenario) or unclassified; the gate is zero
 * unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/dirty-axis-differential-w2.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";
import { sessionCheckoutFacts } from "../../../packages/tooling/tool/cli/src/commands/Session/SessionLedger.service.ts";
import {
  WorktreeListEntry,
  worktreeListEntriesFromGit,
} from "../../../packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts";
import { lockfileChangedSinceBase } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts";
import {
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
} from "../../../packages/tooling/tool/cli/src/internal/process/StepExec.ts";
import {
  collectBaseRangeChangedFiles,
  collectChangedFiles,
  collectDirtyWorktreeFiles,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/ChangedFiles.ts";
import {
  adaptGitKitError,
  runGitOutput,
  runGitPathList,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import { RepoRunContext } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type { GitCommandErrorAdapter } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

/** Everything either body may need: the frozen captures' spawner and crypto, the shipped readers' `Git`. */
type Services = Git | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Path.Path;

// --- pre-W2 bodies (frozen, behaviour-for-behaviour, from 6dd9b92e2f) -------------------------------------------

// ChangedFiles.runGitLines, verbatim: a line capture normalized to trimmed forward-slash paths.
const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);
const normalizedFilePath = (value: string): string => normalizeSlashes(Str.trim(value));
const isNonEmptyLine = (value: string): boolean => Str.isNonEmpty(Str.trim(value));
const oldRunGitLines = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runCaptured({ command: "git", args, cwd, source: "stdout" });
  if (result.exitCode !== 0) {
    return yield* Effect.fail({ _tag: "DomainError" as const, exitCode: result.exitCode });
  }
  return pipe(Str.split(/\r?\n/)(result.output), A.map(normalizedFilePath), A.filter(isNonEmptyLine));
});
const oldPathspecArgs = A.match({
  onEmpty: A.empty<string>,
  onNonEmpty: (pathspecs: A.NonEmptyReadonlyArray<string>): ReadonlyArray<string> => ["--", ...pathspecs],
});
const oldDirtyProbes = (diffArgs: ReadonlyArray<string>, pathspecs: ReadonlyArray<string>) => {
  const pathspec = oldPathspecArgs(pathspecs);
  return [
    ["diff", "--name-only", ...diffArgs, "HEAD", ...pathspec],
    ["diff", "--cached", "--name-only", ...diffArgs, ...pathspec],
    ["ls-files", "--others", "--exclude-standard", ...pathspec],
  ];
};
const oldCollectDirtyWorktreeFiles = Effect.fnUntraced(function* (
  cwd: string,
  options: {
    readonly diffArgs: ReadonlyArray<string>;
    readonly pathspecs: ReadonlyArray<string>;
    readonly onProbeFailure: "fail" | "ignore";
  }
) {
  const probed = yield* Effect.forEach(
    oldDirtyProbes(options.diffArgs, options.pathspecs),
    (args) =>
      oldRunGitLines(cwd, args).pipe(
        Effect.mapError(() => ({ _tag: "DomainError" as const })),
        Effect.catch((error) =>
          options.onProbeFailure === "ignore" ? Effect.succeed(A.empty<string>()) : Effect.fail(error)
        )
      ),
    { concurrency: "unbounded" }
  );
  return A.flatten(probed);
});
const oldCollectChangedFiles = Effect.fnUntraced(function* (cwd: string, base: string, head: string) {
  const baseChanged = yield* oldRunGitLines(cwd, ["diff", "--no-renames", "--name-only", `${base}...${head}`]).pipe(
    Effect.mapError(() => ({ _tag: "DomainError" as const }))
  );
  const workingTreeChanged = yield* oldCollectDirtyWorktreeFiles(cwd, {
    diffArgs: ["--no-renames"],
    pathspecs: A.empty(),
    onProbeFailure: "fail",
  });
  return pipe([...baseChanged, ...workingTreeChanged], A.dedupe, A.sort(Order.String));
});
// Docgen/internal/quality/Quality.scope.ts REPO_BASE_CHANGED_FILE_COMMAND, verbatim.
const oldDocgenBaseRange = (cwd: string) =>
  oldRunGitLines(cwd, ["diff", "--name-only", "--diff-filter=ACMR", "origin/main...HEAD", "--", "*.ts", "*.tsx"]).pipe(
    Effect.mapError(() => ({ _tag: "DomainError" as const }))
  );

// Yeet/internal/GitExec.ts lockfileChangedSinceBase, verbatim (its adapter is the Yeet one; the fold is tolerant).
const yeetAdapter: GitCommandErrorAdapter<{ readonly _tag: "YeetCommandError" }> = {
  onSpawnFailure: () => () => ({ _tag: "YeetCommandError" }),
  onNonZeroExit: () => ({ _tag: "YeetCommandError" }),
  onTruncated: O.some(() => ({ _tag: "YeetCommandError" })),
};
const oldLockfileChanged = (cwd: string, base: string, head: string) =>
  runGitPathList(cwd, ["diff", "--name-only", "-z", `${base}...${head}`, "--", "bun.lock"], yeetAdapter).pipe(
    Effect.orElseSucceed(A.empty<string>),
    Effect.map(A.isReadonlyArrayNonEmpty)
  );

// commands/Worktree/internal/ResidueReap.ts gitCleanSkip, verbatim.
const oldGitCleanSkip = Effect.fnUntraced(function* (gitMarkers: ReadonlyArray<string>) {
  const readings = yield* Effect.forEach(
    gitMarkers,
    (marker) =>
      runRepoCommandCapture(
        "git",
        ["--no-optional-locks", "status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"],
        marker
      ).pipe(Effect.option),
    { concurrency: 2 }
  );
  if (A.some(readings, (reading) => O.isNone(reading) || reading.value.exitCode !== 0 || reading.value.truncated)) {
    return O.some("git-probe-failed" as const);
  }
  return A.some(A.getSomes(readings), (capture) => Str.isNonEmpty(Str.trim(capture.output)))
    ? O.some("dirty-tree" as const)
    : O.none();
});
// commands/Worktree/internal/TmpfsReap.ts worktreeIsDirty's status read, verbatim.
const oldWorktreeIsDirty = (parentRepo: string, worktree: string) =>
  runRepoCommandCapture("git", ["-C", worktree, "status", "--porcelain", "--no-renames"], parentRepo).pipe(
    Effect.option,
    Effect.map(
      O.match({
        onNone: () => true,
        onSome: (capture) => capture.exitCode !== 0 || Str.isNonEmpty(Str.trim(capture.output)),
      })
    )
  );

// Worktree/Fleet.service.ts runGitProbe + gitStdout, verbatim (no scanner env: those reads stay on the probe).
const oldRunGitProbe = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const captured = yield* runCapturedStreams({
    command: "git",
    args,
    cwd,
    extendEnv: true,
    stdin: "ignore",
    bound: repoRunOutputBound,
    trim: false,
  }).pipe(Effect.option);
  return O.flatMap(captured, (result) =>
    result.truncated || result.exitCode !== 0 ? O.none<string>() : O.some(result.stdout)
  );
});
// Fleet.service.ts parseStatusPorcelainZ, verbatim (retired in W2).
const RENAME_OR_COPY_STATUS = /[RC]/;
type StatusRecord = { readonly paths: ReadonlyArray<string>; readonly counted: boolean; readonly stride: number };
const SKIPPED_STATUS_RECORD: StatusRecord = { paths: A.empty(), counted: false, stride: 1 };
const statusRecordAt = (records: ReadonlyArray<string>, index: number): StatusRecord => {
  const record = records[index];
  if (record === undefined || Str.isEmpty(record)) return SKIPPED_STATUS_RECORD;
  const target = Str.slice(3)(record);
  if (!RENAME_OR_COPY_STATUS.test(Str.slice(0, 2)(record))) return { paths: [target], counted: true, stride: 1 };
  const origin = O.filter(O.fromUndefinedOr(records[index + 1]), Str.isNonEmpty);
  return {
    paths: O.match(origin, { onNone: () => [target], onSome: (value) => [target, value] }),
    counted: true,
    stride: 2,
  };
};
const oldParseStatusPorcelainZ = (output: string) => {
  const records = Str.split(output, "\0");
  const paths: Array<string> = [];
  let entryCount = 0;
  let index = 0;
  while (index < records.length) {
    const parsed = statusRecordAt(records, index);
    paths.push(...parsed.paths);
    entryCount = parsed.counted ? entryCount + 1 : entryCount;
    index = index + parsed.stride;
  }
  return { entryCount, paths };
};
const oldStatusFacts = (cwd: string) =>
  oldRunGitProbe(cwd, ["status", "--porcelain=v1", "-z", "-uall"]).pipe(
    Effect.map(
      flow(O.map(oldParseStatusPorcelainZ), (status) => ({
        dirtyCount: O.match(status, { onNone: () => null, onSome: (parsed) => parsed.entryCount }),
        dirtyPaths: O.match(status, { onNone: A.empty<string>, onSome: (parsed) => parsed.paths }),
      }))
    )
  );
// Worktree.schemas.ts parseWorktreePorcelain, verbatim (retired in W2); the schema refusal is a failure here.
const REFS_HEADS_PREFIX = "refs/heads/";
const WORKTREE_PREFIX = "worktree ";
type PorcelainAccumulator = {
  path: string;
  head: string | null;
  branch: string | null;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
};
const stripRefsHeads = (ref: string): string =>
  Str.startsWith(REFS_HEADS_PREFIX)(ref) ? Str.slice(REFS_HEADS_PREFIX.length)(ref) : ref;
const applyPorcelainAttribute = (current: PorcelainAccumulator, line: string): void => {
  if (Str.startsWith("HEAD ")(line)) current.head = Str.slice("HEAD ".length)(line);
  else if (Str.startsWith("branch ")(line)) current.branch = stripRefsHeads(Str.slice("branch ".length)(line));
  else if (line === "detached") current.detached = true;
  else if (line === "locked" || Str.startsWith("locked ")(line)) current.locked = true;
  else if (line === "prunable" || Str.startsWith("prunable ")(line)) current.prunable = true;
};
const isWorktreeListPath = (path: string) => /^[^\x00-\x1f\x7f]+$/u.test(path);
const oldParseWorktreePorcelain = (porcelain: string): O.Option<ReadonlyArray<WorktreeListEntry>> => {
  if (porcelain !== "" && !Str.includes("\0")(porcelain)) return O.none();
  const blocks: Array<{ path: string; attributes: Array<string> }> = [];
  for (const line of Str.split(porcelain, "\0")) {
    if (Str.startsWith(WORKTREE_PREFIX)(line)) {
      blocks.push({ path: Str.slice(WORKTREE_PREFIX.length)(line), attributes: [] });
      continue;
    }
    const current = blocks[blocks.length - 1];
    if (current !== undefined) current.attributes.push(line);
  }
  return O.some(
    A.map(
      A.filter(blocks, (block) => isWorktreeListPath(block.path)),
      (block) => {
        const accumulator: PorcelainAccumulator = {
          path: block.path,
          head: null,
          branch: null,
          detached: false,
          locked: false,
          prunable: false,
        };
        for (const line of block.attributes) applyPorcelainAttribute(accumulator, line);
        return WorktreeListEntry.make(accumulator);
      }
    )
  );
};
const oldFleetWorktreeList = (cwd: string) =>
  oldRunGitProbe(cwd, ["worktree", "list", "--porcelain", "-z"]).pipe(Effect.map(O.flatMap(oldParseWorktreePorcelain)));
const oldFleetOrigin = (cwd: string) =>
  oldRunGitProbe(cwd, ["remote", "get-url", "origin"]).pipe(Effect.map(O.map(Str.trim)));
const oldFleetCommonDir = Effect.fnUntraced(function* (cwd: string) {
  const path = yield* Path.Path;
  return O.map(yield* oldRunGitProbe(cwd, ["rev-parse", "--git-common-dir"]), (output) =>
    path.resolve(cwd, Str.trim(output))
  );
});

// Ci/CiLane.ts changedPathsBetween and currentGitBranch, verbatim (errors reduced to their tag).
const oldCiChangedPaths = Effect.fnUntraced(function* (cwd: string, base: string, head: string) {
  const result = yield* runCaptured({
    command: "git",
    args: ["diff", "--name-only", `${base}...${head}`],
    cwd,
    source: "stdout",
  }).pipe(Effect.mapError(() => ({ _tag: "CiCommandError" as const })));
  if (result.exitCode !== 0) return yield* Effect.fail({ _tag: "CiCommandError" as const });
  return pipe(
    Str.split(/\r?\n/u)(result.output),
    A.map(normalizeSlashes),
    A.filter(Str.isNonEmpty),
    A.dedupe,
    A.sort(Order.String)
  );
});
const oldCiCurrentBranch = Effect.fnUntraced(function* (cwd: string) {
  const result = yield* runCaptured({
    command: "git",
    args: ["branch", "--show-current"],
    cwd,
    source: "stdout",
    trim: true,
  }).pipe(Effect.mapError(() => ({ _tag: "CiCommandError" as const })));
  if (result.exitCode !== 0) return yield* Effect.fail({ _tag: "CiCommandError" as const });
  return result.output;
});

// Quality/ChangesetStatus.ts collectGitDiffNameOnlyPaths with its two argv, verbatim.
const toNulSeparatedPaths = flow(Str.split("\u0000"), A.filter(Str.isNonEmpty), A.dedupe, A.sort(Order.String));
const oldChangesetDiff = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runCaptured({ command: "git", args, cwd, source: "stdout" }).pipe(
    Effect.mapError(() => ({ _tag: "ChangesetStatusError" as const }))
  );
  if (result.exitCode !== 0) return yield* Effect.fail({ _tag: "ChangesetStatusError" as const });
  return toNulSeparatedPaths(result.output);
});
const oldChangesetChanged = (cwd: string, since: string) =>
  oldChangesetDiff(cwd, ["diff", "--name-only", "-z", "--no-renames", "--diff-filter=ACMRTUXBD", `${since}...HEAD`]);
const oldChangesetAdded = (cwd: string, since: string) =>
  oldChangesetDiff(cwd, ["diff", "--name-only", "-z", "--diff-filter=A", `${since}...HEAD`, "--", ".changeset"]);

// Codex/Security.command.ts gitOutput, verbatim: an unbounded `spawner.string`, trimmed.
const oldSecurityGitOutput = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return Str.trim(yield* spawner.string(ChildProcess.make("git", args, { cwd })));
});

// Session/SessionLedger.service.ts gitLine x3, verbatim (its adapter keeps the exit code in the message only).
// SessionLedgerError keeps the exit code in its message only, so the view is the tag alone.
const sessionAdapter: GitCommandErrorAdapter<{ readonly _tag: "SessionLedgerError" }> = {
  onSpawnFailure: () => () => ({ _tag: "SessionLedgerError" }),
  onNonZeroExit: () => ({ _tag: "SessionLedgerError" }),
  onTruncated: O.none(),
};
const oldSessionFacts = Effect.fnUntraced(function* (cwd: string) {
  const path = yield* Path.Path;
  const line = (args: ReadonlyArray<string>) => runGitOutput(cwd, args, sessionAdapter).pipe(Effect.map(Str.trim));
  const checkout = path.resolve(yield* line(["rev-parse", "--show-toplevel"]));
  const common = yield* line(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const branch = yield* line(["rev-parse", "--abbrev-ref", "HEAD"]);
  return { clone: path.dirname(path.resolve(common)), checkout, lane: path.basename(checkout), branch };
});

// The `rev-parse HEAD` one-liners (PackageVerify, CoverageRegression, Runners) and CoverageArtifacts' peel, verbatim.
const oldRevParseHead = Effect.fnUntraced(function* (cwd: string) {
  const result = yield* runCaptured({ command: "git", args: ["rev-parse", "HEAD"], cwd, source: "stdout" }).pipe(
    Effect.mapError(() => ({ _tag: "CommandError" as const }))
  );
  if (result.exitCode !== 0) return yield* Effect.fail({ _tag: "CommandError" as const, exitCode: result.exitCode });
  return Str.trim(result.output);
});
const oldRevParsePeel = Effect.fnUntraced(function* (cwd: string, ref: string) {
  const result = yield* runCaptured({ command: "git", args: ["rev-parse", "--verify", `${ref}^{commit}`], cwd }).pipe(
    Effect.mapError(() => ({ _tag: "QualityTaskConfigurationError" as const }))
  );
  if (result.exitCode !== 0) return yield* Effect.fail({ _tag: "QualityTaskConfigurationError" as const });
  return Str.trim(result.output);
});

// --- the shipped bodies ----------------------------------------------------------------------------------------

const git = <A, E>(read: (service: Git["Service"]) => Effect.Effect<A, E>) => Effect.flatMap(Git, read);
const context = (cwd: string, base: string, head: string) =>
  RepoRunContext.make({
    base,
    branch: "main",
    cwd,
    head,
    originalArgv: [],
    packetDir: cwd,
    repoRoot: cwd,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });
// The expressions ResidueReap.ts, TmpfsReap.ts, Fleet.service.ts, CiLane.ts, ChangesetStatus.ts and
// Security.command.ts ship (none exports its reader).
const newGitCleanSkip = (gitMarkers: ReadonlyArray<string>) =>
  git((service) =>
    Effect.forEach(
      gitMarkers,
      (marker) =>
        service
          .status(marker, { noOptionalLocks: true, untrackedFiles: "all", ignoreSubmodules: "none" })
          .pipe(Effect.option),
      { concurrency: 2 }
    ).pipe(
      Effect.map((readings) =>
        A.some(readings, O.isNone)
          ? O.some("git-probe-failed" as const)
          : A.some(A.getSomes(readings), A.isReadonlyArrayNonEmpty)
            ? O.some("dirty-tree" as const)
            : O.none()
      )
    )
  );
const newWorktreeIsDirty = (worktree: string) =>
  git((service) =>
    service
      .status(worktree, { noRenames: true })
      .pipe(Effect.option, Effect.map(O.match({ onNone: () => true, onSome: A.isReadonlyArrayNonEmpty })))
  );
const newStatusFacts = (cwd: string) =>
  git((service) =>
    service.status(cwd, { untrackedFiles: "all" }).pipe(
      Effect.option,
      Effect.map((status) => ({
        dirtyCount: O.match(status, { onNone: () => null, onSome: A.length }),
        dirtyPaths: O.match(status, {
          onNone: A.empty<string>,
          onSome: A.flatMap((entry) => [entry.path, ...A.fromOption(O.fromUndefinedOr(entry.origPath))]),
        }),
      }))
    )
  );
const newFleetWorktreeList = (cwd: string) =>
  git((service) => service.worktreeList(cwd).pipe(Effect.option, Effect.map(O.map(worktreeListEntriesFromGit))));
const newFleetOrigin = (cwd: string) =>
  git((service) => service.remoteUrl(cwd).pipe(Effect.option, Effect.map(O.flatten)));
const newFleetCommonDir = (cwd: string) =>
  Effect.flatMap(Path.Path, (path) =>
    git((service) =>
      service.commonDir(cwd).pipe(Effect.option, Effect.map(O.map((output) => path.resolve(cwd, Str.trim(output)))))
    )
  );
const newCiChangedPaths = (cwd: string, base: string, head: string) =>
  git((service) =>
    service.changedFiles(cwd, { base, head }).pipe(
      Effect.mapBoth({
        onFailure: () => ({ _tag: "CiCommandError" as const }),
        onSuccess: (paths: ReadonlyArray<string>) =>
          pipe(paths, A.map(normalizeSlashes), A.filter(Str.isNonEmpty), A.dedupe, A.sort(Order.String)),
      })
    )
  );
const newCiCurrentBranch = (cwd: string) =>
  git((service) =>
    service
      .currentBranch(cwd, { mode: "show-current" })
      .pipe(
        Effect.mapBoth({ onFailure: () => ({ _tag: "CiCommandError" as const }), onSuccess: O.getOrElse(() => "") })
      )
  );
const canonicalPaths = (paths: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(paths, A.filter(Str.isNonEmpty), A.dedupe, A.sort(Order.String));
const newChangesetChanged = (cwd: string, since: string) =>
  git((service) =>
    service
      .changedFiles(cwd, { base: since, head: "HEAD", diffFilter: "ACMRTUXBD", noRenames: true })
      .pipe(Effect.mapBoth({ onFailure: () => ({ _tag: "ChangesetStatusError" as const }), onSuccess: canonicalPaths }))
  );
const newChangesetAdded = (cwd: string, since: string) =>
  git((service) =>
    service
      .changedFiles(cwd, { base: since, head: "HEAD", diffFilter: "A", pathspec: [".changeset"] })
      .pipe(Effect.mapBoth({ onFailure: () => ({ _tag: "ChangesetStatusError" as const }), onSuccess: canonicalPaths }))
  );
const newSecurityRemote = (cwd: string) =>
  git((service) => service.remoteUrl(cwd).pipe(Effect.map(O.getOrElse(() => ""))));
const newSecurityRevision = (cwd: string) => git((service) => service.revParse(cwd, "HEAD"));
const newSecurityClean = (cwd: string) =>
  git((service) => service.status(cwd).pipe(Effect.map(A.isReadonlyArrayEmpty)));
const newSessionFacts = (cwd: string) =>
  sessionCheckoutFacts(cwd).pipe(
    Effect.map((facts) => ({ clone: facts.clone, checkout: facts.checkout, lane: facts.lane, branch: facts.branch }))
  );
// The sites fold the kit's errors through adaptGitKitError onto their own error with git's exit code.
const commandErrorAdapter: GitCommandErrorAdapter<{ readonly _tag: "CommandError"; readonly exitCode?: number }> = {
  onSpawnFailure: () => () => ({ _tag: "CommandError" }),
  onNonZeroExit: ({ exitCode }) => ({ _tag: "CommandError", exitCode }),
  onTruncated: O.none(),
};
const newRevParseHead = (cwd: string) =>
  git((service) =>
    service
      .revParse(cwd, "HEAD")
      .pipe(Effect.mapError(adaptGitKitError(GitCommand.revParse("HEAD"), commandErrorAdapter)))
  );
const newRevParsePeel = (cwd: string, ref: string) =>
  git((service) =>
    service
      .revParse(cwd, ref, { peel: "commit" })
      .pipe(Effect.mapError(() => ({ _tag: "QualityTaskConfigurationError" as const })))
  );

// --- normalization ---------------------------------------------------------------------------------------------

/** A failure reduced to what the sites branch on: its error class, and the exit code when it carries one. */
const failureView = (error: unknown) => ({
  tag: P.hasProperty(error, "_tag") && P.isString(error._tag) ? error._tag : "unknown",
  ...(P.hasProperty(error, "exitCode") && P.isNumber(error.exitCode) ? { exitCode: error.exitCode } : {}),
});

const same = (value: unknown): unknown => value;

/** Runs one body to a JSON-comparable value: its success, or the failure it surfaced. */
const outcomeOf = <A, E>(body: Effect.Effect<A, E, Services>, view: (value: A) => unknown) =>
  body.pipe(
    Effect.map((value) => ({ ok: view(value) })),
    Effect.catch((failure) => Effect.succeed({ failed: failureView(failure) }))
  );

// --- scratch repositories ---------------------------------------------------------------------------------------

const run = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  if (result.exitCode !== 0) return yield* Effect.die(`fixture git ${A.join(args, " ")} failed: ${result.output}`);
  return Str.trim(result.output);
});

const write = Effect.fnUntraced(function* (cwd: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(path.join(cwd, file)), { recursive: true });
  yield* fs.writeFileString(path.join(cwd, file), content);
});

const commitAll = Effect.fnUntraced(function* (cwd: string, message: string) {
  yield* run(cwd, ["add", "-A"]);
  yield* run(cwd, [
    "-c",
    "commit.gpgsign=false",
    "-c",
    "user.email=w2@example.com",
    "-c",
    "user.name=W2",
    "commit",
    "--quiet",
    "-m",
    message,
  ]);
  return yield* run(cwd, ["rev-parse", "HEAD"]);
});

const initRepo = Effect.fnUntraced(function* (cwd: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(cwd, { recursive: true });
  yield* run(cwd, ["-c", "init.defaultBranch=main", "init", "--quiet"]);
});

interface Row {
  readonly new: unknown;
  readonly old: unknown;
  readonly scenario: string;
  readonly site: string;
}
type Classified = Row & { readonly verdict: string };

// Intended divergences, each recorded in SPEC.md's Decision Log (D-10) with these witness scenarios.
const RAW_PATHS =
  "D-10: the kit reads -z output, so a path with a non-ASCII or special character arrives raw where the line capture received git's C-quoted form";
const UNBORN_ECHO =
  "D-10: Git.revParse fails with the typed UnknownRefError on an unborn repository where the unbounded string read ignored the exit code and returned git's literal `HEAD` echo";
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  ["collectDirtyWorktreeFiles", "ACMR TypeScript pathspecs", RAW_PATHS],
  ["collectDirtyWorktreeFiles", "whole tree", RAW_PATHS],
  ["collectDirtyWorktreeFiles", "no renames", RAW_PATHS],
  ["collectChangedFiles", "branched history with renames and a deletion", RAW_PATHS],
  ["securityRevision", "unborn repository", UNBORN_ECHO],
];

const show = (value: unknown): string => JSON.stringify(value) ?? "undefined";
const sortedPaths = (paths: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(paths, Order.String);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "w2-differential-" });
  const rows: Array<Row> = [];
  const compare = <A, B, E1, E2>(
    site: string,
    scenario: string,
    oldBody: Effect.Effect<A, E1, Services>,
    newBody: Effect.Effect<B, E2, Services>,
    oldView: (value: A) => unknown = same,
    newView: (value: B) => unknown = same
  ) =>
    Effect.gen(function* () {
      const oldValue = yield* outcomeOf(oldBody, oldView);
      const newValue = yield* outcomeOf(newBody, newView);
      rows.push({ site, scenario, old: oldValue, new: newValue });
    });

  // A repository with a two-commit main, an `origin/main` ref at the first commit, a branch `feature` carrying a
  // rename, a deletion, an added `.changeset` note, a changed `bun.lock`, and a dirty worktree on top: a staged
  // addition, an unstaged modification of a non-ASCII path, a staged rename, an untracked file in a nested
  // untracked directory, a path with a space, an ignored file.
  const seed = path.join(root, "seed");
  yield* initRepo(seed);
  yield* write(seed, "README.md", "seed\n");
  yield* write(seed, "src/a.ts", "a\n");
  yield* write(seed, "src/old.ts", "old\n");
  yield* write(seed, "src/gone.ts", "gone\n");
  yield* write(seed, "src/café.ts", "café\n");
  yield* write(seed, "bun.lock", "lock v1\n");
  yield* write(seed, ".gitignore", "ignored.txt\n");
  const c1 = yield* commitAll(seed, "c1");
  yield* run(seed, ["update-ref", "refs/remotes/origin/main", c1]);
  yield* run(seed, ["remote", "add", "origin", "git@github.com:acme/demo.git"]);
  yield* run(seed, ["checkout", "--quiet", "-b", "feature"]);
  yield* run(seed, ["mv", "src/old.ts", "src/new.ts"]);
  yield* fs.remove(path.join(seed, "src/gone.ts"));
  yield* write(seed, ".changeset/note.md", "---\n---\nnote\n");
  yield* write(seed, "bun.lock", "lock v2\n");
  yield* write(seed, "docs/guide.md", "guide\n");
  const c2 = yield* commitAll(seed, "c2");
  yield* write(seed, "src/staged.ts", "staged\n");
  yield* run(seed, ["add", "src/staged.ts"]);
  yield* write(seed, "src/café.ts", "café modified\n");
  yield* run(seed, ["mv", "src/a.ts", "src/a-moved.ts"]);
  yield* write(seed, "untracked/dir/deep.ts", "deep\n");
  yield* write(seed, "with space.ts", "space\n");
  yield* write(seed, "ignored.txt", "ignored\n");
  const clean = path.join(root, "clean");
  yield* run(root, ["clone", "--quiet", `file://${seed}`, clean]);
  const unborn = path.join(root, "unborn");
  yield* initRepo(unborn);
  const detached = path.join(root, "detached");
  yield* run(root, ["clone", "--quiet", `file://${seed}`, detached]);
  yield* run(detached, ["checkout", "--quiet", "--detach", c1]);
  const plain = path.join(root, "plain");
  yield* fs.makeDirectory(plain);

  // collectDirtyWorktreeFiles: the three Quality shapes (ACMR + TypeScript pathspecs, no renames, every status),
  // the tolerant mode in a repository without HEAD, the strict mode there and outside a repository.
  const dirtyCases: ReadonlyArray<
    readonly [
      scenario: string,
      cwd: string,
      diffArgs: ReadonlyArray<string>,
      filter: { readonly diffFilter?: string; readonly noRenames?: boolean },
      pathspecs: ReadonlyArray<string>,
      mode: "fail" | "ignore",
    ]
  > = [
    ["ACMR TypeScript pathspecs", seed, ["--diff-filter=ACMR"], { diffFilter: "ACMR" }, ["*.ts", "*.tsx"], "ignore"],
    ["no renames", seed, ["--no-renames"], { noRenames: true }, [], "fail"],
    ["whole tree", seed, [], {}, [], "fail"],
    ["clean clone", clean, [], {}, [], "fail"],
    ["unborn repository tolerated", unborn, ["--diff-filter=ACMR"], { diffFilter: "ACMR" }, [], "ignore"],
    ["unborn repository strict", unborn, [], {}, [], "fail"],
    ["outside a repository", plain, [], {}, [], "fail"],
  ];
  for (const [scenario, cwd, diffArgs, filter, pathspecs, onProbeFailure] of dirtyCases) {
    yield* compare(
      "collectDirtyWorktreeFiles",
      scenario,
      oldCollectDirtyWorktreeFiles(cwd, { diffArgs, pathspecs, onProbeFailure }),
      collectDirtyWorktreeFiles(cwd, { ...filter, pathspecs, onProbeFailure }),
      sortedPaths,
      sortedPaths
    );
  }
  // collectChangedFiles and the Docgen base range: a branch with renames and a deletion, an unknown base, outside.
  yield* compare(
    "collectChangedFiles",
    "branched history with renames and a deletion",
    oldCollectChangedFiles(seed, "origin/main", "HEAD"),
    collectChangedFiles(seed, "origin/main", "HEAD")
  );
  yield* compare(
    "collectChangedFiles",
    "unknown base",
    oldCollectChangedFiles(seed, "nope", "HEAD"),
    collectChangedFiles(seed, "nope", "HEAD")
  );
  yield* compare(
    "collectChangedFiles",
    "outside a repository",
    oldCollectChangedFiles(plain, "origin/main", "HEAD"),
    collectChangedFiles(plain, "origin/main", "HEAD")
  );
  const docgenRange = { base: "origin/main", head: "HEAD", diffFilter: "ACMR", pathspecs: ["*.ts", "*.tsx"] };
  yield* compare(
    "collectBaseRangeChangedFiles",
    "ACMR TypeScript pathspecs",
    oldDocgenBaseRange(seed),
    collectBaseRangeChangedFiles(seed, docgenRange)
  );
  yield* compare(
    "collectBaseRangeChangedFiles",
    "clean clone",
    oldDocgenBaseRange(clean),
    collectBaseRangeChangedFiles(clean, docgenRange)
  );

  // lockfileChangedSinceBase: changed on the branch, unchanged on main, outside.
  yield* compare(
    "lockfileChangedSinceBase",
    "changed on the branch",
    oldLockfileChanged(seed, "origin/main", "HEAD"),
    lockfileChangedSinceBase(context(seed, "origin/main", "HEAD"))
  );
  yield* compare(
    "lockfileChangedSinceBase",
    "unchanged",
    oldLockfileChanged(seed, c1, c1),
    lockfileChangedSinceBase(context(seed, c1, c1))
  );
  yield* compare(
    "lockfileChangedSinceBase",
    "outside a repository",
    oldLockfileChanged(plain, "origin/main", "HEAD"),
    lockfileChangedSinceBase(context(plain, "origin/main", "HEAD"))
  );

  // ResidueReap gitCleanSkip and TmpfsReap worktreeIsDirty: dirty tree, clean clone, outside, a staged rename alone.
  const renamed = path.join(root, "renamed");
  yield* run(root, ["clone", "--quiet", `file://${seed}`, renamed]);
  yield* run(renamed, ["mv", "README.md", "README-renamed.md"]);
  for (const [scenario, markers] of [
    ["dirty tree", [seed]],
    ["clean clone", [clean]],
    ["clean and dirty", [clean, seed]],
    ["outside a repository", [plain]],
    ["unborn repository", [unborn]],
  ] as const) {
    yield* compare("gitCleanSkip", scenario, oldGitCleanSkip(markers), newGitCleanSkip(markers));
  }
  for (const [scenario, worktree] of [
    ["dirty tree", seed],
    ["clean clone", clean],
    ["staged rename alone", renamed],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("worktreeIsDirty", scenario, oldWorktreeIsDirty(root, worktree), newWorktreeIsDirty(worktree));
  }

  // Fleet: status facts, the worktree listing (a linked detached worktree and a locked one), origin, common dir.
  const linked = path.join(root, "linked");
  yield* run(clean, ["worktree", "add", "--quiet", "--detach", linked, "HEAD"]);
  const locked = path.join(root, "locked");
  yield* run(clean, ["worktree", "add", "--quiet", "-b", "pinned", locked, "HEAD"]);
  yield* run(clean, ["worktree", "lock", "--reason", "pinned for a while", locked]);
  for (const [scenario, cwd] of [
    ["dirty tree with a rename and a nested untracked directory", seed],
    ["staged rename alone", renamed],
    ["clean clone", clean],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("statusFacts", scenario, oldStatusFacts(cwd), newStatusFacts(cwd));
  }
  for (const [scenario, cwd] of [
    ["clone with a detached and a locked worktree", clean],
    ["from the linked worktree", linked],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("fleetWorktreeList", scenario, oldFleetWorktreeList(cwd), newFleetWorktreeList(cwd));
  }
  for (const [scenario, cwd] of [
    ["origin configured", seed],
    ["no origin remote", unborn],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("fleetOrigin", scenario, oldFleetOrigin(cwd), newFleetOrigin(cwd));
  }
  for (const [scenario, cwd] of [
    ["main checkout", clean],
    ["linked worktree", linked],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("fleetCommonDir", scenario, oldFleetCommonDir(cwd), newFleetCommonDir(cwd));
  }

  // CiLane: the base-to-head paths and the current branch (on a branch, detached, outside).
  yield* compare(
    "ciChangedPaths",
    "branched history with renames and a deletion",
    oldCiChangedPaths(seed, "origin/main", "HEAD"),
    newCiChangedPaths(seed, "origin/main", "HEAD")
  );
  yield* compare(
    "ciChangedPaths",
    "unknown base",
    oldCiChangedPaths(seed, "nope", "HEAD"),
    newCiChangedPaths(seed, "nope", "HEAD")
  );
  yield* compare(
    "ciChangedPaths",
    "outside a repository",
    oldCiChangedPaths(plain, "origin/main", "HEAD"),
    newCiChangedPaths(plain, "origin/main", "HEAD")
  );
  for (const [scenario, cwd] of [
    ["on a branch", seed],
    ["detached HEAD", detached],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("ciCurrentBranch", scenario, oldCiCurrentBranch(cwd), newCiCurrentBranch(cwd));
  }

  // ChangesetStatus: the no-renames status filter and the added changeset notes.
  for (const [scenario, cwd, since] of [
    ["branch since origin/main", seed, "origin/main"],
    ["unknown base", seed, "nope"],
    ["outside a repository", plain, "origin/main"],
  ] as const) {
    yield* compare("changesetChanged", scenario, oldChangesetChanged(cwd, since), newChangesetChanged(cwd, since));
    yield* compare("changesetAdded", scenario, oldChangesetAdded(cwd, since), newChangesetAdded(cwd, since));
  }

  // Codex Security: the origin, the revision, the clean-worktree check.
  for (const [scenario, cwd] of [
    ["origin configured", seed],
    ["no origin remote", unborn],
  ] as const) {
    yield* compare(
      "securityRemote",
      scenario,
      oldSecurityGitOutput(cwd, ["remote", "get-url", "origin"]),
      newSecurityRemote(cwd)
    );
  }
  for (const [scenario, cwd] of [
    ["on a branch", seed],
    ["unborn repository", unborn],
  ] as const) {
    yield* compare(
      "securityRevision",
      scenario,
      oldSecurityGitOutput(cwd, ["rev-parse", "HEAD"]),
      newSecurityRevision(cwd)
    );
  }
  for (const [scenario, cwd] of [
    ["dirty tree", seed],
    ["clean clone", clean],
  ] as const) {
    yield* compare(
      "securityClean",
      scenario,
      oldSecurityGitOutput(cwd, ["status", "--porcelain"]).pipe(Effect.map(Str.isEmpty)),
      newSecurityClean(cwd)
    );
  }

  // SessionLedger: the checkout facts from the main checkout, a linked worktree, a detached head, outside.
  yield* run(clean, ["remote", "set-url", "origin", "git@github.com:acme/demo.git"]);
  yield* run(detached, ["remote", "set-url", "origin", "git@github.com:acme/demo.git"]);
  for (const [scenario, cwd] of [
    ["main checkout", clean],
    ["linked worktree", linked],
    ["detached HEAD", detached],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("sessionCheckoutFacts", scenario, oldSessionFacts(cwd), newSessionFacts(cwd));
  }

  // The rev-parse one-liners: HEAD on a branch, unborn, outside; the commit peel of a branch, a tag-less sha, unknown.
  for (const [scenario, cwd] of [
    ["on a branch", seed],
    ["unborn repository", unborn],
    ["outside a repository", plain],
  ] as const) {
    yield* compare("revParseHead", scenario, oldRevParseHead(cwd), newRevParseHead(cwd));
  }
  for (const [scenario, cwd, ref] of [
    ["branch", seed, "feature"],
    ["sha", seed, c2],
    ["unknown ref", seed, "nope"],
    ["outside a repository", plain, "HEAD"],
  ] as const) {
    yield* compare("revParsePeel", scenario, oldRevParsePeel(cwd, ref), newRevParsePeel(cwd, ref));
  }

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/dirty-axis-differential-w2.ts",
    commit: yield* run(repoRoot, ["rev-parse", "HEAD"]),
    git: yield* run(repoRoot, ["--version"]),
    scenarios: classified.length,
    same: A.filter(classified, (row) => row.verdict === "same").length,
    classified: A.filter(classified, (row) => row.verdict !== "same" && row.verdict !== "unclassified").length,
    unclassified: unclassified.length,
    gates,
    rows: A.map(classified, (row) => ({
      site: row.site,
      scenario: row.scenario,
      verdict: row.verdict,
      old: Str.replaceAll(root, "<tmp>")(show(row.old)),
      new: Str.replaceAll(root, "<tmp>")(show(row.new)),
    })),
  };
  const json = JSON.stringify(report, null, 2);
  yield* O.match(
    O.flatMap(outFlag, (index) => A.get(argv, index + 1)),
    {
      onNone: () => Console.log(json),
      onSome: (out) => fs.writeFileString(out, `${json}\n`),
    }
  );
  yield* Console.error(`gates: ${JSON.stringify(gates)} (${report.same} same, ${report.classified} classified)`);
  for (const row of unclassified) {
    yield* Console.error(`unclassified: ${row.site} / ${row.scenario}\n  old ${show(row.old)}\n  new ${show(row.new)}`);
  }
  if (!gates.unclassified) process.exitCode = 1;
}).pipe(Effect.scoped);

NodeRuntime.runMain(
  Layer.build(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
