/**
 * Glob pattern schemas and file matching service helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UtilsId } from "@beep/identity/packages";
import { Context, Effect, flow, Layer, Match, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import picomatch from "picomatch";
import { readdirSync, statSync } from "./FileSystem.ts";
import * as Path from "./Path.ts";
import { thunk } from "./thunk.ts";
import type { PlatformError } from "effect";

const $I = $UtilsId.create("Glob");

/**
 * Schema for a glob pattern: either a single string or an array of strings.
 *
 * **Example** (Validate pattern with schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Pattern } from "@beep/utils/Glob"
 *
 * const isPattern = S.is(Pattern)
 * console.log(isPattern(["src/*.ts", "test/*.ts"]))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Pattern = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("Pattern", {
    description: "A glob pattern accepted as a single string or an array of strings.",
  })
);

/**
 * A glob pattern: either a single string or an array of strings.
 *
 * **Example** (Annotate pattern variable)
 *
 * ```ts
 * import type { Pattern } from "@beep/utils/Glob"
 *
 * const pattern: Pattern = ["src/*.ts", "test/*.ts"]
 * console.log(pattern)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Pattern = typeof Pattern.Type;

/**
 * Optional runtime flags for glob scans.
 *
 * **Details**
 *
 * Omitted keys remain absent from the encoded form. At runtime they resolve to
 * relative paths, the current working directory, no dotfiles, no ignores, and
 * directory-inclusive results.
 *
 * **Example** (Make options with flags)
 *
 * ```ts
 * import { GlobOptions } from "@beep/utils/Glob"
 *
 * const options = GlobOptions.make({ absolute: true, dot: true })
 * console.log(options.absolute)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GlobOptions extends S.Class<GlobOptions>($I`GlobOptions`)(
  {
    absolute: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether matched paths should be returned as absolute paths.",
    }),
    cwd: S.optionalKey(S.String).annotateKey({
      description: "Directory used as the root for glob scanning.",
    }),
    dot: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether dot-prefixed path segments should be matched.",
    }),
    ignore: S.optionalKey(Pattern).annotateKey({
      description: "Glob pattern or patterns excluded from scan results.",
    }),
    nodir: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether directory matches should be omitted from results.",
    }),
  },
  $I.annote("GlobOptions", {
    description: "Optional runtime flags for glob scans.",
  })
) {}

class ResolvedGlobOptions extends S.Class<ResolvedGlobOptions>($I`ResolvedGlobOptions`)(
  {
    absolute: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    cwd: S.String.pipe(S.withConstructorDefault(Effect.succeed("."))),
    dot: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    ignore: Pattern.pipe(S.withConstructorDefault(Effect.succeed(A.empty<string>()))),
    nodir: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  },
  $I.annote("ResolvedGlobOptions", {
    description: "Resolved runtime flags for glob scans.",
  })
) {}

const resolveGlobOptions = (options?: GlobOptions): ResolvedGlobOptions => ResolvedGlobOptions.make(options ?? {});

const GlobErrorCause = S.Defect({ includeStack: true })
  .annotate({ toEquivalence: () => () => true })
  .pipe(
    $I.annoteSchema("GlobErrorCause", {
      description: "A defect captured from an underlying glob implementation.",
    })
  );

/**
 * Namespace for the encoded form of {@link GlobError}.
 *
 * **Example** (Create encoded GlobError)
 *
 * ```ts
 * import { GlobError } from "@beep/utils/Glob"
 *
 * const encoded: GlobError.Encoded = { _tag: "GlobError", pattern: "src/*.ts" }
 * console.log(encoded.pattern)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace GlobError {
  /**
   * Encoded shape of {@link GlobError}.
   *
   * **Example** (Build encoded error shape)
   *
   * ```ts
   * import { GlobError } from "@beep/utils/Glob"
   *
   * const encoded: GlobError.Encoded = {
   *   _tag: "GlobError",
   *   pattern: ["src/*.ts", "test/*.ts"]
   * }
   * console.log(encoded.pattern)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof GlobError.Encoded;
}

/**
 * An error raised when glob pattern matching fails.
 *
 * **Details**
 *
 * Carries the offending `pattern` and an optional `cause` with stack trace.
 * Accepts both the decoded `Option` cause and the encoded optional cause shape
 * for constructor compatibility.
 *
 * **Example** (Construct error with Option)
 *
 * ```ts
 * import { GlobError } from "@beep/utils/Glob"
 *
 * import * as O from "effect/Option"
 *
 * const error = GlobError.new("src/*.ts", O.none())
 * console.log(error)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GlobError extends S.TaggedError<GlobError>($I`GlobError`)(
  "GlobError",
  {
    pattern: Pattern.annotateKey({
      description: "Glob pattern being evaluated when matching failed.",
    }),
    cause: S.OptionFromOptionalKey(GlobErrorCause).annotateKey({
      description: "Optional decoded defect captured from the underlying glob implementation.",
    }),
  },
  $I.annoteError<GlobError>("GlobError", {
    description: "An error that occurs during glob pattern matching.",
  })
) {
  static readonly new: {
    (pattern: GlobError.Encoded["pattern"], cause: GlobErrorCauseInput): GlobError;
    (pattern: GlobError.Encoded["pattern"]): (cause: GlobErrorCauseInput) => GlobError;
  } = dual(2, (pattern: GlobError.Encoded["pattern"], cause: GlobErrorCauseInput) =>
    GlobError.make({ pattern, cause: normalizeGlobErrorCause(cause) })
  );
  static readonly newThunk: {
    (pattern: GlobError.Encoded["pattern"], cause: GlobErrorCauseInput): () => GlobError;
    (pattern: GlobError.Encoded["pattern"]): (cause: GlobErrorCauseInput) => () => GlobError;
  } = dual(2, (pattern: GlobError.Encoded["pattern"], cause: GlobErrorCauseInput) =>
    thunk(GlobError.make({ pattern, cause: normalizeGlobErrorCause(cause) }))
  );
}

type GlobErrorCauseInput = GlobError["cause"] | GlobError.Encoded["cause"];

const decodeGlobErrorCause = S.decodeUnknownOption(GlobErrorCause);

const normalizeGlobErrorCause = (cause: GlobErrorCauseInput): GlobError["cause"] =>
  O.isOption(cause) ? cause : decodeGlobErrorCause(cause);

/**
 * Service interface for performing glob-based file matching.
 *
 * **Details**
 *
 * Provides a single `glob` method that resolves glob patterns against the
 * file system and returns the matched paths.
 *
 * **Example** (Run glob via service)
 *
 * ```ts import.meta.vitest name="Run glob via service"
 * import { Effect } from "effect"
 * import { Glob, layer } from "@beep/utils/Glob"
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* Glob
 *   return yield* service.glob("src/*.ts")
 * })
 *
 * Effect.runPromise(Effect.provide(program, layer)).then(console.log)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface Glob {
  readonly glob: (pattern: Pattern, options?: GlobOptions) => Effect.Effect<Array<string>, GlobError>;
}

/**
 * Service tag for the {@link Glob} capability.
 *
 * **Example** (Access Glob service tag)
 *
 * ```ts import.meta.vitest name="Access Glob service tag"
 * import { Effect } from "effect"
 * import { Glob, layer } from "@beep/utils/Glob"
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* Glob
 *   return yield* service.glob("src/*.ts")
 * })
 *
 * Effect.runPromise(Effect.provide(program, layer)).then(console.log)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const Glob: Context.Service<Glob, Glob> = Context.Service($I`Glob`);

type BunGlobConstructor = typeof Bun.Glob;
type BunGlobInstance = InstanceType<BunGlobConstructor>;
type NodeDirent = import("node:fs").Dirent;
type PathMatcher = (relativePath: string) => boolean;

function toGlobError(pattern: Pattern): (cause: unknown) => GlobError {
  return (cause: unknown): GlobError =>
    Match.value(cause).pipe(
      Match.when(S.is(GlobError), (error) => error),
      Match.orElse((error) => GlobError.new(pattern, decodeGlobErrorCause(error)))
    );
}

const normalizePathSeparators = (value: string): string => Str.replaceAll("\\", "/")(value);

const hasDotSegment: (value: string) => boolean = flow(
  normalizePathSeparators,
  Str.split("/"),
  A.some((segment) => segment.length > 1 && segment !== ".." && Str.startsWith(".")(segment))
);

const toPatterns: (pattern: Pattern) => Array<string> = A.ensure;

const getBunGlobConstructor = (): O.Option<BunGlobConstructor> => O.fromUndefinedOr(globalThis.Bun?.Glob);

const compileGlobs = (BunGlob: BunGlobConstructor, patterns: ReadonlyArray<string>): ReadonlyArray<BunGlobInstance> =>
  A.map(patterns, (pattern) => new BunGlob(pattern));

const compileIncludedPatterns: (patterns: ReadonlyArray<string>) => ReadonlyArray<PathMatcher> = flow(
  A.map((pattern) => {
    const normalizedPattern = normalizePathSeparators(pattern);
    const matcher = picomatch(normalizedPattern, {
      dot: true,
    });
    const rootDirectory = pipe(normalizedPattern, O.liftPredicate(Str.endsWith("/**")), O.map(Str.slice(0, -3)));

    return (relativePath: string): boolean => matcher(relativePath) && !O.contains(rootDirectory, relativePath);
  })
);

const compileIgnoredPatterns: (patterns: ReadonlyArray<string>) => ReadonlyArray<PathMatcher> = flow(
  A.map((pattern) => {
    const normalizedPattern = normalizePathSeparators(pattern);
    const basePattern = Str.endsWith("/")(normalizedPattern) ? Str.slice(0, -1)(normalizedPattern) : normalizedPattern;
    const matcher = picomatch(basePattern, {
      dot: true,
    });
    const descendantMatcher = picomatch(`${basePattern}/**`, {
      dot: true,
    });

    return (relativePath: string): boolean => matcher(relativePath) || descendantMatcher(relativePath);
  })
);

const matchesPatterns = (matchers: ReadonlyArray<PathMatcher>, relativePath: string): boolean =>
  pipe(
    matchers,
    A.some((matcher) => matcher(relativePath))
  );

const globMetaPattern = /[*?[{(!]/u;

const patternScanRoot = (pattern: string): string => {
  const normalizedPattern = normalizePathSeparators(pattern);
  const segments = Str.split("/")(normalizedPattern);
  const staticSegments = A.takeWhile(segments, (segment) => !globMetaPattern.test(segment));

  if (staticSegments.length === 0) {
    return "";
  }

  return staticSegments.length === segments.length
    ? A.join("/")(A.dropRight(staticSegments, 1))
    : A.join("/")(staticSegments);
};

const isNestedScanRoot = (parent: string, child: string): boolean =>
  parent.length === 0 || child === parent || Str.startsWith(`${parent}/`)(child);

const scanRootsForPatterns: (patterns: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.map(patternScanRoot),
  A.dedupe,
  A.sort(Order.String),
  (roots) => A.filter(roots, (root, index) => !A.some(A.take(roots, index), (parent) => isNestedScanRoot(parent, root)))
);

const isNotFound = (error: PlatformError.PlatformError): boolean => error.reason._tag === "NotFound";

const optionOnNotFound = <A>(
  self: Effect.Effect<A, PlatformError.PlatformError>
): Effect.Effect<O.Option<A>, PlatformError.PlatformError> =>
  self.pipe(
    Effect.asSome,
    Effect.catchIf(isNotFound, () => Effect.succeedNone)
  );

const resolveDirectoryFlag = (
  entry: NodeDirent,
  absolutePath: string
): Effect.Effect<O.Option<boolean>, PlatformError.PlatformError> =>
  entry.isSymbolicLink()
    ? Effect.map(
        optionOnNotFound(statSync(absolutePath)),
        O.map((info) => info.type === "Directory")
      )
    : Effect.succeedSome(entry.isDirectory());

const scanDirectory = (
  absoluteDirectoryPath: string,
  relativeDirectoryPath: string,
  includeMatchers: ReadonlyArray<PathMatcher>,
  ignoreMatchers: ReadonlyArray<PathMatcher>,
  options: ResolvedGlobOptions
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError> =>
  optionOnNotFound(readdirSync(absoluteDirectoryPath, { withFileTypes: true })).pipe(
    Effect.map(O.getOrElse(A.empty<NodeDirent>)),
    Effect.flatMap((entries) =>
      Effect.forEach(
        entries,
        Effect.fnUntraced(function* (entry: NodeDirent) {
          const relativePath =
            relativeDirectoryPath.length === 0 ? entry.name : `${relativeDirectoryPath}/${entry.name}`;
          const normalizedRelativePath = normalizePathSeparators(relativePath);
          const absolutePath = Path.resolve(absoluteDirectoryPath, entry.name);
          const isHiddenPath = !options.dot && hasDotSegment(normalizedRelativePath);

          if (isHiddenPath) {
            return [];
          }

          const directoryFlag = yield* resolveDirectoryFlag(entry, absolutePath);
          if (O.isNone(directoryFlag)) {
            return [];
          }
          const isDirectory = directoryFlag.value;

          if (matchesPatterns(ignoreMatchers, normalizedRelativePath)) {
            return [];
          }

          const currentEntry: ReadonlyArray<string> =
            matchesPatterns(includeMatchers, normalizedRelativePath) && (isDirectory ? !options.nodir : true)
              ? [normalizedRelativePath]
              : [];

          if (!isDirectory || entry.isSymbolicLink()) {
            return currentEntry;
          }

          const children = yield* scanDirectory(
            absolutePath,
            normalizedRelativePath,
            includeMatchers,
            ignoreMatchers,
            options
          );
          return A.appendAll(currentEntry, children);
        })
      )
    ),
    Effect.map(A.flatten)
  );

const finalizePaths = (paths: ReadonlyArray<string>, cwd: string, absolute: boolean): Array<string> => {
  const relativePaths = pipe(paths, A.dedupe, A.sort(Order.String));

  return absolute
    ? pipe(
        relativePaths,
        A.map((relativePath) => Path.resolve(cwd, relativePath))
      )
    : relativePaths;
};

const scanWithNodeFs = Effect.fn("Glob.glob.nodeFallback")(function* (
  pattern: Pattern,
  options: ResolvedGlobOptions,
  cwd: string
): Effect.fn.Return<Array<string>, GlobError | PlatformError.PlatformError> {
  const patterns = toPatterns(pattern);
  const matchers = yield* Effect.try({
    try: () => ({
      include: compileIncludedPatterns(patterns),
      ignore: compileIgnoredPatterns(toPatterns(options.ignore)),
    }),
    catch: toGlobError(pattern),
  });

  const entriesPerRoot = yield* Effect.forEach(
    scanRootsForPatterns(patterns),
    Effect.fnUntraced(function* (scanRoot: string) {
      const absoluteScanRoot = Path.resolve(cwd, scanRoot);

      const rootInfo = yield* optionOnNotFound(statSync(absoluteScanRoot));
      if (O.isNone(rootInfo) || rootInfo.value.type !== "Directory") {
        return [];
      }

      return yield* scanDirectory(absoluteScanRoot, scanRoot, matchers.include, matchers.ignore, options);
    })
  );

  return finalizePaths(A.flatten(entriesPerRoot), cwd, options.absolute);
});

const scanWithBunGlob = Effect.fn("Glob.glob.bun")(
  (
    BunGlob: BunGlobConstructor,
    pattern: Pattern,
    options: ResolvedGlobOptions,
    cwd: string
  ): Effect.Effect<Array<string>, GlobError> =>
    Effect.try({
      try: (): Array<string> => {
        const scanOptions: Bun.GlobScanOptions = {
          cwd,
          dot: options.dot,
          onlyFiles: options.nodir,
        };
        const includeMatchers = compileIncludedPatterns(toPatterns(pattern));
        const ignoreMatchers = compileIgnoredPatterns(toPatterns(options.ignore));
        const relativePaths = pipe(
          toPatterns(pattern),
          (patterns) => compileGlobs(BunGlob, patterns),
          A.flatMap((glob) => A.fromIterable(glob.scanSync(scanOptions))),
          A.map(normalizePathSeparators),
          A.filter((candidate) => matchesPatterns(includeMatchers, candidate)),
          A.filter((candidate) => !matchesPatterns(ignoreMatchers, candidate))
        );

        return finalizePaths(relativePaths, cwd, options.absolute);
      },
      catch: toGlobError(pattern),
    })
);

const makeGlob = Effect.fn("Glob.glob")(function* (
  pattern: Pattern,
  options?: GlobOptions
): Effect.fn.Return<Array<string>, GlobError> {
  const resolvedOptions = resolveGlobOptions(options);
  const cwd = yield* Effect.try({
    try: () => Path.resolve(resolvedOptions.cwd),
    catch: toGlobError(pattern),
  });

  return yield* O.match(getBunGlobConstructor(), {
    onNone: () => scanWithNodeFs(pattern, resolvedOptions, cwd).pipe(Effect.mapError(toGlobError(pattern))),
    onSome: (BunGlob) => scanWithBunGlob(BunGlob, pattern, resolvedOptions, cwd),
  });
});

/**
 * Live `Layer` providing the {@link Glob} service backed by `Bun.Glob` when
 * available and a recursive Node filesystem scan with `picomatch` otherwise.
 *
 * **Example** (Provide Glob Effect layer)
 *
 * ```ts import.meta.vitest name="Provide Glob Effect layer"
 * import { Effect } from "effect"
 * import { Glob, layer } from "@beep/utils/Glob"
 *
 * const program = Effect.provide(
 *   Effect.gen(function* () {
 *     const service = yield* Glob
 *     return yield* service.glob("src/*.ts")
 *   }),
 *   layer
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<Glob> = Layer.succeed(Glob, {
  glob: makeGlob,
});
