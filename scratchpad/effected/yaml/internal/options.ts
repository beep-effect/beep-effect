// Internal option shapes consumed by the engine. The public facade owns the
// `Schema.Class` option types (`YamlParseOptions`, `YamlStringifyOptions`,
// `YamlFormattingOptions`); the engine takes these plain records so it never
// imports the facade. Defaults are applied where consumed (`?? default`).

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { CollectionStyle, QuoteCompat, QuoteStyle, ScalarStyle } from "../YamlNode.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/options");

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
 * @category schemas
 * @since 0.0.0
 */
export const ParseOptionsInput = S.Struct({
	/**
	 * Treat parse errors as failures rather than recovering. Default `true`.
	 *
	 * @since 0.0.0
	 */
	strict: S.optional(S.Boolean).annotate({ description: "Treat parse errors as failures rather than recovering. Default `true`." }),
	/**
	 * Max alias nodes per document (DoS guard). Default `100`.
	 *
	 * @since 0.0.0
	 */
	maxAliasCount: S.optional(S.Finite).annotate({ description: "Max alias nodes per document (DoS guard). Default `100`." }),
	/**
	 * Treat duplicate mapping keys as errors. Default `true`.
	 *
	 * @since 0.0.0
	 */
	uniqueKeys: S.optional(S.Boolean).annotate({ description: "Treat duplicate mapping keys as errors. Default `true`." }),
}).pipe($I.annoteSchema("ParseOptionsInput", { description: "Plain parse options consumed by the composer; absent values retain consumption-site defaults." }));

/**
 * The structural type described by {@link ParseOptionsInput}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ParseOptionsInput = typeof ParseOptionsInput.Type;

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
 * @category schemas
 * @since 0.0.0
 */
export const StringifyOptionsInput = S.Struct({
	/**
	 * Spaces per indentation level. Default `2`.
	 *
	 * @since 0.0.0
	 */
	indent: S.optional(S.Finite).annotate({ description: "Spaces per indentation level. Default `2`." }),
	/**
	 * Column at which to fold long flow and block-folded scalars. Default `0`
	 * (and a value `<= 0`) means never wrap — byte-identical, no-fold output.
	 * A positive value folds plain, double-quoted and block-folded (`>`)
	 * scalars at approximately that column; block-literal (`|`) is never folded.
	 *
	 * @since 0.0.0
	 */
	lineWidth: S.optional(S.Finite).annotate({ description: "Column at which to fold long flow and block-folded scalars. Default `0` (and a value `<= 0`) means never wrap \u2014 byte-identical, no-fold output. A positive value folds plain, double-quoted and block-folded (`>`) scalars at approximately that column; block-literal (`|`) is never folded." }),
	/**
	 * Scalar output style when none is requested. Default `"plain"`.
	 *
	 * @since 0.0.0
	 */
	defaultScalarStyle: S.optional(ScalarStyle).annotate({ description: "Scalar output style when none is requested. Default `\"plain\"`." }),
	/**
	 * Collection output style when none is requested. Default `"block"`.
	 *
	 * @since 0.0.0
	 */
	defaultCollectionStyle: S.optional(CollectionStyle).annotate({ description: "Collection output style when none is requested. Default `\"block\"`." }),
	/**
	 * Sort mapping keys alphabetically. Default `false`.
	 *
	 * @since 0.0.0
	 */
	sortKeys: S.optional(S.Boolean).annotate({ description: "Sort mapping keys alphabetically. Default `false`." }),
	/**
	 * Indent block sequences one level under a mapping key. Default `false`.
	 *
	 * @since 0.0.0
	 */
	indentSequences: S.optional(S.Boolean).annotate({ description: "Indent block sequences one level under a mapping key. Default `false`." }),
	/**
	 * Quote style for a `plain`-styled scalar that requires quoting. Default
	 * `"single"`. Values needing YAML escapes still render double-quoted.
	 *
	 * @since 0.0.0
	 */
	quoteStyle: S.optional(QuoteStyle).annotate({ description: "Quote style for a `plain`-styled scalar that requires quoting. Default `\"single\"`. Values needing YAML escapes still render double-quoted." }),
	/**
	 * Additionally quote plain scalars a foreign resolution dialect would
	 * coerce to a non-string. Default absent — no extra quoting.
	 *
	 * @since 0.0.0
	 */
	quoteCompat: S.optional(QuoteCompat).annotate({ description: "Additionally quote plain scalars a foreign resolution dialect would coerce to a non-string. Default absent \u2014 no extra quoting." }),
	/**
	 * End output with a trailing newline. Default `true`.
	 *
	 * @since 0.0.0
	 */
	finalNewline: S.optional(S.Boolean).annotate({ description: "End output with a trailing newline. Default `true`." }),
	/**
	 * Ignore per-node styles and force the defaults. Default `false`.
	 *
	 * @since 0.0.0
	 */
	forceDefaultStyles: S.optional(S.Boolean).annotate({ description: "Ignore per-node styles and force the defaults. Default `false`." }),
	/**
	 * Engine-internal, never surfaced on the public option classes: render
	 * the ROOT value as if it already sat inside a flow collection, so a
	 * plain scalar carrying a flow indicator (`,[]{}`) is quoted. Used by the
	 * region-confined `modify` splice when the target's parent is
	 * flow-styled. Default `false`.
	 *
	 * @since 0.0.0
	 */
	inFlow: S.optional(S.Boolean).annotate({ description: "Engine-internal, never surfaced on the public option classes: render the ROOT value as if it already sat inside a flow collection, so a plain scalar carrying a flow indicator (`,[]{}`) is quoted. Used by the region-confined `modify` splice when the target's parent is flow-styled. Default `false`." }),
}).pipe($I.annoteSchema("StringifyOptionsInput", { description: "Plain stringify options consumed by the stringifier; absent values retain consumption-site defaults." }));

/**
 * The structural type described by {@link StringifyOptionsInput}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StringifyOptionsInput = typeof StringifyOptionsInput.Type;
