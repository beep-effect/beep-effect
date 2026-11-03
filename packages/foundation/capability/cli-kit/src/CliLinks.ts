/**
 * File links that open in an editor (`vscode://file/…`) or as `file://` URLs, drawn as OSC 8 hyperlinks where the
 * terminal renders them and never for an agent.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import { CurrentRuntimeEnv } from "@beep/runtime-env";
import { AudienceKind } from "@beep/runtime-env/Audience";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Walker } from "@beep/walker/Walker";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sanitize } from "./Fmt.ts";
import { LinksService } from "./internal/declared.ts";
import { isAllowedLinkUrl } from "./internal/linkScheme.ts";
import { DRIVE, encodeForOsc8, fileUrlPath, UNC } from "./internal/linkTarget.ts";
import type * as LayerType from "effect/Layer";
import type { LinkTargetInput } from "./LinkTarget.ts";

const $I = $CliKitId.create("CliLinks");

/**
 * Whether file links open in an editor.
 *
 * **Details**
 *
 * `vscode` writes `vscode://file/<path>:<line>:<col>`, `file` writes `file://<path>`, `off` writes no file link, and
 * `auto` picks `vscode` when it finds a signal of VS Code and `file` otherwise.
 *
 * **Example** (Validate an editor link setting)
 *
 * ```ts
 * import { EditorLinks } from "@beep/cli-kit/CliLinks";
 * import * as S from "effect/Schema";
 * console.log(S.is(EditorLinks)("vscode")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const EditorLinks = LiteralKit(["auto", "vscode", "file", "off"]).pipe(
  $I.annoteSchema("EditorLinks", { description: "Whether file links open in an editor." })
);

/**
 * The editor link setting accepted by {@link CliLinks}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type EditorLinks = typeof EditorLinks.Type;

/**
 * The shape of the {@link CliLinks} service: the mode decided, and the URL a link target becomes.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export type CliLinksShape = (typeof CliLinks)["Service"];

/**
 * Options for {@link CliLinks.layer}.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { CliLinksOptions } from "@beep/cli-kit/CliLinks"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CliLinksOptions)({ cwd: "/repo" })) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CliLinksOptions extends S.Opaque<CliLinksOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The working directory; `PWD` through `Config`, then `Path.resolve(".")`, when omitted. */
    cwd: S.optionalKey(S.String).pipe(
      $I.annoteKey("CliLinksOptions.cwd", { description: "The cwd field of CliLinksOptions." })
    ),
    /** The setting, `auto` by default. An environment variable the consumer names beats it. */
    editorLinks: S.optionalKey(EditorLinks).pipe(
      $I.annoteKey("CliLinksOptions.editorLinks", { description: "The editorLinks field of CliLinksOptions." })
    ),
    /** The environment variable that overrides the setting, read through `Config`. Not read unless named. */
    envVar: S.optionalKey(S.String).pipe(
      $I.annoteKey("CliLinksOptions.envVar", { description: "The envVar field of CliLinksOptions." })
    ),
  }).pipe($I.annoteSchema("CliLinksOptions", { description: "Plain CliLinksOptions data." }))
) {}
/**
 * Companion types for {@link CliLinksOptions}.
 *
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CliLinksOptions } from "@beep/cli-kit/CliLinks"
 * import * as S from "effect/Schema"
 *
 * const plain: CliLinksOptions.Encoded = { cwd: "/repo" }
 * console.log(S.is(CliLinksOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliLinksOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliLinksOptions.Encoded;
}

/**
 * The options of {@link CliLinks.linker}.
 *
 * **Example** (Inspect the schema)
 *
 * ```ts
 * import { CliLinksLinkerOptions } from "@beep/cli-kit/CliLinks"
 *
 * console.log(typeof CliLinksLinkerOptions.make) // function
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CliLinksLinkerOptions extends S.Opaque<CliLinksLinkerOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Who the output is for. */
    audience: AudienceKind.pipe(
      $I.annoteKey("CliLinksLinkerOptions.audience", { description: "The audience field of CliLinksLinkerOptions." })
    ),
    /** Whether the stream's terminal renders OSC 8 hyperlinks. */
    hyperlinks: S.Boolean.pipe(
      $I.annoteKey("CliLinksLinkerOptions.hyperlinks", {
        description: "The hyperlinks field of CliLinksLinkerOptions.",
      })
    ),
    /** The service that turns a target into a URL. */
    links: LinksService.pipe(
      $I.annoteKey("CliLinksLinkerOptions.links", { description: "The links field of CliLinksLinkerOptions." })
    ),
  }).pipe($I.annoteSchema("CliLinksLinkerOptions", { description: "Plain CliLinksLinkerOptions data." }))
) {}
/**
 * Companion types for {@link CliLinksLinkerOptions}.
 *
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { CliLinksLinkerOptions } from "@beep/cli-kit/CliLinks"
 *
 * const accepts = (_value: CliLinksLinkerOptions.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliLinksLinkerOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliLinksLinkerOptions.Encoded;
}

/** The most directories the ascent climbs above the working directory, so it looks at most at 65. */
const MAX_ASCENT = 64;

const isEditorLinks = S.is(EditorLinks);

const parseSetting = (raw: string): EditorLinks | undefined => {
  const normalized = Str.toLowerCase(Str.trim(raw));
  return isEditorLinks(normalized) ? normalized : undefined;
};

/** A URL with its control characters and line breaks removed: none is legal in one, and each could end an OSC 8 early. */
const cleanUrl = (url: string): string => Str.replace(/[\r\n]/g, "")(sanitize(url));

type LinkMode = "vscode" | "file" | "off";
type Absolute = (file: string) => string | undefined;

const editorUrl = (path: string, target: Extract<LinkTargetInput, { readonly file: string }>): string => {
  const position =
    target.line === undefined ? "" : target.col === undefined ? `:${target.line}` : `:${target.line}:${target.col}`;
  return `vscode://file${path}${position}`;
};

const makeTarget: {
  (mode: LinkMode, absolute: Absolute): (target: LinkTargetInput) => O.Option<string>;
  (absolute: Absolute): (mode: LinkMode) => (target: LinkTargetInput) => O.Option<string>;
} = dual(
  2,
  (mode: LinkMode, absolute: Absolute): ((target: LinkTargetInput) => O.Option<string>) =>
    (target: LinkTargetInput): O.Option<string> => {
      if ("url" in target) {
        const url = cleanUrl(target.url);
        return url === "" || !isAllowedLinkUrl(url) ? O.none() : O.some(url);
      }
      if (mode === "off") return O.none();
      const resolved = absolute(target.file);
      if (resolved === undefined) return O.none();
      const path = fileUrlPath(resolved);
      if (O.isNone(path)) return O.none();
      if (mode === "file") return O.some(`file://${path.value}`);
      return O.some(editorUrl(path.value, target));
    }
);

const isDirectory: {
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean>;
  (path: string): (fs: FileSystem.FileSystem) => Effect.Effect<boolean>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean> =>
    fs.stat(path).pipe(
      Effect.map((info) => info.type === "Directory"),
      Effect.orElseSucceed(() => false)
    )
);

const exists: {
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean>;
  (path: string): (fs: FileSystem.FileSystem) => Effect.Effect<boolean>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean> =>
    fs.exists(path).pipe(Effect.orElseSucceed(() => false))
);

/**
 * The nearest directory, from `cwd` up, that holds `.git` or `pnpm-workspace.yaml`.
 *
 * **Details**
 *
 * It looks at `cwd` and then climbs at most {@link MAX_ASCENT} directories, through `Walker.ascend`, which also stops
 * where `dirname` reaches a fixpoint (the filesystem root). `Walker.findRoot` absorbs a failed probe as "not a root",
 * so one unreadable directory never hides a root above it. `None` when there is none.
 */
const findRoot: {
  (fs: FileSystem.FileSystem, path: Path.Path, cwd: string): Effect.Effect<O.Option<string>>;
  (path: Path.Path, cwd: string): (fs: FileSystem.FileSystem) => Effect.Effect<O.Option<string>>;
} = dual(
  3,
  (fs: FileSystem.FileSystem, path: Path.Path, cwd: string): Effect.Effect<O.Option<string>> =>
    Walker.ascend(cwd, { maxDepth: MAX_ASCENT + 1 }).pipe(
      Effect.provideService(Path.Path, path),
      Effect.flatMap((directories) =>
        Walker.findRoot(
          directories,
          Effect.fnUntraced(function* (directory) {
            return (
              (yield* exists(fs, path.join(directory, ".git"))) ||
              (yield* exists(fs, path.join(directory, "pnpm-workspace.yaml")))
            );
          })
        )
      )
    )
);

const readOption = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none<string>));

interface Ambient {
  readonly fs: O.Option<FileSystem.FileSystem>;
  readonly path: O.Option<Path.Path>;
}

const resolveAbsolute =
  (path: Path.Path | undefined, cwd: string): Absolute =>
  (file: string): string | undefined => {
    // A UNC path is not on this machine: it must not be resolved against the working directory as a filename.
    if (UNC.test(file)) return undefined;
    if (DRIVE.test(file)) return file;
    if (path === undefined) return Str.startsWith("/")(file) ? file : undefined;
    if (path.isAbsolute(file)) return file;
    return path.resolve(cwd, file);
  };

const selectMode = Effect.fnUntraced(function* (
  setting: EditorLinks,
  runtime: typeof CurrentRuntimeEnv.Service,
  ambient: Ambient,
  path: Path.Path | undefined,
  cwd: string
): Effect.fn.Return<LinkMode> {
  if (setting !== "auto") return setting;
  if (O.exists(runtime.terminal, (terminal) => terminal.name === "vscode")) return "vscode";
  if (O.isNone(ambient.fs) || path === undefined) return "file";
  {
    const root = yield* findRoot(ambient.fs.value, path, cwd);
    const base = O.getOrElse(root, () => cwd);
    return (yield* isDirectory(ambient.fs.value, path.join(base, ".vscode"))) ? "vscode" : "file";
  }
});

/** Read one configured mode and warn once for an invalid override. */
const configuredSetting = Effect.fn("CliLinks.configuredSetting")(function* (options: CliLinksOptions.Encoded) {
  const raw =
    options.envVar === undefined
      ? ""
      : yield* Effect.map(
          Effect.map(readOption(options.envVar), (value) => O.getOrElse(value, () => "")),
          Str.trim
        );
  const fromEnv = parseSetting(raw);
  if (options.envVar !== undefined && raw !== "" && fromEnv === undefined) {
    yield* Effect.logWarning(
      `${options.envVar}=${raw} is not one of ${A.join(EditorLinks.literals, "|")}; ignoring it`
    );
  }
  return fromEnv ?? options.editorLinks ?? "auto";
});

const build: {
  (options: CliLinksOptions.Encoded, ambient: Ambient): Effect.Effect<CliLinksShape, never, CurrentRuntimeEnv>;
  (ambient: Ambient): (options: CliLinksOptions.Encoded) => Effect.Effect<CliLinksShape, never, CurrentRuntimeEnv>;
} = dual(
  2,
  Effect.fn("CliLinks.build")(function* (
    options: CliLinksOptions.Encoded,
    ambient: Ambient
  ): Effect.fn.Return<CliLinksShape, never, CurrentRuntimeEnv> {
    const runtime = yield* CurrentRuntimeEnv;
    const setting = yield* configuredSetting(options);

    // The working directory: the option, else PWD, else where the path service resolves ".".
    const pwd = options.cwd === undefined ? yield* readOption("PWD") : O.none<string>();
    const cwd =
      options.cwd ?? O.getOrUndefined(pwd) ?? (O.isSome(ambient.path) ? ambient.path.value.resolve(".") : ".");
    const path = O.getOrUndefined(ambient.path);
    const absolute = resolveAbsolute(path, cwd);

    const mode = yield* selectMode(setting, runtime, ambient, path, cwd);
    return { mode, target: makeTarget(mode, absolute) };
  })
);

/**
 * Editor-aware links for file targets: where a link to a file opens.
 *
 * **Details**
 *
 * The mode is decided once, when the layer is built. `auto` is `vscode` when `CurrentRuntimeEnv.terminal` is
 * `vscode` (`TERM_PROGRAM=vscode`) or a `.vscode/` directory sits at the project root, and `file` otherwise. The
 * root is the nearest directory, from the working directory up, that holds `.git` or `pnpm-workspace.yaml`; the
 * climb is bounded, at most 64 directories above the working directory, and stops where `Path.dirname` reaches the
 * filesystem root. With no root, the working directory itself is checked.
 *
 * Whether a link is written at all is a separate question, answered by {@link CliLinks.linker}.
 *
 * **Example** (Fix file links for a test)
 *
 * ```ts
 * import { CliLinks } from "@beep/cli-kit/CliLinks"
 * import * as Layer from "effect/Layer"
 *
 * const live = CliLinks.layerTest("file")
 * console.log(Layer.isLayer(live)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class CliLinks extends Context.Service<
  CliLinks,
  {
    /** The mode `auto` resolved to, or the one that was asked for. */
    readonly mode: "vscode" | "file" | "off";
    /**
     * The URL a target opens, or `None` when it has none.
     *
     * **Details**
     *
     * A `{ url }` target is its URL, whatever the mode. A `{ file }` target is `vscode://file/<path>:<line>:<col>` or
     * `file://<path>`, with the path URL-encoded; `off` gives it none, and so does a relative path when the layer
     * has no working directory to resolve it against. A column needs a line.
     */
    readonly target: (target: LinkTargetInput) => O.Option<string>;
  }
>()($I`CliLinks`) {
  /**
   * The links for the working directory, reading the filesystem for a `.vscode/` directory.
   *
   * **Gotchas**
   *
   * A layer-returning function mints a fresh layer per call: call it once and bind the result to a constant.
   *
   * **Example** (Build editor-aware links once)
   *
   * ```ts
   * import { CliLinks } from "@beep/cli-kit/CliLinks"
   * import * as Layer from "effect/Layer"
   *
   * const live = CliLinks.layer({ editorLinks: "auto", cwd: "/project" })
   * console.log(Layer.isLayer(live)) // true
   * ```
   *
   * @param options - the setting, the environment variable that overrides it, and the working directory
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    options: CliLinksOptions.Encoded = {}
  ): LayerType.Layer<CliLinks, never, FileSystem.FileSystem | Path.Path | CurrentRuntimeEnv> =>
    Layer.effect(
      CliLinks,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        return yield* build(options, { fs: O.some(fs), path: O.some(path) });
      })
    );

  /**
   * Links fixed to a mode, with no filesystem: a relative path has no link, since there is no working directory.
   *
   * **Example** (Resolve an absolute file without a filesystem)
   *
   * ```ts
   * import { CliLinks } from "@beep/cli-kit/CliLinks"
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   *
   * const program = Effect.gen(function* () {
   *   const links = yield* CliLinks
   *   return O.getOrElse(links.target({ file: "/project/main.ts" }), () => "missing")
   * }).pipe(Effect.provide(CliLinks.layerTest("file")))
   * console.log(Effect.runSync(program)) // file:///project/main.ts
   * ```
   *
   * @param mode - `vscode`, `file` or `off`
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (mode: "vscode" | "file" | "off"): LayerType.Layer<CliLinks> =>
    Layer.succeed(CliLinks, {
      mode,
      target: makeTarget(mode, (file) => (Str.startsWith("/")(file) || DRIVE.test(file) ? file : undefined)),
    });

  /**
   * The function that writes a link: a target and a label in, the label out, wrapped in OSC 8 when it should be.
   *
   * **Details**
   *
   * It writes the hyperlink `ESC ] 8 ; ; URL ESC \ label ESC ] 8 ; ; ESC \` only when the stream's terminal can
   * render it (`hyperlinks`) and the audience is not an agent, which never gets an escape of any kind; in every other
   * case, and whenever the target has no URL, it returns the label unchanged. The URL has its control characters
   * removed again here, so a hostile target cannot end the sequence early or start another, and a URL whose scheme is
   * not one a link may have (`javascript:`, `data:`, and the like; the same list markdown uses) is the label alone. It is pure and cheap,
   * which {@link RenderContext}'s `link` requires.
   *
   * **Example** (Keep agent labels free of escapes)
   *
   * ```ts
   * import { CliLinks } from "@beep/cli-kit/CliLinks"
   * import * as O from "effect/Option"
   *
   * const link = CliLinks.linker({
   *   links: { mode: "file", target: () => O.some("file:///project/main.ts") },
   *   hyperlinks: true,
   *   audience: "agent",
   * })
   * console.log(link({ file: "/project/main.ts" }, "source")) // source
   * ```
   *
   * @param options - the links, whether hyperlinks are available, and the audience
   * @category formatting
   * @since 0.0.0
   */
  static readonly linker = (
    options: CliLinksLinkerOptions.Encoded
  ): {
    (target: LinkTargetInput, label: string): string;
    (label: string): (target: LinkTargetInput) => string;
  } =>
    dual(2, (target: LinkTargetInput, label: string): string => {
      if (!options.hyperlinks || options.audience === "agent") return label;
      const url = options.links.target(target);
      if (O.isNone(url)) return label;
      const written = encodeForOsc8(cleanUrl(url.value));
      if (!isAllowedLinkUrl(written)) return label;
      return `\u001B]8;;${written}\u001B\\${label}\u001B]8;;\u001B\\`;
    });
}

/**
 * The links for {@link CliEnv.layer}: the same as {@link CliLinks.layer}, except that `FileSystem` and `Path` are
 * taken from the environment if it has them, not required.
 *
 * **Details**
 *
 * Without them there is no `.vscode/` to look for and no working directory to resolve a relative path against, so
 * `auto` is `vscode` only on the terminal signal. This keeps the requirements of `CliEnv.layer` and of every
 * `CliRuntime.main` overload unchanged.
 *
 * **Example** (Construct links with optional platform services)
 *
 * ```ts
 * import { ambientLinksLayer } from "@beep/cli-kit/CliLinks"
 * import * as Layer from "effect/Layer"
 *
 * const live = ambientLinksLayer({ editorLinks: "file" })
 * console.log(Layer.isLayer(live)) // true
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const ambientLinksLayer = (
  options: CliLinksOptions.Encoded = {}
): LayerType.Layer<CliLinks, never, CurrentRuntimeEnv> =>
  Layer.effect(
    CliLinks,
    Effect.gen(function* () {
      const fs = yield* Effect.serviceOption(FileSystem.FileSystem);
      const path = yield* Effect.serviceOption(Path.Path);
      return yield* build(options, { fs, path });
    })
  );
