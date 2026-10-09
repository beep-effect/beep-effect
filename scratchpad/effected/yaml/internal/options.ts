// Internal option shapes consumed by the engine. The public facade owns the
// `Schema.Class` option types (`YamlParseOptions`, `YamlStringifyOptions`,
// `YamlFormattingOptions`); the engine takes these plain records so it never
// imports the facade. Defaults are applied where consumed (`?? default`).

import type { CollectionStyle, QuoteCompat, QuoteStyle, ScalarStyle } from "../YamlNode.ts";

/**
 * Configures parse recovery, alias limits, and duplicate-key handling in the composer.
 *
 * **Details**
 *
 * Parse options as consumed by the composer. All fields optional.
 *
 * **Example** (Set an alias limit)
 *
 * ```ts
 * import type { ParseOptionsInput } from "@beep/scratchpad/effected/yaml/internal/options"
 * const options: ParseOptionsInput = { maxAliasCount: 10 }
 * console.log(options.maxAliasCount) // 10
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ParseOptionsInput {
	/**
	 * Treat parse errors as failures rather than recovering. Default `true`.
	 *
	 * @since 0.0.0
	 */
	readonly strict?: boolean | undefined;
	/**
	 * Max alias nodes per document (DoS guard). Default `100`.
	 *
	 * @since 0.0.0
	 */
	readonly maxAliasCount?: number | undefined;
	/**
	 * Treat duplicate mapping keys as errors. Default `true`.
	 *
	 * @since 0.0.0
	 */
	readonly uniqueKeys?: boolean | undefined;
}

/**
 * Configures scalar presentation and collection layout in the stringifier.
 *
 * **Details**
 *
 * Stringify options as consumed by the stringifier. All fields optional.
 *
 * **Example** (Configure line wrapping)
 *
 * ```ts
 * import type { StringifyOptionsInput } from "@beep/scratchpad/effected/yaml/internal/options"
 * const options: StringifyOptionsInput = { lineWidth: 80 }
 * console.log(options.lineWidth) // 80
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface StringifyOptionsInput {
	/**
	 * Spaces per indentation level. Default `2`.
	 *
	 * @since 0.0.0
	 */
	readonly indent?: number | undefined;
	/**
	 * Column at which to fold long flow and block-folded scalars. Default `0`
	 * (and a value `<= 0`) means never wrap — byte-identical, no-fold output.
	 * A positive value folds plain, double-quoted and block-folded (`>`)
	 * scalars at approximately that column; block-literal (`|`) is never folded.
	 *
	 * @since 0.0.0
	 */
	readonly lineWidth?: number | undefined;
	/**
	 * Scalar output style when none is requested. Default `"plain"`.
	 *
	 * @since 0.0.0
	 */
	readonly defaultScalarStyle?: ScalarStyle | undefined;
	/**
	 * Collection output style when none is requested. Default `"block"`.
	 *
	 * @since 0.0.0
	 */
	readonly defaultCollectionStyle?: CollectionStyle | undefined;
	/**
	 * Sort mapping keys alphabetically. Default `false`.
	 *
	 * @since 0.0.0
	 */
	readonly sortKeys?: boolean | undefined;
	/**
	 * Indent block sequences one level under a mapping key. Default `false`.
	 *
	 * @since 0.0.0
	 */
	readonly indentSequences?: boolean | undefined;
	/**
	 * Quote style for a `plain`-styled scalar that requires quoting. Default
	 * `"single"`. Values needing YAML escapes still render double-quoted.
	 *
	 * @since 0.0.0
	 */
	readonly quoteStyle?: QuoteStyle | undefined;
	/**
	 * Additionally quote plain scalars a foreign resolution dialect would
	 * coerce to a non-string. Default absent — no extra quoting.
	 *
	 * @since 0.0.0
	 */
	readonly quoteCompat?: QuoteCompat | undefined;
	/**
	 * End output with a trailing newline. Default `true`.
	 *
	 * @since 0.0.0
	 */
	readonly finalNewline?: boolean | undefined;
	/**
	 * Ignore per-node styles and force the defaults. Default `false`.
	 *
	 * @since 0.0.0
	 */
	readonly forceDefaultStyles?: boolean | undefined;
	/**
	 * Engine-internal, never surfaced on the public option classes: render
	 * the ROOT value as if it already sat inside a flow collection, so a
	 * plain scalar carrying a flow indicator (`,[]{}`) is quoted. Used by the
	 * region-confined `modify` splice when the target's parent is
	 * flow-styled. Default `false`.
	 *
	 * @since 0.0.0
	 */
	readonly inFlow?: boolean | undefined;
}
