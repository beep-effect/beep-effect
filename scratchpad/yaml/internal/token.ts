// Internal lexical token types. The token layer is not public surface — a
// `Stream<YamlToken>` tokenizer interface is deferred until an LSP-tooling
// consumer materializes.

/** The 22 token kinds produced by the YAML lexer. */
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
 */
export interface YamlToken {
	readonly kind: YamlTokenKind;
	readonly value: string;
	readonly offset: number;
	readonly length: number;
	readonly line: number;
	readonly column: number;
}
