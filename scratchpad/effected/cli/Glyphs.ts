import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/cli/Glyphs");

/**
 * The symbols a theme draws with.
 *
 * **Example** (Validate a built-in glyph set)
 *
 * ```ts
 * import { GlyphSet, Glyphs } from "@beep/scratchpad/effected/cli/Glyphs"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GlyphSet)(Glyphs.ascii)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const GlyphSet = S.Struct({
	/** Which set this is. */
	kind: S.Literals(["unicode", "ascii"]).annotate($I.annote("GlyphSet.kind", { description: "The kind field of the glyph set." })),
	/** The truncation marker. */
	ellipsis: S.String.annotate($I.annote("GlyphSet.ellipsis", { description: "The ellipsis field of the glyph set." })),
	/** The frames of a spinner, in order. */
	spinner: S.Array(S.String).annotate($I.annote("GlyphSet.spinner", { description: "The spinner field of the glyph set." })),
	/** A list bullet. */
	bullet: S.String.annotate($I.annote("GlyphSet.bullet", { description: "The bullet field of the glyph set." })),
	/** A directional arrow. */
	arrow: S.String.annotate($I.annote("GlyphSet.arrow", { description: "The arrow field of the glyph set." })),
	/** The separator between the segments of a breadcrumb or path: one for people, one for agents. */
	pathSeparator: S.Struct({
		human: S.String.annotate($I.annote("GlyphSet.pathSeparator.human", { description: "The path separator shown to people." })),
		agent: S.String.annotate($I.annote("GlyphSet.pathSeparator.agent", { description: "The path separator shown to agents." })),
	}).annotate($I.annote("GlyphSet.pathSeparator", { description: "Audience-specific path separators." })),
	/** How long a spinner frame is shown, in milliseconds. */
	spinnerIntervalMs: S.Finite.annotate($I.annote("GlyphSet.spinnerIntervalMs", { description: "The spinnerIntervalMs field of the glyph set." })),
	/**
	 * The segments a tree is drawn with: `branch` before a child that has later siblings, `last` before the final
	 * child, and `pipe` and `blank` as the indent under each. All four are one width so branches align.
	 */
	tree: S.Struct({
		branch: S.String.annotate($I.annote("GlyphSet.tree.branch", { description: "The branch segment of a tree." })),
		last: S.String.annotate($I.annote("GlyphSet.tree.last", { description: "The last segment of a tree." })),
		pipe: S.String.annotate($I.annote("GlyphSet.tree.pipe", { description: "The pipe segment of a tree." })),
		blank: S.String.annotate($I.annote("GlyphSet.tree.blank", { description: "The blank segment of a tree." })),
	}).annotate($I.annote("GlyphSet.tree", { description: "Equal-width segments used to draw trees." })),
}).annotate($I.annote("GlyphSet", { description: "The symbols and spinner timing a CLI theme draws with." }));
/**
 * The plain readonly symbols and timing of a CLI theme.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GlyphSet = typeof GlyphSet.Type;

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
export abstract class Glyphs {

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
