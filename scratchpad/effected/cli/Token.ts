import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/cli/Token");

/**
 * A named terminal colour: the eight ANSI colours and their bright variants.
 *
 * **Details**
 *
 * The bright variants are spelled as chalk and Ink spell them (`redBright`, `blackBright`), so a style maps to
 * either without a rename table. `gray` is chalk's alias for `blackBright`.
 *
 * @public
 */
export const NamedColor = LiteralKit([
	"black",
	"red",
	"green",
	"yellow",
	"blue",
	"magenta",
	"cyan",
	"white",
	"blackBright",
	"redBright",
	"greenBright",
	"yellowBright",
	"blueBright",
	"magentaBright",
	"cyanBright",
	"whiteBright",
	"gray",
]).annotate($I.annote("NamedColor", { description: "Named ANSI colors and their bright variants." }));
export type NamedColor = typeof NamedColor.Type;

/**
 * A terminal style: an optional foreground colour and text attributes.
 *
 * **Details**
 *
 * A style is data; it carries no escape sequences. `CliTheme.paint` renders it for the terminal's colour
 * level, and at level `none` rendering is the identity. A hex foreground that is not `#rgb` or `#rrggbb`, and
 * a name that is not a {@link NamedColor}, is ignored when rendered rather than failing.
 *
 * @public
 */
export const Style = S.Struct({
	/** The foreground: a named colour or a hex spelling, including invalid hex handled by the renderer. */
	fg: S.optionalKey(S.Union([NamedColor, S.TemplateLiteral(["#", S.String])])).annotate(
		$I.annote("Style.fg", { description: "The fg field of Style." }),
	),
	/** Bold. */
	bold: S.optionalKey(S.Boolean).annotate($I.annote("Style.bold", { description: "The bold field of Style." })),
	/** Dim, or faint. */
	dim: S.optionalKey(S.Boolean).annotate($I.annote("Style.dim", { description: "The dim field of Style." })),
	/** Italic. */
	italic: S.optionalKey(S.Boolean).annotate($I.annote("Style.italic", { description: "The italic field of Style." })),
	/** Underline. */
	underline: S.optionalKey(S.Boolean).annotate(
		$I.annote("Style.underline", { description: "The underline field of Style." }),
	),
}).annotate($I.annote("Style", { description: "A readonly terminal foreground and text attributes." }));
export type Style = typeof Style.Type;

/**
 * The semantic tokens a theme resolves to a {@link Style}.
 *
 * @public
 */
export const TokenName = LiteralKit([
	"success",
	"failure",
	"warning",
	"info",
	"error",
	"muted",
	"accent",
	"emphasis",
]).annotate($I.annote("TokenName", { description: "Semantic tokens resolved by a CLI theme." }));
export type TokenName = typeof TokenName.Type;

/** The default style of every token. Readonly data: the record is shared. */
const DEFAULTS: Readonly<Record<TokenName, Style>> = {
	success: { fg: "green" },
	failure: { fg: "red" },
	error: { fg: "red", bold: true },
	warning: { fg: "yellow" },
	info: { fg: "cyan" },
	muted: { dim: true },
	accent: { fg: "cyan" },
	emphasis: { bold: true },
} as const;

/**
 * Constructors for {@link Style} values, and the pure resolution of a token to one.
 *
 * @public
 */
export class Token {
	private constructor() {}

	/**
  * The default {@link Style} of every token, readonly.
  *
  * **Details**
  *
  * Data, not a service: it is what `CliTheme` starts from, and a renderer with no Effect context (an Ink
  * component) reads it directly.
  */
	static readonly defaults: Readonly<Record<TokenName, Style>> = DEFAULTS;

	/**
  * The style a token or style resolves to, as a pure function: no service, no terminal.
  *
  * **Details**
  *
  * An explicit style resolves to itself. A token name resolves to its override when `overrides` has one, else
  * its default; a name that is not a token (including an `Object.prototype` member) resolves to the empty
  * style. This is the same resolution `CliTheme.paint` applies, which is what `StreamTheme.style` reports.
  *
  * @param token - a token name or an explicit style
  * @param overrides - styles that replace the default of a token, as `CliThemeOptions.tokens` does
  */
	static readonly resolve = (token: TokenName | Style, overrides?: Partial<Record<TokenName, Style>>): Style => {
		if (!P.isString(token)) return token;
		const own =
			overrides !== undefined && R.has<string, Style | undefined>(overrides, token) ? overrides[token] : undefined;
		if (own !== undefined) return own;
		return R.has(DEFAULTS, token) ? DEFAULTS[token] : {};
	};

	/**
	 * A foreground from a hex colour.
	 *
	 * @param hex - `#rrggbb` (or `#rgb`)
	 */
	static readonly hex = (hex: `#${string}`): Style => ({ fg: hex });

	/**
	 * A foreground from a named colour.
	 *
	 * @param color - the colour
	 */
	static readonly named = (color: NamedColor): Style => ({ fg: color });

	/**
	 * A style, as written. Exists so a style reads as a token at a call site.
	 *
	 * @param style - the style
	 */
	static readonly style = (style: Style): Style => style;
}
