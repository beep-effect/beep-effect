/**
 * The theme service: per-stream colour level, glyph set and the paint, SGR and status functions built from them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import { TerminalEnv } from "@beep/runtime-env";
import { ColorLevel } from "@beep/runtime-env/ColorLevel";
import * as O from "@beep/utils/Option";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Prompt from "effect/cli/Prompt";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { GlyphSet, Glyphs } from "./Glyphs.ts";
import { openSequence, paintStyle } from "./internal/ansi.ts";
import { Style, Token, TokenName } from "./Token.ts";
import type { AudienceKind } from "@beep/runtime-env";
import type { Status } from "./Status.ts";

const $I = $CliKitId.create("CliTheme");
const StreamThemePaint = S.declare<{
  (token: TokenName | Style.Encoded, text: string): string;
  (text: string): (token: TokenName | Style.Encoded) => string;
}>(
  (
    value
  ): value is {
    (token: TokenName | Style.Encoded, text: string): string;
    (text: string): (token: TokenName | Style.Encoded) => string;
  } => P.isFunction(value)
).pipe($I.annoteSchema("StreamThemePaint", { description: "Paints text with a token or style for this stream." }));
const StreamThemeSgr = S.declare<(token: TokenName | Style.Encoded) => string>(
  (value): value is (token: TokenName | Style.Encoded) => string => P.isFunction(value)
).pipe(
  $I.annoteSchema("StreamThemeSgr", { description: "The SGR escape that opens a token or style on this stream." })
);
const StreamThemeStatus = S.declare<{
  <N extends string>(vocab: Status<N>, name: N, text?: string): string;
  <N extends string>(name: N, text?: string): (vocab: Status<N>) => string;
}>(
  (
    value
  ): value is {
    <N extends string>(vocab: Status<N>, name: N, text?: string): string;
    <N extends string>(name: N, text?: string): (vocab: Status<N>) => string;
  } => P.isFunction(value)
).pipe($I.annoteSchema("StreamThemeStatus", { description: "Renders a status glyph and text from a vocabulary." }));
const StreamThemeStyle = S.declare<(token: TokenName | Style.Encoded) => Style.Encoded>(
  (value): value is (token: TokenName | Style.Encoded) => Style.Encoded => P.isFunction(value)
).pipe(
  $I.annoteSchema("StreamThemeStyle", { description: "Resolves a token or style to the style this stream paints." })
);

/**
 * The shape of the {@link CliTheme} service: a colour level, a glyph set and the functions that use them.
 *
 * **Details**
 *
 * The whole shape is one immutable value with no mockable behaviour, so `Layer.succeed` (via
 * {@link CliTheme.layerTest}) is the complete double.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CliThemeShape = (typeof CliTheme)["Service"];

/**
 * A theme bound to one stream's colour level.
 *
 * **Example** (Inspect the schema)
 *
 * ```ts
 * import { StreamTheme } from "@beep/cli-kit/CliTheme"
 *
 * console.log(typeof StreamTheme.make) // function
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class StreamTheme extends S.Opaque<StreamTheme, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The colour level of the stream. */
    color: ColorLevel.pipe($I.annoteKey("StreamTheme.color", { description: "The color field of StreamTheme." })),
    /** The glyph set in use. */
    glyphs: GlyphSet.pipe($I.annoteKey("StreamTheme.glyphs", { description: "The glyphs field of StreamTheme." })),
    /** Render `text` in a token or an explicit style; the identity when colour is `none`. */
    paint: StreamThemePaint.pipe($I.annoteKey("StreamTheme.paint", { description: "The paint field of StreamTheme." })),
    /** The raw opening SGR sequence of a token or style; `""` when colour is `none`. */
    sgr: StreamThemeSgr.pipe($I.annoteKey("StreamTheme.sgr", { description: "The sgr field of StreamTheme." })),
    /**
     * Render a status from a vocabulary: its glyph, sanitised (see `Status.glyph`) and painted with its token, then
     * `text` when given, as it is: sanitising `text` is the caller's, as `CliMessage` and `CliLog.status` do.
     */
    status: StreamThemeStatus.pipe(
      $I.annoteKey("StreamTheme.status", { description: "The status field of StreamTheme." })
    ),
    /**
     * The resolved {@link Style} of a token or style: the one `paint` renders, whatever the colour level.
     *
     * **Details**
     *
     * Pure data, for a renderer that is not ANSI (an Ink component maps it to its own props). It applies this
     * theme's token overrides, so it is `Token.resolve` with them.
     */
    style: StreamThemeStyle.pipe($I.annoteKey("StreamTheme.style", { description: "The style field of StreamTheme." })),
  }).pipe($I.annoteSchema("StreamTheme", { description: "Plain StreamTheme data." }))
) {}
/**
 * Companion types for {@link StreamTheme}.
 *
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { StreamTheme } from "@beep/cli-kit/CliTheme"
 *
 * const accepts = (_value: StreamTheme.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StreamTheme {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StreamTheme.Encoded;
}

/**
 * Options for {@link CliTheme.layer}.
 *
 * **Example** (Choose ASCII glyphs)
 *
 * ```ts
 * import { CliThemeOptions } from "@beep/cli-kit/CliTheme";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CliThemeOptions)({ glyphs: "ascii" })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class CliThemeOptions extends S.Opaque<CliThemeOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Styles that replace the default of a token. */
    tokens: S.optionalKey(S.Record(TokenName, S.optionalKey(Style))).pipe(
      $I.annoteKey("CliThemeOptions.tokens", { description: "Partial replacements for default semantic token styles." })
    ),
    /** The glyph set. `auto`, the default, is ASCII only when `TERM=dumb`. */
    glyphs: S.optionalKey(S.Literals(["unicode", "ascii", "auto"])).pipe(
      $I.annoteKey("CliThemeOptions.glyphs", { description: "Glyph selection, with auto following TERM." })
    ),
  }).pipe(
    $I.annoteSchema("CliThemeOptions", { description: "Plain token overrides and glyph selection for a CLI theme." })
  )
) {}

/**
 * Companion types for {@link CliThemeOptions}.
 *
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CliThemeOptions } from "@beep/cli-kit/CliTheme"
 * import * as S from "effect/Schema"
 *
 * const plain: CliThemeOptions.Encoded = { glyphs: "ascii" }
 * console.log(S.is(CliThemeOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliThemeOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliThemeOptions.Encoded;
}

/**
 * Options for {@link CliTheme.layerTest}.
 *
 * **Example** (Fix test colour support)
 *
 * ```ts
 * import { CliThemeTestOptions } from "@beep/cli-kit/CliTheme";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CliThemeTestOptions)({ color: "none", stderrColor: "none" })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class CliThemeTestOptions extends S.Opaque<CliThemeTestOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The stdout colour level; `none` by default. */
    color: S.optionalKey(ColorLevel).pipe(
      $I.annoteKey("CliThemeTestOptions.color", { description: "Fixed stdout colour support." })
    ),
    /** The stderr colour level; the same as `color` by default. */
    stderrColor: S.optionalKey(ColorLevel).pipe(
      $I.annoteKey("CliThemeTestOptions.stderrColor", {
        description: "Fixed stderr colour support, defaulting to stdout.",
      })
    ),
    /** The glyph set; Unicode by default. */
    glyphs: S.optionalKey(S.Literals(["unicode", "ascii"])).pipe(
      $I.annoteKey("CliThemeTestOptions.glyphs", { description: "The fixed glyph set used by a test." })
    ),
  }).pipe(
    $I.annoteSchema("CliThemeTestOptions", { description: "Plain colour and glyph answers for a test theme layer." })
  )
) {}

/**
 * Companion types for {@link CliThemeTestOptions}.
 *
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CliThemeTestOptions } from "@beep/cli-kit/CliTheme"
 * import * as S from "effect/Schema"
 *
 * const plain: CliThemeTestOptions.Encoded = { color: "basic" }
 * console.log(S.is(CliThemeTestOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliThemeTestOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliThemeTestOptions.Encoded;
}

/**
 * A stream theme at `color`, over a style resolution and a glyph set: the one way a {@link StreamTheme} is built.
 *
 * **Example** (Build a colourless ASCII stream)
 *
 * ```ts
 * import { streamThemeAt } from "@beep/cli-kit/CliTheme";
 * import { Glyphs } from "@beep/cli-kit/Glyphs";
 * import { Token } from "@beep/cli-kit/Token";
 *
 * const theme = streamThemeAt(Token.resolve, Glyphs.ascii, "none");
 * console.log(theme.paint("success", "Done")) // Done
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const streamThemeAt: {
  (
    glyphs: GlyphSet.Encoded,
    color: ColorLevel
  ): (resolve: (token: TokenName | Style.Encoded) => Style.Encoded) => StreamTheme.Encoded;
  (
    resolve: (token: TokenName | Style.Encoded) => Style.Encoded,
    glyphs: GlyphSet.Encoded,
    color: ColorLevel
  ): StreamTheme.Encoded;
} = dual(
  3,
  (
    resolve: (token: TokenName | Style.Encoded) => Style.Encoded,
    glyphs: GlyphSet.Encoded,
    color: ColorLevel
  ): StreamTheme.Encoded => {
    const paint: StreamTheme.Encoded["paint"] = dual(2, (token: TokenName | Style.Encoded, text: string): string =>
      paintStyle(resolve(token), color, text)
    );
    return {
      paint,
      style: resolve,
      sgr: (token) => openSequence(resolve(token), color),
      glyphs,
      color,
      status: dual(
        (args) => P.isObjectKeyword(args[0]),
        <N extends string>(vocab: Status<N>, name: N, text?: string): string => {
          // The glyph comes sanitised from the vocabulary; only the kit's own paint wraps it.
          const glyph = paint(vocab.def(name).token, vocab.glyph(name, glyphs));
          return text === undefined || text === "" ? glyph : `${glyph} ${text}`;
        }
      ),
    };
  }
);

/** The audience rule, shared by `CliTheme.forAudience` and the class's own docs. */
const forAudience: {
  (theme: StreamTheme.Encoded, audience: AudienceKind | undefined): StreamTheme.Encoded;
  (audience: AudienceKind | undefined): (theme: StreamTheme.Encoded) => StreamTheme.Encoded;
} = dual(
  2,
  (theme: StreamTheme.Encoded, audience: AudienceKind | undefined): StreamTheme.Encoded =>
    audience === "agent" && theme.color !== "none" ? streamThemeAt(theme.style, theme.glyphs, "none") : theme
);

type ThemeColors = { readonly stdout: ColorLevel; readonly stderr: ColorLevel };
type ThemeOverrides = Partial<Record<TokenName, Style.Encoded>> | undefined;

const make: {
  (colors: ThemeColors, glyphs: GlyphSet.Encoded, overrides: ThemeOverrides): CliThemeShape;
  (glyphs: GlyphSet.Encoded, overrides: ThemeOverrides): (colors: ThemeColors) => CliThemeShape;
} = dual(3, (colors: ThemeColors, glyphs: GlyphSet.Encoded, overrides: ThemeOverrides): CliThemeShape => {
  const resolve = (token: TokenName | Style.Encoded): Style.Encoded => Token.resolve(token, overrides);
  const stdout = streamThemeAt(resolve, glyphs, colors.stdout);
  const stderr = streamThemeAt(resolve, glyphs, colors.stderr);
  return { ...stdout, forStream: (stream) => (stream === "stdout" ? stdout : stderr) };
});

/** The prompt glyphs that differ under ASCII; `Prompt.makeTheme` already holds the Unicode ones. */
const ASCII_PROMPT_GLYPHS = {
  prefix: "?",
  arrowUp: "^",
  arrowDown: "v",
  checkboxOn: "[x]",
  checkboxOff: "[ ]",
  tick: "+",
  pointerSmall: ">",
  pointer: ">",
} as const;

/**
 * The presentation of a CLI: colour tokens, glyphs and statuses, decided once from the terminal.
 *
 * **Details**
 *
 * A `Context.Service`, not a `Reference`. A colour level is a fact about the terminal, not a preference with a
 * safe default, so there is nothing sensible for an unprovided theme to read; requiring it puts `CliTheme` in
 * `R` and a program that forgot to wire it fails to compile rather than printing plain text to a colour
 * terminal. {@link CliTheme.layer} reads `TerminalEnv`.
 *
 * **Example** (Paint with a provided fixed theme)
 *
 * ```ts
 * import { CliTheme } from "@beep/cli-kit/CliTheme";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const theme = yield* CliTheme;
 *   return theme.paint("accent", "Ready");
 * });
 * console.log(Effect.runSync(Effect.provide(program, CliTheme.layerTest()))) // Ready
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class CliTheme extends Context.Service<
  CliTheme,
  {
    /** The colour level of the stream. */
    readonly color: ColorLevel;
    /** The glyph set in use. */
    readonly glyphs: GlyphSet.Encoded;
    /** Render `text` in a token or an explicit style; the identity when colour is `none`. */
    readonly paint: {
      (token: TokenName | Style.Encoded, text: string): string;
      (text: string): (token: TokenName | Style.Encoded) => string;
    };
    /** The raw opening SGR sequence of a token or style; `""` when colour is `none`. */
    readonly sgr: (token: TokenName | Style.Encoded) => string;
    /**
     * Render a status from a vocabulary: its glyph, sanitised (see `Status.glyph`) and painted with its token, then
     * `text` when given, as it is: sanitising `text` is the caller's, as `CliMessage` and `CliLog.status` do.
     */
    readonly status: {
      <N extends string>(vocab: Status<N>, name: N, text?: string): string;
      <N extends string>(name: N, text?: string): (vocab: Status<N>) => string;
    };
    /**
     * The resolved {@link Style} of a token or style: the one `paint` renders, whatever the colour level.
     *
     * **Details**
     *
     * Pure data, for a renderer that is not ANSI (an Ink component maps it to its own props). It applies this
     * theme's token overrides, so it is `Token.resolve` with them.
     */
    readonly style: (token: TokenName | Style.Encoded) => Style.Encoded;
    /**
     * The theme of one output stream, painting with THAT stream's colour level.
     *
     * **Gotchas**
     *
     * The members above are the `stdout` ones. Anything written to stderr must be painted through
     * `forStream("stderr")`: redirecting one stream (`tool 2>err.log`, `tool | jq`) changes that stream's colour
     * and not the other's.
     */
    readonly forStream: (stream: "stdout" | "stderr") => StreamTheme.Encoded;
  }
>()($I`CliTheme`) {
  /**
   * The theme for the terminal `TerminalEnv` describes.
   *
   * **Details**
   *
   * Bind the layer to a constant and provide it once. With `glyphs: "auto"` the glyph set is ASCII only when
   * `TERM=dumb`, read through `Config`.
   *
   * **Example** (Construct a terminal-dependent theme layer)
   *
   * ```ts
   * import { CliTheme } from "@beep/cli-kit/CliTheme";
   * import * as Layer from "effect/Layer";
   *
   * const themeLayer = CliTheme.layer({ glyphs: "ascii" });
   * console.log(Layer.isLayer(themeLayer)) // true
   * ```
   *
   * @param options - token overrides and the glyph set
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (options?: CliThemeOptions.Encoded): Layer.Layer<CliTheme, never, TerminalEnv> =>
    Layer.effect(
      CliTheme,
      Effect.gen(function* () {
        const terminal = yield* TerminalEnv;
        const choice = options?.glyphs ?? "auto";
        // TERM is read through Config (never process) only when it can matter, and handed to the pure selection.
        const term =
          choice === "auto"
            ? yield* Effect.map(
                Config.option(Config.String("TERM")).pipe(Effect.orElseSucceed(O.none<string>)),
                O.getOrUndefined
              )
            : undefined;
        const glyphs = Glyphs.select({
          ascii: choice === "ascii" ? true : choice === "unicode" ? false : "auto",
          ...O.getSomesStruct({ term: O.fromUndefinedOr(term) }),
        });
        return make({ stdout: terminal.stdout.color, stderr: terminal.stderr.color }, glyphs, options?.tokens);
      })
    );

  /**
   * The theme an audience sees of `theme`: for an agent, the same theme at colour `none` (`paint` the identity, `sgr`
   * empty, `status` unpainted), whatever the terminal could do, because an agent never gets an escape of any kind; for
   * anyone else, or when the audience is not known, `theme` itself.
   *
   * **Details**
   *
   * The one rule the kit applies wherever it paints for an audience: `Render.context` takes its colour and `paint`
   * from it, `CliMessage` and `CliLog.status` paint their glyphs through it, and `./ui` gives it to the trees it
   * mounts, so `useTheme`, `Styled` and the widgets' colour-`none` text markers all agree. A program that paints its
   * own lines applies the same rule with it rather than re-implementing it.
   *
   * Pure: it reads nothing, so the audience is the caller's to pass, `undefined` when it is not known.
   *
   * **Example** (Construct a line for the current audience)
   *
   * ```ts
   * import { CliTheme } from "@beep/cli-kit/CliTheme";
   * import { Status } from "@beep/cli-kit/Status";
   * import { Fmt } from "@beep/cli-kit/Fmt";
   * import { Audience } from "@beep/runtime-env/Audience";
   * import * as Effect from "effect/Effect";
   *
   * const name = "Ada";
   * const line = Effect.gen(function* () {
   *   const theme = CliTheme.forAudience((yield* CliTheme).forStream("stdout"), (yield* Audience).kind);
   *   return theme.status(Status.core, "success", Fmt.sanitize(name));
   * });
   * console.log(Effect.isEffect(line)) // true
   * ```
   *
   * @param theme - a stream's theme, such as `CliTheme.forStream("stdout")`
   * @param audience - who the output is for, or `undefined` when that is not known
   * @category formatting
   * @since 0.0.0
   */
  static readonly forAudience: {
    (theme: StreamTheme.Encoded, audience: AudienceKind | undefined): StreamTheme.Encoded;
    (audience: AudienceKind | undefined): (theme: StreamTheme.Encoded) => StreamTheme.Encoded;
  } = forAudience;

  /**
   * A fixed theme that needs nothing; `none` colour and Unicode glyphs unless told otherwise.
   *
   * **Example** (Keep stderr colour independent from stdout)
   *
   * ```ts
   * import { CliTheme } from "@beep/cli-kit/CliTheme";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const theme = yield* CliTheme;
   *   return theme.forStream("stderr").color;
   * });
   * const themeLayer = CliTheme.layerTest({ color: "none", stderrColor: "ansi16" });
   * console.log(Effect.runSync(Effect.provide(program, themeLayer))) // ansi16
   * ```
   *
   * @param options - the colour level and glyph set
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (options?: CliThemeTestOptions.Encoded): Layer.Layer<CliTheme> =>
    Layer.succeed(
      CliTheme,
      make(
        { stdout: options?.color ?? "none", stderr: options?.stderrColor ?? options?.color ?? "none" },
        options?.glyphs === "ascii" ? Glyphs.ascii : Glyphs.unicode,
        undefined
      )
    );

  /**
   * Sets core's `Prompt.Theme` from the tokens, so built-in prompts match the rest of the output.
   *
   * **Gotchas**
   *
   * The colour fields are raw SGR openers and are empty strings when colour is `none`. Under ASCII glyphs the
   * prompt symbols fall back to ASCII too. A colourless theme is not byte-clean: core's `Ansi.annotate`
   * appends a `\x1b[0m` reset, and prompts write cursor and underline codes, whatever the theme says.
   *
   * **Example** (Provide prompt styling from a fixed theme)
   *
   * ```ts
   * import { CliTheme } from "@beep/cli-kit/CliTheme";
   * import * as Layer from "effect/Layer";
   *
   * const promptLayer = Layer.provide(CliTheme.promptTheme, CliTheme.layerTest({ glyphs: "ascii" }));
   * console.log(Layer.isLayer(promptLayer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly promptTheme: Layer.Layer<never, never, CliTheme> = Layer.effect(
    Prompt.Theme,
    Effect.gen(function* () {
      const theme = yield* CliTheme;
      const open = (token: TokenName): string => theme.sgr(token);
      return Prompt.makeTheme({
        ...(theme.glyphs.kind === "ascii" ? ASCII_PROMPT_GLYPHS : {}),
        ellipsis: theme.glyphs.ellipsis,
        primaryColor: open("accent"),
        mutedColor: open("muted"),
        successColor: open("success"),
        errorColor: open("error"),
        submittedColor: open("emphasis"),
      });
    })
  );
}
