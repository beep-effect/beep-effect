/**
 * The environment layer a program runs under: audience, terminal facts, theme, links, logging and the help
 * formatter, assembled once from options and the process environment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "@beep/runtime-env";
import { AudienceKind } from "@beep/runtime-env/Audience";
import { ColorLevel } from "@beep/runtime-env/ColorLevel";
import * as O from "@beep/utils/Option";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as LayerModule from "effect/Layer";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CliInteractive } from "./CliInteractive.ts";
import { ambientLinksLayer, EditorLinks } from "./CliLinks.ts";
import { CliLogFileOptions, CliLogOptions } from "./CliLog.ts";
import { CliPrompt } from "./CliPrompt.ts";
import { CliTheme, CliThemeOptions } from "./CliTheme.ts";
import { DisplayPath } from "./internal/declared.ts";
import type { StreamEnv } from "@beep/runtime-env";
import type * as CliOutput from "effect/cli/CliOutput";
import type * as Layer from "effect/Layer";
import type * as Stdio from "effect/Stdio";
import type * as Terminal from "effect/Terminal";
import type { CliLinks } from "./CliLinks.ts";

const $I = $CliKitId.create("CliEnv");
const CliEnvOptionsFormatter = S.declare<Partial<CliOutput.Formatter>>((value): value is Partial<CliOutput.Formatter> =>
  P.isObjectKeyword(value)
).pipe(
  $I.annoteSchema("CliEnvOptionsFormatter", {
    description: "Formatter overrides for effect/cli help and error output.",
  })
);
const CliEnvOptionsStderrIsTerminal = S.declare<Effect.Effect<boolean>>((value): value is Effect.Effect<boolean> =>
  Effect.isEffect(value)
).pipe(
  $I.annoteSchema("CliEnvOptionsStderrIsTerminal", {
    description: "An effect that reports whether stderr is a terminal.",
  })
);

/**
 * Options for {@link CliEnv.layer} and for `CliRuntime.main`'s `env` option.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { CliEnvOptions } from "@beep/cli-kit/CliEnv"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CliEnvOptions)({ audienceEnvVar: "TOOL_AUDIENCE" })) // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class CliEnvOptions extends S.Opaque<CliEnvOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * A module of the running program itself, as a `file:` URL or an absolute path: pass the bin's `import.meta.url`.
     * `spans: "app"` keeps the spans of the package that holds it, even when it is installed under
     * `node_modules/@effected/` (a kit companion's bin); see `CliFailureOptions.appModule`. Only `CliRuntime.main`
     * reads this.
     */
    appModule: S.optionalKey(S.String).pipe(
      $I.annoteKey("CliEnvOptions.appModule", { description: "The appModule field of CliEnvOptions." })
    ),
    /** The environment variable that overrides the audience, read through `Config`; see `Audience.layer`. */
    audienceEnvVar: S.optionalKey(S.String).pipe(
      $I.annoteKey("CliEnvOptions.audienceEnvVar", { description: "The audienceEnvVar field of CliEnvOptions." })
    ),
    /**
     * Turns an absolute path into its display form, for example relative to the workspace: the stack frames of the
     * default failure report are shown through it. Only `CliRuntime.main` reads this. The identity by default.
     */
    displayPath: S.optionalKey(DisplayPath).pipe(
      $I.annoteKey("CliEnvOptions.displayPath", { description: "The displayPath field of CliEnvOptions." })
    ),
    /** Whether file links open in an editor; `auto` by default. See {@link CliLinks}. */
    editorLinks: S.optionalKey(EditorLinks).pipe(
      $I.annoteKey("CliEnvOptions.editorLinks", { description: "The editorLinks field of CliEnvOptions." })
    ),
    /** The environment variable that overrides `editorLinks`, read through `Config`. Not read unless named. */
    editorLinksEnvVar: S.optionalKey(S.String).pipe(
      $I.annoteKey("CliEnvOptions.editorLinksEnvVar", { description: "The editorLinksEnvVar field of CliEnvOptions." })
    ),
    /**
     * Methods of core's `CliOutput.Formatter` to replace in the one `CliRuntime.main` installs, for example
     * `formatVersion` to name the carrier a bin runs through. Only `CliRuntime.main` reads this.
     *
     * **Details**
     *
     * `main` installs a coloured default formatter inside the platform, which shadows any formatter the platform
     * sets; this is the way to keep a method of your own. Methods you omit keep the coloured defaults.
     */
    formatter: S.optionalKey(CliEnvOptionsFormatter).pipe(
      $I.annoteKey("CliEnvOptions.formatter", { description: "The formatter field of CliEnvOptions." })
    ),
    /**
     * Diagnostics options. Only `CliRuntime.main` reads this: when given, `main` uses `CliLog.layer` with these
     * options as the program's logger, instead of the default `CliLogger.layer()`. The platform is built under
     * that logger, so a line it logs while building goes to stderr.
     *
     * **Details**
     *
     * It may carry the `file` option, which also writes an async NDJSON file. The platform must then provide
     * `FileSystem` and `Path`, and `main`'s type says so when it does not.
     *
     * A platform or program that installs its own `Logger.layer([...])` replaces this logger set, and the
     * diagnostics go silent with no error: do not install one. See `CliLog.layer`. Only `CliLog`'s own records can be
     * silenced (`plainLogger: false`): what the platform logs while it builds goes through the full `CliLog` when its
     * build-time format is NDJSON (`json`, or `auto` for an agent or a CI; see `CliLogOptions.format`) and through a plain
     * `CliLogger` otherwise, routed by `logger.stderrFrom` as the host set it. The audience-override warning is never silenced: it is written exactly once, in NDJSON when
     * the build-time format is NDJSON and as a plain line otherwise, to stderr alone (never stdout, whatever
     * `logger.stderrFrom` says) and never to the host's `extraLoggers` or log file. The failure report and the `CliMessage` lines always
     * go through a plain `CliLogger`.
     */
    log: S.optionalKey(S.Union([CliLogOptions, CliLogFileOptions])).pipe(
      $I.annoteKey("CliEnvOptions.log", { description: "The log field of CliEnvOptions." })
    ),
    /**
     * Which spans the default failure report's `in: outer › inner` trail names: `app`, the default, leaves out the spans
     * the kit's own packages and Effect define (judged by the file of each span's definition site under `node_modules`),
     * `all` shows every span, and `off` drops the trail. Applies to the report `main` writes,
     * `FailureDetails.defaultLines` and `FailureDetails.lines`. Only `CliRuntime.main` reads this.
     */
    spans: S.optionalKey(S.Union([S.Literal("app"), S.Literal("all"), S.Literal("off")])).pipe(
      $I.annoteKey("CliEnvOptions.spans", { description: "The spans field of CliEnvOptions." })
    ),
    /**
     * The environment variable that sets `spans` at run time (`app`, `all` or `off`, case-insensitive), read through
     * `Config`, as `log.envVar` sets the log level: so a user filing a bug can run `TOOL_SPANS=all tool …` without a
     * rebuild. `spans` beats it (the variable is then not read at all); unset or empty is the default; a value that is
     * not a setting is ignored with one warning. Not read unless named. Only `CliRuntime.main` reads this.
     */
    spansEnvVar: S.optionalKey(S.String).pipe(
      $I.annoteKey("CliEnvOptions.spansEnvVar", { description: "The spansEnvVar field of CliEnvOptions." })
    ),
    /**
     * Which frames of a defect's stack the default failure report shows: `app`, the default, leaves out every
     * `node_modules` frame (Effect's and any other dependency's) and the runtime's own (every `node:` frame and every
     * frame with no file), and prints how many it left out after the frames it shows, as
     * `(+N internal frames hidden)`, or `no user frames (N internal frames hidden)` when none is left; `all` shows
     * every frame. Applies to the report `main` writes, `FailureDetails.defaultLines` and `FailureDetails.lines`. Only
     * `CliRuntime.main` reads this.
     */
    stackFrames: S.optionalKey(S.Union([S.Literal("app"), S.Literal("all")])).pipe(
      $I.annoteKey("CliEnvOptions.stackFrames", { description: "The stackFrames field of CliEnvOptions." })
    ),
    /**
     * Overrides the stderr terminal check; `Stdio` reports only stdout, so stderr mirrors it otherwise.
     *
     * **Gotchas**
     *
     * Mirroring means a program whose stdout is a terminal but whose stderr is redirected to a file still paints
     * stderr (a failure report, a warning) with colour escapes. A Node host that redirects stderr passes the real
     * answer: `env: { stderrIsTerminal: Effect.sync(() => process.stderr.isTTY === true) }`. Core's `Stdio` has no
     * stderr terminal check to read instead; that gap is tracked upstream as Effect-TS/effect#8639.
     */
    stderrIsTerminal: S.optionalKey(CliEnvOptionsStderrIsTerminal).pipe(
      $I.annoteKey("CliEnvOptions.stderrIsTerminal", { description: "The stderrIsTerminal field of CliEnvOptions." })
    ),
    /** Options for the theme; see {@link CliThemeOptions}. */
    theme: S.optionalKey(CliThemeOptions).pipe(
      $I.annoteKey("CliEnvOptions.theme", { description: "The theme field of CliEnvOptions." })
    ),
  }).pipe($I.annoteSchema("CliEnvOptions", { description: "Plain CliEnvOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CliEnvOptions } from "@beep/cli-kit/CliEnv"
 * import * as S from "effect/Schema"
 *
 * const plain: CliEnvOptions.Encoded = { audienceEnvVar: "TOOL_AUDIENCE" }
 * console.log(S.is(CliEnvOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliEnvOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliEnvOptions.Encoded;
}

/**
 * The services {@link CliEnv.layer} provides.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CliEnvServices = CurrentRuntimeEnv | TerminalEnv | Audience | CliTheme | CliLinks | Terminal.Terminal;

/**
 * Options for {@link CliEnv.layerTest}: the answers a test fixes. Every field has a quiet default.
 *
 * **Example** (Fix terminal answers for a test)
 *
 * ```ts
 * import { CliEnvTestOptions } from "@beep/cli-kit/CliEnv";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CliEnvTestOptions)({ tty: true, columns: 80, audience: "human" })) // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class CliEnvTestOptions extends S.Opaque<CliEnvTestOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Whether standard input, output and error are all terminals; `false` by default, as for a pipe. */
    tty: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("CliEnvTestOptions.tty", { description: "Whether all three standard streams are terminals." })
    ),
    /**
     * The `TERM` the layer's own builds read: `dumb` makes a terminal not interactive and, with the theme's glyphs at
     * `auto`, draws ASCII. Unset by default, whatever the host's `TERM` is.
     */
    term: S.optionalKey(S.String).pipe(
      $I.annoteKey("CliEnvTestOptions.term", { description: "The TERM answer read by this test environment." })
    ),
    /** The audience; `human` by default. */
    audience: S.optionalKey(AudienceKind).pipe(
      $I.annoteKey("CliEnvTestOptions.audience", { description: "The fixed audience of the test run." })
    ),
    /** The width of the terminal, in columns; none by default, so a width falls back to the reader's (80). */
    columns: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("CliEnvTestOptions.columns", {
        description: "The terminal width answer, preserved exactly as supplied.",
      })
    ),
    /** The colour level of both stdout and stderr; `none` by default. Fixed as given: `term` does not change it. */
    color: S.optionalKey(ColorLevel).pipe(
      $I.annoteKey("CliEnvTestOptions.color", { description: "Fixed colour support for stdout and stderr." })
    ),
    /** Options for the theme, as {@link CliEnvOptions.theme}; its glyphs are `auto` by default, so `term` decides. */
    theme: S.optionalKey(CliThemeOptions).pipe(
      $I.annoteKey("CliEnvTestOptions.theme", { description: "Token and glyph overrides for the test theme." })
    ),
  }).pipe(
    $I.annoteSchema("CliEnvTestOptions", {
      description: "Plain terminal, audience and theme answers for a CLI test environment.",
    })
  )
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CliEnvTestOptions } from "@beep/cli-kit/CliEnv"
 * import * as S from "effect/Schema"
 *
 * const plain: CliEnvTestOptions.Encoded = { audience: "agent", columns: 80 }
 * console.log(S.is(CliEnvTestOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliEnvTestOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliEnvTestOptions.Encoded;
}

/**
 * The services {@link CliEnv.layerTest} provides.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CliEnvTestServices = TerminalEnv | Audience | CliTheme;

/**
 * The environment services a CLI reads, built once and in the right order.
 *
 * **Details**
 *
 * Builds `CurrentRuntimeEnv`, `TerminalEnv`, `Audience`, `CliTheme` and `CliLinks`, and sets `CliInteractive` from them, then
 * installs the two gates for the program: `CliPrompt.gateTerminal`, which replaces `Terminal` with a quiet one when
 * the run is not interactive so no prompt runner ever attaches to stdin, and `CliPrompt.gateWizard`, which drops
 * `--wizard` then. `TerminalEnv` is built from the real terminal first. The layer therefore also outputs
 * `Terminal`, the gated one, and consumers never compose the gates themselves. A
 * `Context.Reference`'s key type is `never`, so the layer's output type does not list `CliInteractive`: it sets
 * the reference rather than providing a service. Every read of the environment goes through `Config` and
 * degrades to "unset" when it fails, so building the layer does not fail on a bad provider; it fails only when
 * `Stdio` or `Terminal` do.
 *
 * `CliLinks` reads `FileSystem` and `Path` from the surrounding context if it has them, and does not require them: a
 * `.vscode/` directory is looked for, and a relative path resolved, only when the platform is provided OUTSIDE this
 * layer, as `CliRuntime.main` does. Without them `auto` is `vscode` on the terminal signal alone.
 *
 * Not interactive, the gated `Terminal`'s `readLine` fails as a quit, its input is already ended and its `display`
 * writes nothing. A program that reads piped data must read `Stdio.stdin`, and one that writes output must use
 * `Console` or `Stdio`, never `Terminal`. It also installs `CliTheme.promptTheme`, so core's prompts follow the
 * theme.
 *
 * **Example** (Build the CLI environment once)
 *
 * ```ts
 * import { CliEnv } from "@beep/cli-kit/CliEnv";
 * import * as Layer from "effect/Layer";
 *
 * const environment = CliEnv.layer({ audienceEnvVar: "TOOL_AUDIENCE" });
 * console.log(Layer.isLayer(environment)); // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class CliEnv {
  private constructor() {}

  /**
   * The environment services for the terminal `Stdio` and `Terminal` describe.
   *
   * **Gotchas**
   *
   * A layer-returning function mints a fresh layer per call: call it once and bind the result to a constant.
   *
   * **Example** (Construct the terminal environment layer)
   *
   * ```ts
   * import { CliEnv } from "@beep/cli-kit/CliEnv";
   * import * as Layer from "effect/Layer";
   *
   * const environment = CliEnv.layer();
   * console.log(Layer.isLayer(environment)); // true
   * ```
   *
   * @param options - the audience env var, the stderr check and the theme options
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    options: CliEnvOptions.Encoded = {}
  ): Layer.Layer<CliEnvServices, never, Stdio.Stdio | Terminal.Terminal> => {
    const base = LayerModule.mergeAll(
      CurrentRuntimeEnv.layer,
      TerminalEnv.layer(
        options.stderrIsTerminal === undefined ? undefined : { stderrIsTerminal: options.stderrIsTerminal }
      )
    );
    const withAudience = Audience.layer(
      options.audienceEnvVar === undefined ? undefined : { envVar: options.audienceEnvVar }
    ).pipe(LayerModule.provideMerge(base));
    const withTheme = CliTheme.layer(options.theme).pipe(LayerModule.provideMerge(withAudience));
    // `FileSystem` and `Path` are read from the environment if it has them, not required, so this layer and every
    // `CliRuntime.main` overload keep their requirements; without them `auto` is `vscode` on the terminal signal only.
    const withLinks = ambientLinksLayer({
      ...O.getSomesStruct({ editorLinks: O.fromUndefinedOr(options.editorLinks) }),
      ...O.getSomesStruct({ envVar: O.fromUndefinedOr(options.editorLinksEnvVar) }),
    }).pipe(LayerModule.provideMerge(withTheme));
    // Sets the CliInteractive reference from the audience and terminal; it has no output type of its own.
    const withInteractive = CliInteractive.layer.pipe(LayerModule.provideMerge(withLinks));
    // The gates read CliInteractive when built, and the terminal gate wraps the REAL Terminal, which the
    // environment layers above have already read.
    // `promptTheme` bridges the theme to core's prompts, so they follow the terminal's colour too.
    return LayerModule.mergeAll(CliPrompt.gateTerminal, CliPrompt.gateWizard, CliTheme.promptTheme).pipe(
      LayerModule.provideMerge(withInteractive)
    );
  };

  /**
   * The environment services a test fixes, needing nothing and reading nothing of the host's: `TerminalEnv` and
   * `Audience` from the answers given, `CliTheme` built from them as {@link CliEnv.layer} builds it, and
   * `CliInteractive` set from them by the same rule (a human, every stream a terminal, and a `TERM` that is not
   * `dumb`).
   *
   * **Details**
   *
   * `term` is handed to the theme and interactivity builds alone, through a `ConfigProvider` of their own: the
   * program under the layer keeps its own provider, and a host's `TERM` (a test runner in a dumb terminal) never
   * decides. A screen or a live view also needs `UiStreams` from `@effected/cli/ui`, which `CliUiTest` provides; this
   * layer provides no `Terminal` and installs neither of `CliEnv.layer`'s prompt gates.
   *
   * A layer-returning function mints a fresh layer per call: call it once and bind the result to a constant.
   *
   * **Example** (Fix a noninteractive test environment)
   *
   * ```ts
   * import { CliEnv } from "@beep/cli-kit/CliEnv";
   * import { CliInteractive } from "@beep/cli-kit/CliInteractive";
   * import * as Effect from "effect/Effect";
   *
   * const environment = CliEnv.layerTest();
   * const program = Effect.provide(CliInteractive, environment);
   * console.log(Effect.runSync(program)); // false
   * ```
   *
   * @param options - whether the streams are terminals, the `TERM`, the audience, the width, the colour and the theme
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (options: CliEnvTestOptions.Encoded = R.empty()): Layer.Layer<CliEnvTestServices> => {
    const tty = options.tty ?? false;
    const stream: Partial<StreamEnv> = {
      isTerminal: tty,
      color: options.color ?? ColorLevel.Enum.none,
      columns: O.fromUndefinedOr(options.columns),
    };
    const facts = LayerModule.mergeAll(
      TerminalEnv.layerTest({ stdinIsTerminal: tty, stdout: stream, stderr: stream }),
      Audience.layerTest(options.audience ?? AudienceKind.Enum.human)
    );
    // Only these two builds read TERM, and only while they are built: they get it from a provider of their own.
    const term = ConfigProvider.layer(
      ConfigProvider.fromUnknown(options.term === undefined ? {} : { TERM: options.term })
    );
    return LayerModule.mergeAll(CliTheme.layer(options.theme), CliInteractive.layer).pipe(
      LayerModule.provide(term),
      LayerModule.provideMerge(facts)
    );
  };
}
