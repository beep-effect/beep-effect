// The structured diagnostic concept: YamlDiagnostic (carried by both error
// payloads and YamlDocument's warnings-as-data arrays), the staged error-code
// literal unions, and the single fatal-code predicate.
//
// Cycle firewall: the internal engine emits raw `{ code, message, offset,
// length }` records; this module materializes them into `YamlDiagnostic`,
// deriving `line`/`character` from `offset` against the source text. The
// dependency edge runs public modules → engine only.
//
// The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
// is structurally identical to `JsoncParseErrorDetail` per the jsonc/yaml
// parity convention; `message` is yaml's additive extra.

import { Schema } from "effect";
import {
	YAML_COMPOSE_ERROR_CODES,
	YAML_LEX_ERROR_CODES,
	YAML_MODIFY_ERROR_CODES,
	YAML_PARSE_ERROR_CODES,
	YAML_STRINGIFY_ERROR_CODES,
	isFatalCode,
} from "./internal/diagnostics.ts";

/**
 * Error codes emitted by the lexer stage.
 *
 * @public
 */
export const YamlLexErrorCode = Schema.Literals(YAML_LEX_ERROR_CODES);

/**
 * The union of all lexer-stage error code string literals.
 *
 * @public
 */
export type YamlLexErrorCode = typeof YamlLexErrorCode.Type;

/**
 * Error codes emitted by the CST-parser stage.
 *
 * @public
 */
export const YamlParseErrorCode = Schema.Literals(YAML_PARSE_ERROR_CODES);

/**
 * The union of all parser-stage error code string literals.
 *
 * @public
 */
export type YamlParseErrorCode = typeof YamlParseErrorCode.Type;

/**
 * Error codes emitted by the composer stage.
 *
 * @public
 */
export const YamlComposerErrorCode = Schema.Literals(YAML_COMPOSE_ERROR_CODES);

/**
 * The union of all composer-stage error code string literals.
 *
 * @public
 */
export type YamlComposerErrorCode = typeof YamlComposerErrorCode.Type;

/**
 * Error codes emitted by the stringifier (the circular-reference guard).
 *
 * @public
 */
export const YamlStringifyErrorCode = Schema.Literals(YAML_STRINGIFY_ERROR_CODES);

/**
 * The union of all stringifier-stage error code string literals.
 *
 * @public
 */
export type YamlStringifyErrorCode = typeof YamlStringifyErrorCode.Type;

/**
 * Error codes emitted by `YamlFormat.modify`'s path navigation against an
 * already-composed AST — not raised by the parser/composer/stringifier.
 *
 * @public
 */
export const YamlModifyErrorCode = Schema.Literals(YAML_MODIFY_ERROR_CODES);

/**
 * The union of all modify-stage error code string literals.
 *
 * @public
 */
export type YamlModifyErrorCode = typeof YamlModifyErrorCode.Type;

/**
 * Union of all YAML error codes across all pipeline stages. Stage
 * discrimination lives here (in the code), not in separate error classes.
 *
 * @public
 */
export const YamlErrorCode = Schema.Union([
	YamlLexErrorCode,
	YamlParseErrorCode,
	YamlComposerErrorCode,
	YamlStringifyErrorCode,
	YamlModifyErrorCode,
]);

/**
 * The union of all YAML error code string literals.
 *
 * @public
 */
export type YamlErrorCode = typeof YamlErrorCode.Type;

/**
 * One structured diagnostic: its {@link (YamlErrorCode:type)}, a
 * human-readable `message`, and its exact position (`offset`/`length`, plus
 * zero-based `line`/`character`). Used for both errors and warnings-as-data;
 * fatality is a property of the code — see {@link YamlDiagnostic.isFatal}.
 *
 * @remarks
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@effected/jsonc`'s parse-error detail shape;
 * `message` is this package's additive extra.
 *
 * @public
 */
export class YamlDiagnostic extends Schema.Class<YamlDiagnostic>("YamlDiagnostic")({
	code: YamlErrorCode,
	message: Schema.String,
	offset: Schema.Number,
	length: Schema.Number,
	line: Schema.Number,
	character: Schema.Number,
}) {
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
