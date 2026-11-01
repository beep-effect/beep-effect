import { $RepoWorkspacesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// The `packages:` enumerator. `@beep/glob` classifies the pattern set and
// tells us, per wildcard, whether it can cross a segment boundary; when it can,
// a trailing `/**` earns a real descent rather than a one-level read.
//
// The descent is a WORKLIST, not a recursion: it cannot overflow the stack, so
// there is no cap to get wrong. It is bounded by depth, by a visited-directory
// budget, and by an unconditional node_modules / .git prune.

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import { MAX_ENUMERATION_DEPTH } from "./limits.ts";
import { badMaxDepthMessage, excludedBy, isPruned, isValidMaxDepth, joinRelative, Traversal } from "./traverse.ts";
import type { GlobPattern, GlobSet } from "@beep/glob";
import type { TraversalFrame } from "./traverse.ts";

const $I = $RepoWorkspacesId.create("internal/enumerate");

class EnumerationOptionsError extends S.TaggedError<EnumerationOptionsError, { readonly brand: unique symbol }>(
  $I`EnumerationOptionsError`
)(
  "EnumerationOptionsError",
  {
    message: S.String,
  },
  $I.annoteError<EnumerationOptionsError>("EnumerationOptionsError", {
    description: "An invalid workspace enumeration depth bound.",
  })
) {}

/**
 * A directory the enumerator accepted: its root-relative POSIX path and its absolute path.
 *
 * **Example** (Recognize an accepted package directory)
 *
 * ```ts
 * import { EnumeratedDirectory } from "@beep/repo-workspaces/internal/enumerate";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(EnumeratedDirectory)({ relativePath: "packages/core", path: "/repo/packages/core" })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnumeratedDirectory extends S.Opaque<EnumeratedDirectory, { readonly brand: unique symbol }>()(
  S.Struct({
    relativePath: S.String.pipe(
      $I.annoteKey("EnumeratedDirectory.relativePath", { description: "The root-relative POSIX package directory." })
    ),
    path: S.String.pipe($I.annoteKey("EnumeratedDirectory.path", { description: "The absolute package directory." })),
  }).pipe(
    $I.annoteSchema("EnumeratedDirectory", {
      description: "A plain package directory accepted by workspace enumeration.",
    })
  )
) {}
/**
 * Companion types for {@link EnumeratedDirectory}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EnumeratedDirectory {
  /**
   * The plain, unbranded encoded shape of a {@link EnumeratedDirectory}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof EnumeratedDirectory.Encoded;
}

/**
 * Classifies why an enumeration failed.
 *
 * **Details**
 *
 * Every member is a caller-visible condition, never a defect.
 *
 * **Example** (Validate an enumeration failure kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EnumerationFailureKind } from "@beep/repo-workspaces/internal/enumerate"
 *
 * console.log(S.is(EnumerationFailureKind)("missingBaseDir")) // true
 * console.log(S.is(EnumerationFailureKind)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EnumerationFailureKind = LiteralKit([
  "missingBaseDir",
  "depthExceeded",
  "budgetExceeded",
  "unreadableDirectory",
]).pipe(
  $I.annoteSchema("EnumerationFailureKind", {
    description: "The caller-visible reasons workspace enumeration can fail.",
  })
);
/**
 * The caller-visible reason recorded when workspace enumeration fails.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EnumerationFailureKind = typeof EnumerationFailureKind.Type;

/** Builds one existing plain failure case without a constructor default. */
const enumerationFailureCase = <const Kind extends EnumerationFailureKind>(kind: S.Literal<Kind>) => {
  const identifier: string = `EnumerationFailure.${kind.literal}`;
  return S.Struct({
    kind: kind.pipe(
      $I.annoteKey("EnumerationFailure.kind", { description: "The existing caller-visible failure reason." })
    ),
    pattern: S.String.pipe(
      $I.annoteKey("EnumerationFailure.pattern", { description: "The workspace pattern that could not be enumerated." })
    ),
    detail: S.String.pipe(
      $I.annoteKey("EnumerationFailure.detail", { description: "The caller-visible enumeration diagnostic." })
    ),
  }).pipe($I.annoteSchema(identifier, { description: `The existing ${kind.literal} failure record.` }));
};

/**
 * The enumerator's raw failure record; the facade materializes the typed error.
 *
 * **Example** (Recognize an enumeration failure)
 *
 * ```ts
 * import { EnumerationFailure } from "@beep/repo-workspaces/internal/enumerate";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(EnumerationFailure)({ kind: "missingBaseDir", pattern: "packages/*", detail: "missing packages" })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EnumerationFailure = EnumerationFailureKind.mapMembers(
  ([missingBaseDir, depthExceeded, budgetExceeded, unreadableDirectory]) => [
    enumerationFailureCase(missingBaseDir),
    enumerationFailureCase(depthExceeded),
    enumerationFailureCase(budgetExceeded),
    enumerationFailureCase(unreadableDirectory),
  ]
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("EnumerationFailure", {
    description: "A plain enumeration failure record materialized by the facade.",
  })
);
/**
 * The readonly enumeration failure described by {@link EnumerationFailure}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EnumerationFailure = typeof EnumerationFailure.Type;

/**
 * Controls the descent bound, root containment, missing-base tolerance and
 * skipped directory names for {@link enumerate}.
 *
 * **Example** (Leave enumeration defaults unresolved)
 *
 * ```ts
 * import { EnumerateOptions } from "@beep/repo-workspaces/internal/enumerate";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(EnumerateOptions)({})); // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class EnumerateOptions extends S.Opaque<EnumerateOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Descent cap below a wildcard's enumeration prefix. Defaults to 32 at use. */
    maxDepth: S.optionalKey(S.declare(P.isNumber)).pipe(
      $I.annoteKey("EnumerateOptions.maxDepth", {
        description: "An optional numeric descent cap, validated and defaulted only by enumeration.",
      })
    ),
    /** Skip directories whose real path leaves the root's real path. Defaults to `false`. */
    containWithinRoot: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("EnumerateOptions.containWithinRoot", {
        description: "Whether directories whose real path leaves the root are skipped before they are read.",
      })
    ),
    /** Let a wildcard whose enumeration base is absent select nothing instead of failing. Defaults to `false`. */
    skipMissingBaseDirs: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("EnumerateOptions.skipMissingBaseDirs", {
        description:
          "Whether a wildcard whose enumeration base directory is absent selects nothing instead of failing.",
      })
    ),
    /** Directory names that hold no member at any depth. Defaults to none. */
    skipDirectoryNames: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("EnumerateOptions.skipDirectoryNames", {
        description:
          "Directory names that hold no member: a candidate with such a segment is skipped before its package.json is probed, and no traversal descends into one.",
      })
    ),
  }).pipe(
    $I.annoteSchema("EnumerateOptions", { description: "Plain enumeration options retaining the lazy depth default." })
  )
) {}
/**
 * Companion types for {@link EnumerateOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EnumerateOptions {
  /**
   * The plain, unbranded encoded shape of a {@link EnumerateOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof EnumerateOptions.Encoded;
}

/** Strip a trailing slash from `GlobPattern.enumerationPrefix` to get a relative directory. */
const baseOf = (pattern: GlobPattern): string => Str.replace(/\/$/, "")(pattern.enumerationPrefix);

/**
 * What one enumeration shares across its literal and wildcard passes.
 *
 * @internal
 */
interface EnumerationScope {
  readonly contains: (absolute: string) => Effect.Effect<boolean>;
  readonly fs: FileSystem.FileSystem;
  readonly included: MutableHashMap.MutableHashMap<string, string>;
  readonly isExcluded: (relative: string) => boolean;
  readonly maxDepth: number;
  readonly path: Path.Path;
  readonly root: string;
  readonly skipMissingBaseDirs: boolean;
  readonly skipsPath: (relative: string) => boolean;
}

/** Whether `absolute` holds a `package.json`; an unreadable probe is `false`. */
const isPackageAt = (scope: EnumerationScope, absolute: string): Effect.Effect<boolean> =>
  scope.fs.exists(scope.path.join(absolute, "package.json")).pipe(Effect.orElseSucceed(() => false));

/**
 * Whether a root-relative path has a segment the enumeration skips.
 *
 * **Details**
 *
 * Without skipped names nothing is skipped and no path is split.
 */
const skipsPathOf = (names: ReadonlyArray<string>): ((relative: string) => boolean) => {
  const skipped = HashSet.fromIterable(names);
  return HashSet.isEmpty(skipped)
    ? () => false
    : (relative) => A.some(Str.split(relative, "/"), (segment) => HashSet.has(skipped, segment));
};

/** Whether `absolute` is a directory; an unreadable probe is `false`. */
const isDirectoryAt = (scope: EnumerationScope, absolute: string): Effect.Effect<boolean> =>
  scope.fs.stat(absolute).pipe(
    Effect.map((info) => info.type === "Directory"),
    Effect.orElseSucceed(() => false)
  );

/**
 * Whether `real` is `canonicalRoot` or lies beneath it.
 *
 * **Details**
 *
 * Both paths are already canonical, so a lexical `relative` decides it: a
 * result that climbs (`..`) or stays absolute (another drive) is outside.
 */
const isWithin = (path: Path.Path, canonicalRoot: string, real: string): boolean => {
  const relative = path.relative(canonicalRoot, real);
  return relative !== ".." && !Str.startsWith(`..${path.sep}`)(relative) && !path.isAbsolute(relative);
};

/**
 * The containment probe for one enumeration.
 *
 * **Details**
 *
 * Off, every directory is admitted without a probe. On, the root is
 * canonicalized once and each probed directory is canonicalized through
 * `realPath`; a directory whose real path cannot be resolved (a dangling link)
 * is not admitted. A root that cannot be canonicalized is compared as given.
 */
const containmentOf = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
  containWithinRoot: boolean
): Effect.fn.Return<(absolute: string) => Effect.Effect<boolean>> {
  if (!containWithinRoot) return () => Effect.succeed(true);
  const canonicalRoot = yield* fs.realPath(root).pipe(Effect.orElseSucceed(() => root));
  return (absolute) =>
    fs.realPath(absolute).pipe(
      Effect.map((real) => isWithin(path, canonicalRoot, real)),
      Effect.orElseSucceed(() => false)
    );
});

/** Whether `absolute` is a directory the enumeration's containment admits. */
const isAdmittedDirectoryAt = (scope: EnumerationScope, absolute: string): Effect.Effect<boolean> =>
  Effect.flatMap(isDirectoryAt(scope, absolute), (directory) =>
    directory ? scope.contains(absolute) : Effect.succeed(false)
  );

/** A shared-traversal stop, materialized as this module's failure record. */
const failureOf = (
  stop: { readonly kind: EnumerationFailureKind; readonly detail: string },
  pattern: string
): EnumerationFailure => ({ kind: stop.kind, pattern, detail: stop.detail });

/** A literal include that names a package directory, as an `included` entry. */
const literalHit = Effect.fnUntraced(function* (
  scope: EnumerationScope,
  literal: string
): Effect.fn.Return<O.Option<readonly [string, string]>> {
  if (scope.isExcluded(literal) || scope.skipsPath(literal)) return O.none();
  const absolute = scope.path.join(scope.root, literal);
  if (!(yield* scope.contains(absolute))) return O.none();
  return (yield* isPackageAt(scope, absolute)) ? O.some([literal, absolute] as const) : O.none();
});

/**
 * Literals: an exact lookup, no directory read at all.
 *
 * **Details**
 *
 * `Effect.forEach` defaults to concurrency 1, so the explicit bound is what
 * lets independent `package.json` existence probes overlap.
 */
const includeLiterals = Effect.fnUntraced(function* (scope: EnumerationScope, literals: ReadonlyArray<string>) {
  const hits = yield* Effect.forEach(literals, (literal) => literalHit(scope, literal), { concurrency: 10 });
  for (const [relative, absolute] of A.getSomes(hits)) MutableHashMap.set(scope.included, relative, absolute);
});

/**
 * One frame's directory listing.
 *
 * **Details**
 *
 * A directory that vanished between the parent's listing and this read is a
 * benign race — treat it as empty. Anything else (permission denied, an IO
 * error) means a subtree we were asked to enumerate is unreadable, and
 * answering with "no packages there" would be a WRONG ANSWER dressed as an
 * empty one.
 *
 * This is deliberately NOT `@beep/walker`'s per-probe absorption. Walker
 * absorbs because one unreadable ANCESTOR must not hide a valid root above it
 * — the walk continues upward and can still succeed. This is DOWNWARD
 * enumeration: a swallowed subtree is silently missing membership, which is
 * the same silent-degradation shape as the trailing-`/**` bug this module
 * exists to fix.
 */
const readFrame = (
  scope: EnumerationScope,
  wildcard: GlobPattern,
  frame: TraversalFrame
): Effect.Effect<ReadonlyArray<string>, EnumerationFailure> =>
  scope.fs.readDirectory(frame.absolute).pipe(
    Effect.catch((error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed<ReadonlyArray<string>>([])
        : Effect.fail<EnumerationFailure>({
            kind: "unreadableDirectory",
            pattern: wildcard.source,
            detail: frame.relative === "" ? scope.root : frame.relative,
          })
    )
  );

/**
 * One listed entry: include it when it is a selected package, and descend
 * into it when the pattern crosses segments.
 *
 * **Details**
 *
 * Depth is checked BEFORE acceptance, not merely before descent. The cap
 * bounds what the traversal ENUMERATES; a directory past it is out of scope
 * entirely. Gating only the descent is what let the sync copy return a package
 * one level beyond the cap that this path rejected. Only a segment-crossing
 * pattern earns a descent: `packages/*` reads one level, correctly for that
 * pattern.
 */
const visitEntry = Effect.fnUntraced(function* (
  scope: EnumerationScope,
  wildcard: GlobPattern,
  traversal: Traversal,
  frame: TraversalFrame,
  entry: string
) {
  if (isPruned(entry) || scope.skipsPath(entry)) return;
  const relative = joinRelative(frame.relative, entry);
  const absolute = scope.path.join(frame.absolute, entry);
  if (!(yield* isAdmittedDirectoryAt(scope, absolute))) return;
  if (wildcard.crossesSegments && !traversal.admits(frame)) {
    return yield* Effect.fail(failureOf(traversal.depthStop(), wildcard.source));
  }
  if (wildcard.matches(relative) && !scope.isExcluded(relative) && (yield* isPackageAt(scope, absolute))) {
    MutableHashMap.set(scope.included, relative, absolute);
  }
  if (wildcard.crossesSegments) traversal.push(frame, relative, absolute);
});

/** An absent wildcard base: a `missingBaseDir` failure, or nothing at all with `skipMissingBaseDirs`. */
const missingBase = (
  scope: EnumerationScope,
  wildcard: GlobPattern,
  base: string
): Effect.Effect<void, EnumerationFailure> =>
  scope.skipMissingBaseDirs
    ? Effect.void
    : Effect.fail({ kind: "missingBaseDir", pattern: wildcard.source, detail: base === "" ? scope.root : base });

/**
 * Whether the wildcard base `absolute` is a directory.
 *
 * **Details**
 *
 * Only a confirmed absence reads as "no directory": a `stat` that fails
 * `NotFound`, or an entry that is not a directory. Any other `stat` failure
 * (permission denied, an I/O error) fails `unreadableDirectory`, as an
 * unreadable frame does, so `skipMissingBaseDirs` cannot turn an unreadable
 * base into an empty selection.
 */
const isBaseDirectoryAt = (
  scope: EnumerationScope,
  wildcard: GlobPattern,
  base: string,
  absolute: string
): Effect.Effect<boolean, EnumerationFailure> =>
  scope.fs.stat(absolute).pipe(
    Effect.map((info) => info.type === "Directory"),
    Effect.catch((error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(false)
        : Effect.fail<EnumerationFailure>({
            kind: "unreadableDirectory",
            pattern: wildcard.source,
            detail: base === "" ? scope.root : base,
          })
    )
  );

/**
 * One wildcard include, walked with THE shared traversal — the same state
 * machine `WorkspacesSync` drives.
 *
 * **Details**
 *
 * A missing enumeration base fails: that is what catches a typo in
 * `packages:` instead of silently discovering nothing. With
 * `skipMissingBaseDirs` it selects nothing instead, as a filesystem glob
 * does: git keeps no empty directory, so a base whose last member was
 * deleted is absent from a fresh checkout. A base that cannot be read fails
 * `unreadableDirectory` either way, and a base under a skipped directory name
 * selects nothing before it is probed.
 */
const enumerateWildcard = Effect.fnUntraced(function* (scope: EnumerationScope, wildcard: GlobPattern) {
  const base = baseOf(wildcard);
  if (scope.skipsPath(base)) return;
  const absoluteBase = scope.path.join(scope.root, base);
  if (!(yield* isBaseDirectoryAt(scope, wildcard, base, absoluteBase)))
    return yield* missingBase(scope, wildcard, base);
  // A base that exists but leaves the root is not a typo: there is simply
  // nothing inside the root to enumerate under it.
  if (!(yield* scope.contains(absoluteBase))) return;
  const traversal = new Traversal(base, absoluteBase, scope.maxDepth);
  for (let current = traversal.next(); current !== undefined; current = traversal.next()) {
    const spent = traversal.charge();
    if (spent !== undefined) return yield* Effect.fail(failureOf(spent, wildcard.source));
    const frame = current;
    const entries = yield* readFrame(scope, wildcard, frame);
    yield* Effect.forEach(entries, (entry) => visitEntry(scope, wildcard, traversal, frame, entry), {
      discard: true,
    });
  }
});

/**
 * Enumerates the workspace directories a compiled `packages:` set selects.
 *
 * **Details**
 *
 * Every returned directory holds a `package.json`, matches at least one include
 * (literal or wildcard), and is rejected by no exclude. Results are sorted by
 * relative path. With `containWithinRoot`, a literal member, a wildcard base or
 * a listed directory whose real path leaves the root's real path is skipped
 * before it is probed for a `package.json` or descended into. With
 * `skipMissingBaseDirs`, a wildcard whose base directory is absent (its
 * `stat` fails `NotFound`, or it is not a directory) selects nothing instead
 * of failing with `missingBaseDir`; any other base `stat` failure fails
 * `unreadableDirectory` whatever the option says. With `skipDirectoryNames`,
 * a literal, a wildcard base or a listed directory with a segment of that
 * list is skipped before it is probed for a `package.json` or descended into.
 *
 * **Gotchas**
 *
 * Execution requires `FileSystem` and `Path` services. An invalid `maxDepth`
 * is a programmer error reported as a defect, outside the typed failure channel.
 *
 * **Example** (Construct a workspace enumeration)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { GlobSet } from "@beep/glob/GlobSet"
 * import { enumerate } from "@beep/repo-workspaces/internal/enumerate"
 *
 * const globs = Effect.runSync(GlobSet.compile(["packages/*"]))
 * const program = enumerate("/workspace", globs, { maxDepth: 2 })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const enumerate: {
  (
    globs: GlobSet,
    options?: EnumerateOptions.Encoded
  ): (
    root: string
  ) => Effect.Effect<ReadonlyArray<EnumeratedDirectory>, EnumerationFailure, FileSystem.FileSystem | Path.Path>;
  (
    root: string,
    globs: GlobSet,
    options?: EnumerateOptions.Encoded
  ): Effect.Effect<ReadonlyArray<EnumeratedDirectory>, EnumerationFailure, FileSystem.FileSystem | Path.Path>;
} = dual(
  (args) => P.isString(args[0]) && args.length >= 2,
  Effect.fnUntraced(function* (
    root: string,
    globs: GlobSet,
    options?: EnumerateOptions.Encoded
  ): Effect.fn.Return<ReadonlyArray<EnumeratedDirectory>, EnumerationFailure, FileSystem.FileSystem | Path.Path> {
    const maxDepth = options?.maxDepth ?? MAX_ENUMERATION_DEPTH;
    // A bad bound is a PROGRAMMER error, not a data condition — a defect, not a
    // typed failure. The predicate is shared with the sync hatch so the two
    // entry points cannot disagree about what a valid bound is.
    if (!isValidMaxDepth(maxDepth)) {
      return yield* Effect.die(EnumerationOptionsError.make({ message: `enumerate: ${badMaxDepthMessage(maxDepth)}` }));
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const scope: EnumerationScope = {
      contains: yield* containmentOf(fs, path, root, options?.containWithinRoot ?? false),
      fs,
      path,
      root,
      maxDepth,
      included: MutableHashMap.empty<string, string>(),
      isExcluded: excludedBy(globs.excludes),
      skipMissingBaseDirs: options?.skipMissingBaseDirs ?? false,
      skipsPath: skipsPathOf(options?.skipDirectoryNames ?? []),
    };
    yield* includeLiterals(scope, globs.literals);
    yield* Effect.forEach(globs.wildcards, (wildcard) => enumerateWildcard(scope, wildcard), { discard: true });
    return A.sort(
      A.map([...scope.included], ([relativePath, absolute]) =>
        EnumeratedDirectory.make({ relativePath, path: absolute })
      ),
      Order.mapInput(Str.Order, (entry: EnumeratedDirectory) => entry.relativePath)
    );
  })
);
