import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
// The engine's raw diagnostic vocabulary. Public modules materialize these
// into TomlDiagnostic (adding line/character); the engine never imports
// public modules. See src/TomlDiagnostic.ts for the public side of the
// engine/public firewall (yaml/jsonc precedent).

/**
 * Lists the diagnostic codes emitted while scanning TOML source.
 *
 * **Example** (Count lexical diagnostic codes)
 *
 * ```ts
 * import { TOML_LEX_ERROR_CODES } from "@beep/scratchpad/effected/toml/internal/diagnostics";
 *
 * console.log(TOML_LEX_ERROR_CODES.length) // 8
 * ```
 *
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
 * Lists the diagnostic codes emitted while parsing TOML expressions and values.
 *
 * **Example** (Count parsing diagnostic codes)
 *
 * ```ts
 * import { TOML_PARSE_ERROR_CODES } from "@beep/scratchpad/effected/toml/internal/diagnostics";
 *
 * console.log(TOML_PARSE_ERROR_CODES.length) // 12
 * ```
 *
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
 * Lists the diagnostic codes emitted when TOML keys and tables conflict.
 *
 * **Example** (Count semantic diagnostic codes)
 *
 * ```ts
 * import { TOML_SEMANTIC_ERROR_CODES } from "@beep/scratchpad/effected/toml/internal/diagnostics";
 *
 * console.log(TOML_SEMANTIC_ERROR_CODES.length) // 5
 * ```
 *
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
 * Lists the diagnostic codes emitted when serializing unsupported or invalid TOML values.
 *
 * **Details**
 *
 * `IntegerOutOfRange` and `NestingDepthExceeded` are intentionally shared
 * with parsing: the same concepts apply on both the parse and stringify sides.
 *
 * **Example** (Count stringify diagnostic codes)
 *
 * ```ts
 * import { TOML_STRINGIFY_ERROR_CODES } from "@beep/scratchpad/effected/toml/internal/diagnostics";
 *
 * console.log(TOML_STRINGIFY_ERROR_CODES.length) // 4
 * ```
 *
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
 * Identifies a diagnostic produced by the TOML scanner.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TomlLexErrorCodeRaw = (typeof TOML_LEX_ERROR_CODES)[number];
/**
 * Identifies a diagnostic produced by TOML syntax or value parsing.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TomlParseErrorCodeRaw = (typeof TOML_PARSE_ERROR_CODES)[number];
/**
 * Identifies a diagnostic produced by TOML key and table analysis.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TomlSemanticErrorCodeRaw = (typeof TOML_SEMANTIC_ERROR_CODES)[number];
/**
 * Identifies a diagnostic produced by TOML serialization.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TomlStringifyErrorCodeRaw = (typeof TOML_STRINGIFY_ERROR_CODES)[number];
/**
 * Combines the raw diagnostic codes accepted across all TOML engine stages.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TomlErrorCodeRaw =
	| TomlLexErrorCodeRaw
	| TomlParseErrorCodeRaw
	| TomlSemanticErrorCodeRaw
	| TomlStringifyErrorCodeRaw;

/** The engine's diagnostic record. Public modules derive line/character. */
const $I = $ScratchpadId.create("effected/toml/internal/diagnostics");

/**
 * Models the engine's diagnostic record, from which public modules derive line and character positions.
 *
 * **Example** (Decode a raw diagnostic)
 *
 * ```ts
 * import { RawDiagnostic } from "@beep/scratchpad/effected/toml/internal/diagnostics";
 * import * as S from "effect/Schema";
 *
 * const diagnostic = S.decodeUnknownSync(RawDiagnostic)({
 *   code: "ExpectedKey", message: "Expected a key", offset: 0, length: 1,
 * });
 * console.log(diagnostic.code) // ExpectedKey
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RawDiagnostic = S.Struct({
	code: S.Union([
		S.Literals(TOML_LEX_ERROR_CODES),
		S.Literals(TOML_PARSE_ERROR_CODES),
		S.Literals(TOML_SEMANTIC_ERROR_CODES),
		S.Literals(TOML_STRINGIFY_ERROR_CODES),
	]).annotateKey({ description: "The engine stage's diagnostic code." }),
	message: S.String.annotateKey({ description: "The diagnostic's explanatory text." }),
	offset: S.Finite.annotateKey({ description: "Zero-based source offset of the offending span." }),
	length: S.Finite.annotateKey({ description: "Length of the offending source span." }),
}).annotate($I.annote("RawDiagnostic", { description: "An engine diagnostic before the facade derives line and character positions." }));

/**
 * Describes an engine diagnostic before public modules derive line and character positions.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawDiagnostic = typeof RawDiagnostic.Type;

/**
 * Carries engine diagnostics as the engine's only throw carrier besides `GuardExceeded`.
 *
 * **Example** (Inspect the carried diagnostic)
 *
 * ```ts
 * import { RawTomlError } from "@beep/scratchpad/effected/toml/internal/diagnostics";
 *
 * const error = RawTomlError.make({
 *   code: "ExpectedKey", message: "Expected a key", offset: 0, length: 1,
 * });
 * console.log(error.diagnostic.code) // ExpectedKey
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RawTomlError extends S.TaggedError<RawTomlError>($I`RawTomlError`)("RawTomlError", RawDiagnostic.fields,
	$I.annote("RawTomlError", { description: "The engine's diagnostic throw carrier, caught by the public facade." })) {
	/**
	 * Reports the standard error name for the raw engine carrier.
	 *
	 * **Example** (Read the raw error name)
	 *
	 * ```ts
	 * import { RawTomlError } from "@beep/scratchpad/effected/toml/internal/diagnostics";
	 *
	 * const error = RawTomlError.make({
	 *   code: "ExpectedKey", message: "Expected a key", offset: 0, length: 1,
	 * });
	 * console.log(error.name) // Error
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override readonly name = "Error";
	/**
	 * Exposes the carried code, message and source span as a raw diagnostic record.
	 *
	 * **Example** (Read the diagnostic source offset)
	 *
	 * ```ts
	 * import { RawTomlError } from "@beep/scratchpad/effected/toml/internal/diagnostics";
	 *
	 * const error = RawTomlError.make({
	 *   code: "ExpectedKey", message: "Expected a key", offset: 0, length: 1,
	 * });
	 * console.log(error.diagnostic.offset) // 0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly diagnostic: RawDiagnostic = { code: this.code, message: this.message, offset: this.offset, length: this.length };
}

/**
 * Recognizes the raw TOML error carrier before public facades materialize a typed diagnostic.
 *
 * **Example** (Recognize a raw error carrier)
 *
 * ```ts
 * import { isRawTomlError, RawTomlError } from "@beep/scratchpad/effected/toml/internal/diagnostics";
 *
 * const error = RawTomlError.make({
 *   code: "ExpectedKey", message: "Expected a key", offset: 0, length: 1,
 * });
 * console.log(isRawTomlError(error)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isRawTomlError = S.is(RawTomlError);
