/**
 * Structured YAML diagnostics and the staged error-code unions they carry.
 *
 * The engine emits raw `{ code, message, offset, length }` records; this
 * module materializes {@link YamlDiagnostic}, deriving `line`/`character` from
 * `offset` against the source text. Fatality is a property of `code` via
 * {@link YamlDiagnostic.isFatal}, not of the array a diagnostic sits in.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import {
	YAML_COMPOSE_ERROR_CODES,
	YAML_LEX_ERROR_CODES,
	YAML_MODIFY_ERROR_CODES,
	YAML_PARSE_ERROR_CODES,
	YAML_STRINGIFY_ERROR_CODES,
	isFatalCode,
} from "./internal/diagnostics.ts";

const $I = $ScratchpadId.create("yaml/YamlDiagnostic");

/**
 * Error codes emitted by the lexer stage.
 *
 * **Example** (Match a lexer-stage code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlLexErrorCode } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlLexErrorCode)("UnterminatedString")) // true
 * console.log(S.is(YamlLexErrorCode)("PathNotFound")) // false
 * ```
 *
 * @see {@link YamlDiagnostic} for the diagnostic that carries one of these codes.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlLexErrorCode = Schema.Literals(YAML_LEX_ERROR_CODES).pipe(
	$I.annoteSchema("YamlLexErrorCode", {
		description: "Error codes emitted while tokenizing YAML source.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlLexErrorCode}.
 *
 * @see {@link YamlLexErrorCode} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlLexErrorCode = typeof YamlLexErrorCode.Type;

/**
 * Error codes emitted by the CST-parser stage.
 *
 * **Example** (Match a parser-stage code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlParseErrorCode } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlParseErrorCode)("UnexpectedToken")) // true
 * console.log(S.is(YamlParseErrorCode)("CircularReference")) // false
 * ```
 *
 * @see {@link YamlParseError} for the aggregate error that collects parser-stage diagnostics.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlParseErrorCode = Schema.Literals(YAML_PARSE_ERROR_CODES).pipe(
	$I.annoteSchema("YamlParseErrorCode", {
		description: "Error codes emitted while parsing YAML concrete syntax.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlParseErrorCode}.
 *
 * @see {@link YamlParseErrorCode} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlParseErrorCode = typeof YamlParseErrorCode.Type;

/**
 * Error codes emitted by the composer stage.
 *
 * **Example** (Match a composer-stage code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlComposerErrorCode } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlComposerErrorCode)("AliasCountExceeded")) // true
 * console.log(S.is(YamlComposerErrorCode)("UnexpectedToken")) // false
 * ```
 *
 * @see {@link YamlDiagnostic.isFatal} for which composer codes abort a parse.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlComposerErrorCode = Schema.Literals(YAML_COMPOSE_ERROR_CODES).pipe(
	$I.annoteSchema("YamlComposerErrorCode", {
		description: "Error codes emitted while composing YAML AST nodes from the CST.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlComposerErrorCode}.
 *
 * @see {@link YamlComposerErrorCode} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlComposerErrorCode = typeof YamlComposerErrorCode.Type;

/**
 * Error codes emitted by the stringifier (the circular-reference guard).
 *
 * **Example** (Match a stringifier-stage code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlStringifyErrorCode } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlStringifyErrorCode)("CircularReference")) // true
 * console.log(S.is(YamlStringifyErrorCode)("UnexpectedToken")) // false
 * ```
 *
 * @see {@link YamlStringifyError} for the aggregate error that carries these diagnostics.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlStringifyErrorCode = Schema.Literals(YAML_STRINGIFY_ERROR_CODES).pipe(
	$I.annoteSchema("YamlStringifyErrorCode", {
		description: "Error codes emitted when stringifying a YAML value fails on a typed channel.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlStringifyErrorCode}.
 *
 * @see {@link YamlStringifyErrorCode} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlStringifyErrorCode = typeof YamlStringifyErrorCode.Type;

/**
 * Error codes emitted by {@link YamlFormat.modify}'s path navigation against an
 * already-composed AST — not raised by the parser, composer, or stringifier.
 *
 * **Example** (Distinguish modify codes from parse codes)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlModifyErrorCode, YamlParseErrorCode } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlModifyErrorCode)("PathNotFound")) // true
 * console.log(S.is(YamlParseErrorCode)("PathNotFound")) // false
 * ```
 *
 * @see {@link YamlFormat.modify} for the entry point that raises these codes.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlModifyErrorCode = Schema.Literals(YAML_MODIFY_ERROR_CODES).pipe(
	$I.annoteSchema("YamlModifyErrorCode", {
		description: "Error codes emitted when YamlFormat.modify cannot navigate or legally rewrite a document.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlModifyErrorCode}.
 *
 * @see {@link YamlModifyErrorCode} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlModifyErrorCode = typeof YamlModifyErrorCode.Type;

/**
 * Union of all YAML error codes across all pipeline stages. Stage
 * discrimination lives here (in the code), not in separate error classes.
 *
 * **Example** (Accept any pipeline stage)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlErrorCode } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlErrorCode)("UnexpectedToken")) // true
 * console.log(S.is(YamlErrorCode)("PathNotFound")) // true
 * console.log(S.is(YamlErrorCode)("not-a-code")) // false
 * ```
 *
 * @see {@link YamlDiagnostic} for the diagnostic that stores one of these codes.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlErrorCode = Schema.Union([
	YamlLexErrorCode,
	YamlParseErrorCode,
	YamlComposerErrorCode,
	YamlStringifyErrorCode,
	YamlModifyErrorCode,
]).pipe(
	$I.annoteSchema("YamlErrorCode", {
		description: "Union of YAML error codes across lexer, parser, composer, stringify and modify stages.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlErrorCode}.
 *
 * @see {@link YamlErrorCode} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlErrorCode = typeof YamlErrorCode.Type;

/**
 * One structured diagnostic: its {@link (YamlErrorCode:type)}, a
 * human-readable `message`, and its exact position (`offset`/`length`, plus
 * zero-based `line`/`character`). Used for both errors and warnings-as-data;
 * fatality is a property of the code — see {@link YamlDiagnostic.isFatal}.
 *
 * **Details**
 *
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@effected/jsonc`'s parse-error detail shape;
 * `message` is this package's additive extra.
 *
 * **Gotchas**
 *
 * Fatality is a property of `code` via {@link YamlDiagnostic.isFatal}, not of
 * the array the diagnostic sits in — {@link YamlDocument} `errors` can include
 * recovered non-fatal records, and `warnings` are never fatal. {@link YamlDiagnostic.fromRaw}
 * is advanced: parse and stringify entry points already materialize diagnostics.
 * {@link YamlModifyErrorCode} values never come from the parser; they are
 * {@link YamlFormat.modify} navigation only.
 *
 * **Example** (Construct a diagnostic and test fatality)
 *
 * ```ts
 * import { YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * const diagnostic = YamlDiagnostic.make({
 *   code: "UnexpectedToken",
 *   message: "unexpected ':'",
 *   offset: 0,
 *   length: 1,
 *   line: 0,
 *   character: 0,
 * })
 *
 * console.log(YamlDiagnostic.isFatal(diagnostic.code)) // true
 * console.log(YamlDiagnostic.isFatal("DuplicateKey")) // false
 * ```
 *
 * @see {@link YamlParseError} for the aggregate parse failure that batches fatal diagnostics.
 * @see {@link YamlFormat.modify} for the entry point that raises modify-stage codes.
 * @public
 * @category diagnostics
 * @since 0.0.0
 */
export class YamlDiagnostic extends Schema.Class<YamlDiagnostic>("YamlDiagnostic")(
	{
		code: YamlErrorCode,
		message: Schema.String,
		offset: Schema.Number,
		length: Schema.Number,
		line: Schema.Number,
		character: Schema.Number,
	},
	$I.annote("YamlDiagnostic", {
		description: "A positioned YAML diagnostic whose fatality is determined by its error code.",
	}),
) {
	/**
	 * The single fatal-code predicate: whether diagnostics with this code
	 * abort a parse (vs. being recoverable warnings-as-data). Declared once,
	 * as a property of the code — replacing the v3 source's three
	 * subtly-differing inline fatal lists.
	 */
	static isFatal(code: YamlErrorCode): boolean {
		return isFatalCode(code);
	}

	/**
	 * Materialize a raw engine diagnostic record into a `YamlDiagnostic`,
	 * deriving `line`/`character` from `offset` against the source `text`.
	 * Advanced — the parse/stringify entry points call this for you.
	 */
	static fromRaw(
		raw: { readonly code: YamlErrorCode; readonly message: string; readonly offset: number; readonly length: number },
		text: string,
	): YamlDiagnostic {
		const { line, character } = lineChar(text, raw.offset);
		return YamlDiagnostic.make({
			code: raw.code,
			message: raw.message,
			offset: raw.offset,
			length: raw.length,
			line,
			character,
		});
	}
}

/**
 * Compute the zero-based line/character position of `offset` within `text`.
 * Recognizes `\n`, `\r`, `\r\n`, LS and PS as line breaks, matching the
 * jsonc counterpart so positions are codec-generic.
 */
function lineChar(text: string, offset: number): { line: number; character: number } {
	let line = 0;
	let lineStart = 0;
	const limit = Math.min(offset, text.length);
	for (let i = 0; i < limit; i++) {
		const ch = text.charCodeAt(i);
		if (ch === 0x0a) {
			line++;
			lineStart = i + 1;
		} else if (ch === 0x0d) {
			if (i + 1 < text.length && text.charCodeAt(i + 1) === 0x0a) {
				i++;
			}
			line++;
			lineStart = i + 1;
		} else if (ch === 0x2028 || ch === 0x2029) {
			line++;
			lineStart = i + 1;
		}
	}
	return { line, character: offset - lineStart };
}
