/**
 * Internal option records consumed by the YAML engine.
 *
 * The public facade owns the `Schema.Class` option types
 * (`YamlParseOptions`, `YamlStringifyOptions`, `YamlFormattingOptions`);
 * the engine takes these plain records so it never imports the facade.
 * Defaults are applied where the options are consumed (`??`), not here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import { CollectionStyle, QuoteCompat, QuoteStyle, ScalarStyle } from "../YamlNode.ts";

const $I = $ScratchpadId.create("yaml/internal/options");

/**
 * Parse options as consumed by the composer. All fields optional.
 *
 * **Details**
 *
 * `maxAliasCount` defaults to `100` in {@link createState} and counts only
 * **defined** alias nodes (dangling `*missing` emits `UndefinedAlias` and
 * does not increment the budget). Exceeding the cap is fatal
 * (`isFatalCode("AliasCountExceeded")`).
 *
 * **Example** (Guard engine parse options)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ParseOptionsInput } from "@beep/scratchpad/yaml/internal/options"
 *
 * console.log(S.is(ParseOptionsInput)({ strict: true, maxAliasCount: 100 })) // true
 * ```
 *
 * @see {@link YamlParseOptions} for the public schema-backed parse options.
 * @see {@link createState} for where `?? 100` is applied.
 * @see {@link makeAlias} for the defined-alias counting rule.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const ParseOptionsInput = Schema.Struct({
	/** Treat parse errors as failures rather than recovering. Default `true`. */
	strict: Schema.optional(Schema.Boolean),
	/** Max alias nodes per document (DoS guard). Default `100`. */
	maxAliasCount: Schema.optional(Schema.Finite),
	/** Treat duplicate mapping keys as errors. Default `true`. */
	uniqueKeys: Schema.optional(Schema.Boolean),
}).pipe(
	$I.annoteSchema("ParseOptionsInput", {
		description: "Plain optional parse settings consumed by the internal YAML composer.",
	}),
);

export type ParseOptionsInput = typeof ParseOptionsInput.Type;

/**
 * Stringify options as consumed by the stringifier. All fields optional.
 *
 * **Example** (Guard engine stringify options)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StringifyOptionsInput } from "@beep/scratchpad/yaml/internal/options"
 *
 * console.log(S.is(StringifyOptionsInput)({ indent: 2, finalNewline: true })) // true
 * ```
 *
 * @see {@link YamlStringifyOptions} for the public schema-backed stringify options.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const StringifyOptionsInput = Schema.Struct({
	/** Spaces per indentation level. Default `2`. */
	indent: Schema.optional(Schema.Finite),
	/**
	 * Column at which to fold long flow and block-folded scalars. Default `0`
	 * (and any value `<= 0`) means never wrap — byte-identical, no-fold output.
	 * A positive value folds plain, double-quoted and block-folded (`>`)
	 * scalars at approximately that column; block-literal (`|`) is never folded.
	 */
	lineWidth: Schema.optional(Schema.Finite),
	/** Scalar output style when none is requested. Default `"plain"`. */
	defaultScalarStyle: Schema.optional(ScalarStyle),
	/** Collection output style when none is requested. Default `"block"`. */
	defaultCollectionStyle: Schema.optional(CollectionStyle),
	/** Sort mapping keys alphabetically. Default `false`. */
	sortKeys: Schema.optional(Schema.Boolean),
	/** Indent block sequences one level under a mapping key. Default `false`. */
	indentSequences: Schema.optional(Schema.Boolean),
	/**
	 * Quote style for a `plain`-styled scalar that requires quoting. Default
	 * `"single"`. Values needing YAML escapes still render double-quoted.
	 */
	quoteStyle: Schema.optional(QuoteStyle),
	/**
	 * Additionally quote plain scalars a foreign resolution dialect would
	 * coerce to a non-string. Default absent — no extra quoting.
	 */
	quoteCompat: Schema.optional(QuoteCompat),
	/** End output with a trailing newline. Default `true`. */
	finalNewline: Schema.optional(Schema.Boolean),
	/** Ignore per-node styles and force the defaults. Default `false`. */
	forceDefaultStyles: Schema.optional(Schema.Boolean),
}).pipe(
	$I.annoteSchema("StringifyOptionsInput", {
		description: "Plain optional stringify settings consumed by the internal YAML renderer.",
	}),
);

export type StringifyOptionsInput = typeof StringifyOptionsInput.Type;
