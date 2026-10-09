// Internal diagnostic vocabulary: the staged error-code sets, the raw
// diagnostic record the engine emits, and the single fatal-code predicate.
//
// The engine never constructs public error/diagnostic classes — it emits raw
// `{ code, message, offset, length }` records and the public facade
// materializes `YamlDiagnostic` (computing `line`/`character` from `offset`
// against the source text). This keeps the import arrow pointing facade →
// engine, never back (`noImportCycles` is error-level).

import * as HashSet from "effect/HashSet";

/**
 * Error codes emitted by the lexer stage.
 *
 * **Example** (Inspect the first lexer error code)
 *
 * ```ts
 * import { YAML_LEX_ERROR_CODES } from "@beep/scratchpad/effected/yaml/internal/diagnostics"
 *
 * console.log(YAML_LEX_ERROR_CODES[0]) // UnexpectedCharacter
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
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

/**
 * Error codes emitted by the CST-parser stage.
 *
 * **Example** (Inspect the first CST-parser error code)
 *
 * ```ts
 * import { YAML_PARSE_ERROR_CODES } from "@beep/scratchpad/effected/yaml/internal/diagnostics"
 *
 * console.log(YAML_PARSE_ERROR_CODES[0]) // InvalidIndentation
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
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

/**
 * Error codes emitted by the composer stage.
 *
 * **Example** (Inspect the first composer error code)
 *
 * ```ts
 * import { YAML_COMPOSE_ERROR_CODES } from "@beep/scratchpad/effected/yaml/internal/diagnostics"
 *
 * console.log(YAML_COMPOSE_ERROR_CODES[0]) // UndefinedAlias
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
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
 * Error codes for the stringifier stage.
 *
 * **Details**
 *
 * The engine's only deliberate stringify failure is the circular-reference guard
 * (thrown as `StringifyFailure`); the facade materializes it under this code so
 * `YamlStringifyError` carries structured diagnostics rather than a `reason` string.
 *
 * **Example** (Inspect the circular-reference code)
 *
 * ```ts
 * import { YAML_STRINGIFY_ERROR_CODES } from "@beep/scratchpad/effected/yaml/internal/diagnostics"
 *
 * console.log(YAML_STRINGIFY_ERROR_CODES[0]) // CircularReference
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YAML_STRINGIFY_ERROR_CODES = ["CircularReference"] as const;

/**
 * Error codes for the modify stage (`YamlFormat.modify`'s guards and path
 * navigation against an already-composed AST).
 *
 * **Gotchas**
 *
 * Not raised by the
 * parser/composer. `MultiDocumentStream` is the single-document-contract
 * refusal: `modify` re-emits exactly one document, so a multi-document
 * stream fails typed rather than silently truncating documents 2..n.
 * `DirectiveCarryingDocument` is the directive refusal: the stringifier does
 * not re-emit `%YAML`/`%TAG` directive lines, and re-emitting a document
 * without its `%TAG` orphans every shorthand tag that depends on it — the
 * output would be unparseable — so modify fails typed rather than corrupting.
 *
 * `CircularReference` and `NestingDepthExceeded` are the two limits on the
 * replacement value itself: `modify` lowers a plain JavaScript value into
 * AST nodes, and an object graph that points back at itself or nests deeper
 * than `MAX_NESTING_DEPTH` has no finite YAML rendering. Both names are
 * deliberately the ones the stringify and compose stages already use for the
 * same conditions, so `YamlErrorCode` gains no member.
 *
 * **Example** (Inspect the empty-document guard)
 *
 * ```ts
 * import { YAML_MODIFY_ERROR_CODES } from "@beep/scratchpad/effected/yaml/internal/diagnostics"
 *
 * console.log(YAML_MODIFY_ERROR_CODES[0]) // EmptyDocument
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YAML_MODIFY_ERROR_CODES = [
	"EmptyDocument",
	"PathNotFound",
	"InvalidIndex",
	"NotNavigable",
	"MultiDocumentStream",
	"DirectiveCarryingDocument",
	"CircularReference",
	"NestingDepthExceeded",
] as const;

/**
 * The lexer-stage error-code union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlLexErrorCode = (typeof YAML_LEX_ERROR_CODES)[number];

/**
 * The CST-parser-stage error-code union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlParseStageErrorCode = (typeof YAML_PARSE_ERROR_CODES)[number];

/**
 * The composer-stage error-code union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlComposeErrorCode = (typeof YAML_COMPOSE_ERROR_CODES)[number];

/**
 * The stringifier-stage error-code union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlStringifyStageErrorCode = (typeof YAML_STRINGIFY_ERROR_CODES)[number];

/**
 * The modify-stage error-code union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlModifyStageErrorCode = (typeof YAML_MODIFY_ERROR_CODES)[number];

/**
 * Union of all error codes across all pipeline stages.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlErrorCode =
	| YamlLexErrorCode
	| YamlParseStageErrorCode
	| YamlComposeErrorCode
	| YamlStringifyStageErrorCode
	| YamlModifyStageErrorCode;

/**
 * A raw diagnostic record emitted by the engine.
 *
 * **Details**
 *
 * Position is offset-based only; the facade computes `line`/`character`
 * when materializing the public `YamlDiagnostic`.
 *
 * @category models
 * @since 0.0.0
 */
export interface RawDiagnostic {
	readonly code: YamlErrorCode;
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}

/**
 * The single source of truth for which diagnostic codes are fatal to a parse
 * (vs. recoverable warnings-as-data): fatality is a property of the code, declared once.
 *
 * **Example** (Inspect fatal and recoverable codes)
 *
 * ```ts
 * import { FATAL_CODES } from "@beep/scratchpad/effected/yaml/internal/diagnostics"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.has(FATAL_CODES, "UndefinedAlias")) // true
 * console.log(HashSet.has(FATAL_CODES, "DuplicateKey")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FATAL_CODES: HashSet.HashSet<YamlErrorCode> = HashSet.fromIterable([
	"UndefinedAlias",
	"DuplicateAnchor",
	"AliasCountExceeded",
	"UnexpectedToken",
	"InvalidDirective",
	"MalformedFlowCollection",
	"InvalidIndentation",
	"TabIndentation",
	"UnresolvedTag",
	// Hardening: raw C0 control characters in scalars and the composer's
	// nesting-depth guard both abort a parse.
	"UnexpectedCharacter",
	"NestingDepthExceeded",
]);

/**
 * Tests whether a diagnostic code is fatal to a parse.
 *
 * **Example** (Distinguish fatal errors from warnings)
 *
 * ```ts
 * import { isFatalCode } from "@beep/scratchpad/effected/yaml/internal/diagnostics"
 *
 * console.log(isFatalCode("UndefinedAlias")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function isFatalCode(code: YamlErrorCode): boolean {
	return HashSet.has(FATAL_CODES, code);
}
