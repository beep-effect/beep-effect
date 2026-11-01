/**
 * Detect test expectations a diff rewrote to match new output, and replay the
 * old test on the merge base to tell a real behavior change from a masked red.
 *
 * **Details**
 *
 * A diff that edits an existing assertion is honest when its own source change
 * moved the output: then the old test passed on the merge base. When the old
 * test already failed on the merge base, the edit turns an inherited red green
 * without fixing the source that produces it (#2215 rewrote a `yeet.test.ts`
 * expectation to match #2212's over-escaped `@`, and so hid that bug until
 * #2219/#2224). The static pass finds rewritten assertion lines; the dynamic
 * pass runs each such test file, unmodified from the merge base, in a
 * detached merge-base worktree.
 *
 * **Gotchas**
 *
 * Detection is per file, not per assertion: a test file that is red on the
 * merge base for an unrelated test still classifies as `masks-base-red`, and
 * the owner either fixes that red or records a reasoned skip. Deleted
 * assertions are not flagged, because deletions are indistinguishable from
 * refactors without semantic diffing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../../../internal/cli/EnvConfig.ts";
import { manifestParser } from "../../../internal/ManifestRead.ts";
import { runToExit } from "../../../internal/process/index.ts";
import { readGitRenames, runGitOutput as runSharedGitOutput } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { ExpectationRewrite, ExpectationRewriteVerdict } from "./FinalCheck.schemas.ts";
import { runGitPathList } from "./GitExec.ts";
import type { LenientManifest } from "@beep/package-json/LenientManifest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/index.ts";

const TEST_FILE_PATTERN = /\.(?:test|spec)\.tsx?$/;
const SNAPSHOT_FILE_PATTERN = /^(.*)\/__snapshots__\/(.+)\.snap$/;
const ASSERTION_PATTERN =
  /\b(?:expect|assert|assert[A-Z]\w*|deepStrictEqual|strictEqual|deepEqual)\s*\(|\.(?:toBe|toEqual|toStrictEqual|toContain|toContainEqual|toMatch|toMatchObject|toMatchInlineSnapshot|toMatchSnapshot|toThrow|toThrowError|toHaveLength|toHaveProperty)\b/;
const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const BUN_VITEST_PATTERN = /\bbunx?\s+--bun\s+vitest\b/;
const VITEST_PATTERN = /\bvitest\b/;
const parsePackageJson = manifestParser(["scripts"]);

const isAssertionLine = (line: string): boolean => ASSERTION_PATTERN.test(line);

type AddedLine = { readonly line: number; readonly text: string };

type HunkState = {
  readonly removed: ReadonlyArray<string>;
  readonly added: ReadonlyArray<AddedLine>;
  readonly nextLine: number;
};

type DiffFile = { readonly path: string; readonly testFile: string };

type AssertionLines = { readonly removed: ReadonlyArray<string>; readonly added: ReadonlyArray<AddedLine> };

type ScanState = {
  readonly rewrites: ReadonlyArray<ExpectationRewrite>;
  readonly file: O.Option<DiffFile>;
  readonly hunk: O.Option<HunkState>;
};

const testFileForPath = (path: string): O.Option<string> =>
  TEST_FILE_PATTERN.test(path)
    ? O.some(path)
    : pipe(
        O.fromNullishOr(SNAPSHOT_FILE_PATTERN.exec(path)),
        O.map((match) => `${match[1]}/${match[2]}`)
      );

const normalizeWhitespace = (line: string): string => Str.trim(Str.replace(/\s+/g, " ")(line));

// Cancel each added assertion against a removed one that differs only in
// whitespace, as a formatter reflow leaves them (#2247); a real change, even
// one token, stays unmatched.
const withoutReflowedAssertions = (removed: ReadonlyArray<string>, added: ReadonlyArray<AddedLine>): AssertionLines => {
  const initial: AssertionLines = { removed, added: [] };
  return A.reduce(added, initial, (state, entry) =>
    O.match(
      A.findFirstIndex(state.removed, (line) => normalizeWhitespace(line) === normalizeWhitespace(entry.text)),
      {
        onNone: () => ({ removed: state.removed, added: A.append(state.added, entry) }),
        onSome: (index) => ({ removed: A.remove(state.removed, index), added: state.added }),
      }
    )
  );
};

const hunkRewrites = (path: string, testFile: string, hunk: HunkState): ReadonlyArray<ExpectationRewrite> => {
  const { removed, added } = TEST_FILE_PATTERN.test(path)
    ? withoutReflowedAssertions(
        A.filter(hunk.removed, isAssertionLine),
        A.filter(hunk.added, (entry) => isAssertionLine(entry.text))
      )
    : { removed: hunk.removed, added: hunk.added };
  return pipe(
    O.fromNullishOr(A.head(removed).pipe(O.getOrUndefined)),
    O.match({
      onNone: A.empty<ExpectationRewrite>,
      onSome: (firstRemoved) =>
        A.map(A.isReadonlyArrayNonEmpty(added) ? added : [], (entry, index) =>
          ExpectationRewrite.make({
            testFile,
            line: entry.line,
            removed: Str.trim(O.getOrElse(A.get(removed, index), () => firstRemoved)),
            added: Str.trim(entry.text),
          })
        ),
    })
  );
};

const flushHunk = (state: ScanState): ScanState => ({
  file: state.file,
  hunk: O.none(),
  rewrites: O.match(O.all({ file: state.file, hunk: state.hunk }), {
    onNone: () => state.rewrites,
    onSome: ({ file, hunk }) => A.appendAll(state.rewrites, hunkRewrites(file.path, file.testFile, hunk)),
  }),
});

const startHunk = (state: ScanState, line: string): ScanState => {
  const header = HUNK_HEADER_PATTERN.exec(line);
  return {
    ...flushHunk(state),
    hunk: O.some({ removed: [], added: [], nextLine: header === null ? 0 : Number(header[1]) }),
  };
};

const startFile = (state: ScanState, line: string): ScanState => {
  const path = Str.replace(/^b\//, "")(Str.slice(4)(line));
  return { ...state, file: O.map(testFileForPath(path), (testFile) => ({ path, testFile })) };
};

const extendHunk = (state: ScanState, update: (hunk: HunkState) => HunkState): ScanState => ({
  ...state,
  hunk: O.map(state.hunk, update),
});

const removeLine = (state: ScanState, line: string): ScanState =>
  extendHunk(state, (hunk) => ({ ...hunk, removed: A.append(hunk.removed, Str.slice(1)(line)) }));

const addLine = (state: ScanState, line: string): ScanState =>
  extendHunk(state, (hunk) => ({
    ...hunk,
    added: A.append(hunk.added, { line: hunk.nextLine, text: Str.slice(1)(line) }),
    nextLine: hunk.nextLine + 1,
  }));

// Unified-diff line shapes, in precedence order: a `+++`/`---` header also
// starts with `+`/`-`, so headers come before body lines.
const LINE_HANDLERS: ReadonlyArray<readonly [string, (state: ScanState, line: string) => ScanState]> = [
  ["diff --git ", (state) => ({ ...flushHunk(state), file: O.none() })],
  ["+++ ", startFile],
  ["--- ", (state) => state],
  ["@@", startHunk],
  ["-", removeLine],
  ["+", addLine],
];

const scanLine = (state: ScanState, line: string): ScanState =>
  O.match(
    A.findFirst(LINE_HANDLERS, ([prefix]) => Str.startsWith(prefix)(line)),
    {
      onNone: () => state,
      onSome: ([, handle]) => handle(state, line),
    }
  );

/**
 * Find existing test assertions (and snapshot entries) a unified diff rewrote.
 *
 * **Details**
 *
 * Reads `git diff --unified=0` output. A rewrite is a hunk in a `*.test.ts`
 * or `*.spec.ts` file that removes at least one assertion line and adds at
 * least one, or any hunk in a `__snapshots__/*.snap` file that both removes
 * and adds lines. Newly added assertions alone are never a rewrite, and an
 * added assertion line equal to a removed one after collapsing whitespace is
 * a formatter reflow, not a rewrite.
 *
 * **Example** (Find a rewritten expectation)
 *
 * ```ts
 * import { findExpectationRewrites } from "@beep/repo-cli/test/Yeet"
 *
 * const diff = [
 *   "diff --git a/pkg/test/a.test.ts b/pkg/test/a.test.ts",
 *   "--- a/pkg/test/a.test.ts",
 *   "+++ b/pkg/test/a.test.ts",
 *   "@@ -10 +10 @@",
 *   '-    expect(out).toBe("a")',
 *   '+    expect(out).toBe("b")',
 * ].join("\n")
 * console.log(findExpectationRewrites(diff).length) // 1
 * ```
 *
 * @param diff - Unified diff text with zero context lines.
 * @returns Every rewritten expectation, in diff order.
 * @category parsers
 * @since 0.0.0
 */
export const findExpectationRewrites = (diff: string): ReadonlyArray<ExpectationRewrite> =>
  flushHunk(
    A.reduce(Str.split(diff, "\n"), { rewrites: [], file: O.none(), hunk: O.none() } satisfies ScanState, scanLine)
  ).rewrites;

/**
 * Group rewrites by test file, keeping first-seen order.
 *
 * **Example** (Group rewrites)
 *
 * ```ts
 * import { ExpectationRewrite, rewrittenTestFiles } from "@beep/repo-cli/test/Yeet"
 *
 * const rewrite = ExpectationRewrite.make({ testFile: "a.test.ts", line: 1, removed: "x", added: "y" })
 * console.log(rewrittenTestFiles([rewrite, rewrite])) // [["a.test.ts", 2]]
 * ```
 *
 * @param rewrites - Rewrites found by {@link findExpectationRewrites}.
 * @returns `[testFile, rewriteCount]` pairs.
 * @category utilities
 * @since 0.0.0
 */
export const rewrittenTestFiles = (
  rewrites: ReadonlyArray<ExpectationRewrite>
): ReadonlyArray<readonly [string, number]> =>
  pipe(
    A.dedupe(A.map(rewrites, (rewrite) => rewrite.testFile)),
    A.map((testFile) => [testFile, A.length(A.filter(rewrites, (rewrite) => rewrite.testFile === testFile))] as const)
  );

// Test files a vitest segment names as positional arguments; `--exclude=...`
// and other flags are not file arguments.
const segmentFileArguments = (segment: string): ReadonlyArray<string> =>
  pipe(
    Str.split(Str.trim(segment), /\s+/),
    A.filter((token) => !Str.startsWith("-")(token) && TEST_FILE_PATTERN.test(token)),
    A.map(Str.replace(/^\.\//, ""))
  );

const scriptRunsTestOnBun = (script: string, testPath: string): boolean => {
  const vitestSegments = A.filter(Str.split(script, "&&"), (segment) => VITEST_PATTERN.test(segment));
  return pipe(
    A.findFirst(vitestSegments, (segment) => A.contains(segmentFileArguments(segment), testPath)),
    O.orElse(() => A.findFirst(vitestSegments, flow(segmentFileArguments, A.isReadonlyArrayEmpty))),
    O.exists((segment) => BUN_VITEST_PATTERN.test(segment))
  );
};

/**
 * Build the `bunx` arguments that replay one test file on its package's own
 * test runtime.
 *
 * **Details**
 *
 * Reads the package's `beep:test` script, falling back to `test`, and splits
 * it on `&&`. The vitest segment that names the test file as an argument
 * decides the runtime; when none names it, the vitest segment with no file
 * argument does. A segment that runs vitest under Bun (`bunx --bun vitest`
 * or `bun --bun vitest`) makes the replay pass `--bun`; anything else runs
 * plain `bunx vitest`, which uses Node.
 *
 * **Example** (Replay a Bun-runtime package's test)
 *
 * ```ts
 * import { LenientManifest } from "@beep/package-json/LenientManifest"
 * import { vitestReplayArgs } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = Effect.runSync(LenientManifest.parse('{"scripts":{"beep:test":"bunx --bun vitest run"}}'))
 * console.log(vitestReplayArgs(manifest, "test/a.test.ts")) // ["--bun", "vitest", "run", "test/a.test.ts"]
 * ```
 *
 * @param manifest - Decoded `package.json` of the test file's owning package.
 * @param testPath - Test file path relative to the package directory.
 * @returns Arguments for `bunx`.
 * @category utilities
 * @since 0.0.0
 */
export const vitestReplayArgs: {
  (testPath: string): (manifest: LenientManifest) => ReadonlyArray<string>;
  (manifest: LenientManifest, testPath: string): ReadonlyArray<string>;
} = dual(
  2,
  (manifest: LenientManifest, testPath: string): ReadonlyArray<string> =>
    pipe(
      O.fromUndefinedOr(manifest.scripts),
      O.flatMap((scripts) => O.orElse(R.get(scripts, "beep:test"), () => R.get(scripts, "test"))),
      O.exists((script) => scriptRunsTestOnBun(script, testPath))
    )
      ? ["--bun", "vitest", "run", testPath]
      : ["vitest", "run", testPath]
);

// The first rewrite of a file carries its merge-base path; files diffed in
// place have none and live at the same path.
const baseFileFor = (rewrites: ReadonlyArray<ExpectationRewrite>, testFile: string): string =>
  pipe(
    A.findFirst(rewrites, (rewrite) => rewrite.testFile === testFile),
    O.flatMap((rewrite) => O.fromUndefinedOr(rewrite.baseFile)),
    O.getOrElse(() => testFile)
  );

const commandFailure = (command: string) => (cause: { readonly message: string }) =>
  YeetCommandError.make({ message: `${command} failed: ${cause.message}`, command, exitCode: 1 });

const runInherited = Effect.fn("Yeet.ExpectationRewrite.runInherited")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  env?: Record<string, string>
): Effect.fn.Return<number, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const commandLine = A.join([command, ...args], " ");
  return yield* runToExit({
    command,
    args,
    cwd,
    stdio: "inherit",
    env,
    extendEnv: true,
  }).pipe(Effect.mapError(commandFailure(commandLine)));
});

const packageDirFor = Effect.fn("Yeet.ExpectationRewrite.packageDirFor")(function* (root: string, testFile: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let dir = path.dirname(path.join(root, testFile));
  while (Str.startsWith(root)(dir) && dir !== root) {
    if (yield* fs.exists(path.join(dir, "package.json")).pipe(Effect.orElseSucceed(() => false))) {
      return O.some(dir);
    }
    dir = path.dirname(dir);
  }
  return O.none<string>();
});

// `testFile` names the file on the head (what the verdict reports); `baseFile`
// is where the merge base holds it, which differs after a rename.
const classifyOnBase = Effect.fn("Yeet.ExpectationRewrite.classifyOnBase")(function* (
  baseRoot: string,
  testFile: string,
  baseFile: string,
  rewrites: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const verdict = (classification: ExpectationRewriteVerdict["classification"], detail: string) =>
    ExpectationRewriteVerdict.make({ testFile, classification, rewrites, detail });
  if (!(yield* fs.exists(path.join(baseRoot, baseFile)).pipe(Effect.orElseSucceed(() => false)))) {
    return verdict("unverified", `the test file does not exist on the merge base (${baseFile})`);
  }
  const packageDir = yield* packageDirFor(baseRoot, baseFile);
  if (O.isNone(packageDir)) {
    return verdict("unverified", "no owning package.json was found for the test file on the merge base");
  }
  const manifest = yield* fs
    .readFileString(path.join(packageDir.value, "package.json"))
    .pipe(Effect.flatMap(parsePackageJson), Effect.option);
  if (O.isNone(manifest)) {
    return verdict("unverified", "the owning package.json on the merge base could not be read or decoded");
  }
  yield* Console.log(`[yeet] final-check: replaying the merge-base version of ${baseFile} on the merge base`);
  const exitCode = yield* runInherited(
    "bunx",
    vitestReplayArgs(manifest.value, path.relative(packageDir.value, path.join(baseRoot, baseFile))),
    packageDir.value,
    { CI: "true" }
  ).pipe(Effect.catch((cause) => Console.error(`[yeet] final-check: ${cause.message}`).pipe(Effect.as(-1))));
  return exitCode === 0
    ? verdict("follows-diff", "the old test passes on the merge base, so this diff's source change moved the output")
    : exitCode === -1
      ? verdict("unverified", "the merge-base test run could not be started")
      : verdict(
          "masks-base-red",
          `the old test already fails on the merge base (vitest exit ${exitCode}), so the rewritten expectation hides an inherited red instead of fixing its source`
        );
});

const $I = $RepoCliId.create("commands/Yeet/internal/ExpectationRewrite");

/**
 * Git pathspec selecting the test files and snapshots the gate scans.
 *
 * @category constants
 * @since 0.0.0
 */
export const EXPECTATION_TEST_PATHSPEC: ReadonlyArray<string> = [
  "*.test.ts",
  "*.test.tsx",
  "*.spec.ts",
  "*.spec.tsx",
  "*.snap",
];

/**
 * Placeholder recorded for a test file whose own diff exceeded the capture
 * bound; the file is replayed whole on the merge base instead.
 *
 * @category constants
 * @since 0.0.0
 */
export const EXPECTATION_DIFF_OVERFLOW =
  "(diff exceeded the capture limit; the whole file is replayed on the merge base)";

class ExpectationDiffOverflow extends S.TaggedError<ExpectationDiffOverflow, { readonly brand: unique symbol }>(
  $I`ExpectationDiffOverflow`
)(
  "ExpectationDiffOverflow",
  { commandLine: S.String },
  $I.annoteError<ExpectationDiffOverflow>("ExpectationDiffOverflow", {
    description: "One test file's unified diff exceeded the repo-run capture bound.",
  })
) {}

const gitFailure = {
  onSpawnFailure: (commandLine: string) => YeetCommandError.new(`Failed to run ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode }: { readonly commandLine: string; readonly exitCode: number }) =>
    YeetCommandError.make({
      message: `${commandLine} failed with exit code ${exitCode}.`,
      command: commandLine,
      exitCode,
    }),
};

// The rename table is read raw and unbounded, so truncation cannot occur there.
const listingAdapter: GitCommandErrorAdapter<YeetCommandError> = { ...gitFailure, onTruncated: O.none() };

// A single file's diff that overflows is a typed outcome, not a failure: the
// file is replayed whole on the merge base.
const fileDiffAdapter: GitCommandErrorAdapter<YeetCommandError | ExpectationDiffOverflow> = {
  ...gitFailure,
  onTruncated: O.some((commandLine) => ExpectationDiffOverflow.make({ commandLine })),
};

// The merge-base path of a renamed file, mapped through the snapshot rule;
// a file diffed in place has none.
const renamedFrom = (basePath: string, headPath: string): O.Option<string> =>
  basePath === headPath ? O.none() : O.some(O.getOrElse(testFileForPath(basePath), () => basePath));

const withBaseFile =
  (baseFile: O.Option<string>) =>
  (rewrite: ExpectationRewrite): ExpectationRewrite =>
    O.match(baseFile, {
      onNone: () => rewrite,
      onSome: (file) => ExpectationRewrite.make({ ...rewrite, baseFile: file }),
    });

// A `.snap` outside `__snapshots__/` matches the pathspec but names no test, so
// its overflow yields nothing, as its small diff would.
const overflowRewrite = (headPath: string, baseFile: O.Option<string>): ReadonlyArray<ExpectationRewrite> =>
  pipe(
    testFileForPath(headPath),
    O.map((testFile) =>
      withBaseFile(baseFile)(
        ExpectationRewrite.make({
          testFile,
          line: 0,
          removed: EXPECTATION_DIFF_OVERFLOW,
          added: EXPECTATION_DIFF_OVERFLOW,
        })
      )
    ),
    O.toArray
  );

const diffTestFile = Effect.fn("Yeet.ExpectationRewrite.diffTestFile")(function* (
  repoRoot: string,
  mergeBase: string,
  basePath: string,
  headPath: string
) {
  const baseFile = renamedFrom(basePath, headPath);
  const paths = O.isNone(baseFile) ? [headPath] : [basePath, headPath];
  return yield* runSharedGitOutput(
    repoRoot,
    ["diff", "--unified=0", "--no-color", "--find-renames=50%", mergeBase, "HEAD", "--", ...paths],
    fileDiffAdapter
  ).pipe(
    Effect.map((diff) => A.map(findExpectationRewrites(diff), withBaseFile(baseFile))),
    Effect.catchTag("ExpectationDiffOverflow", () => Effect.succeed(overflowRewrite(headPath, baseFile)))
  );
});

/**
 * Collect the rewritten expectations between the merge base and `HEAD`.
 *
 * **Details**
 *
 * Only files Git reports as modified or renamed are diffed, each on its own:
 * an added file removes nothing and a deleted file adds nothing, so neither
 * can hold a rewrite, and together they are what makes one whole-tree diff
 * of a moved test directory overflow the capture bound (#2241). A renamed
 * file is diffed with both of its paths so Git pairs them and shows only the
 * changed hunks. A single file whose diff still overflows becomes one
 * {@link EXPECTATION_DIFF_OVERFLOW} rewrite, so it is replayed whole.
 *
 * **Example** (Build the collector)
 *
 * ```ts
 * import { collectExpectationRewrites } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(collectExpectationRewrites("/repo", "abc123"))) // true
 * ```
 *
 * @param repoRoot - Checkout whose diff is scanned.
 * @param mergeBase - Merge base of the branch with its base ref.
 * @returns Every rewritten expectation, modified files first, then renames.
 * @category workflows
 * @since 0.0.0
 */
export const collectExpectationRewrites = Effect.fn("Yeet.collectExpectationRewrites")(function* (
  repoRoot: string,
  mergeBase: string
): Effect.fn.Return<
  ReadonlyArray<ExpectationRewrite>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const modified = yield* runGitPathList(repoRoot, [
    "diff",
    "--name-only",
    "-z",
    "--diff-filter=M",
    mergeBase,
    "HEAD",
    "--",
    ...EXPECTATION_TEST_PATHSPEC,
  ]);
  const renamed = yield* readGitRenames(repoRoot, mergeBase, "HEAD", EXPECTATION_TEST_PATHSPEC, listingAdapter, () =>
    YeetCommandError.make({ message: "git diff --name-status returned a malformed rename table.", exitCode: 1 })
  );
  const fromModified = yield* Effect.forEach(modified, (path) => diffTestFile(repoRoot, mergeBase, path, path));
  const fromRenamed = yield* Effect.forEach(renamed, (rename) =>
    diffTestFile(repoRoot, mergeBase, rename.sourcePath, rename.targetPath)
  );
  return A.flatten([...fromModified, ...fromRenamed]);
});

/**
 * Replay each rewritten test file, unmodified, on the merge base.
 *
 * **Details**
 *
 * Materializes a detached merge-base worktree under
 * `~/.cache/beep/final-check/`, installs it with
 * `bun install --frozen-lockfile`, runs `vitest run <file>` from each test
 * file's owning package on that package's declared test runtime (see
 * {@link vitestReplayArgs}), and removes the worktree afterwards. No worktree is created when
 * there are no rewrites.
 *
 * **Example** (Build the replay effect)
 *
 * ```ts
 * import { verifyExpectationRewrites } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(verifyExpectationRewrites("/repo", "abc123", []))) // true
 * ```
 *
 * @param repoRoot - Checkout whose diff was scanned.
 * @param mergeBase - Merge-base commit to replay on.
 * @param rewrites - Rewrites found by {@link findExpectationRewrites}.
 * @returns One verdict per rewritten test file.
 * @category workflows
 * @since 0.0.0
 */
export const verifyExpectationRewrites = Effect.fn("Yeet.verifyExpectationRewrites")(function* (
  repoRoot: string,
  mergeBase: string,
  rewrites: ReadonlyArray<ExpectationRewrite>
): Effect.fn.Return<
  ReadonlyArray<ExpectationRewriteVerdict>,
  YeetCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const files = rewrittenTestFiles(rewrites);
  if (A.isReadonlyArrayEmpty(files)) {
    return [];
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = O.getOrElse(yield* configStringOption("HOME"), () => repoRoot);
  const cacheRoot = path.join(home, ".cache", "beep", "final-check");
  yield* fs.makeDirectory(cacheRoot, { recursive: true }).pipe(Effect.mapError(commandFailure("mkdir")));
  const baseRoot = path.join(cacheRoot, `base-${Str.slice(0, 12)(mergeBase)}-${yield* Clock.currentTimeMillis}`);
  const unverifiedAll = (detail: string) =>
    A.map(files, ([testFile, count]) =>
      ExpectationRewriteVerdict.make({ testFile, classification: "unverified", rewrites: count, detail })
    );
  return yield* Effect.acquireUseRelease(
    runInherited("git", ["worktree", "add", "--detach", baseRoot, mergeBase], repoRoot),
    Effect.fnUntraced(function* (addExit) {
      if (addExit !== 0) {
        return unverifiedAll(`git worktree add exited ${addExit}`);
      }
      const installExit = yield* runInherited("bun", ["install", "--frozen-lockfile"], baseRoot);
      if (installExit !== 0) {
        return unverifiedAll(`bun install in the merge-base worktree exited ${installExit}`);
      }
      return yield* Effect.forEach(files, ([testFile, count]) =>
        classifyOnBase(baseRoot, testFile, baseFileFor(rewrites, testFile), count)
      );
    }),
    () => runInherited("git", ["worktree", "remove", "--force", baseRoot], repoRoot).pipe(Effect.ignore)
  );
});
