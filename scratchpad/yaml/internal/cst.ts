/**
 * Internal Concrete Syntax Tree types for the YAML engine.
 *
 * The CST layer is not public surface — a `Stream<CstNode>` interface is
 * deferred until an LSP-style consumer materializes. No interpretation
 * occurs here: the scalar `true` is still the source string `"true"`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * The 15 node types produced by the YAML CST parser.
 *
 * @see {@link CstNode} for the recursive node that carries one of these types.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
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
 *
 * @see {@link parseCSTAll} for the parser that produces these nodes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface CstNode {
	readonly type: CstNodeType;
	readonly source: string;
	readonly offset: number;
	readonly length: number;
	readonly children?: ReadonlyArray<CstNode>;
}
