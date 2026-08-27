/**
 * Internal lexical token types for the YAML engine.
 *
 * This layer is not public surface — a `Stream<YamlToken>` tokenizer is
 * deferred until an LSP-style consumer needs it. Public callers consume
 * {@link YamlTokens} instead; those tokens rename `value`/`column` to
 * `text`/`character` and report UTF-16 `length`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";

const $I = $ScratchpadId.create("yaml/internal/token");

/**
 * The 22 token kinds produced by the YAML lexer.
 *
 * @see {@link YamlToken} for the positioned token that carries one of these kinds.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const YamlTokenKind = Schema.Literals([
	"document-start",
	"document-end",
	"directive",
	"tag",
	"anchor",
	"alias",
	"scalar",
	"block-map-start",
	"block-map-key",
	"block-map-value",
	"block-seq-start",
	"block-seq-entry",
	"flow-map-start",
	"flow-map-end",
	"flow-seq-start",
	"flow-seq-end",
	"flow-separator",
	"newline",
	"whitespace",
	"comment",
	"byte-order-mark",
	"error",
]).pipe(
	$I.annoteSchema("YamlTokenKind", {
		description: "Token kinds produced by the internal YAML lexer.",
	}),
);

export type YamlTokenKind = typeof YamlTokenKind.Type;

/**
 * A single YAML token produced by the lexer: its kind, raw text slice, and
 * exact source position (zero-based `offset`/`line`/`column`, `length` in
 * UTF-16 code units).
 *
 * **Example** (Guard an internal token)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlToken } from "@beep/scratchpad/yaml/internal/token"
 *
 * console.log(S.is(YamlToken)({ kind: "scalar", value: "x", offset: 0, length: 1, line: 0, column: 0 })) // true
 * ```
 *
 * @see {@link YamlTokens.tokenize} for the public promotion of these records.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const YamlToken = Schema.Struct({
	kind: YamlTokenKind,
	value: Schema.String,
	offset: Schema.Finite,
	length: Schema.Finite,
	line: Schema.Finite,
	column: Schema.Finite,
}).pipe(
	$I.annoteSchema("YamlToken", {
		description: "Internal YAML lexer token with its raw source text and UTF-16 position.",
	}),
);

export type YamlToken = typeof YamlToken.Type;
