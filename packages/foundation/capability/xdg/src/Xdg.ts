/**
 * The XDG Base Directory environment, read once at layer construction, and the
 * platform the native-directory decisions are taken against.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $XdgId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { constant, dual, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AbsolutePath, isAbsolutePosix, isAbsoluteWin32 } from "./Absolute.ts";

const $I = $XdgId.create("Xdg");

/**
 * The operating system the path decisions are taken against.
 *
 * **Details**
 *
 * The members are Node's `process.platform` values, modeled as a schema rather
 * than borrowed from the ambient `NodeJS.Platform` type so the package's public
 * surface names nothing it does not own.
 *
 * **Example** (Validate an operating system)
 *
 * ```ts
 * import { XdgPlatform } from "@beep/xdg/Xdg";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(XdgPlatform)("win32")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const XdgPlatform = LiteralKit([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "openbsd",
  "sunos",
  "win32",
  "cygwin",
  "netbsd",
]).pipe($I.annoteSchema("XdgPlatform", { description: "The operating system the path decisions are taken against." }));

/**
 * The decoded form of {@link (XdgPlatform:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type XdgPlatform = typeof XdgPlatform.Type;

/**
 * The platform every native-directory decision is taken against.
 *
 * **Details**
 *
 * Reads `HostProcessPlatform` from `@beep/utils/HostProcess`, which defaults
 * to `process.platform`. A platform outside {@link (XdgPlatform:variable)} (or
 * no `process` at all, as in a browser or a worker, where the reference reads
 * `"browser"`) behaves as Linux: XDG is the convention, with no native
 * override. A test pins macOS or Windows semantics with
 * `Effect.provideService(HostProcessPlatform, "win32")`.
 *
 * **Example** (Pin Windows semantics)
 *
 * ```ts
 * import { HostProcessPlatform } from "@beep/utils/HostProcess";
 * import { currentPlatform } from "@beep/xdg/Xdg";
 * import * as Effect from "effect/Effect";
 *
 * const platform = Effect.runSync(currentPlatform.pipe(Effect.provideService(HostProcessPlatform, "win32")));
 * console.log(platform); // win32
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export const currentPlatform: Effect.Effect<XdgPlatform> = Effect.map(
  HostProcessPlatform,
  flow(S.decodeUnknownOption(XdgPlatform), O.getOrElse(constant<XdgPlatform>("linux")))
);

/**
 * Indicates that the environment cannot satisfy XDG directory resolution.
 *
 * **Details**
 *
 * Raised only for `HOME`, when it is unset, empty or relative: every other XDG
 * variable is optional by construction, and its absence is a resolved default
 * rather than a failure. `cause` carries the underlying `ConfigError`
 * structurally.
 *
 * **Example** (Inspect the missing HOME failure)
 *
 * ```ts
 * import { XdgEnvError } from "@beep/xdg/Xdg";
 *
 * const error = XdgEnvError.make({ variable: "HOME", cause: "missing environment value" });
 * console.log(error.message); // The HOME environment variable is not set to an absolute path
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class XdgEnvError extends S.TaggedError<XdgEnvError, { readonly brand: unique symbol }>($I`XdgEnvError`)(
  "XdgEnvError",
  {
    /** The environment variable that was required and not found as an absolute path. */
    variable: S.String.pipe(
      $I.annoteKey("XdgEnvError.variable", {
        description: "The environment variable that was required and not found as an absolute path.",
      })
    ),
    /** The underlying failure, preserved structurally. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("XdgEnvError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<XdgEnvError>("XdgEnvError", {
    description: "Indicates that the environment cannot satisfy XDG directory resolution.",
  })
) {
  /**
   * Describes the failed environment lookup.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { XdgEnvError } from "@beep/xdg/Xdg";
   *
   * const error = XdgEnvError.make({ variable: "HOME", cause: "missing environment value" });
   * console.log(error.message); // The HOME environment variable is not set to an absolute path
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `The ${this.variable} environment variable is not set to an absolute path`;
  }
}

/**
 * The XDG Base Directory environment, resolved.
 *
 * **Details**
 *
 * Every field but `home` is optional because the corresponding variable is:
 * `Schema.optionalKey`, so an unset variable is an **absent key** and the read
 * is `paths.configHome ?? fallback`.
 *
 * `configDirs` and `dataDirs` are the colon-separated system search paths, split
 * and defaulted per the spec (`/etc/xdg` and `/usr/local/share:/usr/share`).
 * They are what make a config lookup a genuine ordered search rather than a
 * single stat.
 *
 * **Example** (Inspect resolved system search paths)
 *
 * ```ts
 * import { XdgPaths } from "@beep/xdg/Xdg";
 *
 * const paths = XdgPaths.make({ home: "/home/ada", configDirs: ["/etc/xdg"], dataDirs: ["/usr/share"] });
 * console.log(paths.configDirs.join(":")); // /etc/xdg
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class XdgPaths extends S.Opaque<XdgPaths, { readonly brand: unique symbol }>()(
  S.Struct({
    /** `$HOME`. The one variable that must be set, to an absolute path. */
    home: S.String.pipe(
      $I.annoteKey("XdgPaths.home", { description: "`$HOME`. The one variable that must be set, to an absolute path." })
    ),
    /** `$XDG_CONFIG_HOME`. */
    configHome: S.optionalKey(S.String).pipe(
      $I.annoteKey("XdgPaths.configHome", { description: "`$XDG_CONFIG_HOME`." })
    ),
    /** `$XDG_DATA_HOME`. */
    dataHome: S.optionalKey(S.String).pipe($I.annoteKey("XdgPaths.dataHome", { description: "`$XDG_DATA_HOME`." })),
    /** `$XDG_CACHE_HOME`. */
    cacheHome: S.optionalKey(S.String).pipe($I.annoteKey("XdgPaths.cacheHome", { description: "`$XDG_CACHE_HOME`." })),
    /** `$XDG_STATE_HOME`. */
    stateHome: S.optionalKey(S.String).pipe($I.annoteKey("XdgPaths.stateHome", { description: "`$XDG_STATE_HOME`." })),
    /** `$XDG_RUNTIME_DIR`. Absent on most non-Linux systems. */
    runtimeDir: S.optionalKey(S.String).pipe(
      $I.annoteKey("XdgPaths.runtimeDir", { description: "`$XDG_RUNTIME_DIR`. Absent on most non-Linux systems." })
    ),
    /** `%APPDATA%`, on Windows. */
    appData: S.optionalKey(S.String).pipe(
      $I.annoteKey("XdgPaths.appData", { description: "`%APPDATA%`, on Windows." })
    ),
    /** `%LOCALAPPDATA%`, on Windows. */
    localAppData: S.optionalKey(S.String).pipe(
      $I.annoteKey("XdgPaths.localAppData", { description: "`%LOCALAPPDATA%`, on Windows." })
    ),
    /** `$XDG_CONFIG_DIRS`, split on `:`. Defaults to `["/etc/xdg"]`. */
    configDirs: S.Array(S.String).pipe(
      $I.annoteKey("XdgPaths.configDirs", {
        description: '`$XDG_CONFIG_DIRS`, split on `:`. Defaults to `["/etc/xdg"]`.',
      })
    ),
    /** `$XDG_DATA_DIRS`, split on `:`. Defaults to `["/usr/local/share", "/usr/share"]`. */
    dataDirs: S.Array(S.String).pipe(
      $I.annoteKey("XdgPaths.dataDirs", {
        description: '`$XDG_DATA_DIRS`, split on `:`. Defaults to `["/usr/local/share", "/usr/share"]`.',
      })
    ),
  }).pipe($I.annoteSchema("XdgPaths", { description: "The XDG Base Directory environment, resolved." }))
) {}

/**
 * Split a `PATH`-style variable, keeping only absolute entries.
 *
 * **Gotchas**
 *
 * Per the XDG spec, an unset **or empty** variable takes the default, and a
 * relative entry is invalid and ignored. A list with no valid entry left
 * (`XDG_CONFIG_DIRS=""`, `":::"` or `"etc:share"`) is therefore not "no
 * system directories": it is the default.
 */
const splitDirs: {
  (raw: string | undefined, fallback: ReadonlyArray<string>): ReadonlyArray<string>;
  (fallback: ReadonlyArray<string>): (raw: string | undefined) => ReadonlyArray<string>;
} = dual(
  2,
  (raw: string | undefined, fallback: ReadonlyArray<string>): ReadonlyArray<string> =>
    pipe(
      O.fromUndefinedOr(raw),
      O.map(flow(Str.split(":"), A.filter(isAbsolutePosix))),
      O.filter(A.isReadonlyArrayNonEmpty<string>),
      O.getOrElse(constant(fallback))
    )
);

/**
 * XDG Base Directory environment resolution.
 *
 * **Details**
 *
 * The service's shape **is** {@link XdgPaths}: the environment is read once, at
 * layer construction, and the service is the resolved value. `yield* Xdg` gives
 * you a record of strings, and the only failure — an unset `HOME` — happens
 * once, where the layer is built.
 *
 * **Example** (Read a fixed XDG environment)
 *
 * ```ts
 * import { Xdg, XdgPaths } from "@beep/xdg/Xdg";
 * import * as Effect from "effect/Effect";
 *
 * const fixed = Xdg.layerFrom(XdgPaths.make({
 *   home: "/home/test", configHome: "/home/test/.config",
 *   configDirs: ["/etc/xdg"], dataDirs: ["/usr/local/share", "/usr/share"],
 * }));
 * const home = Effect.runSync(Effect.map(Xdg, (paths) => paths.home).pipe(Effect.provide(fixed)));
 * console.log(home); // /home/test
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class Xdg extends Context.Service<Xdg, XdgPaths>()($I`Xdg`) {
  /**
   * Read the XDG environment through Effect's `Config`.
   *
   * **Details**
   *
   * Reads from the ambient `ConfigProvider`, which defaults to `process.env`.
   * A test drives it with `ConfigProvider.layer(ConfigProvider.fromUnknown({…}))`
   * and never mutates the real environment.
   *
   * **Gotchas**
   *
   * The absolute-only rule covers `HOME` too, with a different outcome: an
   * invalid `$XDG_*`, `APPDATA` or `LOCALAPPDATA` value is ignored, but `HOME`
   * is required, so an unset, empty or relative `HOME` (a POSIX or Windows
   * absolute path is accepted) fails the layer with an `XdgEnvError` instead of
   * resolving every `AppDirs` fallback against the working directory.
   * `XdgBase`, which is HOME-optional, treats a relative `HOME` as absent.
   *
   * **Example** (Construct the environment-reading layer)
   *
   * ```ts
   * import { Xdg } from "@beep/xdg/Xdg";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(Xdg.layer)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Xdg, XdgEnvError> = Layer.effect(
    Xdg,
    Effect.gen(function* () {
      /**
       * `Config<T>` IS an `Effect<T, ConfigError>` in v4, so it pipes directly.
       * Every `ConfigError` becomes an `XdgEnvError` naming the variable it came from.
       */
      const asEnvError: {
        <A>(name: string, config: Config.Config<A>): Effect.Effect<A, XdgEnvError>;
        <A>(config: Config.Config<A>): (name: string) => Effect.Effect<A, XdgEnvError>;
      } = dual(
        2,
        <A>(name: string, config: Config.Config<A>): Effect.Effect<A, XdgEnvError> =>
          Effect.catchTag(config, "ConfigError", (cause) => Effect.fail(XdgEnvError.make({ variable: name, cause })))
      );

      const home = yield* asEnvError("HOME", Config.schema(AbsolutePath, "HOME"));

      /**
       * An unset variable is `Option.none()`, not a failure, and so is a value
       * that fails `valid`: the spec says a relative path is invalid and must be
       * ignored. The residual `ConfigError` a `Config.option` can still raise is
       * a *provider* failure (a `ConfigProvider` backed by a directory or a
       * `.env` file that cannot be read), not a missing key, so it is mapped
       * rather than swallowed.
       */
      const read = (name: string, valid: (value: string) => boolean): Effect.Effect<string | undefined, XdgEnvError> =>
        Effect.map(asEnvError(name, Config.option(Config.String(name))), flow(O.filter(valid), O.getOrUndefined));

      const configHome = yield* read("XDG_CONFIG_HOME", isAbsolutePosix);
      const dataHome = yield* read("XDG_DATA_HOME", isAbsolutePosix);
      const cacheHome = yield* read("XDG_CACHE_HOME", isAbsolutePosix);
      const stateHome = yield* read("XDG_STATE_HOME", isAbsolutePosix);
      const runtimeDir = yield* read("XDG_RUNTIME_DIR", isAbsolutePosix);
      const appData = yield* read("APPDATA", isAbsoluteWin32);
      const localAppData = yield* read("LOCALAPPDATA", isAbsoluteWin32);
      const configDirs = yield* read("XDG_CONFIG_DIRS", Str.isNonEmpty);
      const dataDirs = yield* read("XDG_DATA_DIRS", Str.isNonEmpty);

      // A *present* key holding `undefined` is not the same as an absent key —
      // v4 constructors validate — so every optional field is conditionally spread.
      return XdgPaths.make({
        home,
        ...(configHome !== undefined && { configHome }),
        ...(dataHome !== undefined && { dataHome }),
        ...(cacheHome !== undefined && { cacheHome }),
        ...(stateHome !== undefined && { stateHome }),
        ...(runtimeDir !== undefined && { runtimeDir }),
        ...(appData !== undefined && { appData }),
        ...(localAppData !== undefined && { localAppData }),
        configDirs: splitDirs(configDirs, ["/etc/xdg"]),
        dataDirs: splitDirs(dataDirs, ["/usr/local/share", "/usr/share"]),
      });
    })
  );

  /**
   * Serve fixed paths instead of reading the environment.
   *
   * **Details**
   *
   * The test layer, and the escape hatch for an application that resolves its
   * environment some other way. It needs no filesystem.
   *
   * **Example** (Provide fixed XDG paths for tests)
   *
   * ```ts
   * import { Xdg, XdgPaths } from "@beep/xdg/Xdg";
   * import * as Effect from "effect/Effect";
   *
   * const fixed = Xdg.layerFrom(XdgPaths.make({
   *   home: "/home/test", configHome: "/home/test/.config",
   *   configDirs: ["/etc/xdg"], dataDirs: ["/usr/local/share", "/usr/share"],
   * }));
   * const home = Effect.runSync(Effect.map(Xdg, (paths) => paths.home).pipe(Effect.provide(fixed)));
   * console.log(home); // /home/test
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static layerFrom(paths: XdgPaths): Layer.Layer<Xdg> {
    return Layer.succeed(Xdg, paths);
  }
}
