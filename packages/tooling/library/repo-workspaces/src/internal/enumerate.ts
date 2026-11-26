import { $RepoWorkspacesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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
 * @category type-level
 * @since 0.0.0
 */
export type EnumerationFailureKind = typeof EnumerationFailureKind.Type;

const plainFailureCaseNoDefault = <const Kind extends EnumerationFailureKind>(kind: S.Literal<Kind>) => {
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
    plainFailureCaseNoDefault(missingBaseDir),
    plainFailureCaseNoDefault(depthExceeded),
    plainFailureCaseNoDefault(budgetExceeded),
    plainFailureCaseNoDefault(unreadableDirectory),
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
          "Whether a wildcard whose enumeration base directory is absent selects nothing instead of failing, as a filesystem glob does: git keeps no empty directory, so a base whose last member was deleted is absent from a fresh checkout.",
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

const isPackageAt = (scope: EnumerationScope, absolute: string): Effect.Effect<boolean> =>
  scope.fs.exists(scope.path.join(absolute, "package.json")).pipe(Effect.orElseSucceed(() => false));

const skipsPathOf = (names: ReadonlyArray<string>): ((relative: string) => boolean) => {
  const skipped = HashSet.fromIterable(names);
  return HashSet.isEmpty(skipped)
    ? () => false
    : (relative) => A.some(Str.split(relative, "/"), (segment) => HashSet.has(skipped, segment));
};

const isDirectoryAt = (scope: EnumerationScope, absolute: string): Effect.Effect<boolean> =>
  scope.fs.stat(absolute).pipe(
    Effect.map((info) => info.type === "Directory"),
    Effect.orElseSucceed(() => false)
  );

const isWithin = (path: Path.Path, canonicalRoot: string, real: string): boolean => {
  const relative = path.relative(canonicalRoot, real);
  return relative !== ".." && !Str.startsWith(`..${path.sep}`)(relative) && !path.isAbsolute(relative);
};

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

const isAdmittedDirectoryAt = (scope: EnumerationScope, absolute: string): Effect.Effect<boolean> =>
  Effect.flatMap(isDirectoryAt(scope, absolute), (directory) =>
    directory ? scope.contains(absolute) : Effect.succeed(false)
  );

const failureOf = (
  stop: { readonly kind: EnumerationFailureKind; readonly detail: string },
  pattern: string
): EnumerationFailure => ({ kind: stop.kind, pattern, detail: stop.detail });

const literalHit = Effect.fnUntraced(function* (
  scope: EnumerationScope,
  literal: string
): Effect.fn.Return<O.Option<readonly [string, string]>> {
  if (scope.isExcluded(literal) || scope.skipsPath(literal)) return O.none();
  const absolute = scope.path.join(scope.root, literal);
  if (!(yield* scope.contains(absolute))) return O.none();
  return (yield* isPackageAt(scope, absolute)) ? O.some([literal, absolute] as const) : O.none();
});

const OVERLAPPING_LITERAL_PROBES = 10;

const includeLiterals = Effect.fnUntraced(function* (scope: EnumerationScope, literals: ReadonlyArray<string>) {
  const hits = yield* Effect.forEach(literals, (literal) => literalHit(scope, literal), {
    concurrency: OVERLAPPING_LITERAL_PROBES,
  });
  for (const [relative, absolute] of A.getSomes(hits)) MutableHashMap.set(scope.included, relative, absolute);
});

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

const skipsEntry = (scope: EnumerationScope, entry: string): boolean => isPruned(entry) || scope.skipsPath(entry);

const isSelectedPackageAt = (
  scope: EnumerationScope,
  wildcard: GlobPattern,
  relative: string,
  absolute: string
): Effect.Effect<boolean> =>
  wildcard.matches(relative) && !scope.isExcluded(relative) ? isPackageAt(scope, absolute) : Effect.succeed(false);

const visitEntry = Effect.fnUntraced(function* (
  scope: EnumerationScope,
  wildcard: GlobPattern,
  traversal: Traversal,
  frame: TraversalFrame,
  entry: string
) {
  if (skipsEntry(scope, entry)) return;
  const relative = joinRelative(frame.relative, entry);
  const absolute = scope.path.join(frame.absolute, entry);
  if (!(yield* isAdmittedDirectoryAt(scope, absolute))) return;
  if (wildcard.crossesSegments && !traversal.admits(frame)) {
    return yield* Effect.fail(failureOf(traversal.depthStop(), wildcard.source));
  }
  if (yield* isSelectedPackageAt(scope, wildcard, relative, absolute)) {
    MutableHashMap.set(scope.included, relative, absolute);
  }
  if (wildcard.crossesSegments) traversal.push(frame, relative, absolute);
});

const missingBase = (
  scope: EnumerationScope,
  wildcard: GlobPattern,
  base: string
): Effect.Effect<void, EnumerationFailure> =>
  scope.skipMissingBaseDirs
    ? Effect.void
    : Effect.fail({ kind: "missingBaseDir", pattern: wildcard.source, detail: base === "" ? scope.root : base });

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

const enumerateWildcard = Effect.fnUntraced(function* (scope: EnumerationScope, wildcard: GlobPattern) {
  const base = baseOf(wildcard);
  if (scope.skipsPath(base)) return;
  const absoluteBase = scope.path.join(scope.root, base);
  if (!(yield* isBaseDirectoryAt(scope, wildcard, base, absoluteBase)))
    return yield* missingBase(scope, wildcard, base);
  if (!(yield* scope.contains(absoluteBase))) return;
  const traversal = new Traversal(base, absoluteBase, scope.maxDepth);
  for (let current = traversal.next(); current !== undefined; current = traversal.next()) {
    const spent = traversal.charge();
    if (spent !== undefined) return yield* Effect.fail(failureOf(spent, wildcard.source));
    const frame = current;
    const entries = yield* readFrame(scope, wildcard, frame);
    yield* Effect.forEach(entries, (entry) => visitEntry(scope, wildcard, traversal, frame, entry), {
      concurrency: 1,
      discard: true,
    });
  }
});

const resolvedOptionsOf = (options: EnumerateOptions.Encoded = {}) => ({
  maxDepth: options.maxDepth ?? MAX_ENUMERATION_DEPTH,
  containWithinRoot: options.containWithinRoot ?? false,
  skipMissingBaseDirs: options.skipMissingBaseDirs ?? false,
  skipDirectoryNames: options.skipDirectoryNames ?? A.empty<string>(),
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
    const { maxDepth, containWithinRoot, skipMissingBaseDirs, skipDirectoryNames } = resolvedOptionsOf(options);
    if (!isValidMaxDepth(maxDepth)) {
      return yield* Effect.die(EnumerationOptionsError.make({ message: `enumerate: ${badMaxDepthMessage(maxDepth)}` }));
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const scope: EnumerationScope = {
      contains: yield* containmentOf(fs, path, root, containWithinRoot),
      fs,
      path,
      root,
      maxDepth,
      included: MutableHashMap.empty<string, string>(),
      isExcluded: excludedBy(globs.excludes),
      skipMissingBaseDirs,
      skipsPath: skipsPathOf(skipDirectoryNames),
    };
    yield* includeLiterals(scope, globs.literals);
    yield* Effect.forEach(globs.wildcards, (wildcard) => enumerateWildcard(scope, wildcard), {
      concurrency: 1,
      discard: true,
    });
    return A.sort(
      A.map([...scope.included], ([relativePath, absolute]) =>
        EnumeratedDirectory.make({ relativePath, path: absolute })
      ),
      Order.mapInput(Str.Order, (entry: EnumeratedDirectory) => entry.relativePath)
    );
  })
);
