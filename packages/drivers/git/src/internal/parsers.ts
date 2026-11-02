/**
 * Git command output parsers, preserving each command's framing and path rules.
 *
 * **Details**
 *
 * Status and name-status rename tokens have opposite path ordering. Config
 * values and log author fields may be empty; pathname tokens cannot contain
 * NUL. These parsers intentionally retain separate wire-format contracts.
 *
 * The entry parsers (`parseNameStatus`, `parseStatus`, `parseWorktreeList`,
 * `parseLsTree`, `parseLsFiles`, `parseLog`, `parseLogNameStatus`) FAIL CLOSED: they answer a
 * `Result` whose failure names the offending record, and the service maps
 * that to a `GitCommandError` instead of inventing a plausible-looking entry.
 * The plain path-list parsers (`parseNulSeparated`, `parseConfigGetAll`) have
 * no record structure to violate and stay total.
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

const encodeJsonString = S.encodeOption(S.fromJsonString(S.String));

/** The longest run of a record a failure message quotes before eliding the rest. */
const QUOTED_RECORD_LIMIT = 80;

/**
 * Quotes a record for a failure message: JSON-escaped (so NUL, tab and
 * newline bytes stay visible) and truncated so one huge token cannot bloat
 * an error. Encoding a string as JSON cannot fail; the fallback is unreachable.
 */
const quoteRecord = (record: string): string => {
  const shown = record.length > QUOTED_RECORD_LIMIT ? `${Str.slice(0, QUOTED_RECORD_LIMIT)(record)}…` : record;
  return O.getOrElse(encodeJsonString(shown), () => `"${shown}"`);
};

/**
 * Splits `-z` output into its NUL-terminated records, requiring the
 * terminator git always writes: a non-empty output that does not end with
 * NUL is either truncated or came from a non-`-z` (line-delimited) run, and
 * either way its last record cannot be trusted. Empty output is no records.
 */
const nulRecords = (output: string, what: string): Result.Result<ReadonlyArray<string>, string> => {
  if (output === "") return Result.succeed([]);
  if (!Str.endsWith("\0")(output)) {
    return Result.fail(
      `${what} output did not end with a NUL terminator (truncated, or not -z output): ${quoteRecord(Str.slice(-QUOTED_RECORD_LIMIT)(output))}`
    );
  }
  return Result.succeed(A.dropRight(Str.split(output, "\0"), 1));
};

/** Parses every record in order, stopping at the first failure. */
const parseRecords = <A>(
  records: ReadonlyArray<string>,
  parseRecord: (record: string) => Result.Result<A, string>
): Result.Result<ReadonlyArray<A>, string> => Result.all(A.map(records, parseRecord));

/** Splits `<header>\t<path>` where `path` is everything after the FIRST tab, so tabs in a path survive. */
const splitAtTab = (record: string): O.Option<readonly [header: ReadonlyArray<string>, path: string]> =>
  O.map(Str.indexOf("\t")(record), (tabIndex) => [
    Str.split(Str.slice(0, tabIndex)(record), " "),
    Str.slice(tabIndex + 1)(record),
  ]);

const lsTreeInput = S.decodeUnknownOption(S.Struct(LsTreeEntry.fields));

/** Decodes one `<mode> <type> <oid>\t<path>` ls-tree record. */
const parseLsTreeRecord = (record: string): Result.Result<LsTreeEntry, string> =>
  pipe(
    splitAtTab(record),
    O.filter(([header, path]) => header.length === 3 && path !== ""),
    O.flatMap(([header, path]) => lsTreeInput({ mode: header[0], type: header[1], oid: header[2], path })),
    O.match({
      onNone: () => Result.fail(`an ls-tree record was not \`<mode> <type> <oid>\\t<path>\`: ${quoteRecord(record)}`),
      onSome: (fields) => Result.succeed(LsTreeEntry.make(fields)),
    })
  );

/**
 * Parses `git ls-tree -r -z` output: each NUL-terminated entry is
 * `<mode> <type> <oid>\t<path>`. `path` is everything after the first tab,
 * so a path containing spaces or newlines is preserved intact. A record
 * missing its tab, carrying other than three header fields, or naming an
 * object type git's tree format cannot emit fails the whole parse.
 *
 * **Example** (Read a tracked tree entry)
 *
 * ```ts import.meta.vitest name="Read a tracked tree entry"
 * import { parseLsTree } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.getOrThrow(parseLsTree("100644 blob abc\tsrc/a.ts\0"))[0]?.path // => "src/a.ts"
 * ```
 *
 * **Example** (Refuse a record without its object id)
 *
 * ```ts import.meta.vitest name="Refuse a record without its object id"
 * import { parseLsTree } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.isFailure(parseLsTree("100644\tfile\0")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseLsTree = (output: string): Result.Result<ReadonlyArray<LsTreeEntry>, string> =>
  Result.flatMap(nulRecords(output, "ls-tree"), (records) => parseRecords(records, parseLsTreeRecord));

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

/** A status code token: one letter git emits, optionally followed by a similarity score. */
const NAME_STATUS_CODE_TOKEN = /^([ABCDMRTUX])(\d*)$/;

/** The similarity digits a rename/copy code carries, as git prints them (`075` → 75). */
const similarityScore = S.decodeUnknownOption(S.FiniteFromString.check(S.isInt(), S.isGreaterThanOrEqualTo(0)));

/** The decoded status and score of a code token, or none when it is not one git emits. */
const nameStatusOf = (code: string): O.Option<{ readonly status: NameStatusCode; readonly score: O.Option<number> }> =>
  pipe(
    Str.match(NAME_STATUS_CODE_TOKEN)(code),
    O.flatMap((matched) => O.fromUndefinedOr(matched[1])),
    O.flatMap((letter) => O.fromUndefinedOr(NAME_STATUS_CODES[letter])),
    O.flatMap((status) => {
      const digits = Str.slice(1)(code);
      // Only a rename/copy carries a score; a code with no digits has none.
      if ((status !== "renamed" && status !== "copied") || digits === "") return O.some({ status, score: O.none() });
      return O.map(similarityScore(digits), (score) => ({ status, score: O.some(score) }));
    })
  );

/**
 * Parses the name-status entry whose code token sits at `index`, answering
 * the entry and the index of the token after it. A code git does not emit,
 * or a path token that is missing or empty, is a failure naming the record.
 */
const parseNameStatusEntryAt = (
  tokens: ReadonlyArray<string>,
  index: number
): Result.Result<{ readonly entry: NameStatusEntry; readonly next: number }, string> => {
  const code = A.getUnsafe(tokens, index);
  const decoded = nameStatusOf(code);
  if (O.isNone(decoded)) {
    return Result.fail(`a name-status record opened with a code git does not emit: ${quoteRecord(code)}`);
  }
  const { score, status } = decoded.value;
  const pathTokens = status === "renamed" || status === "copied" ? 2 : 1;
  const paths = pipe(
    tokens,
    A.drop(index + 1),
    A.take(pathTokens),
    A.filter((path) => path !== "")
  );
  if (paths.length !== pathTokens) {
    return Result.fail(
      `a name-status record carried fewer path tokens than its code ${quoteRecord(code)} declares (${pathTokens})`
    );
  }
  const entry =
    pathTokens === 2
      ? NameStatusEntry.make({
          status,
          oldPath: A.getUnsafe(paths, 0),
          path: A.getUnsafe(paths, 1),
          ...O.getSomesStruct({ score }),
        })
      : NameStatusEntry.make({ status, path: A.getUnsafe(paths, 0) });
  return Result.succeed({ entry, next: index + 1 + pathTokens });
};

/** Parses a whole token list as consecutive name-status entries — the body of a `-z` listing, already split. */
const parseNameStatusTokens = (
  tokens: ReadonlyArray<string>
): Result.Result<ReadonlyArray<NameStatusEntry>, string> => {
  const entries: Array<NameStatusEntry> = [];
  let index = 0;
  while (index < tokens.length) {
    const record = parseNameStatusEntryAt(tokens, index);
    if (Result.isFailure(record)) return Result.fail(record.failure);
    entries.push(record.success.entry);
    index = record.success.next;
  }
  return Result.succeed(entries);
};

/**
 * Parses `git diff --name-status -z` output. A plain entry is two NUL tokens
 * (`<code>`, `<path>`); a rename/copy entry is three (`<R|C><score>`,
 * `<oldPath>`, `<newPath>`); the code's first character carries the status
 * and a rename/copy's digits decode to `score`. A code git does not
 * emit, a record short of its path tokens, or output without its trailing
 * NUL fails the whole parse rather than inventing an entry.
 *
 * **Example** (Read a renamed path)
 *
 * ```ts import.meta.vitest name="Read a renamed path"
 * import { parseNameStatus } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.getOrThrow(parseNameStatus("R100\0old.ts\0new.ts\0"))[0]?.path // => "new.ts"
 * ```
 *
 * **Example** (Refuse a rename missing its new path)
 *
 * ```ts import.meta.vitest name="Refuse a rename missing its new path"
 * import { parseNameStatus } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.isFailure(parseNameStatus("R100\0old.ts\0")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseNameStatus = (output: string): Result.Result<ReadonlyArray<NameStatusEntry>, string> =>
  Result.flatMap(nulRecords(output, "name-status"), parseNameStatusTokens);

/** A record opens with an empty NUL token, which cannot be a pathname. */
const LOG_RECORD_SEPARATOR = "\0";

/** The number of NUL-terminated header fields `GitCommand.log`'s format emits after the record opener. */
const LOG_HEADER_FIELDS = 6;

/**
 * Reads a log record's NUL-terminated body tokens starting at `from`. Only
 * the first token loses git's one separator newline. `next` also consumes the
 * next record's opener or the final terminator token.
 */
const readLogBody = (
  tokens: ReadonlyArray<string>,
  from: number
): { readonly next: number; readonly body: Array<string> } => {
  const body: Array<string> = [];
  let index = from;
  while (index < tokens.length) {
    const token = A.getUnsafe(tokens, index);
    if (token === "") break;
    body.push(body.length === 0 && Str.startsWith("\n")(token) ? Str.slice(1)(token) : token);
    index += 1;
  }
  return { body, next: index + 1 };
};

/** The `paths` and, when the body carried status codes, `changes` of one commit. */
type LogBody = Pick<CommitLogEntry, "paths" | "changes">;

/** Reads a `--name-only` body: every token is a path. */
const nameOnlyBody = (body: ReadonlyArray<string>): Result.Result<LogBody, string> => Result.succeed({ paths: body });

/** Reads a `--name-status` body through the diff parser; `paths` is each entry's NEW path. */
const nameStatusBody = (body: ReadonlyArray<string>): Result.Result<LogBody, string> =>
  Result.map(parseNameStatusTokens(body), (changes) => ({
    paths: A.map(changes, (change) => change.path),
    changes,
  }));

/** Parses the log record whose sha token sits at `index`, plus the index of the record after it. */
const parseLogRecord = (
  tokens: ReadonlyArray<string>,
  index: number,
  readBody: (body: ReadonlyArray<string>) => Result.Result<LogBody, string>
): Result.Result<{ readonly entry: CommitLogEntry; readonly next: number }, string> => {
  const sha = A.getUnsafe(tokens, index);
  const authoredAtIso = tokens[index + 1];
  const committedAtIso = tokens[index + 2];
  const authorName = tokens[index + 3];
  const authorEmail = tokens[index + 4];
  const subject = tokens[index + 5];
  if (
    authoredAtIso === undefined ||
    committedAtIso === undefined ||
    authorName === undefined ||
    authorEmail === undefined ||
    subject === undefined
  ) {
    return Result.fail("a log record carried fewer fields than the format declares");
  }
  const authoredAt = DateTime.make(authoredAtIso);
  const committedAt = DateTime.make(committedAtIso);
  if (O.isNone(authoredAt) || O.isNone(committedAt)) {
    return Result.fail(`a log record carried an undecodable date ("${authoredAtIso}", "${committedAtIso}")`);
  }
  const { next, body } = readLogBody(tokens, index + LOG_HEADER_FIELDS);
  return Result.map(readBody(body), (read) => ({
    entry: CommitLogEntry.make({
      sha,
      authoredAt: authoredAt.value,
      committedAt: committedAt.value,
      authorName,
      authorEmail,
      subject,
      ...read,
    }),
    next,
  }));
};

/** The record walk both log modes share; `readBody` decodes each record's body tokens. */
const parseLogWith =
  (readBody: (body: ReadonlyArray<string>) => Result.Result<LogBody, string>) =>
  (output: string): Result.Result<ReadonlyArray<CommitLogEntry>, string> => {
    if (output === "") return Result.succeed([]);
    if (!Str.startsWith(LOG_RECORD_SEPARATOR)(output)) {
      return Result.fail("log output did not open with a record separator");
    }
    const tokens = Str.split(output, "\0");
    const entries: Array<CommitLogEntry> = [];
    let index = 1;
    while (index < tokens.length) {
      const record = parseLogRecord(tokens, index, readBody);
      if (Result.isFailure(record)) return Result.fail(record.failure);
      entries.push(record.success.entry);
      index = record.success.next;
    }
    return Result.succeed(entries);
  };

/**
 * Parses `GitCommand.log`'s `--name-only` output. Like the other entry
 * parsers this one FAILS CLOSED: the two dates have to decode, and a header
 * that does not carry its six fields cannot be answered with a
 * plausible-looking entry.
 *
 * **Details**
 *
 * Each record opens with NUL, followed by six NUL-terminated header fields
 * (sha, both dates, author name and email, subject). Only when the commit
 * touched something, git adds `\n` and one NUL-terminated path each. The
 * next empty token opens the next record; pathnames cannot be empty or
 * contain NUL. Header fields are read by position so empty author fields and
 * an empty subject are preserved. Only the first path loses git's one
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
export const parseLog: (output: string) => Result.Result<ReadonlyArray<CommitLogEntry>, string> =
  parseLogWith(nameOnlyBody);

/**
 * Parses `GitCommand.log`'s `--name-status` output: the same six-field
 * header walk as {@link parseLog}, with each record's body read as the
 * `<code>\0<path>\0` / `R<score>\0<old>\0<new>\0` tokens
 * {@link parseNameStatus} decodes. Every entry carries `changes`, and its
 * `paths` is the NEW path of each change. A code git does not emit or a
 * record short of its path tokens fails the whole parse.
 *
 * **Example** (Read a commit that renamed a file)
 *
 * ```ts import.meta.vitest name="Read a commit that renamed a file"
 * import { parseLogNameStatus } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * // `\u0000` rather than `\0`: a NUL escape followed by a digit would read as an octal escape.
 * const header = "\u0000abc\u00002026-01-01T00:00:00Z\u00002026-01-01T00:00:00Z\u0000Ada\u0000ada@example.com\u0000move\u0000";
 * const output = `${header}\nR100\u0000old.ts\u0000new.ts\u0000`;
 * const entry = Result.getOrThrow(parseLogNameStatus(output))[0];
 * [entry?.subject, entry?.paths, entry?.changes?.[0]?.oldPath] // => ["move", ["new.ts"], "old.ts"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseLogNameStatus: (output: string) => Result.Result<ReadonlyArray<CommitLogEntry>, string> =
  parseLogWith(nameStatusBody);

const commitInfoInput = S.Struct(CommitInfo.fields);

const statusInput = S.decodeUnknownOption(S.Struct(StatusEntry.fields));

/** Whether a porcelain `XY` pair marks a rename or copy, which appends the ORIGINAL path as one more record. */
const isStatusRename = (x: string, y: string): boolean => x === "R" || x === "C" || y === "R" || y === "C";

/**
 * Parses the status entry whose `XY <path>` record sits at `index`, answering
 * the entry and the index of the record after it. A record shorter than
 * `XY <p>`, with no space in column three, with an empty path, or a rename
 * without its original-path record is a failure naming the record.
 */
const parseStatusEntryAt = (
  records: ReadonlyArray<string>,
  index: number
): Result.Result<{ readonly entry: StatusEntry; readonly next: number }, string> => {
  const record = A.getUnsafe(records, index);
  const x = Str.slice(0, 1)(record);
  const y = Str.slice(1, 2)(record);
  const path = Str.slice(3)(record);
  if (record.length < 4 || Str.slice(2, 3)(record) !== " ") {
    return Result.fail(`a status record was not \`XY <path>\`: ${quoteRecord(record)}`);
  }
  const origPath = isStatusRename(x, y) ? O.fromUndefinedOr(records[index + 1]) : O.none<string>();
  if (isStatusRename(x, y) && O.isNone(O.filter(origPath, (orig) => orig !== ""))) {
    return Result.fail(`a status rename record carried no original path: ${quoteRecord(record)}`);
  }
  return pipe(
    statusInput({ x, y, path, ...O.getSomesStruct({ origPath }) }),
    O.match({
      onNone: () => Result.fail(`a status record carried a code porcelain does not emit: ${quoteRecord(record)}`),
      onSome: (fields) =>
        Result.succeed({ entry: StatusEntry.make(fields), next: index + (O.isSome(origPath) ? 2 : 1) }),
    })
  );
};

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
 * the new path — the opposite order from `diff --name-status`. A malformed
 * record, a rename without its original path, or output without its
 * trailing NUL fails the whole parse.
 *
 * **Example** (Read a changed working-tree path)
 *
 * ```ts import.meta.vitest name="Read a changed working-tree path"
 * import { parseStatus } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.getOrThrow(parseStatus(" M src/a.ts\0"))[0]?.path // => "src/a.ts"
 * ```
 *
 * **Example** (Refuse a rename without its original path)
 *
 * ```ts import.meta.vitest name="Refuse a rename without its original path"
 * import { parseStatus } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.isFailure(parseStatus("R  new.ts\0")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseStatus = (output: string): Result.Result<ReadonlyArray<StatusEntry>, string> =>
  Result.flatMap(nulRecords(output, "status"), (records) => {
    const entries: Array<StatusEntry> = [];
    let index = 0;
    while (index < records.length) {
      const record = parseStatusEntryAt(records, index);
      if (Result.isFailure(record)) return Result.fail(record.failure);
      entries.push(record.success.entry);
      index = record.success.next;
    }
    return Result.succeed(entries);
  });

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
  /** The first attribute of the block, kept so a block without `worktree` can be named in a failure. */
  opened: string | undefined;
  path: string | undefined;
  prunable: boolean;
}

const emptyWorktreeDraft = (): WorktreeDraft => ({
  opened: undefined,
  bare: false,
  branch: undefined,
  detached: false,
  head: undefined,
  locked: undefined,
  path: undefined,
  prunable: false,
});

/** Emits the drafted entry; a block that never named its `worktree` path is a failure. */
const flushWorktree = (draft: WorktreeDraft): Result.Result<WorktreeEntry, string> => {
  const { bare, branch, detached, head, locked, path, prunable } = draft;
  if (path === undefined) {
    return Result.fail(`a worktree block carried no \`worktree <path>\` line: ${quoteRecord(draft.opened ?? "")}`);
  }
  return Result.succeed(
    WorktreeEntry.make({
      path,
      detached,
      bare,
      prunable,
      ...O.getSomesStruct({ head: O.fromUndefinedOr(head) }),
      ...O.getSomesStruct({ branch: O.fromUndefinedOr(branch) }),
      ...O.getSomesStruct({ locked: O.fromUndefinedOr(locked) }),
    })
  );
};

/** `<prefix><value>` attributes and the draft field each one fills. */
const WORKTREE_VALUE_ATTRIBUTES = [
  ["worktree ", "path"],
  ["HEAD ", "head"],
  ["branch ", "branch"],
] as const;

/** Whether `attribute` is the bare annotation `name` or `name <reason>`. */
const isWorktreeAnnotation = (name: string, attribute: string): boolean =>
  attribute === name || Str.startsWith(`${name} `)(attribute);

/**
 * Folds one non-blank porcelain attribute into the draft. Unknown attributes
 * are ignored on purpose: git adds porcelain vocabulary between versions, and
 * an attribute this parser has not met yet is not a malformed record.
 */
const applyWorktreeAttribute = (draft: WorktreeDraft, attribute: string): void => {
  draft.opened ??= attribute;
  if (attribute === "detached" || attribute === "bare") {
    draft[attribute] = true;
    return;
  }
  if (isWorktreeAnnotation("prunable", attribute)) {
    draft.prunable = true;
    return;
  }
  if (isWorktreeAnnotation("locked", attribute)) {
    draft.locked = Str.slice("locked ".length)(attribute);
    return;
  }
  const valued = A.findFirst(WORKTREE_VALUE_ATTRIBUTES, ([prefix]) => Str.startsWith(prefix)(attribute));
  if (O.isSome(valued)) draft[valued.value[1]] = Str.slice(valued.value[0].length)(attribute);
};

/**
 * Parses `git worktree list --porcelain -z` output: NUL-terminated attribute
 * lines, one blank attribute terminating each entry. Attribute vocabulary:
 * `worktree <path>`, `HEAD <sha>`, `branch <ref>`, and the flag/annotation
 * attributes `detached`, `bare`, `locked [<reason>]`, `prunable [<reason>]`
 * (`prunable` decodes to a boolean; its reason text is dropped). A block
 * without its `worktree` line, a block without its blank terminator, or
 * output without its trailing NUL fails the whole parse.
 *
 * **Example** (Read a bare worktree)
 *
 * ```ts import.meta.vitest name="Read a bare worktree"
 * import { parseWorktreeList } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.getOrThrow(parseWorktreeList("worktree /repo\0bare\0\0"))[0]?.bare // => true
 * ```
 *
 * **Example** (Refuse an unterminated block)
 *
 * ```ts import.meta.vitest name="Refuse an unterminated block"
 * import { parseWorktreeList } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.isFailure(parseWorktreeList("worktree /repo\0bare\0")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseWorktreeList = (output: string): Result.Result<ReadonlyArray<WorktreeEntry>, string> =>
  Result.flatMap(nulRecords(output, "worktree list"), (attributes) => {
    const entries: Array<WorktreeEntry> = [];
    let draft = emptyWorktreeDraft();
    for (const attribute of attributes) {
      if (attribute === "") {
        const flushed = flushWorktree(draft);
        if (Result.isFailure(flushed)) return Result.fail(flushed.failure);
        entries.push(flushed.success);
        draft = emptyWorktreeDraft();
      } else {
        applyWorktreeAttribute(draft, attribute);
      }
    }
    return draft.opened === undefined
      ? Result.succeed(entries)
      : Result.fail(`a worktree block was not terminated by a blank attribute: ${quoteRecord(draft.opened)}`);
  });

/** An index stage number as git prints it: `0` normally, `1`/`2`/`3` during an unresolved merge. */
const lsFilesStage = S.decodeUnknownOption(
  S.FiniteFromString.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 3 }))
);

/** Decodes one `<mode> <oid> <stage>\t<path>` ls-files record. */
const parseLsFilesRecord = (record: string): Result.Result<LsFilesEntry, string> =>
  pipe(
    splitAtTab(record),
    O.filter(([header, path]) => header.length === 3 && path !== ""),
    O.flatMap(([header, path]) =>
      O.map(lsFilesStage(header[2]), (stage) =>
        LsFilesEntry.make({ mode: A.getUnsafe(header, 0), oid: A.getUnsafe(header, 1), stage, path })
      )
    ),
    O.match({
      onNone: () => Result.fail(`an ls-files record was not \`<mode> <oid> <stage>\\t<path>\`: ${quoteRecord(record)}`),
      onSome: Result.succeed,
    })
  );

/**
 * Parses `git ls-files --stage -z` output: each NUL-terminated entry is
 * `<mode> <oid> <stage>\t<path>`. `path` is everything after the first tab,
 * so a path containing spaces or newlines is preserved intact — the same
 * split rule as `parseLsTree`. A record missing its tab, carrying other than
 * three header fields, or with a stage outside `0..3` fails the whole parse.
 *
 * **Example** (Read an indexed path)
 *
 * ```ts import.meta.vitest name="Read an indexed path"
 * import { parseLsFiles } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.getOrThrow(parseLsFiles("100644 abc 0\tsrc/a.ts\0"))[0]?.path // => "src/a.ts"
 * ```
 *
 * **Example** (Refuse a record without its stage)
 *
 * ```ts import.meta.vitest name="Refuse a record without its stage"
 * import { parseLsFiles } from "@beep/git/internal/parsers";
 * import * as Result from "effect/Result";
 *
 * Result.isFailure(parseLsFiles("100644 abc\tsrc/a.ts\0")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseLsFiles = (output: string): Result.Result<ReadonlyArray<LsFilesEntry>, string> =>
  Result.flatMap(nulRecords(output, "ls-files"), (records) => parseRecords(records, parseLsFilesRecord));
