// Internal Concrete Syntax Tree types. The CST layer is not public surface —
// a `Stream<CstNode>` interface is deferred until an LSP-tooling consumer
// materializes.

/** The 15 node types produced by the YAML CST parser. */
export type CstNodeType =
	| "document"
	| "directive"
	| "comment"
	| "block-map"
	| "block-seq"
	| "flow-map"
	| "flow-seq"
	| "block-scalar"
	| "flow-scalar"
	| "alias"
	| "anchor"
	| "tag"
	| "whitespace"
	| "newline"
	| "error";

/**
 * A single YAML CST node: its type, raw source slice, span, and optional
 * recursive children. No interpretation occurs at the CST level — `true` is
 * still the string `"true"`.
 */
export interface CstNode {
	readonly type: CstNodeType;
	readonly source: string;
	readonly offset: number;
	readonly length: number;
	readonly children?: ReadonlyArray<CstNode>;
}
