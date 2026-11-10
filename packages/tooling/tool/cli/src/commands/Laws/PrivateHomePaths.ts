/**
 * Repo-local private home path law.
 *
 * **Details**
 *
 * The repository is public and records paths in the `~`-relative form. The law
 * scans every git-tracked file, NUL-bearing ones included, for an absolute
 * home directory: `/home/<user>`, `/var/home/<user>`, `/export/home/<user>`,
 * `/Users/<user>`, a WSL distribution share (`\\wsl$\<distro>\home\<user>`,
 * `//wsl.localhost/<distro>/home/<user>`), the Windows profile after a drive
 * letter, WSL mount, MSYS drive or UNC share (`C:\Users\<user>`,
 * `C:\Documents and Settings\<user>`, `/mnt/c/Users/<user>`,
 * `//server/Users/<user>`), and the dash-encoded `-home-<user>-` form agent
 * tooling writes into project and scratchpad directory names. Separators may
 * be forward slashes, escaped solidi, one to four backslashes, or URL-encoded
 * (`%2F`, `%5C`, with a `%3A` drive colon). A user from the placeholder vocabulary
 * passes, a scoped fleet account passes in its listed files, and any other
 * user is a finding unless the file is listed with its exact count.
 *
 * **Gotchas**
 *
 * The boundary lookbehind keeps relative and composed paths out of scope
 * (`owner/home/root/`, `${base}/home/.cache`, `X_/home/<user>`,
 * `app/(marketing)/home/page.tsx`), except after a glued one-letter flag
 * (`-v/home/<user>`), a shell default expansion (`${HOME:-/home/<user>}`), an
 * option value (`--opt=-/home/<user>`), a line-initial diff marker
 * (`-/home/<user>`), an ASCII truncation marker (`.../home/<user>`), a
 * `file://<host>` or `vscode://file` authority, a
 * remote-shell authority (`ssh://`, `sftp://`, `scp://`, `rsync://`, with an
 * optional `user@` and port), or a remote authority such as
 * `vscode-remote://wsl+<distro>`; `https://<host>/home/x` stays a web route.
 * A path right after an HTTP method (`GET /Users/<id>`) is an API route. The
 * user may not start with `.`, `<`, `$`,
 * `{` or `[`, so `/home/.cache`, `/home/<user>`, `/home/${user}` and a
 * `\/home\/[^/]+` regex literal are templates, not recorded paths. Any
 * character outside letters, digits, `_`, `.` and `-` ends the user, so
 * `/home/<user>?x` and `/home/<user>’s` still report the user. Lowercase
 * `/users/<id>` is a REST route far more often than a macOS home, so only
 * `/Users` counts. App route segments (`/home/settings`) and container
 * accounts (`/home/app`) pass through their vocabularies in
 * PrivateHomePaths.model.ts. An encoded `-home-<word>` with no further encoded
 * segment counts only as a directory with a path beneath it
 * (`-home-<user>/x`) or as an entry of a `projects/` store, so a `-home-dir`
 * flag in prose and a `fix/-home-paths` branch label pass. An encoded home with
 * a further encoded segment counts wherever it appears, prose included,
 * because `ls` listings and prose name agent directories bare; a dash-led
 * word such as `-home-<word>-<word>` (a CSS class, a single-dash flag)
 * therefore reports `-home-<word>`, and a first word that is not a user passes
 * by adding it to HomeRouteSegment.
 *
 * A file containing a NUL byte is decoded instead of skipped: UTF-16 by its
 * byte order mark or NUL layout, anything else as UTF-8 with each NUL read as
 * a space, so a terminal capture with a stray NUL and the printable runs of a
 * binary are still scanned.
 *
 * Hosted CI runs the law in Repo Sanity for every diff. A goals_only
 * packet-prose diff (packet `SPEC`/`PLAN`/`README`/`GOAL`/`DECISIONS`,
 * `ops/manifest.json`, `goals/INDEX.md`) skips the rest of that lane, and
 * check.yml runs the law alone in its "Check private home paths" step.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  lineStartOffsets,
  locateIndex,
  messageGitErrorAdapter,
  scanTrackedTextFiles,
} from "./internal/TrackedTextFiles.ts";
import { PrivateHomePathsExecutionError } from "./Laws.errors.ts";
import {
  HomeRouteSegment,
  PlaceholderHomeUser,
  PrivateHomePathFinding,
  PrivateHomePathsSummary,
  privateHomePathScopedUsers,
} from "./PrivateHomePaths.model.ts";
import type { Git } from "@beep/git/Git";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcess from "effect/process/ChildProcessSpawner";
import type { PrivateHomePathExemption, PrivateHomePathsOptions } from "./PrivateHomePaths.model.ts";

/**
 * A path separator: `/`, a JSON-escaped `\/`, one to four backslashes (plain,
 * JSON-escaped or JSON-in-JSON), a URL-encoded `%2F` or a URL-encoded
 * backslash `%5C`.
 */
const SEPARATOR = String.raw`(?:\\{0,4}\/|\\{1,4}|%2[Ff]|%5[Cc])`;

/** Characters of a user name; the `u` flag admits non-ASCII letters. */
const USER_CHAR = String.raw`[\p{L}\p{N}_.\-]`;

/**
 * Where a home path may start: not right after an HTTP method (`GET /Users/1`
 * is an API route) and not inside a longer relative or composed path
 * (`owner/home/root/`, `${base}/home/.cache`, `../home/x`, a route group's
 * `(marketing)/home/page.tsx`), except right after a glued single-letter flag
 * (`-v/home/<user>`), a shell default expansion or option value
 * (`${HOME:-/home/<user>}`, `--opt=-/home/<user>`), a line-initial diff marker
 * (`-/home/<user>`), an ASCII truncation marker (`.../home/<user>`), a
 * URL-encoded separator or drive colon, a `file://<host>` or
 * `vscode://file` authority, a remote-shell authority
 * (`ssh://<user>@<host>:<port>`, `sftp://`, `scp://`, `rsync://`), or a remote
 * authority such as `vscode-remote://wsl+<distro>`.
 */
const NOT_AFTER_HTTP_METHOD = String.raw`(?<!\b(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS) )`;

const BOUNDARY = `${NOT_AFTER_HTTP_METHOD}(?:${A.join(
  [
    String.raw`(?<![\w.$})\-])`,
    String.raw`(?<=(?:^|[\s"'=])-[A-Za-z])`,
    String.raw`(?<=[:=]-|(?:^|[\r\n])-|\.\.\.)`,
    "(?<=%2[Ff]|%3[Aa]|%5[Cc])",
    String.raw`(?<=file:\/\/[\w.\-]+|:\/\/file|:\/\/[\w.\-]+(?:\+|%2[Bb])[\w.\-]+)`,
    String.raw`(?<=\b(?:ssh|sftp|scp|rsync|git\+ssh):\/\/[\w.@\-]+(?::\d+)?)`,
  ],
  "|"
)})`;

/**
 * Home directory roots: `/home`, Fedora Atomic's `/var/home`, the automounted
 * `/export/home` and `/net/home`, macOS `/Users`, the WSL share of a Linux
 * distribution (`\\wsl$\<distro>\home`, `\\wsl.localhost\<distro>\home`,
 * or `//wsl.localhost/<distro>/home` as git prints it), and the Windows profile
 * root after a drive letter (`C:\Users`, `C%3A%5CUsers`, the legacy
 * `C:\Documents and Settings`, case-insensitive), a WSL mount
 * (`/mnt/c/Users`), an MSYS drive (`/c/Users`) or a UNC share
 * (`\\server\Users`, `//server/Users`). The forward-slash share needs a
 * capitalized `Users` and no `:` before it, so a protocol-relative
 * `//cdn.example.com/users/1` and `https://host/Users/1` stay web routes.
 */
const HOME_ROOT = A.join(
  [
    String.raw`(?:\\{2,8}|\/{2,3})wsl(?:\$|\.localhost)${SEPARATOR}[\w.\-]+${SEPARATOR}(?:home|[Uu]sers|USERS)`,
    `[A-Za-z](?::|%3[Aa])${SEPARATOR}(?:[Uu]sers|USERS|[Dd]ocuments and [Ss]ettings)`,
    `${SEPARATOR}mnt${SEPARATOR}[A-Za-z]${SEPARATOR}(?:[Uu]sers|USERS)`,
    `${SEPARATOR}[A-Za-z]${SEPARATOR}Users`,
    String.raw`\\{2,8}${USER_CHAR}+${SEPARATOR}(?:[Uu]sers|USERS)`,
    String.raw`(?<!:)\/{2}${USER_CHAR}+\/Users`,
    `(?:${SEPARATOR}(?:var|export|net))?${SEPARATOR}(?:home|Users)`,
  ],
  "|"
);

/**
 * A home path whose user does not start a template or a dot directory. The
 * user is the longest run of name characters, so any other character ends it
 * (`/`, `?`, `#`, `@`, `’`, `…`, a quote, whitespace).
 */
const HOME_PATH_PATTERN = new RegExp(
  String.raw`${BOUNDARY}(?:${HOME_ROOT})${SEPARATOR}(?![.<$\{])(${USER_CHAR}+)(?!${USER_CHAR})`,
  "gu"
);

/**
 * The dash-encoded home directory that agent tooling writes into project and
 * scratchpad directory names (`-home-<user>-src`, `C--Users-<user>-src`). The
 * tail keeps every encoded segment so a dashed placeholder such as `ec2-user`
 * still matches. A tail without a further encoded segment counts only as a
 * directory with a path beneath it or as an entry of a `projects/` store, so a
 * `-home-dir` flag in prose and a `fix/-home-paths` branch label are not
 * findings.
 */
const ENCODED_HOME_PATTERN = /(?<![\w-])((?:[A-Za-z]-)?-(?:home|Users)-)([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;

/** A file without any home root name cannot match. */
const HOME_PREFILTER = /home|[Uu]sers|USERS|[Ss]ettings/u;

const PRIVATE_HOME_PATH_SUGGESTION =
  "record the path relative to ~ (for example ~/YeeBois/...); a path that is not a personal home passes through PrivateHomePaths.model.ts: a PlaceholderHomeUser name (fixtures, docs, service and container accounts), a HomeRouteSegment name (app routes), a privateHomePathScopedUsers row (a fleet account in named files), or a privateHomePathExemptions row with the exact count (a sealed archive)";

const isPlaceholderHomeUser = S.is(PlaceholderHomeUser);

const isHomeRouteSegment = S.is(HomeRouteSegment);

const scopedHomeUsers = HashMap.fromIterable(
  A.map(privateHomePathScopedUsers, (row) => [row.user, HashSet.fromIterable(row.files)] as const)
);

/**
 * A placeholder or route segment passes in every file; a scoped fleet account
 * only in the files its row names.
 *
 * @param file - Repository-relative path of the scanned file.
 * @returns A predicate on the user segment of one home path.
 */
const isAllowedHomeUser =
  (file: string) =>
  (user: string): boolean =>
    isPlaceholderHomeUser(user) ||
    isHomeRouteSegment(user) ||
    O.exists(HashMap.get(scopedHomeUsers, user), HashSet.has(file));

/**
 * A sentence may end right after the user (`/home/<user>.`); trailing dots are
 * not part of the name.
 *
 * @param user - The matched user segment.
 * @returns The user without trailing dots.
 */
const trimTrailingDots = (user: string): string => F.pipe(user, Str.replace(/\.+$/u, ""));

const firstEncodedSegment = (tail: string): string => A.headNonEmpty(F.pipe(tail, Str.split("-")));

/**
 * An encoded tail is allowed when its first segment is, or when it starts with
 * a dashed placeholder (`ec2-user-src`) followed by an encoded separator.
 *
 * @param allowed - The file's user predicate from `isAllowedHomeUser`.
 * @param tail - Every encoded segment after `-home-` or `-Users-`.
 * @returns Whether the encoded home names an allowed user.
 */
const isAllowedEncodedTail = (allowed: (user: string) => boolean, tail: string): boolean =>
  allowed(firstEncodedSegment(tail)) ||
  A.some(PlaceholderHomeUser.literals, (user) => tail === user || F.pipe(tail, Str.startsWith(`${user}-`)));

/** An encoded directory entry of a project store such as `~/.claude/projects/`. */
const PROJECT_STORE_ENTRY = /(?:^|[^\w.-])projects[\\/]$/u;

/**
 * A path continues beneath the match: `/`, or a backslash that does not start
 * a string escape (`\n`, `\t`, `\r`, `\"`, `\'`).
 */
const CONTINUING_SEPARATOR = /^(?:\/|\\(?![nrt"']))/u;

/**
 * Whether a bare encoded home (`-home-<word>`, no further encoded segment) is a
 * directory: a path continues beneath it, or it is an entry of a `projects/`
 * store. A branch label (`fix/-home-paths`) and a prose flag are neither.
 *
 * @param content - The scanned text.
 * @param start - Offset of the encoded match.
 * @param end - Offset just past the encoded match.
 * @returns Whether the bare encoded home is a directory path component.
 */
const isEncodedDirectory = (content: string, start: number, end: number): boolean =>
  CONTINUING_SEPARATOR.test(Str.slice(end, end + 2)(content)) ||
  PROJECT_STORE_ENTRY.test(Str.slice(Math.max(0, start - 10), start)(content));

type HomePathMatch = {
  readonly index: number;
  readonly text: string;
  readonly leaked: boolean;
};

const homePathMatches = (content: string, allowed: (user: string) => boolean): ReadonlyArray<HomePathMatch> =>
  A.getSomes(
    A.map(A.fromIterable(F.pipe(content, Str.matchAll(HOME_PATH_PATTERN))), (match) =>
      // The pattern's user group is mandatory, so a match always carries it.
      O.map(O.all([O.fromNullishOr(match.index), O.fromNullishOr(match[1])]), ([index, user]) => ({
        index,
        text: trimTrailingDots(match[0]),
        leaked: !allowed(trimTrailingDots(user)),
      }))
    )
  );

const encodedHomeMatches = (content: string, allowed: (user: string) => boolean): ReadonlyArray<HomePathMatch> =>
  A.getSomes(
    A.map(A.fromIterable(F.pipe(content, Str.matchAll(ENCODED_HOME_PATTERN))), (match) =>
      // Both groups of the encoded pattern are mandatory, so a match always carries them.
      O.map(
        O.all([O.fromNullishOr(match.index), O.fromNullishOr(match[1]), O.fromNullishOr(match[2])]),
        ([index, prefix, tail]) => {
          const isPathComponent =
            F.pipe(tail, Str.includes("-")) || isEncodedDirectory(content, index, index + match[0].length);
          return {
            index,
            text: `${prefix}${firstEncodedSegment(tail)}`,
            leaked: isPathComponent && !isAllowedEncodedTail(allowed, tail),
          };
        }
      )
    )
  );

const byIndex = Order.mapInput(Order.Number, (match: HomePathMatch) => match.index);

/**
 * Scan one file's text for home paths whose user is not a placeholder.
 *
 * **Details**
 *
 * Comments, prose, JSON, logs and data are all scanned; exemptions are not
 * applied here. Lines and columns are 1-based; columns count UTF-16 code
 * units.
 *
 * **Example** (Find a private home path)
 *
 * ```ts
 * import { scanPrivateHomePathText } from "@beep/repo-cli/commands/Laws/PrivateHomePaths"
 *
 * const leaked = ["", "home", "jdoe", "src"].join("/")
 * const [finding] = scanPrivateHomePathText("notes.md", `cwd ${leaked}\n`)
 * console.log(finding?.column) // 5
 * ```
 *
 * **Example** (Accept a placeholder user in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { scanPrivateHomePathText } from "@beep/repo-cli/commands/Laws/PrivateHomePaths"
 *
 * console.log(pipe("notes.md", scanPrivateHomePathText("cwd /home/ada/src\n")).length) // 0
 * ```
 *
 * @param file - Repository-relative path recorded on each finding.
 * @param content - The file's text.
 * @returns Findings ordered by position.
 * @category utilities
 * @since 0.0.0
 */
export const scanPrivateHomePathText: {
  (content: string): (file: string) => ReadonlyArray<PrivateHomePathFinding>;
  (file: string, content: string): ReadonlyArray<PrivateHomePathFinding>;
} = F.dual(2, (file: string, content: string): ReadonlyArray<PrivateHomePathFinding> => {
  if (!HOME_PREFILTER.test(content)) {
    return A.empty();
  }
  const allowed = isAllowedHomeUser(file);
  const leaked = A.sort(
    A.filter(
      A.appendAll(homePathMatches(content, allowed), encodedHomeMatches(content, allowed)),
      (match) => match.leaked
    ),
    byIndex
  );
  if (A.isReadonlyArrayEmpty(leaked)) {
    return A.empty();
  }
  const lineStarts = lineStartOffsets(content);
  return A.map(leaked, (match) =>
    PrivateHomePathFinding.make({
      file,
      ...locateIndex(lineStarts, match.index),
      match: match.text,
      rule: "private-home-path",
      suggestion: PRIVATE_HOME_PATH_SUGGESTION,
    })
  );
});

const exemptionMismatchFinding =
  (exemption: PrivateHomePathExemption, found: number) =>
  (finding: PrivateHomePathFinding): PrivateHomePathFinding =>
    PrivateHomePathFinding.make({
      ...finding,
      rule: "exemption-count-mismatch",
      suggestion: `sealed archive expects exactly ${exemption.count} home paths, found ${found}; restore the sealed bytes or update the exemption row (${exemption.reason})`,
    });

const staleExemptionFinding = (exemption: PrivateHomePathExemption, found: number): PrivateHomePathFinding =>
  PrivateHomePathFinding.make({
    file: exemption.file,
    line: 1,
    column: 1,
    match: "",
    rule: "exemption-count-mismatch",
    suggestion: `sealed archive expects exactly ${exemption.count} home paths, found ${found}; remove the stale exemption row`,
  });

/**
 * Apply an exemption row to the findings of one file.
 *
 * **Details**
 *
 * Without a row the findings stand. With a row, an exact count clears them;
 * any other count reports every home path in the file, or one stale-row
 * finding when the file records none.
 *
 * **Example** (Clear an archive at its sealed count)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { PrivateHomePathExemption } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 * import { applyPrivateHomePathExemption, scanPrivateHomePathText } from "@beep/repo-cli/commands/Laws/PrivateHomePaths"
 *
 * const leaked = ["", "home", "jdoe", "src"].join("/")
 * const row = PrivateHomePathExemption.make({ file: "a.txt", count: 1, reason: "sealed capture" })
 * const findings = scanPrivateHomePathText("a.txt", `${leaked}\n`)
 * console.log(applyPrivateHomePathExemption(findings, O.some(row)).length) // 0
 * ```
 *
 * **Example** (Apply a missing row in a pipeline)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { pipe } from "effect/Function"
 * import { applyPrivateHomePathExemption, scanPrivateHomePathText } from "@beep/repo-cli/commands/Laws/PrivateHomePaths"
 *
 * const leaked = ["", "home", "jdoe", "src"].join("/")
 * console.log(pipe(scanPrivateHomePathText("a.txt", leaked), applyPrivateHomePathExemption(O.none())).length) // 1
 * ```
 *
 * @param findings - Findings from {@link scanPrivateHomePathText}.
 * @param exemption - The file's exemption row, if any.
 * @returns The findings the law reports for the file.
 * @category utilities
 * @since 0.0.0
 */
export const applyPrivateHomePathExemption: {
  (
    exemption: O.Option<PrivateHomePathExemption>
  ): (findings: ReadonlyArray<PrivateHomePathFinding>) => ReadonlyArray<PrivateHomePathFinding>;
  (
    findings: ReadonlyArray<PrivateHomePathFinding>,
    exemption: O.Option<PrivateHomePathExemption>
  ): ReadonlyArray<PrivateHomePathFinding>;
} = F.dual(
  2,
  (
    findings: ReadonlyArray<PrivateHomePathFinding>,
    exemption: O.Option<PrivateHomePathExemption>
  ): ReadonlyArray<PrivateHomePathFinding> =>
    O.match(exemption, {
      onNone: () => findings,
      onSome: (row) => {
        const found = A.length(findings);
        if (found === row.count) {
          return A.empty();
        }
        return A.match(findings, {
          onEmpty: () => A.of(staleExemptionFinding(row, found)),
          onNonEmpty: A.map(exemptionMismatchFinding(row, found)),
        });
      },
    })
);

/**
 * Render one finding as a `file:line:col  match  →  suggestion` report line.
 *
 * **Example** (Format a finding)
 *
 * ```ts
 * import { formatPrivateHomePathFinding, scanPrivateHomePathText } from "@beep/repo-cli/commands/Laws/PrivateHomePaths"
 *
 * const leaked = ["", "home", "jdoe"].join("/")
 * for (const finding of scanPrivateHomePathText("demo.md", `see ${leaked}/x\n`)) {
 *   console.log(formatPrivateHomePathFinding(finding).startsWith("demo.md:1:5")) // true
 * }
 * ```
 *
 * @param finding - The finding to render.
 * @returns One human-readable report line.
 * @category utilities
 * @since 0.0.0
 */
export const formatPrivateHomePathFinding = (finding: PrivateHomePathFinding): string =>
  `${finding.file}:${finding.line}:${finding.column}  ${finding.match}  →  ${finding.suggestion}`;

/**
 * Run the private home path law over every git-tracked text file.
 *
 * **Details**
 *
 * Lists index entries with `git ls-files --stage`, keeps regular files, and
 * scans the working-tree text, decoding a file that contains a NUL byte rather
 * than skipping it, so `skippedBinaryFiles` stays 0. Exempt
 * archives are scanned too, so a count change fails; an exemption row whose
 * file is no longer tracked is reported as stale. `exemptFiles` counts the
 * archives that matched their sealed count.
 *
 * **Example** (Count findings in the repository)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { PrivateHomePathsOptions } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 * import { runPrivateHomePaths } from "@beep/repo-cli/commands/Laws/PrivateHomePaths"
 *
 * const program = Effect.map(
 *   runPrivateHomePaths(PrivateHomePathsOptions.make({ cwd: process.cwd(), strictCheck: true })),
 *   (summary) => summary.findings.length
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location, strictness, and exemption rows.
 * @returns Effect that scans the tracked files and summarizes every finding.
 * @category utilities
 * @since 0.0.0
 */
export const runPrivateHomePaths = Effect.fn("PrivateHomePaths.runPrivateHomePaths")(function* (
  options: PrivateHomePathsOptions
): Effect.fn.Return<
  PrivateHomePathsSummary,
  PrivateHomePathsExecutionError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcess.ChildProcessSpawner | Git
> {
  const exemptions = HashMap.fromIterable(A.map(options.exemptions, (row) => [row.file, row] as const));
  const {
    skippedFiles: _skippedFiles,
    findings: outcomes,
    ...scan
  } = yield* scanTrackedTextFiles({
    cwd: options.cwd,
    gitErrors: messageGitErrorAdapter(PrivateHomePathsExecutionError.new),
    mapError: PrivateHomePathsExecutionError.mapError,
    isSkipped: F.constFalse,
    decodeNulBearingFiles: true,
    scan: (file, content) => {
      const row = HashMap.get(exemptions, file);
      return A.of({
        file,
        exempt: O.isSome(row),
        findings: applyPrivateHomePathExemption(scanPrivateHomePathText(file, content), row),
      });
    },
  });
  const seen = HashSet.fromIterable(A.map(outcomes, (outcome) => outcome.file));
  const untracked = A.filter(options.exemptions, (row) => !HashSet.has(seen, row.file));
  const reported = A.appendAll(
    A.flatMap(outcomes, (outcome) => outcome.findings),
    A.map(untracked, (row) => staleExemptionFinding(row, 0))
  );
  return PrivateHomePathsSummary.make({
    ...scan,
    exemptFiles: A.length(A.filter(outcomes, (outcome) => outcome.exempt && A.isReadonlyArrayEmpty(outcome.findings))),
    findings: reported,
    strictFailure: options.strictCheck && A.isReadonlyArrayNonEmpty(reported),
  });
});
