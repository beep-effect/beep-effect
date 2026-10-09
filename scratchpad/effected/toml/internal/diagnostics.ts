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
export interface RawDiagnostic {
	readonly code: TomlErrorCodeRaw;
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}

/** The engine's only throw carrier besides GuardExceeded. */
export class RawTomlError extends Error {
	readonly _tag = "RawTomlError";
	constructor(readonly diagnostic: RawDiagnostic) {
		super(diagnostic.message);
	}
}

export const isRawTomlError = (u: unknown): u is RawTomlError => u instanceof RawTomlError;
