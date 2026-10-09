import * as Arr from "effect/Array";
import * as O from "effect/Option";
import { sanitize } from "./Fmt.ts";
import type { GlyphSet } from "./Glyphs.ts";
import type { Style, TokenName } from "./Token.ts";

/**
 * How one status looks: a Unicode glyph, an ASCII fallback, a token and a rank.
 *
 * @public
 */
export interface StatusDef {
	/** The Unicode glyph. */
	readonly glyph: string;
	/** The ASCII fallback, used when the theme's glyphs are ASCII. */
	readonly ascii: string;
	/** The semantic token, or an explicit style, the glyph is painted with. */
	readonly token: TokenName | Style;
	/** Severity for {@link Status.worst}: the highest rank wins. */
	readonly rank: number;
}

/**
 * The names of the core vocabulary.
 *
 * @public
 */
export type CoreStatusName = "success" | "failure" | "warning" | "info" | "skip" | "pending";

/**
 * An open vocabulary of statuses.
 *
 * @remarks
 * Start from `Status.core` and add your own with `extend`. The names are a type parameter,
 * so `def` and `worst` reject a name the vocabulary does not have at compile time.
 *
 * @example
 * ```ts
 * import { Status } from "./index.ts"
 *
 * const vocab = Status.extend({
 * 	timeout: { glyph: "⏱", ascii: "[time]", token: "warning", rank: 85 },
 * })
 * const worst = vocab.worst(["success", "timeout"])
 * // => "timeout"
 * ```
 *
 * @public
 */
export class Status<Names extends string> {
	private readonly defs: Readonly<Record<Names, StatusDef>>;

	// An explicit field, not a parameter property, so the source runs under Node's plain type stripping.
	private constructor(defs: Readonly<Record<Names, StatusDef>>) {
		this.defs = defs;
	}

	/** The core vocabulary: success, skip, pending, info, warning and failure, by rank 10, 20, 30, 40, 60, 90. */
	static readonly core: Status<CoreStatusName> = new Status<CoreStatusName>({
		success: { glyph: "✓", ascii: "[ok]", token: "success", rank: 10 },
		skip: { glyph: "↷", ascii: "[skip]", token: "muted", rank: 20 },
		pending: { glyph: "◯", ascii: "[ ]", token: "muted", rank: 30 },
		info: { glyph: "ℹ", ascii: "[info]", token: "info", rank: 40 },
		warning: { glyph: "⚠", ascii: "[warn]", token: "warning", rank: 60 },
		failure: { glyph: "✗", ascii: "[FAIL]", token: "failure", rank: 90 },
	});

	/**
	 * The core vocabulary plus `extra`; an entry that reuses a core name replaces it.
	 *
	 * @param extra - the statuses to add, by name
	 */
	static readonly extend = <const Extra extends Record<string, StatusDef>>(
		extra: Extra,
	): Status<CoreStatusName | (keyof Extra & string)> => Status.core.extend(extra);

	/**
	 * This vocabulary plus `extra`; an entry that reuses a name replaces it.
	 *
	 * @remarks
	 * An entry may replace a core name. Replacing `warning` with a lower rank moves the threshold at which
	 * `CliMessage.status` defaults to stderr for this vocabulary, since that threshold is `warning`'s rank in the
	 * vocabulary it is given.
	 *
	 * @param extra - the statuses to add, by name
	 */
	extend<const Extra extends Record<string, StatusDef>>(extra: Extra): Status<Names | (keyof Extra & string)> {
		return new Status<Names | (keyof Extra & string)>({ ...this.defs, ...extra } as Readonly<
			Record<Names | (keyof Extra & string), StatusDef>
		>);
	}

	/**
	 * The definition of a status.
	 *
	 * @remarks
	 * A name the vocabulary does not have is a defect: it throws an `Error` naming it and the names that exist. The
	 * types already reject one, so it is reachable only through a cast.
	 *
	 * @param name - a name in this vocabulary
	 */
	def(name: Names): StatusDef {
		if (!Object.hasOwn(this.defs, name)) {
			throw new Error(`Unknown status "${name}"; this vocabulary has: ${Object.keys(this.defs).join(", ")}`);
		}
		return this.defs[name];
	}

	/**
	 * The full definition of a status as an immutable snapshot, for a caller that stores it.
	 *
	 * @remarks
	 * `def` answers the vocabulary's own entry. `resolve` answers a frozen copy, so a document node that holds
	 * the definition stays plain data and editing it cannot change the vocabulary. The copy is shallow: a
	 * `token` given as a `Style` keeps its own identity. Throws on an unknown name, as {@link Status.def} does;
	 * storing an empty definition in a document instead would fail far from the cause.
	 *
	 * @param name - a name in this vocabulary
	 */
	resolve(name: Names): StatusDef {
		return Object.freeze({ ...this.def(name) });
	}

	/**
	 * A status's glyph from a glyph set: `def.ascii` for an ASCII set, `def.glyph` otherwise. Unpainted, for a caller
	 * that draws it itself (an Ink tree, a reporter).
	 *
	 * @remarks
	 * Throws on an unknown name, as {@link Status.def} does. The glyph is sanitised, as text in a document is: escape
	 * sequences and control characters in a vocabulary's glyph are removed, so a glyph built from data cannot paint the
	 * terminal, plant a hyperlink or move the cursor. Every kit path that draws a status glyph takes it from here.
	 *
	 * @param name - a name in this vocabulary
	 * @param glyphs - the glyph set, such as `Glyphs.unicode`, `Glyphs.ascii` or a theme's
	 */
	glyph(name: Names, glyphs: GlyphSet): string {
		const def = this.def(name);
		// A vocabulary is configuration, but one built from data must not paint the terminal: every path that draws a
		// status glyph (a theme's `status`, `CliMessage`, `CliLog.status`, a document) takes it sanitised, from here.
		return sanitize(glyphs.kind === "ascii" ? def.ascii : def.glyph);
	}

	/**
	 * The status with the highest rank; a tie goes to the one that comes first in `names`.
	 *
	 * @remarks
	 * `rank` is SEVERITY, not an aggregation policy: the higher rank wins, so in `Status.core` a `skip` outranks a
	 * `success`. A consumer whose aggregate differs (a test run where passes dominate skips, say) folds its own
	 * rule over the names instead of reading this.
	 *
	 * Takes at least one name, so the answer is always a name. For an array that may be empty, use
	 * {@link Status.worstOption}. They are two methods because a literal and an array variable are the same
	 * array at runtime, so one method could not return a name for one and an `Option` for the other.
	 *
	 * @param names - the statuses to compare
	 */
	worst(names: Arr.NonEmptyReadonlyArray<Names>): Names {
		let worst = names[0];
		for (const name of names) {
			if (this.def(name).rank > this.def(worst).rank) worst = name;
		}
		return worst;
	}

	/**
	 * The status with the highest rank of an array that may be empty: `None` when it is, otherwise `Some` of
	 * the worst, a tie going to the one that comes first in `names`. Rank is severity, not an aggregation policy; see
	 * {@link Status.worst}.
	 *
	 * @param names - the statuses to compare
	 */
	worstOption(names: ReadonlyArray<Names>): O.Option<Names> {
		return Arr.isReadonlyArrayNonEmpty(names) ? O.some(this.worst(names)) : O.none();
	}
}
