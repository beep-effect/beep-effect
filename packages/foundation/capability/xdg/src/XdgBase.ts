/**
 * The XDG Base Directory variables with their spec defaults: a pure resolver
 * plus `Config` wrappers that read one base directory from the ambient
 * `ConfigProvider`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $XdgId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import { constant, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { AbsolutePosixPath, isAbsolutePosix } from "./Absolute.ts";

const $I = $XdgId.create("XdgBase");

/**
 * The five XDG base directories: the four `*_HOME` kinds and the runtime directory.
 *
 * **Example** (Validate a base directory kind)
 *
 * ```ts
 * import { XdgBaseKind } from "@beep/xdg/XdgBase";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(XdgBaseKind)("state")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const XdgBaseKind = LiteralKit(["config", "data", "cache", "state", "runtime"]).pipe(
  $I.annoteSchema("XdgBaseKind", {
    description: "The five XDG base directories: the four *_HOME kinds and the runtime directory.",
  })
);

/**
 * The decoded form of {@link (XdgBaseKind:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type XdgBaseKind = typeof XdgBaseKind.Type;

const variableOf = XdgBaseKind.match({
  config: constant("XDG_CONFIG_HOME"),
  data: constant("XDG_DATA_HOME"),
  cache: constant("XDG_CACHE_HOME"),
  state: constant("XDG_STATE_HOME"),
  runtime: constant("XDG_RUNTIME_DIR"),
});

/** The spec default under `$HOME`; the runtime directory has none. */
const defaultUnderHome = XdgBaseKind.match({
  config: constant(O.some(".config")),
  data: constant(O.some(".local/share")),
  cache: constant(O.some(".cache")),
  state: constant(O.some(".local/state")),
  runtime: O.none<string>,
});

/**
 * `$HOME` with empty and `.` segments dropped and a leading `..` folded into
 * the root, which is what `systemd-path` does before it appends a default.
 * Inner `..` segments stay as they are.
 */
const normalizedHome = flow(
  Str.split("/"),
  A.filter((segment) => Str.isNonEmpty(segment) && segment !== "."),
  A.dropWhile((segment) => segment === ".."),
  A.join("/")
);

const underHome = (home: string, suffix: string): string =>
  pipe(
    normalizedHome(home),
    O.liftPredicate(Str.isNonEmpty),
    O.match({ onNone: () => `/${suffix}`, onSome: (path) => `/${path}/${suffix}` })
  );

const absolute = (value: string | undefined): O.Option<string> => O.filter(O.fromUndefinedOr(value), isAbsolutePosix);

const resolve = (
  kind: XdgBaseKind,
  env: { readonly value?: string | undefined; readonly home?: string | undefined }
): O.Option<string> =>
  O.orElse(absolute(env.value), () =>
    O.flatMap(defaultUnderHome(kind), (suffix) => O.map(absolute(env.home), (home) => underHome(home, suffix)))
  );

const lenient = (name: string): Config.Config<string | undefined> =>
  Config.option(Config.String(name)).pipe(Config.map(O.getOrUndefined));

const dir = (kind: XdgBaseKind): Config.Config<O.Option<string>> =>
  Config.all({ value: lenient(variableOf(kind)), home: lenient("HOME") }).pipe(Config.map((env) => resolve(kind, env)));

// A valid variable, else a strict read of `HOME` joined with the kind's default suffix.
const requireUnderHome = (kind: XdgBaseKind, suffix: string): Config.Config<string> =>
  lenient(variableOf(kind)).pipe(
    Config.map(absolute),
    Config.flatMap(
      O.match({
        onNone: () => Config.schema(AbsolutePosixPath, "HOME").pipe(Config.map((home) => underHome(home, suffix))),
        onSome: Config.succeed,
      })
    )
  );

/**
 * The same answer as {@link dir}, failing instead of answering none. The runtime
 * directory is a strict read of its own variable; the other kinds take a valid
 * variable, else a strict read of `HOME`, so the `ConfigError` names the
 * variable that was missing or relative.
 */
const require = (kind: XdgBaseKind): Config.Config<string> =>
  O.match(defaultUnderHome(kind), {
    onNone: () => Config.schema(AbsolutePosixPath, variableOf(kind)),
    onSome: (suffix) => requireUnderHome(kind, suffix),
  });

/**
 * One XDG base directory, resolved the way the spec says.
 *
 * **Details**
 *
 * The variable wins when it holds an absolute path. Empty, whitespace-only and
 * relative values are invalid by the spec and are ignored, as `systemd-path`
 * ignores them. Without a valid variable the four `*_HOME` kinds fall back to
 * `$HOME/.config`, `$HOME/.local/share`, `$HOME/.cache` and
 * `$HOME/.local/state`; the runtime directory has no default.
 *
 * `$HOME` is optional here. A missing or relative `$HOME` makes the default
 * absent rather than failing, so `dir` can answer "no directory" and leave
 * the decision to the caller; `require` turns that answer into a
 * `ConfigError` that names the variable.
 *
 * **Example** (Resolve the state directory from fixed values)
 *
 * ```ts
 * import { XdgBase } from "@beep/xdg/XdgBase";
 * import * as O from "effect/Option";
 *
 * const state = XdgBase.resolve("state", { home: "/home/ada", value: "relative/state" });
 * console.log(O.getOrElse(state, () => "absent")); // /home/ada/.local/state
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export abstract class XdgBase {
  /**
   * The environment variable a base directory kind is read from.
   *
   * **Example** (Name the state variable)
   *
   * ```ts
   * import { XdgBase } from "@beep/xdg/XdgBase";
   *
   * console.log(XdgBase.variable("state")); // XDG_STATE_HOME
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly variable: (kind: XdgBaseKind) => string = variableOf;

  /**
   * Resolve one base directory from a variable value and `$HOME`.
   *
   * **Details**
   *
   * Pure: no environment read, no filesystem, no platform. The variable value
   * is used verbatim when it is absolute; otherwise the spec default is built
   * under an absolute `$HOME`. `Option.none()` means there is no directory:
   * the runtime directory without a valid `$XDG_RUNTIME_DIR`, or any kind
   * without a valid value and without an absolute `$HOME`.
   *
   * **Example** (Fall back to the spec default)
   *
   * ```ts
   * import { XdgBase } from "@beep/xdg/XdgBase";
   * import * as O from "effect/Option";
   *
   * console.log(O.getOrNull(XdgBase.resolve("config", { home: "/home/ada" }))); // /home/ada/.config
   * console.log(O.getOrNull(XdgBase.resolve("runtime", { home: "/home/ada" }))); // null
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly resolve = resolve;

  /**
   * Read one base directory through `Config`, absent when it cannot be resolved.
   *
   * **Details**
   *
   * Reads the kind's variable and `$HOME` from the ambient `ConfigProvider`
   * and applies {@link XdgBase.resolve}. Missing variables are not failures;
   * only a provider that cannot be read fails.
   *
   * **Example** (Read the data directory from a fixed provider)
   *
   * ```ts
   * import { XdgBase } from "@beep/xdg/XdgBase";
   * import * as ConfigProvider from "effect/ConfigProvider";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const provider = ConfigProvider.fromUnknown({ HOME: "/home/ada" });
   * const data = Effect.runSync(XdgBase.dir("data").parse(provider));
   * console.log(O.getOrNull(data)); // /home/ada/.local/share
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly dir = dir;

  /**
   * Read one base directory through `Config`, failing when it cannot be resolved.
   *
   * **Details**
   *
   * The same resolution as {@link XdgBase.dir}. When it finds nothing, the
   * failure is the `ConfigError` of a strict read of `$HOME` (or of
   * `$XDG_RUNTIME_DIR` for the runtime kind), so the message names the missing
   * or relative variable.
   *
   * **Example** (Require the state directory)
   *
   * ```ts
   * import { XdgBase } from "@beep/xdg/XdgBase";
   * import * as ConfigProvider from "effect/ConfigProvider";
   * import * as Effect from "effect/Effect";
   *
   * const provider = ConfigProvider.fromUnknown({ XDG_STATE_HOME: "/var/state" });
   * console.log(Effect.runSync(XdgBase.require("state").parse(provider))); // /var/state
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly require = require;
}
