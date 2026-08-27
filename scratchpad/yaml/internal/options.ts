// Internal option shapes consumed by the engine. The public facade owns the
// `Schema.Class` option types (`YamlParseOptions`, `YamlStringifyOptions`,
// `YamlFormattingOptions`); the engine takes these plain records so it never
// imports the facade. Defaults are applied where consumed (`?? default`).

import type { CollectionStyle, QuoteCompat, QuoteStyle, ScalarStyle } from "../YamlNode.ts";

/** Parse options as consumed by the composer. All fields optional. */
export interface ParseOptionsInput {
	/** Treat parse errors as failures rather than recovering. Default `true`. */
	readonly strict?: boolean | undefined;
	/** Max alias nodes per document (DoS guard). Default `100`. */
	readonly maxAliasCount?: number | undefined;
	/** Treat duplicate mapping keys as errors. Default `true`. */
	readonly uniqueKeys?: boolean | undefined;
}

/** Stringify options as consumed by the stringifier. All fields optional. */
export interface StringifyOptionsInput {
	/** Spaces per indentation level. Default `2`. */
	readonly indent?: number | undefined;
	/**
	 * Column at which to fold long flow and block-folded scalars. Default `0`
	 * (and any value `<= 0`) means never wrap — byte-identical, no-fold output.
	 * A positive value folds plain, double-quoted and block-folded (`>`)
	 * scalars at approximately that column; block-literal (`|`) is never folded.
	 */
	readonly lineWidth?: number | undefined;
	/** Scalar output style when none is requested. Default `"plain"`. */
	readonly defaultScalarStyle?: ScalarStyle | undefined;
	/** Collection output style when none is requested. Default `"block"`. */
	readonly defaultCollectionStyle?: CollectionStyle | undefined;
	/** Sort mapping keys alphabetically. Default `false`. */
	readonly sortKeys?: boolean | undefined;
	/** Indent block sequences one level under a mapping key. Default `false`. */
	readonly indentSequences?: boolean | undefined;
	/**
	 * Quote style for a `plain`-styled scalar that requires quoting. Default
	 * `"single"`. Values needing YAML escapes still render double-quoted.
	 */
	readonly quoteStyle?: QuoteStyle | undefined;
	/**
	 * Additionally quote plain scalars a foreign resolution dialect would
	 * coerce to a non-string. Default absent — no extra quoting.
	 */
	readonly quoteCompat?: QuoteCompat | undefined;
	/** End output with a trailing newline. Default `true`. */
	readonly finalNewline?: boolean | undefined;
	/** Ignore per-node styles and force the defaults. Default `false`. */
	readonly forceDefaultStyles?: boolean | undefined;
}
