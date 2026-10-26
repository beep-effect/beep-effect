/**
 * App-namespaced XDG directories: the five-rung precedence per kind, the
 * runtime directory, the config and data search paths, and on-demand creation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $XdgId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { getSomesStruct } from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { AbsolutePath } from "./Absolute.ts";
import { NativeDirs } from "./NativeDirs.ts";
import { currentPlatform, Xdg } from "./Xdg.ts";
import type { XdgPaths, XdgPlatform } from "./Xdg.ts";

const $I = $XdgId.create("AppDirs");

/**
 * Indicates that an application namespace is not a single non-empty path component.
 *
 * **Details**
 *
 * Invalid namespaces remain defects during layer construction.
 *
 * **Example** (Describe an invalid namespace)
 *
 * ```ts
 * import { AppDirsNamespaceError } from "@beep/xdg/AppDirs";
 *
 * const error = AppDirsNamespaceError.make({ message: "AppDirs.layer: `namespace` must not be empty" });
 * console.log(error.message); // AppDirs.layer: `namespace` must not be empty
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AppDirsNamespaceError extends S.TaggedError<AppDirsNamespaceError, { readonly brand: unique symbol }>(
  $I`AppDirsNamespaceError`
)(
  "AppDirsNamespaceError",
  {
    message: S.String.pipe(
      $I.annoteKey("AppDirsNamespaceError.message", {
        description: "Explains why the namespace cannot name an application directory.",
      })
    ),
  },
  $I.annoteError<AppDirsNamespaceError>("AppDirsNamespaceError", {
    description: "An invalid application directory namespace.",
  })
) {}

/**
 * The four directory kinds XDG separates, plus the runtime directory.
 *
 * **Example** (Validate directory kinds)
 *
 * ```ts
 * import { AppDirKind } from "@beep/xdg/AppDirs";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(AppDirKind)("runtime")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const AppDirKind = LiteralKit(["config", "data", "cache", "state", "runtime"]).pipe(
  $I.annoteSchema("AppDirKind", { description: "The four directory kinds XDG separates, plus the runtime directory." })
);

/**
 * The decoded form of {@link (AppDirKind:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type AppDirKind = typeof AppDirKind.Type;

/**
 * Indicates that an application directory could not be created.
 *
 * **Details**
 *
 * The only way `AppDirs` fails. Resolution cannot fail — it happens once, at
 * layer construction, from an environment that is already resolved — so this
 * error means exactly one thing: the `mkdir -p` did not work. `directory` says
 * which kind, `path` says where, and `cause` carries the underlying
 * `PlatformError` structurally.
 *
 * **Example** (Inspect a directory creation failure)
 *
 * ```ts
 * import { AppDirsError } from "@beep/xdg/AppDirs";
 *
 * const error = AppDirsError.make({ directory: "config", path: "/app/config", cause: "permission denied" });
 * console.log(error.message); // Failed to create the config directory at "/app/config"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class AppDirsError extends S.TaggedError<AppDirsError, { readonly brand: unique symbol }>($I`AppDirsError`)(
  "AppDirsError",
  {
    /** Which directory kind failed. */
    directory: AppDirKind.pipe($I.annoteKey("AppDirsError.directory", { description: "Which directory kind failed." })),
    /** The path that could not be created. */
    path: S.String.pipe($I.annoteKey("AppDirsError.path", { description: "The path that could not be created." })),
    /** The underlying failure, preserved structurally. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("AppDirsError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<AppDirsError>("AppDirsError", {
    description: "Indicates that an application directory could not be created.",
  })
) {
  /**
   * Describes the failed directory creation.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { AppDirsError } from "@beep/xdg/AppDirs";
   *
   * const error = AppDirsError.make({ directory: "config", path: "/app/config", cause: "permission denied" });
   * console.log(error.message); // Failed to create the config directory at "/app/config"
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to create the ${this.directory} directory at "${this.path}"`;
  }
}

/**
 * Indicates that a per-kind directory override is not an absolute path.
 *
 * **Details**
 *
 * Like an invalid namespace, a relative override can only come from code, so
 * it is a **defect** at layer construction rather than a typed error: used as
 * given it would win rung 1 and resolve against the working directory.
 * `directory` names the kind and `path` the rejected value. When several
 * overrides are relative, the first in `AppDirKind` order is reported.
 *
 * **Example** (Describe a relative override)
 *
 * ```ts
 * import { AppDirsOverrideError } from "@beep/xdg/AppDirs";
 *
 * const error = AppDirsOverrideError.make({ directory: "cache", path: "cache" });
 * console.log(error.message); // AppDirs.layer: the cache override must be an absolute path, received "cache"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AppDirsOverrideError extends S.TaggedError<AppDirsOverrideError, { readonly brand: unique symbol }>(
  $I`AppDirsOverrideError`
)(
  "AppDirsOverrideError",
  {
    /** Which directory kind carried the relative override. */
    directory: AppDirKind.pipe(
      $I.annoteKey("AppDirsOverrideError.directory", {
        description: "Which directory kind carried the relative override.",
      })
    ),
    /** The rejected override value. */
    path: S.String.pipe($I.annoteKey("AppDirsOverrideError.path", { description: "The rejected override value." })),
  },
  $I.annoteError<AppDirsOverrideError>("AppDirsOverrideError", {
    description: "Indicates that a per-kind directory override is not an absolute path.",
  })
) {
  /**
   * Describes the rejected override.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { AppDirsOverrideError } from "@beep/xdg/AppDirs";
   *
   * const error = AppDirsOverrideError.make({ directory: "config", path: "./config" });
   * console.log(error.message); // AppDirs.layer: the config override must be an absolute path, received "./config"
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `AppDirs.layer: the ${this.directory} override must be an absolute path, received ${JSON.stringify(this.path)}`;
  }
}

/**
 * The fully resolved, app-namespaced directories.
 *
 * **Example** (Inspect ordered configuration candidates)
 *
 * ```ts
 * import { ResolvedAppDirs } from "@beep/xdg/AppDirs";
 *
 * const dirs = ResolvedAppDirs.make({
 *   config: "/app/config", data: "/app/data", cache: "/app/cache", state: "/app/state",
 *   configSearchPath: ["/app/config", "/etc/xdg/myapp"], dataSearchPath: ["/app/data"],
 * });
 * console.log(dirs.configSearchPath.join(":")); // /app/config:/etc/xdg/myapp
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ResolvedAppDirs extends S.Opaque<ResolvedAppDirs, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The app's configuration directory. */
    config: S.String.pipe(
      $I.annoteKey("ResolvedAppDirs.config", { description: "The app's configuration directory." })
    ),
    /** The app's data directory. */
    data: S.String.pipe($I.annoteKey("ResolvedAppDirs.data", { description: "The app's data directory." })),
    /** The app's cache directory. */
    cache: S.String.pipe($I.annoteKey("ResolvedAppDirs.cache", { description: "The app's cache directory." })),
    /** The app's state directory. */
    state: S.String.pipe($I.annoteKey("ResolvedAppDirs.state", { description: "The app's state directory." })),
    /**
     * The app's runtime directory.
     *
     * **Gotchas**
     *
     * Absent unless `$XDG_RUNTIME_DIR` is set or `dirs.runtime` overrides it.
     * There is no defensible fallback for a runtime directory — it must be
     * user-owned, mode 0700 and cleaned on logout — so inventing one would be a
     * lie, and the key is simply absent.
     */
    runtime: S.optionalKey(S.String).pipe(
      $I.annoteKey("ResolvedAppDirs.runtime", { description: "The app's runtime directory." })
    ),
    /**
     * Where to **look** for configuration, in priority order.
     *
     * **Details**
     *
     * The app's own config directory, then each `$XDG_CONFIG_DIRS` entry
     * namespaced. It is what makes {@link XdgConfig.resolver} a real search
     * rather than a single stat.
     */
    configSearchPath: S.Array(S.String).pipe(
      $I.annoteKey("ResolvedAppDirs.configSearchPath", {
        description: "Where to **look** for configuration, in priority order.",
      })
    ),
    /** Where to look for data files, in priority order. */
    dataSearchPath: S.Array(S.String).pipe(
      $I.annoteKey("ResolvedAppDirs.dataSearchPath", {
        description: "Where to look for data files, in priority order.",
      })
    ),
  }).pipe($I.annoteSchema("ResolvedAppDirs", { description: "The fully resolved, app-namespaced directories." }))
) {}

const isAbsoluteOverride = S.is(AbsolutePath);

/**
 * Per-kind directory overrides. Each wins outright over every other rung.
 *
 * **Gotchas**
 *
 * Each path must be absolute (POSIX, a drive root or a UNC share) and is then
 * used verbatim, unnormalized. `AppDirs.layer` checks its `dirs` at layer
 * construction and dies with an {@link AppDirsOverrideError} on a relative
 * one, as it does on an invalid namespace.
 *
 * **Example** (Decode directory overrides)
 *
 * ```ts
 * import { AppDirOverrides } from "@beep/xdg/AppDirs";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeSync(AppDirOverrides)({ config: "/app/config" });
 * console.log(decoded.config); // /app/config
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AppDirOverrides extends S.Opaque<AppDirOverrides, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The config directory path, absolute and used verbatim. */
    config: S.optionalKey(AbsolutePath).pipe(
      $I.annoteKey("AppDirOverrides.config", { description: "The config directory path, absolute and used verbatim." })
    ),
    /** The data directory path, absolute and used verbatim. */
    data: S.optionalKey(AbsolutePath).pipe(
      $I.annoteKey("AppDirOverrides.data", { description: "The data directory path, absolute and used verbatim." })
    ),
    /** The cache directory path, absolute and used verbatim. */
    cache: S.optionalKey(AbsolutePath).pipe(
      $I.annoteKey("AppDirOverrides.cache", { description: "The cache directory path, absolute and used verbatim." })
    ),
    /** The state directory path, absolute and used verbatim. */
    state: S.optionalKey(AbsolutePath).pipe(
      $I.annoteKey("AppDirOverrides.state", { description: "The state directory path, absolute and used verbatim." })
    ),
    /** The runtime directory path, absolute and used verbatim. */
    runtime: S.optionalKey(AbsolutePath).pipe(
      $I.annoteKey("AppDirOverrides.runtime", {
        description: "The runtime directory path, absolute and used verbatim.",
      })
    ),
  }).pipe(
    $I.annoteSchema("AppDirOverrides", {
      description: "Per-kind absolute directory overrides. Each wins outright over every other rung.",
    })
  )
) {}

/**
 * Options for {@link AppDirs.layer}.
 *
 * **Details**
 *
 * Plain optional fields, not `Option`s: `Option` is an internal
 * representation, not an input format, so write `fallbackDir: ".myapp"` and
 * omit `dirs` when unused.
 *
 * **Example** (Decode application directory options)
 *
 * ```ts
 * import { AppDirsOptions } from "@beep/xdg/AppDirs";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeSync(AppDirsOptions)({ namespace: "myapp", native: true });
 * console.log(decoded.namespace); // myapp
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AppDirsOptions extends S.Opaque<AppDirsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The application namespace — one path component.
     *
     * **Gotchas**
     *
     * Must be non-empty and free of path separators. A namespace containing `..`
     * or `/` would resolve the app's directories outside `$HOME` entirely, so it
     * is rejected as a **defect** at layer construction: it can only come from
     * code, never from user input.
     */
    namespace: S.String.pipe(
      $I.annoteKey("AppDirsOptions.namespace", {
        description: "The application namespace — one path component, validated as a defect during layer construction.",
      })
    ),
    /**
     * Use the OS-native directories where the platform has them. Defaults to `false`.
     *
     * **Details**
     *
     * Only consulted when no XDG variable and no explicit override applies, and
     * only on darwin and win32 — on Linux there is nothing to override.
     */
    native: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("AppDirsOptions.native", {
        description: "Use the OS-native directories where the platform has them. Defaults to false.",
      })
    ),
    /**
     * A single dot-directory under `$HOME` that all four kinds collapse to.
     *
     * **Details**
     *
     * Relative to `$HOME`: `fallbackDir: ".myapp"` gives `$HOME/.myapp`.
     */
    fallbackDir: S.optionalKey(S.String).pipe(
      $I.annoteKey("AppDirsOptions.fallbackDir", {
        description: "A single dot-directory under HOME that all four kinds collapse to.",
      })
    ),
    /** Per-kind absolute overrides, checked at layer construction. */
    dirs: S.optionalKey(AppDirOverrides).pipe(
      $I.annoteKey("AppDirsOptions.dirs", {
        description: "Per-kind absolute overrides, checked at layer construction.",
      })
    ),
  }).pipe(
    $I.annoteSchema("AppDirsOptions", {
      description: "Options for resolving application directories through the five-level precedence.",
    })
  )
) {}

/**
 * Resolve one directory kind through the five-level precedence.
 *
 * **Details**
 *
 * 1. an explicit `dirs.<kind>` override, absolute (checked at layer construction);
 * 2. the XDG environment variable, namespaced (`$XDG_CONFIG_HOME/<ns>`);
 * 3. the native directory, when `native: true` and the platform has one;
 * 4. `$HOME/<fallbackDir>` — all four kinds collapse to the one directory;
 * 5. `$HOME/.<namespace>`.
 *
 * Rungs 4 and 5 are deliberately **not** the XDG spec's per-kind defaults
 * (`~/.config`, `~/.local/share`, …): a CLI wanting spec defaults passes them as
 * `dirs` overrides.
 */
const resolveDir = (input: {
  readonly override: string | undefined;
  readonly xdgHome: string | undefined;
  readonly native: O.Option<string>;
  readonly options: typeof AppDirsOptions.Encoded;
  readonly home: string;
  readonly path: Path.Path;
}): string => {
  const { override, xdgHome, native, options, home, path } = input;
  if (override !== undefined) return override;
  if (xdgHome !== undefined) return path.join(xdgHome, options.namespace);
  if (O.isSome(native)) return native.value;
  if (options.fallbackDir !== undefined) return path.join(home, options.fallbackDir);
  return path.join(home, `.${options.namespace}`);
};

/** The app's own directory, then each system directory, namespaced. Nearest first. */
const searchPath: {
  (own: string, systemDirs: ReadonlyArray<string>, namespace: string, path: Path.Path): Array<string>;
  (systemDirs: ReadonlyArray<string>, namespace: string, path: Path.Path): (own: string) => Array<string>;
} = dual(
  4,
  (own: string, systemDirs: ReadonlyArray<string>, namespace: string, path: Path.Path): Array<string> => [
    own,
    ...A.map(systemDirs, (dir) => path.join(dir, namespace)),
  ]
);

/** The four kinds with a fallback ladder; the runtime directory has none. */
type LadderKind = Exclude<AppDirKind, "runtime">;

/** The runtime directory: an override, or `$XDG_RUNTIME_DIR` namespaced, or nothing at all. */
const runtimeDirOf = (options: typeof AppDirsOptions.Encoded, paths: XdgPaths, path: Path.Path): O.Option<string> =>
  O.orElse(O.fromUndefinedOr(options.dirs?.runtime), () =>
    O.map(O.fromUndefinedOr(paths.runtimeDir), (dir) => path.join(dir, options.namespace))
  );

const resolveAll: {
  (options: typeof AppDirsOptions.Encoded, paths: XdgPaths, platform: XdgPlatform, path: Path.Path): ResolvedAppDirs;
  (
    paths: XdgPaths,
    platform: XdgPlatform,
    path: Path.Path
  ): (options: typeof AppDirsOptions.Encoded) => ResolvedAppDirs;
} = dual(
  4,
  (
    options: typeof AppDirsOptions.Encoded,
    paths: XdgPaths,
    platform: XdgPlatform,
    path: Path.Path
  ): ResolvedAppDirs => {
    const native = Bool.match(options.native === true, {
      onTrue: () => NativeDirs.resolve({ platform, namespace: options.namespace, paths, path }),
      onFalse: O.none<NativeDirs>,
    });
    const xdgHomes = {
      config: paths.configHome,
      data: paths.dataHome,
      cache: paths.cacheHome,
      state: paths.stateHome,
    } satisfies Record<LadderKind, string | undefined>;

    const forKind = (kind: LadderKind): string =>
      resolveDir({
        override: options.dirs?.[kind],
        xdgHome: xdgHomes[kind],
        native: O.map(native, (dirs) => dirs[kind]),
        options,
        home: paths.home,
        path,
      });

    const config = forKind("config");
    const data = forKind("data");
    const runtime = runtimeDirOf(options, paths, path);

    return ResolvedAppDirs.make({
      config,
      data,
      cache: forKind("cache"),
      state: forKind("state"),
      // A present key holding `undefined` is not an absent key: v4 constructors validate.
      ...getSomesStruct({ runtime }),
      configSearchPath: searchPath(config, paths.configDirs, options.namespace, path),
      dataSearchPath: searchPath(data, paths.dataDirs, options.namespace, path),
    });
  }
);

const NonEmptyNamespace = S.String.check(
  S.isNonEmpty(
    $I.annote("NonEmptyNamespaceCheck", {
      description: "An application namespace contains at least one character.",
      message: "Non-empty namespace",
    })
  )
).pipe($I.annoteSchema("NonEmptyNamespace", { description: "A namespace with at least one character." }));

const NamespaceComponent = S.String.check(
  S.isPattern(
    /^[^/\\]*$/,
    $I.annote("NamespaceSeparatorsCheck", {
      description: "A namespace contains neither forward slashes nor backslashes.",
      message: "Namespace without separators",
    })
  ),
  S.makeFilter(
    (value) => value !== "." && value !== "..",
    $I.annote("NamespaceTraversalCheck", {
      description: "A namespace is neither the current nor parent directory component.",
      message: "Namespace without traversal",
    })
  )
).pipe($I.annoteSchema("NamespaceComponent", { description: "A namespace confined to one path component." }));

const isNonEmptyNamespace = S.is(NonEmptyNamespace);
const isNamespaceComponent = S.is(NamespaceComponent);

/**
 * A namespace is a single path component. Anything else escapes the app's own
 * directories, so it **dies** rather than resolving somewhere surprising. This
 * is wiring, not input: only code supplies a namespace, so a bad one is a
 * programmer error and belongs on the defect channel, not in `E`.
 */
const badNamespace = (namespace: string): AppDirsNamespaceError | undefined => {
  if (!isNonEmptyNamespace(namespace)) {
    return AppDirsNamespaceError.make({ message: "AppDirs.layer: `namespace` must not be empty" });
  }
  if (!isNamespaceComponent(namespace)) {
    return AppDirsNamespaceError.make({
      message: `AppDirs.layer: \`namespace\` must be a single path component, received ${JSON.stringify(namespace)}`,
    });
  }
  return undefined;
};

/** The first relative override in `AppDirKind` order, if any. Same discipline as the namespace: a defect. */
const badOverride = (dirs: typeof AppDirOverrides.Encoded | undefined): AppDirsOverrideError | undefined =>
  pipe(
    AppDirKind.literals,
    A.findFirst((directory) =>
      pipe(
        O.fromUndefinedOr(dirs?.[directory]),
        O.filter((path) => !isAbsoluteOverride(path)),
        O.map((path) => AppDirsOverrideError.make({ directory, path }))
      )
    ),
    O.getOrUndefined
  );

/**
 * App-namespaced XDG directories, with on-demand creation.
 *
 * **Gotchas**
 *
 * `AppDirs.layer` is a layer-**returning function**: calling it twice builds two
 * independent services. Bind its result to a const and provide that const, per
 * the layer memoization discipline.
 *
 * **Example** (Construct a directory creation program)
 *
 * ```ts
 * import { AppDirs } from "@beep/xdg/AppDirs";
 * import { Xdg } from "@beep/xdg/Xdg";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 *
 * // Bound once, with the ambient Xdg environment provided and kept.
 * const AppDirsLive = Layer.provideMerge(AppDirs.layer({ namespace: "myapp", native: true }), Xdg.layer);
 * const program = Effect.gen(function* () {
 *   const appDirs = yield* AppDirs;
 *   return yield* appDirs.ensureConfig;
 * });
 * // Running the program requires FileSystem and Path from the platform layer.
 * console.log(Layer.isLayer(AppDirsLive), Effect.isEffect(program)); // true true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class AppDirs extends Context.Service<
  AppDirs,
  {
    /** The resolved directories. Reading them cannot fail. */
    readonly dirs: ResolvedAppDirs;
    /** Create every directory that exists in the resolution, and return them all. */
    readonly ensure: Effect.Effect<ResolvedAppDirs, AppDirsError>;
    /** Create the cache directory if it does not exist, and return it. */
    readonly ensureCache: Effect.Effect<string, AppDirsError>;
    /** Create the config directory if it does not exist, and return it. */
    readonly ensureConfig: Effect.Effect<string, AppDirsError>;
    /** Create the data directory if it does not exist, and return it. */
    readonly ensureData: Effect.Effect<string, AppDirsError>;
    /**
     * Create the runtime directory if there is one, and return it.
     *
     * **Details**
     *
     * `Option.none()` when no runtime directory is configured — nothing is created
     * and nothing fails.
     */
    readonly ensureRuntime: Effect.Effect<O.Option<string>, AppDirsError>;
    /** Create the state directory if it does not exist, and return it. */
    readonly ensureState: Effect.Effect<string, AppDirsError>;
    /** The namespace these directories were resolved for. */
    readonly namespace: string;
  }
>()($I`AppDirs`) {
  /**
   * Resolve the namespace's directories against the ambient {@link Xdg}
   * environment and platform.
   *
   * **Details**
   *
   * The error channel is `never`. The one failure that could happen during
   * resolution — an unset `HOME` — surfaces on {@link Xdg.layer} as an
   * `XdgEnvError`, before an `AppDirs` exists at all.
   *
   * **Example** (Construct an application directory layer)
   *
   * ```ts
   * import { AppDirs } from "@beep/xdg/AppDirs";
   * import * as Layer from "effect/Layer";
   *
   * const live = AppDirs.layer({ namespace: "myapp" });
   * console.log(Layer.isLayer(live)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static layer(
    options: typeof AppDirsOptions.Encoded
  ): Layer.Layer<AppDirs, never, Xdg | FileSystem.FileSystem | Path.Path> {
    return Layer.effect(
      AppDirs,
      Effect.gen(function* () {
        const invalid = badNamespace(options.namespace) ?? badOverride(options.dirs);
        if (invalid !== undefined) return yield* Effect.die(invalid);

        const paths = yield* Xdg;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const platform = yield* currentPlatform;

        const dirs = resolveAll(options, paths, platform, path);

        const makeDir: {
          (kind: AppDirKind, target: string): Effect.Effect<string, AppDirsError>;
          (target: string): (kind: AppDirKind) => Effect.Effect<string, AppDirsError>;
        } = dual(
          2,
          (kind: AppDirKind, target: string): Effect.Effect<string, AppDirsError> =>
            fs.makeDirectory(target, { recursive: true }).pipe(
              Effect.mapError((cause) => AppDirsError.make({ directory: kind, path: target, cause })),
              Effect.as(target)
            )
        );

        const runtimeDir = dirs.runtime;
        const ensureRuntime: Effect.Effect<O.Option<string>, AppDirsError> = (
          runtimeDir === undefined ? Effect.succeedNone : Effect.asSome(makeDir("runtime", runtimeDir))
        ).pipe(Effect.withSpan("AppDirs.ensureRuntime"));

        return {
          namespace: options.namespace,
          dirs,
          ensureConfig: makeDir("config", dirs.config).pipe(Effect.withSpan("AppDirs.ensureConfig")),
          ensureData: makeDir("data", dirs.data).pipe(Effect.withSpan("AppDirs.ensureData")),
          ensureCache: makeDir("cache", dirs.cache).pipe(Effect.withSpan("AppDirs.ensureCache")),
          ensureState: makeDir("state", dirs.state).pipe(Effect.withSpan("AppDirs.ensureState")),
          ensureRuntime,
          ensure: Effect.gen(function* () {
            yield* makeDir("config", dirs.config);
            yield* makeDir("data", dirs.data);
            yield* makeDir("cache", dirs.cache);
            yield* makeDir("state", dirs.state);
            if (dirs.runtime !== undefined) yield* makeDir("runtime", dirs.runtime);
            return dirs;
          }).pipe(Effect.withSpan("AppDirs.ensure")),
        };
      })
    );
  }
}

/**
 * App-namespaced directory resolution and on-demand creation.
 *
 * **Details**
 *
 * `dirs` is a **value**, not an `Effect`: the environment is fixed when the
 * layer is built, so resolution happens there, exactly once. Reading a path
 * cannot fail and cannot be observed to do IO. Only the `ensure*` operations
 * touch the filesystem, and they are the only fallible members.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type AppDirsShape = (typeof AppDirs)["Service"];
