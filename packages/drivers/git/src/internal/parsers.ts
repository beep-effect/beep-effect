/**
 * Git command output parsers, preserving each command's framing and path rules.
 *
 * **Details**
 *
 * Status and name-status rename tokens have opposite path ordering. Config
 * values and log author fields may be empty; pathname tokens cannot contain
 * NUL. These parsers intentionally retain separate wire-format contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { constant, pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  BranchEntry,
  CommitInfo,
  CommitLogEntry,
  ConfigListEntry,
  LsFilesEntry,
  LsRemoteEntry,
  LsTreeEntry,
  NameStatusEntry,
  RefEntry,
  StashEntry,
  StatusEntry,
  SubmoduleStatusEntry,
  WorktreeEntry,
} from "../Git.models.ts";

type NameStatusCode = NameStatusEntry["status"];

/**
 * Splits `-z` (NUL-terminated) output into its constituent entries.
 *
 * **Example** (Read NUL-terminated paths)
 *
 * ```ts import.meta.vitest name="Read NUL-terminated paths"
 * import { parseNulSeparated } from "@beep/git/internal/parsers";
 * import * as A from "effect/Array";
 *
 * A.join(parseNulSeparated("src/a.ts\0src/b.ts\0"), ",") // => "src/a.ts,src/b.ts"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseNulSeparated = (output: string): ReadonlyArray<string> =>
  A.filter(Str.split("\0")(output), (entry) => entry.length > 0);

/**
 * Config values may be empty; only the final NUL terminator is discarded.
 *
 * **Example** (Retain an empty config value)
 *
 * ```ts import.meta.vitest name="Retain an empty config value"
 * import { parseConfigGetAll } from "@beep/git/internal/parsers";
 *
 * parseConfigGetAll("\0enabled\0").length // => 2
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseConfigGetAll = (output: string): ReadonlyArray<string> => {
  if (output === "") return [];
  const tokens = Str.split(output, "\0");
  return Str.endsWith("\0")(output) ? A.dropRight(tokens, 1) : tokens;
};

const lsTreeInput = S.Struct(LsTreeEntry.fields);

/**
 * Parses `git ls-tree -r -z` output: each NUL-terminated entry is
 * `<mode> <type> <oid>\t<path>`. `path` is everything after the first tab,
 * so a path containing spaces or newlines is preserved intact.
 *
 * **Example** (Read a tracked tree entry)
 *
 * ```ts import.meta.vitest name="Read a tracked tree entry"
 * import { parseLsTree } from "@beep/git/internal/parsers";
 *
 * parseLsTree("100644 blob abc\tsrc/a.ts\0")[0]?.path // => "src/a.ts"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseLsTree = (output: string): ReadonlyArray<LsTreeEntry> =>
  A.map(parseNulSeparated(output), (entry) => {
    const tabIndex = pipe(entry, Str.indexOf("\t"), O.getOrElse(constant(-1)));
    const header = Str.split(Str.slice(0, tabIndex)(entry), " ");
    const path = Str.slice(tabIndex + 1)(entry);
    const parsed = {
      mode: header[0],
      // git's own tree-entry format only ever emits these three kinds.
      type: header[1] ?? "blob",
      oid: header[2] ?? "",
      path,
    };
    S.asserts(lsTreeInput, parsed);
    return LsTreeEntry.make(parsed);
  });

/** git's one-letter name-status codes, score digits stripped (`R100` → `R`). */
const NAME_STATUS_CODES: Record<string, NameStatusCode | undefined> = {
  A: "added",
  B: "broken",
  C: "copied",
  D: "deleted",
  M: "modified",
  R: "renamed",
  T: "typeChanged",
  U: "unmerged",
  X: "unknown",
};

/** Decodes the name-status entry whose code token sits at `index`, plus how many tokens it spans. */
const nameStatusEntryAt = (
  tokens: ReadonlyArray<string>,
  index: number,
  code: string
): { readonly entry: NameStatusEntry; readonly width: number } => {
  const letter = Str.slice(0, 1)(code);
  const status = NAME_STATUS_CODES[letter] ?? "unknown";
  return letter === "R" || letter === "C"
    ? {
        entry: NameStatusEntry.make({ status, path: tokens[index + 2] ?? "", oldPath: tokens[index + 1] ?? "" }),
        width: 3,
      }
    : { entry: NameStatusEntry.make({ status, path: tokens[index + 1] ?? "" }), width: 2 };
};

/**
 * Parses `git diff --name-status -z` output. A plain entry is two NUL tokens
 * (`<code>`, `<path>`); a rename/copy entry is three (`<R|C><score>`,
 * `<oldPath>`, `<newPath>`), and only the code's first character carries the
 * status — the similarity score digits are dropped.
 *
 * **Example** (Read a renamed path)
 *
 * ```ts import.meta.vitest name="Read a renamed path"
 * import { parseNameStatus } from "@beep/git/internal/parsers";
 *
 * parseNameStatus("R100\0old.ts\0new.ts\0")[0]?.path // => "new.ts"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseNameStatus = (output: string): ReadonlyArray<NameStatusEntry> => {
  const tokens = Str.split("\0")(output);
  const entries: Array<NameStatusEntry> = [];
  let index = 0;
  while (index < tokens.length) {
    const code = A.getUnsafe(tokens, index);
    if (code === "") {
      index += 1;
      continue;
    }
    const { entry, width } = nameStatusEntryAt(tokens, index, code);
    entries.push(entry);
    index += width;
  }
  return entries;
};

/** A record opens with an empty NUL token, which cannot be a pathname. */
const LOG_RECORD_SEPARATOR = "\0";

/**
 * Reads a log record's NUL-terminated paths starting at `from`. Only the first
 * path loses git's one separator newline. `next` also consumes the next
 * record's opener or the final terminator token.
 */
const readLogPaths = (
  tokens: ReadonlyArray<string>,
  from: number
): { readonly next: number; readonly paths: Array<string> } => {
  const paths: Array<string> = [];
  let index = from;
  while (index < tokens.length) {
    const path = A.getUnsafe(tokens, index);
    if (path === "") break;
    paths.push(paths.length === 0 && Str.startsWith("\n")(path) ? Str.slice(1)(path) : path);
    index += 1;
  }
  return { paths, next: index + 1 };
};

/** Parses the log record whose sha token sits at `index`, plus the index of the record after it. */
const parseLogRecord = (
  tokens: ReadonlyArray<string>,
  index: number
): Result.Result<{ readonly entry: CommitLogEntry; readonly next: number }, string> => {
  const sha = A.getUnsafe(tokens, index);
  const authoredAtIso = tokens[index + 1];
  const committedAtIso = tokens[index + 2];
  const authorName = tokens[index + 3];
  const authorEmail = tokens[index + 4];
  if (
    authoredAtIso === undefined ||
    committedAtIso === undefined ||
    authorName === undefined ||
    authorEmail === undefined
  ) {
    return Result.fail("a log record carried fewer fields than the format declares");
  }
  const authoredAt = DateTime.make(authoredAtIso);
  const committedAt = DateTime.make(committedAtIso);
  if (O.isNone(authoredAt) || O.isNone(committedAt)) {
    return Result.fail(`a log record carried an undecodable date ("${authoredAtIso}", "${committedAtIso}")`);
  }
  const { next, paths } = readLogPaths(tokens, index + 5);
  return Result.succeed({
    entry: CommitLogEntry.make({
      sha,
      authoredAt: authoredAt.value,
      committedAt: committedAt.value,
      authorName,
      authorEmail,
      paths,
    }),
    next,
  });
};

/**
 * Parses `GitCommand.log`'s output. Unlike this package's other parsers this
 * one can FAIL: the two dates have to decode, and a header that does not carry
 * its five fields cannot be answered with a plausible-looking entry.
 *
 * **Details**
 *
 * Each record opens with NUL, followed by five NUL-terminated header fields.
 * Only when the commit touched something, git adds `\n` and one
 * NUL-terminated path each. The next empty token opens the next record;
 * pathnames cannot be empty or contain NUL. Header fields are read by position
 * so empty author fields are preserved. Only the first path loses git's one
 * separator newline; every other pathname byte, including `\x1e`, survives.
 * Empty stdout is an empty log, as for a pathspec no commit touched.
 *
 * **Example** (Read an empty commit listing)
 *
 * ```ts import.meta.vitest name="Read an empty commit listing"
 * import { parseLog } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.isSuccess(parseLog("")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseLog = (output: string): Result.Result<ReadonlyArray<CommitLogEntry>, string> => {
  if (output === "") return Result.succeed([]);
  if (!Str.startsWith(LOG_RECORD_SEPARATOR)(output)) {
    return Result.fail("log output did not open with a record separator");
  }
  const tokens = Str.split(output, "\0");
  const entries: Array<CommitLogEntry> = [];
  let index = 1;
  while (index < tokens.length) {
    const record = parseLogRecord(tokens, index);
    if (Result.isFailure(record)) return Result.fail(record.failure);
    entries.push(record.success.entry);
    index = record.success.next;
  }
  return Result.succeed(entries);
};

const commitInfoInput = S.Struct(CommitInfo.fields);

const statusInput = S.Struct(StatusEntry.fields);

/**
 * Parses `git log -1 --format=%H%x00%G?%x00%B` output: exactly two NUL
 * separators, everything after the second is the raw message, untrimmed.
 * A successful invocation can select no commits; missing separators or an
 * invalid signature verdict return None instead of escaping as a defect.
 *
 * **Example** (Read unsigned commit metadata)
 *
 * ```ts import.meta.vitest name="Read unsigned commit metadata"
 * import { parseCommitInfo } from "@beep/git/internal/parsers";
 * import * as O from "@beep/utils/Option";
 *
 * O.isSome(parseCommitInfo("abc\0N\0message\n")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseCommitInfo = (output: string): O.Option<CommitInfo> => {
  const first = pipe(output, Str.indexOf("\0"), O.getOrElse(constant(-1)));
  if (first < 0) return O.none();
  const separator = /\0/g;
  separator.lastIndex = first + 1;
  const second = separator.exec(output);
  if (second === null) return O.none();
  const parsed = {
    sha: Str.slice(0, first)(output),
    signatureStatus: Str.slice(first + 1, second.index)(output),
    message: Str.slice(second.index + 1)(output),
  };
  return O.map(S.decodeUnknownOption(commitInfoInput)(parsed), (input) => CommitInfo.make(input));
};

/**
 * Parses `git status --porcelain -z` output: each entry is `XY <path>`, and a
 * rename/copy entry appends the ORIGINAL path as one extra NUL token AFTER
 * the new path — the opposite order from `diff --name-status`.
 *
 * **Example** (Read a changed working-tree path)
 *
 * ```ts import.meta.vitest name="Read a changed working-tree path"
 * import { parseStatus } from "@beep/git/internal/parsers";
 *
 * parseStatus(" M src/a.ts\0")[0]?.path // => "src/a.ts"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseStatus = (output: string): ReadonlyArray<StatusEntry> => {
  const tokens = Str.split("\0")(output);
  const entries: Array<StatusEntry> = [];
  let index = 0;
  while (index < tokens.length) {
    const token = A.getUnsafe(tokens, index);
    if (token === "") {
      index += 1;
      continue;
    }
    // Porcelain v1 only ever emits these axis codes.
    const x = Str.slice(0, 1)(token);
    const y = Str.slice(1, 2)(token);
    const path = Str.slice(3)(token);
    if (x === "R" || x === "C" || y === "R" || y === "C") {
      const parsed = {
        x,
        y,
        path,
        origPath: tokens[index + 1] ?? "",
      };
      S.asserts(statusInput, parsed);
      entries.push(StatusEntry.make(parsed));
      index += 2;
    } else {
      const parsed = { x, y, path };
      S.asserts(statusInput, parsed);
      entries.push(StatusEntry.make(parsed));
      index += 1;
    }
  }
  return entries;
};

/** `git submodule status`'s one-character state prefixes; any other first character is part of the sha. */
const SUBMODULE_STATE_PREFIXES: Record<string, SubmoduleStatusEntry["state"] | undefined> = {
  " ": "current",
  "-": "uninitialized",
  "+": "outOfSync",
  U: "conflict",
};

/** Parses one non-empty `git submodule status` line: `<state><sha> <path>[ (<describe>)]`. */
const parseSubmoduleStatusLine = (line: string): SubmoduleStatusEntry => {
  const prefixed = SUBMODULE_STATE_PREFIXES[Str.slice(0, 1)(line)];
  const state = prefixed ?? "current";
  const rest = prefixed === undefined ? line : Str.slice(1)(line);
  const shaEnd = pipe(rest, Str.indexOf(" "), O.getOrElse(constant(-1)));
  const sha = shaEnd === -1 ? rest : Str.slice(0, shaEnd)(rest);
  const remainder = shaEnd === -1 ? "" : Str.slice(shaEnd + 1)(rest);
  const describeStart = Str.endsWith(")")(remainder)
    ? pipe(remainder, Str.lastIndexOf(" ("), O.getOrElse(constant(-1)))
    : -1;
  return describeStart === -1
    ? SubmoduleStatusEntry.make({ state, sha, path: remainder })
    : SubmoduleStatusEntry.make({
        state,
        sha,
        path: Str.slice(0, describeStart)(remainder),
        describe: Str.slice(describeStart + 2, -1)(remainder),
      });
};

/**
 * Parses `git submodule status` output. Line-based — the one parser in this
 * package without a `-z` mode to lean on, because git does not offer one for
 * `submodule status`; a submodule path containing a newline (or a literal
 * ` (` suffix mimicking the describe parenthesis) would corrupt the parse.
 * Accepted as a git-imposed limitation.
 *
 * **Example** (Read an uninitialized submodule)
 *
 * ```ts import.meta.vitest name="Read an uninitialized submodule"
 * import { parseSubmoduleStatus } from "@beep/git/internal/parsers";
 *
 * parseSubmoduleStatus("-abc vendor/lib\n")[0]?.state // => "uninitialized"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseSubmoduleStatus = (output: string): ReadonlyArray<SubmoduleStatusEntry> =>
  A.filterMap(Str.split("\n")(output), (line) => {
    const trimmedEnd = Str.endsWith("\r")(line) ? Str.slice(0, -1)(line) : line;
    return trimmedEnd === "" ? Result.failVoid : Result.succeed(parseSubmoduleStatusLine(trimmedEnd));
  });

/**
 * Parses `git ls-remote` output: one `<sha>\t<refname>` line per advertised
 * ref. Line-based deliberately — refnames cannot contain a newline (or a
 * tab), so the split is safe without a `-z` mode (which `ls-remote` does not
 * offer).
 *
 * **Example** (Read a remote branch)
 *
 * ```ts import.meta.vitest name="Read a remote branch"
 * import { parseLsRemote } from "@beep/git/internal/parsers";
 *
 * parseLsRemote("abc\trefs/heads/main\n")[0]?.ref // => "refs/heads/main"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseLsRemote = (output: string): ReadonlyArray<LsRemoteEntry> =>
  pipe(
    Str.split("\n")(output),
    A.filter((line) => line.length > 0),
    A.map((line) => {
      const tabIndex = pipe(line, Str.indexOf("\t"), O.getOrElse(constant(-1)));
      return LsRemoteEntry.make({
        sha: Str.slice(0, tabIndex)(line),
        ref: Str.slice(tabIndex + 1)(line),
      });
    })
  );

/**
 * Parses `git stash list -z --format=%gd%x1f%H%x1f%gs` output: NUL-terminated
 * records of unit-separated (`\x1f`) fields. Reflog subjects are single-line
 * and cannot contain either separator byte.
 *
 * **Example** (Read a named stash)
 *
 * ```ts import.meta.vitest name="Read a named stash"
 * import { parseStashList } from "@beep/git/internal/parsers";
 *
 * parseStashList("stash@{0}\x1fabc\x1fWIP\0")[0]?.ref // => "stash@{0}"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseStashList = (output: string): ReadonlyArray<StashEntry> =>
  A.map(parseNulSeparated(output), (record) => {
    const [ref = "", sha = "", ...rest] = Str.split("\u001f")(record);
    return StashEntry.make({ ref, sha, message: A.join(rest, "\u001f") });
  });

/**
 * Parses `git branch --list --format=%(HEAD)%00%(refname:short)%00%(objectname)`
 * output: newline-separated records (refnames cannot contain newlines) of
 * NUL-separated fields. The `%(HEAD)` marker is `*` for the checked-out
 * branch; anything else (` `, or `+` for a branch checked out in a linked
 * worktree) is not-current.
 *
 * **Example** (Read the current branch)
 *
 * ```ts import.meta.vitest name="Read the current branch"
 * import { parseBranchList } from "@beep/git/internal/parsers";
 *
 * parseBranchList("*\0main\0abc\n")[0]?.current // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseBranchList = (output: string): ReadonlyArray<BranchEntry> =>
  pipe(
    Str.split("\n")(output),
    A.filter((line) => line.length > 0),
    A.map((line) => {
      const [marker = "", name = "", sha = ""] = Str.split("\0")(line);
      return BranchEntry.make({ name, sha, current: marker === "*" });
    })
  );

const refEntryInput = S.Struct(RefEntry.fields);

/**
 * Parses `git for-each-ref --format=%(refname)%00%(objectname)%00%(objecttype)`
 * output: newline-separated records (refnames cannot contain newlines) of
 * NUL-separated fields.
 *
 * **Example** (Read a commit reference)
 *
 * ```ts import.meta.vitest name="Read a commit reference"
 * import { parseForEachRef } from "@beep/git/internal/parsers";
 *
 * parseForEachRef("refs/heads/main\0abc\0commit\n")[0]?.objectType // => "commit"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseForEachRef = (output: string): ReadonlyArray<RefEntry> =>
  pipe(
    Str.split("\n")(output),
    A.filter((line) => line.length > 0),
    A.map((line) => {
      const [ref = "", sha = "", objectType = "commit"] = Str.split("\0")(line);
      // Our own fixed format only ever emits git's four object types.
      const parsed = {
        ref,
        sha,
        objectType,
      };
      S.asserts(refEntryInput, parsed);
      return RefEntry.make(parsed);
    })
  );

/**
 * Parses `git config --list -z` output: NUL-terminated records, key separated
 * from value by the FIRST newline (a config value may itself contain
 * newlines — the reason `-z` is load-bearing). A record with no newline is a
 * valueless boolean-shorthand key.
 *
 * **Example** (Read a multiline config value)
 *
 * ```ts import.meta.vitest name="Read a multiline config value"
 * import { parseConfigList } from "@beep/git/internal/parsers";
 *
 * parseConfigList("user.note\nfirst\nsecond\0")[0]?.value // => "first\nsecond"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseConfigList = (output: string): ReadonlyArray<ConfigListEntry> =>
  A.map(parseNulSeparated(output), (record) => {
    const newlineIndex = pipe(record, Str.indexOf("\n"), O.getOrElse(constant(-1)));
    return newlineIndex === -1
      ? ConfigListEntry.make({ key: record, value: "" })
      : ConfigListEntry.make({
          key: Str.slice(0, newlineIndex)(record),
          value: Str.slice(newlineIndex + 1)(record),
        });
  });

/** The attributes of the worktree entry being read, before it is flushed. */
interface WorktreeDraft {
  bare: boolean;
  branch: string | undefined;
  detached: boolean;
  head: string | undefined;
  locked: string | undefined;
  path: string | undefined;
  prunable: string | undefined;
}

const emptyWorktreeDraft = (): WorktreeDraft => ({
  bare: false,
  branch: undefined,
  detached: false,
  head: undefined,
  locked: undefined,
  path: undefined,
  prunable: undefined,
});

/** Emits the drafted entry; a draft without a `worktree` line emits nothing. */
const flushWorktree = (draft: WorktreeDraft, entries: Array<WorktreeEntry>): void => {
  const { bare, branch, detached, head, locked, path, prunable } = draft;
  if (path === undefined) return;
  entries.push(
    WorktreeEntry.make({
      path,
      detached,
      bare,
      ...O.getSomesStruct({ head: O.fromUndefinedOr(head) }),
      ...O.getSomesStruct({ branch: O.fromUndefinedOr(branch) }),
      ...O.getSomesStruct({ locked: O.fromUndefinedOr(locked) }),
      ...O.getSomesStruct({ prunable: O.fromUndefinedOr(prunable) }),
    })
  );
};

/** `<prefix><value>` attributes and the draft field each one fills. */
const WORKTREE_VALUE_ATTRIBUTES = [
  ["worktree ", "path"],
  ["HEAD ", "head"],
  ["branch ", "branch"],
] as const;

/** Annotations carrying an optional reason: bare `locked` records `""`. */
const WORKTREE_ANNOTATIONS = ["locked", "prunable"] as const;

/** Folds one non-blank porcelain attribute into the draft; unknown attributes are ignored. */
const applyWorktreeAttribute = (draft: WorktreeDraft, attribute: string): void => {
  if (attribute === "detached" || attribute === "bare") {
    draft[attribute] = true;
    return;
  }
  const valued = A.findFirst(WORKTREE_VALUE_ATTRIBUTES, ([prefix]) => Str.startsWith(prefix)(attribute));
  if (O.isSome(valued)) {
    draft[valued.value[1]] = Str.slice(valued.value[0].length)(attribute);
    return;
  }
  const annotation = A.findFirst(
    WORKTREE_ANNOTATIONS,
    (name) => attribute === name || Str.startsWith(`${name} `)(attribute)
  );
  if (O.isSome(annotation)) draft[annotation.value] = Str.slice(annotation.value.length + 1)(attribute);
};

/**
 * Parses `git worktree list --porcelain -z` output: NUL-terminated attribute
 * lines, one blank attribute terminating each entry. Attribute vocabulary:
 * `worktree <path>`, `HEAD <sha>`, `branch <ref>`, and the flag/annotation
 * attributes `detached`, `bare`, `locked [<reason>]`, `prunable [<reason>]`.
 *
 * **Example** (Read a bare worktree)
 *
 * ```ts import.meta.vitest name="Read a bare worktree"
 * import { parseWorktreeList } from "@beep/git/internal/parsers";
 *
 * parseWorktreeList("worktree /repo\0bare\0\0")[0]?.bare // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseWorktreeList = (output: string): ReadonlyArray<WorktreeEntry> => {
  const entries: Array<WorktreeEntry> = [];
  let draft = emptyWorktreeDraft();
  for (const attribute of Str.split("\0")(output)) {
    if (attribute === "") {
      flushWorktree(draft, entries);
      draft = emptyWorktreeDraft();
    } else {
      applyWorktreeAttribute(draft, attribute);
    }
  }
  flushWorktree(draft, entries);
  return entries;
};

/**
 * Parses `git ls-files --stage -z` output: each NUL-terminated entry is
 * `<mode> <oid> <stage>\t<path>`. `path` is everything after the first tab,
 * so a path containing spaces or newlines is preserved intact — the same
 * split rule as `parseLsTree`.
 *
 * **Example** (Read an indexed path)
 *
 * ```ts import.meta.vitest name="Read an indexed path"
 * import { parseLsFiles } from "@beep/git/internal/parsers";
 *
 * parseLsFiles("100644 abc 0\tsrc/a.ts\0")[0]?.path // => "src/a.ts"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseLsFiles = (output: string): ReadonlyArray<LsFilesEntry> =>
  A.map(parseNulSeparated(output), (entry) => {
    const tabIndex = pipe(entry, Str.indexOf("\t"), O.getOrElse(constant(-1)));
    const header = Str.split(Str.slice(0, tabIndex)(entry), " ");
    return LsFilesEntry.make({
      mode: header[0],
      oid: header[1] ?? "",
      stage: Number(header[2] ?? "0"),
      path: Str.slice(tabIndex + 1)(entry),
    });
  });
