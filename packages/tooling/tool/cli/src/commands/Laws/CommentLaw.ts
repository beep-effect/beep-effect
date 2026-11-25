/**
 * Comment law: the merge-base growth check, the pending-scope lock and the census.
 *
 * **Details**
 *
 * Every in-scope file is parsed with `oxc-parser` and classified by the
 * grammar the `beep/no-comments` oxlint rule uses. The growth check compares
 * the multiset of banned-comment fingerprints in changed files between the
 * merge base and the working tree; a fingerprint is the SHA-256 of the
 * comment's normalized text, with no path or line, so a moved or renamed
 * comment costs nothing and a new or reworded one fails. The lock check reads
 * the pending shards under `standards/comment-law/pending/`; every scope they
 * do not list must hold zero banned comments.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { Jsonc } from "@beep/jsonc/Jsonc";
import {
  CommentGrammarInput,
  classifyComments,
  isBannedCommentKind,
  SourceComment,
} from "@beep/lint-rules/comment-grammar";
import { formatJsonc } from "@beep/repo-cli-kit/artifacts/index";
import { findRepoRoot } from "@beep/repo-utils";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { A } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { parseSync } from "oxc-parser";
import { adaptGitKitError } from "../../internal/repo-run/GitExec.ts";
import {
  CommentCensusRow,
  CommentDelta,
  CommentFileChange,
  CommentLawFinding,
  CommentLawPending,
  CommentLawPolicy,
  CommentLawSummary,
  CommentLockInput,
  CommentLockResult,
} from "./CommentLaw.model.ts";
import { messageGitErrorAdapter } from "./internal/TrackedTextFiles.ts";
import { CommentLawExecutionError } from "./Laws.errors.ts";
import type { GitInvocation } from "@beep/git/GitCommand";
import type { ClassifiedComment } from "@beep/lint-rules/comment-grammar";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitKitError } from "../../internal/repo-run/GitExec.ts";
import type { CommentLawOptions } from "./CommentLaw.model.ts";

/**
 * Repository-relative path of the comment-law policy file.
 *
 * **Example** (Locate the policy)
 *
 * ```ts
 * import { COMMENT_LAW_POLICY_PATH } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(COMMENT_LAW_POLICY_PATH) // "standards/comment-law/policy.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const COMMENT_LAW_POLICY_PATH = "standards/comment-law/policy.jsonc";

/**
 * Repository-relative directory that holds one pending shard per package.
 *
 * **Example** (Locate a pending shard)
 *
 * ```ts
 * import { COMMENT_LAW_PENDING_DIR } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(`${COMMENT_LAW_PENDING_DIR}/beep-csv.jsonc`) // "standards/comment-law/pending/beep-csv.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const COMMENT_LAW_PENDING_DIR = "standards/comment-law/pending";

const SOURCE_EXTENSION = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const INCLUDED =
  /^(?:apps|packages|infra|tools)\/|^\.claude\/.*\.ts$|^[^/]+\.(?:ts|mts|cts|js|mjs|cjs)$|(?:^|\/)scripts\//;
const EXCLUDED_ROOT = /^(?:scratchpad|goals|explorations|research|docs|standards|\.repos|\.semgrep)\//;
const EXCLUDED_DIR =
  /(?:^|\/)(?:generated|_generated|vendor|vendored|sdks|fixtures|__fixtures__|__snapshots__|testdata|dist|node_modules)\//;
const EXCLUDED_FILE = /\.d\.[cm]?ts$|\.(?:gen|generated)\.[^/]+$/;
const NON_REGULAR_MODES = HashSet.make("120000", "160000");

/**
 * Whether the comment law covers a repository-relative path.
 *
 * **Details**
 *
 * TypeScript and JavaScript under `apps`, `packages`, `infra`, `tools`,
 * `**\/scripts`, `.claude/**\/*.ts` and the repository root are covered.
 * Packets, research, docs, standards, generated, vendored, fixture and
 * declaration files are not: generated files change through their generator.
 *
 * **Example** (Classify paths)
 *
 * ```ts
 * import { isCommentLawPath } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(isCommentLawPath("packages/foo/src/Bar.ts")) // true
 * console.log(isCommentLawPath("packages/foo/src/generated/Bar.ts")) // false
 * console.log(isCommentLawPath("goals/foo/ops/probe.ts")) // false
 * ```
 *
 * @param file - Repository-relative path with `/` separators.
 * @returns `true` when the law covers the file.
 * @category predicates
 * @since 0.0.0
 */
export const isCommentLawPath = (file: string): boolean =>
  SOURCE_EXTENSION.test(file) &&
  INCLUDED.test(file) &&
  !EXCLUDED_ROOT.test(file) &&
  !EXCLUDED_DIR.test(file) &&
  !EXCLUDED_FILE.test(file);

/**
 * Parse one source file and classify every comment in it.
 *
 * **Example** (Classify a small file)
 *
 * ```ts
 * import { scanCommentSource } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * const kinds = scanCommentSource("a.ts", "// note\nexport const x = 1\n").map((comment) => comment.kind)
 *
 * console.log(kinds) // ["prose"]
 * ```
 *
 * @param file - Path the parser uses to pick the dialect (`.tsx`, `.js`, ...).
 * @param text - Full source text.
 * @returns The classified comments in source order.
 * @category utilities
 * @since 0.0.0
 */
export const scanCommentSource: {
  (text: string): (file: string) => ReadonlyArray<ClassifiedComment>;
  (file: string, text: string): ReadonlyArray<ClassifiedComment>;
} = F.dual(2, (file: string, text: string): ReadonlyArray<ClassifiedComment> => {
  if (!Str.includes("//")(text) && !Str.includes("/*")(text)) return [];
  return parseCommentSource({ file, text }).comments;
});

/**
 * Parse one source file once and classify its comments, keeping the program.
 *
 * **Details**
 *
 * `errors` counts the parser diagnostics; the comment strip refuses a file
 * that does not parse cleanly on either side of a deletion.
 *
 * **Example** (Parse a small file)
 *
 * ```ts
 * import { parseCommentSource } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * const parsed = parseCommentSource({ file: "a.ts", text: "// note\nexport const x = 1\n" })
 *
 * console.log(parsed.errors, parsed.comments.length) // 0 1
 * ```
 *
 * @param source - The path the parser uses to pick the dialect, and the full source text.
 * @returns The parsed program, the parser error count and the classified comments.
 * @category utilities
 * @since 0.0.0
 */
export const parseCommentSource = ({ file, text }: { readonly file: string; readonly text: string }) => {
  const parsed = parseSync(file, text, { sourceType: "module" });
  const comments = A.map(parsed.comments, (comment) =>
    SourceComment.make({ type: comment.type, value: comment.value, start: comment.start, end: comment.end })
  );
  return {
    program: parsed.program,
    errors: A.length(parsed.errors),
    comments: classifyComments(CommentGrammarInput.make({ source: text, program: parsed.program, comments })),
  };
};

const bannedOf = (file: string, text: string): ReadonlyArray<ClassifiedComment> =>
  A.filter(scanCommentSource(file, text), (comment) => isBannedCommentKind(comment.kind));

const lineAt = (text: string, offset: number): number =>
  A.length(A.filter(Str.split(Str.slice(0, offset)(text), ""), (character) => character === "\n")) + 1;

const excerptOf = (comment: ClassifiedComment): string =>
  Str.length(comment.text) > 72 ? `${Str.slice(0, 72)(comment.text)}...` : comment.text;

const fingerprintOf = (comment: ClassifiedComment) =>
  Effect.map(sha256Hex(comment.text), (digest) => Str.slice(0, 16)(digest));

const countIn = <K>(counts: HashMap.HashMap<K, number>, key: K): number =>
  O.getOrElse(HashMap.get(counts, key), () => 0);

interface Fingerprinted {
  readonly comment: ClassifiedComment;
  readonly digest: string;
  readonly file: string;
  readonly text: string;
}

interface DeltaState {
  readonly introduced: ReadonlyArray<CommentLawFinding>;
  readonly kept: number;
  readonly pool: HashMap.HashMap<string, number>;
}

const fingerprintsOf = (file: string, side: O.Option<string>) =>
  O.match(side, {
    onNone: () => Effect.succeed(A.empty<Fingerprinted>()),
    onSome: (text) =>
      Effect.forEach(
        bannedOf(file, text),
        (comment) => Effect.map(fingerprintOf(comment), (digest): Fingerprinted => ({ comment, digest, file, text })),
        { concurrency: 1 }
      ),
  });

const fingerprintsAcross = (
  changes: ReadonlyArray<CommentFileChange>,
  side: (change: CommentFileChange) => O.Option<string>
) =>
  Effect.forEach(changes, (change) => fingerprintsOf(change.file, side(change)), { concurrency: 1 }).pipe(
    Effect.map(A.flatten)
  );

const introducedFinding = ({ comment, file, text }: Fingerprinted): CommentLawFinding =>
  CommentLawFinding.make({
    rule: "introduced-comment",
    file,
    line: lineAt(text, comment.start),
    kind: comment.kind,
    excerpt: excerptOf(comment),
  });

const consumeFingerprint = (state: DeltaState, entry: Fingerprinted): DeltaState => {
  const available = countIn(state.pool, entry.digest);
  return available > 0
    ? { ...state, pool: HashMap.set(state.pool, entry.digest, available - 1), kept: state.kept + 1 }
    : { ...state, introduced: A.append(state.introduced, introducedFinding(entry)) };
};

/**
 * Compare banned-comment fingerprints across changed files.
 *
 * **Details**
 *
 * The before multiset is pooled over every changed file, so a comment moved
 * from one file to another passes. Each after comment consumes one matching
 * before fingerprint; the rest are introduced, in file and offset order.
 *
 * **Example** (Flag a new comment)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { commentDelta } from "@beep/repo-cli/commands/Laws/CommentLaw"
 * import { CommentFileChange } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const program = commentDelta([
 *   CommentFileChange.make({ file: "a.ts", before: O.some("export const x = 1\n"), after: O.some("// why\nexport const x = 1\n") }),
 * ])
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param changes - Changed in-scope files with their text on each side.
 * @returns Effect that yields the introduced comments and the removed count.
 * @category utilities
 * @since 0.0.0
 */
export const commentDelta = Effect.fn("CommentLaw.commentDelta")(function* (
  changes: ReadonlyArray<CommentFileChange>
): Effect.fn.Return<CommentDelta, never, Digest.Digest> {
  const before = yield* fingerprintsAcross(changes, (change) => change.before);
  const after = yield* fingerprintsAcross(changes, (change) => change.after);
  const pool = A.reduce(before, HashMap.empty<string, number>(), (counts, entry) =>
    HashMap.set(counts, entry.digest, countIn(counts, entry.digest) + 1)
  );
  const { introduced, kept } = A.reduce(after, { introduced: A.empty(), kept: 0, pool }, consumeFingerprint);
  return CommentDelta.make({ introduced, removed: A.length(before) - kept });
});

const scopeCovers = (roots: ReadonlyArray<string>, shard: CommentLawPending, scope: string, file: string): boolean => {
  const prefix = scopePath(shard.root, scope);
  return (
    packageRootOf(roots, file) === shard.root &&
    (prefix === "." || file === prefix || Str.startsWith(`${prefix}/`)(file))
  );
};

const scopePath = (root: string, scope: string): string =>
  root === "." ? scope : scope === "." ? root : `${root}/${scope}`;

const isCovered = (roots: ReadonlyArray<string>, shards: ReadonlyArray<CommentLawPending>, file: string): boolean =>
  A.some(shards, (shard) => A.some(shard.scopes, (scope) => scopeCovers(roots, shard, scope, file)));

const scopeContains = (outer: string, inner: string): boolean =>
  outer === "." || outer === inner || Str.startsWith(`${outer}/`)(inner);

interface LockVerdict {
  readonly fails: boolean;
  readonly finding: CommentLawFinding;
}

interface ShardScopeContext {
  readonly baseShard: O.Option<CommentLawPending>;
  readonly files: ReadonlyArray<string>;
  readonly input: CommentLockInput;
  readonly shard: CommentLawPending;
  readonly shardChanged: boolean;
}

const lockedFindings = (
  input: CommentLockInput,
  files: ReadonlyArray<string>,
  baseShards: ReadonlyArray<CommentLawPending>
): ReadonlyArray<CommentLawFinding> => {
  const roots = input.packageRoots;
  const newlyLocked = (file: string): boolean =>
    O.isSome(input.baseShards) &&
    isCovered(input.basePackageRoots, baseShards, file) &&
    !isCovered(roots, input.headShards, file);
  return F.pipe(
    files,
    A.filter((file) => countIn(input.bannedCounts, file) > 0),
    A.filter((file) => !isCovered(roots, input.headShards, file)),
    A.filter((file) => input.wholeTree || HashSet.has(input.changedFiles, file) || newlyLocked(file)),
    A.map((file) =>
      CommentLawFinding.make({
        rule: "locked-scope-comment",
        file,
        line: 0,
        excerpt: `${countIn(input.bannedCounts, file)} banned comment(s) in a swept scope`,
      })
    )
  );
};

const staleVerdicts = (context: ShardScopeContext, scope: string): ReadonlyArray<LockVerdict> => {
  const { input, shard } = context;
  const covers = (file: string): boolean => scopeCovers(input.packageRoots, shard, scope, file);
  if (A.some(A.filter(context.files, covers), (file) => countIn(input.bannedCounts, file) > 0)) return [];
  const touched = context.shardChanged || A.some(A.fromIterable(input.changedFiles), covers);
  return [
    {
      fails: !input.wholeTree && touched,
      finding: CommentLawFinding.make({
        rule: "stale-pending-scope",
        file: scopePath(shard.root, scope),
        line: 0,
        excerpt: `${shard.package} scope "${scope}" has no banned comments left; run \`bun run beep laws comments --write\``,
      }),
    },
  ];
};

const grewVerdicts = (context: ShardScopeContext, scope: string): ReadonlyArray<LockVerdict> => {
  const insideBase = O.exists(context.baseShard, (previous) =>
    A.some(previous.scopes, (outer) => scopeContains(outer, scope))
  );
  if (O.isNone(context.input.baseShards) || insideBase) return [];
  return [
    {
      fails: true,
      finding: CommentLawFinding.make({
        rule: "pending-scope-grew",
        file: scopePath(context.shard.root, scope),
        line: 0,
        excerpt: `${context.shard.package} scope "${scope}" is not inside a pending scope on the merge base; the list may only shrink`,
      }),
    },
  ];
};

const movedFrom = (input: CommentLockInput, candidate: CommentLawPending, shard: CommentLawPending): boolean =>
  candidate.package === shard.package &&
  !A.some(input.headShards, (head) => head.root === candidate.root) &&
  !input.bannedCounts.pipe(
    HashMap.keys,
    A.fromIterable,
    A.some((file) => Str.startsWith(`${candidate.root}/`)(file))
  );

const shardVerdicts = (
  input: CommentLockInput,
  files: ReadonlyArray<string>,
  baseShards: ReadonlyArray<CommentLawPending>,
  shard: CommentLawPending
): ReadonlyArray<LockVerdict> => {
  const baseShard = O.orElse(
    A.findFirst(baseShards, (candidate) => candidate.root === shard.root),
    () => A.findFirst(baseShards, (candidate) => movedFrom(input, candidate, shard))
  );
  const shardChanged = O.match(baseShard, {
    onNone: () => true,
    onSome: (previous) => previous.root !== shard.root || A.join(previous.scopes, "\n") !== A.join(shard.scopes, "\n"),
  });
  const context: ShardScopeContext = { baseShard, files, input, shard, shardChanged };
  return A.flatMap(shard.scopes, (scope) => A.appendAll(staleVerdicts(context, scope), grewVerdicts(context, scope)));
};

const findingsWhere = (verdicts: ReadonlyArray<LockVerdict>, fails: boolean): ReadonlyArray<CommentLawFinding> =>
  A.map(
    A.filter(verdicts, (verdict) => verdict.fails === fails),
    (verdict) => verdict.finding
  );

/**
 * Evaluate the pending-scope lock.
 *
 * **Details**
 *
 * A file no shard covers must hold zero banned comments. A listed scope that
 * holds none is stale: it fails when the change touched it, and is advisory
 * otherwise, so two sweeps that together empty a scope do not red main. A
 * head scope must sit inside a scope of the same root on the merge base.
 *
 * **Example** (Lock a clean tree)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { evaluateCommentLock } from "@beep/repo-cli/commands/Laws/CommentLaw"
 * import { CommentLockInput } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const result = evaluateCommentLock(
 *   CommentLockInput.make({
 *     headShards: [],
 *     baseShards: O.some([]),
 *     packageRoots: ["packages/x"],
 *     basePackageRoots: ["packages/x"],
 *     bannedCounts: HashMap.make(["packages/x/src/A.ts", 0]),
 *     changedFiles: HashSet.empty(),
 *     wholeTree: true,
 *   })
 * )
 *
 * console.log(result.findings.length) // 0
 * ```
 *
 * @param input - Shards on both sides, banned counts and change scope.
 * @returns The failing findings and the advisories.
 * @category utilities
 * @since 0.0.0
 */
export const evaluateCommentLock = (input: CommentLockInput): CommentLockResult => {
  const baseShards = O.getOrElse(input.baseShards, A.empty<CommentLawPending>);
  const files = A.sort(HashMap.keys(input.bannedCounts), Order.String);
  const verdicts = A.flatMap(input.headShards, (shard) => shardVerdicts(input, files, baseShards, shard));
  return CommentLockResult.make({
    findings: A.appendAll(lockedFindings(input, files, baseShards), findingsWhere(verdicts, true)),
    advisories: findingsWhere(verdicts, false),
  });
};

type CommentLawServices =
  | Digest.Digest
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Git;

const mapGit = <A, R>(
  command: GitInvocation,
  effect: Effect.Effect<A, GitKitError, R>
): Effect.Effect<A, CommentLawExecutionError, R> =>
  effect.pipe(Effect.mapError(adaptGitKitError(command, messageGitErrorAdapter(CommentLawExecutionError.new))));

const decodeShard = (path: string, text: string) =>
  Jsonc.bind(CommentLawPending)
    .decode(text)
    .pipe(CommentLawExecutionError.mapError(`Failed to decode ${path}`));

const decodePolicy = (text: string) =>
  Jsonc.bind(CommentLawPolicy)
    .decode(text)
    .pipe(CommentLawExecutionError.mapError(`Failed to decode ${COMMENT_LAW_POLICY_PATH}`));

const isShardFile = (name: string): boolean => Str.endsWith(".jsonc")(name);

const readWorktreeText = Effect.fn("CommentLaw.readWorktreeText")(function* (repoRoot: string, file: string) {
  const fs = yield* FileSystem.FileSystem;
  const absolute = `${repoRoot}/${file}`;
  const exists = yield* fs.exists(absolute).pipe(CommentLawExecutionError.mapError(`Failed to stat ${file}`));
  if (!exists) return O.none<string>();
  const text = yield* fs.readFileString(absolute).pipe(CommentLawExecutionError.mapError(`Failed to read ${file}`));
  return O.some(text);
});

const readPolicy = Effect.fn("CommentLaw.readPolicy")(function* (repoRoot: string) {
  const text = yield* readWorktreeText(repoRoot, COMMENT_LAW_POLICY_PATH);
  if (O.isNone(text)) return yield* CommentLawExecutionError.new(`${COMMENT_LAW_POLICY_PATH} is missing.`);
  return yield* decodePolicy(text.value);
});

interface WorktreeShard {
  readonly name: string;
  readonly shard: CommentLawPending;
}

const readWorktreeShards = Effect.fn("CommentLaw.readWorktreeShards")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = `${repoRoot}/${COMMENT_LAW_PENDING_DIR}`;
  const exists = yield* fs
    .exists(directory)
    .pipe(CommentLawExecutionError.mapError(`Failed to stat ${COMMENT_LAW_PENDING_DIR}`));
  if (!exists) return A.empty<WorktreeShard>();
  const names = yield* fs
    .readDirectory(directory)
    .pipe(CommentLawExecutionError.mapError(`Failed to list ${COMMENT_LAW_PENDING_DIR}`));
  return yield* Effect.forEach(
    A.sort(A.filter(names, isShardFile), Order.String),
    (name) =>
      Effect.flatMap(
        fs
          .readFileString(`${directory}/${name}`)
          .pipe(CommentLawExecutionError.mapError(`Failed to read ${COMMENT_LAW_PENDING_DIR}/${name}`)),
        (text) =>
          Effect.map(
            decodeShard(`${COMMENT_LAW_PENDING_DIR}/${name}`, text),
            (shard): WorktreeShard => ({ name, shard })
          )
      ),
    { concurrency: 1 }
  );
});

const readBaseShards = Effect.fn("CommentLaw.readBaseShards")(function* (repoRoot: string, base: string) {
  const git = yield* Git;
  const policy = yield* mapGit(
    GitCommand.show(base, COMMENT_LAW_POLICY_PATH),
    git.show(repoRoot, base, COMMENT_LAW_POLICY_PATH)
  );
  if (O.isNone(policy)) return O.none<ReadonlyArray<CommentLawPending>>();
  const entries = yield* mapGit(
    GitCommand.lsTree(base, [`${COMMENT_LAW_PENDING_DIR}/`]),
    git.lsTree(repoRoot, base, { pathspec: [`${COMMENT_LAW_PENDING_DIR}/`] })
  );
  const paths = A.filter(
    A.map(
      A.filter(entries, (entry) => entry.type === "blob"),
      (entry) => entry.path
    ),
    isShardFile
  );
  const shards = yield* Effect.forEach(
    A.sort(paths, Order.String),
    (path) =>
      Effect.flatMap(mapGit(GitCommand.show(base, path), git.show(repoRoot, base, path)), (text) =>
        Effect.transposeOption(O.map(text, (value) => decodeShard(path, value)))
      ),
    { concurrency: 8 }
  );
  return O.some(A.getSomes(shards));
});

const basePackageRoots = Effect.fn("CommentLaw.basePackageRoots")(function* (repoRoot: string, base: string) {
  const git = yield* Git;
  const entries = yield* mapGit(GitCommand.lsTree(base, [], true), git.lsTree(repoRoot, base, { fullTree: true }));
  return packageRootsOf(
    A.map(
      A.filter(entries, (entry) => entry.type === "blob"),
      (entry) => entry.path
    )
  );
});

/**
 * List the files the comment law covers, the package roots and the tracked paths.
 *
 * **Details**
 *
 * `files` holds the tracked regular files and untracked paths the law
 * covers, and `roots` every package directory with a `package.json` in the
 * enforced zones. A tracked symlink (`120000`) or gitlink (`160000`) is not
 * a covered file.
 *
 * **Example** (List the covered files)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { commentLawFiles } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(Effect.isEffect(commentLawFiles(process.cwd()))) // true
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @returns Effect that yields the covered files and package roots, each sorted.
 * @category utilities
 * @since 0.0.0
 */
export const commentLawFiles = Effect.fn("CommentLaw.commentLawFiles")(function* (repoRoot: string) {
  const git = yield* Git;
  const tracked = yield* mapGit(GitCommand.lsFiles(), git.lsFiles(repoRoot));
  const untracked = yield* mapGit(GitCommand.untrackedFiles(), git.untrackedFiles(repoRoot));
  const regular = A.map(
    A.filter(tracked, (entry) => !HashSet.has(NON_REGULAR_MODES, entry.mode)),
    (entry) => entry.path
  );
  const all = A.dedupe(
    A.appendAll(
      A.map(tracked, (entry) => entry.path),
      untracked
    )
  );
  return {
    files: A.sort(A.filter(A.dedupe(A.appendAll(regular, untracked)), isCommentLawPath), Order.String),
    roots: packageRootsOf(all),
  };
});

const packageRootsOf = (files: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(
    A.filterMap(files, (file) =>
      Str.endsWith("/package.json")(file) &&
      INCLUDED.test(file) &&
      !EXCLUDED_ROOT.test(file) &&
      !EXCLUDED_DIR.test(file)
        ? Result.succeed(Str.slice(0, -Str.length("/package.json"))(file))
        : Result.failVoid
    ),
    Order.String
  );

const packageRootOf = (roots: ReadonlyArray<string>, file: string): string =>
  O.getOrElse(
    A.findLast(roots, (root) => Str.startsWith(`${root}/`)(file)),
    () => "."
  );

/**
 * Package root that owns a file: the longest root that contains it, or `.`.
 *
 * **Example** (Find the owning package)
 *
 * ```ts
 * import { commentPackageRootOf } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(commentPackageRootOf(["packages/a"], "packages/a/src/A.ts")) // "packages/a"
 * console.log(commentPackageRootOf(["packages/a"], "tools/x.ts")) // "."
 * ```
 *
 * @param roots - Package directories, repository-relative and sorted.
 * @param file - Repository-relative file path.
 * @returns The owning root, or `.` for a file in no package.
 * @category utilities
 * @since 0.0.0
 */
export const commentPackageRootOf: {
  (file: string): (roots: ReadonlyArray<string>) => string;
  (roots: ReadonlyArray<string>, file: string): string;
} = F.dual(2, packageRootOf);

const bannedCountsOf = Effect.fn("CommentLaw.bannedCountsOf")(function* (
  repoRoot: string,
  files: ReadonlyArray<string>
) {
  let counts = HashMap.empty<string, number>();
  for (const file of files) {
    const text = yield* readWorktreeText(repoRoot, file);
    if (O.isNone(text)) continue;
    counts = HashMap.set(counts, file, A.length(bannedOf(file, text.value)));
  }
  return counts;
});

const prefetchBlobs = Effect.fn("CommentLaw.prefetchBlobs")(function* (
  repoRoot: string,
  base: string,
  paths: ReadonlyArray<string>
) {
  const git = yield* Git;
  const partial = yield* mapGit(
    GitCommand.configGet("remote.origin.promisor"),
    git.configGet(repoRoot, "remote.origin.promisor")
  );
  if (A.isReadonlyArrayEmpty(paths) || !O.exists(partial, (value) => value === "true")) return;
  const options = { base, noRenames: true, unified: 0, pathspec: paths };
  yield* mapGit(GitCommand.diffPatch(options), Effect.asVoid(git.diffPatch(repoRoot, options))).pipe(
    Effect.catchTag("CommentLawExecutionError", (error) =>
      Console.log(`[comment-law] advisory: blob prefetch failed, reading each file on demand (${error.message})`)
    )
  );
});

const readBaseText = Effect.fn("CommentLaw.readBaseText")(function* (repoRoot: string, base: string, file: string) {
  const git = yield* Git;
  const text = yield* git
    .show(repoRoot, base, file)
    .pipe(CommentLawExecutionError.mapError(`Failed to read ${file} at ${base}; the comment law never skips`));
  if (O.isNone(text))
    return yield* CommentLawExecutionError.new(`${file} is missing at ${base}; the comment law never skips`);
  return text;
});

const changesAgainst = Effect.fn("CommentLaw.changesAgainst")(function* (
  repoRoot: string,
  base: string,
  staged: boolean
) {
  const git = yield* Git;
  if (staged) {
    const staged = yield* mapGit(GitCommand.stagedChanges(), git.stagedChanges(repoRoot, { noRenames: true }));
    return yield* Effect.forEach(
      A.filter(staged, isCommentLawPath),
      (file) =>
        Effect.all(
          {
            before: mapGit(GitCommand.show("HEAD", file), git.show(repoRoot, "HEAD", file)),
            after: mapGit(GitCommand.show("", file), git.show(repoRoot, "", file)),
          },
          { concurrency: 2 }
        ).pipe(Effect.map(({ before, after }) => CommentFileChange.make({ file, before, after }))),
      { concurrency: 8 }
    );
  }
  const entries = yield* mapGit(
    GitCommand.nameStatus(base, undefined),
    git.nameStatus(repoRoot, { base, noRenames: true })
  );
  const untrackedAll = yield* mapGit(GitCommand.untrackedFiles(), git.untrackedFiles(repoRoot));
  const untracked = A.filter(untrackedAll, isCommentLawPath);
  const changed = A.filter(entries, (entry) => isCommentLawPath(entry.path));
  const existing = A.filter(changed, (entry) => entry.status !== "added");
  yield* prefetchBlobs(
    repoRoot,
    base,
    A.map(existing, (entry) => entry.path)
  );
  const tracked = yield* Effect.forEach(
    changed,
    (entry) =>
      Effect.all(
        {
          before:
            entry.status === "added" ? Effect.succeed(O.none<string>()) : readBaseText(repoRoot, base, entry.path),
          after: readWorktreeText(repoRoot, entry.path),
        },
        { concurrency: 2 }
      ).pipe(Effect.map(({ before, after }) => CommentFileChange.make({ file: entry.path, before, after }))),
    { concurrency: 8 }
  );
  const added = yield* Effect.forEach(
    untracked,
    (file) =>
      Effect.map(readWorktreeText(repoRoot, file), (after) =>
        CommentFileChange.make({ file, before: O.none(), after })
      ),
    { concurrency: 8 }
  );
  return A.appendAll(tracked, added);
});

const lockFor = Effect.fn("CommentLaw.lockFor")(function* (
  repoRoot: string,
  base: string,
  wholeTree: boolean,
  changes: ReadonlyArray<CommentFileChange>
) {
  const { files, roots } = yield* commentLawFiles(repoRoot);
  const headFiles = yield* readWorktreeShards(repoRoot);
  const headShards = A.map(headFiles, (entry) => entry.shard);
  const baseShards = yield* readBaseShards(repoRoot, base);
  const baseRoots = O.isSome(baseShards) ? yield* basePackageRoots(repoRoot, base) : A.empty<string>();
  const bannedCounts = yield* bannedCountsOf(repoRoot, files);
  return evaluateCommentLock(
    CommentLockInput.make({
      headShards,
      baseShards,
      packageRoots: roots,
      basePackageRoots: baseRoots,
      bannedCounts,
      changedFiles: HashSet.fromIterable(A.map(changes, (change) => change.file)),
      wholeTree,
    })
  );
});

const DATED_DECISION = /^\d{4}-\d{2}-\d{2}-/;
const DECISION_PREFIX = "decision: ";

const decisionNamesIn = Effect.fn("CommentLaw.decisionNamesIn")(function* (repoRoot: string, directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(`${repoRoot}/${directory}`)
    .pipe(CommentLawExecutionError.mapError(`Failed to stat ${directory}`));
  if (!exists) return A.empty<string>();
  return yield* fs
    .readDirectory(`${repoRoot}/${directory}`)
    .pipe(CommentLawExecutionError.mapError(`Failed to list ${directory}`));
});

const namesDecision = (slug: string) => (name: string) =>
  name === `${slug}.md` || (DATED_DECISION.test(name) && Str.slice(11)(name) === `${slug}.md`);

const isRegularFile = Effect.fn("CommentLaw.isRegularFile")(function* (repoRoot: string, file: string) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(`${repoRoot}/${file}`).pipe(CommentLawExecutionError.mapError(`Failed to stat ${file}`));
  return info.type === "File";
});

interface PointerSite {
  readonly comment: ClassifiedComment;
  readonly file: string;
  readonly text: string;
}

const pointersIn = (change: CommentFileChange): ReadonlyArray<PointerSite> =>
  O.match(change.after, {
    onNone: A.empty<PointerSite>,
    onSome: (text) =>
      A.map(
        A.filter(scanCommentSource(change.file, text), (comment) => comment.kind === "decision-pointer"),
        (comment): PointerSite => ({ comment, file: change.file, text })
      ),
  });

const danglingPointers = Effect.fn("CommentLaw.danglingPointers")(function* (
  repoRoot: string,
  changes: ReadonlyArray<CommentFileChange>
) {
  const pointers = A.flatMap(changes, pointersIn);
  if (A.isReadonlyArrayEmpty(pointers)) return A.empty<CommentLawFinding>();
  const { roots } = yield* commentLawFiles(repoRoot);
  let findings = A.empty<CommentLawFinding>();
  for (const { comment, file, text } of pointers) {
    const root = packageRootOf(roots, file);
    const directory = root === "." ? "decisions" : `${root}/decisions`;
    const slug = Str.slice(Str.length(DECISION_PREFIX))(comment.text);
    const listed = yield* decisionNamesIn(repoRoot, directory);
    const names = A.filter(listed, namesDecision(slug));
    const recorded = yield* Effect.forEach(names, (name) => isRegularFile(repoRoot, `${directory}/${name}`), {
      concurrency: 1,
    });
    if (A.some(recorded, F.identity)) continue;
    findings = A.append(
      findings,
      CommentLawFinding.make({
        rule: "dangling-decision-pointer",
        file,
        line: lineAt(text, comment.start),
        kind: comment.kind,
        excerpt: `no ${directory}/<date>-${slug}.md records this decision`,
      })
    );
  }
  return findings;
});

/**
 * Run the comment law: the growth check against the merge base and the pending-scope lock.
 *
 * **Details**
 *
 * The base ref is resolved to its merge base with `HEAD`; an unresolvable
 * base fails, it never skips. With `push` (the CI caller sets it on a push
 * event only) the base is `HEAD`, skipping the landed growth delta. With no
 * changes the lock judges the whole tree. Without it the delta is always the
 * merge base, even when that is
 * `HEAD` itself. A `// decision: <slug>` line in a changed file must name a file
 * under its owning package's `decisions/` directory. With
 * `staged`, the index is compared with `HEAD` and the lock is skipped.
 * Findings fail the run only when the policy is `blocking`.
 *
 * **Example** (Check the working tree)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runCommentLaw } from "@beep/repo-cli/commands/Laws/CommentLaw"
 * import { CommentLawOptions } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const program = runCommentLaw(CommentLawOptions.make({ cwd: process.cwd(), base: "origin/main" }))
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location, base ref and staged mode.
 * @returns Effect that yields the check summary.
 * @category utilities
 * @since 0.0.0
 */
export const runCommentLaw = Effect.fn("CommentLaw.runCommentLaw")(function* (
  options: CommentLawOptions
): Effect.fn.Return<CommentLawSummary, CommentLawExecutionError, CommentLawServices> {
  const git = yield* Git;
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(
    CommentLawExecutionError.mapError("Failed to locate the repository root")
  );
  const policy = yield* readPolicy(repoRoot);
  const head = yield* mapGit(GitCommand.revParse("HEAD"), git.revParse(repoRoot, "HEAD"));
  const atHead = options.staged || options.push;
  const requested = atHead ? "HEAD" : O.getOrElse(O.fromUndefinedOr(options.base), () => "origin/main");
  const mergeBase = atHead
    ? O.some(head)
    : yield* mapGit(GitCommand.mergeBase(requested, "HEAD"), git.mergeBaseOption(repoRoot, requested, "HEAD"));
  const base = O.getOrElse(mergeBase, () => "");
  if (Str.isEmpty(base))
    return yield* CommentLawExecutionError.new(
      `No merge base between ${requested} and HEAD; the comment law never skips.`
    );
  const pushed = !options.staged && options.push;
  const changes = yield* changesAgainst(repoRoot, base, options.staged);
  const delta = yield* commentDelta(changes);
  const pointers = yield* danglingPointers(repoRoot, changes);
  const lock = options.staged
    ? CommentLockResult.make({ findings: [], advisories: [] })
    : yield* lockFor(repoRoot, base, pushed && A.isReadonlyArrayEmpty(changes), changes);
  const findings = A.appendAll(A.appendAll(delta.introduced, pointers), lock.findings);
  return CommentLawSummary.make({
    enforcement: policy.enforcement,
    base,
    changedFiles: A.length(changes),
    introduced: A.length(delta.introduced),
    removed: delta.removed,
    failed: policy.enforcement === "blocking" && A.isReadonlyArrayNonEmpty(findings),
    findings,
    advisories: lock.advisories,
  });
});

/**
 * Count every comment in the tree by package root and kind.
 *
 * **Example** (Build a census)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runCommentCensus } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(Effect.isEffect(runCommentCensus(process.cwd()))) // true
 * ```
 *
 * @param cwd - Any directory inside the repository.
 * @returns Effect that yields one row per root and kind with a non-zero count.
 * @category utilities
 * @since 0.0.0
 */
export const runCommentCensus = Effect.fn("CommentLaw.runCommentCensus")(function* (
  cwd: string
): Effect.fn.Return<ReadonlyArray<CommentCensusRow>, CommentLawExecutionError, CommentLawServices> {
  const repoRoot = yield* findRepoRoot(cwd).pipe(
    CommentLawExecutionError.mapError("Failed to locate the repository root")
  );
  const { files, roots } = yield* commentLawFiles(repoRoot);
  let rows = HashMap.empty<string, CommentCensusRow>();
  for (const file of files) {
    const text = yield* readWorktreeText(repoRoot, file);
    if (O.isNone(text)) continue;
    const root = packageRootOf(roots, file);
    for (const comment of scanCommentSource(file, text.value)) {
      const key = `${root}\u0000${comment.kind}`;
      const count = O.match(HashMap.get(rows, key), { onNone: () => 1, onSome: (row) => row.count + 1 });
      rows = HashMap.set(rows, key, CommentCensusRow.make({ root, kind: comment.kind, count }));
    }
  }
  return F.pipe(
    A.fromIterable(rows),
    A.sort(Order.mapInput(Order.String, ([key]: readonly [string, CommentCensusRow]) => key)),
    A.map(([, row]) => row)
  );
});

/**
 * Normalize a repository-relative scope the way `--list` and `--ledger` read it.
 *
 * **Details**
 *
 * A leading `./` and trailing slashes are dropped; an empty scope is `.`,
 * the whole repository.
 *
 * **Example** (Normalize scopes)
 *
 * ```ts
 * import { commentScopeOf } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(commentScopeOf("./packages/a/")) // "packages/a"
 * console.log(commentScopeOf("")) // "."
 * ```
 *
 * @param prefix - Repository-relative directory or file as the operator typed it.
 * @returns The scope with `./` and trailing slashes removed, or `.`.
 * @category utilities
 * @since 0.0.0
 */
export const commentScopeOf = (prefix: string): string => {
  const scope = Str.replace(/\/+$/, "")(Str.replace(/^(?:\.\/)+/, "")(prefix));
  return Str.isEmpty(scope) ? "." : scope;
};

/**
 * Whether a repository-relative file sits inside a normalized comment scope.
 *
 * **Example** (Test scope membership)
 *
 * ```ts
 * import { isInCommentScope } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(isInCommentScope("packages/a", "packages/a/src/A.ts")) // true
 * console.log(isInCommentScope("packages/a", "packages/ab/src/A.ts")) // false
 * console.log(isInCommentScope(".", "packages/ab/src/A.ts")) // true
 * ```
 *
 * @param scope - A scope from {@link commentScopeOf}.
 * @param file - Repository-relative file path.
 * @returns `true` when the scope is `.`, the file itself or a directory above it.
 * @category predicates
 * @since 0.0.0
 */
export const isInCommentScope: {
  (file: string): (scope: string) => boolean;
  (scope: string, file: string): boolean;
} = F.dual(
  2,
  (scope: string, file: string): boolean => scope === "." || file === scope || Str.startsWith(`${scope}/`)(file)
);

/**
 * Worklist of banned comments under one path prefix, for a sweep.
 *
 * **Example** (List one package)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runCommentList } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(Effect.isEffect(runCommentList(process.cwd(), "packages/foundation/modeling/csv"))) // true
 * ```
 *
 * @param cwd - Any directory inside the repository.
 * @param prefix - Repository-relative directory or file; `.` lists the whole repository.
 * @returns Effect that yields one finding per banned comment, in file order.
 * @category utilities
 * @since 0.0.0
 */
export const runCommentList = Effect.fn("CommentLaw.runCommentList")(function* (
  cwd: string,
  prefix: string
): Effect.fn.Return<ReadonlyArray<CommentLawFinding>, CommentLawExecutionError, CommentLawServices> {
  const repoRoot = yield* findRepoRoot(cwd).pipe(
    CommentLawExecutionError.mapError("Failed to locate the repository root")
  );
  const { files } = yield* commentLawFiles(repoRoot);
  const scope = commentScopeOf(prefix);
  const scoped = A.filter(files, (file) => isInCommentScope(scope, file));
  let findings = A.empty<CommentLawFinding>();
  for (const file of scoped) {
    const text = yield* readWorktreeText(repoRoot, file);
    if (O.isNone(text)) continue;
    for (const comment of bannedOf(file, text.value))
      findings = A.append(
        findings,
        CommentLawFinding.make({
          rule: "locked-scope-comment",
          file,
          line: lineAt(text.value, comment.start),
          kind: comment.kind,
          excerpt: excerptOf(comment),
        })
      );
  }
  return findings;
});

const shardFileName = (shard: CommentLawPending): string =>
  shard.root === "." ? "_root.jsonc" : `${Str.replaceAll("/", "-")(Str.replace(/^@/, "")(shard.package))}.jsonc`;

/**
 * Seed or prune the pending shards.
 *
 * **Details**
 *
 * With no shard on disk, one shard is written for every package root that
 * holds a banned comment, listing the whole root; loose files outside any
 * package go to `_root.jsonc`, one scope per top-level entry. Otherwise each
 * scope with zero banned comments is removed and an emptied shard is
 * deleted. A write never adds a scope to an existing list.
 *
 * **Example** (Prune the shards)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runCommentLawWrite } from "@beep/repo-cli/commands/Laws/CommentLaw"
 *
 * console.log(Effect.isEffect(runCommentLawWrite(process.cwd()))) // true
 * ```
 *
 * @param cwd - Any directory inside the repository.
 * @returns Effect that yields the shards left on disk.
 * @category utilities
 * @since 0.0.0
 */
export const runCommentLawWrite = Effect.fn("CommentLaw.runCommentLawWrite")(function* (
  cwd: string
): Effect.fn.Return<ReadonlyArray<CommentLawPending>, CommentLawExecutionError, CommentLawServices> {
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = yield* findRepoRoot(cwd).pipe(
    CommentLawExecutionError.mapError("Failed to locate the repository root")
  );
  const { files, roots } = yield* commentLawFiles(repoRoot);
  const counts = yield* bannedCountsOf(repoRoot, files);
  const currentFiles = yield* readWorktreeShards(repoRoot);
  const names = yield* packageNamesOf(repoRoot, roots);
  const bannedFiles = A.filter(files, (file) => O.getOrElse(HashMap.get(counts, file), () => 0) > 0);
  const next: ReadonlyArray<WorktreeShard> = A.isReadonlyArrayEmpty(currentFiles)
    ? A.map(seedShards(roots, names, bannedFiles), (shard): WorktreeShard => ({ name: shardFileName(shard), shard }))
    : A.getSomes(
        A.map(currentFiles, ({ name, shard }) =>
          O.map(
            O.liftPredicate(A.isReadonlyArrayNonEmpty<string>)(
              A.filter(shard.scopes, (scope) => A.some(bannedFiles, (file) => scopeCovers(roots, shard, scope, file)))
            ),
            (scopes): WorktreeShard => ({ name, shard: CommentLawPending.make({ ...shard, scopes }) })
          )
        )
      );
  const directory = `${repoRoot}/${COMMENT_LAW_PENDING_DIR}`;
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(CommentLawExecutionError.mapError(`Failed to create ${COMMENT_LAW_PENDING_DIR}`));
  const keep = HashSet.fromIterable(A.map(next, (entry) => entry.name));
  for (const { name } of currentFiles) {
    if (!HashSet.has(keep, name))
      yield* fs.remove(`${directory}/${name}`).pipe(CommentLawExecutionError.mapError(`Failed to remove ${name}`));
  }
  const unchanged = HashSet.fromIterable(
    A.map(currentFiles, ({ name, shard }) => `${name}\u0000${shard.root}\u0000${A.join(shard.scopes, "\u0000")}`)
  );
  for (const { name, shard } of next) {
    if (HashSet.has(unchanged, `${name}\u0000${shard.root}\u0000${A.join(shard.scopes, "\u0000")}`)) continue;
    const text = yield* formatJsonc(shard).pipe(CommentLawExecutionError.mapError(`Failed to encode ${name}`));
    yield* fs
      .writeFileString(`${directory}/${name}`, text)
      .pipe(CommentLawExecutionError.mapError(`Failed to write ${name}`));
  }
  return A.map(next, (entry) => entry.shard);
});

const packageNamesOf = Effect.fn("CommentLaw.packageNamesOf")(function* (
  repoRoot: string,
  roots: ReadonlyArray<string>
) {
  let names = HashMap.empty<string, string>();
  for (const root of roots) {
    const text = yield* readWorktreeText(repoRoot, `${root}/package.json`);
    const name = O.flatMap(text, (value) => O.fromNullishOr(/"name"\s*:\s*"([^"]+)"/.exec(value)?.[1]));
    names = HashMap.set(
      names,
      root,
      O.getOrElse(name, () => root)
    );
  }
  return names;
});

const seedShards = (
  roots: ReadonlyArray<string>,
  names: HashMap.HashMap<string, string>,
  bannedFiles: ReadonlyArray<string>
): ReadonlyArray<CommentLawPending> => {
  const owners = A.dedupe(A.map(bannedFiles, (file) => packageRootOf(roots, file)));
  return A.getSomes(
    A.map(A.sort(owners, Order.String), (root) => {
      if (root !== ".")
        return O.flatMap(HashMap.get(names, root), (name) =>
          CommentLawPending.makeOption({ schemaVersion: "comment-law-pending/v1", package: name, root, scopes: ["."] })
        );
      const loose = A.dedupe(
        A.map(
          A.filter(bannedFiles, (file) => packageRootOf(roots, file) === "."),
          (file) => A.headNonEmpty(Str.split(file, "/"))
        )
      );
      return O.map(O.liftPredicate(A.isReadonlyArrayNonEmpty<string>)(A.sort(loose, Order.String)), (scopes) =>
        CommentLawPending.make({ schemaVersion: "comment-law-pending/v1", package: "(root)", root: ".", scopes })
      );
    })
  );
};
