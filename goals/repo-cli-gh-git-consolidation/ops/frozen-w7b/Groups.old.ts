/**
 * Frozen pre-W7 W7b git site bodies, from the W7b lane base 8602b24203, replayed by `ops/groups-differential-w7.ts`.
 *
 * Each body is the site's git read as it stood before W7b, behaviour for behaviour: the same argv through the same
 * capture (`GitRunners.old.ts` for the retired generic runners; `StepExec.ts` and `RepoRun.executor.ts`, which survive
 * the runner retirement, for the direct captures). Error classes are reduced to `{ _tag, exitCode }` records carrying
 * the site's own error tag, since the differential compares only what callers branch on. Pure parsers the sites
 * deleted (`changedPathEntriesFromNameStatus`, `gitTreeEntriesFromNulOutput`, `parseKnowledgePathRemovals`) are
 * inlined verbatim; the unchanged pure classifier (`classifyChangedPaths`) and the ref-name expansion
 * (`gitRefSpanNamesForTesting`) are imported from the shipped tree.
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ChangedPathEntry,
  ClassifyDiff,
  classifyChangedPaths,
} from "../../../../packages/tooling/tool/cli/src/commands/Ci/RouteClassify.ts";
import { KnowledgePathRemoval } from "../../../../packages/tooling/tool/cli/src/commands/Knowledge/KnowledgeDoctor.schemas.ts";
import {
  runCaptured,
  runCapturedStreams,
  runToExit,
} from "../../../../packages/tooling/tool/cli/src/internal/process/StepExec.ts";
import {
  runRepoCommandCapture,
  runRepoCommandCaptureRaw,
} from "../../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import { gitRefSpanNamesForTesting } from "../../../../packages/tooling/tool/cli/src/test/Knowledge.test-kit.ts";
import { runGitLines, runGitOutput, runGitPathList, runGitRawOutput } from "./GitRunners.old.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RouteReadAt } from "../../../../packages/tooling/tool/cli/src/commands/Ci/RouteClassify.ts";
import type { GitCommandErrorAdapter } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

/** A site error reduced to what callers branch on. */
export interface SiteFailure {
  readonly _tag: string;
  readonly exitCode?: number;
}

// Only the error classes that declare an `exitCode` field carry one; the others keep git's code in their message.
const CARRIES_EXIT_CODE = ["QualityScriptCommandError"];
const failure = (tag: string, exitCode?: number): SiteFailure =>
  exitCode === undefined || !A.contains(CARRIES_EXIT_CODE, tag) ? { _tag: tag } : { _tag: tag, exitCode };

const adapterFor = (tag: string): GitCommandErrorAdapter<SiteFailure> => ({
  onSpawnFailure: () => () => failure(tag),
  onNonZeroExit: ({ exitCode }) => failure(tag, exitCode),
  onTruncated: O.none(),
});

type Requirements = SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner;

// --- Ci/RouteClassify.ts: gitReadAt and classifyCommitRange (B1-B4) ------------------------------------------------

const RenameStatus = S.String.check(S.isPattern(/^R[0-9]+$/u));
const CopyStatus = S.String.check(S.isPattern(/^C[0-9]+$/u));
const ChangedPathStatusLetter = S.Literals(["A", "D", "M", "T", "U", "X", "B"]);
const isRenameStatus = S.is(RenameStatus);
const isCopyStatus = S.is(CopyStatus);
const isChangedPathStatus = S.is(ChangedPathStatusLetter);
const isNonEmptyString = S.is(S.NonEmptyString);

type NameStatusRecord = { readonly width: number; readonly entries: ReadonlyArray<ChangedPathEntry> };

const pathField = (fields: ReadonlyArray<string>, index: number): O.Option<string> =>
  O.filter(A.get(fields, index), isNonEmptyString);
const renameField = (status: string): boolean => isRenameStatus(status);
const copyField = (status: string): boolean => isCopyStatus(status);

const nameStatusRecord = (
  fields: ReadonlyArray<string>,
  index: number
): ((status: string) => O.Option<NameStatusRecord>) => {
  const paths = O.all([pathField(fields, index + 1), pathField(fields, index + 2)]);
  return Match.type<string>().pipe(
    Match.when(renameField, () =>
      O.map(paths, ([source, target]) => ({
        width: 3,
        entries: [
          ChangedPathEntry.make({ path: source, status: "D" }),
          ChangedPathEntry.make({ path: target, status: "A" }),
        ],
      }))
    ),
    Match.when(copyField, () =>
      O.map(paths, ([, target]) => ({ width: 3, entries: [ChangedPathEntry.make({ path: target, status: "A" })] }))
    ),
    Match.orElse((status) =>
      O.map(O.all([O.liftPredicate(status, isChangedPathStatus), pathField(fields, index + 1)]), ([letter, path]) => ({
        width: 2,
        entries: [ChangedPathEntry.make({ path, status: letter })],
      }))
    )
  );
};

const nulFields = (output: string): O.Option<ReadonlyArray<string>> =>
  Str.isEmpty(output)
    ? O.some(A.empty<string>())
    : pipe(output, O.liftPredicate(Str.endsWith("\0")), O.map(flow(Str.split("\0"), A.dropRight(1))));

const nameStatusEntries = (fields: ReadonlyArray<string>): O.Option<ReadonlyArray<ChangedPathEntry>> =>
  pipe(
    A.unfold(O.some(0), (state: O.Option<number>) =>
      O.flatMap(state, (index) =>
        index >= A.length(fields)
          ? O.none()
          : O.map(A.get(fields, index), (status) => {
              const record = nameStatusRecord(fields, index)(status);
              return [record, O.map(record, (parsed) => index + parsed.width)] as const;
            })
      )
    ),
    O.all,
    O.map(A.flatMap((record) => record.entries))
  );

const changedPathEntriesFromNameStatus = (output: string): O.Option<ReadonlyArray<ChangedPathEntry>> =>
  pipe(nulFields(output), O.flatMap(nameStatusEntries));

type TreeEntry = { readonly objectType: string; readonly objectId: string; readonly path: string };
const parseGitTreeEntry = (record: string): O.Option<TreeEntry> => {
  const match = /^([0-9]{6}) ([a-z]+) ([0-9a-f]+)\t([^\0]+)$/u.exec(record);
  return match === null || !P.isString(match[2]) || !P.isString(match[3]) || !P.isString(match[4])
    ? O.none()
    : O.some({ objectType: match[2], objectId: match[3], path: match[4] });
};
const gitTreeEntriesFromNulOutput = (output: string): O.Option<ReadonlyArray<TreeEntry>> => {
  if (Str.isEmpty(output)) return O.some(A.empty());
  if (!Str.endsWith("\0")(output)) return O.none();
  const records = A.dropRight(Str.split("\0")(output), 1);
  const entries = A.getSomes(A.map(records, parseGitTreeEntry));
  return A.length(entries) === A.length(records) ? O.some(entries) : O.none();
};

const routeErrors = adapterFor("RouteError");

const oldGitReadAt =
  (repoRoot: string): RouteReadAt<Requirements> =>
  (ref, path) =>
    Effect.gen(function* () {
      const listing = yield* runGitRawOutput(
        repoRoot,
        ["ls-tree", "-z", "--full-tree", ref, "--", `:(literal)${path}`],
        routeErrors
      );
      const entries = yield* Effect.fromOption(gitTreeEntriesFromNulOutput(listing), () => failure("RouteError"));
      const blob = A.findFirst(entries, (entry) => entry.path === path && entry.objectType === "blob");
      if (O.isNone(blob)) return O.none<string>();
      return O.some(yield* runGitRawOutput(repoRoot, ["cat-file", "blob", blob.value.objectId], routeErrors));
    }).pipe(Effect.mapError((error) => error as never));

const decodeCommitCount = S.decodeUnknownOption(S.FiniteFromString.pipe(S.decodeTo(S.Natural)));

/** `classifyCommitRange` before W7b: the same shas in, the hand-rolled reads under the unchanged classifier. */
export const oldClassifyCommitRange = Effect.fnUntraced(function* (repoRoot: string, base: string, head: string) {
  const output = yield* runGitRawOutput(
    repoRoot,
    ["diff", "--name-status", "-z", "--no-renames", base, head, "--"],
    routeErrors
  );
  const entries = yield* Effect.fromOption(changedPathEntriesFromNameStatus(output), () => failure("RouteError"));
  const counted = yield* runGitRawOutput(repoRoot, ["rev-list", "--count", `${base}..${head}`], routeErrors);
  const commits = yield* Effect.fromOption(decodeCommitCount(Str.trim(counted)), () => failure("RouteError"));
  return yield* classifyChangedPaths(ClassifyDiff.make({ base, head, entries, commits }), oldGitReadAt(repoRoot));
});

// --- Ci/RouteCensus.ts: mergeBase (B6) ----------------------------------------------------------------------------

export const oldRouteMergeBase = Effect.fnUntraced(function* (repoRoot: string, head: string) {
  const result = yield* runRepoCommandCaptureRaw("git", ["merge-base", "origin/main", head], repoRoot).pipe(
    Effect.mapError(() => failure("RouteError"))
  );
  const sha = Str.trim(result.output);
  if (result.exitCode !== 0 || Str.isEmpty(sha)) return yield* Effect.fail(failure("RouteError", result.exitCode));
  return sha;
});

// --- Ci/HeavyAdmission.ts: readHeavyAdmissionChangedPaths (B12, B13) ----------------------------------------------

export const oldHeavyAdmissionChangedPaths = Effect.fnUntraced(function* (branch: string, cwd: string) {
  yield* runRepoCommandCapture(
    "git",
    ["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`],
    cwd
  ).pipe(Effect.ignore);
  const diff = yield* runRepoCommandCapture("git", ["diff", "--name-only", `origin/${branch}...HEAD`], cwd).pipe(
    Effect.mapError(() => failure("CiCommandError"))
  );
  if (diff.exitCode !== 0 || diff.truncated) return yield* Effect.fail(failure("CiCommandError"));
  return pipe(Str.split(diff.output, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));
});

// --- Docgen/internal/Doctest.ts: discoverChangedDoctestFilesForTesting's git reads (B15-B17) ----------------------

export const oldDoctestChangedPaths = Effect.fnUntraced(function* (repoRoot: string) {
  const adapter = adapterFor("DoctestAnalysisError");
  const [committed, dirty, untracked] = yield* Effect.all([
    runGitLines(repoRoot, ["diff", "--name-only", "origin/main...HEAD", "--", "packages", "apps"], adapter),
    runGitLines(repoRoot, ["diff", "--name-only", "HEAD", "--", "packages", "apps"], adapter),
    runGitLines(repoRoot, ["ls-files", "--others", "--exclude-standard", "--", "packages", "apps"], adapter),
  ]);
  return [...committed, ...dirty, ...untracked];
});

// --- Knowledge: readKnowledgeGitRefNames (B25) and the path-removal log (B18, B19) --------------------------------

export const oldKnowledgeGitRefNames = Effect.fnUntraced(function* (repoRoot: string) {
  const fullRefs = yield* runGitLines(
    repoRoot,
    ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes", "refs/tags"],
    adapterFor("KnowledgeOperationalError")
  );
  return HashSet.fromIterable(A.flatMap(fullRefs, gitRefSpanNamesForTesting));
});

const KNOWLEDGE_PATH_REMOVAL_LOG_ARGS: ReadonlyArray<string> = [
  "-c",
  "core.quotePath=false",
  "log",
  "--diff-filter=DR",
  "-M",
  "--name-status",
  "--format=%x1e%H%x1f%s",
];
const isCommitSha = (value: string): boolean => /^[0-9a-f]{40}$/u.test(value);
const removalOf = (commit: string, subject: string, line: string): O.Option<KnowledgePathRemoval> => {
  const [status = "", path = "", renamedTo] = Str.split("\t")(line);
  const change = Str.startsWith("R")(status)
    ? O.some("renamed" as const)
    : Str.startsWith("D")(status)
      ? O.some("deleted" as const)
      : O.none();
  return O.map(
    O.filter(change, () => Str.isNonEmpty(path)),
    (value) =>
      KnowledgePathRemoval.make({
        path,
        commit: commit as never,
        subject,
        change: value,
        renamedTo: O.fromUndefinedOr(renamedTo),
      })
  );
};
const commitRemovals = (record: string): ReadonlyArray<KnowledgePathRemoval> => {
  const [header = "", ...lines] = Str.split("\n")(record);
  const [commit = "", subject = ""] = Str.split("\u001f")(header);
  return isCommitSha(commit)
    ? A.getSomes(A.map(A.filter(lines, Str.isNonEmpty), (line) => removalOf(commit, subject, line)))
    : A.empty();
};

/** `pathRemovalsLive` before W7b: the shallow probe, then the whole-history log on the unbounded capture. */
export const oldKnowledgePathRemovals = Effect.fnUntraced(function* (repoRoot: string, treeCommit: string) {
  const shallow = yield* runCapturedStreams({
    command: "git",
    args: ["rev-parse", "--is-shallow-repository"],
    cwd: repoRoot,
    extendEnv: true,
    trim: true,
  });
  if (shallow.exitCode !== 0 || Str.Equivalence(shallow.stdout, "true"))
    return O.none<ReadonlyArray<KnowledgePathRemoval>>();
  const log = yield* runCapturedStreams({
    command: "git",
    args: [...KNOWLEDGE_PATH_REMOVAL_LOG_ARGS, treeCommit],
    cwd: repoRoot,
    extendEnv: true,
  });
  return log.exitCode === 0 ? O.some(A.flatMap(Str.split("\u001e")(log.stdout), commitRemovals)) : O.none();
});

// --- Quality: the visible-path listings (B30-B32) and the audit diff input (B42-B44) ------------------------------

export const oldVisiblePaths = (repoRoot: string, pathspec: ReadonlyArray<string>) =>
  runGitLines(
    repoRoot,
    ["ls-files", "--cached", "--others", "--exclude-standard", ...pathspec],
    adapterFor("QualityScriptCommandError")
  );

type ProcessResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
  readonly exitCode: number;
};
const combine = (stdout: string, stderr: string): string =>
  pipe([Str.trim(stdout), Str.trim(stderr)], A.filter(Str.isNonEmpty), A.join("\n"));
const collectProcessOutput = (repoRoot: string, args: ReadonlyArray<string>) =>
  runCapturedStreams({ command: "git", args, cwd: repoRoot, env: {}, extendEnv: true }).pipe(
    Effect.mapError(() => failure("QualityScriptCommandError")),
    Effect.map(
      (result): ProcessResult => ({
        stdout: result.stdout,
        stderr: result.stderr,
        output: combine(result.stdout, result.stderr),
        exitCode: result.exitCode,
      })
    )
  );

export const oldAuditDiffInput = Effect.fnUntraced(function* (
  repoRoot: string,
  base: string,
  context = 3,
  noRenames?: boolean
) {
  const trackedDiff = yield* collectProcessOutput(repoRoot, [
    "diff",
    "--binary",
    ...(noRenames === true ? ["--no-renames"] : []),
    `--unified=${context}`,
    base,
    "--",
    ".",
  ]);
  if (trackedDiff.exitCode !== 0) return trackedDiff;
  const untrackedFiles = yield* collectProcessOutput(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]);
  if (untrackedFiles.exitCode !== 0) return untrackedFiles;
  const paths = pipe(Str.split("\0")(untrackedFiles.stdout), A.filter(Str.isNonEmpty));
  const untrackedDiffs = yield* Effect.forEach(paths, (filePath) =>
    collectProcessOutput(repoRoot, [
      "diff",
      "--binary",
      `--unified=${context}`,
      "--no-index",
      "--",
      "/dev/null",
      filePath,
    ])
  );
  const failedDiff = A.findFirst(untrackedDiffs, (result) => result.exitCode !== 0 && result.exitCode !== 1);
  if (O.isSome(failedDiff)) return failedDiff.value;
  const stdout = pipe([trackedDiff.stdout, ...A.map(untrackedDiffs, (result) => result.stdout)], A.join(""));
  return { stdout, stderr: "", output: stdout, exitCode: 0 } satisfies ProcessResult;
});

/** `laneProofVirtualTreeSha` before W7b: `rev-parse --git-path` resolved against the root, then the temporary index. */
export const oldLaneProofVirtualTreeSha = Effect.fnUntraced(function* (repoRoot: string, indexName: string) {
  const path = yield* Path.Path;
  const runGit = (args: ReadonlyArray<string>, env?: Readonly<Record<string, string>>) =>
    runCapturedStreams({
      command: "git",
      args,
      cwd: repoRoot,
      ...(env === undefined ? {} : { env: { ...env } }),
      extendEnv: true,
      trim: true,
    }).pipe(
      Effect.mapError(() => failure("LaneProofGitError")),
      Effect.flatMap((result) =>
        result.exitCode === 0 ? Effect.succeed(result.stdout) : Effect.fail(failure("LaneProofGitError"))
      )
    );
  const indexPath = path.resolve(repoRoot, yield* runGit(["rev-parse", "--git-path", indexName]));
  const indexEnv = { GIT_INDEX_FILE: indexPath };
  yield* runGit(["read-tree", "HEAD"], indexEnv);
  yield* runGit(["add", "-A", "--", "."], indexEnv);
  return { indexPath, tree: yield* runGit(["write-tree"], indexEnv) };
});

// --- Goals/Doctor.ts: the advisory git reads (B66-B68) -------------------------------------------------------------

const goalsGitAdapter = adapterFor("GoalsGitError");
const gitOutputOrNone = (cwd: string, args: ReadonlyArray<string>) =>
  runGitOutput(cwd, args, goalsGitAdapter).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));

export const oldGoalsGitReads = Effect.fnUntraced(function* (cwd: string) {
  const shallow = yield* gitOutputOrNone(cwd, ["rev-parse", "--is-shallow-repository"]);
  const recentPaths = yield* gitOutputOrNone(cwd, [
    "log",
    "--since=21.days",
    "--name-only",
    "--format=",
    "--",
    "goals/",
  ]);
  const subjects = yield* gitOutputOrNone(cwd, ["log", "--format=%s", "-n", "4000"]);
  return {
    shallow: O.map(shallow, (text) => Str.trim(text) === "true"),
    recentPaths: O.map(recentPaths, flow(Str.split("\n"), A.map(Str.trim), A.filter(Str.isNonEmpty))),
    subjects: O.map(subjects, flow(Str.split("\n"), A.map(Str.trim), A.filter(Str.isNonEmpty))),
  };
});

// --- Research/internal/Daily.ts: commitVault (B79-B82) -------------------------------------------------------------

const stagePathspecs = (checkIgnoreExit: number, stateDir: string) =>
  Match.value(checkIgnoreExit).pipe(
    Match.when(0, () => Effect.succeed(["."])),
    Match.when(1, () => Effect.succeed([".", `:(exclude)${stateDir}/**`])),
    Match.orElse((exitCode) => Effect.fail(failure("ResearchCommandError", exitCode)))
  );

export const oldCommitVault = Effect.fnUntraced(function* (vaultRoot: string, stateDir: string) {
  const git = (args: ReadonlyArray<string>) =>
    runToExit({ command: "git", args, cwd: vaultRoot, stdio: "ignore" }).pipe(
      Effect.mapError(() => failure("ResearchCommandError"))
    );
  const run = (args: ReadonlyArray<string>) =>
    git(args).pipe(
      Effect.filterOrFail(
        (exitCode) => exitCode === 0,
        (exitCode) => failure("ResearchCommandError", exitCode)
      )
    );
  const pathspecs = yield* git(["check-ignore", "-q", stateDir]).pipe(
    Effect.flatMap((exitCode) => stagePathspecs(exitCode, stateDir))
  );
  yield* run(["add", "-A", "--", ...pathspecs]);
  const status = yield* git(["diff", "--cached", "--quiet"]);
  if (status === 0) return "clean" as const;
  if (status !== 1) return yield* Effect.fail(failure("ResearchCommandError", status));
  const date = (yield* DateTime.now).pipe(DateTime.formatIso, Str.slice(0, 10));
  yield* run(["-c", "commit.gpgsign=false", "commit", "-q", "-m", `capture ${date}`]);
  return "committed" as const;
});

// --- Qa/Qa.session.ts: readCommitProvenance (B135, B136) -----------------------------------------------------------

const capturedText = (args: ReadonlyArray<string>) =>
  runCaptured({ args, command: "git", source: "stdout", trim: true }).pipe(
    Effect.map((step) => (step.exitCode === 0 ? O.some(step.output) : O.none<string>())),
    Effect.orElseSucceed(O.none<string>)
  );

export const oldReadCommitProvenance = Effect.fnUntraced(function* (cwd: string) {
  const [sha, status] = yield* Effect.all(
    [capturedText(["-C", cwd, "rev-parse", "HEAD"]), capturedText(["-C", cwd, "status", "--porcelain"])],
    { concurrency: 2 }
  );
  return {
    dirty: O.match(status, { onNone: () => false, onSome: (text) => !Str.isEmpty(text) }),
    sha: O.getOrElse(sha, () => "unknown"),
  };
});

// --- Laws/internal/TrackedTextFiles.ts and Laws/SchemaTagIdioms.ts: the tracked listings (B70, B71) --------------

const STAGE_RECORD_PATTERN = /^(\d{6}) [0-9a-f]+ \d\t(.+)$/su;
export const oldTrackedRegularFiles = (repoRoot: string) =>
  runGitRawOutput(repoRoot, ["ls-files", "-z", "--stage"], adapterFor("LawsError")).pipe(
    Effect.map(
      flow(
        Str.split("\0"),
        A.filter(Str.isNonEmpty),
        A.map((record) =>
          pipe(
            O.fromNullishOr(STAGE_RECORD_PATTERN.exec(record)),
            O.filter((match) => match[1] === "100644" || match[1] === "100755"),
            O.flatMap((match) => O.fromNullishOr(match[2]))
          )
        ),
        A.getSomes,
        A.dedupe
      )
    )
  );

export const oldTrackedPaths = (repoRoot: string, pathspecs: ReadonlyArray<string>) =>
  runGitRawOutput(repoRoot, ["ls-files", "-z", "--", ...pathspecs], adapterFor("LawsError")).pipe(
    Effect.map(flow(Str.split("\0"), A.filter(Str.isNonEmpty)))
  );

// --- Lint/OpaqueRoundtrips.ts: the tracked test files (B75) --------------------------------------------------------

export const oldTrackedTestFiles = (repoRoot: string) =>
  runGitPathList(repoRoot, ["ls-files", "-z", "--", "*.test.ts", "*.test.tsx"], adapterFor("OpaqueRoundtripsError"));

/** The platform the frozen bodies need, beyond what the shipped readers already require. */
export type FrozenRequirements = Requirements | FileSystem.FileSystem | Path.Path;
