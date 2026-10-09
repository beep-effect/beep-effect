import { dual } from "effect/Function";
import type { AudienceKind, ColorLevel } from "../env/index.ts";
import { TerminalEnv } from "../env/index.ts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { Prompt } from "effect/cli";
import type { GlyphSet } from "./Glyphs.ts";
import { Glyphs } from "./Glyphs.ts";
import { openSequence, paintStyle } from "./internal/ansi.ts";
import type { Status } from "./Status.ts";
import type { Style, TokenName } from "./Token.ts";
import { Token } from "./Token.ts";

/**
 * The shape of the {@link CliTheme} service: a colour level, a glyph set and the functions that use them.
 *
 * @remarks
 * The whole shape is one immutable value with no mockable behaviour, so `Layer.succeed` (via
 * {@link CliTheme.layerTest}) is the complete double.
 *
 * @public
 */
export interface CliThemeShape extends StreamTheme {
	/**
	 * The theme of one output stream, painting with THAT stream's colour level.
	 *
	 * @remarks
	 * The members above are the `stdout` ones. Anything written to stderr must be painted through
	 * `forStream("stderr")`: redirecting one stream (`tool 2>err.log`, `tool | jq`) changes that stream's colour
	 * and not the other's.
	 */
	readonly forStream: (stream: "stdout" | "stderr") => StreamTheme;
}

/**
 * A theme bound to one stream's colour level.
 *
 * @public
 */
export interface StreamTheme {
	/** Render `text` in a token or an explicit style; the identity when colour is `none`. */
	readonly paint: (token: TokenName | Style, text: string) => string;
	/**
	 * The resolved {@link Style} of a token or style: the one `paint` renders, whatever the colour level.
	 *
	 * @remarks
	 * Pure data, for a renderer that is not ANSI (an Ink component maps it to its own props). It applies this
	 * theme's token overrides, so it is `Token.resolve` with them.
	 */
	readonly style: (token: TokenName | Style) => Style;
	/** The raw opening SGR sequence of a token or style; `""` when colour is `none`. */
	readonly sgr: (token: TokenName | Style) => string;
	/** The glyph set in use. */
	readonly glyphs: GlyphSet;
	/** The colour level of the stream. */
	readonly color: ColorLevel;
	/**
	 * Render a status from a vocabulary: its glyph, sanitised (see `Status.glyph`) and painted with its token, then
	 * `text` when given, as it is: sanitising `text` is the caller's, as `CliMessage` and `CliLog.status` do.
	 */
	readonly status: <N extends string>(vocab: Status<N>, name: N, text?: string) => string;
}

/**
 * Options for {@link CliTheme.layer}.
 *
 * @public
 */
export interface CliThemeOptions {
	/** Styles that replace the default of a token. */
	readonly tokens?: Partial<Record<TokenName, Style>> | undefined;
	/** The glyph set. `auto`, the default, is ASCII only when `TERM=dumb`. */
	readonly glyphs?: "unicode" | "ascii" | "auto" | undefined;
}

/**
 * Options for {@link CliTheme.layerTest}.
 *
 * @public
 */
export interface CliThemeTestOptions {
	/** The stdout colour level; `none` by default. */
	readonly color?: ColorLevel | undefined;
	/** The stderr colour level; the same as `color` by default. */
	readonly stderrColor?: ColorLevel | undefined;
	/** The glyph set; Unicode by default. */
	readonly glyphs?: "unicode" | "ascii" | undefined;
}

/**
 * A stream theme at `color`, over a style resolution and a glyph set: the one way a {@link StreamTheme} is built.
 *
 * @internal
 */
export const streamThemeAt: {
	(glyphs: GlyphSet, color: ColorLevel): (resolve: (token: TokenName | Style) => Style) => StreamTheme;
	(resolve: (token: TokenName | Style) => Style, glyphs: GlyphSet, color: ColorLevel): StreamTheme;
} = dual(3, (
	resolve: (token: TokenName | Style) => Style,
	glyphs: GlyphSet,
	color: ColorLevel,
): StreamTheme => {
	const paint = (token: TokenName | Style, text: string): string => paintStyle(resolve(token), color, text);
	return {
		paint,
		style: resolve,
		sgr: (token) => openSequence(resolve(token), color),
		glyphs,
		color,
		status: (vocab, name, text) => {
			// The glyph comes sanitised from the vocabulary; only the kit's own paint wraps it.
			const glyph = paint(vocab.def(name).token, vocab.glyph(name, glyphs));
			return text === undefined || text === "" ? glyph : `${glyph} ${text}`;
		},
	};
});

/** The audience rule, shared by `CliTheme.forAudience` and the class's own docs. */
const forAudience = (theme: StreamTheme, audience: AudienceKind | undefined): StreamTheme =>
	audience === "agent" && theme.color !== "none" ? streamThemeAt(theme.style, theme.glyphs, "none") : theme;

const make = (
	colors: { readonly stdout: ColorLevel; readonly stderr: ColorLevel },
	glyphs: GlyphSet,
	overrides: Partial<Record<TokenName, Style>> | undefined,
): CliThemeShape => {
	const resolve = (token: TokenName | Style): Style => Token.resolve(token, overrides);
	const stdout = streamThemeAt(resolve, glyphs, colors.stdout);
	const stderr = streamThemeAt(resolve, glyphs, colors.stderr);
	return { ...stdout, forStream: (stream) => (stream === "stdout" ? stdout : stderr) };
};

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
 * @remarks
 * A `Context.Service`, not a `Reference`. A colour level is a fact about the terminal, not a preference with a
 * safe default, so there is nothing sensible for an unprovided theme to read; requiring it puts `CliTheme` in
 * `R` and a program that forgot to wire it fails to compile rather than printing plain text to a colour
 * terminal. {@link CliTheme.layer} reads `TerminalEnv`.
 *
 * @public
 */
export class CliTheme extends Context.Service<CliTheme, CliThemeShape>()("@beep/scratchpad/effected/cli/CliTheme") {
	/**
	 * The theme for the terminal `TerminalEnv` describes.
	 *
	 * @remarks
	 * Bind the layer to a constant and provide it once. With `glyphs: "auto"` the glyph set is ASCII only when
	 * `TERM=dumb`, read through `Config`.
	 *
	 * @param options - token overrides and the glyph set
	 */
	static readonly layer = (options?: CliThemeOptions): Layer.Layer<CliTheme, never, TerminalEnv> =>
		Layer.effect(
			CliTheme,
			Effect.gen(function* () {
				const terminal = yield* TerminalEnv;
				const choice = options?.glyphs ?? "auto";
				// TERM is read through Config (never process) only when it can matter, and handed to the pure selection.
				const term =
					choice === "auto"
						? O.getOrUndefined(
								yield* Config.option(Config.String("TERM")).pipe(Effect.orElseSucceed(() => O.none<string>())),
							)
						: undefined;
				const glyphs = Glyphs.select({
					ascii: choice === "ascii" ? true : choice === "unicode" ? false : "auto",
					...(term === undefined ? {} : { term }),
				});
				return make({ stdout: terminal.stdout.color, stderr: terminal.stderr.color }, glyphs, options?.tokens);
			}),
		);

	/**
	 * The theme an audience sees of `theme`: for an agent, the same theme at colour `none` (`paint` the identity, `sgr`
	 * empty, `status` unpainted), whatever the terminal could do, because an agent never gets an escape of any kind; for
	 * anyone else, or when the audience is not known, `theme` itself.
	 *
	 * @remarks
	 * The one rule the kit applies wherever it paints for an audience: `Render.context` takes its colour and `paint`
	 * from it, `CliMessage` and `CliLog.status` paint their glyphs through it, and `./ui` gives it to the trees it
	 * mounts, so `useTheme`, `Styled` and the widgets' colour-`none` text markers all agree. A program that paints its
	 * own lines applies the same rule with it rather than re-implementing it:
	 *
	 * ```ts
	 * const line = Effect.gen(function* () {
	 *   const theme = CliTheme.forAudience((yield* CliTheme).forStream("stdout"), (yield* Audience).kind)
	 *   return theme.status(Status.core, "success", Fmt.sanitize(name))
	 * })
	 * ```
	 *
	 * Pure: it reads nothing, so the audience is the caller's to pass, `undefined` when it is not known.
	 *
	 * @param theme - a stream's theme, such as `CliTheme.forStream("stdout")`
	 * @param audience - who the output is for, or `undefined` when that is not known
	 */
	static readonly forAudience: (theme: StreamTheme, audience: AudienceKind | undefined) => StreamTheme = forAudience;

	/**
	 * A fixed theme that needs nothing; `none` colour and Unicode glyphs unless told otherwise.
	 *
	 * @param options - the colour level and glyph set
	 */
	static readonly layerTest = (options?: CliThemeTestOptions): Layer.Layer<CliTheme> =>
		Layer.succeed(
			CliTheme,
			make(
				{ stdout: options?.color ?? "none", stderr: options?.stderrColor ?? options?.color ?? "none" },
				options?.glyphs === "ascii" ? Glyphs.ascii : Glyphs.unicode,
				undefined,
			),
		);

	/**
	 * Sets core's `Prompt.Theme` from the tokens, so built-in prompts match the rest of the output.
	 *
	 * @remarks
	 * The colour fields are raw SGR openers and are empty strings when colour is `none`. Under ASCII glyphs the
	 * prompt symbols fall back to ASCII too. A colourless theme is not byte-clean: core's `Ansi.annotate`
	 * appends a `\x1b[0m` reset, and prompts write cursor and underline codes, whatever the theme says.
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
		}),
	);
}
