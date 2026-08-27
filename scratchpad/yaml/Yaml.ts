/**
 * Value-level YAML 1.2 parsing, stringification, comment stripping, semantic
 * equality and schema factories.
 *
 * `Yaml` is a namespace of statics over the internal engine and the schema
 * layer — not itself a schema class. `parse`/`parseAll`/`stringify` and schema
 * decoding carry real typed error channels; `stripComments`/`equals`/
 * `equalsValue` are pure total functions. The engine returns raw diagnostic
 * records; this module materializes {@link YamlDiagnostic} and the aggregate
 * {@link YamlParseError} / {@link YamlStringifyError}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, Result, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { composeAllDocuments, composeFirstDocument } from "./internal/composer/document.ts";
import type { RawDiagnostic } from "./internal/diagnostics.ts";
import { isFatalCode } from "./internal/diagnostics.ts";
import type { ParseOptionsInput, StringifyOptionsInput } from "./internal/options.ts";
import type { RawYamlDocument } from "./internal/raw-document.ts";
import { StringifyDepthExceeded, StringifyFailure, stringifyValue } from "./internal/stringifier.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import type { YamlNode } from "./YamlNode.ts";
import {
	AliasExpansionBudgetExceeded,
	CollectionStyle,
	QuoteCompat,
	QuoteStyle,
	ScalarStyle,
	nodeToJsValue,
} from "./YamlNode.ts";

const $I = $ScratchpadId.create("yaml/Yaml");

/**
 * Options controlling parse behavior. All fields are omissible; absent fields
 * resolve to `strict` `true`, `maxAliasCount` `100` (the alias-based
 * denial-of-service guard) and `uniqueKeys` `true` (duplicate mapping keys
 * are errors).
 *
 * Construct with the validated `YamlParseOptions.make({ ... })` static — the
 * kit convention (never `new`). Call sites that take a `YamlParseOptions`
 * also accept a structurally-matching plain literal.
 *
 * **Example** (Bound alias expansion while parsing)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlParseOptions } from "@beep/scratchpad/yaml"
 *
 * const options = YamlParseOptions.make({ maxAliasCount: 0 })
 * const parsed = Yaml.parseResult("a: &id 1\nb: *id\n", options)
 *
 * console.log(Result.isFailure(parsed)) // true
 * if (Result.isFailure(parsed)) {
 *   console.log(parsed.failure.diagnostics[0]?.code) // "AliasCountExceeded"
 * }
 * ```
 *
 * @see {@link Yaml.parseResult} for the synchronous parse that consumes these options.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class YamlParseOptions extends Schema.Class<YamlParseOptions>("YamlParseOptions")(
	{
		strict: Schema.optionalKey(Schema.Boolean),
		maxAliasCount: Schema.optionalKey(Schema.Number),
		uniqueKeys: Schema.optionalKey(Schema.Boolean),
	},
	$I.annote("YamlParseOptions", {
		description: "Parse options that bound alias expansion and duplicate-key policy while decoding YAML into values.",
	}),
) {}

/**
 * Options controlling stringify behavior. All fields are omissible; absent
 * fields resolve to `indent` `2`, `lineWidth` `0`, `defaultScalarStyle`
 * `"plain"`, `defaultCollectionStyle` `"block"`, `sortKeys` `false`,
 * `indentSequences` `false`, `quoteStyle` `"single"`, `quoteCompat` absent
 * (no dialect-compat quoting), `finalNewline` `true` and `forceDefaultStyles`
 * `false`.
 *
 * `lineWidth` controls column-based scalar folding. The default `0` (and any
 * value `<= 0`) never wraps, emitting byte-identical output to the historic
 * no-fold behavior; a positive value folds long plain, double-quoted and
 * block-folded (`>`) scalars at approximately that column, inserting only
 * semantically transparent line breaks. Block-literal (`|`) content is never
 * folded — literal blocks preserve their bytes by definition. Folding is a
 * value-path feature only: `YamlDocument#stringify` and the `YamlFormat`
 * helpers accept these options but do not fold (see `lineWidth`).
 *
 * `indentSequences` controls the presentation of block sequences nested under
 * a mapping key: `false` (the default) emits them at the key's column — the
 * kit's byte-compatible legacy form — while `true` indents them one level,
 * matching the `yaml` npm package's default output. Top-level sequences stay
 * at column zero in both modes.
 *
 * `quoteStyle` selects the quote character used when a `plain`-styled scalar
 * (the `defaultScalarStyle` default) turns out to require quoting: `"single"`
 * (the default) emits `'@parcel/watcher'` — the kit's byte-compatible legacy
 * form — while `"double"` emits `"@parcel/watcher"`, matching the `yaml` npm
 * package's `singleQuote: false` output. It is a fallback selector only:
 * scalars that need no quoting stay plain, and an explicit
 * `defaultScalarStyle` of `"single-quoted"` or `"double-quoted"` still wins.
 * On that plain fallback path, values carrying a tab, a carriage return or
 * any other C0 control character are always emitted double-quoted whichever
 * `quoteStyle` is set, since only double quotes can escape them into a form
 * that round-trips exactly.
 *
 * Construct with the validated `YamlStringifyOptions.make({ ... })` static —
 * the kit convention (never `new`). Call sites that take a
 * `YamlStringifyOptions` also accept a structurally-matching plain literal.
 *
 * **Gotchas**
 *
 * `lineWidth` folds only on {@link Yaml.stringify} / {@link Yaml.stringifyResult}.
 * It is inert on {@link YamlDocument.stringify} and {@link YamlFormat}. Schema
 * factories encode with default stringify options and never fold.
 *
 * **Example** (Indent nested sequences)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlStringifyOptions } from "@beep/scratchpad/yaml"
 *
 * const options = YamlStringifyOptions.make({ indentSequences: true })
 * const yaml = Yaml.stringifyResult({ key: ["a", "b"] }, options)
 *
 * console.log(Result.isSuccess(yaml)) // true
 * if (Result.isSuccess(yaml)) {
 *   console.log(yaml.success.includes("  - a")) // true
 * }
 * ```
 *
 * @see {@link Yaml.stringifyResult} for the synchronous stringify that honors `lineWidth` and `indentSequences`.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class YamlStringifyOptions extends Schema.Class<YamlStringifyOptions>("YamlStringifyOptions")({
	indent: Schema.optionalKey(Schema.Number),
	/**
	 * Column at which to fold long scalars. Default `0` (and any value `<= 0`)
	 * never wraps; a positive value folds plain, double-quoted and block-folded
	 * (`>`) scalars at approximately that column, never block-literal (`|`).
	 *
	 * Takes effect only through {@link Yaml.stringify} and
	 * {@link Yaml.stringifyResult} — the two entry points that accept these
	 * options on the value path. The schema factories ({@link Yaml.fromString},
	 * {@link Yaml.schema}, {@link Yaml.YamlFromString}) encode with default
	 * stringify options (`lineWidth` `0`), so their output never folds. The
	 * document/node path — `YamlDocument#stringify` and the `YamlFormat`
	 * helpers built on it — threads the field into its render context but
	 * never reads it, so it is inert there.
	 */
	lineWidth: Schema.optionalKey(Schema.Number),
	defaultScalarStyle: Schema.optionalKey(ScalarStyle),
	defaultCollectionStyle: Schema.optionalKey(CollectionStyle),
	sortKeys: Schema.optionalKey(Schema.Boolean),
	indentSequences: Schema.optionalKey(Schema.Boolean),
	/**
	 * Quote style used when a `plain`-styled scalar requires quoting. Default
	 * `"single"` — the released byte-compatible behavior. `"double"` renders
	 * the same scalars double-quoted instead, matching the `yaml` npm
	 * package's `singleQuote: false` output.
	 *
	 * Affects only the plain fallback: scalars that need no quoting stay
	 * plain, and an explicit `defaultScalarStyle` of `"single-quoted"` or
	 * `"double-quoted"` is unaffected.
	 */
	quoteStyle: Schema.optionalKey(QuoteStyle),
	/**
	 * Additionally quote plain scalars a foreign resolution dialect would
	 * coerce to a non-string. Absent (the default) adds no quoting beyond the
	 * YAML 1.2 Core Schema rules — byte-identical to the released output.
	 *
	 * `"yaml-1.1"` quotes every plain scalar a YAML 1.1 parser (js-yaml,
	 * PyYAML, libyaml, and the `yaml` npm package's YAML 1.1 schema, whose
	 * lenient resolvers set the outer bound) would implicitly resolve to a
	 * non-string: the extended
	 * boolean spellings (`y`/`yes`/`on`/`off` and case variants — the "Norway
	 * problem"), timestamps (`2024-01-15`, `2001-12-15T02:59:43.1Z`, the
	 * space-separated 1.1 forms), sexagesimal numbers (`1:30`,
	 * `190:20:30.15`), underscore-separated numbers (`1_000`) and the
	 * base-2/8/16 integer forms (`0b1010_0111`, `0777`, `0x_FF`). Use it when
	 * emitted output is parsed downstream by a YAML 1.1 consumer and blanket
	 * `defaultScalarStyle` quoting is too noisy.
	 *
	 * Strictly additive: it never un-quotes anything the 1.2 rules require
	 * quoted, strings no 1.1 parser coerces stay plain, and the quote
	 * character stays governed by `quoteStyle`. Scalars carrying an explicit
	 * tag are exempt, exactly like the 1.2 type-conflict check. Applies
	 * wherever the plain fallback renders — values, mapping keys, flow items —
	 * on both the value path ({@link Yaml.stringify},
	 * {@link Yaml.stringifyResult}) and the node path (`YamlDocument#stringify`
	 * and the `YamlFormat` helpers).
	 */
	quoteCompat: Schema.optionalKey(QuoteCompat),
	finalNewline: Schema.optionalKey(Schema.Boolean),
	forceDefaultStyles: Schema.optionalKey(Schema.Boolean),
},
	$I.annote("YamlStringifyOptions", {
		description: "Stringify options for indent, folding, quote fallback and collection presentation.",
	}),
) {}

/**
 * Error-recovery parse failure: aggregates every fatal {@link YamlDiagnostic}
 * plus `DuplicateKey` promotions when `uniqueKeys` is true (the default), so
 * a single failure reports the whole batch. Raised by
 * {@link Yaml.parse}, {@link Yaml.parseAll}, `YamlDocument.parse`/`parseAll`
 * and the decode direction of the schema factories. The error itself has no
 * `code` field: read the code from the diagnostics —
 * `error.diagnostics[0].code` is the primary failure.
 *
 * **Gotchas**
 *
 * {@link YamlDiagnostic.isFatal} is false for `"DuplicateKey"`. Duplicate
 * mapping keys still fail parse when `uniqueKeys` is true by promoting that
 * warning onto this error. Filtering `error.diagnostics` with
 * {@link YamlDiagnostic.isFatal} drops the DuplicateKey record.
 *
 * **Example** (Construct a parse error and read the code)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlParseError } from "@beep/scratchpad/yaml"
 *
 * const failed = Yaml.parseResult("a: 1\na: 2\n")
 * console.log(Result.isFailure(failed)) // true
 * if (Result.isFailure(failed)) {
 *   console.log(failed.failure._tag) // "YamlParseError"
 *   console.log(failed.failure.diagnostics[0]?.code) // "DuplicateKey"
 *   console.log(failed.failure instanceof YamlParseError) // true
 * }
 * ```
 *
 * @see {@link YamlDiagnostic} for the diagnostic records aggregated on `diagnostics`.
 * @see {@link YamlDiagnostic.isFatal} for why DuplicateKey is not a fatal code even when parse fails.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class YamlParseError extends Schema.TaggedError<YamlParseError>()(
	"YamlParseError",
	{
		diagnostics: Schema.Array(YamlDiagnostic),
		input: Schema.String,
	},
	$I.annote("YamlParseError", {
		description: "Aggregate YAML parse failure carrying fatal diagnostics and DuplicateKey promotions from one input.",
	}),
) {
	override get message(): string {
		const count = this.diagnostics.length;
		const summary = this.diagnostics.map((d) => `${d.code} at ${d.line}:${d.character}`).join("; ");
		return `YAML parse failed with ${count} error${count === 1 ? "" : "s"}: ${summary}`;
	}
}

/**
 * Stringification failure (the circular-reference guard), carrying structured
 * {@link YamlDiagnostic} entries and the offending value. Raised by
 * {@link Yaml.stringify}, `YamlDocument#stringify` and the encode direction of
 * the schema factories. The error itself has no `code` field: read the code
 * from the diagnostics — `error.diagnostics[0].code` is the primary failure.
 *
 * **Example** (Handle a circular-reference stringify failure)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const cyclic: { self?: unknown } = {}
 * cyclic.self = cyclic
 * const failed = Yaml.stringifyResult(cyclic)
 *
 * console.log(Result.isFailure(failed)) // true
 * if (Result.isFailure(failed)) {
 *   console.log(failed.failure._tag) // "YamlStringifyError"
 *   console.log(failed.failure.diagnostics[0]?.code) // "CircularReference"
 * }
 * ```
 *
 * @see {@link YamlDiagnostic} for the diagnostic records aggregated on `diagnostics`.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class YamlStringifyError extends Schema.TaggedError<YamlStringifyError>()(
	"YamlStringifyError",
	{
		diagnostics: Schema.Array(YamlDiagnostic),
		value: Schema.Unknown,
	},
	$I.annote("YamlStringifyError", {
		description: "YAML stringify failure carrying structured diagnostics for circular references and nesting-depth blow-ups.",
	}),
) {
	override get message(): string {
		const summary = this.diagnostics.map((d) => d.message).join("; ");
		return `YAML stringify failed: ${summary}`;
	}
}

// ── Internal helpers ────────────────────────────────────────────────────────

const toParseInput = (options?: YamlParseOptions): ParseOptionsInput =>
	options === undefined
		? {}
		: {
				strict: options.strict,
				maxAliasCount: options.maxAliasCount,
				uniqueKeys: options.uniqueKeys,
			};

const toStringifyInput = (options?: YamlStringifyOptions): StringifyOptionsInput =>
	options === undefined
		? {}
		: {
				indent: options.indent,
				lineWidth: options.lineWidth,
				defaultScalarStyle: options.defaultScalarStyle,
				defaultCollectionStyle: options.defaultCollectionStyle,
				sortKeys: options.sortKeys,
				indentSequences: options.indentSequences,
				quoteStyle: options.quoteStyle,
				quoteCompat: options.quoteCompat,
				finalNewline: options.finalNewline,
				forceDefaultStyles: options.forceDefaultStyles,
			};

const toDiagnostics = (text: string, records: ReadonlyArray<RawDiagnostic>): ReadonlyArray<YamlDiagnostic> =>
	records.map((r) => YamlDiagnostic.fromRaw(r, text));

/**
 * Build the fatal {@link YamlParseError} for an alias-expansion "billion
 * laughs" blow-up. The offending expansion has no source span, so the
 * diagnostic carries zero offsets.
 */
const aliasCountExceededError = (message: string, text: string): YamlParseError =>
	new YamlParseError({
		diagnostics: [
			YamlDiagnostic.make({ code: "AliasCountExceeded", message, offset: 0, length: 0, line: 0, character: 0 }),
		],
		input: text,
	});

/**
 * Map an internal stringifier throw to its typed {@link YamlStringifyError},
 * or return `undefined` for any other defect (which the caller re-throws).
 * Shared by the Effect and synchronous stringify paths so both surface the
 * hardening guards (circular reference, nesting-depth cap) identically.
 */
const stringifyDefectToError = (defect: unknown, value: unknown): YamlStringifyError | undefined => {
	if (defect instanceof StringifyFailure) {
		return new YamlStringifyError({
			diagnostics: [
				YamlDiagnostic.make({
					code: "CircularReference",
					message: defect.reason,
					offset: 0,
					length: 0,
					line: 0,
					character: 0,
				}),
			],
			value,
		});
	}
	// Deeply-nested acyclic value overflowed the stringifier's recursion budget —
	// surface it as a fatal stringify error, not a stack-overflow defect.
	if (defect instanceof StringifyDepthExceeded) {
		return new YamlStringifyError({
			diagnostics: [
				YamlDiagnostic.make({
					code: "NestingDepthExceeded",
					message: defect.message,
					offset: 0,
					length: 0,
					line: 0,
					character: 0,
				}),
			],
			value,
		});
	}
	return undefined;
};

/**
 * Synchronous single-document parse returning a `Result`. The pure
 * engine bypasses the Effect runtime entirely: the composer, the failure
 * collection and the alias-expansion budget all run inline, and every failure
 * mode (fatal diagnostics, duplicate keys, a "billion laughs" blow-up) yields
 * a `Failure` carrying a typed {@link YamlParseError} — never a throw.
 */
const parseResultImpl = (text: string, options?: YamlParseOptions): Result.Result<unknown, YamlParseError> => {
	const doc = composeFirstDocument(text, toParseInput(options));
	const failures = failureRecords(doc, options?.uniqueKeys ?? true);
	if (failures.length > 0) {
		return Result.fail(new YamlParseError({ diagnostics: toDiagnostics(text, failures), input: text }));
	}
	// An empty map lets nodeToJsValue register anchors incrementally, so aliases
	// resolve to the most recent anchor at the point of use.
	const anchors = new Map<string, YamlNode>();
	try {
		return Result.succeed(nodeToJsValue(doc.contents, anchors, options?.maxAliasCount ?? 100));
	} catch (defect) {
		if (defect instanceof AliasExpansionBudgetExceeded) {
			return Result.fail(aliasCountExceededError(defect.message, text));
		}
		throw defect;
	}
};

/**
 * Synchronous multi-document parse returning a `Result`. Mirrors
 * {@link parseResultImpl} over the whole stream: stream-level
 * directive-placement errors and every document's failure records aggregate
 * into one {@link YamlParseError}; each document's value is extracted against
 * its own independent anchor map (anchors are document-scoped in a stream),
 * with the alias-expansion budget materialized as a typed failure.
 */
const parseAllResultImpl = (
	text: string,
	options?: YamlParseOptions,
): Result.Result<ReadonlyArray<unknown>, YamlParseError> => {
	const { documents, streamErrors } = composeAllDocuments(text, toParseInput(options));
	const uniqueKeys = options?.uniqueKeys ?? true;
	// Fatal stream-level errors use the SAME predicate as the format path's
	// refusal (`isFatalCode`), so `parseAllResult` can never succeed on input
	// `YamlFormat.format` refuses as stream-fatal.
	const failures = [
		...streamErrors.filter((e) => isFatalCode(e.code)),
		...documents.flatMap((d) => failureRecords(d, uniqueKeys)),
	];
	if (failures.length > 0) {
		return Result.fail(new YamlParseError({ diagnostics: toDiagnostics(text, failures), input: text }));
	}
	const maxAliasCount = options?.maxAliasCount ?? 100;
	const values: Array<unknown> = [];
	for (const d of documents) {
		// Per-document anchor map (anchors are document-scoped in a stream). An
		// empty map lets nodeToJsValue register anchors incrementally, exactly
		// like parseResultImpl — a pre-built map would resolve aliases that
		// extraction never re-registers (e.g. an anchor on a complex mapping
		// key), diverging from the single-document result.
		const anchors = new Map<string, YamlNode>();
		try {
			values.push(nodeToJsValue(d.contents, anchors, maxAliasCount));
		} catch (defect) {
			if (defect instanceof AliasExpansionBudgetExceeded) {
				return Result.fail(aliasCountExceededError(defect.message, text));
			}
			throw defect;
		}
	}
	return Result.succeed(values as ReadonlyArray<unknown>);
};

/**
 * Synchronous stringify returning a `Result`. Mirrors {@link Yaml.stringify}
 * without the Effect wrapper: a circular reference or a value nested past the
 * recursion budget yields a `Failure` carrying a typed {@link YamlStringifyError},
 * never a thrown defect.
 */
const stringifyResultImpl = (
	value: unknown,
	options?: YamlStringifyOptions,
): Result.Result<string, YamlStringifyError> => {
	try {
		return Result.succeed(stringifyValue(value, toStringifyInput(options)));
	} catch (defect) {
		const error = stringifyDefectToError(defect, value);
		if (error !== undefined) return Result.fail(error);
		throw defect;
	}
};

/**
 * Collect the raw diagnostics that make a composed document a parse failure:
 * every fatal-code error, plus DuplicateKey warnings promoted to errors when
 * `uniqueKeys` is in force (the v3 `parse` contract). Order preserved:
 * fatals first, then promotions.
 */
const failureRecords = (doc: RawYamlDocument, uniqueKeys: boolean): ReadonlyArray<RawDiagnostic> => {
	const fatal = doc.errors.filter((e) => isFatalCode(e.code));
	if (fatal.length > 0) return fatal;
	return uniqueKeys ? doc.warnings.filter((w) => w.code === "DuplicateKey") : [];
};

const stringifyOrFail = (value: unknown, options?: YamlStringifyOptions): Effect.Effect<string, YamlStringifyError> =>
	Effect.try({
		try: () => stringifyValue(value, toStringifyInput(options)),
		catch: (defect) => {
			const error = stringifyDefectToError(defect, value);
			if (error !== undefined) return error;
			throw defect;
		},
	});

// ── Bound codec ─────────────────────────────────────────────────────────────

/**
 * A domain codec pre-bound to its two directions, returned by
 * {@link Yaml.bind}: the composed `schema` (what {@link Yaml.schema} returns)
 * plus `decode` and `encode` functions derived from it once, so callers need
 * no generic `Schema` machinery at the use site.
 *
 * @see {@link Yaml.bind} for the factory that produces this codec.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface YamlBoundCodec<T, RD = never, RE = never> {
	/** The composed codec decoding a YAML `string` straight into `T`. */
	readonly schema: Schema.Codec<T, string, RD, RE>;
	/** Decode a single-document YAML string into a validated `T`. */
	readonly decode: (text: string) => Effect.Effect<T, Schema.SchemaError, RD>;
	/** Encode a `T` back to YAML text with default stringify options. */
	readonly encode: (value: T) => Effect.Effect<string, Schema.SchemaError, RE>;
}

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Parse, stringify, compare and schema-bind YAML 1.2 as plain values with
 * typed errors.
 *
 * **Details**
 *
 * `parse`/`parseAll`/`stringify` and the schema factories carry real typed
 * error channels — including the hardening guards (an alias-expansion budget
 * on decode, a nesting-depth cap on encode) that keep malformed or
 * adversarial input on the typed channel instead of surfacing as an unhandled
 * defect. `stripComments`/`equals`/`equalsValue` are pure total functions.
 *
 * **Gotchas**
 *
 * `lineWidth` folds only on {@link Yaml.stringify} / {@link Yaml.stringifyResult}
 * and is inert on {@link YamlDocument.stringify} and {@link YamlFormat}. A
 * `"<<"` object key is quoted on this value path (`'<<': …`) so it does not
 * become a merge key; the document/format path leaves a parsed plain `<<`
 * unquoted. Schema factories encode with default stringify options and never
 * fold — bind {@link Yaml.fromString} / {@link Yaml.schema} / {@link Yaml.bind}
 * results to a `const`. {@link Yaml.equals} treats alias-expansion blow-ups as
 * malformed (`false`) rather than throwing. {@link Yaml.stripComments} is
 * quote-aware. {@link YamlParseError} / {@link YamlStringifyError} have no
 * `code` field — read `error.diagnostics[0].code`.
 *
 * **Example** (Parse a mapping and stringify it back)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const parsed = Yaml.parseResult("name: Alice\nage: 30")
 * console.log(Result.isSuccess(parsed)) // true
 * if (Result.isSuccess(parsed)) {
 *   console.log(parsed.success) // { name: "Alice", age: 30 }
 * }
 *
 * const yaml = Yaml.stringifyResult({ name: "Alice" })
 * if (Result.isSuccess(yaml)) {
 *   console.log(yaml.success) // "name: Alice\n"
 * }
 * ```
 *
 * @see {@link YamlDocument.parse} for an AST parse that keeps warnings-as-data instead of a plain value.
 * @see {@link YamlFormat.format} for comment-preserving text edits instead of round-trip stringify.
 * @see {@link YamlVisitor.visit} for a SAX event stream over composed documents.
 * @see {@link Yaml.parseResult} for the synchronous Result primitive that `parse` wraps.
 * @public
 * @category codecs
 * @since 0.0.0
 */
export class Yaml {
	private constructor() {}

	/**
	 * Parse a single YAML document into a plain JavaScript value, resolving
	 * anchors and aliases. Error-recovery parsing: collects every fatal
	 * diagnostic and fails once with the aggregate {@link YamlParseError}.
	 * Returns `unknown`, never `any`.
	 *
	 * A "billion laughs" alias-expansion blow-up (an alias chain whose
	 * resolved size grows exponentially relative to `maxAliasCount`) also
	 * fails through {@link YamlParseError} with an `AliasCountExceeded`
	 * diagnostic, never as an unhandled defect.
	 *
	 * Defined in terms of {@link Yaml.parseResult} — synchronous callers can
	 * use that variant directly.
	 */
	static readonly parse = Effect.fn("Yaml.parse")((text: string, options?: YamlParseOptions) =>
		Effect.fromResult(Yaml.parseResult(text, options)),
	);

	/**
	 * Parse a multi-document YAML stream into an array of plain JavaScript
	 * values (one per document, in order). Any fatal diagnostic in any
	 * document — or a stream-level directive-placement error — fails the
	 * whole Effect with the aggregate {@link YamlParseError}.
	 *
	 * A "billion laughs" alias-expansion blow-up in any document also fails
	 * through {@link YamlParseError} with an `AliasCountExceeded` diagnostic,
	 * never as an unhandled defect.
	 *
	 * Defined in terms of {@link Yaml.parseAllResult} — synchronous callers
	 * can use that variant directly.
	 */
	static readonly parseAll = Effect.fn("Yaml.parseAll")((text: string, options?: YamlParseOptions) =>
		Effect.fromResult(Yaml.parseAllResult(text, options)),
	);

	/**
	 * Stringify a plain JavaScript value as YAML. Fails with
	 * {@link YamlStringifyError} on circular references (`CircularReference`)
	 * or on a value nested deeper than the stringifier's recursion budget
	 * (`NestingDepthExceeded`) — both surface through the typed error channel
	 * rather than as an unhandled stack-overflow defect.
	 *
	 * **Gotchas**
	 *
	 * A `"<<"` object key is emitted **quoted** (`'<<': …`). This is the
	 * opposite of the document path ({@link YamlFormat.format} and
	 * `YamlDocument#stringify`), which leaves a parsed plain `<<` key unquoted
	 * so it keeps its merge-key meaning, and the asymmetry is deliberate: a
	 * `"<<"` key on a plain JavaScript object is an ordinary string key that
	 * never carried merge semantics, so emitting it plain would silently turn
	 * ordinary data into a merge directive.
	 */
	static readonly stringify = Effect.fn("Yaml.stringify")(function* (value: unknown, options?: YamlStringifyOptions) {
		return yield* stringifyOrFail(value, options);
	});

	/**
	 * Synchronous single-document parse, returning a `Result` instead of
	 * an `Effect`. A pure escape hatch for config-time callers that cannot
	 * `await` an Effect (a `vitest.config.ts` is the motivating case).
	 *
	 * **Details**
	 *
	 * This is the package's single parse path. {@link Yaml.parse} is defined in
	 * terms of it (`Effect.fromResult` behind the named span), so the two
	 * variants cannot diverge. Reach for the `Effect` variant inside Effect
	 * code — it carries the `Yaml.parse` tracing span — and for this one at
	 * synchronous boundaries.
	 *
	 * Preserves the package contract — malformed and adversarial input fails
	 * typed, never as a defect. Fatal diagnostics, duplicate keys and a
	 * "billion laughs" alias-expansion blow-up all yield a `Failure` carrying a
	 * {@link YamlParseError}; the method never throws.
	 *
	 * **Example** (Inspect success and failure)
	 *
	 * ```ts
	 * import { Result } from "effect"
	 * import { Yaml } from "@beep/scratchpad/yaml"
	 *
	 * const result = Yaml.parseResult("name: Alice\nage: 30")
	 * console.log(Result.isSuccess(result)) // true
	 * if (Result.isSuccess(result)) {
	 *   console.log(result.success) // { name: "Alice", age: 30 }
	 * }
	 *
	 * console.log(Result.isFailure(Yaml.parseResult("a: 1\na: 2\n"))) // true
	 * ```
	 */
	static parseResult(text: string, options?: YamlParseOptions): Result.Result<unknown, YamlParseError> {
		return parseResultImpl(text, options);
	}

	/**
	 * Synchronous multi-document parse, returning a `Result` instead of an
	 * `Effect` — the {@link Yaml.parseResult} counterpart to
	 * {@link Yaml.parseAll}. Empty input succeeds with `[null]` (the engine
	 * reads `""` as one empty document, exactly as {@link Yaml.parse} yields
	 * `null` for it); a single-document stream succeeds with a one-element
	 * array whose value is exactly what {@link Yaml.parseResult} yields.
	 *
	 * **Details**
	 *
	 * This is the package's single multi-document parse path.
	 * {@link Yaml.parseAll} is defined in terms of it (`Effect.fromResult`
	 * behind the named span), so the two variants cannot diverge. Anchors are
	 * document-scoped: each document's aliases resolve against its own anchor
	 * map, never a neighbor's.
	 *
	 * Fails with the aggregate {@link YamlParseError} when **any** document in
	 * the stream carries a fatal diagnostic (or a stream-level
	 * directive-placement error), which makes it a whole-stream validity
	 * check: a `Success` means every document parsed clean. Preserves the
	 * package contract — malformed and adversarial input (including a
	 * "billion laughs" alias bomb in any document) fails typed, never as a
	 * defect; the method never throws.
	 *
	 * **Example** (Parse a two-document stream)
	 *
	 * ```ts
	 * import { Result } from "effect"
	 * import { Yaml } from "@beep/scratchpad/yaml"
	 *
	 * const result = Yaml.parseAllResult("a: 1\n---\nb: 2\n")
	 * console.log(Result.isSuccess(result)) // true
	 * if (Result.isSuccess(result)) {
	 *   console.log(result.success) // [{ a: 1 }, { b: 2 }]
	 * }
	 * ```
	 */
	static parseAllResult(
		text: string,
		options?: YamlParseOptions,
	): Result.Result<ReadonlyArray<unknown>, YamlParseError> {
		return parseAllResultImpl(text, options);
	}

	/**
	 * Synchronous stringify, returning a `Result` instead of an `Effect`.
	 * The pure counterpart to {@link Yaml.stringify} for config-time callers
	 * that cannot `await`.
	 *
	 * Preserves the package contract — a circular reference (`CircularReference`)
	 * or a value nested past the recursion budget (`NestingDepthExceeded`)
	 * yields a `Failure` carrying a {@link YamlStringifyError} rather than a
	 * thrown stack-overflow defect; the method never throws.
	 *
	 * **Example** (Stringify a mapping)
	 *
	 * ```ts
	 * import { Result } from "effect"
	 * import { Yaml } from "@beep/scratchpad/yaml"
	 *
	 * const result = Yaml.stringifyResult({ name: "Alice" })
	 * console.log(Result.isSuccess(result)) // true
	 * if (Result.isSuccess(result)) {
	 *   console.log(result.success) // "name: Alice\n"
	 * }
	 * ```
	 */
	static stringifyResult(value: unknown, options?: YamlStringifyOptions): Result.Result<string, YamlStringifyError> {
		return stringifyResultImpl(value, options);
	}

	/**
	 * Strip comments from YAML text. Without `replaceCh`, comment characters
	 * are removed (line breaks are kept, so line numbers stay stable); with a
	 * `replaceCh` (e.g. `" "`), each comment character is replaced instead,
	 * keeping all offsets stable. Quote-aware: `#` inside quoted scalars is
	 * content, not a comment. Pure and total.
	 */
	static stripComments(text: string, replaceCh?: string): string {
		let result = "";
		let i = 0;
		let inComment = false;
		let inSingleQuote = false;
		let inDoubleQuote = false;

		while (i < text.length) {
			const ch = text[i] as string;

			if (inComment) {
				if (ch === "\n") {
					inComment = false;
					result += ch;
				} else if (replaceCh !== undefined) {
					result += replaceCh;
				}
			} else if (inDoubleQuote) {
				result += ch;
				if (ch === "\\" && i + 1 < text.length) {
					i++;
					result += text[i];
				} else if (ch === '"') {
					inDoubleQuote = false;
				}
			} else if (inSingleQuote) {
				result += ch;
				if (ch === "'" && i + 1 < text.length && text[i + 1] === "'") {
					i++;
					result += text[i];
				} else if (ch === "'") {
					inSingleQuote = false;
				}
			} else if (ch === '"') {
				inDoubleQuote = true;
				result += ch;
			} else if (ch === "'") {
				inSingleQuote = true;
				result += ch;
			} else if (ch === "#") {
				const prev = i > 0 ? text[i - 1] : "\n";
				if (prev === " " || prev === "\t" || prev === "\n" || i === 0) {
					inComment = true;
					if (replaceCh !== undefined) {
						result += replaceCh;
					}
				} else {
					result += ch;
				}
			} else {
				result += ch;
			}

			i++;
		}

		return result;
	}

	/**
	 * Compare two YAML strings for semantic equality: comments, whitespace,
	 * formatting and mapping key order are ignored; sequence order is
	 * significant. Malformed input is never equal to anything — parse errors
	 * (or duplicate keys) on either side yield `false` rather than comparing
	 * recovery-parser artifacts. Pure and total.
	 */
	static equals(a: string, b: string): boolean {
		const va = parseForEquality(a);
		const vb = parseForEquality(b);
		if (va.malformed || vb.malformed) return false;
		return deepEqualValues(va.value, vb.value);
	}

	/**
	 * Compare a YAML string against an existing JavaScript value with the
	 * same semantics as {@link Yaml.equals}: malformed `text` yields `false`.
	 * Pure and total.
	 */
	static equalsValue(text: string, value: unknown): boolean {
		const v = parseForEquality(text);
		if (v.malformed) return false;
		return deepEqualValues(v.value, value);
	}

	/**
	 * A `Schema<unknown, string>` decoding a single YAML document with the
	 * given `options` (defaults when omitted) and encoding values back to
	 * YAML text with default stringify options.
	 *
	 * Schema-producing: each call returns a fresh schema whose derivation
	 * caches are not shared across calls. Bind the result to a `const` on hot
	 * paths; for the default-options case use {@link Yaml.YamlFromString}.
	 */
	static fromString(options?: YamlParseOptions): Schema.Codec<unknown, string> {
		return Schema.String.pipe(
			Schema.decodeTo(
				Schema.Unknown,
				SchemaTransformation.transformOrFail({
					decode: (input: string) =>
						Yaml.parse(input, options).pipe(
							Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, input)),
						),
					encode: (value: unknown) =>
						stringifyOrFail(value).pipe(
							Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, value)),
						),
				}),
			),
		);
	}

	/**
	 * The zero-config `Schema<unknown, string>` — `Yaml.fromString()` with
	 * default options, pre-bound so the common case needs no memoization
	 * discipline.
	 */
	static readonly YamlFromString: Schema.Codec<unknown, string> = Yaml.fromString();

	/**
	 * A `Schema<ReadonlyArray<unknown>, string>` decoding a multi-document
	 * YAML stream into one value per document, and encoding an array of
	 * values back into a `---`-separated stream.
	 *
	 * Schema-producing: bind the result to a `const` on hot paths (see
	 * {@link Yaml.fromString}).
	 */
	static allFromString(options?: YamlParseOptions): Schema.Codec<ReadonlyArray<unknown>, string> {
		return Schema.String.pipe(
			Schema.decodeTo(
				Schema.Array(Schema.Unknown),
				SchemaTransformation.transformOrFail({
					decode: (input: string) =>
						Yaml.parseAll(input, options).pipe(
							Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, input)),
						),
					encode: (values: ReadonlyArray<unknown>) =>
						Effect.gen(function* () {
							if (values.length === 0) return "";
							const parts: Array<string> = [];
							for (let index = 0; index < values.length; index++) {
								const yaml = yield* stringifyOrFail(values[index]).pipe(
									Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, values)),
								);
								parts.push(index > 0 ? `---\n${yaml}` : yaml);
							}
							return parts.join("");
						}),
				}),
			),
		);
	}

	/**
	 * Compose {@link Yaml.fromString} with a target schema, yielding a
	 * `Schema<A, string>` that decodes YAML straight into a validated domain
	 * value — the single best consumer-facing feature of the library. The
	 * target's decoding/encoding service requirements flow through.
	 *
	 * Schema-producing: bind the result to a `const` on hot paths (see
	 * {@link Yaml.fromString}).
	 */
	static schema<T, E, RD = never, RE = never>(
		target: Schema.Codec<T, E, RD, RE>,
		options?: YamlParseOptions,
	): Schema.Codec<T, string, RD, RE> {
		return Yaml.fromString(options).pipe(
			Schema.decodeTo(target as unknown as Schema.Codec<T, unknown, RD, RE>),
		) as unknown as Schema.Codec<T, string, RD, RE>;
	}

	/**
	 * Bind a target schema to the YAML codec once, yielding the composed
	 * schema plus pre-derived `decode`/`encode` directions — the
	 * {@link Yaml.schema} composition without the generic `Schema` machinery
	 * at every use site. Binds the plain single-document form only: default
	 * {@link YamlParseOptions} on decode, default stringify options on encode;
	 * for multi-document streams compose over {@link Yaml.allFromString}
	 * directly.
	 *
	 * Both directions fail with `Schema.SchemaError`, exactly as
	 * `Schema.decodeEffect`/`Schema.encodeEffect` over {@link Yaml.schema}
	 * would; the target's decoding/encoding service requirements flow through.
	 *
	 * **Gotchas**
	 *
	 * Schema-producing: each call composes a fresh schema and derives both
	 * directions from it. Bind the result to a `const` — that single binding is
	 * the point. Encode uses default stringify options, so `lineWidth` never
	 * folds through this path.
	 *
	 * **Example** (Decode YAML into a struct and encode it back)
	 *
	 * ```ts
	 * import { Effect } from "effect"
	 * import * as S from "effect/Schema"
	 * import { Yaml } from "@beep/scratchpad/yaml"
	 *
	 * const Config = S.Struct({ port: S.Number })
	 * const config = Yaml.bind(Config)
	 * const value = Effect.runSync(config.decode("port: 3000"))
	 *
	 * console.log(value) // { port: 3000 }
	 * console.log(Effect.runSync(config.encode(value)).includes("3000")) // true
	 * ```
	 *
	 * @param target - The domain schema decoded values must satisfy.
	 * @returns A {@link YamlBoundCodec} carrying the composed schema and its two pre-bound directions.
	 */
	static bind<T, E, RD = never, RE = never>(target: Schema.Codec<T, E, RD, RE>): YamlBoundCodec<T, RD, RE> {
		const schema = Yaml.schema(target);
		return {
			schema,
			decode: Schema.decodeEffect(schema),
			encode: Schema.encodeEffect(schema),
		};
	}
}

// ── Equality internals ──────────────────────────────────────────────────────

/**
 * Parse for `equals`/`equalsValue`: any recorded error — fatal or not — or a
 * DuplicateKey warning marks the input malformed (never equal to anything).
 */
function parseForEquality(text: string): { readonly malformed: boolean; readonly value: unknown } {
	const doc = composeFirstDocument(text, {});
	if (doc.errors.length > 0 || doc.warnings.some((w) => w.code === "DuplicateKey")) {
		return { malformed: true, value: undefined };
	}
	const anchors = new Map<string, YamlNode>();
	try {
		return { malformed: false, value: nodeToJsValue(doc.contents, anchors, 100) };
	} catch (err) {
		// A "billion laughs" alias bomb parses clean but blows up on expansion;
		// treat it as malformed (never equal to anything) rather than letting the
		// budget guard escape as a defect.
		if (err instanceof AliasExpansionBudgetExceeded) {
			return { malformed: true, value: undefined };
		}
		throw err;
	}
}

/**
 * Deep structural equality over plain values: NaN equals NaN, mapping key
 * order ignored, sequence order significant.
 */
function deepEqualValues(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
		return true;
	}
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;

	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqualValues(a[i], b[i])) return false;
		}
		return true;
	}
	if (Array.isArray(b)) return false;

	if (typeof a === "object" && typeof b === "object") {
		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		for (const key of aKeys) {
			if (!Object.hasOwn(bObj, key) || !deepEqualValues(aObj[key], bObj[key])) return false;
		}
		return true;
	}

	return false;
}
