/**
 * The symbols a theme draws with.
 *
 * @public
 */
export interface GlyphSet {
	/** Which set this is. */
	readonly kind: "unicode" | "ascii";
	/** The truncation marker. */
	readonly ellipsis: string;
	/** The frames of a spinner, in order. */
	readonly spinner: ReadonlyArray<string>;
	/** A list bullet. */
	readonly bullet: string;
	/** A directional arrow. */
	readonly arrow: string;
	/** The separator between the segments of a breadcrumb or path: one for people, one for agents. */
	readonly pathSeparator: { readonly human: string; readonly agent: string };
	/** How long a spinner frame is shown, in milliseconds. */
	readonly spinnerIntervalMs: number;
	/**
	 * The segments a tree is drawn with: `branch` before a child that has later siblings, `last` before the final
	 * child, and `pipe` and `blank` as the indent under each. All four are one width so branches align.
	 */
	readonly tree: {
		readonly branch: string;
		readonly last: string;
		readonly pipe: string;
		readonly blank: string;
	};
}

/**
 * Options for {@link Glyphs.select}.
 *
 * @public
 */
export interface GlyphSelectOptions {
	/**
	 * `true` is ASCII, `false` is Unicode, and `auto` (the default) is ASCII only when `term` is `dumb`.
	 */
	readonly ascii?: boolean | "auto" | undefined;
	/**
	 * The `TERM` value, which only `auto` reads. It is passed in rather than read: this selection is pure, so a
	 * caller with no Effect context (an Ink component) uses it, and `process` is never consulted. Unset is not
	 * `dumb`.
	 */
	readonly term?: string | undefined;
}

/**
 * The two glyph sets: Unicode, and a plain-ASCII fallback for terminals that cannot draw it.
 *
 * @remarks
 * The sets are shared, so they and their nested values are frozen.
 *
 * @public
 */
export class Glyphs {
	private constructor() {}

	/** Unicode symbols. */
	static readonly unicode: GlyphSet = Object.freeze({
		kind: "unicode",
		ellipsis: "…",
		spinner: Object.freeze(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
		bullet: "•",
		arrow: "→",
		pathSeparator: Object.freeze({ human: "›", agent: " > " }),
		spinnerIntervalMs: 80,
		tree: Object.freeze({ branch: "├─ ", last: "└─ ", pipe: "│  ", blank: "   " }),
	});

	/**
	 * Pick a glyph set without a service: the one `CliTheme` uses, as a pure function.
	 *
	 * @remarks
	 * `CliTheme.layer` reads `TERM` through `Config` and calls this, so the two agree. `StreamEnv` carries no
	 * `TERM`, and nothing else in it decides ASCII, so the caller passes `term` when it wants `auto` to mean
	 * something.
	 *
	 * @param options - whether to force ASCII or Unicode, and the `TERM` value `auto` reads
	 */
	static readonly select = (options?: GlyphSelectOptions): GlyphSet => {
		const ascii = options?.ascii ?? "auto";
		return ascii === true || (ascii === "auto" && options?.term === "dumb") ? Glyphs.ascii : Glyphs.unicode;
	};

	/** ASCII-only symbols. */
	static readonly ascii: GlyphSet = Object.freeze({
		kind: "ascii",
		ellipsis: "...",
		spinner: Object.freeze(["-", "\\", "|", "/"]),
		bullet: "*",
		arrow: "->",
		pathSeparator: Object.freeze({ human: ">", agent: " > " }),
		spinnerIntervalMs: 80,
		tree: Object.freeze({ branch: "|-- ", last: "\\-- ", pipe: "|   ", blank: "    " }),
	});
}
