/**
 * The `Git` service: typed repository introspection plus a clearly-marked
 * mutating tier, run through Effect's `ChildProcessSpawner`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GitId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  DirtyWorktreeError,
  GitCommandError,
  MergeConflictError,
  NonFastForwardError,
  NotARepositoryError,
  NotStubbedError,
  UnknownRefError,
} from "./Git.errors.ts";
import { GitOptions } from "./Git.models.ts";
import { GitCommand } from "./GitCommand.ts";
import { makeWith as makeExecution } from "./internal/execution.ts";
import {
  parseBranchList,
  parseCommitInfo,
  parseConfigGetAll,
  parseConfigList,
  parseForEachRef,
  parseLogFor,
  parseLsFiles,
  parseLsRemote,
  parseLsTree,
  parseMergeTree,
  parseNameStatus,
  parseNulSeparated,
  parseRevListCount,
  parseStashList,
  parseStatus,
  parseSubmoduleStatus,
  parseUpstream,
  parseWorktreeList,
} from "./internal/parsers.ts";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  BranchEntry,
  CommitInfo,
  CommitLogEntry,
  ConfigListEntry,
  LsFilesEntry,
  LsRemoteEntry,
  LsTreeEntry,
  MergeTreeResult,
  NameStatusEntry,
  RefEntry,
  StashEntry,
  StatusEntry,
  SubmoduleStatusEntry,
  WorktreeEntry,
} from "./Git.models.ts";
import type {
  CurrentBranchMode,
  GitConfigScope,
  GitInvocation,
  StatusIgnoreSubmodules,
  StatusUntrackedFiles,
} from "./GitCommand.ts";
import type { Execution } from "./internal/execution.ts";

/**
 * Git failure contracts retained at the service import path.
 *
 * @category errors
 * @since 0.0.0
 */
export {
  DirtyWorktreeError,
  GitCommandError,
  MergeConflictError,
  NonFastForwardError,
  NotARepositoryError,
  NotStubbedError,
  UnknownRefError,
} from "./Git.errors.ts";
/**
 * Parsed Git model contracts retained at the service import path.
 *
 * @category models
 * @since 0.0.0
 */
export {
  BranchEntry,
  CommitInfo,
  CommitLogEntry,
  ConfigListEntry,
  GitOptions,
  LsFilesEntry,
  LsRemoteEntry,
  LsTreeEntry,
  MergeTreeResult,
  NameStatusEntry,
  RefEntry,
  StashEntry,
  StatusEntry,
  StatusRenderOptions,
  SubmoduleStatusEntry,
  WorktreeEntry,
} from "./Git.models.ts";

const $I = $GitId.create("Git");

const encodeJsonString = S.encodeEffect(S.fromJsonString(S.String));
const NonNegativeInteger = S.Finite.check(S.isMultipleOf(1), S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeInteger", {
    description: "A finite non-negative integer, including values beyond the safe-integer range.",
  })
);
const isNonNegativeInteger = S.is(NonNegativeInteger);
/** `--find-renames=<n>%`'s domain: a whole percent, 1..100. */
const RenameScorePercent = S.Finite.check(S.isInt(), S.isBetween({ minimum: 1, maximum: 100 })).pipe(
  $I.annoteSchema("RenameScorePercent", { description: "A rename-detection similarity threshold as a whole percent." })
);
const isRenameScorePercent = S.is(RenameScorePercent);
/** `--diff-filter=<letters>`'s domain: git's status letters (lower case excludes), or `*`. */
const DiffFilter = S.String.check(S.isPattern(/^[ACDMRTUXB*]+$/i)).pipe(
  $I.annoteSchema("DiffFilter", { description: "A non-empty `--diff-filter` letter set, lower case excluding." })
);
const isDiffFilter = S.is(DiffFilter);

/**
 * `dual` dispatch for a member whose subject is a string (`cwd`, or a
 * method label) and whose data-last argument list never starts with one:
 * a string first argument marks the data-first call. Used instead of an
 * arity count wherever trailing parameters are optional.
 */
const hasStringSubject = (args: IArguments): boolean => P.isString(args[0]);

/**
 * `dual` dispatch for a member shaped `(cwd, ...strings, options?)`: the call
 * is data-first when the LAST required positional (at `index`) is a string.
 * In a data-last call that slot holds the optional options object or nothing,
 * so omitting the trailing options never flips the dispatch.
 */
const stringAt =
  (index: number) =>
  (args: IArguments): boolean =>
    P.isString(args[index]);

/**
 * Refuse a caller-supplied ref or range that git would parse as an option.
 *
 * **Details**
 *
 * Refs are caller-controlled and land in git's argv as positional entries; a
 * value beginning with `-` is read as a flag instead — `checkout("-b")` would
 * CREATE a branch. A bare `--` separator is not a safe fix for every command
 * (it switches `checkout` into pathspec mode), so option-like values are
 * refused outright, before any spawn, as a typed {@link GitCommandError}.
 * `show`'s `path` needs no guard: it is fused after the ref into one
 * `ref:path` token, which cannot begin with `-` unless the ref does.
 *
 * `sensitive` values get the same check but a REDACTED report: a refused
 * sensitive positional (a `configSet` value) must not leak into
 * `GitCommandError.args`/`detail` any more than a spawned one may — the
 * redaction policy applies to guard rejections too.
 */
/** `values` followed by `optional` when it is defined — the argv refs a call actually passes. */
const withDefined = (values: ReadonlyArray<string>, optional: string | undefined): ReadonlyArray<string> =>
  optional === undefined ? values : [...values, optional];

const rejectOptionLikeRefs: {
  (cwd: string, refs: ReadonlyArray<string>, sensitive?: ReadonlyArray<string>): Effect.Effect<void, GitCommandError>;
  (
    refs: ReadonlyArray<string>,
    sensitive?: ReadonlyArray<string>
  ): (cwd: string) => Effect.Effect<void, GitCommandError>;
} = dual(
  hasStringSubject,
  (
    cwd: string,
    refs: ReadonlyArray<string>,
    sensitive: ReadonlyArray<string> = []
  ): Effect.Effect<void, GitCommandError> => {
    const offending = A.findFirst(refs, (ref) => Str.startsWith("-")(ref));
    if (O.isSome(offending)) {
      return encodeJsonString(offending.value).pipe(
        Effect.orDie,
        Effect.flatMap((encoded) =>
          Effect.fail(
            GitCommandError.make({
              kind: "refused",
              args: [offending.value],
              cwd,
              stderr: "",
              detail: `refused a ref argument git would parse as an option: ${encoded}`,
            })
          )
        )
      );
    }
    return A.every(sensitive, (value) => !Str.startsWith("-")(value))
      ? Effect.void
      : Effect.fail(
          GitCommandError.make({
            kind: "refused",
            args: ["<redacted>"],
            cwd,
            stderr: "",
            detail: "refused a sensitive argument git would parse as an option (value redacted)",
          })
        );
  }
);

/**
 * Refuse a caller-supplied numeric index/limit that is not a non-negative
 * integer.
 *
 * **Details**
 *
 * Every relational comparison against `NaN` is `false`, so a bare
 * `value < 0` guard admits `NaN` (and a fractional value truncates nothing —
 * it rides straight into the argv as `stash@{1.5}` / `--max-count=NaN`).
 * Integrality and range are therefore checked together, pre-spawn, as a
 * typed refusal.
 */
const rejectNonNaturalNumber: {
  (cwd: string, label: string, value: number | undefined): Effect.Effect<void, GitCommandError>;
  (label: string, value: number | undefined): (cwd: string) => Effect.Effect<void, GitCommandError>;
} = dual(
  3,
  (cwd: string, label: string, value: number | undefined): Effect.Effect<void, GitCommandError> =>
    value === undefined || isNonNegativeInteger(value)
      ? Effect.void
      : Effect.fail(
          GitCommandError.make({
            kind: "refused",
            args: [String(value)],
            cwd,
            stderr: "",
            detail: `refused ${label}: expected a non-negative integer, received ${value}`,
          })
        )
);

/**
 * Refuse a `--find-renames` threshold outside git's domain (a whole percent
 * 1..100) before any spawn. Shared by every member that renders the flag.
 */
const rejectRenameScore = (cwd: string, findRenames: number | undefined): Effect.Effect<void, GitCommandError> =>
  findRenames === undefined || isRenameScorePercent(findRenames)
    ? Effect.void
    : Effect.fail(
        GitCommandError.make({
          kind: "refused",
          args: [String(findRenames)],
          cwd,
          stderr: "",
          detail: `refused a rename score: expected a whole percent 1..100, received ${findRenames}`,
        })
      );

/**
 * Refuse a `--diff-filter` letter set git does not accept (`[ACDMRTUXB*]`,
 * lower case excluding, never empty) before any spawn. Shared by every member
 * that renders the flag; the rejected value is JSON-quoted in `detail` so
 * whitespace and an empty string stay visible.
 */
const rejectDiffFilter = (cwd: string, diffFilter: string | undefined): Effect.Effect<void, GitCommandError> =>
  diffFilter === undefined || isDiffFilter(diffFilter)
    ? Effect.void
    : encodeJsonString(diffFilter).pipe(
        Effect.orDie,
        Effect.flatMap((encoded) =>
          Effect.fail(
            GitCommandError.make({
              kind: "refused",
              args: [encoded],
              cwd,
              stderr: "",
              detail: `refused a diff filter: expected letters from [ACDMRTUXB*] (lower case excludes), received ${encoded}`,
            })
          )
        )
      );

/**
 * Refuse an option combination git rejects, or would silently misread, before
 * any spawn: a typed `"refused"` {@link GitCommandError} whose `args` name the
 * offending flags. Shared by every member whose options exclude each other.
 */
const rejectCombination = (
  cwd: string,
  refused: boolean,
  args: ReadonlyArray<string>,
  detail: string
): Effect.Effect<void, GitCommandError> =>
  refused
    ? Effect.fail(GitCommandError.make({ kind: "refused", args, cwd, stderr: "", detail: `refused: ${detail}` }))
    : Effect.void;

/** The walk, filter and body-shape options `Git.log` accepts; the full contract is on `GitShape["log"]`. */
type LogOptions = {
  /** A git pathspec scoping the walk; `--follow` requires exactly one entry. */
  readonly paths?: ReadonlyArray<string>;
  /** Follow the single path across renames (git's `--follow`). Default `false`. */
  readonly follow?: boolean;
  /** `--max-count`: at most this many commits. `0` is the empty listing. */
  readonly limit?: number;
  /** `--diff-merges=first-parent`: give merge commits a path listing. Default `false`. */
  readonly firstParentDiffMerges?: boolean;
  /** `--name-status` instead of `--name-only`: populate each entry's `changes`. Default `false`. */
  readonly nameStatus?: boolean;
  /** `--diff-filter=<letters>`: keep only the named status letters (lower case excludes). */
  readonly diffFilter?: string;
  /** `--find-renames=<n>%`: the rename-detection similarity threshold, a whole percent 1..100. */
  readonly findRenames?: number;
  /** `false` prepends the global `-c core.quotePath=false`. */
  readonly quotePath?: false;
  /** Start the walk here instead of `HEAD`: refs, ranges, `^`-exclusions. */
  readonly revisions?: ReadonlyArray<string>;
  /** `--no-merges`: leave merge commits out of the walk. Default `false`. */
  readonly noMerges?: boolean;
  /** `--reverse`: oldest first, applied after `limit`. Default `false`. */
  readonly reverse?: boolean;
  /** `--since=<when>`: only commits newer than git's approxidate `when`. */
  readonly since?: string;
  /** List no paths: each entry's `paths` is empty. Excludes `nameStatus`. Default `false`. */
  readonly omitPaths?: boolean;
  /** Read each commit's raw message body into `body`. Default `false`. */
  readonly includeBody?: boolean;
};

/** The compare-and-swap change `Git.updateRef` makes: create a new ref, or delete one that still points at a value. */
type UpdateRefChange = { readonly create: string } | { readonly delete: string };

/**
 * The comparison and rendering options `Git.diffPatch` accepts; the combination
 * and number guards run before the constructor sees them.
 */
type DiffPatchOptions = {
  readonly base?: string;
  readonly head?: string;
  readonly cached?: boolean;
  readonly noIndex?: readonly [string, string];
  readonly binary?: boolean;
  readonly unified?: number;
  readonly noRenames?: boolean;
  readonly findRenames?: number;
  readonly pathspec?: ReadonlyArray<string>;
};

/**
 * Every pre-spawn refusal `Git.diffPatch` makes: option-like revisions, paths
 * and files; a `unified` that is not a natural number; a rename score outside
 * 1..100; and the three option combinations git rejects or would misread.
 */
const rejectDiffPatchOptions = Effect.fnUntraced(function* (cwd: string, options: DiffPatchOptions) {
  const { base, cached = false, findRenames, head, noIndex, noRenames = false, pathspec = [] } = options;
  yield* rejectOptionLikeRefs(cwd, [...withDefined(withDefined([], base), head), ...pathspec, ...(noIndex ?? [])]);
  yield* rejectNonNaturalNumber(cwd, "a unified context size", options.unified);
  yield* rejectRenameScore(cwd, findRenames);
  yield* rejectCombination(
    cwd,
    head !== undefined && base === undefined,
    ["head"],
    "diffPatch needs a base for a head"
  );
  yield* rejectCombination(
    cwd,
    noRenames && findRenames !== undefined,
    ["--no-renames", "--find-renames"],
    "diffPatch cannot combine noRenames with findRenames"
  );
  yield* rejectCombination(
    cwd,
    noIndex !== undefined && (base !== undefined || cached || pathspec.length > 0),
    ["--no-index"],
    "diffPatch noIndex compares two files and takes no base, head, cached or pathspec"
  );
});

/**
 * The change-selection options the `--name-only` diff members share:
 * `diffFilter` keeps only the named status letters, `noRenames` turns rename
 * detection off, `pathspec` scopes the diff behind `--`.
 */
type DiffListOptions = {
  readonly diffFilter?: string;
  readonly noRenames?: boolean;
  readonly pathspec?: ReadonlyArray<string>;
};

/** {@link DiffListOptions} plus `head`, a commit to diff against instead of the member's default. */
type WorkingDiffOptions = DiffListOptions & { readonly head?: string };

/** The `{ index }` option the stash pop/apply/drop members accept. */
type StashIndexOptions = { readonly index?: number };

/** Records the stash index on the current span and refuses one that is not a natural number. */
const guardStashIndex = (cwd: string, index: number | undefined): Effect.Effect<void, GitCommandError> =>
  Effect.andThen(
    Effect.annotateCurrentSpan({ cwd, index: index ?? 0 }),
    rejectNonNaturalNumber(cwd, "a stash index", index)
  );

/**
 * The two outcome arms every classification mode maps identically: a missing
 * repository fails `NotARepositoryError`, and a classified failure fails with
 * its own `GitCommandError`.
 */
const repositoryFailureArms = (cwd: string) => ({
  notARepository: () => Effect.fail(NotARepositoryError.make({ cwd })),
  failure: (classified: { readonly error: GitCommandError }) => Effect.fail(classified.error),
});

/**
 * {@link repositoryFailureArms} plus the common `unknownRef` arm, which fails
 * `UnknownRefError` naming `ref` as the reference that did not resolve.
 */
const refFailureArms = (cwd: string, ref: string) => ({
  ...repositoryFailureArms(cwd),
  unknownRef: () => Effect.fail(UnknownRefError.make({ ref, cwd })),
});

/**
 * Lifts a parser's `Result` into the member's error channel: a failure
 * becomes a `GitCommandError` of kind `"failed"` whose `detail` reads
 * `unparseable <what> output: <reason>`, carrying the invocation's redacted
 * argv. Every entry parser fails closed through this one helper.
 */
const failClosed =
  (invocation: GitInvocation, cwd: string, what: string) =>
  <A>(parsed: Result.Result<A, string>): Effect.Effect<A, GitCommandError> =>
    Result.isFailure(parsed)
      ? Effect.fail(
          GitCommandError.make({
            kind: "failed",
            args: invocation.redactedArgs,
            cwd,
            stderr: "",
            detail: `unparseable ${what} output: ${parsed.failure}`,
          })
        )
      : Effect.succeed(parsed.success);

/** Builds repository operations over bound local and network execution capabilities. */
const makeShape = ({ runFor, runForNetwork }: Execution): GitShape => {
  const show: GitShape["show"] = dual(
    3,
    Effect.fn("Git.show")(function* (cwd: string, ref: string, path: string) {
      yield* Effect.annotateCurrentSpan({ cwd, ref, path });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.show(ref, path), cwd, "show");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(classified.output),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const lsTree: GitShape["lsTree"] = dual(
    stringAt(1),
    Effect.fn("Git.lsTree")(function* (
      cwd: string,
      ref: string,
      options?: { readonly pathspec?: ReadonlyArray<string>; readonly fullTree?: boolean }
    ) {
      const fullTree = options?.fullTree ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, ref, fullTree });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const invocation = GitCommand.lsTree(ref, options?.pathspec ?? [], fullTree);
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => failClosed(invocation, cwd, "ls-tree")(parseLsTree(classified.output)),
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const refExists: GitShape["refExists"] = dual(
    2,
    Effect.fn("Git.refExists")(function* (cwd: string, ref: string) {
      yield* Effect.annotateCurrentSpan({ cwd, ref });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.refExists(ref), cwd, "refExists");
      return yield* Match.valueTags(classified, {
        success: () => Effect.succeed(true),
        refMissing: () => Effect.succeed(false),
        ...repositoryFailureArms(cwd),
        unknownRef: // A ref that doesn't resolve IS the negative answer this method
          // promises — never an error, and never a defect.
          () => Effect.succeed(false),
      });
    })
  );

  const mergeBase: GitShape["mergeBase"] = dual(
    3,
    Effect.fn("Git.mergeBase")(function* (cwd: string, a: string, b: string) {
      yield* Effect.annotateCurrentSpan({ cwd, a, b });
      yield* rejectOptionLikeRefs(cwd, [a, b]);
      const classified = yield* runFor(GitCommand.mergeBase(a, b), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(Str.trim(classified.output)),
        ...refFailureArms(cwd, `${a}...${b}`),
      });
    })
  );

  const mergeBaseOption: GitShape["mergeBaseOption"] = dual(
    3,
    Effect.fn("Git.mergeBaseOption")(function* (cwd: string, a: string, b: string) {
      yield* Effect.annotateCurrentSpan({ cwd, a, b });
      yield* rejectOptionLikeRefs(cwd, [a, b]);
      // "quiet" kind: no common ancestor is a SILENT exit 1 (probed against
      // git 2.54) — the legitimate "these histories are disjoint" answer,
      // degraded to Option.none. An unknown ref still exits 128 with a
      // `Not a valid object name` stderr and stays UnknownRefError; a NOISY
      // exit 1 stays a loud GitCommandError.
      const classified = yield* runFor(GitCommand.mergeBase(a, b), cwd, "quiet");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(Str.trim(classified.output)),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, `${a}...${b}`),
      });
    })
  );

  const mergeTree: GitShape["mergeTree"] = dual(
    3,
    Effect.fn("Git.mergeTree")(function* (cwd: string, base: string, head: string) {
      yield* Effect.annotateCurrentSpan({ cwd, base, head });
      yield* rejectOptionLikeRefs(cwd, [base, head]);
      const invocation = GitCommand.mergeTree(base, head);
      // "differs" kind: a conflict is a SILENT exit 1 whose stdout carries the
      // conflicted tree, which is data rather than a failure. A revision git
      // cannot resolve also exits 1, but names itself on stderr and stays an
      // UnknownRefError.
      const classified = yield* runFor(invocation, cwd, "differs");
      return yield* Match.valueTags(classified, {
        success: (classified) => failClosed(invocation, cwd, "merge-tree")(parseMergeTree(classified.output, false)),
        differs: (classified) => failClosed(invocation, cwd, "merge-tree")(parseMergeTree(classified.output, true)),
        ...refFailureArms(cwd, `${base}...${head}`),
      });
    })
  );

  const isAncestor: GitShape["isAncestor"] = dual(
    3,
    Effect.fn("Git.isAncestor")(function* (cwd: string, ancestor: string, descendant: string) {
      yield* Effect.annotateCurrentSpan({ cwd, ancestor, descendant });
      yield* rejectOptionLikeRefs(cwd, [ancestor, descendant]);
      // "quiet" kind: a non-ancestor is a SILENT exit 1 — the negative
      // answer this member promises, never an error. An unknown object still
      // exits 128 with a `Not a valid object name` stderr and stays
      // UnknownRefError; a NOISY exit 1 stays a loud GitCommandError.
      const classified = yield* runFor(GitCommand.isAncestor(ancestor, descendant), cwd, "quiet");
      return yield* Match.valueTags(classified, {
        success: () => Effect.succeed(true),
        absent: () => Effect.succeed(false),
        ...refFailureArms(cwd, `${ancestor}...${descendant}`),
      });
    })
  );

  const changedFiles: GitShape["changedFiles"] = dual(
    2,
    Effect.fn("Git.changedFiles")(function* (
      cwd: string,
      options: DiffListOptions & {
        readonly base: string;
        readonly head: string;
        readonly relative?: boolean;
        readonly twoDot?: boolean;
      }
    ) {
      const { diffFilter, noRenames = false, pathspec = [], twoDot = false } = options;
      const relative = options.relative ?? false;
      yield* Effect.annotateCurrentSpan({
        cwd,
        base: options.base,
        head: options.head,
        relative,
        twoDot,
        pathspec: pathspec.length,
      });
      yield* rejectOptionLikeRefs(cwd, [options.base, options.head, ...pathspec]);
      yield* rejectDiffFilter(cwd, diffFilter);
      const classified = yield* runFor(
        GitCommand.changedFiles(options.base, options.head, relative, {
          ...O.getSomesStruct({ diffFilter: O.fromUndefinedOr(diffFilter) }),
          noRenames,
          pathspec,
          twoDot,
        }),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseNulSeparated(classified.output)),
        ...refFailureArms(cwd, twoDot ? `${options.base}..${options.head}` : `${options.base}...${options.head}`),
      });
    })
  );

  // Runs a NUL-separated, ref-free path listing (the working-tree queries) and
  // classifies through the shared path. No ref is involved, so `unknownRef`
  // cannot arise in practice — it is handled defensively to keep the match
  // exhaustive and the error channel uniform with the ref-taking methods.
  const collectPaths: {
    (
      method: string,
      invocation: GitInvocation,
      cwd: string
    ): Effect.Effect<ReadonlyArray<string>, NotARepositoryError | UnknownRefError | GitCommandError>;
    (
      invocation: GitInvocation,
      cwd: string
    ): (
      method: string
    ) => Effect.Effect<ReadonlyArray<string>, NotARepositoryError | UnknownRefError | GitCommandError>;
  } = dual(
    3,
    Effect.fnUntraced(function* (_method: string, invocation: GitInvocation, cwd: string) {
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseNulSeparated(classified.output)),
        ...refFailureArms(cwd, "working tree"),
      });
    })
  );

  /**
   * The pre-spawn guards and constructor options the two working-tree diffs
   * share: `head` and the pathspec through the option-like guard, the filter
   * through its domain check, and the validated options in constructor shape.
   */
  const workingDiffOptions = Effect.fnUntraced(function* (cwd: string, options: WorkingDiffOptions) {
    const { diffFilter, head, noRenames = false, pathspec = [] } = options;
    yield* rejectOptionLikeRefs(cwd, [...withDefined([], head), ...pathspec]);
    yield* rejectDiffFilter(cwd, diffFilter);
    return {
      ...O.getSomesStruct({ diffFilter: O.fromUndefinedOr(diffFilter), head: O.fromUndefinedOr(head) }),
      noRenames,
      pathspec,
    };
  });

  const unstagedChanges: GitShape["unstagedChanges"] = dual(
    hasStringSubject,
    Effect.fn("Git.unstagedChanges")(function* (
      cwd: string,
      options?: WorkingDiffOptions & { readonly relative?: boolean }
    ) {
      const relative = options?.relative ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, relative, head: options?.head ?? "(index)" });
      const rendered = yield* workingDiffOptions(cwd, options ?? {});
      return yield* collectPaths("Git.unstagedChanges", GitCommand.unstagedChanges(relative, rendered), cwd);
    })
  );

  const stagedChanges: GitShape["stagedChanges"] = dual(
    hasStringSubject,
    Effect.fn("Git.stagedChanges")(function* (
      cwd: string,
      options?: WorkingDiffOptions & { readonly relative?: boolean }
    ) {
      const relative = options?.relative ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, relative, head: options?.head ?? "HEAD" });
      const rendered = yield* workingDiffOptions(cwd, options ?? {});
      return yield* collectPaths("Git.stagedChanges", GitCommand.stagedChanges(relative, rendered), cwd);
    })
  );

  const untrackedFiles: GitShape["untrackedFiles"] = dual(
    hasStringSubject,
    Effect.fn("Git.untrackedFiles")(function* (
      cwd: string,
      options?: { readonly relative?: boolean; readonly pathspec?: ReadonlyArray<string> }
    ) {
      const relative = options?.relative ?? false;
      const pathspec = options?.pathspec ?? [];
      yield* Effect.annotateCurrentSpan({ cwd, relative, pathspec: pathspec.length });
      yield* rejectOptionLikeRefs(cwd, pathspec);
      return yield* collectPaths("Git.untrackedFiles", GitCommand.untrackedFiles(relative, pathspec), cwd);
    })
  );

  const workingChanges: GitShape["workingChanges"] = dual(
    hasStringSubject,
    Effect.fn("Git.workingChanges")(function* (cwd: string, options?: { readonly relative?: boolean }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        relative: options?.relative ?? false,
      });
      const unstaged = yield* unstagedChanges(cwd, options);
      const staged = yield* stagedChanges(cwd, options);
      const untracked = yield* untrackedFiles(cwd, options);
      return A.dedupe([...unstaged, ...staged, ...untracked]);
    })
  );

  const nameStatus: GitShape["nameStatus"] = dual(
    2,
    Effect.fn("Git.nameStatus")(function* (
      cwd: string,
      options: {
        readonly base: string;
        readonly head?: string;
        readonly relative?: boolean;
        readonly findRenames?: number;
        readonly noRenames?: boolean;
        readonly diffFilter?: string;
        readonly pathspec?: ReadonlyArray<string>;
        readonly twoDot?: boolean;
      }
    ) {
      const { diffFilter, findRenames, noRenames = false, pathspec = [], twoDot = false } = options;
      const relative = options.relative ?? false;
      yield* Effect.annotateCurrentSpan({
        cwd,
        base: options.base,
        head: options.head ?? "(working tree)",
        relative,
        twoDot,
        pathspec: pathspec.length,
      });
      yield* rejectOptionLikeRefs(cwd, [...withDefined([options.base], options.head), ...pathspec]);
      yield* rejectRenameScore(cwd, findRenames);
      yield* rejectDiffFilter(cwd, diffFilter);
      yield* rejectCombination(
        cwd,
        noRenames && findRenames !== undefined,
        ["--no-renames", "--find-renames"],
        "nameStatus cannot combine noRenames with findRenames"
      );
      const invocation = GitCommand.nameStatus(options.base, options.head, relative, {
        ...O.getSomesStruct({ findRenames: O.fromUndefinedOr(findRenames) }),
        ...O.getSomesStruct({ diffFilter: O.fromUndefinedOr(diffFilter) }),
        noRenames,
        pathspec,
        twoDot,
      });
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => failClosed(invocation, cwd, "name-status")(parseNameStatus(classified.output)),
        ...refFailureArms(
          cwd,
          options.head === undefined
            ? options.base
            : twoDot
              ? `${options.base}..${options.head}`
              : `${options.base}...${options.head}`
        ),
      });
    })
  );

  const revParse: GitShape["revParse"] = dual(
    stringAt(1),
    Effect.fn("Git.revParse")(function* (
      cwd: string,
      ref: string,
      options?: { readonly peel?: "commit"; readonly quiet?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, ref, quiet: options?.quiet ?? false });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      // The "revParse" kind reads `--verify`'s own unknown-ref shapes: the
      // `Needed a single revision` diagnostic, and `--quiet`'s silent exit 1.
      const classified = yield* runFor(GitCommand.revParse(ref, options), cwd, "revParse");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(Str.trim(classified.output)),
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const checkout: GitShape["checkout"] = dual(
    stringAt(1),
    Effect.fn("Git.checkout")(function* (cwd: string, ref: string, options?: { readonly detach?: boolean }) {
      const detach = options?.detach ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, ref, detach });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.checkout(ref, detach), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const reset: GitShape["reset"] = dual(
    hasStringSubject,
    Effect.fn("Git.reset")(function* (
      cwd: string,
      options?: {
        readonly mode?: "soft" | "mixed" | "hard";
        readonly ref?: string;
      }
    ) {
      const { mode = "mixed", ref } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, mode, ref: ref ?? "HEAD" });
      yield* rejectOptionLikeRefs(cwd, withDefined([], ref));
      const classified = yield* runFor(GitCommand.reset(mode, ref), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, ref ?? "HEAD"),
      });
    })
  );

  const clean: GitShape["clean"] = dual(
    hasStringSubject,
    Effect.fn("Git.clean")(function* (
      cwd: string,
      options?: {
        readonly directories?: boolean;
        readonly ignored?: boolean;
        readonly paths?: ReadonlyArray<string>;
      }
    ) {
      const directories = options?.directories ?? false;
      const ignored = options?.ignored ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, directories, ignored });
      const classified = yield* runFor(GitCommand.clean(directories, ignored, options?.paths ?? []), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "working tree"),
      });
    })
  );

  const restore: GitShape["restore"] = dual(
    hasStringSubject,
    Effect.fn("Git.restore")(function* (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly source?: string;
        readonly staged?: boolean;
        readonly worktree?: boolean;
      }
    ) {
      const { source, staged = false, worktree = false } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, count: paths.length, source: source ?? "(index)" });
      yield* rejectOptionLikeRefs(cwd, withDefined([], source));
      const classified = yield* runFor(GitCommand.restore(paths, source, staged, worktree), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, source ?? "working tree"),
      });
    })
  );

  const branchCreate: GitShape["branchCreate"] = dual(
    stringAt(1),
    Effect.fn("Git.branchCreate")(function* (
      cwd: string,
      name: string,
      options?: {
        readonly startPoint?: string;
        readonly checkout?: boolean;
        readonly force?: boolean;
      }
    ) {
      const { checkout: checkoutBranch = false, force = false, startPoint } = options ?? {};
      yield* Effect.annotateCurrentSpan({
        cwd,
        name,
        startPoint: startPoint ?? "HEAD",
        checkout: checkoutBranch,
        force,
      });
      yield* rejectOptionLikeRefs(cwd, withDefined([name], startPoint));
      const classified = yield* runFor(
        GitCommand.branchCreate(name, startPoint, checkoutBranch, force),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, startPoint ?? name),
      });
    })
  );

  const branchDelete: GitShape["branchDelete"] = dual(
    stringAt(1),
    Effect.fn("Git.branchDelete")(function* (cwd: string, name: string, options?: { readonly force?: boolean }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        name,
        force: options?.force ?? false,
      });
      yield* rejectOptionLikeRefs(cwd, [name]);
      const classified = yield* runFor(GitCommand.branchDelete(name, options?.force ?? false), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, name),
      });
    })
  );

  const isShallow = Effect.fn("Git.isShallow")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    const classified = yield* runFor(GitCommand.isShallow(), cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: // rev-parse --is-shallow-repository prints exactly "true" or "false".
        (classified) => Effect.succeed(Str.trim(classified.output) === "true"),
      ...refFailureArms(cwd, "HEAD"),
    });
  });

  const fetchUnshallow: GitShape["fetchUnshallow"] = dual(
    hasStringSubject,
    Effect.fn("Git.fetchUnshallow")(function* (cwd: string, options?: { readonly remote?: string }) {
      const remote = options?.remote ?? "origin";
      yield* Effect.annotateCurrentSpan({ cwd });
      yield* rejectOptionLikeRefs(cwd, [remote]);
      const classified = yield* runForNetwork(GitCommand.fetchUnshallow(remote), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "--unshallow"),
      });
    })
  );

  const fetch: GitShape["fetch"] = dual(
    2,
    Effect.fn("Git.fetch")(function* (
      cwd: string,
      options: {
        readonly ref?: string;
        readonly remote?: string;
        readonly depth?: number;
        readonly tag?: boolean;
        readonly unshallow?: boolean;
        readonly prune?: boolean;
        readonly noTags?: boolean;
        readonly noWriteFetchHead?: boolean;
      }
    ) {
      const {
        depth,
        noTags = false,
        noWriteFetchHead = false,
        prune = false,
        ref,
        remote = "origin",
        tag = false,
        unshallow = false,
      } = options;
      const target = O.fromUndefinedOr(ref);
      const refLabel = O.getOrElse(target, () => "(configured refspecs)");
      yield* Effect.annotateCurrentSpan({
        cwd,
        ref: refLabel,
        tag,
        unshallow,
        prune,
        noTags,
        noWriteFetchHead,
      });
      yield* rejectOptionLikeRefs(cwd, withDefined([remote], ref));
      yield* rejectNonNaturalNumber(cwd, "a fetch depth", depth);
      // `git fetch <remote> tag` with no name is a usage error; refused typed.
      yield* rejectCombination(cwd, tag && O.isNone(target), ["tag"], "fetch needs a ref to fetch as a tag");
      // git itself rejects the pair (`--depth and --unshallow cannot be used
      // together`, exit 128) — refused typed pre-spawn, the submoduleDeinit
      // constraint-refusal precedent.
      yield* rejectCombination(
        cwd,
        unshallow && depth !== undefined,
        ["--unshallow", "--depth", String(depth)],
        "fetch cannot combine unshallow with depth (git rejects the pair)"
      );
      const classified = yield* runForNetwork(
        GitCommand.fetch(remote, ref, depth, tag, unshallow, prune, { noTags, noWriteFetchHead }),
        cwd,
        "generic"
      );
      // Without a ref the label stays generic: `remote` may be a URL carrying credentials.
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, refLabel),
      });
    })
  );

  const fetchAny: GitShape["fetchAny"] = dual(
    2,
    Effect.fn("Git.fetchAny")(function* (
      cwd: string,
      options: {
        readonly ref: string;
        readonly remote?: string;
        readonly depth?: number;
        readonly prune?: boolean;
      }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, ref: options.ref });
      return yield* fetch(cwd, { ...options, tag: true }).pipe(
        // UnknownRefError is the typed "not a tag on the remote" signal; a
        // GitCommandError keeps unclassified tag-form stderr shapes on the
        // fallback path too. NotARepositoryError deliberately propagates —
        // the plain form would fail identically, so the retry is pure waste.
        // A refused GitCommandError (kind "refused") is a pre-spawn guard
        // rejection — an option-like remote or ref — that the plain form's own
        // guard would reproduce identically: it short-circuits here rather than
        // routing through a phantom fallback and re-rejecting. Routing on `kind`
        // is why fetchAny no longer duplicates the guard up front.
        Effect.catchTag(["UnknownRefError", "GitCommandError"], (error) =>
          error._tag === "GitCommandError" && error.kind === "refused" ? Effect.fail(error) : fetch(cwd, options)
        )
      );
    })
  );

  const submoduleUpdate: GitShape["submoduleUpdate"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleUpdate")(function* (
      cwd: string,
      options?: {
        readonly init?: boolean;
        readonly depth?: number;
        readonly paths?: ReadonlyArray<string>;
        readonly checkout?: boolean;
        readonly remote?: boolean;
        readonly fetch?: false;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ) {
      const {
        checkout = false,
        depth,
        fetch,
        force = false,
        init = false,
        paths = [],
        recursive = false,
        remote = false,
      } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, init, checkout });
      yield* rejectNonNaturalNumber(cwd, "a submodule update depth", depth);
      const classified = yield* runForNetwork(
        GitCommand.submoduleUpdate(init, depth, paths, {
          checkout,
          remote,
          recursive,
          force,
          // exactOptionalPropertyTypes: `fetch` only exists when the caller
          // asked for --no-fetch; an explicit undefined is not assignable.
          ...(fetch === false ? { fetch: false as const } : {}),
        }),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule update"),
      });
    })
  );

  const submoduleAdd: GitShape["submoduleAdd"] = dual(
    2,
    Effect.fn("Git.submoduleAdd")(function* (
      cwd: string,
      options: {
        readonly url: string;
        readonly path: string;
        readonly depth?: number;
      }
    ) {
      // The url is deliberately NOT annotated: a URL can embed userinfo, and
      // span annotations carry stable identifiers only (the redaction policy).
      yield* Effect.annotateCurrentSpan({ cwd, path: options.path });
      yield* rejectNonNaturalNumber(cwd, "a submodule add depth", options.depth);
      const classified = yield* runForNetwork(
        GitCommand.submoduleAdd(options.url, options.path, options.depth),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, options.path),
      });
    })
  );

  const sparseCheckoutSet: GitShape["sparseCheckoutSet"] = dual(
    3,
    Effect.fn("Git.sparseCheckoutSet")(function* (
      cwd: string,
      patterns: ReadonlyArray<string>,
      options: { readonly cone: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, cone: options.cone });
      yield* rejectOptionLikeRefs(cwd, patterns);
      const classified = yield* runFor(GitCommand.sparseCheckoutSet(patterns, options.cone), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "sparse-checkout"),
      });
    })
  );

  const configSet: GitShape["configSet"] = dual(
    stringAt(2),
    Effect.fn("Git.configSet")(function* (
      cwd: string,
      key: string,
      value: string,
      options?: { readonly file?: string }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        file: options?.file ?? "(repository config)",
      });
      // git config has no documented -- separator, so key, value AND file are all
      // guarded — a leading-dash value is refused typed rather than risking git
      // reading it as a flag. Recorded limitation: a legitimate "-..." config
      // value cannot be written through this method. The value rides the
      // SENSITIVE arm: a refused config value is reported as <redacted>, never
      // echoed into the error (the redaction policy).
      yield* rejectOptionLikeRefs(cwd, [key, ...(options?.file !== undefined ? [options.file] : [])], [value]);
      const classified = yield* runFor(GitCommand.configSet(key, value, options?.file), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, key),
      });
    })
  );

  const add: GitShape["add"] = dual(
    hasStringSubject,
    Effect.fn("Git.add")(function* (cwd: string, paths: ReadonlyArray<string>, options?: { readonly force?: boolean }) {
      const force = options?.force ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, count: paths.length, force });
      const classified = yield* runFor(GitCommand.add(paths, force), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "working tree"),
      });
    })
  );

  const defaultBranch: GitShape["defaultBranch"] = dual(
    hasStringSubject,
    Effect.fn("Git.defaultBranch")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
      }
    ) {
      const remote = options?.remote ?? "origin";
      yield* Effect.annotateCurrentSpan({ cwd, remote });
      yield* rejectOptionLikeRefs(cwd, [remote]);
      const classified = yield* runFor(GitCommand.defaultBranch(remote), cwd, "quiet");
      return yield* Match.valueTags(classified, {
        success: (classified) => {
          const short = Str.trim(classified.output);
          const prefix = `${remote}/`;
          return Effect.succeedSome(Str.startsWith(prefix)(short) ? Str.slice(prefix.length)(short) : short);
        },
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, `refs/remotes/${remote}/HEAD`),
      });
    })
  );

  const currentBranch: GitShape["currentBranch"] = dual(
    hasStringSubject,
    Effect.fn("Git.currentBranch")(function* (cwd: string, options?: { readonly mode?: CurrentBranchMode }) {
      const mode = options?.mode ?? "abbrev-ref";
      yield* Effect.annotateCurrentSpan({ cwd, mode });
      const classified = yield* runFor(GitCommand.currentBranch(mode), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => {
          const name = Str.trim(classified.output);
          // A detached HEAD answers with the literal string "HEAD" under
          // --abbrev-ref and with an EMPTY line under --show-current (both
          // exit 0) — "no current branch" is the honest typed answer either
          // way, not a fake name.
          return Effect.succeed(name === "HEAD" || name === "" ? O.none() : O.some(name));
        },
        ...refFailureArms(cwd, "HEAD"),
      });
    })
  );

  const repoRoot = Effect.fn("Git.repoRoot")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    const classified = yield* runFor(GitCommand.repoRoot(), cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: (classified) => Effect.succeed(Str.trim(classified.output)),
      ...refFailureArms(cwd, "working tree"),
    });
  });

  /**
   * Runs one `rev-parse --path-format=absolute` query and answers its path.
   * `what` names the output in the old-git failure detail and `method` names
   * the member in the defensive unknown-ref defect, which no path query can
   * reach through git's own stderr.
   */
  const absolutePathQuery = Effect.fnUntraced(function* (
    method: string,
    what: string,
    invocation: GitInvocation,
    cwd: string
  ) {
    const classified = yield* runFor(invocation, cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: Effect.fnUntraced(function* (classified) {
        // Strip only git's terminating newline, never `trim`: the answer is an
        // identity, and a directory name may end in whitespace.
        const answer = Str.replace(/\n$/, "")(classified.output);
        // git before 2.31 does not know --path-format: rev-parse echoes the flag
        // to stdout, answers the relative form on the next line, and exits 0.
        if (Str.startsWith("-")(answer)) {
          return yield* GitCommandError.make({
            kind: "failed",
            args: invocation.redactedArgs,
            cwd,
            stderr: "",
            detail: `unparseable ${what} output (--path-format needs git 2.31 or later): ${yield* encodeJsonString(answer).pipe(Effect.orDie)}`,
          });
        }
        return answer;
      }),
      unknownRef: () => Effect.die(`${method}: unexpected classification "unknownRef"`),
      ...repositoryFailureArms(cwd),
    });
  });

  const commonDir = Effect.fn("Git.commonDir")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    return yield* absolutePathQuery("Git.commonDir", "common-dir", GitCommand.commonDir(), cwd);
  });

  const gitDir: GitShape["gitDir"] = dual(
    hasStringSubject,
    Effect.fn("Git.gitDir")(function* (cwd: string, options?: { readonly path?: string }) {
      const path = options?.path;
      yield* Effect.annotateCurrentSpan({ cwd, path: path ?? "(git dir)" });
      yield* rejectOptionLikeRefs(cwd, withDefined([], path));
      return yield* absolutePathQuery(
        "Git.gitDir",
        path === undefined ? "git-dir" : "git-path",
        GitCommand.gitDir(path),
        cwd
      );
    })
  );

  const configGet: GitShape["configGet"] = dual(
    stringAt(1),
    Effect.fn("Git.configGet")(function* (cwd: string, key: string, options?: { readonly scope?: GitConfigScope }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        scope: options?.scope ?? "(merged)",
      });
      yield* rejectOptionLikeRefs(cwd, [key]);
      const classified = yield* runFor(GitCommand.configGet(key, options?.scope), cwd, "quiet");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(Str.trim(classified.output)),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, key),
      });
    })
  );

  const remoteUrl: GitShape["remoteUrl"] = dual(
    hasStringSubject,
    Effect.fn("Git.remoteUrl")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly push?: boolean;
      }
    ) {
      const remote = options?.remote ?? "origin";
      const push = options?.push ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, remote, push });
      yield* rejectOptionLikeRefs(cwd, [remote]);
      const classified = yield* runFor(GitCommand.remoteUrl(remote, push), cwd, "noSuchRemote");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(Str.trim(classified.output)),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, remote),
      });
    })
  );

  const commitInfo = Effect.fn("Git.commitInfo")(function* (cwd: string, ref?: string) {
    const target = ref ?? "HEAD";
    yield* Effect.annotateCurrentSpan({ cwd, ref: target });
    yield* rejectOptionLikeRefs(cwd, [target]);
    const invocation = GitCommand.commitInfo(target);
    const classified = yield* runFor(invocation, cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: (classified) =>
        Effect.fromOption(parseCommitInfo(classified.output), () =>
          GitCommandError.make({
            kind: "failed",
            args: invocation.redactedArgs,
            cwd,
            stderr: "",
            detail: "unparseable commitInfo output: expected two NUL separators and a valid signature status",
          })
        ),
      ...refFailureArms(cwd, target),
    });
  });

  const log: GitShape["log"] = dual(
    hasStringSubject,
    Effect.fn("Git.log")(function* (cwd: string, options?: LogOptions) {
      const {
        diffFilter,
        findRenames,
        firstParentDiffMerges = false,
        follow = false,
        includeBody = false,
        limit,
        nameStatus = false,
        noMerges = false,
        omitPaths = false,
        paths = [],
        quotePath,
        reverse = false,
        revisions = [],
        since,
      } = options ?? {};
      // Path VALUES are stable identifiers, but a pathspec can be long and is
      // caller-controlled; the count is what a trace needs to correlate.
      yield* Effect.annotateCurrentSpan({
        cwd,
        paths: paths.length,
        revisions: revisions.length,
        follow,
        nameStatus,
        omitPaths,
        includeBody,
      });
      yield* rejectOptionLikeRefs(cwd, revisions);
      yield* rejectNonNaturalNumber(cwd, "a log limit", limit);
      yield* rejectRenameScore(cwd, findRenames);
      yield* rejectDiffFilter(cwd, diffFilter);
      yield* rejectCombination(
        cwd,
        omitPaths && nameStatus,
        ["--name-status"],
        "log cannot read name-status changes while omitting paths"
      );
      const invocation = GitCommand.log(paths, follow, limit, firstParentDiffMerges, {
        ...O.getSomesStruct({
          diffFilter: O.fromUndefinedOr(diffFilter),
          findRenames: O.fromUndefinedOr(findRenames),
          quotePath: O.fromUndefinedOr(quotePath),
          since: O.fromUndefinedOr(since),
        }),
        includeBody,
        nameStatus,
        noMerges,
        omitPaths,
        reverse,
        revisions,
      });
      const parse = parseLogFor({ includeBody, nameStatus });
      if (follow && paths.length !== 1) {
        // git's own restriction, refused pre-spawn: `--follow` walks ONE
        // path's history, and git's own diagnostic for the violation is an
        // unclassifiable usage error.
        return yield* GitCommandError.make({
          kind: "refused",
          args: invocation.redactedArgs,
          cwd,
          stderr: "",
          detail: `refused --follow: git follows exactly one path, received ${paths.length}`,
        });
      }
      const classified = yield* runFor(invocation, cwd, "log");
      return yield* Match.valueTags(classified, {
        success: (classified) => failClosed(invocation, cwd, "log")(parse(classified.output)),
        absent: () => {
          // An unborn HEAD — however this git spells it — has no history,
          // which is the empty log, never a failure. `Git.log` takes no ref,
          // so there is no ref for an UnknownRefError to name and the error
          // is absent from this member's union by construction.
          const empty: ReadonlyArray<CommitLogEntry> = [];
          return Effect.succeed(empty);
        },
        ...repositoryFailureArms(cwd),
        unknownRef: () => {
          // A walk from HEAD names no ref of its own, so an unborn HEAD,
          // however this git spells it, has no history: the empty log. A walk
          // from caller revisions names them, and one that does not resolve
          // is the caller's typed UnknownRefError.
          const empty: ReadonlyArray<CommitLogEntry> = [];
          return A.isReadonlyArrayNonEmpty(revisions)
            ? Effect.fail(UnknownRefError.make({ ref: A.join(revisions, " "), cwd }))
            : Effect.succeed(empty);
        },
      });
    })
  );

  const status: GitShape["status"] = dual(
    hasStringSubject,
    Effect.fn("Git.status")(function* (
      cwd: string,
      options?: {
        readonly ignoreSubmodules?: StatusIgnoreSubmodules;
        readonly noOptionalLocks?: boolean;
        readonly noRenames?: boolean;
        readonly pathspec?: ReadonlyArray<string>;
        readonly untrackedFiles?: StatusUntrackedFiles;
      }
    ) {
      const {
        ignoreSubmodules,
        noOptionalLocks = false,
        noRenames = false,
        pathspec = [],
        untrackedFiles,
      } = options ?? {};
      yield* Effect.annotateCurrentSpan({
        cwd,
        untrackedFiles: untrackedFiles ?? "(default)",
        ignoreSubmodules: ignoreSubmodules ?? "(default)",
        noRenames,
        noOptionalLocks,
        pathspec: pathspec.length,
      });
      yield* rejectOptionLikeRefs(cwd, pathspec);
      const invocation = GitCommand.status({
        ...O.getSomesStruct({
          ignoreSubmodules: O.fromUndefinedOr(ignoreSubmodules),
          untrackedFiles: O.fromUndefinedOr(untrackedFiles),
        }),
        noOptionalLocks,
        noRenames,
        pathspec,
      });
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => failClosed(invocation, cwd, "status")(parseStatus(classified.output)),
        ...refFailureArms(cwd, "working tree"),
      });
    })
  );

  const submoduleStatus: GitShape["submoduleStatus"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleStatus")(function* (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        recursive: options?.recursive ?? false,
      });
      const classified = yield* runFor(
        GitCommand.submoduleStatus(options?.paths ?? [], options?.recursive ?? false),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseSubmoduleStatus(classified.output)),
        ...refFailureArms(cwd, "submodule status"),
      });
    })
  );

  const submoduleInit: GitShape["submoduleInit"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleInit")(function* (cwd: string, options?: { readonly paths?: ReadonlyArray<string> }) {
      yield* Effect.annotateCurrentSpan({ cwd });
      const classified = yield* runFor(GitCommand.submoduleInit(options?.paths ?? []), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule init"),
      });
    })
  );

  const submoduleDeinit: GitShape["submoduleDeinit"] = dual(
    2,
    Effect.fn("Git.submoduleDeinit")(function* (
      cwd: string,
      options: {
        readonly paths?: ReadonlyArray<string>;
        readonly all?: boolean;
        readonly force?: boolean;
      }
    ) {
      const paths = options.paths ?? [];
      const all = options.all ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, all, count: paths.length });
      if (!all && paths.length === 0) {
        // git itself refuses deinit with neither --all nor a pathspec; refusing
        // pre-spawn keeps the contract explicit and spawn-free.
        return yield* GitCommandError.make({
          kind: "refused",
          args: ["submodule", "deinit"],
          cwd,
          stderr: "",
          detail: "refused: submoduleDeinit needs either paths or all: true",
        });
      }
      const classified = yield* runFor(GitCommand.submoduleDeinit(paths, all, options.force ?? false), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule deinit"),
      });
    })
  );

  const submoduleSync: GitShape["submoduleSync"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleSync")(function* (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        recursive: options?.recursive ?? false,
      });
      const classified = yield* runFor(
        GitCommand.submoduleSync(options?.paths ?? [], options?.recursive ?? false),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule sync"),
      });
    })
  );

  const submoduleSetUrl: GitShape["submoduleSetUrl"] = dual(
    3,
    Effect.fn("Git.submoduleSetUrl")(function* (cwd: string, path: string, url: string) {
      // The url is deliberately NOT annotated: a URL can embed userinfo, and
      // span annotations carry stable identifiers only (the redaction policy).
      yield* Effect.annotateCurrentSpan({ cwd, path });
      const classified = yield* runFor(GitCommand.submoduleSetUrl(path, url), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, path),
      });
    })
  );

  const submoduleSetBranch: GitShape["submoduleSetBranch"] = dual(
    stringAt(1),
    Effect.fn("Git.submoduleSetBranch")(function* (cwd: string, path: string, options?: { readonly branch?: string }) {
      const branch = options?.branch;
      yield* Effect.annotateCurrentSpan({
        cwd,
        path,
        branch: branch ?? "(default)",
      });
      if (branch !== undefined) {
        yield* rejectOptionLikeRefs(cwd, [branch]);
      }
      const classified = yield* runFor(GitCommand.submoduleSetBranch(path, branch), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, branch ?? path),
      });
    })
  );

  const submoduleAbsorbgitdirs: GitShape["submoduleAbsorbgitdirs"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleAbsorbgitdirs")(function* (
      cwd: string,
      options?: { readonly paths?: ReadonlyArray<string> }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd });
      const classified = yield* runFor(GitCommand.submoduleAbsorbgitdirs(options?.paths ?? []), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule absorbgitdirs"),
      });
    })
  );

  const submoduleForeach: GitShape["submoduleForeach"] = dual(
    stringAt(1),
    Effect.fn("Git.submoduleForeach")(function* (
      cwd: string,
      command: string,
      options?: { readonly recursive?: boolean; readonly quiet?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        recursive: options?.recursive ?? false,
        quiet: options?.quiet ?? false,
      });
      // The command is a positional git would read as a flag if it led with a
      // dash — the same option-injection guard as refs.
      yield* rejectOptionLikeRefs(cwd, [command]);
      const classified = yield* runFor(
        GitCommand.submoduleForeach(command, options?.recursive ?? false, options?.quiet ?? false),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(classified.output),
        ...refFailureArms(cwd, "submodule foreach"),
      });
    })
  );

  // Runs a void-returning invocation and classifies through the shared path,
  // mapping `unknownRef` to the given ref label — the shared shape of every
  // mutating method with no method-specific classification rows.
  const runVoid: {
    (
      method: string,
      invocation: GitInvocation,
      cwd: string,
      refLabel: string
    ): Effect.Effect<void, NotARepositoryError | UnknownRefError | GitCommandError>;
    (
      invocation: GitInvocation,
      cwd: string,
      refLabel: string
    ): (method: string) => Effect.Effect<void, NotARepositoryError | UnknownRefError | GitCommandError>;
  } = dual(
    4,
    Effect.fnUntraced(function* (_method: string, invocation: GitInvocation, cwd: string, refLabel: string) {
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, refLabel),
      });
    })
  );

  // Runs a parse-returning invocation and classifies through the shared path.
  // `absent` handles the `"quiet"` kind's silent-exit-1 degrade (an unset
  // config key, a no-paths-ignored check-ignore run).
  const runParsed: {
    <A>(
      method: string,
      invocation: GitInvocation,
      cwd: string,
      refLabel: string,
      kind: "generic" | "quiet",
      parse: (output: string) => A,
      network?: boolean
    ): Effect.Effect<A, NotARepositoryError | UnknownRefError | GitCommandError>;
    <A>(
      invocation: GitInvocation,
      cwd: string,
      refLabel: string,
      kind: "generic" | "quiet",
      parse: (output: string) => A,
      network?: boolean
    ): (method: string) => Effect.Effect<A, NotARepositoryError | UnknownRefError | GitCommandError>;
  } = dual(
    hasStringSubject,
    Effect.fnUntraced(function* <A>(
      _method: string,
      invocation: GitInvocation,
      cwd: string,
      refLabel: string,
      kind: "generic" | "quiet",
      parse: (output: string) => A,
      /** Whether this member reaches a remote and so needs the ssh pin resolved. */
      network = false
    ) {
      const classified = yield* (network ? runForNetwork : runFor)(invocation, cwd, kind);
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parse(classified.output)),
        absent: () => Effect.succeed(parse("")),
        ...refFailureArms(cwd, refLabel),
      });
    })
  );

  // `runParsed` for a parser that can FAIL: `what` names the output in the
  // `unparseable <what> output: …` detail the failure is mapped to.
  const runParsedChecked = Effect.fnUntraced(function* <A>(
    method: string,
    invocation: GitInvocation,
    cwd: string,
    refLabel: string,
    what: string,
    parse: (output: string) => Result.Result<A, string>
  ) {
    const parsed = yield* runParsed(method, invocation, cwd, refLabel, "generic", parse);
    return yield* failClosed(invocation, cwd, what)(parsed);
  });

  const lsRemote: GitShape["lsRemote"] = dual(
    stringAt(1),
    Effect.fn("Git.lsRemote")(function* (
      cwd: string,
      remote: string,
      options?: {
        readonly heads?: boolean;
        readonly tags?: boolean;
        readonly patterns?: ReadonlyArray<string>;
      }
    ) {
      // The remote is deliberately NOT annotated: it may be a URL embedding
      // userinfo, and span annotations carry stable identifiers only.
      const { heads = false, patterns = [], tags = false } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, heads, tags, patterns: patterns.length });
      yield* rejectOptionLikeRefs(cwd, [remote, ...patterns]);
      return yield* runParsed(
        "Git.lsRemote",
        GitCommand.lsRemote(remote, heads, tags, patterns),
        cwd,
        "ls-remote",
        "generic",
        parseLsRemote,
        true
      );
    })
  );

  const remoteAdd: GitShape["remoteAdd"] = dual(
    3,
    Effect.fn("Git.remoteAdd")(function* (cwd: string, name: string, url: string) {
      // The url is deliberately NOT annotated.
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name, url]);
      return yield* runVoid("Git.remoteAdd", GitCommand.remoteAdd(name, url), cwd, name);
    })
  );

  const remoteRemove: GitShape["remoteRemove"] = dual(
    2,
    Effect.fn("Git.remoteRemove")(function* (cwd: string, name: string) {
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name]);
      return yield* runVoid("Git.remoteRemove", GitCommand.remoteRemove(name), cwd, name);
    })
  );

  const remoteSetUrl: GitShape["remoteSetUrl"] = dual(
    3,
    Effect.fn("Git.remoteSetUrl")(function* (cwd: string, name: string, url: string) {
      // The url is deliberately NOT annotated.
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name, url]);
      return yield* runVoid("Git.remoteSetUrl", GitCommand.remoteSetUrl(name, url), cwd, name);
    })
  );

  const stashPush: GitShape["stashPush"] = dual(
    hasStringSubject,
    Effect.fn("Git.stashPush")(function* (
      cwd: string,
      options?: {
        readonly message?: string;
        readonly includeUntracked?: boolean;
        readonly paths?: ReadonlyArray<string>;
        readonly keepIndex?: boolean;
      }
    ) {
      const { includeUntracked = false, keepIndex = false, message, paths = [] } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, includeUntracked, keepIndex });
      return yield* runVoid(
        "Git.stashPush",
        GitCommand.stashPush(message, includeUntracked, paths, keepIndex),
        cwd,
        "stash"
      );
    })
  );

  /** The data-first form of a merge-shaped stash member (`stashPop`, `stashApply`). */
  type StashRestore = (
    cwd: string,
    options?: { readonly index?: number }
  ) => Effect.Effect<
    void,
    GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
  >;

  // The shared body of stashPop and stashApply — the two merge-shaped stash
  // operations, whose conflict/dirty stderr classifies exactly like a pull's.
  const stashRestore: {
    (method: string, invocation: (index?: number) => GitInvocation): StashRestore;
    (invocation: (index?: number) => GitInvocation): (method: string) => StashRestore;
  } = dual(
    2,
    (method: string, invocation: (index?: number) => GitInvocation): StashRestore =>
      Effect.fn(method)(function* (cwd: string, options?: StashIndexOptions) {
        yield* guardStashIndex(cwd, options?.index);
        const classified = yield* runFor(invocation(options?.index), cwd, "merge");
        return yield* Match.valueTags(classified, {
          success: () => Effect.void,
          ...refFailureArms(cwd, "stash"),
          mergeConflict: () => Effect.fail(MergeConflictError.make({ cwd })),
          dirtyWorktree: () => Effect.fail(DirtyWorktreeError.make({ cwd })),
        });
      })
  );

  const stashPop: GitShape["stashPop"] = dual(hasStringSubject, stashRestore("Git.stashPop", GitCommand.stashPop));
  const stashApply: GitShape["stashApply"] = dual(
    hasStringSubject,
    stashRestore("Git.stashApply", GitCommand.stashApply)
  );

  const stashDrop: GitShape["stashDrop"] = dual(
    hasStringSubject,
    Effect.fn("Git.stashDrop")(function* (cwd: string, options?: StashIndexOptions) {
      yield* guardStashIndex(cwd, options?.index);
      return yield* runVoid("Git.stashDrop", GitCommand.stashDrop(options?.index), cwd, "stash");
    })
  );

  const stashList = Effect.fn("Git.stashList")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    return yield* runParsed("Git.stashList", GitCommand.stashList(), cwd, "stash", "generic", parseStashList);
  });

  const branchList: GitShape["branchList"] = dual(
    hasStringSubject,
    Effect.fn("Git.branchList")(function* (
      cwd: string,
      options?: { readonly remotes?: boolean; readonly all?: boolean; readonly contains?: string }
    ) {
      const { all = false, contains, remotes = false } = options ?? {};
      const label = contains ?? "branches";
      yield* Effect.annotateCurrentSpan({ cwd, remotes, all, contains: label });
      yield* rejectOptionLikeRefs(cwd, withDefined([], contains));
      return yield* runParsed(
        "Git.branchList",
        GitCommand.branchList(remotes, all, contains),
        cwd,
        label,
        "generic",
        parseBranchList
      );
    })
  );

  const tagCreate: GitShape["tagCreate"] = dual(
    stringAt(1),
    Effect.fn("Git.tagCreate")(function* (
      cwd: string,
      name: string,
      options?: {
        readonly ref?: string;
        readonly message?: string;
        readonly force?: boolean;
      }
    ) {
      const { force = false, message, ref } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, name, ref: ref ?? "HEAD", force });
      yield* rejectOptionLikeRefs(cwd, withDefined([name], ref));
      return yield* runVoid("Git.tagCreate", GitCommand.tagCreate(name, ref, message, force), cwd, ref ?? name);
    })
  );

  const tagDelete: GitShape["tagDelete"] = dual(
    2,
    Effect.fn("Git.tagDelete")(function* (cwd: string, name: string) {
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name]);
      return yield* runVoid("Git.tagDelete", GitCommand.tagDelete(name), cwd, name);
    })
  );

  const tagList: GitShape["tagList"] = dual(
    hasStringSubject,
    Effect.fn("Git.tagList")(function* (
      cwd: string,
      options?: {
        readonly pattern?: string;
      }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd });
      yield* rejectOptionLikeRefs(cwd, options?.pattern !== undefined ? [options.pattern] : []);
      return yield* runParsed("Git.tagList", GitCommand.tagList(options?.pattern), cwd, "tags", "generic", (output) =>
        A.filter(Str.split("\n")(output), (line) => line.length > 0)
      );
    })
  );

  const forEachRef: GitShape["forEachRef"] = dual(
    hasStringSubject,
    Effect.fn("Git.forEachRef")(function* (cwd: string, options?: { readonly patterns?: ReadonlyArray<string> }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        patterns: (options?.patterns ?? []).length,
      });
      yield* rejectOptionLikeRefs(cwd, options?.patterns ?? []);
      return yield* runParsed(
        "Git.forEachRef",
        GitCommand.forEachRef(options?.patterns ?? []),
        cwd,
        "for-each-ref",
        "generic",
        parseForEachRef
      );
    })
  );

  const upstream: GitShape["upstream"] = dual(
    2,
    Effect.fn("Git.upstream")(function* (cwd: string, branch: string) {
      yield* Effect.annotateCurrentSpan({ cwd, branch });
      yield* rejectOptionLikeRefs(cwd, [branch]);
      const invocation = GitCommand.upstream(branch);
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) =>
          failClosed(invocation, cwd, "upstream")(parseUpstream(classified.output, `refs/heads/${branch}`)),
        // for-each-ref resolves no revision, so git's own stderr never
        // carries an unknown-ref shape here.
        unknownRef: () => Effect.die('Git.upstream: unexpected classification "unknownRef"'),
        ...repositoryFailureArms(cwd),
      });
    })
  );

  const revList: GitShape["revList"] = dual(
    stringAt(1),
    Effect.fn("Git.revList")(function* (
      cwd: string,
      ref: string,
      options?: { readonly limit?: number; readonly firstParent?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        ref,
        firstParent: options?.firstParent ?? false,
      });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      yield* rejectNonNaturalNumber(cwd, "a rev-list limit", options?.limit);
      return yield* runParsed(
        "Git.revList",
        GitCommand.revList(ref, options?.limit, options?.firstParent ?? false),
        cwd,
        ref,
        "generic",
        (output) => A.filter(Str.split("\n")(output), (line) => line.length > 0)
      );
    })
  );

  const revListCount: GitShape["revListCount"] = dual(
    stringAt(1),
    Effect.fn("Git.revListCount")(function* (cwd: string, range: string, options?: { readonly firstParent?: boolean }) {
      const firstParent = options?.firstParent ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, range, firstParent });
      yield* rejectOptionLikeRefs(cwd, [range]);
      const invocation = GitCommand.revListCount(range, firstParent);
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => failClosed(invocation, cwd, "rev-list count")(parseRevListCount(classified.output)),
        ...refFailureArms(cwd, range),
      });
    })
  );

  const updateRef: GitShape["updateRef"] = dual(
    3,
    Effect.fn("Git.updateRef")(function* (cwd: string, ref: string, change: UpdateRefChange) {
      const value = "create" in change ? change.create : change.delete;
      yield* Effect.annotateCurrentSpan({ cwd, ref, change: "create" in change ? "create" : "delete" });
      yield* rejectOptionLikeRefs(cwd, [ref, value]);
      // git's own refname rules decide validity, before update-ref could
      // write a ref that every later git command would refuse to read.
      const format = yield* runFor(GitCommand.checkRefFormat(ref), cwd, "quiet");
      yield* Match.valueTags(format, {
        success: () => Effect.void,
        absent: () =>
          encodeJsonString(ref).pipe(
            Effect.orDie,
            Effect.flatMap((encoded) =>
              rejectCombination(cwd, true, [ref], `updateRef needs a well-formed full refname, received ${encoded}`)
            )
          ),
        ...refFailureArms(cwd, ref),
      });
      return yield* runVoid("Git.updateRef", GitCommand.updateRef(ref, change), cwd, value);
    })
  );

  const commit: GitShape["commit"] = dual(
    stringAt(1),
    Effect.fn("Git.commit")(function* (
      cwd: string,
      message: string,
      options?: {
        readonly all?: boolean;
        readonly allowEmpty?: boolean;
        readonly amend?: boolean;
        readonly author?: string;
        readonly only?: boolean;
        readonly noVerify?: boolean;
        readonly noGpgSign?: boolean;
      }
    ) {
      const {
        all = false,
        allowEmpty = false,
        amend = false,
        author,
        noGpgSign = false,
        noVerify = false,
        only = false,
      } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, amend, only, noVerify, noGpgSign });
      return yield* runVoid(
        "Git.commit",
        GitCommand.commit(message, all, allowEmpty, amend, author, only, noVerify, noGpgSign),
        cwd,
        "HEAD"
      );
    })
  );

  const push: GitShape["push"] = dual(
    hasStringSubject,
    Effect.fn("Git.push")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly refspec?: string;
        readonly force?: boolean;
        readonly forceWithLease?: boolean;
        readonly tags?: boolean;
        readonly setUpstream?: boolean;
      }
    ) {
      const {
        force = false,
        forceWithLease = false,
        refspec,
        remote = "origin",
        setUpstream = false,
        tags = false,
      } = options ?? {};
      // The remote is deliberately NOT annotated: it may be a URL.
      yield* Effect.annotateCurrentSpan({ cwd, refspec: refspec ?? "(current branch)", forceWithLease });
      yield* rejectOptionLikeRefs(cwd, withDefined([remote], refspec));
      const classified = yield* runForNetwork(
        GitCommand.push(remote, refspec, force, forceWithLease, tags, setUpstream),
        cwd,
        "push"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, refspec ?? "HEAD"),
        nonFastForward: () =>
          Effect.fail(NonFastForwardError.make({ cwd, ...O.getSomesStruct({ refspec: O.fromUndefinedOr(refspec) }) })),
      });
    })
  );

  const pull: GitShape["pull"] = dual(
    hasStringSubject,
    Effect.fn("Git.pull")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly ref?: string;
        readonly rebase?: boolean;
        readonly ffOnly?: boolean;
      }
    ) {
      const { ffOnly = false, rebase = false, ref, remote = "origin" } = options ?? {};
      // The remote is deliberately NOT annotated: it may be a URL.
      yield* Effect.annotateCurrentSpan({ cwd, ref: ref ?? "(upstream)", rebase });
      yield* rejectOptionLikeRefs(cwd, withDefined([remote], ref));
      const classified = yield* runForNetwork(GitCommand.pull(remote, ref, rebase, ffOnly), cwd, "merge");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, ref ?? "(upstream)"),
        mergeConflict: () => Effect.fail(MergeConflictError.make({ cwd })),
        dirtyWorktree: () => Effect.fail(DirtyWorktreeError.make({ cwd })),
      });
    })
  );

  const configList: GitShape["configList"] = dual(
    hasStringSubject,
    Effect.fn("Git.configList")(function* (
      cwd: string,
      options?: { readonly file?: string; readonly scope?: GitConfigScope }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        file: options?.file ?? "(repository config)",
        scope: options?.scope ?? "(merged)",
      });
      yield* rejectOptionLikeRefs(cwd, options?.file !== undefined ? [options.file] : []);
      return yield* runParsed(
        "Git.configList",
        GitCommand.configList(options?.file, options?.scope),
        cwd,
        "config",
        "generic",
        parseConfigList
      );
    })
  );

  const configGetAll: GitShape["configGetAll"] = dual(
    stringAt(1),
    Effect.fn("Git.configGetAll")(function* (cwd: string, key: string, options?: { readonly file?: string }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        file: options?.file ?? "(repository config)",
      });
      yield* rejectOptionLikeRefs(cwd, [key, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runParsed(
        "Git.configGetAll",
        GitCommand.configGetAll(key, options?.file),
        cwd,
        key,
        "quiet",
        parseConfigGetAll
      );
    })
  );

  const configUnset: GitShape["configUnset"] = dual(
    stringAt(1),
    Effect.fn("Git.configUnset")(function* (
      cwd: string,
      key: string,
      options?: { readonly file?: string; readonly all?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        file: options?.file ?? "(repository config)",
      });
      yield* rejectOptionLikeRefs(cwd, [key, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runVoid(
        "Git.configUnset",
        GitCommand.configUnset(key, options?.file, options?.all ?? false),
        cwd,
        key
      );
    })
  );

  const configRemoveSection: GitShape["configRemoveSection"] = dual(
    stringAt(1),
    Effect.fn("Git.configRemoveSection")(function* (
      cwd: string,
      section: string,
      options?: { readonly file?: string }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        section,
        file: options?.file ?? "(repository config)",
      });
      // git config has no documented -- separator, so section AND file are both
      // guarded — the configSet/configUnset posture.
      yield* rejectOptionLikeRefs(cwd, [section, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runVoid(
        "Git.configRemoveSection",
        GitCommand.configRemoveSection(section, options?.file),
        cwd,
        section
      );
    })
  );

  const configRenameSection: GitShape["configRenameSection"] = dual(
    stringAt(2),
    Effect.fn("Git.configRenameSection")(function* (
      cwd: string,
      oldName: string,
      newName: string,
      options?: { readonly file?: string }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        oldName,
        newName,
        file: options?.file ?? "(repository config)",
      });
      yield* rejectOptionLikeRefs(cwd, [oldName, newName, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runVoid(
        "Git.configRenameSection",
        GitCommand.configRenameSection(oldName, newName, options?.file),
        cwd,
        oldName
      );
    })
  );

  const rm: GitShape["rm"] = dual(
    hasStringSubject,
    Effect.fn("Git.rm")(function* (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly cached?: boolean;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        count: paths.length,
        cached: options?.cached ?? false,
      });
      return yield* runVoid(
        "Git.rm",
        GitCommand.rm(paths, options?.cached ?? false, options?.recursive ?? false, options?.force ?? false),
        cwd,
        "working tree"
      );
    })
  );

  const mv: GitShape["mv"] = dual(
    stringAt(2),
    Effect.fn("Git.mv")(function* (
      cwd: string,
      source: string,
      destination: string,
      options?: { readonly force?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, source, destination });
      return yield* runVoid("Git.mv", GitCommand.mv(source, destination, options?.force ?? false), cwd, "working tree");
    })
  );

  const checkIgnore: GitShape["checkIgnore"] = dual(
    hasStringSubject,
    Effect.fn("Git.checkIgnore")(function* (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: { readonly noIndex?: boolean }
    ) {
      const noIndex = options?.noIndex ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, count: paths.length, noIndex });
      return yield* runParsed(
        "Git.checkIgnore",
        GitCommand.checkIgnore(paths, noIndex),
        cwd,
        "check-ignore",
        "quiet",
        parseNulSeparated
      );
    })
  );

  const worktreeAdd: GitShape["worktreeAdd"] = dual(
    stringAt(1),
    Effect.fn("Git.worktreeAdd")(function* (
      cwd: string,
      path: string,
      options?: {
        readonly ref?: string;
        readonly detach?: boolean;
        readonly force?: boolean;
        readonly newBranch?: string;
      }
    ) {
      const { detach = false, force = false, newBranch, ref } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, path, ref: ref ?? "(default)", newBranch: newBranch ?? "(none)" });
      yield* rejectOptionLikeRefs(cwd, [...withDefined([path], ref), ...withDefined([], newBranch)]);
      // git rejects `-b` together with `--detach`; refused typed pre-spawn.
      yield* rejectCombination(
        cwd,
        detach && newBranch !== undefined,
        ["--detach", "-b"],
        "worktreeAdd cannot create a branch in a detached worktree"
      );
      return yield* runVoid(
        "Git.worktreeAdd",
        GitCommand.worktreeAdd(path, ref, detach, force, newBranch),
        cwd,
        ref ?? path
      );
    })
  );

  const worktreeList = Effect.fn("Git.worktreeList")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    return yield* runParsedChecked(
      "Git.worktreeList",
      GitCommand.worktreeList(),
      cwd,
      "worktrees",
      "worktree list",
      parseWorktreeList
    );
  });

  const worktreePrune = Effect.fn("Git.worktreePrune")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    return yield* runVoid("Git.worktreePrune", GitCommand.worktreePrune(), cwd, "worktrees");
  });

  const worktreeRemove: GitShape["worktreeRemove"] = dual(
    stringAt(1),
    Effect.fn("Git.worktreeRemove")(function* (cwd: string, path: string, options?: { readonly force?: boolean }) {
      yield* Effect.annotateCurrentSpan({ cwd, path });
      yield* rejectOptionLikeRefs(cwd, [path]);
      return yield* runVoid("Git.worktreeRemove", GitCommand.worktreeRemove(path, options?.force ?? false), cwd, path);
    })
  );

  const lsFiles: GitShape["lsFiles"] = dual(
    hasStringSubject,
    Effect.fn("Git.lsFiles")(function* (cwd: string, options?: { readonly pathspec?: ReadonlyArray<string> }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        patterns: (options?.pathspec ?? []).length,
      });
      return yield* runParsedChecked(
        "Git.lsFiles",
        GitCommand.lsFiles(options?.pathspec ?? []),
        cwd,
        "index",
        "ls-files",
        parseLsFiles
      );
    })
  );

  const diffPatch: GitShape["diffPatch"] = dual(
    hasStringSubject,
    Effect.fn("Git.diffPatch")(function* (cwd: string, options?: DiffPatchOptions) {
      const resolved = options ?? {};
      const { base, head, noIndex, pathspec = [] } = resolved;
      yield* Effect.annotateCurrentSpan({
        cwd,
        base: base ?? "(index)",
        head: head ?? "(working tree)",
        noIndex: noIndex !== undefined,
        pathspec: pathspec.length,
      });
      yield* rejectDiffPatchOptions(cwd, resolved);
      const invocation = GitCommand.diffPatch(resolved);
      // "differs" only under --no-index, where a silent exit 1 means the two
      // files differ; every other diff form exits 0 with or without changes.
      const classified = yield* runFor(invocation, cwd, noIndex === undefined ? "generic" : "differs");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(classified.output),
        differs: (classified) => Effect.succeed(classified.output),
        ...refFailureArms(cwd, head === undefined ? (base ?? "working tree") : `${base}..${head}`),
      });
    })
  );

  return {
    add,
    branchCreate,
    branchDelete,
    branchList,
    changedFiles,
    checkIgnore,
    checkout,
    clean,
    commit,
    commitInfo,
    commonDir,
    configGet,
    configGetAll,
    configList,
    configRemoveSection,
    configRenameSection,
    configSet,
    configUnset,
    currentBranch,
    defaultBranch,
    diffPatch,
    fetch,
    fetchAny,
    fetchUnshallow,
    forEachRef,
    gitDir,
    isShallow,
    log,
    lsFiles,
    lsRemote,
    lsTree,
    mergeBase,
    mergeBaseOption,
    mergeTree,
    isAncestor,
    mv,
    nameStatus,
    pull,
    push,
    refExists,
    remoteAdd,
    remoteRemove,
    remoteSetUrl,
    remoteUrl,
    repoRoot,
    reset,
    restore,
    revList,
    revListCount,
    revParse,
    rm,
    show,
    sparseCheckoutSet,
    stagedChanges,
    stashApply,
    stashDrop,
    stashList,
    stashPop,
    stashPush,
    status,
    submoduleAbsorbgitdirs,
    submoduleAdd,
    submoduleDeinit,
    submoduleForeach,
    submoduleInit,
    submoduleSetBranch,
    submoduleSetUrl,
    submoduleStatus,
    submoduleSync,
    submoduleUpdate,
    tagCreate,
    tagDelete,
    tagList,
    unstagedChanges,
    untrackedFiles,
    updateRef,
    upstream,
    workingChanges,
    worktreeAdd,
    worktreeList,
    worktreeRemove,
    worktreePrune,
  };
};

/**
 * The {@link Git} service shape.
 *
 * **Details**
 *
 * Exported so a consumer can type a variable, field or test fake holding the
 * service without re-declaring the surface — `Layer.succeed(Git, fake)`
 * accepts any `GitShape`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface GitShape {
  /**
   * Mutating: `git add [--force] -- <paths...>` — stages `paths` in the index for
   * the next commit; `options.force` stages a path an ignore rule matches,
   * which git otherwise refuses.
   */
  readonly add: {
    (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: { readonly force?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>,
      options?: { readonly force?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git branch [-f] <name> [<start-point>]` — creates a branch,
   * optionally from `options.startPoint`; `options.checkout` switches to it
   * on creation (`git checkout -b <name> [<start-point>]`), and
   * `options.force` resets the branch if it already exists (`branch -f`,
   * or `checkout -B` with `checkout`).
   *
   * **Details**
   *
   * Branch creation is a branch-member concern, not a `checkout` option:
   * `checkout`'s contract stays "move to an existing ref" with its
   * option-like-ref refusal intact. Both `name` and `startPoint` are
   * guarded — an option-like value is refused typed before any spawn.
   *
   * `force` with `checkout` replaces the delete-then-create longhand — a
   * swallowed `branchDelete(force: true)` followed by a plain create —
   * which papers over a real edge: `git branch -D` refuses to delete the
   * currently checked-out branch, so on a runner already sitting on that
   * branch the swallowed delete fails and the create then fails for real.
   * `checkout -B` handles both states in one invocation.
   */
  readonly branchCreate: {
    (
      cwd: string,
      name: string,
      options?: {
        readonly startPoint?: string;
        readonly checkout?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      options?: {
        readonly startPoint?: string;
        readonly checkout?: boolean;
        readonly force?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git branch -d <name>` (or `-D` with `options.force`) —
   * deletes a local branch. The default `-d` refuses a branch that is not
   * fully merged — a typed `GitCommandError`, which is usually the honest
   * answer; `force: true` deletes regardless.
   */
  readonly branchDelete: {
    (
      cwd: string,
      name: string,
      options?: { readonly force?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      options?: { readonly force?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git branch --list [--remotes | --all] [--contains <rev>]` — every branch as a
   * {@link BranchEntry} (short name, tip sha, current marker), via the
   * NUL-separated for-each-ref format. `all` wins when both flags are set;
   * `contains` keeps only the branches whose history includes `<rev>`, and
   * an option-like `contains` is refused typed before any spawn.
   */
  readonly branchList: {
    (
      cwd: string,
      options?: { readonly remotes?: boolean; readonly all?: boolean; readonly contains?: string }
    ): Effect.Effect<ReadonlyArray<BranchEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remotes?: boolean;
      readonly all?: boolean;
      readonly contains?: string;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<BranchEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git diff --name-only -z [--relative] [--no-renames] [--diff-filter=<letters>] (<base>...<head> | <base> <head>) [-- <pathspec>...]`
   * — the paths that differ. Pass `relative: true` to report paths relative
   * to `cwd` and exclude changes outside it (a workspace nested in a larger
   * repository).
   *
   * **Details**
   *
   * `diffFilter` keeps only the named status letters (`[ACDMRTUXB*]`, lower
   * case excludes them) and is refused typed outside that domain; `noRenames`
   * turns rename detection off so a moved file lists as both its old and new
   * path; `pathspec` scopes the diff behind `--`, each entry passing the same
   * option-like guard as the refs; `twoDot` compares the two trees directly
   * (`<base> <head>`) instead of `head` against the merge base (`...`). With
   * no option passed the argv is unchanged from the range-only form.
   */
  readonly changedFiles: {
    (
      cwd: string,
      options: {
        readonly base: string;
        readonly head: string;
        readonly relative?: boolean;
        readonly diffFilter?: string;
        readonly noRenames?: boolean;
        readonly pathspec?: ReadonlyArray<string>;
        readonly twoDot?: boolean;
      }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly base: string;
      readonly head: string;
      readonly relative?: boolean;
      readonly diffFilter?: string;
      readonly noRenames?: boolean;
      readonly pathspec?: ReadonlyArray<string>;
      readonly twoDot?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git check-ignore [--no-index] -z --stdin` — the subset of `paths` git would ignore,
   * predicate-shaped: paths in, the ignored ones back. Paths are fed via
   * STDIN (NUL-separated both directions), so nothing caller-controlled
   * enters the argv and special-character paths survive unquoted. No path
   * ignored degrades to the empty array, never an error.
   *
   * **Details**
   *
   * Without `options.noIndex` git never reports a path the index tracks,
   * whatever the ignore rules say. With it the index is not consulted, so a
   * tracked path that an ignore rule matches (including a rule on a parent
   * directory) is reported too.
   */
  readonly checkIgnore: {
    (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: { readonly noIndex?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>,
      options?: { readonly noIndex?: boolean }
    ): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git checkout [--detach] <ref>` — moves the working tree
   * (and, for a branch ref, `HEAD`) to `ref`; `options.detach` checks it out
   * in detached-HEAD state instead of updating a branch.
   * Real git reports an unknown ref to checkout as a pathspec error, which
   * classifies as `GitCommandError` rather than `UnknownRefError`; the
   * `UnknownRefError` arm remains declared for the stderr shapes that do match.
   */
  readonly checkout: {
    (
      cwd: string,
      ref: string,
      options?: { readonly detach?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      options?: { readonly detach?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git clean --force [-d] [-x] [-- <paths>...]` — deletes
   * untracked files (and, with `options.directories`, untracked directories;
   * with `options.ignored`, ignored files too), optionally scoped to
   * `options.paths`.
   *
   * **Details**
   *
   * `--force` is unconditional: this member exists so a consumer can restore
   * a tree to a known state before retrying a non-idempotent operation, and
   * without it git refuses to clean under the default `clean.requireForce`
   * config — **a clean that silently did nothing corrupts the retry**. Any
   * non-zero exit fails loudly as `GitCommandError`.
   */
  readonly clean: {
    (
      cwd: string,
      options?: {
        readonly directories?: boolean;
        readonly ignored?: boolean;
        readonly paths?: ReadonlyArray<string>;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly directories?: boolean;
      readonly ignored?: boolean;
      readonly paths?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git commit [--all] [--allow-empty] [--amend] [--no-gpg-sign] [--author=<author>] -m <message>`
   * — records a commit. The message rides argv; committer identity comes
   * from the caller's ENVIRONMENT (the pins this service applies are the
   * locale and the non-interactive set — never an identity), and
   * `options.author` is the explicit `--author=`
   * override. `options.noGpgSign` overrides a configured `commit.gpgSign`
   * for this one commit. "Nothing to commit" fails loudly as {@link GitCommandError}.
   */
  readonly commit: {
    (
      cwd: string,
      message: string,
      options?: {
        readonly all?: boolean;
        readonly allowEmpty?: boolean;
        readonly amend?: boolean;
        readonly author?: string;
        readonly only?: boolean;
        readonly noVerify?: boolean;
        readonly noGpgSign?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      message: string,
      options?: {
        readonly all?: boolean;
        readonly allowEmpty?: boolean;
        readonly amend?: boolean;
        readonly author?: string;
        readonly only?: boolean;
        readonly noVerify?: boolean;
        readonly noGpgSign?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git log -1 --format=%H%x00%G?%x00%B <ref>` — a single commit's sha,
   * signature verdict and raw (untrimmed) message. `ref` defaults to `HEAD`.
   */
  readonly commitInfo: (
    cwd: string,
    ref?: string
  ) => Effect.Effect<CommitInfo, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * `git rev-parse --path-format=absolute --git-common-dir` — the absolute,
   * symlink-resolved directory a repository shares with all of its linked
   * worktrees, with git's terminating newline removed.
   *
   * **Details**
   *
   * Repository identity that holds across worktrees: every checkout of one
   * repository — the main worktree, any subdirectory, any linked worktree,
   * and any path reached through a symlink — answers the same string, so two
   * results compare with `===`. `repoRoot` cannot serve here, because each
   * worktree has its own toplevel. A bare repository answers its own
   * directory. Only git's terminating newline is removed, so a path ending in
   * whitespace keeps it.
   *
   * Needs git 2.31 or later. An older git echoes the unknown
   * `--path-format` flag and exits 0; that answer fails as a
   * `GitCommandError` (`kind: "failed"`) rather than passing as an identity.
   */
  readonly commonDir: (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError>;
  /**
   * `git config [--<scope>] --get <key>` — the trimmed value, or `Option.none`
   * when the key is unset.
   *
   * **Details**
   *
   * With no `scope` this reads the MERGED configuration, so a globally set key
   * answers here even when this repository declares nothing. Pass
   * `{ scope: "local" }` to ask what this checkout itself declares — see
   * `Git.configList` for why the distinction matters.
   */
  readonly configGet: {
    (
      cwd: string,
      key: string,
      options?: { readonly scope?: GitConfigScope }
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      options?: { readonly scope?: GitConfigScope }
    ): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git config [-f <file>] --get-all -z <key>` — every value of a
   * (possibly multi-valued) key, in order. An unset key degrades to the
   * empty array, never an error — the multi-valued sibling of `configGet`'s
   * `Option.none`.
   */
  readonly configGetAll: {
    (
      cwd: string,
      key: string,
      options?: { readonly file?: string }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git config [-f <file>] [--<scope>] --list -z` — every configuration entry
   * in scope (or in `options.file` only) as {@link ConfigListEntry} values.
   * `-z` keeps multi-line values lossless.
   *
   * **Gotchas**
   *
   * **With no `scope`, this reads the MERGED configuration** — repository-local
   * plus global plus system. That is right for "what is the effective value"
   * and wrong for "what does this checkout declare": a globally set key
   * otherwise shadows a decision that is really about one repository, and an
   * enumerate-then-remove flow reads more broadly than
   * `Git.configRemoveSection` writes, which defaults to the local file.
   * Pass `{ scope: "local" }` for the precise read.
   *
   * `file` and `scope` both select a source and git accepts only one — passing
   * both fails typed as a {@link GitCommandError} rather than silently
   * preferring either.
   */
  readonly configList: {
    (
      cwd: string,
      options?: { readonly file?: string; readonly scope?: GitConfigScope }
    ): Effect.Effect<ReadonlyArray<ConfigListEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly file?: string;
      readonly scope?: GitConfigScope;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<ConfigListEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] --remove-section <section>` — removes
   * a whole configuration section (every key under it, and the header) from
   * the live config, or from `options.file`. The section-level sibling of
   * `configUnset` — clearing a stale `submodule.<name>` registration is one
   * invocation instead of a key-by-key probe-and-unset. Removing a section
   * that does not exist fails LOUDLY (git exits 128,
   * `fatal: no such section`) — the `configUnset` posture; probe with
   * `configList` first when idempotency is wanted.
   */
  readonly configRemoveSection: {
    (
      cwd: string,
      section: string,
      options?: { readonly file?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      section: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] --rename-section <old> <new>` —
   * renames a configuration section, carrying every key under it across.
   * Renaming a section that does not exist fails LOUDLY (git exits 128,
   * `fatal: no such section`) — the same posture as `configRemoveSection`.
   */
  readonly configRenameSection: {
    (
      cwd: string,
      oldName: string,
      newName: string,
      options?: { readonly file?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      oldName: string,
      newName: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] <key> <value>` — writes `value` for
   * `key` into the repository config, or into `options.file` when given
   * (e.g. `.gitmodules`).
   *
   * **Details**
   *
   * **The write is repository-LOCAL, always.** A bare
   * `git config <key> <value>` writes the checkout's own `.git/config`, and
   * this method emits no scope flag, so the setting applies to every later git
   * command in that checkout and reaches nothing outside it. That asymmetry with
   * `Git.configList` and `Git.configGet` — whose omitted `scope`
   * means the MERGED read — is deliberate rather than an oversight: a read
   * has a defensible "effective value" default, and a write does not. Writing
   * global or system config would leak a setting onto a shared machine or a
   * CI runner for every unrelated step in the job, so it is not offered here
   * at all rather than hidden behind an option that is easy to pass by
   * accident.
   *
   * The value never surfaces in an error: a failing `configSet` carries
   * `<redacted>` in `GitCommandError.args` and `.message`, and the method's
   * span annotates `key` and `file` only.
   */
  readonly configSet: {
    (
      cwd: string,
      key: string,
      value: string,
      options?: { readonly file?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      value: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] (--unset | --unset-all) <key>` —
   * removes `key` (or, with `options.all`, every value of a multi-valued
   * key). Unsetting a key that was never set fails LOUDLY (git exits 5) —
   * an unset that silently did nothing is indistinguishable from one that
   * worked; probe with `configGet` first when idempotency is wanted.
   */
  readonly configUnset: {
    (
      cwd: string,
      key: string,
      options?: { readonly file?: string; readonly all?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      options?: { readonly file?: string; readonly all?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --abbrev-ref HEAD` (the default `mode`, `"abbrev-ref"`) or
   * `git branch --show-current` (`"show-current"`) — the current branch name,
   * or `Option.none` when `HEAD` is detached (the literal answer `"HEAD"` and
   * `--show-current`'s empty line both degrade to the typed absence rather
   * than a fake branch name).
   *
   * **Details**
   *
   * The two modes differ on an unborn branch: `rev-parse` fails there (a
   * `GitCommandError`) while `branch --show-current` names the branch `HEAD`
   * points at, commits or not. Pick `"show-current"` when a freshly
   * initialised repository is a legitimate input.
   */
  readonly currentBranch: {
    (
      cwd: string,
      options?: { readonly mode?: CurrentBranchMode }
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly mode?: CurrentBranchMode;
    }): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git symbolic-ref --quiet --short refs/remotes/<remote>/HEAD` — the
   * bare branch name, remote prefix stripped, or `Option.none` when the
   * remote's HEAD is unset — run `git remote set-head` to set it.
   */
  readonly defaultBranch: {
    (
      cwd: string,
      options?: { readonly remote?: string }
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remote?: string;
    }): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git diff --no-color --no-ext-diff [--binary] [--unified=<n>] [--no-renames | --find-renames=<n>%] [--cached] [<base> [<head>]] -- [<pathspec>...]`,
   * or `git diff --no-color --no-ext-diff [...] --no-index -- <a> <b>` — the
   * patch text, decoded and untrimmed. The full argv is on `GitCommand.diffPatch`.
   *
   * **Details**
   *
   * Without `base` the patch is the working tree against the index (with
   * `cached`, the index against `HEAD`); with `base` alone it is the working
   * tree (or the index) against `base`; with `head` too it is `base` against
   * `head`. `noIndex` compares two files outside any index, and works
   * outside a repository: there git's exit 1 means the files differ and is
   * the answer, while a file git cannot read fails as `GitCommandError`.
   *
   * Refused typed before any spawn: a `head` without a `base`; `noRenames`
   * with `findRenames`; `noIndex` with `base`, `head`, `cached` or
   * `pathspec`; a `unified` that is not a non-negative integer; a
   * `findRenames` outside 1..100; and any revision, pathspec entry or file
   * git would read as an option. A patch larger than the instance's
   * `maxOutputBytes` fails as kind `"truncated"`; build the instance with
   * `Git.makeWith` for a larger bound.
   */
  readonly diffPatch: {
    (
      cwd: string,
      options?: {
        readonly base?: string;
        readonly head?: string;
        readonly cached?: boolean;
        readonly noIndex?: readonly [string, string];
        readonly binary?: boolean;
        readonly unified?: number;
        readonly noRenames?: boolean;
        readonly findRenames?: number;
        readonly pathspec?: ReadonlyArray<string>;
      }
    ): Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly base?: string;
      readonly head?: string;
      readonly cached?: boolean;
      readonly noIndex?: readonly [string, string];
      readonly binary?: boolean;
      readonly unified?: number;
      readonly noRenames?: boolean;
      readonly findRenames?: number;
      readonly pathspec?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git fetch [--depth <n>] [--unshallow] [--prune] [--no-tags] [--no-write-fetch-head] <remote> [tag] [<ref>]` —
   * fetches `options.ref` from `options.remote` (default `origin`) into the
   * local object database, optionally shallow (`options.depth`), unshallowing
   * (`options.unshallow`), and/or as a tag (`options.tag`). A ref the remote
   * does not have surfaces as `UnknownRefError` — the typed signal a
   * tag-then-branch fetch fallback can branch on.
   *
   * **Details**
   *
   * `options.ref` also accepts a full refspec (`src:dst`, optionally
   * `+`-prefixed), passed through verbatim — never guessed at or
   * transformed. Under a single-branch clone (`actions/checkout`'s default
   * `fetch-depth: 1` shape) a bare-ref fetch updates only `FETCH_HEAD` and
   * never creates the remote-tracking ref, so
   * `+refs/heads/<b>:refs/remotes/origin/<b>` is the spelling that
   * materializes `origin/<b>`.
   *
   * `options.unshallow` follows `fetchUnshallow`'s caller-guards rule: git
   * rejects `--unshallow` in a non-shallow repository (a loud
   * `GitCommandError`, deliberately untolerated) — probe with `isShallow`
   * first. Combining it with `options.depth` is refused typed, pre-spawn,
   * exactly as git itself would reject the pair.
   *
   * With `options.ref` omitted git fetches the remote's configured refspecs
   * (`git fetch --prune origin` refreshes every remote-tracking ref);
   * `options.tag` needs a ref and is refused typed without one.
   * `options.noTags` turns tag auto-follow off, and
   * `options.noWriteFetchHead` leaves `FETCH_HEAD` untouched, so a fetch of
   * one pinned commit cannot disturb a concurrent reader of it.
   */
  readonly fetch: {
    (
      cwd: string,
      options: {
        readonly ref?: string;
        readonly remote?: string;
        readonly depth?: number;
        readonly tag?: boolean;
        readonly unshallow?: boolean;
        readonly prune?: boolean;
        readonly noTags?: boolean;
        readonly noWriteFetchHead?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly ref?: string;
      readonly remote?: string;
      readonly depth?: number;
      readonly tag?: boolean;
      readonly unshallow?: boolean;
      readonly prune?: boolean;
      readonly noTags?: boolean;
      readonly noWriteFetchHead?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: fetches `options.ref` from `options.remote` (default
   * `origin`) without knowing whether it names a tag — the tag form
   * (`git fetch [--depth <n>] <remote> tag <ref>`) runs first, and when it
   * fails as `UnknownRefError` (the typed "not a tag on the remote"
   * signal) or any `GitCommandError`, the plain form
   * (`git fetch [--depth <n>] <remote> <ref>`) runs as the fallback.
   *
   * **Details**
   *
   * `NotARepositoryError` from the tag attempt propagates immediately —
   * the plain form would fail identically. When both attempts fail, the
   * PLAIN fetch's error surfaces; the tag attempt's failure is discarded.
   */
  readonly fetchAny: {
    (
      cwd: string,
      options: {
        readonly ref: string;
        readonly remote?: string;
        readonly depth?: number;
        readonly prune?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly ref: string;
      readonly remote?: string;
      readonly depth?: number;
      readonly prune?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git fetch --unshallow <remote>` — converts a shallow clone
   * into a complete one by fetching all missing history from
   * `options.remote` (default `origin`).
   *
   * **Details**
   *
   * `--unshallow` is a distinct mode, not a depth value: **git rejects it in
   * a repository that is not shallow**, with
   * `--unshallow on a complete repository does not make sense` — and this
   * method deliberately does NOT tolerate that; the failure surfaces typed
   * as `GitCommandError`, because swallowing it would also swallow every
   * other fetch failure shape. The caller owns the guard: probe with
   * `isShallow` first and skip the fetch when the repository is already
   * complete.
   */
  readonly fetchUnshallow: {
    (
      cwd: string,
      options?: { readonly remote?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remote?: string;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git for-each-ref [<patterns>...]` — every matching ref as a
   * {@link RefEntry} (full refname, sha, object type), via this package's
   * fixed `%(refname)%00%(objectname)%00%(objecttype)` format.
   */
  readonly forEachRef: {
    (
      cwd: string,
      options?: { readonly patterns?: ReadonlyArray<string> }
    ): Effect.Effect<ReadonlyArray<RefEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly patterns?: ReadonlyArray<string>;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<RefEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --path-format=absolute --git-dir`, or with `options.path`
   * `git rev-parse --path-format=absolute --git-path <path>` — the absolute
   * Git directory of THIS checkout, or where git keeps `$GIT_DIR/<path>`,
   * with git's terminating newline removed.
   *
   * **Details**
   *
   * The per-checkout sibling of `commonDir`: from a linked worktree the Git
   * directory is its own `.git/worktrees/<name>`, while `commonDir` is the
   * shared directory every checkout of the repository answers. `path` goes
   * through git's own relocation rules, so `info/attributes` or `hooks`
   * from a linked worktree resolve into the common directory, which joining
   * the path onto `--git-dir` by hand would miss. Only the terminating
   * newline is removed.
   *
   * Needs git 2.31 or later, failing as `GitCommandError` on an older git
   * exactly as `commonDir` does; an option-like `path` is refused typed
   * before any spawn.
   */
  readonly gitDir: {
    (cwd: string, options?: { readonly path?: string }): Effect.Effect<string, GitCommandError | NotARepositoryError>;
    (options?: {
      readonly path?: string;
    }): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError>;
  };
  /**
   * `git merge-base --is-ancestor <ancestor> <descendant>` — whether
   * `ancestor` is reachable from `descendant` (a commit counts as its own
   * ancestor). The negative answer is git's silent exit 1, read as `false`,
   * never an error; an unknown object is still `UnknownRefError`, and a noisy
   * exit 1 stays a loud `GitCommandError`.
   *
   * **Details**
   *
   * The reachability sibling of `mergeBaseOption`: where that member answers
   * "where do these histories meet", this one answers "is this commit already
   * contained in that one" without printing a sha. A caller that needs to tell
   * a missing object in a shallow clone apart from a bad citation checks
   * `isShallow` on the `UnknownRefError` arm.
   */
  readonly isAncestor: {
    (
      cwd: string,
      ancestor: string,
      descendant: string
    ): Effect.Effect<boolean, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ancestor: string,
      descendant: string
    ): (cwd: string) => Effect.Effect<boolean, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --is-shallow-repository` — whether the repository is a
   * shallow clone.
   *
   * **Details**
   *
   * A dedicated predicate, deliberately not folded into `revParse`: that
   * method's contract is "resolve this REF"; this one takes no ref and
   * answers a repository-shape question. The intended pairing is
   * `isShallow` → `fetchUnshallow`.
   */
  readonly isShallow: (cwd: string) => Effect.Effect<boolean, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * `git log -z --format=... --name-only [flags] [-- pathspec]` — the commit
   * history reachable from `HEAD`, newest first, each entry carrying its sha,
   * both dates, its author identity and the paths it touched. The full argv,
   * flag by flag, is on `GitCommand.log`.
   *
   * **Details**
   *
   * Scoped by `paths` (a git pathspec, relative to `cwd`) and, with
   * `follow: true`, walked ACROSS renames — git's `--follow`, which requires
   * exactly one path and is refused pre-spawn as a `"refused"`
   * `GitCommandError` otherwise. `limit` becomes `--max-count`, so
   * `limit: 0` is the empty listing rather than the whole history. A merge
   * commit contributes an entry with EMPTY `paths` unless
   * `firstParentDiffMerges` is set, which asks git for the first-parent diff
   * and so lists a merge that actually changed something (a conflict
   * resolution) while still hiding one TREESAME to its first parent.
   * **`follow: true` and merge commits do not combine**: `--follow`
   * linearizes the walk and drops merges outright (probed against git 2.54),
   * so a followed listing is not a superset of the unfollowed one — it trades
   * the merges away for the pre-rename history.
   *
   * An unborn `HEAD` and a pathspec no commit ever touched are both the
   * EMPTY listing, not a failure. A walk from `revisions` that git cannot
   * resolve is the one `UnknownRefError` this member raises; a walk from
   * `HEAD` never does. This
   * is the one read whose result depends on the ORDER of history rather than
   * a single tree, and the one that decodes dates: see `CommitLogEntry` for
   * what the UTC decoding does and does not preserve.
   *
   * `revisions` starts the walk at refs, ranges (`base..head`) or
   * exclusions (`^ref`) instead of `HEAD`; each is refused typed when git
   * would read it as an option. `noMerges` drops merge commits, `reverse`
   * prints oldest first (after `limit` is applied), and `since` keeps only
   * commits newer than git's approxidate. `omitPaths` lists no paths, so
   * every entry's `paths` is empty and a subject listing costs a fraction of
   * the bytes; it is refused with `nameStatus`. `includeBody` reads each
   * commit's raw `%b` into `CommitLogEntry.body`.
   *
   * With `nameStatus: true` the body is read as `--name-status` instead of
   * `--name-only`: every entry then carries `changes`, each touched path's
   * {@link NameStatusEntry} (status, rename pair, similarity score), and its
   * `paths` is the NEW path of every change. `diffFilter` and `findRenames`
   * apply in either mode and are validated pre-spawn exactly as `nameStatus`
   * validates them; a commit whose diff the filter empties is dropped from
   * the walk by git itself. `quotePath: false` prepends the global
   * `-c core.quotePath=false` for a consumer whose argv contract names it;
   * under `-z` the paths are already raw. Every entry carries `subject` in
   * both modes.
   */
  readonly log: {
    (
      cwd: string,
      options?: LogOptions
    ): Effect.Effect<ReadonlyArray<CommitLogEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      options?: LogOptions
    ): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<CommitLogEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git ls-files --stage -z [-- <pathspec>...]` — every INDEX entry as an
   * {@link LsFilesEntry} (mode, oid, merge stage, path), optionally scoped
   * to `options.pathspec`.
   *
   * **Details**
   *
   * The index-side sibling of `lsTree`: the only read that sees a
   * staged-but-uncommitted gitlink (`160000 <oid> 0 <path>`) — the state a
   * stage-without-commit window (a submodule pin/add) deliberately
   * produces, which a HEAD-side `lsTree` misreports.
   */
  readonly lsFiles: {
    (
      cwd: string,
      options?: { readonly pathspec?: ReadonlyArray<string> }
    ): Effect.Effect<ReadonlyArray<LsFilesEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly pathspec?: ReadonlyArray<string>;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<LsFilesEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git ls-remote [--heads] [--tags] <remote> [<patterns>...]` — the refs
   * `remote` advertises, as {@link LsRemoteEntry} values, optionally
   * filtered to branch heads and/or tags and/or shell-glob patterns.
   *
   * **Details**
   *
   * The one read that talks to the NETWORK. Auth failure and an unreachable
   * remote stay {@link GitCommandError} deliberately — no consumer branches
   * on them, so they carry no dedicated type. The validate-before-mutate
   * consumer story: look for the wanted ref in the listing, and on a miss
   * hand the entries to `LsRemoteEntry.nearMatches` for a suggestion (the
   * monorepo-prefixed-tag case, `effect@<ref>`). `remote` may be a URL; an
   * embedded credential never surfaces in an error value.
   */
  readonly lsRemote: {
    (
      cwd: string,
      remote: string,
      options?: {
        readonly heads?: boolean;
        readonly tags?: boolean;
        readonly patterns?: ReadonlyArray<string>;
      }
    ): Effect.Effect<ReadonlyArray<LsRemoteEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      remote: string,
      options?: {
        readonly heads?: boolean;
        readonly tags?: boolean;
        readonly patterns?: ReadonlyArray<string>;
      }
    ): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<LsRemoteEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git ls-tree -r -z [--full-tree] <ref> [-- <pathspec>...]` — every path in
   * the tree at `ref`, recursively, optionally scoped to `pathspec`.
   * `fullTree: true` lists the whole tree with root-anchored paths whatever
   * the `cwd`, so a reader need not resolve `repoRoot` first.
   */
  readonly lsTree: {
    (
      cwd: string,
      ref: string,
      options?: { readonly pathspec?: ReadonlyArray<string>; readonly fullTree?: boolean }
    ): Effect.Effect<ReadonlyArray<LsTreeEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      options?: { readonly pathspec?: ReadonlyArray<string>; readonly fullTree?: boolean }
    ): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<LsTreeEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git merge-base <a> <b>` — the best common ancestor commit, trimmed.
   * For when absence is EXCEPTIONAL: two refs with no common ancestor fail
   * loudly as `GitCommandError` (git's silent exit 1 rides the generic
   * failure arm). When "no common ancestor" is a legitimate answer at your
   * call site — a reachability probe — use `mergeBaseOption` instead.
   */
  readonly mergeBase: {
    (cwd: string, a: string, b: string): Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      a: string,
      b: string
    ): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git merge-base <a> <b>` — the best common ancestor commit, trimmed, as
   * a PROBE: two refs with no common ancestor (disjoint histories — a
   * grafted CI clone, an orphan branch) answer `Option.none`, never an
   * error, because git signals that case as a silent exit 1. An unknown ref
   * is still a real failure (`UnknownRefError`), and a noisy exit 1 stays a
   * loud `GitCommandError`. The sibling of `mergeBase`, which fails loudly
   * when the ancestor is absent.
   *
   * **Details**
   *
   * The value is a plain sha string — no decode or brand step. A caller
   * that only wants reachability ("do these histories connect?") reads the
   * boolean directly: `Option.isSome(yield* git.mergeBaseOption(cwd, a, b))`.
   */
  readonly mergeBaseOption: {
    (
      cwd: string,
      a: string,
      b: string
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      a: string,
      b: string
    ): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git merge-tree --write-tree -z --name-only <base> <head>` — merges two
   * commits in the object store only, without touching the index, the
   * working tree or any ref, and answers a {@link MergeTreeResult}.
   *
   * **Details**
   *
   * A clean merge answers `clean` with the merged tree. A conflict is data,
   * not a failure: git's exit 1 answers `conflicted` with the tree it wrote
   * (conflict markers included), each conflicted path once and git's
   * informational messages. A revision git cannot resolve fails as
   * `UnknownRefError`, unrelated histories (exit 128) as `GitCommandError`,
   * and output the parser cannot read fails closed as `GitCommandError`
   * with an `unparseable merge-tree output` detail. Needs git 2.38 or later.
   */
  readonly mergeTree: {
    (
      cwd: string,
      base: string,
      head: string
    ): Effect.Effect<MergeTreeResult, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      base: string,
      head: string
    ): (cwd: string) => Effect.Effect<MergeTreeResult, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git mv [--force] -- <source> <destination>` — moves or
   * renames a tracked path, updating the index and the working tree
   * together.
   */
  readonly mv: {
    (
      cwd: string,
      source: string,
      destination: string,
      options?: { readonly force?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      source: string,
      destination: string,
      options?: { readonly force?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git diff --name-status -z [--relative] [--no-renames] [--find-renames=<n>%] [--diff-filter=<letters>] [<base> | <base>...<head> | <base> <head>] [-- <pathspec>...]`
   * — the changed paths with their status codes. `head` omitted diffs the
   * working tree against `base`; `head` present diffs the merge-base range,
   * or the two trees directly when `twoDot` is set.
   *
   * **Details**
   *
   * `findRenames` is the similarity threshold rename detection uses, a whole
   * percent 1..100; `diffFilter` keeps only the named status letters
   * (`[ACDMRTUXB*]`, lower case excludes them); `pathspec` scopes the diff;
   * `twoDot` emits `<base> <head>` in place of `<base>...<head>`;
   * `noRenames` turns rename detection off, so a move lists as `deleted`
   * plus `added`, and is refused together with `findRenames`. Either
   * option outside its domain, or a pathspec entry git would read as an
   * option, is refused typed before any spawn. Each rename or copy entry
   * carries git's similarity percent as {@link NameStatusEntry}'s `score`.
   * Output the parser cannot read fails as `GitCommandError` with an
   * `unparseable name-status output` detail — never as an invented entry.
   */
  readonly nameStatus: {
    (
      cwd: string,
      options: {
        readonly base: string;
        readonly head?: string;
        readonly relative?: boolean;
        readonly findRenames?: number;
        readonly noRenames?: boolean;
        readonly diffFilter?: string;
        readonly pathspec?: ReadonlyArray<string>;
        readonly twoDot?: boolean;
      }
    ): Effect.Effect<ReadonlyArray<NameStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly base: string;
      readonly head?: string;
      readonly relative?: boolean;
      readonly findRenames?: number;
      readonly noRenames?: boolean;
      readonly diffFilter?: string;
      readonly pathspec?: ReadonlyArray<string>;
      readonly twoDot?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<NameStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git pull [--rebase] [--ff-only] <remote> [<ref>]` — fetches
   * and integrates.
   *
   * **Details**
   *
   * The two branchable failures are typed: {@link DirtyWorktreeError} when
   * local modifications block the merge before it starts (the tree is
   * untouched — commit or stash first), and {@link MergeConflictError} when
   * the merge stopped on conflicts (markers are in the tree; resolve or
   * abort). `remote` may be a URL; an embedded credential never surfaces in
   * an error value.
   */
  readonly pull: {
    (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly ref?: string;
        readonly rebase?: boolean;
        readonly ffOnly?: boolean;
      }
    ): Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
    (options?: {
      readonly remote?: string;
      readonly ref?: string;
      readonly rebase?: boolean;
      readonly ffOnly?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
  };
  /**
   * Mutating: `git push [--force | --force-with-lease] [--tags] [--set-upstream] <remote> [<refspec>]`
   * — updates remote refs.
   *
   * **Details**
   *
   * A rejected push — the remote moved (`fetch first` /
   * `non-fast-forward`), or a `--force-with-lease` lease failure
   * (`stale info`) — fails typed as {@link NonFastForwardError}, the signal
   * a fetch-then-retry fallback branches on. Every other failure stays
   * {@link GitCommandError}. `remote` may be a URL; an embedded credential
   * never surfaces in an error value.
   */
  readonly push: {
    (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly refspec?: string;
        readonly force?: boolean;
        readonly forceWithLease?: boolean;
        readonly tags?: boolean;
        readonly setUpstream?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError | NonFastForwardError>;
    (options?: {
      readonly remote?: string;
      readonly refspec?: string;
      readonly force?: boolean;
      readonly forceWithLease?: boolean;
      readonly tags?: boolean;
      readonly setUpstream?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError | NonFastForwardError>;
  };
  /** `git cat-file -e <ref>` — whether `ref` resolves to an existing object. */
  readonly refExists: {
    (cwd: string, ref: string): Effect.Effect<boolean, GitCommandError | NotARepositoryError>;
    (ref: string): (cwd: string) => Effect.Effect<boolean, GitCommandError | NotARepositoryError>;
  };
  /**
   * Mutating: `git remote add <name> <url>` — registers a new remote.
   * `url`'s embedded credential (if any) never surfaces in an error value,
   * and the method's span annotates `name` only.
   */
  readonly remoteAdd: {
    (
      cwd: string,
      name: string,
      url: string
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      url: string
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git remote remove <name>` — deletes a remote, its
   * remote-tracking refs and its configuration. A missing remote fails
   * loudly as {@link GitCommandError} — probe with `remoteUrl` first when
   * idempotency is wanted.
   */
  readonly remoteRemove: {
    (cwd: string, name: string): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (name: string): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git remote set-url <name> <url>` — rewrites a remote's fetch
   * URL. `url`'s embedded credential (if any) never surfaces in an error
   * value, and the method's span annotates `name` only.
   */
  readonly remoteSetUrl: {
    (
      cwd: string,
      name: string,
      url: string
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      url: string
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git remote get-url [--push] <remote>` — the trimmed fetch URL (or, with
   * `options.push`, the push URL), or `Option.none` when the remote does not
   * exist.
   */
  readonly remoteUrl: {
    (
      cwd: string,
      options?: { readonly remote?: string; readonly push?: boolean }
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remote?: string;
      readonly push?: boolean;
    }): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --show-toplevel` — the absolute repository root path, trimmed.
   *
   * **Gotchas**
   *
   * The path is PHYSICAL: git resolves symlinks, so it need not match the
   * spelling the caller reached the repository by (every macOS tmpdir:
   * `/var` → `/private/var`). Bound an upward walk by it with
   * `@beep/walker`'s `Walker.ascendWithin`, never `Walker.ascend`'s
   * lexical `stopAt`. For identity across worktrees, use `commonDir`.
   */
  readonly repoRoot: (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git reset --soft|--mixed|--hard [<ref>]` — moves `HEAD` (and,
   * per `options.mode`, the index and working tree) to `options.ref`
   * (default `HEAD`, i.e. unstage/discard against the current commit).
   *
   * **Details**
   *
   * The restore-before-retry primitive: **a failed reset fails loudly and
   * typed** (`GitCommandError` on any non-zero exit), never a silent no-op —
   * a reset that silently did nothing would hand a retry of a
   * non-idempotent operation the same dirty tree. `mode` defaults to
   * `"mixed"` (git's own default), emitted explicitly in the argv.
   *
   * `mode: "hard"` is destructive and legitimately reached for: after
   * committing through an out-of-band channel (e.g. the GitHub Data API,
   * which writes the commit server-side), `reset --hard origin/<branch>`
   * is how the local tree is synchronized to the commit it never made.
   */
  readonly reset: {
    (
      cwd: string,
      options?: {
        readonly mode?: "soft" | "mixed" | "hard";
        readonly ref?: string;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly mode?: "soft" | "mixed" | "hard";
      readonly ref?: string;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git restore [--source <ref>] [--staged] [--worktree] -- <paths...>`
   * — restores `paths` from the index, or from `options.source`. The
   * `checkout -- .`-shaped operation: `restore(cwd, ["."])` discards all
   * unstaged working-tree changes.
   *
   * **Details**
   *
   * A separate member deliberately, because `checkout`'s option-injection
   * guard refuses `--` and option-like refs by design and stays that way.
   * `restore`'s paths always sit behind a literal `--`, so they are
   * injection-safe by construction; only `options.source` is a guarded ref.
   * With neither `staged` nor `worktree` set, git restores the working tree.
   */
  readonly restore: {
    (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly source?: string;
        readonly staged?: boolean;
        readonly worktree?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>,
      options?: {
        readonly source?: string;
        readonly staged?: boolean;
        readonly worktree?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-list [--max-count=<n>] [--first-parent] <ref>` — the commit
   * shas reachable from `ref` (which may be a range, `main..feat`), newest
   * first. A non-integer `options.limit` is refused typed before any spawn.
   */
  readonly revList: {
    (
      cwd: string,
      ref: string,
      options?: { readonly limit?: number; readonly firstParent?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      options?: { readonly limit?: number; readonly firstParent?: boolean }
    ): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-list --count [--first-parent] <range> --` — how many commits
   * `range` selects (`base..head`, one ref, `^a b`), as a non-negative
   * integer.
   *
   * **Details**
   *
   * The answer is decoded fail-closed: anything but one decimal count fails
   * as `GitCommandError` with an `unparseable rev-list count output` detail,
   * never as zero. A range git cannot resolve fails as `UnknownRefError`;
   * an option-like range is refused typed before any spawn.
   */
  readonly revListCount: {
    (
      cwd: string,
      range: string,
      options?: { readonly firstParent?: boolean }
    ): Effect.Effect<number, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      range: string,
      options?: { readonly firstParent?: boolean }
    ): (cwd: string) => Effect.Effect<number, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --verify <ref>` — resolves `ref` to its full object id,
   * trimmed. With any option the argv is
   * `rev-parse --verify [--quiet] --end-of-options <ref>[^{commit}]`:
   * `peel: "commit"` resolves an annotated tag through to its commit, and
   * `quiet` keeps git's unknown-ref diagnostic off stderr. An unknown ref is
   * `UnknownRefError` either way — with `quiet` git signals it as a silent
   * exit 1, which this member alone reads as unknown-ref.
   */
  readonly revParse: {
    (
      cwd: string,
      ref: string,
      options?: { readonly peel?: "commit"; readonly quiet?: boolean }
    ): Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      options?: { readonly peel?: "commit"; readonly quiet?: boolean }
    ): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git rm [--cached] [-r] [--force] -- <paths...>` — removes
   * `paths` from the index and (without `options.cached`) the working tree.
   * `cached: true` is the unstage-but-keep-file form a submodule removal
   * sequence needs.
   */
  readonly rm: {
    (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly cached?: boolean;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>,
      options?: {
        readonly cached?: boolean;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git show <ref>:<path>` — the contents of `path` at `ref`, or `Option.none` if absent there. */
  readonly show: {
    (
      cwd: string,
      ref: string,
      path: string
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      path: string
    ): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git sparse-checkout set (--cone | --no-cone) <patterns...>`
   * — rewrites which paths are checked out in the working tree to
   * `patterns`, in cone mode or full pattern mode per `options.cone`.
   */
  readonly sparseCheckoutSet: {
    (
      cwd: string,
      patterns: ReadonlyArray<string>,
      options: { readonly cone: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      patterns: ReadonlyArray<string>,
      options: { readonly cone: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git diff --name-only -z [--relative] --cached [--no-renames] [--diff-filter=<letters>] [<head>] [-- <pathspec>...]`
   * — the staged paths: the index against `HEAD`, or against `head` when one
   * is named. `diffFilter`, `noRenames` and `pathspec` behave as they do for
   * `changedFiles`, guards included.
   */
  readonly stagedChanges: {
    (
      cwd: string,
      options?: {
        readonly relative?: boolean;
        readonly diffFilter?: string;
        readonly head?: string;
        readonly noRenames?: boolean;
        readonly pathspec?: ReadonlyArray<string>;
      }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
      readonly diffFilter?: string;
      readonly head?: string;
      readonly noRenames?: boolean;
      readonly pathspec?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git stash apply [stash@{n}]` — applies a stash entry and
   * keeps it on the stack. Fails exactly like `stashPop`
   * ({@link DirtyWorktreeError} / {@link MergeConflictError} are the
   * branchable shapes).
   */
  readonly stashApply: {
    (
      cwd: string,
      options?: { readonly index?: number }
    ): Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
    (options?: {
      readonly index?: number;
    }): (
      cwd: string
    ) => Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
  };
  /**
   * Mutating: `git stash drop [stash@{n}]` — deletes a stash entry
   * (`options.index`, default the latest) without applying it.
   */
  readonly stashDrop: {
    (
      cwd: string,
      options?: { readonly index?: number }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly index?: number;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git stash list -z --format=%gd%x1f%H%x1f%gs` — every stash entry as a
   * {@link StashEntry} (reflog selector, sha, subject). The entry's
   * position in the returned array IS its current index — `entries[2]` is
   * `stash@{2}` — which is what the index-taking stash methods consume.
   */
  readonly stashList: (
    cwd: string
  ) => Effect.Effect<ReadonlyArray<StashEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git stash pop [stash@{n}]` — applies a stash entry
   * (`options.index`, default the latest) and drops it on success.
   *
   * **Details**
   *
   * The two branchable failures are typed: {@link DirtyWorktreeError} when
   * local changes would be overwritten (the tree is untouched), and
   * {@link MergeConflictError} when the apply stopped on conflicts — in
   * that case the stash entry is KEPT, and the caller owns resolving. A
   * non-integer index is refused typed before any spawn.
   */
  readonly stashPop: {
    (
      cwd: string,
      options?: { readonly index?: number }
    ): Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
    (options?: {
      readonly index?: number;
    }): (
      cwd: string
    ) => Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
  };
  /**
   * Mutating: `git stash push [--include-untracked] [--keep-index] [-m <message>] [-- <paths>...]`
   * — saves the working-tree (and index) state onto the stash stack and
   * resets the tree to `HEAD`; `options.keepIndex` leaves the staged changes
   * in the index and the working tree.
   */
  readonly stashPush: {
    (
      cwd: string,
      options?: {
        readonly message?: string;
        readonly includeUntracked?: boolean;
        readonly paths?: ReadonlyArray<string>;
        readonly keepIndex?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly message?: string;
      readonly includeUntracked?: boolean;
      readonly paths?: ReadonlyArray<string>;
      readonly keepIndex?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git [--no-optional-locks] status --porcelain -z [--untracked-files=<mode>] [--ignore-submodules=<when>] [--no-renames] [-- <pathspec>...]`
   * — the working tree's porcelain status listing.
   *
   * **Details**
   *
   * `untrackedFiles: "all"` names every file inside an untracked directory
   * where git's default collapses it to one `dir/` entry (`"no"` drops
   * untracked paths); `ignoreSubmodules` picks which submodule changes are
   * hidden; `noRenames` reports a staged rename as a `D` and an `A` entry
   * instead of one `R` entry carrying `origPath`; `noOptionalLocks` is the
   * GLOBAL flag that keeps git from refreshing the index on disk, for a
   * reader polling a tree another process is working in; `pathspec` scopes
   * the report behind `--`, each entry passing the option-like guard. With no
   * option passed the argv is unchanged.
   */
  readonly status: {
    (
      cwd: string,
      options?: {
        readonly ignoreSubmodules?: StatusIgnoreSubmodules;
        readonly noOptionalLocks?: boolean;
        readonly noRenames?: boolean;
        readonly pathspec?: ReadonlyArray<string>;
        readonly untrackedFiles?: StatusUntrackedFiles;
      }
    ): Effect.Effect<ReadonlyArray<StatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly ignoreSubmodules?: StatusIgnoreSubmodules;
      readonly noOptionalLocks?: boolean;
      readonly noRenames?: boolean;
      readonly pathspec?: ReadonlyArray<string>;
      readonly untrackedFiles?: StatusUntrackedFiles;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<StatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule absorbgitdirs [-- <paths>...]` — moves each
   * submodule's embedded `.git` directory into the superproject's
   * `.git/modules/` and leaves a gitfile pointer behind.
   */
  readonly submoduleAbsorbgitdirs: {
    (
      cwd: string,
      options?: { readonly paths?: ReadonlyArray<string> }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule add [--depth <n>] -- <url> <path>` —
   * registers and initializes a new submodule at `options.path`, cloned
   * from `options.url`, optionally shallow.
   */
  readonly submoduleAdd: {
    (
      cwd: string,
      options: {
        readonly url: string;
        readonly path: string;
        readonly depth?: number;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly url: string;
      readonly path: string;
      readonly depth?: number;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule deinit [--force] (--all | -- <paths>...)` —
   * unregisters submodules: clears their working trees and removes their
   * `.git/config` registration. Requires either `options.paths` or
   * `options.all: true`; neither is refused typed before any spawn, exactly
   * as git itself would refuse it. `options.force` discards local changes
   * in the submodule working tree.
   */
  readonly submoduleDeinit: {
    (
      cwd: string,
      options: {
        readonly paths?: ReadonlyArray<string>;
        readonly all?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly paths?: ReadonlyArray<string>;
      readonly all?: boolean;
      readonly force?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule foreach [--quiet] [--recursive] <command>` — runs one
   * shell command string in every checked-out submodule and returns the
   * collected stdout. The command can mutate anything, which is why the
   * method is marked mutating regardless of what it runs; a command
   * beginning with `-` is refused typed before any spawn. Without
   * `options.quiet` git prints `Entering '<path>'` on stdout before each
   * submodule's output; with it the stdout is the command's alone.
   */
  readonly submoduleForeach: {
    (
      cwd: string,
      command: string,
      options?: { readonly recursive?: boolean; readonly quiet?: boolean }
    ): Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      command: string,
      options?: { readonly recursive?: boolean; readonly quiet?: boolean }
    ): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule init [-- <paths>...]` — registers submodules
   * from `.gitmodules` into `.git/config` (all of them, or only
   * `options.paths`) without cloning or checking anything out.
   */
  readonly submoduleInit: {
    (
      cwd: string,
      options?: { readonly paths?: ReadonlyArray<string> }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule set-branch (--branch <branch> | --default) -- <path>`
   * — records the branch the submodule tracks in `.gitmodules`, or clears
   * it back to the default when `options.branch` is omitted.
   */
  readonly submoduleSetBranch: {
    (
      cwd: string,
      path: string,
      options?: { readonly branch?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      options?: { readonly branch?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule set-url -- <path> <url>` — rewrites the
   * submodule's URL in `.gitmodules` and synchronizes it into `.git/config`.
   *
   * **Details**
   *
   * The url never surfaces raw in an error — an embedded `userinfo@`
   * credential is masked in `GitCommandError.args`/`.message` — and the
   * method's span annotates `cwd` and `path` only.
   */
  readonly submoduleSetUrl: {
    (
      cwd: string,
      path: string,
      url: string
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      url: string
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git submodule status [--recursive] [-- <paths>...]` — one
   * {@link SubmoduleStatusEntry} per registered submodule, decoding git's
   * state prefix (`current` / `uninitialized` / `outOfSync` / `conflict`).
   *
   * **Details**
   *
   * The output is line-based (git offers no `-z` mode here), so a submodule
   * path containing a newline would corrupt the parse — a git-imposed
   * limitation, recorded on the entry class.
   */
  readonly submoduleStatus: {
    (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ): Effect.Effect<ReadonlyArray<SubmoduleStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
      readonly recursive?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<SubmoduleStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule sync [--recursive] [-- <paths>...]` — re-copies
   * each submodule's URL from `.gitmodules` into `.git/config` (and the
   * submodule's own `remote.origin.url`), so a `.gitmodules` URL change
   * actually reaches git's live configuration.
   */
  readonly submoduleSync: {
    (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
      readonly recursive?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating:
   * `git submodule update [--init] [--checkout] [--remote] [--no-fetch] [--recursive] [--force] [--depth <n>] [-- <paths>...]`
   * — updates registered submodules in the working tree, optionally
   * initializing them (`options.init`), with an optional depth limit and
   * scoped to `options.paths`.
   *
   * **Details**
   *
   * `options.checkout` is the documented override for a
   * `submodule.<name>.update = none` configuration — without it, updating
   * such a submodule silently no-ops (git reports success and checks out
   * nothing). `options.fetch` accepts only the literal `false` (emitting
   * `--no-fetch`): the default already fetches and git has no positive
   * spelling. `options.remote` tracks the remote branch's tip instead of
   * the recorded sha; `options.recursive` descends into nested submodules;
   * `options.force` discards local changes in the submodule working tree.
   */
  readonly submoduleUpdate: {
    (
      cwd: string,
      options?: {
        readonly init?: boolean;
        readonly depth?: number;
        readonly paths?: ReadonlyArray<string>;
        readonly checkout?: boolean;
        readonly remote?: boolean;
        readonly fetch?: false;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly init?: boolean;
      readonly depth?: number;
      readonly paths?: ReadonlyArray<string>;
      readonly checkout?: boolean;
      readonly remote?: boolean;
      readonly fetch?: false;
      readonly recursive?: boolean;
      readonly force?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git tag [--force] [-m <message>] <name> [<ref>]` — creates a
   * lightweight tag at `options.ref` (default `HEAD`), or an annotated one
   * when `options.message` is given. An existing tag fails loudly unless
   * `options.force` is set.
   */
  readonly tagCreate: {
    (
      cwd: string,
      name: string,
      options?: {
        readonly ref?: string;
        readonly message?: string;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      options?: {
        readonly ref?: string;
        readonly message?: string;
        readonly force?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** Mutating: `git tag --delete <name>` — deletes a local tag. */
  readonly tagDelete: {
    (cwd: string, name: string): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (name: string): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git tag --list [<pattern>]` — tag names, optionally filtered by a
   * shell-glob `options.pattern`.
   */
  readonly tagList: {
    (
      cwd: string,
      options?: { readonly pattern?: string }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly pattern?: string;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git diff --name-only -z [--relative] [--no-renames] [--diff-filter=<letters>] [<head>] [-- <pathspec>...]`
   * — the unstaged working-tree paths: the working tree against the index,
   * or against the commit `head` when one is named (staged and unstaged
   * changes alike, then). `diffFilter`, `noRenames` and `pathspec` behave as
   * they do for `changedFiles`, guards included.
   */
  readonly unstagedChanges: {
    (
      cwd: string,
      options?: {
        readonly relative?: boolean;
        readonly diffFilter?: string;
        readonly head?: string;
        readonly noRenames?: boolean;
        readonly pathspec?: ReadonlyArray<string>;
      }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
      readonly diffFilter?: string;
      readonly head?: string;
      readonly noRenames?: boolean;
      readonly pathspec?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git ls-files --others --exclude-standard -z [--full-name] [-- <pathspec>...]`
   * — the untracked paths, optionally scoped to `pathspec` (each entry passing
   * the option-like guard).
   */
  readonly untrackedFiles: {
    (
      cwd: string,
      options?: { readonly relative?: boolean; readonly pathspec?: ReadonlyArray<string> }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
      readonly pathspec?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git check-ref-format <ref>`, then `git update-ref <ref> <new> ""`
   * for `{ create: <new> }` or `git update-ref -d <ref> <expected>` for
   * `{ delete: <expected> }` — creates or deletes one ref as a
   * compare-and-swap.
   *
   * **Details**
   *
   * The refname is checked by git's own `check-ref-format` before any ref
   * is written: an invalid name (a space, `..`, a one-level name) is
   * refused as `GitCommandError` of kind `"refused"`. A create fails as
   * `GitCommandError` (kind `"failed"`, git's stderr kept) when the ref
   * already exists, and a delete when the ref no longer points at
   * `expected`; the callers branch on the failure, not on a conflict tag. A
   * value git cannot resolve fails as `GitCommandError`, or as
   * `UnknownRefError` when git's stderr names it an unknown revision. An
   * option-like ref or value is refused typed before any spawn.
   */
  readonly updateRef: {
    (
      cwd: string,
      ref: string,
      change: UpdateRefChange
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      change: UpdateRefChange
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git for-each-ref --format=%(refname)%00%(upstream) refs/heads/<branch>`
   * — the full upstream refname a local branch tracks
   * (`refs/remotes/origin/main`), or `Option.none` when the branch has no
   * upstream or does not exist.
   *
   * **Details**
   *
   * The answer comes from exactly `refs/heads/<branch>`: for-each-ref also
   * matches the pattern as a path prefix, and a prefix match for another
   * branch (`feat/x` for `feat`) is ignored rather than reported as this
   * branch's upstream. An option-like branch is refused typed before any
   * spawn; a line the parser cannot read fails closed as `GitCommandError`.
   */
  readonly upstream: {
    (cwd: string, branch: string): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError>;
    (branch: string): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError>;
  };
  /**
   * The union of unstaged, staged and untracked working-tree paths —
   * `git diff --name-only -z [--relative]`, `--cached`, and
   * `git ls-files --others --exclude-standard -z`, deduplicated. Pass
   * `relative: true` for `cwd`-relative diff paths (`ls-files` reports
   * `cwd`-relative paths by default too; when `relative` is `false`,
   * `--full-name` makes it repo-root-relative instead, matching the
   * un-`--relative` diffs). No ref is involved, so it never fails `UnknownRefError`.
   */
  readonly workingChanges: {
    (
      cwd: string,
      options?: { readonly relative?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git worktree add [--force] [--detach] [-b <name>] <path> [<ref>]` —
   * creates a linked working tree at `path`, checked out at `options.ref`
   * (or a branch named after `path`'s basename). `options.newBranch`
   * creates that branch at `options.ref` and checks it out; it is refused
   * together with `detach`, and when git would read it as an option.
   */
  readonly worktreeAdd: {
    (
      cwd: string,
      path: string,
      options?: {
        readonly ref?: string;
        readonly detach?: boolean;
        readonly force?: boolean;
        readonly newBranch?: string;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      options?: {
        readonly ref?: string;
        readonly detach?: boolean;
        readonly force?: boolean;
        readonly newBranch?: string;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git worktree list --porcelain -z` — every working tree (the main one
   * first) as a {@link WorktreeEntry}; `prunable` reports whether
   * `worktree prune` would remove the entry.
   */
  readonly worktreeList: (
    cwd: string
  ) => Effect.Effect<ReadonlyArray<WorktreeEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git worktree prune` — drops the registrations of linked
   * working trees whose directory no longer exists. Directories still on
   * disk are never touched, so it is safe to run after every removal.
   */
  readonly worktreePrune: (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git worktree remove [--force] <path>` — removes a linked
   * working tree. A dirty worktree fails loudly unless `options.force` is
   * set.
   */
  readonly worktreeRemove: {
    (
      cwd: string,
      path: string,
      options?: { readonly force?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      options?: { readonly force?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
}

/**
 * The data-first signature of every {@link GitShape} member: what a
 * {@link Git.makeTest} stub implements.
 *
 * **Details**
 *
 * The pipeable members of `GitShape` are overloaded (data-first and
 * data-last). A stub writes only the data-first form; `makeTest` derives the
 * data-last form with the same `dual` dispatch the live layer uses. Members
 * with a single signature pass through unchanged.
 *
 * **Example** (Type a stub for an overloaded member)
 *
 * ```ts
 * import type { GitStubs } from "@beep/git/Git";
 * import * as Effect from "effect/Effect";
 *
 * const revParse: GitStubs["revParse"] = (_cwd, ref) => Effect.succeed(`sha-of-${ref}`);
 * console.log(Effect.runSync(revParse("/repo", "HEAD"))); // sha-of-HEAD
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type GitStubs = {
  readonly [K in keyof GitShape]: GitShape[K] extends {
    (...args: infer DataFirstArgs): infer DataFirstResult;
    (...args: infer _DataLastArgs): infer _DataLastResult;
  }
    ? (...args: DataFirstArgs) => DataFirstResult
    : GitShape[K];
};

/**
 * The default for every {@link Git.makeTest} method a test did not stub: a
 * defect naming the method, so an unexercised call fails loudly instead of
 * succeeding with a lie or failing with a dishonest typed error.
 */
const notStubbed =
  (method: string) =>
  (..._args: ReadonlyArray<unknown>) =>
    Effect.die(
      NotStubbedError.make({
        message: `Git.makeTest: ${method}() was called but not stubbed — no honest default exists for a test double; pass a \`${method}\` override.`,
      })
    );

/** The caller's stub for `method`, or the defect-raising placeholder that names it. */
const stubOf = <K extends keyof GitStubs>(
  overrides: Partial<GitStubs>,
  method: K
): GitStubs[K] | ReturnType<typeof notStubbed> => overrides[method] ?? notStubbed(method);

/**
 * Typed git introspection over core's `ChildProcessSpawner`: read a
 * repository's state at any ref without checking it out (including the
 * network read `lsRemote` and the index read `lsFiles`), plus the mutating
 * tier — checkout/fetch, the working-tree restore trio and stash, branches
 * and tags, remotes, worktrees, commit/push/pull, submodules,
 * sparse-checkout, config writes and staging — that changes it. Every
 * mutating method's TSDoc opens with the literal word `Mutating:`.
 *
 * **Details**
 *
 * Every method takes `cwd` explicitly and classifies git's stderr/exit-code
 * taxonomy exactly once, in the internal classification module — a
 * spawn-level `PlatformError` and `Cause.TimeoutError` never escape a `Git`
 * method; every failure surfaces as {@link GitCommandError},
 * {@link NotARepositoryError}, {@link UnknownRefError}, or one of the three
 * consumer-branchable classifications ({@link NonFastForwardError} from
 * `push`; {@link MergeConflictError} and {@link DirtyWorktreeError} from the
 * merge-shaped `pull` / `stashPop` / `stashApply`), or degrades to the
 * documented non-error (`Option.none`, `false`, the empty array).
 *
 * Every method whose TSDoc opens "Mutating:" changes the working tree,
 * `HEAD`, the index, the repository config, the object database and
 * remote-tracking refs (`fetch`), or a submodule. None of it is
 * safe to run concurrently against the same `cwd`; nothing here serializes
 * that — a caller running two mutating calls (or a mutating call alongside a
 * read) against one `cwd` at once owns the race.
 *
 * **Every spawn already runs under the instance's {@link GitOptions}**: a
 * command that has not answered within `timeout` (default 30 s) fails as a
 * {@link GitCommandError} with `detail` set to `"timed out after 30s"`, and a
 * stream that outgrows `maxOutputBytes` (default 16 MiB) kills the child and
 * fails as kind `"truncated"`. Parsed members fail closed too: output the
 * parser cannot read is a `GitCommandError` whose `detail` opens
 * `unparseable <what> output:`, never an invented entry.
 *
 * That timeout is per run, not per member call. The network-touching members
 * (`lsRemote`, `fetch`, `fetchUnshallow`, `push`, `pull`, `submoduleAdd`,
 * `submoduleUpdate`) first resolve their ssh command with up to two concurrent
 * local `git config` reads, each bounded separately, so their worst case is
 * 60 s; `fetchAny`, which runs `fetch` twice, is 120 s. A consumer merely
 * duplicating a 30 s layer buys nothing but two ceilings racing each other;
 * one whose budget is tighter than the figures above still needs its own.
 *
 * **Redaction policy (documented, not just convention).** Error values
 * persist only the constructor's REDACTED argv (see `GitCommandError.args`),
 * and span annotations carry stable identifiers only — `cwd`, refs, keys,
 * paths, remote names — never config values and never URLs, which can embed
 * userinfo.
 *
 * **Example** (Read the repository root, current branch, and changed files)
 *
 * ```ts
 * import { Git } from "@beep/git/Git";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const program = Effect.gen(function* () {
 *   const git = yield* Git;
 *   const root = yield* git.repoRoot(process.cwd());
 *   const branch = yield* git.currentBranch(root); // Option.none() when detached
 *   const changed = yield* git.changedFiles(root, { base: "origin/main", head: "HEAD" });
 *   return { root, branch: O.getOrNull(branch), changed };
 * });
 *
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class Git extends Context.Service<Git, GitShape>()($I`Git`) {
  /**
   * Builds the live service shape under explicit {@link GitOptions}: resolves
   * `ChildProcessSpawner` and reads the ambient ssh environment once — every
   * method's `R` is `never`.
   *
   * **Details**
   *
   * The same construction {@link Git.layerWith} runs, as a plain effect. A
   * caller that adopts one or two `Git` reads inside a module whose own
   * requirements already include `ChildProcessSpawner` provides it with
   * `Effect.provideServiceEffect(Git, Git.makeWith(options))` instead of
   * providing a layer below the application edge.
   *
   * **Example** (Provide a tightly bounded service for one read)
   *
   * ```ts
   * import { Git, GitOptions } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   *
   * const options = GitOptions.make({ maxOutputBytes: 64 * 1024 });
   * const root = Git.use((git) => git.repoRoot("/repo")).pipe(Effect.provideServiceEffect(Git, Git.makeWith(options)));
   * console.log(Effect.isEffect(root)); // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeWith = (
    options: GitOptions
  ): Effect.Effect<GitShape, never, ChildProcessSpawner.ChildProcessSpawner> =>
    Effect.map(makeExecution(options), makeShape);

  /**
   * {@link Git.makeWith} under the default {@link GitOptions}: a 16 MiB
   * per-stream output ceiling and a 30 s per-run timeout.
   *
   * **Example** (Provide the service for one read)
   *
   * ```ts
   * import { Git } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   *
   * const root = Git.use((git) => git.repoRoot("/repo")).pipe(Effect.provideServiceEffect(Git, Git.make));
   * console.log(Effect.isEffect(root)); // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make: Effect.Effect<GitShape, never, ChildProcessSpawner.ChildProcessSpawner> = Git.makeWith(
    GitOptions.make({})
  );

  /**
   * {@link Git.layer} with explicit {@link GitOptions}: the per-stream output
   * ceiling and per-run timeout every member of this instance runs under.
   *
   * **Example** (Bound a scanner's git reads)
   *
   * ```ts
   * import { Git, GitOptions } from "@beep/git/Git";
   * import * as Duration from "effect/Duration";
   * import * as Layer from "effect/Layer";
   *
   * const ScannerGit = Git.layerWith(GitOptions.make({ maxOutputBytes: 64 * 1024, timeout: Duration.seconds(5) }));
   * console.log(Layer.isLayer(ScannerGit)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerWith = (options: GitOptions): Layer.Layer<Git, never, ChildProcessSpawner.ChildProcessSpawner> =>
    Layer.effect(Git, Git.makeWith(options));

  /**
   * Resolves `ChildProcessSpawner` once, at construction — every method's `R`
   * is `never`. Runs under the default {@link GitOptions}; {@link Git.layerWith}
   * takes explicit ones.
   *
   * **Example** (Compose a live repository query)
   *
   * ```ts
   * import { Git } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const git = yield* Git;
   *   return yield* git.repoRoot("/repo");
   * }).pipe(Effect.provide(Git.layer));
   * console.log(Effect.isEffect(program)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Git, never, ChildProcessSpawner.ChildProcessSpawner> = Layer.effect(
    this,
    this.make
  );

  /**
   * An in-memory test double of the service shape: stub only the methods the
   * test exercises, every other method **dies** with a defect naming itself.
   *
   * **Gotchas**
   *
   * Unlike `WorkspaceDiscovery.makeTest`, **no method here has an honest
   * default** — the shape is unrelated git operations, and a
   * fabricated answer for any of them (an empty tree, a made-up sha, a silent
   * no-op `checkout`) would leak into consumer logic as fact. So every
   * unstubbed method fails loudly as a defect
   * (`Git.makeTest: <name>() was called but not stubbed`) rather than
   * succeeding with a lie or failing with a dishonest typed error — which is
   * also what makes the double a proof that a test touches *nothing but* the
   * methods it stubbed.
   *
   * The double deliberately models **none** of the live service's semantics:
   * no stderr classification, no option-injection guard (an option-like ref a
   * stub accepts would be refused live), no environment pinning, no timeout,
   * and no `./`-vs-bare path resolution on `show` — a stub answers exactly
   * what it is told and nothing else. A suite exercising any of those wants
   * `Git.layer` over a mocked `ChildProcessSpawner` (or real git) instead.
   *
   * **Example** (Stub file contents with a Git test double)
   *
   * ```ts
   * import { Git } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const double = Git.makeTest({
   *   show: (_cwd, _ref, path) =>
   *     Effect.succeed(path === "./package.json" ? O.some("{}") : O.none()),
   * });
   * // `double.show(...)` answers; `double.status(...)` dies, named.
   * console.log(O.getOrNull(Effect.runSync(double.show("/repo", "HEAD", "./package.json")))); // {}
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<GitStubs> = {}): GitShape => ({
    show: dual(3, stubOf(overrides, "show")),
    lsTree: dual(stringAt(1), stubOf(overrides, "lsTree")),
    refExists: dual(2, stubOf(overrides, "refExists")),
    mergeBase: dual(3, stubOf(overrides, "mergeBase")),
    mergeBaseOption: dual(3, stubOf(overrides, "mergeBaseOption")),
    mergeTree: dual(3, stubOf(overrides, "mergeTree")),
    isAncestor: dual(3, stubOf(overrides, "isAncestor")),
    changedFiles: dual(2, stubOf(overrides, "changedFiles")),
    workingChanges: dual(hasStringSubject, stubOf(overrides, "workingChanges")),
    revParse: dual(stringAt(1), stubOf(overrides, "revParse")),
    checkout: dual(stringAt(1), stubOf(overrides, "checkout")),
    fetch: dual(2, stubOf(overrides, "fetch")),
    fetchAny: dual(2, stubOf(overrides, "fetchAny")),
    fetchUnshallow: dual(hasStringSubject, stubOf(overrides, "fetchUnshallow")),
    isShallow: stubOf(overrides, "isShallow"),
    reset: dual(hasStringSubject, stubOf(overrides, "reset")),
    clean: dual(hasStringSubject, stubOf(overrides, "clean")),
    restore: dual(hasStringSubject, stubOf(overrides, "restore")),
    branchCreate: dual(stringAt(1), stubOf(overrides, "branchCreate")),
    branchDelete: dual(stringAt(1), stubOf(overrides, "branchDelete")),
    submoduleUpdate: dual(hasStringSubject, stubOf(overrides, "submoduleUpdate")),
    submoduleAdd: dual(2, stubOf(overrides, "submoduleAdd")),
    submoduleStatus: dual(hasStringSubject, stubOf(overrides, "submoduleStatus")),
    submoduleInit: dual(hasStringSubject, stubOf(overrides, "submoduleInit")),
    submoduleDeinit: dual(2, stubOf(overrides, "submoduleDeinit")),
    submoduleSync: dual(hasStringSubject, stubOf(overrides, "submoduleSync")),
    submoduleSetUrl: dual(3, stubOf(overrides, "submoduleSetUrl")),
    submoduleSetBranch: dual(stringAt(1), stubOf(overrides, "submoduleSetBranch")),
    submoduleAbsorbgitdirs: dual(hasStringSubject, stubOf(overrides, "submoduleAbsorbgitdirs")),
    submoduleForeach: dual(stringAt(1), stubOf(overrides, "submoduleForeach")),
    sparseCheckoutSet: dual(3, stubOf(overrides, "sparseCheckoutSet")),
    configSet: dual(stringAt(2), stubOf(overrides, "configSet")),
    add: dual(hasStringSubject, stubOf(overrides, "add")),
    nameStatus: dual(2, stubOf(overrides, "nameStatus")),
    unstagedChanges: dual(hasStringSubject, stubOf(overrides, "unstagedChanges")),
    stagedChanges: dual(hasStringSubject, stubOf(overrides, "stagedChanges")),
    untrackedFiles: dual(hasStringSubject, stubOf(overrides, "untrackedFiles")),
    defaultBranch: dual(hasStringSubject, stubOf(overrides, "defaultBranch")),
    currentBranch: dual(hasStringSubject, stubOf(overrides, "currentBranch")),
    repoRoot: stubOf(overrides, "repoRoot"),
    commonDir: stubOf(overrides, "commonDir"),
    gitDir: dual(hasStringSubject, stubOf(overrides, "gitDir")),
    configGet: dual(stringAt(1), stubOf(overrides, "configGet")),
    remoteUrl: dual(hasStringSubject, stubOf(overrides, "remoteUrl")),
    commitInfo: stubOf(overrides, "commitInfo"),
    log: dual(hasStringSubject, stubOf(overrides, "log")),
    status: dual(hasStringSubject, stubOf(overrides, "status")),
    lsRemote: dual(stringAt(1), stubOf(overrides, "lsRemote")),
    remoteAdd: dual(3, stubOf(overrides, "remoteAdd")),
    remoteRemove: dual(2, stubOf(overrides, "remoteRemove")),
    remoteSetUrl: dual(3, stubOf(overrides, "remoteSetUrl")),
    stashPush: dual(hasStringSubject, stubOf(overrides, "stashPush")),
    stashPop: dual(hasStringSubject, stubOf(overrides, "stashPop")),
    stashApply: dual(hasStringSubject, stubOf(overrides, "stashApply")),
    stashDrop: dual(hasStringSubject, stubOf(overrides, "stashDrop")),
    stashList: stubOf(overrides, "stashList"),
    branchList: dual(hasStringSubject, stubOf(overrides, "branchList")),
    tagCreate: dual(stringAt(1), stubOf(overrides, "tagCreate")),
    tagDelete: dual(2, stubOf(overrides, "tagDelete")),
    tagList: dual(hasStringSubject, stubOf(overrides, "tagList")),
    forEachRef: dual(hasStringSubject, stubOf(overrides, "forEachRef")),
    revList: dual(stringAt(1), stubOf(overrides, "revList")),
    revListCount: dual(stringAt(1), stubOf(overrides, "revListCount")),
    upstream: dual(2, stubOf(overrides, "upstream")),
    updateRef: dual(3, stubOf(overrides, "updateRef")),
    commit: dual(stringAt(1), stubOf(overrides, "commit")),
    push: dual(hasStringSubject, stubOf(overrides, "push")),
    pull: dual(hasStringSubject, stubOf(overrides, "pull")),
    configList: dual(hasStringSubject, stubOf(overrides, "configList")),
    configGetAll: dual(stringAt(1), stubOf(overrides, "configGetAll")),
    configUnset: dual(stringAt(1), stubOf(overrides, "configUnset")),
    configRemoveSection: dual(stringAt(1), stubOf(overrides, "configRemoveSection")),
    configRenameSection: dual(stringAt(2), stubOf(overrides, "configRenameSection")),
    rm: dual(hasStringSubject, stubOf(overrides, "rm")),
    mv: dual(stringAt(2), stubOf(overrides, "mv")),
    checkIgnore: dual(hasStringSubject, stubOf(overrides, "checkIgnore")),
    worktreeAdd: dual(stringAt(1), stubOf(overrides, "worktreeAdd")),
    worktreeList: stubOf(overrides, "worktreeList"),
    worktreeRemove: dual(stringAt(1), stubOf(overrides, "worktreeRemove")),
    worktreePrune: stubOf(overrides, "worktreePrune"),
    lsFiles: dual(hasStringSubject, stubOf(overrides, "lsFiles")),
    diffPatch: dual(hasStringSubject, stubOf(overrides, "diffPatch")),
  });

  /**
   * The test layer: {@link Git.makeTest} behind `Layer.succeed`, so a suite
   * provides only the methods it exercises.
   *
   * **Gotchas**
   *
   * A parameterized layer factory mints a **fresh reference per call**, and
   * layers memoize by reference — bind the result to a `const` and reuse it
   * rather than calling `layerTest(...)` at each composition site.
   *
   * **Example** (Provide a Git test layer with a stubbed tree listing)
   *
   * ```ts
   * import { Git, LsTreeEntry } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   *
   * const TestGit = Git.layerTest({
   *   lsTree: () =>
   *     Effect.succeed([
   *       LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path: "package.json" }),
   *     ]),
   * });
   * const program = Effect.gen(function* () {
   *   const git = yield* Git;
   *   const entries = yield* git.lsTree("/repo", "HEAD");
   *   return entries[0]?.path;
   * });
   * console.log(Effect.runSync(program.pipe(Effect.provide(TestGit)))); // package.json
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<GitStubs> = {}): Layer.Layer<Git> =>
    Layer.succeed(Git, Git.makeTest(overrides));
}
