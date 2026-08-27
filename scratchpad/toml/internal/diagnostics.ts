/**
 * Engine-only TOML diagnostic vocabulary and throw carrier.
 *
 * **Details**
 *
 * Public modules materialize these records into {@link TomlDiagnostic}
 * (adding `line`/`character`); the engine never imports public modules. That
 * public/engine firewall (yaml/jsonc precedent) is what keeps `noImportCycles`
 * satisfied.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Lexer-stage error codes thrown as {@link RawTomlError} before a public
 * module materializes {@link TomlDiagnostic}.
 *
 * **Example** (Pin the first lexer code)
 *
 * ```ts
 * import { TOML_LEX_ERROR_CODES } from "../../../toml/internal/diagnostics.ts"
 *
 * console.log(TOML_LEX_ERROR_CODES[0]) // "InvalidUtf8"
 * console.log(TOML_LEX_ERROR_CODES.includes("BareCarriageReturn")) // true
 * ```
 *
 * @see {@link TomlDiagnostic} for the public materialization of these codes.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const TOML_LEX_ERROR_CODES = [
	"InvalidUtf8",
	"UnterminatedString",
	"InvalidEscape",
	"InvalidUnicodeEscape",
	"ControlCharacterInString",
	"ControlCharacterInComment",
	"InvalidCharacter",
	"BareCarriageReturn",
] as const;

/**
 * Parser-stage error codes thrown as {@link RawTomlError} before a public
 * module materializes {@link TomlDiagnostic}.
 *
 * **Example** (Pin a parser code)
 *
 * ```ts
 * import { TOML_PARSE_ERROR_CODES } from "../../../toml/internal/diagnostics.ts"
 *
 * console.log(TOML_PARSE_ERROR_CODES.includes("ExpectedEquals")) // true
 * console.log(TOML_PARSE_ERROR_CODES.includes("DuplicateKey")) // false
 * ```
 *
 * @see {@link TomlDiagnostic} for the public materialization of these codes.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const TOML_PARSE_ERROR_CODES = [
	"ExpectedKey",
	"ExpectedEquals",
	"ExpectedValue",
	"ExpectedNewline",
	"ExpectedTableHeaderClose",
	"UnterminatedArray",
	"UnterminatedInlineTable",
	"InvalidValue",
	"InvalidNumber",
	"IntegerOutOfRange",
	"InvalidDateTime",
	"NestingDepthExceeded",
] as const;

/**
 * Semantic-stage error codes thrown as {@link RawTomlError} for table and key
 * conflicts.
 *
 * **Example** (Pin a semantic code)
 *
 * ```ts
 * import { TOML_SEMANTIC_ERROR_CODES } from "../../../toml/internal/diagnostics.ts"
 *
 * console.log(TOML_SEMANTIC_ERROR_CODES[0]) // "DuplicateKey"
 * ```
 *
 * @see {@link TomlDiagnostic} for the public materialization of these codes.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const TOML_SEMANTIC_ERROR_CODES = [
	"DuplicateKey",
	"TableRedefined",
	"ArrayOfTablesConflict",
	"DottedKeyConflict",
	"InlineTableExtended",
] as const;

/**
 * Stringify-stage error codes thrown as {@link RawTomlError} when a value
 * cannot be encoded.
 *
 * **Gotchas**
 *
 * `IntegerOutOfRange` and `NestingDepthExceeded` are intentionally shared with
 * {@link TOML_PARSE_ERROR_CODES}: the same concept (an out-of-range integer, a
 * nesting guard trip) applies on both the parse and stringify sides. Unioning
 * the arrays and "fixing" the overlap would be a bug.
 *
 * **Example** (Pin a stringify-only code)
 *
 * ```ts
 * import { TOML_STRINGIFY_ERROR_CODES } from "../../../toml/internal/diagnostics.ts"
 *
 * console.log(TOML_STRINGIFY_ERROR_CODES.includes("CircularReference")) // true
 * console.log(TOML_STRINGIFY_ERROR_CODES.includes("IntegerOutOfRange")) // true
 * ```
 *
 * @see {@link TOML_PARSE_ERROR_CODES} for the parse-side array that shares two codes.
 * @see {@link TomlDiagnostic} for the public materialization of these codes.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const TOML_STRINGIFY_ERROR_CODES = [
	"CircularReference",
	"UnsupportedValue",
	// IntegerOutOfRange and NestingDepthExceeded are intentionally shared with
	// TOML_PARSE_ERROR_CODES: the same concept (an out-of-range integer, a
	// nesting guard trip) applies on both the parse and stringify sides.
	"IntegerOutOfRange",
	"NestingDepthExceeded",
] as const;

/**
 * One lexer-stage error-code string admitted by {@link TOML_LEX_ERROR_CODES}.
 *
 * @see {@link TOML_LEX_ERROR_CODES} for the runtime tuple of lexer codes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type TomlLexErrorCodeRaw = (typeof TOML_LEX_ERROR_CODES)[number];

/**
 * One parser-stage error-code string admitted by {@link TOML_PARSE_ERROR_CODES}.
 *
 * @see {@link TOML_PARSE_ERROR_CODES} for the runtime tuple of parser codes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type TomlParseErrorCodeRaw = (typeof TOML_PARSE_ERROR_CODES)[number];

/**
 * One semantic-stage error-code string admitted by {@link TOML_SEMANTIC_ERROR_CODES}.
 *
 * @see {@link TOML_SEMANTIC_ERROR_CODES} for the runtime tuple of semantic codes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type TomlSemanticErrorCodeRaw = (typeof TOML_SEMANTIC_ERROR_CODES)[number];

/**
 * One stringify-stage error-code string admitted by {@link TOML_STRINGIFY_ERROR_CODES}.
 *
 * @see {@link TOML_STRINGIFY_ERROR_CODES} for the runtime tuple of stringify codes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type TomlStringifyErrorCodeRaw = (typeof TOML_STRINGIFY_ERROR_CODES)[number];

/**
 * Union of every engine error-code string across lexer, parser, semantic, and
 * stringify stages.
 *
 * @see {@link RawDiagnostic} for the record that carries one of these codes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type TomlErrorCodeRaw =
	| TomlLexErrorCodeRaw
	| TomlParseErrorCodeRaw
	| TomlSemanticErrorCodeRaw
	| TomlStringifyErrorCodeRaw;

/**
 * The engine's diagnostic record. Public modules derive line/character.
 *
 * @see {@link RawTomlError} for the throw carrier that wraps this record.
 * @see {@link TomlDiagnostic} for the public materialization that adds line and character.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface RawDiagnostic {
	readonly code: TomlErrorCodeRaw;
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}

/**
 * The engine's only throw carrier besides {@link GuardExceeded}.
 *
 * **Gotchas**
 *
 * Public modules catch this and materialize {@link TomlDiagnostic}; a new
 * engine file that imports {@link TomlDiagnostic} would recreate the cycle
 * the firewall exists to prevent. `IntegerOutOfRange` and
 * `NestingDepthExceeded` are shared between parse and stringify on purpose.
 *
 * **Example** (Construct a raw parser error)
 *
 * ```ts
 * import { RawTomlError } from "../../../toml/internal/diagnostics.ts"
 *
 * const error = new RawTomlError({
 *   code: "ExpectedEquals",
 *   message: "expected =",
 *   offset: 4,
 *   length: 1,
 * })
 * console.log(error._tag) // "RawTomlError"
 * console.log(error.diagnostic.code) // "ExpectedEquals"
 * ```
 *
 * @see {@link GuardExceeded} for the other engine throw carrier.
 * @see {@link TomlDiagnostic} for the public materialization of this record.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class RawTomlError extends Error {
	readonly _tag = "RawTomlError";
	readonly diagnostic: RawDiagnostic;
	constructor(diagnostic: RawDiagnostic) {
		super(diagnostic.message);
		this.diagnostic = diagnostic;
	}
}

/**
 * Type guard for {@link RawTomlError}, used by public facades at the engine
 * firewall.
 *
 * **Example** (Narrow a thrown carrier)
 *
 * ```ts
 * import { isRawTomlError, RawTomlError } from "../../../toml/internal/diagnostics.ts"
 *
 * const error: unknown = new RawTomlError({
 *   code: "ExpectedValue",
 *   message: "expected a value",
 *   offset: 7,
 *   length: 0,
 * })
 * console.log(isRawTomlError(error)) // true
 * console.log(isRawTomlError(new Error("nope"))) // false
 * ```
 *
 * @see {@link RawTomlError} for the class this guard narrows.
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isRawTomlError = (u: unknown): u is RawTomlError => u instanceof RawTomlError;
