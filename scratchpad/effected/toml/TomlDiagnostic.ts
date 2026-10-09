// The structured diagnostic concept: TomlDiagnostic and the staged
// error-code literal unions.
//
// Cycle firewall: the internal engine emits raw `{ code, message, offset,
// length }` records; this module materializes them into `TomlDiagnostic`,
// deriving `line`/`character` from `offset` against the source text. The
// dependency edge runs public modules → engine only.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import {
	TOML_LEX_ERROR_CODES,
	TOML_PARSE_ERROR_CODES,
	TOML_SEMANTIC_ERROR_CODES,
	TOML_STRINGIFY_ERROR_CODES,
} from "./internal/diagnostics.ts";

const $I = $ScratchpadId.create("effected/toml/TomlDiagnostic");

/**
 * Error codes emitted by the lexer stage.
 *
 * **Example** (Recognize a lexical error code)
 *
 * ```ts
 * import { TomlLexErrorCode } from "@beep/scratchpad/effected/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlLexErrorCode)("UnterminatedString")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlLexErrorCode = LiteralKit(TOML_LEX_ERROR_CODES).pipe($I.annoteSchema("TomlLexErrorCode", { description: "Error codes emitted by the lexer stage." }));

/**
 * The union of all lexer-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlLexErrorCode = typeof TomlLexErrorCode.Type;

/**
 * Error codes emitted by the parser stage.
 *
 * **Example** (Recognize a syntax error code)
 *
 * ```ts
 * import { TomlParseErrorCode } from "@beep/scratchpad/effected/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlParseErrorCode)("ExpectedEquals")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlParseErrorCode = LiteralKit(TOML_PARSE_ERROR_CODES).pipe($I.annoteSchema("TomlParseErrorCode", { description: "Error codes emitted by the parser stage." }));

/**
 * The union of all parser-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlParseErrorCode = typeof TomlParseErrorCode.Type;

/**
 * Error codes emitted by the semantic (table/key conflict) stage.
 *
 * **Example** (Recognize a key conflict code)
 *
 * ```ts
 * import { TomlSemanticErrorCode } from "@beep/scratchpad/effected/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlSemanticErrorCode)("DuplicateKey")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlSemanticErrorCode = LiteralKit(TOML_SEMANTIC_ERROR_CODES).pipe($I.annoteSchema("TomlSemanticErrorCode", { description: "Error codes emitted by the semantic (table/key conflict) stage." }));

/**
 * The union of all semantic-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlSemanticErrorCode = typeof TomlSemanticErrorCode.Type;

/**
 * Error codes emitted by the stringifier stage.
 *
 * **Example** (Recognize a serialization error code)
 *
 * ```ts
 * import { TomlStringifyErrorCode } from "@beep/scratchpad/effected/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlStringifyErrorCode)("UnsupportedValue")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlStringifyErrorCode = LiteralKit(TOML_STRINGIFY_ERROR_CODES).pipe($I.annoteSchema("TomlStringifyErrorCode", { description: "Error codes emitted by the stringifier stage." }));

/**
 * The union of all stringifier-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlStringifyErrorCode = typeof TomlStringifyErrorCode.Type;

/**
 * Union of all TOML error codes across all pipeline stages. Stage
 * discrimination lives here (in the code), not in separate error classes.
 *
 * **Example** (Recognize a code across pipeline stages)
 *
 * ```ts
 * import { TomlErrorCode } from "@beep/scratchpad/effected/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlErrorCode)("DuplicateKey")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlErrorCode = S.Union([
	TomlLexErrorCode,
	TomlParseErrorCode,
	TomlSemanticErrorCode,
	TomlStringifyErrorCode,
]).pipe($I.annoteSchema("TomlErrorCode", { description: "Union of all TOML error codes across all pipeline stages. Stage discrimination lives here (in the code), not in separate error classes." }));

/**
 * The union of all TOML error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlErrorCode = typeof TomlErrorCode.Type;

/**
 * One structured diagnostic: its {@link (TomlErrorCode:type)}, a
 * human-readable `message`, and its exact position (`offset`/`length`, plus
 * zero-based `line`/`character`).
 *
 * **Details**
 *
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@effected/jsonc`'s parse-error detail shape
 * and `@effected/yaml`'s `YamlDiagnostic`; `message` is this package's
 * additive extra.
 *
 * **Example** (Construct a positioned diagnostic)
 *
 * ```ts
 * import { TomlDiagnostic } from "@beep/scratchpad/effected/toml/TomlDiagnostic";
 *
 * const diagnostic = TomlDiagnostic.make({
 *   code: "ExpectedKey", message: "Expected a key",
 *   offset: 0, length: 1, line: 0, character: 0,
 * });
 * console.log(diagnostic.code) // ExpectedKey
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlDiagnostic extends S.Class<TomlDiagnostic>($I`TomlDiagnostic`)({
	code: TomlErrorCode.annotateKey({ description: "Failure category emitted during TOML lexing, parsing, semantic validation, or stringification" }),
	message: S.String.annotateKey({ description: "Human-readable explanation supplied by the TOML engine for the failure" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start position of the diagnostic span in source UTF-16 code units, or zero for stringification failures" }),
	length: S.Finite.annotateKey({ description: "Diagnostic span length in source UTF-16 code units, with zero used for position-only or stringification failures" }),
	line: S.Finite.annotateKey({ description: "Zero-based source line derived from the diagnostic offset, counting CRLF as one line break" }),
	character: S.Finite.annotateKey({ description: "Zero-based position within the source line in UTF-16 code units, derived from the diagnostic offset" }),
}, $I.annote("TomlDiagnostic", { description: "One structured diagnostic: its (TomlErrorCode:type), a human-readable `message`, and its exact position (`offset`/`length`, plus zero-based `line`/`character`)." })) {
	/**
	 * Materialize an engine record, deriving `line`/`character` (0-based)
	 * from `offset` against the source text. Advanced — the parse/stringify
	 * entry points call this for you.
	 *
	 * **Example** (Derive a position after a CRLF newline)
	 *
	 * ```ts
	 * import { TomlDiagnostic } from "@beep/scratchpad/effected/toml/TomlDiagnostic";
	 *
	 * const diagnostic = TomlDiagnostic.fromRaw("a = 1\r\n?", {
	 *   code: "ExpectedKey", message: "Expected a key", offset: 7, length: 1,
	 * });
	 * console.log(`${diagnostic.line}:${diagnostic.character}`) // 1:0
	 * ```
	 *
	 * @param source - The source text the record's `offset` indexes into.
	 * @param raw - The engine record: `code`, `message`, `offset` and `length`.
	 * @returns The diagnostic with `line` and `character` filled in.
	 * @category constructors
	 * @since 0.0.0
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
