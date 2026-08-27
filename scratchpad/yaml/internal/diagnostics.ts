/**
 * Internal diagnostic vocabulary: staged error-code sets, the raw record
 * the engine emits, and the single fatal-code predicate.
 *
 * The engine never constructs public error/diagnostic classes — it emits
 * raw `{ code, message, offset, length }` records and the public facade
 * materializes `YamlDiagnostic` (computing `line`/`character` from
 * `offset`). The import arrow points facade → engine, never back
 * (`noImportCycles` is error-level).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Error codes the lexer may emit.
 *
 * **Example** (Unterminated quote becomes a parse failure)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Result.isFailure(Yaml.parseResult("\"unterminated"))) // true
 * ```
 *
 * @see {@link YamlLexErrorCode} for the closed union of these literals.
 * @internal
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
 * Error codes the CST parser may emit.
 *
 * **Example** (Tab indentation is a parse-stage fatal)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * const result = Yaml.parseResult("a:\n\t- 1\n")
 * console.log(Result.isFailure(result)) // true
 * console.log(YamlDiagnostic.isFatal("TabIndentation")) // true
 * ```
 *
 * @see {@link YamlParseStageErrorCode} for the closed union of these literals.
 * @internal
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
 * Error codes the composer may emit.
 *
 * **Gotchas**
 *
 * `DuplicateAnchor` is reused for "anchor on alias" (error channel) and
 * "same name defined twice" (warning, last-write-wins). Inspect `message`
 * to tell the cases apart. `CircularAlias` is vocabulary-only today — it
 * is in this table but is not emitted and is not fatal.
 *
 * **Example** (Undefined alias is a compose-stage fatal)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * console.log(Result.isFailure(Yaml.parseResult("*missing\n"))) // true
 * console.log(YamlDiagnostic.isFatal("UndefinedAlias")) // true
 * console.log(YamlDiagnostic.isFatal("CircularAlias")) // false
 * ```
 *
 * @see {@link YamlComposeErrorCode} for the closed union of these literals.
 * @internal
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
 * Error codes for the stringifier stage. The engine's only deliberate
 * stringify failure is the circular-reference guard (thrown as
 * `StringifyFailure`); the facade materializes it under this code so
 * `YamlStringifyError` carries structured diagnostics rather than a
 * `reason` string.
 *
 * **Gotchas**
 *
 * Nesting overflow throws `StringifyDepthExceeded` and the facade maps it
 * to `NestingDepthExceeded` — that code is not in this table.
 *
 * **Example** (Circular object fails stringify, not parse)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * const cyclic: { self?: unknown } = {}
 * cyclic.self = cyclic
 * console.log(Result.isFailure(Yaml.stringifyResult(cyclic))) // true
 * console.log(YamlDiagnostic.isFatal("CircularReference")) // false
 * ```
 *
 * @see {@link StringifyFailure} for the synchronous throw the facade catches.
 * @internal
 * @category constants
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * This is not a parse-stage set. `DirectiveCarryingDocument` is
 * correctness, not taste — dropping `%TAG` would orphan shorthand tags.
 *
 * **Example** (Modify refuses a multi-document stream)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * const refused = Effect.runSync(
 *   YamlFormat.modify("a: 1\n---\nb: 2\n", ["a"], 9).pipe(
 *     Effect.match({ onFailure: () => true, onSuccess: () => false }),
 *   ),
 * )
 * console.log(refused) // true
 * ```
 *
 * @see {@link YamlFormat.modify} for the public entry that raises these codes.
 * @internal
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
] as const;

/**
 * Closed set of codes the lexer may emit. Not all are fatal — see
 * {@link FATAL_CODES} / {@link isFatalCode}.
 *
 * @see {@link YAML_LEX_ERROR_CODES} for the source array of these literals.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type YamlLexErrorCode = (typeof YAML_LEX_ERROR_CODES)[number];

/**
 * Closed set of codes the CST parser may emit. Fatality is declared on
 * {@link FATAL_CODES}, not by appearing in this table.
 *
 * @see {@link YAML_PARSE_ERROR_CODES} for the source array of these literals.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type YamlParseStageErrorCode = (typeof YAML_PARSE_ERROR_CODES)[number];

/**
 * Closed set of codes the composer may emit.
 *
 * **Gotchas**
 *
 * Fatality is not "appears in a stage table". `CircularAlias` is
 * vocabulary-only today. `DuplicateAnchor` is fatal when present on the
 * **error** list (anchor-on-alias), not when it is a last-write-wins warning.
 *
 * @see {@link YAML_COMPOSE_ERROR_CODES} for the source array of these literals.
 * @see {@link FATAL_CODES} for which of these abort a parse.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type YamlComposeErrorCode = (typeof YAML_COMPOSE_ERROR_CODES)[number];

/**
 * Closed set of codes the stringifier facade may materialize. Nesting
 * overflow uses a different public diagnostic after catching
 * `StringifyDepthExceeded`.
 *
 * @see {@link YAML_STRINGIFY_ERROR_CODES} for the source array of these literals.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type YamlStringifyStageErrorCode = (typeof YAML_STRINGIFY_ERROR_CODES)[number];

/**
 * Closed set of codes `YamlFormat.modify` may raise. Not produced by parse
 * or compose.
 *
 * @see {@link YAML_MODIFY_ERROR_CODES} for the source array of these literals.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type YamlModifyStageErrorCode = (typeof YAML_MODIFY_ERROR_CODES)[number];

/**
 * Union of every pipeline-stage error code. Stage discrimination lives in
 * the code, not in separate error classes.
 *
 * @see {@link YamlDiagnostic} for the public materialization of one code plus position.
 * @internal
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
 * A raw diagnostic record emitted by the engine. Position is offset-based
 * only; the facade computes `line`/`character` when materializing the public
 * `YamlDiagnostic`.
 *
 * **Gotchas**
 *
 * Do not construct public `@beep` diagnostic classes from this file — that
 * would reverse the facade → engine import arrow. Examples and engine code
 * build `{ code, message, offset, length }` records only.
 *
 * @see {@link YamlDiagnostic} for the public class that adds `line`/`character`.
 * @internal
 * @category type-level
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * Fatality ≠ "appears in a stage table". Hardening extras
 * `UnexpectedCharacter` and `NestingDepthExceeded` are fatal.
 * `CircularAlias` is compose vocabulary but not fatal and not emitted.
 * `DuplicateAnchor` is fatal when it lands on the error list (see
 * {@link checkAnchorOnAlias}). `CircularReference` is a stringify throw,
 * not a parse fatal.
 *
 * **Example** (Fatal vs non-fatal codes)
 *
 * ```ts
 * import { YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlDiagnostic.isFatal("UndefinedAlias")) // true
 * console.log(YamlDiagnostic.isFatal("UnexpectedCharacter")) // true
 * console.log(YamlDiagnostic.isFatal("CircularAlias")) // false
 * console.log(YamlDiagnostic.isFatal("CircularReference")) // false
 * ```
 *
 * @see {@link isFatalCode} for the predicate the facade applies after compose.
 * @internal
 * @category constants
 * @since 0.0.0
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

/**
 * Whether `code` is fatal to a parse.
 *
 * **Gotchas**
 *
 * Compose entry points return raw diagnostics unfiltered. The facade
 * applies this predicate; calling the engine directly and treating
 * `errors.length > 0` as fatal (or as non-fatal) disagrees with
 * {@link Yaml.parse}.
 *
 * **Example** (Public predicate matches the engine table)
 *
 * ```ts
 * import { YamlDiagnostic } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlDiagnostic.isFatal("AliasCountExceeded")) // true
 * console.log(YamlDiagnostic.isFatal("CircularAlias")) // false
 * ```
 *
 * @see {@link FATAL_CODES} for the set this predicate consults.
 * @see {@link YamlDiagnostic.isFatal} for the public wrapper.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export function isFatalCode(code: YamlErrorCode): boolean {
	return FATAL_CODES.has(code);
}
