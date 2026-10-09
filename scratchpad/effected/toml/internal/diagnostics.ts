import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
// The engine's raw diagnostic vocabulary. Public modules materialize these
// into TomlDiagnostic (adding line/character); the engine never imports
// public modules. See src/TomlDiagnostic.ts for the public side of the
// engine/public firewall (yaml/jsonc precedent).

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

export const TOML_SEMANTIC_ERROR_CODES = [
	"DuplicateKey",
	"TableRedefined",
	"ArrayOfTablesConflict",
	"DottedKeyConflict",
	"InlineTableExtended",
] as const;

export const TOML_STRINGIFY_ERROR_CODES = [
	"CircularReference",
	"UnsupportedValue",
	// IntegerOutOfRange and NestingDepthExceeded are intentionally shared with
	// TOML_PARSE_ERROR_CODES: the same concept (an out-of-range integer, a
	// nesting guard trip) applies on both the parse and stringify sides.
	"IntegerOutOfRange",
	"NestingDepthExceeded",
] as const;

export type TomlLexErrorCodeRaw = (typeof TOML_LEX_ERROR_CODES)[number];
export type TomlParseErrorCodeRaw = (typeof TOML_PARSE_ERROR_CODES)[number];
export type TomlSemanticErrorCodeRaw = (typeof TOML_SEMANTIC_ERROR_CODES)[number];
export type TomlStringifyErrorCodeRaw = (typeof TOML_STRINGIFY_ERROR_CODES)[number];
export type TomlErrorCodeRaw =
	| TomlLexErrorCodeRaw
	| TomlParseErrorCodeRaw
	| TomlSemanticErrorCodeRaw
	| TomlStringifyErrorCodeRaw;

/** The engine's diagnostic record. Public modules derive line/character. */
const $I = $ScratchpadId.create("effected/toml/internal/diagnostics");

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

export type RawDiagnostic = typeof RawDiagnostic.Type;

/** The engine's only throw carrier besides GuardExceeded. */
export class RawTomlError extends S.TaggedError<RawTomlError>($I`RawTomlError`)("RawTomlError", RawDiagnostic.fields,
	$I.annote("RawTomlError", { description: "The engine's diagnostic throw carrier, caught by the public facade." })) {
	override readonly name = "Error";
	readonly diagnostic: RawDiagnostic = { code: this.code, message: this.message, offset: this.offset, length: this.length };
}

export const isRawTomlError = S.is(RawTomlError);
