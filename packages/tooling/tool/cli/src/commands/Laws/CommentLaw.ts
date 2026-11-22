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
import type { ClassifiedComment, CommentKind } from "@beep/lint-rules/comment-grammar";
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
  const parsed = parseSync(file, text, { sourceType: "module" });
  const comments = A.map(parsed.comments, (comment) =>
    SourceComment.make({ type: comment.type, value: comment.value, start: comment.start, end: comment.end })
  );
  return classifyComments(CommentGrammarInput.make({ source: text, program: parsed.program, comments }));
});

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

const scopeCovers = (shard: CommentLawPending, scope: string, file: string): boolean => {
  const prefix = scopePath(shard.root, scope);
  return prefix === "." || file === prefix || Str.startsWith(`${prefix}/`)(file);
};

const scopePath = (root: string, scope: string): string =>
  root === "." ? scope : scope === "." ? root : `${root}/${scope}`;

const isCovered = (shards: ReadonlyArray<CommentLawPending>, file: string): boolean =>
  A.some(shards, (shard) => A.some(shard.scopes, (scope) => scopeCovers(shard, scope, file)));

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
  const newlyLocked = (file: string): boolean =>
    O.isSome(input.baseShards) && isCovered(baseShards, file) && !isCovered(input.headShards, file);
  return F.pipe(
    files,
    A.filter((file) => countIn(input.bannedCounts, file) > 0),
    A.filter((file) => !isCovered(input.headShards, file)),
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
  const covered = A.filter(context.files, (file) => scopeCovers(shard, scope, file));
  if (A.some(covered, (file) => countIn(input.bannedCounts, file) > 0)) return [];
  const touched = context.shardChanged || A.some(covered, (file) => HashSet.has(input.changedFiles, file));
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
  !A.some(A.fromIterable(HashMap.keys(input.bannedCounts)), (file) => Str.startsWith(`${candidate.root}/`)(file));

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

const readWorktreeShards = Effect.fn("CommentLaw.readWorktreeShards")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = `${repoRoot}/${COMMENT_LAW_PENDING_DIR}`;
  const exists = yield* fs
    .exists(directory)
    .pipe(CommentLawExecutionError.mapError(`Failed to stat ${COMMENT_LAW_PENDING_DIR}`));
  if (!exists) return A.empty<CommentLawPending>();
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
        (text) => decodeShard(`${COMMENT_LAW_PENDING_DIR}/${name}`, text)
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
        O.match(text, {
          onNone: () => Effect.succeed(O.none<CommentLawPending>()),
          onSome: (value) => Effect.asSome(decodeShard(path, value)),
        })
      ),
    { concurrency: 8 }
  );
  return O.some(A.getSomes(shards));
});

const lawFiles = Effect.fn("CommentLaw.lawFiles")(function* (repoRoot: string) {
  const git = yield* Git;
  const tracked = yield* mapGit(GitCommand.lsFiles(), git.lsFiles(repoRoot));
  const untracked = yield* mapGit(GitCommand.untrackedFiles(), git.untrackedFiles(repoRoot));
  const all = A.dedupe(
    A.appendAll(
      A.map(tracked, (entry) => entry.path),
      untracked
    )
  );
  return {
    files: A.sort(A.filter(all, isCommentLawPath), Order.String),
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
  F.pipe(
    roots,
    A.filter((root) => Str.startsWith(`${root}/`)(file)),
    A.reduce(".", (best, root) => (Str.length(root) > Str.length(best) || best === "." ? root : best))
  );

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
  yield* mapGit(GitCommand.diffPatch(options), Effect.asVoid(git.diffPatch(repoRoot, options)));
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
            entry.status === "added"
              ? Effect.succeed(O.none<string>())
              : mapGit(GitCommand.show(base, entry.path), git.show(repoRoot, base, entry.path)),
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
  head: string,
  changes: ReadonlyArray<CommentFileChange>
) {
  const { files } = yield* lawFiles(repoRoot);
  const headShards = yield* readWorktreeShards(repoRoot);
  const baseShards = yield* readBaseShards(repoRoot, base);
  const bannedCounts = yield* bannedCountsOf(repoRoot, files);
  return evaluateCommentLock(
    CommentLockInput.make({
      headShards,
      baseShards,
      bannedCounts,
      changedFiles: HashSet.fromIterable(A.map(changes, (change) => change.file)),
      wholeTree: base === head && A.isReadonlyArrayEmpty(changes),
    })
  );
});

/**
 * Run the comment law: the growth check against the merge base and the pending-scope lock.
 *
 * **Details**
 *
 * The base ref is resolved to its merge base with `HEAD`; an unresolvable
 * base fails, it never skips. When the merge base is `HEAD` itself (a push
 * run) the delta is empty and the lock judges the whole tree. With
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
  const requested = options.staged ? "HEAD" : O.getOrElse(O.fromUndefinedOr(options.base), () => "origin/main");
  const mergeBase = options.staged
    ? O.some(head)
    : yield* mapGit(GitCommand.mergeBase(requested, "HEAD"), git.mergeBaseOption(repoRoot, requested, "HEAD"));
  const base = O.getOrElse(mergeBase, () => "");
  if (Str.isEmpty(base))
    return yield* CommentLawExecutionError.new(
      `No merge base between ${requested} and HEAD; the comment law never skips.`
    );
  const changes = yield* changesAgainst(repoRoot, base, options.staged);
  const delta = yield* commentDelta(changes);
  const lock = options.staged
    ? CommentLockResult.make({ findings: [], advisories: [] })
    : yield* lockFor(repoRoot, base, head, changes);
  const findings = A.appendAll(delta.introduced, lock.findings);
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
  const { files, roots } = yield* lawFiles(repoRoot);
  let counts = HashMap.empty<string, number>();
  for (const file of files) {
    const text = yield* readWorktreeText(repoRoot, file);
    if (O.isNone(text)) continue;
    const root = packageRootOf(roots, file);
    for (const comment of scanCommentSource(file, text.value)) {
      const key = `${root}\u0000${comment.kind}`;
      counts = HashMap.set(counts, key, O.getOrElse(HashMap.get(counts, key), () => 0) + 1);
    }
  }
  return F.pipe(
    A.fromIterable(counts),
    A.sort(Order.mapInput(Order.String, ([key]: readonly [string, number]) => key)),
    A.map(([key, count]) => {
      const [root = ".", kind = "prose"] = Str.split(key, "\u0000");
      return CommentCensusRow.make({ root, kind: kind as CommentKind, count });
    })
  );
});

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
 * @param prefix - Repository-relative directory or file.
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
  const { files } = yield* lawFiles(repoRoot);
  const scoped = A.filter(
    files,
    (file) => file === prefix || Str.startsWith(`${Str.replace(/\/$/, "")(prefix)}/`)(file)
  );
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
  const { files, roots } = yield* lawFiles(repoRoot);
  const counts = yield* bannedCountsOf(repoRoot, files);
  const current = yield* readWorktreeShards(repoRoot);
  const names = yield* packageNamesOf(repoRoot, roots);
  const bannedFiles = A.filter(files, (file) => O.getOrElse(HashMap.get(counts, file), () => 0) > 0);
  const next = A.isReadonlyArrayEmpty(current)
    ? seedShards(roots, names, bannedFiles)
    : A.getSomes(
        A.map(current, (shard) =>
          O.map(
            O.liftPredicate(A.isReadonlyArrayNonEmpty<string>)(
              A.filter(shard.scopes, (scope) => A.some(bannedFiles, (file) => scopeCovers(shard, scope, file)))
            ),
            (scopes) => CommentLawPending.make({ ...shard, scopes })
          )
        )
      );
  const directory = `${repoRoot}/${COMMENT_LAW_PENDING_DIR}`;
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(CommentLawExecutionError.mapError(`Failed to create ${COMMENT_LAW_PENDING_DIR}`));
  const keep = HashSet.fromIterable(A.map(next, shardFileName));
  for (const shard of current) {
    const name = shardFileName(shard);
    if (!HashSet.has(keep, name))
      yield* fs.remove(`${directory}/${name}`).pipe(CommentLawExecutionError.mapError(`Failed to remove ${name}`));
  }
  const unchanged = HashSet.fromIterable(
    A.map(current, (shard) => `${shard.root}\u0000${A.join(shard.scopes, "\u0000")}`)
  );
  for (const shard of next) {
    if (HashSet.has(unchanged, `${shard.root}\u0000${A.join(shard.scopes, "\u0000")}`)) continue;
    const text = yield* formatJsonc(shard).pipe(
      CommentLawExecutionError.mapError(`Failed to encode ${shardFileName(shard)}`)
    );
    yield* fs
      .writeFileString(`${directory}/${shardFileName(shard)}`, text)
      .pipe(CommentLawExecutionError.mapError(`Failed to write ${shardFileName(shard)}`));
  }
  return next;
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
        return CommentLawPending.makeOption({
          schemaVersion: "comment-law-pending/v1",
          package: O.getOrElse(HashMap.get(names, root), () => root),
          root,
          scopes: ["."],
        });
      const loose = A.dedupe(
        A.map(
          A.filter(bannedFiles, (file) => packageRootOf(roots, file) === "."),
          (file) => O.getOrElse(A.head(Str.split(file, "/")), () => file)
        )
      );
      return O.map(O.liftPredicate(A.isReadonlyArrayNonEmpty<string>)(A.sort(loose, Order.String)), (scopes) =>
        CommentLawPending.make({ schemaVersion: "comment-law-pending/v1", package: "(root)", root: ".", scopes })
      );
    })
  );
};
