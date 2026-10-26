/**
 * The runner's own cache: archive a set of paths under a key and restore them in a later job.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GlobPattern, GlobSet } from "@beep/glob";
import { $GithubActionsId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { unstubbed } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { misconfiguredDetail, resultsBackend } from "./internal/actionsResults.ts";
import { azureFileTransfer } from "./internal/azureBlob.ts";
import { cacheServiceFor, finalizeUpload, lookupDownload, reserveUpload } from "./internal/cacheService.ts";
import { sha256Hex } from "./internal/digest.ts";
import { detailText, framed, statusText } from "./internal/messageText.ts";
import { runnerServices } from "./internal/runnerServices.ts";
import { spawnOnce } from "./internal/spawn.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as HttpClient from "effect/http/HttpClient";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ActionEnvironment, ActionEnvironmentShape } from "./ActionEnvironment.ts";
import type { BlobTransferError, FileBlobTransfer } from "./BlobTransfer.ts";
import type { CacheKey } from "./CacheKey.ts";
import type { RunnerServiceRequirements } from "./internal/runnerServices.ts";

const $I = $GithubActionsId.create("ActionCache");

/**
 * Raised when the runner's cache cannot be read or written.
 *
 * **Example** (Explain a refused cache request)
 *
 * ```ts
 * import { ActionCacheError } from "@beep/github-actions/ActionCache";
 *
 * const error = ActionCacheError.make({ reason: "refused", key: "build-v1", status: 403 });
 * console.log(error.message) // The Actions cache refused the request for "build-v1" with status 403
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ActionCacheError extends S.TaggedError<ActionCacheError, { readonly brand: unique symbol }>(
  $I`ActionCacheError`
)(
  "ActionCacheError",
  {
    /**
     * `misconfigured` — the results backend is not reachable from here (see
     * {@link ActionCache}). `unreachable` — it could not be contacted, or
     * answered with something that is not a Twirp body. `refused` — it answered,
     * unhappily. `archiveFailed` — `tar` would not pack or unpack the paths.
     * `transferFailed` — the archive itself did not move.
     * @since 0.0.0
     */
    reason: S.Literals(["misconfigured", "unreachable", "refused", "archiveFailed", "transferFailed"]).pipe(
      $I.annoteKey("ActionCacheError.reason", {
        description:
          "`misconfigured` — the results backend is not reachable from here (see ActionCache). `unreachable` — it could not be contacted, or answered with something that is not a Twirp body. `refused` — it answered, unhappily. `archiveFailed` — `tar` would not pack or unpack the paths. `transferFailed` — the archive itself did not move.",
      })
    ),
    /**
     * The cache key involved. A stable identifier, never a value.
     * @since 0.0.0
     */
    key: S.optionalKey(S.String).pipe(
      $I.annoteKey("ActionCacheError.key", {
        description: "The cache key involved. A stable identifier, never a value.",
      })
    ),
    /**
     * The HTTP status, when the backend answered.
     * @since 0.0.0
     */
    status: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("ActionCacheError.status", { description: "The HTTP status, when the backend answered." })
    ),
    /**
     * What went wrong, when the reason alone does not say.
     * @since 0.0.0
     */
    detail: S.optionalKey(S.String).pipe(
      $I.annoteKey("ActionCacheError.detail", { description: "What went wrong, when the reason alone does not say." })
    ),
    /**
     * `tar`'s own complaint, which is the only useful part of an archive failure.
     * @since 0.0.0
     */
    stderr: S.optionalKey(S.String).pipe(
      $I.annoteKey("ActionCacheError.stderr", {
        description: "`tar`'s own complaint, which is the only useful part of an archive failure.",
      })
    ),
    /**
     * The underlying failure, preserved structurally.
     * @since 0.0.0
     */
    cause: S.optionalKey(S.Defect()).pipe(
      $I.annoteKey("ActionCacheError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<ActionCacheError>("ActionCacheError", {
    description: "Raised when the runner's cache cannot be read or written.",
  })
) {
  /**
   * Explains the failure reason with the available diagnostic fields.
   *
   * **Example** (Explain a refused cache request)
   *
   * ```ts
   * import { ActionCacheError } from "@beep/github-actions/ActionCache";
   *
   * const error = ActionCacheError.make({ reason: "refused", key: "build-v1", status: 403 });
   * console.log(error.message) // The Actions cache refused the request for "build-v1" with status 403
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const cache = "The Actions cache";
    const about = framed({ prefix: ' for "', closing: '"' })(this.key);
    const detail = detailText(this.detail);
    return Match.value(this.reason).pipe(
      Match.when("misconfigured", () => `${cache} is not reachable from here${detail}`),
      Match.when("unreachable", () => `${cache} could not be reached${about}${detail}`),
      Match.when("refused", () => `${cache} refused the request${about}${statusText(this.status)}${detail}`),
      Match.when(
        "archiveFailed",
        () => `The cache archive could not be built or extracted${about}${detailText(this.stderr)}`
      ),
      Match.when("transferFailed", () => `The cache archive did not transfer${about}`),
      Match.exhaustive
    );
  }
}

/**
 * The members of the {@link ActionCache} service: `save` a set of paths under a
 * key and `restore` them in a later job.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ActionCacheShape {
  /**
   * Restore `paths` from the first entry that matches, and answer with the key
   * that matched.
   *
   * **Details**
   *
   * `Option.none()` is a miss, not a failure — a cold cache is the normal state
   * of a new branch. Passing a {@link CacheKey} supplies its restore-key ladder
   * automatically; passing a `string` and no ladder means "this key or nothing".
   *
   * `paths` only derives the entry version and MUST be the same literal list
   * the save used — no glob resolution happens here, because none is needed:
   * extraction consumes no path list (the archive already names its contents),
   * and `actions/cache` likewise hashes the un-resolved list on both sides.
   * @since 0.0.0
   */
  readonly restore: {
    (
      paths: ReadonlyArray<string>,
      key: string | CacheKey,
      restoreKeys?: ReadonlyArray<string>
    ): Effect.Effect<O.Option<string>, ActionCacheError>;
    (
      key: string | CacheKey,
      restoreKeys?: ReadonlyArray<string>
    ): (paths: ReadonlyArray<string>) => Effect.Effect<O.Option<string>, ActionCacheError>;
  };
  /**
   * Archive the files and directories matching `paths` and store them under
   * `key`.
   *
   * **Details**
   *
   * `paths` is a list of glob **patterns**, resolved with `actions/cache`
   * parity before `tar` ever sees them: a pattern may match directories (a
   * matched directory is archived recursively, never expanded into its
   * descendants), a pattern that matches nothing — including a literal path
   * that is not on disk — is silently dropped, and a list that resolves to
   * nothing at all fails typed rather than reserving an entry no archive will
   * ever back. A leading `~` expands to the caller's home directory, relative
   * patterns root at `GITHUB_WORKSPACE` (falling back to the working
   * directory), and a leading `!` marks an exclusion.
   *
   * The entry **version** is a digest of the literal pattern list, exactly as
   * `actions/cache` computes it — resolution feeds `tar` only, never the
   * version — so {@link ActionCacheShape.restore | restore}, which resolves
   * nothing, derives the same version from the same list for free.
   *
   * One deliberate divergence from the toolkit: where `actions/cache` re-roots
   * every match relative to the workspace, resolved paths here stay
   * **absolute** and are archived with `tar -P`, so a restore puts every file
   * back where it came from regardless of the restoring step's working
   * directory.
   *
   * A key that already exists is a **success**: cache entries are immutable, so
   * another job having written it first is the outcome the caller wanted.
   * @since 0.0.0
   */
  readonly save: {
    (paths: ReadonlyArray<string>, key: string | CacheKey): Effect.Effect<void, ActionCacheError>;
    (key: string | CacheKey): (paths: ReadonlyArray<string>) => Effect.Effect<void, ActionCacheError>;
  };
}

/**
 * The entry version, byte-compatible with `actions/cache`.
 *
 * **Gotchas**
 *
 * A cache entry is keyed on `(key, version)`, and the version is a digest of
 * the archived paths plus the compression method. **The paths are not sorted**,
 * because upstream does not sort them: sorting here would compute a version no
 * other cache step in the workflow agrees with, and the entry a sibling step
 * wrote would simply never be found.
 *
 * **The digest covers the LITERAL pattern list, never the resolved paths.**
 * That is upstream's choice, not ours: `getCacheVersion` hashes the caller's
 * `paths` argument verbatim (`actions/toolkit`, `cache/src/internal/`
 * `cacheUtils.ts:136-159`), and both `saveCacheV2` (`cache/src/cache.ts:689`)
 * and `restoreCacheV2` (`cache.ts:361`) hand it the un-resolved list — restore
 * never resolves at all. Hashing the resolved list here would compute a
 * version the restore side cannot reproduce, and every save would be an entry
 * no restore ever finds.
 */
const versionOf = (paths: ReadonlyArray<string>): string => sha256Hex(A.join([...paths, "gzip", "1.0"], "|"));

/**
 * The primary key and the ladder to fall back through.
 */
const ladder: {
  (
    key: string | CacheKey,
    restoreKeys: ReadonlyArray<string> | undefined
  ): { readonly primary: string; readonly fallbacks: ReadonlyArray<string> };
  (
    restoreKeys: ReadonlyArray<string> | undefined
  ): (key: string | CacheKey) => { readonly primary: string; readonly fallbacks: ReadonlyArray<string> };
} = dual(
  2,
  (
    key: string | CacheKey,
    restoreKeys: ReadonlyArray<string> | undefined
  ): { readonly primary: string; readonly fallbacks: ReadonlyArray<string> } =>
    P.isString(key)
      ? { primary: key, fallbacks: restoreKeys ?? [] }
      : { primary: key.key, fallbacks: restoreKeys ?? key.restoreKeys }
);

/**
 * What path resolution reads: the filesystem, the path dialect, the runner
 * environment (`GITHUB_WORKSPACE`, `HOME`, `USERPROFILE`) and whether the
 * runner is Windows.
 */
interface PathResolution {
  readonly env: ActionEnvironmentShape;
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly windows: boolean;
}

/**
 * Builds the `archiveFailed` error for one key, with an optional structural cause.
 */
const pathFailure =
  (key: string) =>
  (detail: string, cause?: unknown): ActionCacheError =>
    ActionCacheError.make({
      reason: "archiveFailed",
      key,
      detail,
      ...O.getSomesStruct({ cause: O.fromUndefinedOr(cause) }),
    });

/**
 * Platform separators to the dialect's — applied to paths WE produce, never to
 * the caller's pattern text, where a backslash is minimatch's escape character.
 */
const posixFor = (windows: boolean, value: string): string => (windows ? Str.replaceAll("\\", "/")(value) : value);

/**
 * The caller's members with blank and `#` lines removed: the toolkit joins the
 * list with newlines, where both are inert.
 */
const cleanPatterns = (patterns: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    patterns,
    A.map(Str.trim),
    A.filter((pattern) => Str.isNonEmpty(pattern) && !Str.startsWith("#")(pattern))
  );

/**
 * The home directory a leading `~` expands to: `HOME`, then `USERPROFILE`.
 */
const homeDirectory = (env: ActionEnvironmentShape): Effect.Effect<O.Option<string>> =>
  env.getOptional("HOME").pipe(Effect.filterOrElse(O.isSome, () => env.getOptional("USERPROFILE")));

/**
 * One member rooted absolutely: a leading `~` expands to the home directory
 * with the expansion glob-escaped, and a relative member roots at the escaped
 * workspace `base`, as the toolkit escapes its own (`Pattern.globEscape`) — a
 * `[` in a directory name is a path here, not a character class. A leading
 * `!` (an exclusion) is kept in front of the rooted body.
 */
const rootPattern = Effect.fnUntraced(function* (
  resolution: PathResolution,
  base: string,
  failed: ReturnType<typeof pathFailure>,
  pattern: string
): Effect.fn.Return<string, ActionCacheError> {
  const excluded = Str.startsWith("!")(pattern);
  const body = excluded ? Str.slice(1)(pattern) : pattern;
  let target = body;
  if (body === "~" || Str.startsWith("~/")(body)) {
    const home = yield* homeDirectory(resolution.env);
    if (O.isNone(home)) {
      return yield* failed(`cannot expand "~" in "${pattern}" — neither HOME nor USERPROFILE is set`);
    }
    target = `${GlobPattern.escape(posixFor(resolution.windows, resolution.path.resolve(home.value)))}${Str.slice(1)(body)}`;
  }
  const rooted = resolution.path.isAbsolute(target) ? target : `${GlobPattern.escape(base)}/${target}`;
  return excluded ? `!${rooted}` : rooted;
});

/**
 * Whether `child` lies strictly below `parent` (every path lies below `/`).
 */
const isBelow = (child: string, parent: string): boolean =>
  parent === "/" ? child !== "/" : Str.startsWith(`${parent}/`)(child);

/**
 * Where to look, and where a walk is worth its cost.
 *
 * **Details**
 *
 * Search roots are the longest literal prefix of every include — the same
 * derivation as `@actions/glob`'s search paths — with descendant roots folded
 * into their ancestors so nothing is walked twice. Wildcard roots are
 * remembered apart from literal ones, because only a wildcard can match BELOW
 * a root: a root that literals alone contributed is stat-and-admitted without
 * the recursive walk (a literal `~/.pnpm-store` must not cost a full store
 * enumeration that can admit nothing), while a folded-in wildcard root keeps
 * the toolkit-parity descent for the ancestor that absorbed it.
 */
const searchPlan = (
  set: GlobSet
): { readonly roots: ReadonlyArray<string>; readonly needsWalk: (root: string) => boolean } => {
  // GlobSet classifies whole-pattern negations as excludes, not wildcards, and
  // every include was rooted, so its literal prefix contains at least "/".
  const wildcardRoots = A.map(set.wildcards, ({ enumerationPrefix }) =>
    enumerationPrefix === "/" ? "/" : Str.slice(0, -1)(enumerationPrefix)
  );
  const roots = uniqueInOrder(A.appendAll(set.literals, wildcardRoots));
  return {
    roots: A.filter(roots, (root) => !A.some(roots, (other) => other !== root && isBelow(root, other))),
    needsWalk: (root) => A.some(wildcardRoots, (wildcard) => wildcard === root || isBelow(wildcard, root)),
  };
};

/**
 * `values` without repeats, first occurrence first, in one hashed pass (a
 * resolution at pnpm-store scale holds tens of thousands of paths).
 */
const uniqueInOrder = (values: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = MutableHashSet.empty<string>();
  return A.filter(values, (value) => {
    const fresh = !MutableHashSet.has(seen, value);
    MutableHashSet.add(seen, value);
    return fresh;
  });
};

/**
 * The candidates one search root contributes: nothing when it is not on disk,
 * the root itself, and — only where a wildcard can match below it — every
 * entry of its recursive listing.
 *
 * **Details**
 *
 * Existence IS the filter: a literal that is not on disk and a pattern whose
 * literal prefix directory is absent both contribute nothing, exactly as the
 * toolkit's globber skips an ENOENT search path. `stat` follows symlinks, so a
 * broken link is also nothing. A literal-only root admits itself (or not) at
 * the stat; every deeper candidate would fail the set anyway, so the walk
 * would be pure cost.
 */
const rootCandidates = Effect.fnUntraced(function* (
  resolution: PathResolution,
  needsWalk: (root: string) => boolean,
  failed: ReturnType<typeof pathFailure>,
  root: string
): Effect.fn.Return<ReadonlyArray<string>, ActionCacheError> {
  const info = yield* resolution.fs.stat(root).pipe(Effect.option);
  if (O.isNone(info)) {
    return [];
  }
  if (info.value.type !== "Directory" || !needsWalk(root)) {
    return [root];
  }
  const entries = yield* resolution.fs
    .readDirectory(root, { recursive: true })
    .pipe(Effect.mapError((cause) => failed(`could not enumerate "${root}"`, cause)));
  return A.prepend(
    A.map(entries, (entry) => `${root}/${posixFor(resolution.windows, entry)}`),
    root
  );
});

/**
 * Why `candidate` cannot be one `tar` manifest line, if it cannot: a line is
 * one tar input, so a line break would split it, and off Windows a backslash
 * is not a separator the archive would restore.
 */
const unusableCandidate = (windows: boolean, candidate: string): O.Option<string> => {
  if (!windows && Str.includes("\\")(candidate)) {
    return O.some(`cache path contains a backslash: "${candidate}"`);
  }
  return Str.includes("\n")(candidate) || Str.includes("\r")(candidate)
    ? O.some(`cache path contains a line break: "${candidate}"`)
    : O.none();
};

/**
 * `matched` without the paths a selected real directory already covers, in
 * resolution order.
 *
 * **Details**
 *
 * Every selected real directory is collected first, so a descendant that
 * precedes its parent in filesystem enumeration is covered too. Tar stores
 * symlinks without following them, unlike `fs.stat`: an enumerated broken link
 * is a valid member whose missing target is never stat'd, and a link between
 * a real ancestor and a path stops tar's recursion, so that path's explicitly
 * selected descendants still belong.
 */
const dropCoveredPaths = Effect.fnUntraced(function* (
  resolution: PathResolution,
  failed: ReturnType<typeof pathFailure>,
  matched: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, ActionCacheError> {
  const { fs, path, windows } = resolution;
  const symlinks = MutableHashSet.empty<string>();
  const checkedLinks = MutableHashSet.empty<string>();
  const isSymlink = Effect.fnUntraced(function* (candidate: string) {
    if (!MutableHashSet.has(checkedLinks, candidate)) {
      const link = yield* fs.readLink(candidate).pipe(Effect.option);
      MutableHashSet.add(checkedLinks, candidate);
      if (O.isSome(link)) MutableHashSet.add(symlinks, candidate);
    }
    return MutableHashSet.has(symlinks, candidate);
  });
  const directories = MutableHashSet.empty<string>();
  yield* Effect.forEach(
    matched,
    Effect.fnUntraced(function* (candidate: string) {
      if (yield* isSymlink(candidate)) return;
      const info = yield* fs
        .stat(candidate)
        .pipe(Effect.mapError((cause) => failed(`could not inspect "${candidate}"`, cause)));
      if (info.type === "Directory") MutableHashSet.add(directories, candidate);
    }),
    { discard: true }
  );
  // Walk up from a candidate's parent: a symlinked ancestor ends the walk
  // uncovered (its contents are not this tree's), a matched directory covers
  // the candidate, and reaching the root ends it uncovered.
  const coveredFrom = (parent: string): Effect.Effect<boolean> =>
    Effect.flatMap(isSymlink(parent), (symlink) => {
      if (symlink) return Effect.succeed(false);
      if (MutableHashSet.has(directories, parent)) return Effect.succeed(true);
      const next = posixFor(windows, path.dirname(parent));
      return next === parent ? Effect.succeed(false) : coveredFrom(next);
    });
  // A filesystem root ("/", "C:/") is its own parent and is never covered.
  return yield* Effect.filter(matched, (candidate) => {
    const parent = posixFor(windows, path.dirname(candidate));
    return parent === candidate ? Effect.succeed(true) : Effect.map(coveredFrom(parent), (covered) => !covered);
  });
});

/**
 * Resolve the caller's patterns to the concrete files and directories `tar`
 * will archive, with `actions/cache` parity.
 *
 * **Details**
 *
 * The toolkit resolves through `@actions/glob` with `implicitDescendants`
 * disabled (`cacheUtils.ts:48-70`): a matched directory is answered as itself
 * and `tar` recurses into it, a pattern that matches nothing — including a
 * literal path that is not on disk — contributes nothing
 * (`internal-globber.ts:90-100` existence-filters every search path), a
 * leading `~` expands to the home directory with the expansion glob-escaped
 * (`internal-pattern.ts:226-234`), and blank or `#` members are skipped. A
 * fully empty resolution is the toolkit's hard "Path Validation Error"
 * (`cache.ts:662-666`) and a typed failure here. Every resolved name is
 * checked before the manifest is written or `tar` spawns, including names a
 * directory later covers.
 *
 * Two knowing departures: matches stay ABSOLUTE for the `-P` archive posture
 * rather than being re-rooted at the workspace (the version hashes the
 * literal list, so the wire protocol never sees the difference), and the walk
 * does not follow directory symlinks, where the toolkit's globber does.
 */
const resolvePaths = Effect.fnUntraced(function* (
  resolution: PathResolution,
  patterns: ReadonlyArray<string>,
  key: string
): Effect.fn.Return<ReadonlyArray<string>, ActionCacheError> {
  const failed = pathFailure(key);
  const cleaned = cleanPatterns(patterns);
  // The toolkit roots relative patterns at the process working directory and
  // relativizes matches against GITHUB_WORKSPACE; on a runner the two are the
  // same directory, and the variable is the one a test controls.
  const workspace = O.getOrElse(yield* resolution.env.getOptional("GITHUB_WORKSPACE"), () => ".");
  const base = posixFor(resolution.windows, resolution.path.resolve(workspace));
  const rooted = yield* Effect.forEach(cleaned, (pattern) => rootPattern(resolution, base, failed, pattern));
  const set = yield* GlobSet.compile(rooted).pipe(
    Effect.mapError((cause) => failed(`"${cause.pattern}" is not a usable glob pattern`, cause))
  );
  const plan = searchPlan(set);
  const candidates = yield* Effect.forEach(plan.roots, (root) =>
    rootCandidates(resolution, plan.needsWalk, failed, root)
  );
  const matched = uniqueInOrder(A.filter(A.flatten(candidates), (candidate) => set.matches(candidate)));
  if (!A.isReadonlyArrayNonEmpty(matched)) {
    return yield* failed(`no file or directory matched the cache paths: ${A.join(cleaned, ", ")}`);
  }
  const unusable = A.findFirst(matched, (candidate) => unusableCandidate(resolution.windows, candidate));
  if (O.isSome(unusable)) {
    return yield* failed(unusable.value);
  }
  return yield* dropCoveredPaths(resolution, failed, matched);
});

const make = Effect.fn("make")(function* (
  transfer: FileBlobTransfer
): Effect.fn.Return<ActionCacheShape, never, RunnerServiceRequirements> {
  // Resolved once, at construction, so every member's `R` is `never`.
  const { http, fs, path, spawner, env, windows } = yield* runnerServices;

  /**
   * A filesystem or subprocess failure on the way to or from the archive.
   */
  const archiveFailed = (key: string) => (cause: unknown) =>
    ActionCacheError.make({ reason: "archiveFailed", key, cause });

  const backend = resultsBackend(env).pipe(
    Effect.mapError((name) =>
      ActionCacheError.make({ reason: "misconfigured", detail: misconfiguredDetail(name, "Actions cache") })
    )
  );

  /**
   * The cache service, for one key: every failure names it.
   */
  const cacheService = cacheServiceFor({ http, backend, fail: (failure) => ActionCacheError.make(failure) });

  /**
   * Run `tar` ONCE, keeping its stderr.
   *
   * **Details**
   *
   * On Windows, extraction runs with `-k` so a file another process holds
   * open is skipped rather than failing the whole restore — and `tar` then
   * exits 1 to say so, which is a warning rather than an error. Exit 2 and
   * above stays a failure on every platform.
   *
   * Output and exit code come from the SAME `spawn` handle
   * (`internal/spawn.ts` — the spawner's convenience members each spawn
   * independently, so reading both from them would run `tar` twice).
   */
  const tar: {
    (args: ReadonlyArray<string>, key: string, tolerateWarnings: boolean): Effect.Effect<void, ActionCacheError>;
    (key: string, tolerateWarnings: boolean): (args: ReadonlyArray<string>) => Effect.Effect<void, ActionCacheError>;
  } = dual(
    3,
    Effect.fn("tar")(function* (args: ReadonlyArray<string>, key: string, tolerateWarnings: boolean) {
      const { output, code } = yield* spawnOnce(spawner, ChildProcess.make("tar", [...args])).pipe(
        Effect.mapError(archiveFailed(key))
      );
      if (code !== 0 && !(tolerateWarnings && code === 1)) {
        return yield* ActionCacheError.make({ reason: "archiveFailed", key, stderr: Str.trim(output) });
      }
    })
  );

  /**
   * A scratch archive path — plus the scratch directory itself, where the
   * save side writes its tar manifest — removed on every exit path.
   */
  const withArchive: {
    <A>(
      key: string,
      use: (archive: string, scratch: string) => Effect.Effect<A, ActionCacheError>
    ): Effect.Effect<A, ActionCacheError>;
    <A>(
      use: (archive: string, scratch: string) => Effect.Effect<A, ActionCacheError>
    ): (key: string) => Effect.Effect<A, ActionCacheError>;
  } = dual(
    2,
    <A>(
      key: string,
      use: (archive: string, scratch: string) => Effect.Effect<A, ActionCacheError>
    ): Effect.Effect<A, ActionCacheError> =>
      Effect.acquireUseRelease(
        fs.makeTempDirectory({ prefix: "effected-cache-" }).pipe(Effect.mapError(archiveFailed(key))),
        (directory) => use(path.join(directory, "cache.tar.gz"), directory),
        (directory) => Effect.ignore(fs.remove(directory, { recursive: true, force: true }))
      )
  );

  const moved = (key: string) =>
    Effect.mapError((cause: BlobTransferError) => ActionCacheError.make({ reason: "transferFailed", key, cause }));

  const resolution: PathResolution = { fs, path, env, windows };

  return {
    save: dual(
      2,
      Effect.fn("ActionCache.save")(function* (paths: ReadonlyArray<string>, key: string | CacheKey) {
        const { primary } = ladder(key, undefined);
        yield* Effect.annotateCurrentSpan({ key: primary });
        if (paths.length === 0) {
          return yield* ActionCacheError.make({
            reason: "archiveFailed",
            key: primary,
            detail: "no paths were given to cache",
          });
        }
        // The LITERAL list, before resolution — see `versionOf` for why.
        const version = versionOf(paths);
        const resolved = yield* resolvePaths(resolution, paths, primary);
        yield* withArchive(
          primary,
          Effect.fnUntraced(function* (archive: string, scratch: string) {
            // The resolved list reaches tar through a MANIFEST FILE, never
            // argv: resolution admits every matched descendant, so a pattern
            // like `${workspace}/**` resolves to tens of thousands of
            // absolute paths and overflows the kernel's argv limit (E2BIG)
            // before tar ever runs. Same fix as the toolkit, which writes
            // manifest.txt and passes `--files-from`
            // (`cache/src/internal/tar.ts`). The flag is spelled `-T`: GNU
            // tar (Linux runners) and bsdtar (macOS runners, and Windows'
            // system tar.exe) both document `-T` and `--files-from` as
            // synonyms — probed against bsdtar 3.5.3 with this exact
            // invocation — and the short spelling sidesteps GNU's
            // `--files-from=FILE` vs bsdtar's `--files-from FILE` split.
            // GNU tar reads a manifest line starting with `-` as an option
            // (its escape hatch, `--verbatim-files-from`, is GNU-only), but
            // resolved paths here are always absolute, so no line can.
            const manifest = path.join(scratch, "manifest.txt");
            yield* fs
              .writeFileString(manifest, `${A.join(resolved, "\n")}\n`)
              .pipe(Effect.mapError(archiveFailed(primary)));
            // `-P` keeps leading separators, so an absolute path is stored
            // verbatim and restored where it came from rather than under the
            // working directory of whichever step happens to restore it.
            yield* tar(["czPf", archive, "-T", manifest], primary, false);
            const size = yield* fs.stat(archive).pipe(Effect.mapError(archiveFailed(primary)));

            const service = cacheService(primary);
            // None: another job saved this key first, and the cache already
            // holds what the caller wanted.
            const url = yield* reserveUpload(service, primary, version);
            if (O.isNone(url)) {
              return;
            }
            yield* transfer.uploadFile(url.value, archive).pipe(moved(primary));
            yield* finalizeUpload(service, primary, version, size.size);
          })
        );
      })
    ),

    restore: dual(
      (args) => A.isArray(args[0]),
      Effect.fn("ActionCache.restore")(function* (
        paths: ReadonlyArray<string>,
        key: string | CacheKey,
        restoreKeys?: ReadonlyArray<string>
      ) {
        const { primary, fallbacks } = ladder(key, restoreKeys);
        yield* Effect.annotateCurrentSpan({ key: primary });
        const hit = yield* lookupDownload(cacheService(primary), primary, fallbacks, versionOf(paths));
        if (O.isNone(hit)) {
          return O.none<string>();
        }
        yield* withArchive(
          primary,
          Effect.fnUntraced(function* (archive: string) {
            yield* transfer.downloadToFile(hit.value.url, archive).pipe(moved(primary));
            yield* tar([windows ? "xzPkf" : "xzPf", archive], primary, windows);
          })
        );
        // The matched key is what the caller branches on: a hit on a restore
        // key is a partial hit, and re-saving under the primary key is the
        // whole point of knowing the difference.
        return O.some(hit.value.matchedKey ?? primary);
      })
    ),
  } satisfies ActionCacheShape;
});

const dies = unstubbed("ActionCache.makeTest");

/**
 * The runner's own cache: archive a set of paths under a key, and get them back
 * in a later job.
 *
 * **Gotchas**
 *
 * Speaks the Actions cache **Twirp v2** protocol at `ACTIONS_RESULTS_URL`,
 * which answers with a pre-signed Azure blob url for the archive itself. No
 * `@actions/cache` dependency — that package alone brings a dependency tree
 * larger than this one.
 *
 * **Only reachable from a `uses:` step.** The runner injects
 * `ACTIONS_RESULTS_URL` and `ACTIONS_RUNTIME_TOKEN` into action execution
 * contexts and not into `run:` shell steps, so the identical code fails as
 * `misconfigured` when a workflow invokes it with `node ./main.js`. The failure
 * names the absent variable, because nothing else distinguishes the two cases.
 *
 * **Example** (Restore a pnpm store and save on a cache miss)
 *
 * ```ts
 * import { ActionCache } from "@beep/github-actions/ActionCache";
 * import { CacheKey } from "@beep/github-actions/CacheKey";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* ActionCache;
 *   const key = CacheKey.of("Linux", "pnpm-store", "abc123");
 *   const hit = yield* cache.restore(["~/.pnpm-store"], key);
 *   if (O.isNone(hit)) {
 *     yield* cache.save(["~/.pnpm-store"], key);
 *   }
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ActionCache extends Context.Service<ActionCache, ActionCacheShape>()($I`ActionCache`) {
  /**
   * The cache, over the real Azure client and the real `tar`.
   *
   * **Example** (Select the live cache layer)
   *
   * ```ts
   * import { ActionCache } from "@beep/github-actions/ActionCache";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(ActionCache.layer)) // true
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    ActionCache,
    never,
    | ActionEnvironment
    | HttpClient.HttpClient
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(this, make(azureFileTransfer));

  /**
   * The cache, over a supplied transport.
   *
   * **Details**
   *
   * The protocol, the version derivation, the conflict handling and the archive
   * are what this package owns; the pre-signed `PUT` is not. Supplying the
   * transport is what lets a test exercise all of the first group without the
   * second, and what an integration test uses to point the same protocol at a
   * local blob endpoint.
   *
   * A parameterized layer factory mints a fresh layer per call and layers
   * memoize by reference — bind it to a `const` rather than calling it at each
   * composition site.
   *
   * **Example** (Bind a cache layer with a supplied transport)
   *
   * ```ts
   * import { ActionCache } from "@beep/github-actions/ActionCache";
   * import * as Effect from "effect/Effect";
   * import * as Layer from "effect/Layer";
   * import { dual } from "effect/Function";
   *
   * const cacheLayer = ActionCache.layerWith({
   *   uploadFile: dual(2, (_url: string, _file: string) => Effect.void),
   *   downloadToFile: dual(2, (_url: string, _file: string) => Effect.void),
   * });
   * console.log(Layer.isLayer(cacheLayer)) // true
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layerWith = (
    transfer: FileBlobTransfer
  ): Layer.Layer<
    ActionCache,
    never,
    | ActionEnvironment
    | HttpClient.HttpClient
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
  > => Layer.effect(ActionCache, make(transfer));

  /**
   * A test double. Unstubbed members die rather than reporting a miss.
   *
   * **Example** (Serve a cache miss in a test double)
   *
   * ```ts
   * import { ActionCache } from "@beep/github-actions/ActionCache";
   * import * as A from "effect/Array";
   * import * as Effect from "effect/Effect";
   * import { dual } from "effect/Function";
   * import * as O from "effect/Option";
   *
   * const cache = ActionCache.makeTest({
   *   restore: dual(
   *     (args) => A.isArray(args[0]),
   *     (_paths: ReadonlyArray<string>, _key: unknown, _restoreKeys?: ReadonlyArray<string>) => Effect.succeed(O.none()),
   *   ),
   * });
   * console.log(O.isNone(Effect.runSync(cache.restore(["dist"], "build-v1")))) // true
   * ```
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<ActionCacheShape> = {}): ActionCacheShape => ({
    save: dual(
      2,
      (_paths: ReadonlyArray<string>, _key: string | CacheKey): Effect.Effect<void, ActionCacheError> => dies("save")
    ),
    restore: dual(
      (args) => A.isArray(args[0]),
      (
        _paths: ReadonlyArray<string>,
        _key: string | CacheKey,
        _restoreKeys?: ReadonlyArray<string>
      ): Effect.Effect<O.Option<string>, ActionCacheError> => dies("restore")
    ),
    ...overrides,
  });

  /**
   * {@link ActionCache.makeTest} behind `Layer.succeed`.
   *
   * **Example** (Provide a cache miss through a test layer)
   *
   * ```ts
   * import { ActionCache } from "@beep/github-actions/ActionCache";
   * import * as A from "effect/Array";
   * import * as Effect from "effect/Effect";
   * import { dual } from "effect/Function";
   * import * as O from "effect/Option";
   *
   * const program = Effect.flatMap(ActionCache, (cache) => cache.restore(["dist"], "build-v1"));
   * const testLayer = ActionCache.layerTest({
   *   restore: dual(
   *     (args) => A.isArray(args[0]),
   *     (_paths: ReadonlyArray<string>, _key: unknown, _restoreKeys?: ReadonlyArray<string>) => Effect.succeed(O.none()),
   *   ),
   * });
   * console.log(O.isNone(Effect.runSync(Effect.provide(program, testLayer)))) // true
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<ActionCacheShape> = {}): Layer.Layer<ActionCache> =>
    Layer.succeed(ActionCache, ActionCache.makeTest(overrides));
}
