// The structured diagnostic concept: TomlDiagnostic and the staged
// error-code literal unions.
//
// Cycle firewall: the internal engine emits raw `{ code, message, offset,
// length }` records; this module materializes them into `TomlDiagnostic`,
// deriving `line`/`character` from `offset` against the source text. The
// dependency edge runs public modules → engine only.

import { Schema } from "effect";
import {
	TOML_LEX_ERROR_CODES,
	TOML_PARSE_ERROR_CODES,
	TOML_SEMANTIC_ERROR_CODES,
	TOML_STRINGIFY_ERROR_CODES,
} from "./internal/diagnostics.ts";

/**
 * Error codes emitted by the lexer stage.
 *
 * @public
 */
export const TomlLexErrorCode = Schema.Literals(TOML_LEX_ERROR_CODES);

/**
 * The union of all lexer-stage error code string literals.
 *
 * @public
 */
export type TomlLexErrorCode = typeof TomlLexErrorCode.Type;

/**
 * Error codes emitted by the parser stage.
 *
 * @public
 */
export const TomlParseErrorCode = Schema.Literals(TOML_PARSE_ERROR_CODES);

/**
 * The union of all parser-stage error code string literals.
 *
 * @public
 */
export type TomlParseErrorCode = typeof TomlParseErrorCode.Type;

/**
 * Error codes emitted by the semantic (table/key conflict) stage.
 *
 * @public
 */
export const TomlSemanticErrorCode = Schema.Literals(TOML_SEMANTIC_ERROR_CODES);

/**
 * The union of all semantic-stage error code string literals.
 *
 * @public
 */
export type TomlSemanticErrorCode = typeof TomlSemanticErrorCode.Type;

/**
 * Error codes emitted by the stringifier stage.
 *
 * @public
 */
export const TomlStringifyErrorCode = Schema.Literals(TOML_STRINGIFY_ERROR_CODES);

/**
 * The union of all stringifier-stage error code string literals.
 *
 * @public
 */
export type TomlStringifyErrorCode = typeof TomlStringifyErrorCode.Type;

/**
 * Union of all TOML error codes across all pipeline stages. Stage
 * discrimination lives here (in the code), not in separate error classes.
 *
 * @public
 */
export const TomlErrorCode = Schema.Union([
	TomlLexErrorCode,
	TomlParseErrorCode,
	TomlSemanticErrorCode,
	TomlStringifyErrorCode,
]);

/**
 * The union of all TOML error code string literals.
 *
 * @public
 */
export type TomlErrorCode = typeof TomlErrorCode.Type;

/**
 * One structured diagnostic: its {@link (TomlErrorCode:type)}, a
 * human-readable `message`, and its exact position (`offset`/`length`, plus
 * zero-based `line`/`character`).
 *
 * @remarks
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@effected/jsonc`'s parse-error detail shape
 * and `@effected/yaml`'s `YamlDiagnostic`; `message` is this package's
 * additive extra.
 *
 * @public
 */
export class TomlDiagnostic extends Schema.Class<TomlDiagnostic>("TomlDiagnostic")({
	code: TomlErrorCode,
	message: Schema.String,
	offset: Schema.Number,
	length: Schema.Number,
	line: Schema.Number,
	character: Schema.Number,
}) {
	/**
	 * Materialize an engine record, deriving `line`/`character` (0-based)
	 * from `offset` against the source `text`. Advanced — the parse/stringify
	 * entry points call this for you.
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
