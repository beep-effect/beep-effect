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

/**
 * The 22 token kinds produced by the YAML lexer.
 *
 * @see {@link YamlToken} for the positioned token that carries one of these kinds.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type YamlTokenKind =
	| "document-start"
	| "document-end"
	| "directive"
	| "tag"
	| "anchor"
	| "alias"
	| "scalar"
	| "block-map-start"
	| "block-map-key"
	| "block-map-value"
	| "block-seq-start"
	| "block-seq-entry"
	| "flow-map-start"
	| "flow-map-end"
	| "flow-seq-start"
	| "flow-seq-end"
	| "flow-separator"
	| "newline"
	| "whitespace"
	| "comment"
	| "byte-order-mark"
	| "error";

/**
 * A single YAML token produced by the lexer: its kind, raw text slice, and
 * exact source position (zero-based `offset`/`line`/`column`, `length` in
 * UTF-16 code units).
 *
 * @see {@link YamlTokens.tokenize} for the public promotion of these records.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface YamlToken {
	readonly kind: YamlTokenKind;
	readonly value: string;
	readonly offset: number;
	readonly length: number;
	readonly line: number;
	readonly column: number;
}
