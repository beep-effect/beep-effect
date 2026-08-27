/**
 * Structured TOML diagnostics and the staged error-code literal unions.
 *
 * **Details**
 *
 * Cycle firewall: the internal engine emits raw `{ code, message, offset,
 * length }` records; this module materializes them into {@link TomlDiagnostic},
 * deriving `line`/`character` from `offset` against the source text. The
 * dependency edge runs public modules → engine only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import {
	TOML_LEX_ERROR_CODES,
	TOML_PARSE_ERROR_CODES,
	TOML_SEMANTIC_ERROR_CODES,
	TOML_STRINGIFY_ERROR_CODES,
} from "./internal/diagnostics.ts";

const $I = $ScratchpadId.create("toml/TomlDiagnostic");

/**
 * Error codes emitted by the lexer stage.
 *
 * **Example** (Guard a lexer code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlLexErrorCode } from "@beep/scratchpad/toml"
 *
 * console.log(S.is(TomlLexErrorCode)("InvalidUtf8")) // true
 * console.log(S.is(TomlLexErrorCode)("DuplicateKey")) // false
 * ```
 *
 * @see {@link TomlErrorCode} for the union of every pipeline stage.
 * @category schemas
 * @since 0.0.0
 */
export const TomlLexErrorCode = Schema.Literals(TOML_LEX_ERROR_CODES).pipe(
	$I.annoteSchema("TomlLexErrorCode", {
		description: "Error codes emitted by the TOML lexer stage.",
	}),
);

/**
 * The union of all lexer-stage error code string literals.
 *
 * @see {@link TomlLexErrorCode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlLexErrorCode = typeof TomlLexErrorCode.Type;

/**
 * Error codes emitted by the parser stage.
 *
 * **Example** (Guard a parser code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlParseErrorCode } from "@beep/scratchpad/toml"
 *
 * console.log(S.is(TomlParseErrorCode)("ExpectedEquals")) // true
 * console.log(S.is(TomlParseErrorCode)("InvalidUtf8")) // false
 * ```
 *
 * @see {@link TomlErrorCode} for the union of every pipeline stage.
 * @category schemas
 * @since 0.0.0
 */
export const TomlParseErrorCode = Schema.Literals(TOML_PARSE_ERROR_CODES).pipe(
	$I.annoteSchema("TomlParseErrorCode", {
		description: "Error codes emitted by the TOML parser stage.",
	}),
);

/**
 * The union of all parser-stage error code string literals.
 *
 * @see {@link TomlParseErrorCode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlParseErrorCode = typeof TomlParseErrorCode.Type;

/**
 * Error codes emitted by the semantic (table/key conflict) stage.
 *
 * **Example** (Guard a semantic code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlSemanticErrorCode } from "@beep/scratchpad/toml"
 *
 * console.log(S.is(TomlSemanticErrorCode)("DuplicateKey")) // true
 * console.log(S.is(TomlSemanticErrorCode)("ExpectedValue")) // false
 * ```
 *
 * @see {@link TomlErrorCode} for the union of every pipeline stage.
 * @category schemas
 * @since 0.0.0
 */
export const TomlSemanticErrorCode = Schema.Literals(TOML_SEMANTIC_ERROR_CODES).pipe(
	$I.annoteSchema("TomlSemanticErrorCode", {
		description: "Error codes emitted by the TOML semantic (table/key conflict) stage.",
	}),
);

/**
 * The union of all semantic-stage error code string literals.
 *
 * @see {@link TomlSemanticErrorCode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlSemanticErrorCode = typeof TomlSemanticErrorCode.Type;

/**
 * Error codes emitted by the stringifier stage.
 *
 * **Example** (Guard a stringify code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlStringifyErrorCode } from "@beep/scratchpad/toml"
 *
 * console.log(S.is(TomlStringifyErrorCode)("UnsupportedValue")) // true
 * console.log(S.is(TomlStringifyErrorCode)("DuplicateKey")) // false
 * ```
 *
 * @see {@link TomlErrorCode} for the union of every pipeline stage.
 * @category schemas
 * @since 0.0.0
 */
export const TomlStringifyErrorCode = Schema.Literals(TOML_STRINGIFY_ERROR_CODES).pipe(
	$I.annoteSchema("TomlStringifyErrorCode", {
		description: "Error codes emitted by the TOML stringifier stage.",
	}),
);

/**
 * The union of all stringifier-stage error code string literals.
 *
 * @see {@link TomlStringifyErrorCode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlStringifyErrorCode = typeof TomlStringifyErrorCode.Type;

/**
 * Union of all TOML error codes across all pipeline stages. Stage
 * discrimination lives here (in the code), not in separate error classes.
 *
 * **Gotchas**
 *
 * `IntegerOutOfRange` and `NestingDepthExceeded` appear in both parse and
 * stringify code arrays on purpose — the same concept applies on both sides,
 * so there is no stringify-only class for those failures.
 *
 * **Example** (Guard codes from two stages)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlErrorCode } from "@beep/scratchpad/toml"
 *
 * console.log(S.is(TomlErrorCode)("InvalidUtf8")) // true
 * console.log(S.is(TomlErrorCode)("CircularReference")) // true
 * console.log(S.is(TomlErrorCode)("not-a-code")) // false
 * ```
 *
 * @see {@link TomlParseError} for the tagged parse failure that carries these codes.
 * @see {@link TomlStringifyError} for the tagged stringify failure that carries these codes.
 * @category schemas
 * @since 0.0.0
 */
export const TomlErrorCode = Schema.Union([
	TomlLexErrorCode,
	TomlParseErrorCode,
	TomlSemanticErrorCode,
	TomlStringifyErrorCode,
]).pipe(
	$I.annoteSchema("TomlErrorCode", {
		description: "Union of all TOML error codes across lexer, parser, semantic, and stringify stages.",
	}),
);

/**
 * The union of all TOML error code string literals.
 *
 * @see {@link TomlErrorCode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlErrorCode = typeof TomlErrorCode.Type;

/**
 * One structured diagnostic: its {@link TomlErrorCode}, a human-readable
 * `message`, and its exact position (`offset`/`length`, plus zero-based
 * `line`/`character`).
 *
 * **Details**
 *
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * matches the jsonc parse-error detail shape and yaml's `YamlDiagnostic`;
 * `message` is this package's additive extra.
 *
 * **Gotchas**
 *
 * `line` and `character` are 0-based. `lineChar` treats CRLF as one newline.
 * {@link TomlDiagnostic.fromRaw} is not a public parse API — parse and
 * stringify entry points call it for you.
 *
 * **Example** (Materialize a raw engine record)
 *
 * ```ts
 * import { TomlDiagnostic } from "@beep/scratchpad/toml"
 *
 * const diagnostic = TomlDiagnostic.fromRaw('name = \n', {
 *   code: "ExpectedValue",
 *   message: "expected a value",
 *   offset: 7,
 *   length: 0,
 * })
 * console.log(diagnostic.line) // 0
 * console.log(diagnostic.character) // 7
 * console.log(diagnostic.code) // "ExpectedValue"
 * ```
 *
 * @see {@link TomlParseError} for the tagged error that aggregates parse diagnostics.
 * @see {@link TomlStringifyError} for the tagged error that carries one stringify diagnostic.
 * @see {@link TomlErrorCode} for the code union that discriminates pipeline stages.
 * @category diagnostics
 * @since 0.0.0
 */
export class TomlDiagnostic extends Schema.Class<TomlDiagnostic>($I`TomlDiagnostic`)(
	{
		code: TomlErrorCode,
		message: Schema.String,
		offset: Schema.Number,
		length: Schema.Number,
		line: Schema.Number,
		character: Schema.Number,
	},
	$I.annote("TomlDiagnostic", {
		description: "One structured TOML diagnostic with a staged error code and 0-based source position.",
	}),
) {
	/**
	 * Materialize an engine record, deriving `line`/`character` (0-based)
	 * from `offset` against the source `text`. Advanced — the parse/stringify
	 * entry points call this for you.
	 *
	 * **Example** (Derive line and character from an offset)
	 *
	 * ```ts
	 * import { TomlDiagnostic } from "@beep/scratchpad/toml"
	 *
	 * const diagnostic = TomlDiagnostic.fromRaw("a = 1\nb = \n", {
	 *   code: "ExpectedValue",
	 *   message: "expected a value",
	 *   offset: 10,
	 *   length: 0,
	 * })
	 * console.log(diagnostic.line) // 1
	 * console.log(diagnostic.character) // 4
	 * ```
	 */
	static fromRaw(
		source: string,
		raw: { readonly code: TomlErrorCode; readonly message: string; readonly offset: number; readonly length: number },
	): TomlDiagnostic {
		const { line, character } = lineChar(source, raw.offset);
		return TomlDiagnostic.make({
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
 * Recognizes `\n`, `\r` and `\r\n` as line breaks (TOML's newline grammar);
 * a CRLF pair counts as a single newline.
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
		}
	}
	return { line, character: offset - lineStart };
}
