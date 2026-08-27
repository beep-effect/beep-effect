// Internal diagnostic vocabulary: the staged error-code sets, the raw
// diagnostic record the engine emits, and the single fatal-code predicate.
//
// The engine never constructs public error/diagnostic classes — it emits raw
// `{ code, message, offset, length }` records and the public facade
// materializes `YamlDiagnostic` (computing `line`/`character` from `offset`
// against the source text). This keeps the import arrow pointing facade →
// engine, never back (`noImportCycles` is error-level).

/** Error codes emitted by the lexer stage. */
export const YAML_LEX_ERROR_CODES = [
	"UnexpectedCharacter",
	"UnterminatedString",
	"InvalidEscapeSequence",
	"InvalidUnicode",
	"UnterminatedBlockScalar",
	"UnterminatedFlowCollection",
	"InvalidDirective",
	"InvalidTagHandle",
	"InvalidAnchorName",
	"UnexpectedByteOrderMark",
] as const;

/** Error codes emitted by the CST-parser stage. */
export const YAML_PARSE_ERROR_CODES = [
	"InvalidIndentation",
	"DuplicateKey",
	"UnexpectedToken",
	"MissingValue",
	"MissingKey",
	"TabIndentation",
	"InvalidBlockStructure",
	"MalformedFlowCollection",
	"NestingDepthExceeded",
] as const;

/** Error codes emitted by the composer stage. */
export const YAML_COMPOSE_ERROR_CODES = [
	"UndefinedAlias",
	"DuplicateAnchor",
	"CircularAlias",
	"UnresolvedTag",
	"InvalidTagValue",
	"AliasCountExceeded",
	"InvalidDirective",
] as const;

/**
 * Error codes for the stringifier stage. The engine's only deliberate
 * stringify failure is the circular-reference guard (thrown as
 * `StringifyFailure`); the facade materializes it under this code so
 * `YamlStringifyError` carries structured diagnostics rather than a
 * `reason` string.
 */
export const YAML_STRINGIFY_ERROR_CODES = ["CircularReference"] as const;

/**
 * Error codes for the modify stage (`YamlFormat.modify`'s guards and path
 * navigation against an already-composed AST). Not raised by the
 * parser/composer. `MultiDocumentStream` is the single-document-contract
 * refusal: `modify` re-emits exactly one document, so a multi-document
 * stream fails typed rather than silently truncating documents 2..n.
 * `DirectiveCarryingDocument` is the directive refusal: the stringifier does
 * not re-emit `%YAML`/`%TAG` directive lines, and re-emitting a document
 * without its `%TAG` orphans every shorthand tag that depends on it — the
 * output would be unparseable — so modify fails typed rather than corrupting.
 */
export const YAML_MODIFY_ERROR_CODES = [
	"EmptyDocument",
	"PathNotFound",
	"InvalidIndex",
	"NotNavigable",
	"MultiDocumentStream",
	"DirectiveCarryingDocument",
] as const;

/** The lexer-stage error-code union. */
export type YamlLexErrorCode = (typeof YAML_LEX_ERROR_CODES)[number];

/** The CST-parser-stage error-code union. */
export type YamlParseStageErrorCode = (typeof YAML_PARSE_ERROR_CODES)[number];

/** The composer-stage error-code union. */
export type YamlComposeErrorCode = (typeof YAML_COMPOSE_ERROR_CODES)[number];

/** The stringifier-stage error-code union. */
export type YamlStringifyStageErrorCode = (typeof YAML_STRINGIFY_ERROR_CODES)[number];

/** The modify-stage error-code union. */
export type YamlModifyStageErrorCode = (typeof YAML_MODIFY_ERROR_CODES)[number];

/** Union of all error codes across all pipeline stages. */
export type YamlErrorCode =
	| YamlLexErrorCode
	| YamlParseStageErrorCode
	| YamlComposeErrorCode
	| YamlStringifyStageErrorCode
	| YamlModifyStageErrorCode;

/**
 * A raw diagnostic record emitted by the engine. Position is offset-based
 * only; the facade computes `line`/`character` when materializing the public
 * `YamlDiagnostic`.
 */
export interface RawDiagnostic {
	readonly code: YamlErrorCode;
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}

/**
 * The single source of truth for which diagnostic codes are fatal to a
 * parse (vs. recoverable warnings-as-data). Replaces the v3 source's three
 * subtly-differing inline fatal lists with their union: fatality is a
 * property of the code, declared once.
 */
export const FATAL_CODES: ReadonlySet<YamlErrorCode> = new Set([
	"UndefinedAlias",
	"DuplicateAnchor",
	"AliasCountExceeded",
	"UnexpectedToken",
	"InvalidDirective",
	"MalformedFlowCollection",
	"InvalidIndentation",
	"TabIndentation",
	"UnresolvedTag",
	// Hardening additions beyond the v3 lists: raw C0 control characters in
	// scalars and the composer's nesting-depth guard both abort a parse.
	"UnexpectedCharacter",
	"NestingDepthExceeded",
]);

/** Whether `code` is fatal to a parse. */
export function isFatalCode(code: YamlErrorCode): boolean {
	return FATAL_CODES.has(code);
}
