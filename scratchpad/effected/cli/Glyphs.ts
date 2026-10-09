/**
 * The symbols a theme draws with.
 *
 * @public
 * @category type-level
 * @since 0.0.0
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
 * @category type-level
 * @since 0.0.0
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
 * **Details**
 *
 * The sets are shared, so they and their nested values have readonly types.
 *
 * **Example** (Select the terminal fallback)
 *
 * ```ts
 * import { Glyphs } from "@beep/scratchpad/effected/cli/Glyphs"
 *
 * console.log(Glyphs.select({ term: "dumb" }).kind) // ascii
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export class Glyphs {
	private constructor() {}

	/**
	 * Unicode symbols.
	 *
	 * **Example** (Inspect the Unicode arrow)
	 *
	 * ```ts
	 * import { Glyphs } from "@beep/scratchpad/effected/cli/Glyphs"
	 *
	 * console.log(Glyphs.unicode.arrow) // →
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly unicode: GlyphSet = {
		kind: "unicode",
		ellipsis: "…",
		spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
		bullet: "•",
		arrow: "→",
		pathSeparator: { human: "›", agent: " > " },
		spinnerIntervalMs: 80,
		tree: { branch: "├─ ", last: "└─ ", pipe: "│  ", blank: "   " },
	};

	/**
	 * Pick a glyph set without a service: the one `CliTheme` uses, as a pure function.
	 *
	 * **Details**
	 *
	 * `CliTheme.layer` reads `TERM` through `Config` and calls this, so the two agree. `StreamEnv` carries no
	 * `TERM`, and nothing else in it decides ASCII, so the caller passes `term` when it wants `auto` to mean
	 * something.
	 *
	 * **Example** (Force Unicode on a dumb terminal)
	 *
	 * ```ts
	 * import { Glyphs } from "@beep/scratchpad/effected/cli/Glyphs"
	 *
	 * console.log(Glyphs.select({ ascii: false, term: "dumb" }).kind) // unicode
	 * ```
	 *
	 * @param options - whether to force ASCII or Unicode, and the `TERM` value `auto` reads
	 * @category utilities
	 * @since 0.0.0
	 */
	static readonly select = (options?: GlyphSelectOptions): GlyphSet => {
		const ascii = options?.ascii ?? "auto";
		return ascii === true || (ascii === "auto" && options?.term === "dumb") ? Glyphs.ascii : Glyphs.unicode;
	};

	/**
	 * ASCII-only symbols.
	 *
	 * **Example** (Inspect the ASCII arrow)
	 *
	 * ```ts
	 * import { Glyphs } from "@beep/scratchpad/effected/cli/Glyphs"
	 *
	 * console.log(Glyphs.ascii.arrow) // ->
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly ascii: GlyphSet = {
		kind: "ascii",
		ellipsis: "...",
		spinner: ["-", "\\", "|", "/"],
		bullet: "*",
		arrow: "->",
		pathSeparator: { human: ">", agent: " > " },
		spinnerIntervalMs: 80,
		tree: { branch: "|-- ", last: "\\-- ", pipe: "|   ", blank: "    " },
	};
}
