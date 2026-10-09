/**
 * A named terminal colour: the eight ANSI colours and their bright variants.
 *
 * @remarks
 * The bright variants are spelled as chalk and Ink spell them (`redBright`, `blackBright`), so a style maps to
 * either without a rename table. `gray` is chalk's alias for `blackBright`.
 *
 * @public
 */
export type NamedColor =
	| "black"
	| "red"
	| "green"
	| "yellow"
	| "blue"
	| "magenta"
	| "cyan"
	| "white"
	| "blackBright"
	| "redBright"
	| "greenBright"
	| "yellowBright"
	| "blueBright"
	| "magentaBright"
	| "cyanBright"
	| "whiteBright"
	| "gray";

/**
 * A terminal style: an optional foreground colour and text attributes.
 *
 * @remarks
 * A style is data; it carries no escape sequences. `CliTheme.paint` renders it for the terminal's colour
 * level, and at level `none` rendering is the identity. A hex foreground that is not `#rgb` or `#rrggbb`, and
 * a name that is not a {@link NamedColor}, is ignored when rendered rather than failing.
 *
 * @public
 */
export interface Style {
	/** The foreground: a named colour or a `#rrggbb` hex. */
	readonly fg?: NamedColor | `#${string}`;
	/** Bold. */
	readonly bold?: boolean;
	/** Dim, or faint. */
	readonly dim?: boolean;
	/** Italic. */
	readonly italic?: boolean;
	/** Underline. */
	readonly underline?: boolean;
}

/**
 * The semantic tokens a theme resolves to a {@link Style}.
 *
 * @public
 */
export type TokenName = "success" | "failure" | "warning" | "info" | "error" | "muted" | "accent" | "emphasis";

/** The default style of every token. Deeply frozen: the record is shared. */
const DEFAULTS: Readonly<Record<TokenName, Style>> = Object.freeze({
	success: Object.freeze({ fg: "green" }),
	failure: Object.freeze({ fg: "red" }),
	error: Object.freeze({ fg: "red", bold: true }),
	warning: Object.freeze({ fg: "yellow" }),
	info: Object.freeze({ fg: "cyan" }),
	muted: Object.freeze({ dim: true }),
	accent: Object.freeze({ fg: "cyan" }),
	emphasis: Object.freeze({ bold: true }),
} as const);

/**
 * Constructors for {@link Style} values, and the pure resolution of a token to one.
 *
 * @public
 */
export class Token {
	private constructor() {}

	/**
	 * The default {@link Style} of every token, frozen.
	 *
	 * @remarks
	 * Data, not a service: it is what `CliTheme` starts from, and a renderer with no Effect context (an Ink
	 * component) reads it directly.
	 */
	static readonly defaults: Readonly<Record<TokenName, Style>> = DEFAULTS;

	/**
	 * The style a token or style resolves to, as a pure function: no service, no terminal.
	 *
	 * @remarks
	 * An explicit style resolves to itself. A token name resolves to its override when `overrides` has one, else
	 * its default; a name that is not a token (including an `Object.prototype` member) resolves to the empty
	 * style. This is the same resolution `CliTheme.paint` applies, which is what `StreamTheme.style` reports.
	 *
	 * @param token - a token name or an explicit style
	 * @param overrides - styles that replace the default of a token, as `CliThemeOptions.tokens` does
	 */
	static readonly resolve = (token: TokenName | Style, overrides?: Partial<Record<TokenName, Style>>): Style => {
		if (typeof token !== "string") return token;
		const own = overrides !== undefined && Object.hasOwn(overrides, token) ? overrides[token] : undefined;
		if (own !== undefined) return own;
		return Object.hasOwn(DEFAULTS, token) ? DEFAULTS[token] : {};
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
