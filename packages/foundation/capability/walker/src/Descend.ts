/**
 * Downward glob-file descent: the files a compiled glob pattern selects under a directory.
 *
 * **Details**
 *
 * `@beep/glob` is a pure matching engine with no filesystem walker, so "files
 * matching a glob under a directory" lives here. The walker is semantics-free:
 * dotfile behavior, case folding and every other matching option are carried
 * by the COMPILED pattern the caller hands in. This module never re-derives
 * options; it only reads `literalPath`, `negated` and `enumerationPrefix` and
 * calls `matches` and `mayMatchBelow`. It is walker's first module with a
 * typed error channel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WalkerId } from "@beep/identity/packages";
import * as LiteralKit from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { quoteJson } from "./internal/quote.ts";
import { parentRealPath, walkFrames } from "./internal/worklist.ts";
import { DepthCap } from "./Walker.ts";
import type { GlobPattern } from "@beep/glob/GlobPattern";

const $I = $WalkerId.create("Descend");

const OnUnreadable = LiteralKit.LiteralKit(["fail", "skip", "record"]).pipe(
  $I.annoteSchema("OnUnreadable", { description: "How unreadable traversal directories are handled." })
);
type OnUnreadable = typeof OnUnreadable.Type;
/**
 * Unreadable-directory modes that return a plain array of matches.
 *
 * **Example** (Validate an array-returning mode)
 *
 * ```ts
 * import { OnUnreadableArray } from "@beep/walker/Descend";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(OnUnreadableArray)("skip")) // true
 * console.log(S.is(OnUnreadableArray)("record")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OnUnreadableArray = OnUnreadable.pick(["fail", "skip"]);
/**
 * Unreadable-directory policy for a traversal returning a match array.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OnUnreadableArray = typeof OnUnreadableArray.Type;
const OnUnreadableRecord = OnUnreadable.pick(["record"]);

const OnStatError = LiteralKit.LiteralKit(["skip", "fail"]).pipe(
  $I.annoteSchema("OnStatError", { description: "Whether non-NotFound stat failures are skipped or fail descent." })
);
type OnStatError = typeof OnStatError.Type;

const DescendErrorReason = LiteralKit.LiteralKit(["unreadableDirectory", "depthExceeded", "statFailed"]).pipe(
  $I.annoteSchema("DescendErrorReason", { description: "Why downward traversal failed." })
);
const DescendFailure = DescendErrorReason.mapMembers(
  ([unreadable, depth, stat]) =>
    [
      S.Struct({ reason: unreadable }),
      S.Struct({ reason: stat }),
      S.Struct({
        reason: depth,
        limit: S.Option(S.Finite).pipe(
          $I.annoteKey("DescendFailure.limit", { description: "The optional cap for depth exhaustion." })
        ),
      }),
    ] as const
).pipe(
  $I.annoteSchema("DescendFailure", { description: "Internal case-specific descent failure payload." }),
  S.toTaggedUnion("reason")
);
type DescendFailure = typeof DescendFailure.Type;

class DescendDefect extends S.TaggedError<DescendDefect, { readonly brand: unique symbol }>($I`DescendDefect`)(
  "DescendDefect",
  { message: S.String },
  $I.annoteError<DescendDefect>("DescendDefect", { description: "Invalid downward traversal wiring." })
) {}

const descendOptionFields = {
  cwd: S.String.pipe(
    $I.annoteKey("DescendOptions.cwd", { description: "Absolute directory the pattern is resolved against." })
  ),
  followSymlinks: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("DescendOptions.followSymlinks", {
      description: "Whether symlinked directories are followed with per-branch cycle safety.",
    })
  ),
  onStatError: S.optionalKey(OnStatError).pipe(
    $I.annoteKey("DescendOptions.onStatError", {
      description: "Whether non-NotFound stat failures are skipped (default) or fail typed.",
    })
  ),
  maxDepth: S.optionalKey(DepthCap).pipe(
    $I.annoteKey("DescendOptions.maxDepth", { description: "Hard cap on directory depth below the literal prefix." })
  ),
  prune: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("DescendOptions.prune", { description: "Directory names never descended into." })
  ),
};

/**
 * **Details**
 *
 * `onUnreadable` admits `"fail"` and `"skip"` only. `descend` accepts the
 * unbranded `DescendOptions.Encoded` shape, so a caller passes an object literal.
 *
 * `cwd` is required: the walk never reads `process.cwd()`. `maxDepth`
 * defaults to 256 levels below the pattern's literal prefix. `prune` defaults
 * to `["node_modules", ".git"]`, a custom list replaces that default, and it
 * suppresses directories only, so a file named `.git` (a gitlink) stays
 * matchable. `onStatError` is independent of `onUnreadable`: under `"fail"`
 * every listed entry is stat'ed before matching or pruning, yet pruned and
 * unreachable directories are still never entered.
 *
 * **Example** (Construct array-returning descent options)
 *
 * ```ts
 * import { DescendOptions } from "@beep/walker/Descend";
 *
 * const options = DescendOptions.make({ cwd: "/repo", onUnreadable: "skip" });
 * console.log(options.onUnreadable) // skip
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class DescendOptions extends S.Opaque<DescendOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...descendOptionFields,
    /**
     * What an unreadable directory mid-walk does. `"fail"` (the default) fails
     * typed — downward enumeration must not silently swallow a subtree, or the
     * answer is silently missing membership dressed as an empty one. `"skip"`
     * absorbs the failure and continues, discarding which directory it was.
     * To collect the offending directories instead of discarding them, pass
     * {@link DescendRecordOptions} — `"record"` is deliberately NOT a member
     * here, because this type is the options contract of the overload that
     * returns a bare match array.
     */
    onUnreadable: S.optionalKey(OnUnreadableArray).pipe(
      $I.annoteKey("DescendOptions.onUnreadable", {
        description: "Whether unreadable directories fail or are skipped; record mode is excluded.",
      })
    ),
  }).pipe($I.annoteSchema("DescendOptions", { description: "Downward traversal options for array-returning descent." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DescendOptions {
  /**
   * The plain, unbranded options shape `descend` accepts for array-returning descent.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DescendOptions.Encoded;
}

/**
 * Options for `descend` under `onUnreadable: "record"`: every
 * {@link DescendOptions} field, with `onUnreadable` fixed to `"record"`.
 *
 * **Details**
 *
 * A separate type rather than `DescendOptions & { onUnreadable: "record" }`,
 * because the two options types are the discriminator between two different
 * RETURN types. If `DescendOptions` itself admitted `"record"`, a value
 * widened to `DescendOptions` — annotated as such, or passed through a
 * function taking it — would select the array-returning overload at compile
 * time while the implementation resolved a {@link DescendResult} at runtime,
 * and every array method on that result would fail with no type error
 * anywhere. Keeping `"record"` out of `DescendOptions` makes that
 * unrepresentable.
 *
 * **Example** (Construct record-mode descent options)
 *
 * ```ts
 * import { DescendRecordOptions } from "@beep/walker/Descend";
 *
 * const options = DescendRecordOptions.make({ cwd: "/repo", onUnreadable: "record" });
 * console.log(options.onUnreadable) // record
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class DescendRecordOptions extends S.Opaque<DescendRecordOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...descendOptionFields,
    /** Collect every unreadable directory rather than failing or discarding it. */
    onUnreadable: OnUnreadableRecord.pipe(
      $I.annoteKey("DescendRecordOptions.onUnreadable", {
        description: "Collect every unreadable directory rather than failing or discarding it.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DescendRecordOptions", {
      description: "Downward traversal options for record-mode descent, which returns a DescendResult.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DescendRecordOptions {
  /**
   * The plain, unbranded options shape `descend` accepts for record-mode descent.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DescendRecordOptions.Encoded;
}

/**
 * One directory `descend` could not read under `onUnreadable: "record"`: its
 * `cwd`-relative path and the `PlatformError` that `readDirectory` — or,
 * for a symlinked directory under `followSymlinks`, `realPath` — failed
 * with. The cause is the very failure the walk absorbed, so a caller that
 * must report WHY a directory was unreadable never re-reads it.
 *
 * **Example** (Validate an unreadable directory record)
 *
 * ```ts
 * import { UnreadableDirectory } from "@beep/walker/Descend";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(UnreadableDirectory)({ path: "src", cause: "permission denied" })) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class UnreadableDirectory extends S.Opaque<UnreadableDirectory, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The directory's path relative to `cwd`, POSIX separators.
     *
     * **Gotchas**
     *
     * **The walk base appears as the empty string `""`**, since its own
     * `cwd`-relative path is empty — so an unreadable base yields
     * `{ matches: [], unreadable: [{ path: "", cause }] }`. Code matching
     * these entries as ordinary paths will not expect that; special-case it.
     */
    path: S.String.pipe(
      $I.annoteKey("UnreadableDirectory.path", {
        description: "The cwd-relative POSIX directory path; the base is an empty string.",
      })
    ),
    /** The `readDirectory` (or, for a link under `followSymlinks`, `realPath`) failure, never `NotFound` (a vanished directory is a benign race and is not recorded). */
    cause: S.instanceOf(PlatformError.PlatformError).pipe(
      $I.annoteKey("UnreadableDirectory.cause", { description: "The absorbed readDirectory or realPath failure." })
    ),
  }).pipe(
    $I.annoteSchema("UnreadableDirectory", {
      description: "An unreadable directory and its original filesystem failure.",
    })
  )
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnreadableDirectory {
  /**
   * The plain, unbranded shape of a {@link UnreadableDirectory}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UnreadableDirectory.Encoded;
}

/**
 * `descend`'s success value under `onUnreadable: "record"`: the matched
 * FILE paths plus an {@link UnreadableDirectory} for every mid-walk
 * directory whose `readDirectory` (or, under `followSymlinks`, a symlinked
 * directory whose `realPath`) failed for a reason other than `NotFound` (a
 * vanished directory stays a benign race in every mode and is never
 * recorded).
 *
 * **Example** (Inspect an empty recorded result)
 *
 * ```ts
 * import { DescendResult } from "@beep/walker/Descend";
 *
 * const result = DescendResult.make({ matches: [], unreadable: [] });
 * console.log(result.matches.length) // 0
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class DescendResult extends S.Opaque<DescendResult, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Matching FILE paths relative to `cwd`, POSIX separators, sorted — identical in shape to the `"fail"`/`"skip"` success value. */
    matches: S.Array(S.String).pipe(
      $I.annoteKey("DescendResult.matches", {
        description: "Matching cwd-relative POSIX file paths, in lexical order.",
      })
    ),
    /** Directories that could not be read, each with its cause, in walk order. */
    unreadable: S.Array(UnreadableDirectory).pipe(
      $I.annoteKey("DescendResult.unreadable", {
        description: "Unreadable directories and their causes, in walk order.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DescendResult", { description: "Matches and unreadable directories collected in record mode." })
  )
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DescendResult {
  /**
   * The plain, unbranded shape of a {@link DescendResult}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DescendResult.Encoded;
}

/**
 * **Example** (Report an unreadable directory)
 *
 * ```ts
 * import { DescendError } from "@beep/walker/Descend";
 *
 * const error = DescendError.make({ pattern: "src/*.ts", reason: "unreadableDirectory", path: "src" });
 * console.log(error.message) // glob descent for "src/*.ts" could not read "src"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class DescendError extends S.TaggedError<DescendError, { readonly brand: unique symbol }>($I`DescendError`)(
  "DescendError",
  {
    /** The glob pattern's source text. */
    pattern: S.String.pipe($I.annoteKey("DescendError.pattern", { description: "The glob pattern's source text." })),
    /** Why the walk failed: directory read, strict stat, or depth exhaustion. */
    reason: DescendErrorReason.pipe(
      $I.annoteKey("DescendError.reason", {
        description: "Why the walk failed: directory read, strict stat, or depth exhaustion.",
      })
    ),
    /** The offending path, relative to `cwd` (`""` is the walk's base). */
    path: S.String.pipe(
      $I.annoteKey("DescendError.path", {
        description: 'The offending path, relative to `cwd` (`""` is the walk\'s base).',
      })
    ),
    /** The original filesystem stat failure, present for `"statFailed"`. */
    cause: S.optionalKey(S.instanceOf(PlatformError.PlatformError)).pipe(
      $I.annoteKey("DescendError.cause", { description: "The original filesystem failure for strict stat errors." })
    ),
    /** The depth cap, present when `reason` is `"depthExceeded"`. */
    limit: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("DescendError.limit", { description: 'The depth cap, present when `reason` is `"depthExceeded"`.' })
    ),
  },
  $I.annoteError<DescendError>("DescendError", {
    description:
      "Typed failure raised by `descend`: a directory mid-walk was unreadable, a strict stat failed, or the walk descended past `maxDepth`. Depth exhaustion is a typed failure, never a truncation — silent truncation silently changes match semantics.",
  })
) {
  /**
   * Formats the pattern and offending directory into a readable descent failure.
   *
   * **Details**
   *
   * An empty directory path is shown as the base directory; depth failures include the supplied cap when present.
   *
   * **Example** (Read a descent failure message)
   *
   * ```ts
   * import { DescendError } from "@beep/walker/Descend";
   *
   * const error = DescendError.make({ pattern: "src/*.ts", reason: "unreadableDirectory", path: "src" });
   * console.log(error.message) // glob descent for "src/*.ts" could not read "src"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const failure: DescendFailure = DescendErrorReason.match(this.reason, {
      unreadableDirectory: (reason) => DescendFailure.cases.unreadableDirectory.make({ reason }),
      statFailed: (reason) => DescendFailure.cases.statFailed.make({ reason }),
      depthExceeded: (reason) =>
        DescendFailure.cases.depthExceeded.make({ reason, limit: O.fromNullishOr(this.limit) }),
    });
    const where = this.path === "" ? "the base directory" : quoteJson(this.path);
    const pattern = quoteJson(this.pattern);
    return DescendFailure.match(failure, {
      unreadableDirectory: () => `glob descent for ${pattern} could not read ${where}`,
      statFailed: () => `glob descent for ${pattern} could not stat ${where}`,
      depthExceeded: ({ limit }) =>
        `glob descent for ${pattern} descended past ${O.getOrElse(limit, () => "the depth cap")} levels below ${where}`,
    });
  }
}

const DEFAULT_PRUNE: ReadonlyArray<string> = ["node_modules", ".git"];

const escapesCwd = (relative: string): boolean =>
  pipe(
    Str.split(relative, "/"),
    A.filter((segment) => segment !== "" && segment !== "."),
    A.scan(0, (depth, segment) => depth + (segment === ".." ? -1 : 1)),
    A.some((depth) => depth < 0)
  );

const NO_ANCESTORS: ReadonlyArray<string> = [];

const DescendFrame = S.Struct({
  relative: S.String.pipe($I.annoteKey("DescendFrame.relative", { description: "The cwd-relative POSIX path." })),
  absolute: S.String.pipe(
    $I.annoteKey("DescendFrame.absolute", { description: "The absolute directory path to read." })
  ),
  depth: S.Finite.pipe($I.annoteKey("DescendFrame.depth", { description: "Directory depth below the walk base." })),
  ancestors: S.Array(S.String).pipe(
    $I.annoteKey("DescendFrame.ancestors", { description: "Real paths on this branch's ancestor chain." })
  ),
}).pipe($I.annoteSchema("DescendFrame", { description: "A queued directory and its per-branch cycle guard." }));
type DescendFrame = typeof DescendFrame.Type;

type DescendAnyOptions = Omit<DescendOptions.Encoded, "onUnreadable"> & {
  readonly onUnreadable?: OnUnreadable;
};

type DescendSettings = {
  readonly pattern: GlobPattern;
  readonly cwd: string;
  readonly maxDepth: number;
  readonly prune: HashSet.HashSet<string>;
  readonly onUnreadable: OnUnreadable;
  readonly onStatError: OnStatError;
  readonly followSymlinks: boolean;
  readonly unreadable: Array<UnreadableDirectory>;
};

const ENTRY_CONCURRENCY = 16;

type DescendSinks = {
  readonly results: Array<string>;
  readonly frames: Array<DescendFrame>;
};

const settingsOf = (pattern: GlobPattern, options: DescendAnyOptions): DescendSettings => ({
  pattern,
  cwd: options.cwd,
  maxDepth: options.maxDepth ?? 256,
  prune: HashSet.fromIterable(options.prune ?? DEFAULT_PRUNE),
  onUnreadable: options.onUnreadable ?? "fail",
  onStatError: options.onStatError ?? "skip",
  followSymlinks: options.followSymlinks ?? false,
  unreadable: [],
});

const isFileKind = (kind: FileSystem.File.Info["type"]): boolean => kind === "File";
const isDirectoryKind = (kind: FileSystem.File.Info["type"]): boolean => kind === "Directory";

const typeOf = Effect.fnUntraced(function* (settings: DescendSettings, absolute: string, relative: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(absolute).pipe(
    Effect.map((info) => info.type),
    Effect.asSome,
    Effect.catch((cause) =>
      cause.reason._tag === "NotFound" || OnStatError.is.skip(settings.onStatError)
        ? Effect.succeedNone
        : Effect.fail(
            DescendError.make({ pattern: settings.pattern.source, reason: "statFailed", path: relative, cause })
          )
    )
  );
});

const isSymbolicLink = Effect.fnUntraced(function* (absolute: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readLink(absolute).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
});

const absorbUnreadable =
  <A>(settings: DescendSettings, relative: string, empty: A) =>
  (error: PlatformError.PlatformError): Effect.Effect<A, DescendError> => {
    if (error.reason._tag === "NotFound") return Effect.succeed(empty);
    if (OnUnreadable.is.fail(settings.onUnreadable)) {
      return Effect.fail(
        DescendError.make({ pattern: settings.pattern.source, reason: "unreadableDirectory", path: relative })
      );
    }
    if (OnUnreadable.is.record(settings.onUnreadable)) {
      settings.unreadable.push(UnreadableDirectory.make({ path: relative, cause: error }));
    }
    return Effect.succeed(empty);
  };

// decision: descend-symlink-cycle-guard
const realPathOf = Effect.fnUntraced(function* (settings: DescendSettings, absolute: string, relative: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .realPath(absolute)
    .pipe(Effect.asSome, Effect.catch(absorbUnreadable(settings, relative, O.none<string>())));
});

const readEntries = Effect.fnUntraced(function* (settings: DescendSettings, frame: DescendFrame) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readDirectory(frame.absolute)
    .pipe(Effect.catch(absorbUnreadable(settings, frame.relative, A.empty<string>())));
});

const finish = (settings: DescendSettings, matches: ReadonlyArray<string>): ReadonlyArray<string> | DescendResult =>
  OnUnreadable.is.record(settings.onUnreadable)
    ? DescendResult.make({ matches, unreadable: settings.unreadable })
    : matches;

const literalMatches = Effect.fnUntraced(function* (settings: DescendSettings, literal: string) {
  const path = yield* Path.Path;
  if (escapesCwd(literal)) return A.empty<string>();
  const typeOf1 = yield* typeOf(settings, path.join(settings.cwd, literal), literal);
  return O.exists(typeOf1, isFileKind) ? A.of(literal) : A.empty<string>();
});

const resolveBase = Effect.fnUntraced(function* (settings: DescendSettings) {
  const path = yield* Path.Path;
  const base = settings.pattern.negated ? "" : Str.replace(/\/+$/, "")(settings.pattern.enumerationPrefix);
  if (escapesCwd(base)) return O.none<DescendFrame>();
  const absolute = base === "" ? settings.cwd : path.join(settings.cwd, base);
  const typeOf2 = yield* typeOf(settings, absolute, base);
  if (!O.exists(typeOf2, isDirectoryKind)) return O.none<DescendFrame>();
  if (!settings.followSymlinks)
    return O.some<DescendFrame>({ relative: base, absolute, depth: 0, ancestors: NO_ANCESTORS });
  const real = yield* realPathOf(settings, absolute, base);
  return O.map(real, (real): DescendFrame => ({ relative: base, absolute, depth: 0, ancestors: A.of(real) }));
});

// decision: descend-symlink-cycle-guard
const childAncestors = Effect.fnUntraced(function* (
  settings: DescendSettings,
  frame: DescendFrame,
  entry: string,
  relative: string,
  absolute: string
) {
  const path = yield* Path.Path;
  const linked = yield* isSymbolicLink(absolute);
  if (!settings.followSymlinks) return linked ? O.none<ReadonlyArray<string>>() : O.some(frame.ancestors);
  const real = linked
    ? yield* realPathOf(settings, absolute, relative)
    : O.some(path.join(parentRealPath(frame.ancestors, frame.absolute), entry));
  return pipe(
    real,
    O.filter((real) => !A.contains(frame.ancestors, real)),
    O.map((real) => A.append(frame.ancestors, real))
  );
});

const enqueueChild = Effect.fnUntraced(function* (
  settings: DescendSettings,
  frame: DescendFrame,
  entry: string,
  relative: string,
  absolute: string
) {
  const ancestors = yield* childAncestors(settings, frame, entry, relative, absolute);
  if (O.isNone(ancestors)) return O.none<DescendFrame>();
  if (frame.depth + 1 > settings.maxDepth) {
    return yield* DescendError.make({
      pattern: settings.pattern.source,
      reason: "depthExceeded",
      path: frame.relative,
      limit: settings.maxDepth,
    });
  }
  return O.some<DescendFrame>({ relative, absolute, depth: frame.depth + 1, ancestors: ancestors.value });
});

const isDescendable = (settings: DescendSettings, entry: string, relative: string): boolean =>
  !HashSet.has(settings.prune, entry) && settings.pattern.mayMatchBelow(relative);

const classifyEntry = Effect.fnUntraced(function* (settings: DescendSettings, frame: DescendFrame, entry: string) {
  const relative = frame.relative === "" ? entry : `${frame.relative}/${entry}`;
  const file = settings.pattern.matches(relative);
  const directory = isDescendable(settings, entry, relative);
  if (!file && !directory && OnStatError.is.skip(settings.onStatError)) return O.none<string | DescendFrame>();
  const path = yield* Path.Path;
  const absolute = path.join(frame.absolute, entry);
  const kind = yield* typeOf(settings, absolute, relative);
  if (file && O.exists(kind, isFileKind)) return O.some<string | DescendFrame>(relative);
  if (!directory || !O.exists(kind, isDirectoryKind)) return O.none<string | DescendFrame>();
  return yield* enqueueChild(settings, frame, entry, relative, absolute);
});

const collectOutcomes = (sinks: DescendSinks, outcomes: ReadonlyArray<O.Option<string | DescendFrame>>): void => {
  for (const outcome of outcomes) {
    if (O.isNone(outcome)) continue;
    if (P.isString(outcome.value)) sinks.results.push(outcome.value);
    else sinks.frames.push(outcome.value);
  }
};

const descendImpl: (
  pattern: GlobPattern,
  options: DescendAnyOptions
) => Effect.Effect<ReadonlyArray<string> | DescendResult, DescendError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "Walker.descend"
)(function* (pattern: GlobPattern, options: DescendAnyOptions) {
  const settings = settingsOf(pattern, options);
  if (!S.is(DepthCap)(settings.maxDepth)) {
    return yield* Effect.die(
      DescendDefect.make({
        message: `Walker.descend: maxDepth must be a positive integer, received ${settings.maxDepth}`,
      })
    );
  }
  const literal = pattern.literalPath;
  if (O.isSome(literal)) {
    const literalMatches1 = yield* literalMatches(settings, literal.value);
    return finish(settings, literalMatches1);
  }
  const root = yield* resolveBase(settings);
  if (O.isNone(root)) return finish(settings, A.empty());
  const sinks: DescendSinks = { results: [], frames: [root.value] };
  for (const frame of walkFrames(sinks.frames)) {
    const entries = yield* readEntries(settings, frame);
    const outcomes = yield* Effect.forEach(entries, (entry) => classifyEntry(settings, frame, entry), {
      concurrency: ENTRY_CONCURRENCY,
    });
    collectOutcomes(sinks, outcomes);
  }
  return finish(settings, A.sort(sinks.results, Order.String));
});

/**
 * Expand a compiled glob pattern against the filesystem, returning matching
 * FILE paths relative to `cwd` (POSIX separators), sorted by relative path.
 *
 * **Details**
 *
 * A literal pattern (one that names a single path, `GlobPattern.literalPath`)
 * fast-paths to a single stat: the result is that path when it resolves to a
 * file, `[]` otherwise — a missing path is zero matches, not an error. A brace
 * pattern names several paths and walks. Any other pattern walks from its literal
 * directory prefix (`GlobPattern.enumerationPrefix`); a NEGATED pattern can
 * match paths outside that prefix, so it walks from `cwd` itself. A missing
 * base directory is likewise an empty result, because zero matches is a
 * normal glob answer — as is any pattern that lexically climbs above `cwd`
 * via `..` segments (walked paths never contain `..`). "Never reads outside
 * its documented root" holds lexically always, and physically only while
 * `followSymlinks` is off: under it, a link whose target lives outside `cwd`
 * is descended, exactly as `@actions/glob` follows links out of the tree.
 * Stat failures are skipped by default; `onStatError: "fail"` preserves
 * non-`NotFound` failures as `"statFailed"` with the original filesystem cause.
 * An unreadable directory mid-walk
 * (under the default `onUnreadable: "fail"`) or a walk past `maxDepth` also fails,
 * typed as {@link DescendError}.
 *
 * Only files match. A symlink counts when it stat-resolves to a file
 * (`FileSystem.stat` follows links, as node's does); a symlinked directory is
 * never descended into by default (cycle safety — detected by a `readLink`
 * probe), unless `followSymlinks: true` asks for it, which follows links under
 * `@actions/glob`'s `traversalChain` cycle guard: a directory is a cycle only
 * when its real path is already an ancestor of the current branch, so sibling
 * links resolving to the same target both enumerate. A link whose real path
 * cannot be resolved is never entered, and a resolution failure other than
 * `NotFound` is an unreadable directory under `onUnreadable`. A dangling
 * symlink is not a match. A
 * directory that vanishes between its parent's listing and its own read is a
 * benign race and reads as empty. A directory is entered only when the
 * pattern could still match below it (`GlobPattern.mayMatchBelow`), so a
 * single-level pattern reads one level, a brace pattern walks only its
 * alternatives' branches, and under the default `dot: false` a dot-directory
 * is never entered by a wildcard. An entry the pattern can neither match nor
 * descend through costs no `stat`.
 *
 * The descent is a worklist, not a recursion — it cannot overflow the stack —
 * dequeued by head index, never `Array.shift()`. Like `ascend`, `maxDepth`
 * must be a positive integer: anything else is a defect, never a
 * silently-empty result.
 *
 * Passing `onUnreadable: "record"` resolves to a {@link DescendResult}
 * instead: the matched files plus each unreadable directory and its cause.
 * The walk continues past those directories as under "skip", retaining their
 * failures for the caller.
 *
 * **Example** (Expand a compiled glob pattern)
 *
 * ```ts
 * import { GlobPattern } from "@beep/glob/GlobPattern";
 * import { descend } from "@beep/walker/Descend";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pattern = yield* GlobPattern.compile("src/*.ts");
 *   return yield* descend(pattern, { cwd: "/repo" });
 * });
 * // Sorted, cwd-relative POSIX paths of the matching files.
 * // Requires `FileSystem` and `Path` from the platform layer.
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export const descend: {
  (
    pattern: GlobPattern,
    options: DescendRecordOptions.Encoded
  ): Effect.Effect<DescendResult, DescendError, FileSystem.FileSystem | Path.Path>;
  (
    pattern: GlobPattern,
    options: DescendOptions.Encoded
  ): Effect.Effect<ReadonlyArray<string>, DescendError, FileSystem.FileSystem | Path.Path>;
  (
    options: DescendRecordOptions.Encoded
  ): (pattern: GlobPattern) => Effect.Effect<DescendResult, DescendError, FileSystem.FileSystem | Path.Path>;
  (
    options: DescendOptions.Encoded
  ): (pattern: GlobPattern) => Effect.Effect<ReadonlyArray<string>, DescendError, FileSystem.FileSystem | Path.Path>;
} = dual(2, descendImpl);
